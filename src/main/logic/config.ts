import fs from 'fs';
import { IConfig } from '../../models/IConfig';

const { app } = require('electron');

function getAppPath() {
  return app.getPath("appData")+'/kubelinkr/';
}

export const writeConfig = (path: string): void => {
  try {
    const data = fs.readFileSync(path, 'utf8');
    // make directory if not exists
    if (!fs.existsSync(getAppPath())) {
      fs.mkdirSync(getAppPath());
    }
    console.log(app.getAppPath() );
    fs.writeFileSync(getAppPath() + 'config.json', data);
  } catch (e) {
    console.error(e);
    throw e;
  }
};

export const loadConfig = (): IConfig => {
  try {
    console.log(getAppPath());
    const data = fs.readFileSync(getAppPath()+'config.json', 'utf8');
    return JSON.parse(data);
  } catch (e) {
    console.error(e);
    return null;
  }
};
