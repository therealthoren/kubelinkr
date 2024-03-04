import { IPortForward, IProject } from './IConfig';

export interface IActiveForwards {
  sourcePort: number;
  localPort: number;
  id: string;
  project: string;
  contextNamespace: string;
  type: string;
  name: string;
  namespace?: string;
}

export interface IState {
  activeForwards: IActiveForwards[];
}

export interface IPortForwardController {
  close: () => void;
}

export interface IPortForwardWithState extends IPortForward {
  id: string;
  running?: boolean;
}

export interface IProjectWithState extends IProject {
  running?: boolean;
  portforwards: IPortForwardWithState[];
}

export interface IConfigWithStates {
  projects: IProjectWithState[];
}
