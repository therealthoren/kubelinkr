import net from 'net';
import yaml from 'js-yaml';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import {
  IActiveForwards,
  IPortForwardController,
  IProjectWithState,
  IState,
} from '../../models/IState';
import {
  IAllTrafficData,
  IPortForward,
  IPortForwardCallback,
  IProject,
  IServerSocketClient,
} from '../../models/IConfig';

const WebSocket = require('ws');

const DEBUG = false;

// @ts-ignore
process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;

const debugLog = (message: any, ...args: any[]) => {
  if (DEBUG) {
    console.log(message, ...args);
  }
};

const forwardStates: IState = {
  activeForwards: [],
};
const forwardController: { [key: string]: IPortForwardController } = {};
const projectTraffic: IAllTrafficData = {};
const projectTrafficCallbacks: any[] = [];
const stateCallbacks: any[] = [];

setInterval(() => {
  projectTrafficCallbacks.forEach((callback) => {
    callback(projectTraffic);
  });
}, 1100);

const registerTrafficCallback = (callback: (data: IAllTrafficData) => void) => {
  projectTrafficCallbacks.push(callback);
};

const registerStateChanges = (callback: (data: IState) => void) => {
  stateCallbacks.push(callback);
};

const setSTate = (state: IState) => {
  forwardStates.activeForwards = state.activeForwards;
  stateCallbacks.forEach((callback) => {
    callback(state);
  });
};

const addTrafficData = (
  project: IProject,
  forward: IPortForward,
  bytes: number,
) => {
  const key = `${project.name}`;
  if (!projectTraffic[key]) {
    projectTraffic[key] = {
      // start with 100 entries
      trafficDataEntriesPerSecond: [],
    };
    for (let i = 0; i < 100; i += 1) {
      projectTraffic[key].trafficDataEntriesPerSecond.push({
        entrySeconds: Math.floor(Date.now() / 1000) - i,
        bytes: 0,
      });
    }
  }
  const trafficData = projectTraffic[key];
  if (trafficData.trafficDataEntriesPerSecond.length > 0) {
    if (
      trafficData.trafficDataEntriesPerSecond[
        trafficData.trafficDataEntriesPerSecond.length - 1
      ].entrySeconds === Math.floor(Date.now() / 1000)
    ) {
      trafficData.trafficDataEntriesPerSecond[
        trafficData.trafficDataEntriesPerSecond.length - 1
      ].bytes += bytes;
      return;
    }
  }
  trafficData.trafficDataEntriesPerSecond.push({
    entrySeconds: Math.floor(Date.now() / 1000),
    bytes,
  });
  if (trafficData.trafficDataEntriesPerSecond.length > 100) {
    trafficData.trafficDataEntriesPerSecond.shift();
  }
};

const getUserHome = () => {
  return process.env.HOME || process.env.USERPROFILE;
};

const kubeBasicsData: any = yaml.load(
  fs.readFileSync(`${getUserHome()}/.kube/config`, 'utf8'),
);

const getClientCertificateData = (userName: any) => {
  const context = kubeBasicsData.users.find((c: any) => c.name === userName);
  return context.user['client-certificate-data'];
};

const getClientKeyData = (userName: any) => {
  const context = kubeBasicsData.users.find((c: any) => c.name === userName);
  return context.user['client-key-data'];
};

const getBearerToken = (userName: string) => {
  const context = kubeBasicsData.users.find((c: any) => c.name === userName);
  return context.user.token;
};

const getContext = (contextName: string) => {
  return kubeBasicsData.contexts.find((c: any) => c.name === contextName);
};

const getKubeUrl = (clusterName: string) => {
  const context = kubeBasicsData.clusters.find(
    (c: any) => c.name === clusterName,
  );
  if (!context) {
    console.error('context not found', clusterName);
    throw new Error('context not found');
  }
  return context.cluster.server;
};

const generateRandomId = () => {
  const e = uuidv4();
  return e;
};

const base64Decode = (clientKeyData: string) => {
  return Buffer.from(clientKeyData, 'base64').toString('utf-8');
};

// eslint-disable-next-line import/prefer-default-export
const startPortForwarding = (
  project: IProject,
  forward: IPortForward,
  callback?: IPortForwardCallback,
  httpMaxTimeout?: number,
): IPortForwardController => {
  // Check if the portForwarding not already exists
  const exists = forwardStates.activeForwards.find(
    (f) =>
      f.project === project.name &&
      f.name === forward.name &&
      f.type === forward.type &&
      f.namespace === forward.contextNamespace &&
      f.sourcePort === forward.sourcePort &&
      f.localPort === forward.localPort,
  );
  if (exists) {
    return forwardController[exists.id];
  }

  if (!httpMaxTimeout) {
    // eslint-disable-next-line no-param-reassign
    httpMaxTimeout = 20000;
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let openConnectionId = 0;

  let runningClients: IServerSocketClient[] = [];

  // open an express server to listen for the port forwarder
  const server = net.createServer((serverSocket) => {
    const createClient = (
      _serversocket: net.Socket,
      onDisconnected: () => void,
    ) => {
      try {
        openConnectionId += 1;
        const namespace: string = forward.contextNamespace || 'default';
        debugLog('namespace', namespace);
        const context = getContext(project.contextName);
        debugLog(context);
        const clusterName = context.context.cluster;
        const userName = context.context.user;
        debugLog('clusterName', clusterName);
        const url = getKubeUrl(clusterName)
          .replace('https://', 'wss://')
          .replace('http://', 'ws://');
        debugLog('url', url);
        const bearer = getBearerToken(userName);
        let authorizationData: any = {};
        let additionalWebSocketOptions: any = {};
        if (!bearer) {
          const clientCertificateData = getClientCertificateData(userName);
          const clientKeyData = getClientKeyData(userName);

          // Add the cert and key to the authorizationData for the websocket headers
          authorizationData = {};

          additionalWebSocketOptions = {
            cert: base64Decode(clientCertificateData),
            key: base64Decode(clientKeyData),
            rejectUnauthorized: false,
          };
        } else {
          authorizationData = {
            Authorization: `Bearer ${bearer}`,
          };
        }
        let messageCount = 0;
        let forcedDisconnect = false;
        let answerResetTimeout: any = null;
        let ws: any;

        const connect = () => {
          ws = new WebSocket(
            `${url}/api/v1/namespaces/${namespace}/pods/${forward.name}/portforward?ports=${forward.sourcePort}`,
            [
              'v4.channel.k8s.io',
              'v3.channel.k8s.io',
              'v2.channel.k8s.io',
              'channel.k8s.io',
            ],
            {
              ...additionalWebSocketOptions,
              headers: {
                Upgrade: 'websocket',
                Connection: 'Upgrade',
                ...authorizationData,
              },
            },
          );
          ws.on('open', function open() {});
          ws.on('message', function incoming(data: any) {
            debugLog('websocket received', data);
            if (typeof data === 'string') {
              // TODO: handle string data
            } else if (data instanceof Buffer) {
              const streamNum: number = data.readInt8(0);

              // When array contains 00 50 00 as byte array, it means the connection is closed
              // eslint-disable-next-line eqeqeq

              addTrafficData(project, forward, data.length);
              // eslint-disable-next-line eqeqeq
              if (_serversocket && streamNum === 0 && messageCount > 0) {
                if (answerResetTimeout) {
                  clearTimeout(answerResetTimeout);
                  answerResetTimeout = null;
                }
                try {
                  _serversocket.write(data.subarray(1));
                } catch (e) {
                  console.error(e);
                }
              }

              if (streamNum === 0) {
                messageCount += 1;
              }

              if (callback && callback.onData) {
                callback.onData(data);
              }
            }
          });
          _serversocket.on('upgrade', (res: any) => {
            debugLog('upgrade', res);
          });

          _serversocket.on('data', (data: any) => {
            // eslint-disable-next-line no-new,no-async-promise-executor
            new Promise(async () => {
              try {
                const buff = Buffer.alloc(data.length + 1);

                buff.writeInt8(0, 0);
                if (data instanceof Buffer) {
                  data.copy(buff, 1);
                } else {
                  buff.write(data, 1);
                }
                addTrafficData(project, forward, data.length);

                debugLog('server writes', data);
                // Wait until ws is Open
                for (let i = 0; i < 1000; i += 1) {
                  if (ws.readyState === WebSocket.OPEN) {
                    break;
                  }
                  // eslint-disable-next-line no-await-in-loop
                  await new Promise((resolve) => {
                    setTimeout(resolve, 100);
                  });
                }
                ws.send(buff);
                if (!answerResetTimeout) {
                  answerResetTimeout = setTimeout(
                    () => _serversocket.end(),
                    httpMaxTimeout,
                  );
                }
              } catch (e) {
                console.error(e);
                connect();
              }
            });
          });

          ws.on('close', function close() {
            try {
              debugLog('disconnected');
              openConnectionId -= 1;
              if (!forcedDisconnect) {
                connect();
              }
            } catch (e) {
              /* empty */
            }
          });
        };

        connect();

        _serversocket.on('end', function () {
          try {
            debugLog('end');
            if (ws.readyState === WebSocket.OPEN) {
              ws.close();
            }
          } catch (e) {
            /* empty */
          }
          onDisconnected();
        });

        _serversocket.on('close', function close() {
          try {
            debugLog('disconnected');
            openConnectionId -= 1;
            forcedDisconnect = true;
            if (ws.readyState === WebSocket.OPEN) {
              ws.close();
            }
          } catch (e) {
            /* empty */
          }
          onDisconnected();
        });

        _serversocket.on(
          'error',
          function close(err: any, address: any, family: any, host: any) {
            try {
              debugLog('errored out', err, address, family, host);
              openConnectionId -= 1;
              forcedDisconnect = true;
              if (ws.readyState === WebSocket.OPEN) {
                ws.close();
              }
              _serversocket.end();
            } catch (e) {
              /* empty */
            }
          },
        );

        return {
          serversocket: _serversocket,
          close: () => {
            _serversocket.end();
            if (ws && ws.readyState === WebSocket.OPEN) {
              ws.close();
            }
          },
        } as IServerSocketClient;
      } catch (e) {
        return null;
      }
    };

    const c = createClient(serverSocket, () => {
      runningClients = runningClients.filter(
        (ssc: IServerSocketClient) => ssc.serversocket !== serverSocket,
      );
      debugLog(runningClients.length);
    });
    if (c) {
      runningClients.push(c);
      debugLog(runningClients.length);
    }
  });

  server.on('error', (err) => {
    console.error(err);
    if (callback && callback.onError) {
      callback.onError(err);
    }
  });

  server.listen(parseInt(forward.localPort.toString(), 10), () => {});

  const portForwardController: IPortForwardController = {
    close: () => {
      debugLog('Closing server socket', runningClients.length);
      runningClients.forEach((c) => {
        try {
          c.close();
        } catch (e) {
          console.error(e);
        }
      });
      server.close();
    },
  } as IPortForwardController;

  const newId = generateRandomId();

  forwardStates.activeForwards.push({
    id: newId,
    project: project.name,
    contextNamespace: forward.contextNamespace,
    type: forward.type,
    name: forward.name,
    sourcePort: forward.sourcePort,
    localPort: forward.localPort,
    namespace: forward.contextNamespace,
  } as IActiveForwards);
  setSTate(forwardStates);

  forwardController[newId] = portForwardController;

  return portForwardController;
};

const stopPortForwarding = (id: string) => {
  const portForward = forwardStates.activeForwards.find((f) => f.id === id);
  if (portForward) {
    const controller = forwardController[id];
    if (controller) {
      controller.close();
    }
    forwardStates.activeForwards = forwardStates.activeForwards.filter(
      (f) => f.id !== id,
    );
    setSTate(forwardStates);
  }
};

const stopProjectForwarding = (project: IProjectWithState) => {
  project.portforwards.forEach((portForward) => {
    try {
      delete projectTraffic[project.name];
      setTimeout(() => {
        const id = portForward.id
          ? portForward.id
          : forwardStates.activeForwards.find(
              (f) =>
                f.project === project.name &&
                f.name === portForward.name &&
                f.type === portForward.type &&
                f.namespace === portForward.contextNamespace &&
                f.sourcePort === portForward.sourcePort &&
                f.localPort === portForward.localPort,
            )?.id;
        if (id) {
          stopPortForwarding(id);
        }
      }, 30);
    } catch (e) {
      console.error(e);
    }
  });
};

const startProjectForwarding = (
  project: IProject,
  errorCb?: (error: any) => void,
) => {
  const portForwardControllers: IPortForwardController[] = [];
  for (let i = 0; i < project.portforwards.length; i += 1) {
    const portForward = project.portforwards[i];
    const p = startPortForwarding(project, portForward, {
      onError: (error: any) => {
        if (errorCb) {
          errorCb(error);
        }
      },
    });
    portForwardControllers.push(p);
  }
  return portForwardControllers;
};

export {
  startPortForwarding,
  startProjectForwarding,
  stopPortForwarding,
  stopProjectForwarding,
  forwardStates,
  registerStateChanges,
  registerTrafficCallback,
};
