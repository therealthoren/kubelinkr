export interface IPortForward {
  localPort: number;
  id: string;
  contextNamespace: string;
  sourcePort: number;
  contextName: string;
  type: string;
  name: string;
}

export interface IProject {
  id?: string;
  name: string;
  stagingGroup?: string;
  portforwards: IPortForward[];
}

export interface IConfig {
  projects: IProject[];
}

export interface IConfigWithLoadingUpdated extends IConfig {
  changed: boolean;
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
