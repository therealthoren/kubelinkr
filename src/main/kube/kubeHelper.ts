import yaml from 'js-yaml';
import fs from 'fs';
import axios from 'axios';
import * as https from 'https';
import { IPortForward } from '../../models/IConfig';
import { Channels } from '../../models/channel';

const DEBUG = false;

const debugLog = (message: any, ...args: any[]) => {
  if (DEBUG) {
    console.log(message, ...args);
  }
};

const base64Decode = (clientKeyData: string) => {
  return Buffer.from(clientKeyData, 'base64').toString('utf-8');
};

const getUserHome = () => {
  return process.env.HOME || process.env.USERPROFILE;
};

let kubeBasicsData: any = null;

const loadKubeBasicsData = () => {
  try {
    kubeBasicsData = yaml.load(
      fs.readFileSync(`${getUserHome()}/.kube/config`, 'utf8'),
    );
  } catch (e) {
    console.error(e);
    throw e;
  }
};

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

const getAllContexts = () => {
  return kubeBasicsData.contexts;
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

const getAuthorizationDataFromRaw = (contextName: string) => {
  const context = getContext(contextName);
  debugLog(context);
  const clusterName = context.context.cluster;
  const userName = context.context.user;
  debugLog('clusterName', clusterName);
  const url = getKubeUrl(clusterName);
  debugLog('url', url);
  const bearer = getBearerToken(userName);
  let authorizationData: any = {};
  let additionalHeaderOptions: any = {};
  if (!bearer) {
    const clientCertificateData = getClientCertificateData(userName);
    const clientKeyData = getClientKeyData(userName);

    // Add the cert and key to the authorizationData for the websocket headers
    authorizationData = {};

    additionalHeaderOptions = {
      cert: base64Decode(clientCertificateData),
      key: base64Decode(clientKeyData),
      rejectUnauthorized: false,
    };
  } else {
    authorizationData = {
      Authorization: `Bearer ${bearer}`,
    };
  }
  return {
    url,
    authorizationData,
    additionalHeaderOptions,
  };
};

const getAuthorizationData = (forward: IPortForward) => {
  return getAuthorizationDataFromRaw(forward.contextName);
};

const answerRequestDataWithSuccess = (
  mainWindow: any,
  requestData: any,
  answerData: any,
) => {
  debugLog(answerData);
  mainWindow?.webContents.send(Channels.REQUEST_ANSWER + requestData.answerId, {
    success: true,
    data: answerData,
  });
};

const answerRequestDataWithError = (
  mainWindow: any,
  requestData: any,
  errorData: any,
) => {
  debugLog('Responding with error', errorData);
  mainWindow?.webContents.send(Channels.REQUEST_ANSWER + requestData.answerId, {
    success: false,
    error: errorData.toString(),
  });
};

const callKubeApi = (
  portForwardOrContext: IPortForward | string,
  path: string,
  method: string,
  body?: any,
) => {
  return new Promise((resolve, reject) => {
    const { url, authorizationData, additionalHeaderOptions } =
      typeof portForwardOrContext === 'string'
        ? getAuthorizationDataFromRaw(portForwardOrContext)
        : getAuthorizationData(portForwardOrContext);
    const config: any = {
      url: url + path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...authorizationData,
      },
      data: JSON.stringify(body),
    };
    if (additionalHeaderOptions) {
      const httpsAgent = new https.Agent({
        cert: additionalHeaderOptions.cert,
        key: additionalHeaderOptions.key,
      });
      config.httpsAgent = httpsAgent;
    }
    axios
      .request(config)
      .then((response) => {
        if (response.status >= 400) {
          return reject(response);
        }
        return resolve(response.data);
      })
      .catch((error) => {
        debugLog('Error in callKubeApi', error);
        return reject(error);
      });
  });
};

const getAllPods = (contextName: string, namespace: string) => {
  return callKubeApi(
    contextName,
    `/api/v1/namespaces/${namespace}/pods`,
    'GET',
  );
};

const getAllNamespaces = (contextName: string) => {
  return callKubeApi(contextName, '/api/v1/namespaces', 'GET');
};

export {
  getClientCertificateData,
  getAllContexts,
  getAuthorizationData,
  getAllPods,
  getAllNamespaces,
  debugLog,
  answerRequestDataWithError,
  loadKubeBasicsData,
  answerRequestDataWithSuccess,
  getClientKeyData,
  getBearerToken,
  getContext,
  getKubeUrl,
};
