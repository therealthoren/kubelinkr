import fs from 'fs';
import { IConfig, IConfigWithLoadingUpdated } from "../../models/IConfig";
import { v4 as uuidv4 } from 'uuid';

const { app } = require('electron');

function getAppPath() {
  return `${app.getPath('appData')}/kubelinkr/`;
};

const getConfigPath = () => {
  return `${getAppPath()}config.json`;
};

export const writeConfig = (data: IConfig): void => {
  try {
    // make directory if not exists
    if (!fs.existsSync(getAppPath())) {
      fs.mkdirSync(getAppPath());
    }
    fs.writeFileSync(getConfigPath(), JSON.stringify(data));
  } catch (e) {
    console.error(e);
    throw e;
  }
};

export const loadConfig = (): IConfigWithLoadingUpdated => {
  try {
    const data = fs.readFileSync(getConfigPath(), 'utf8');
    const elements = JSON.parse(data);
    let changed = false;
    if (!elements.projects) {
      elements.projects = [];
    }
    // element projects has no "id" we need to add it and generate a new one
    elements.projects = elements.projects.map((project: any) => {
      if (!project.id) {
        // Generate a uuid
        project.id = uuidv4();
        changed = true;
      }
      return project;
    });
    return {
      ...elements,
      changed,
    };
  } catch (e) {
    console.error(e);
  }
  return {
    projects: [],
    changed: true,
  };
};
