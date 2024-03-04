export interface IPortForward {
  localPort: number;
  contextNamespace: string;
  sourcePort: number;
  type: string;
  name: string;
}


export interface IProject {
  name: string;
  stagingGroup?: string;
  contextName: string;
  portforwards: IPortForward[];
}

export interface IConfig {
  projects: IProject[];
}

export interface IServerSocketClient {
  serversocket: any;
  close: () => void;
}

export interface IProjectWithTrafficData {
  trafficDataEntriesPerSecond: {
    entrySeconds: number;
    bytes: number;
  }[];
}

export interface IAllTrafficData {
  [key: string]: IProjectWithTrafficData;
}

export interface IPortForwardCallback {
  onTraffic?: (data: IProjectWithTrafficData) => void;
  onDataPing?: () => void;
  convertData?: (data: any) => any;
  onData?: (data: any) => void;
  onError?: (error: any) => void;
}
