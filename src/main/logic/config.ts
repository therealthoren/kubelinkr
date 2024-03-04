import fs from 'fs';
import { IConfig } from '../../models/IConfig';

export const writeConfig = (path: string): void => {
  try {
    const data = fs.readFileSync(path, 'utf8');
    fs.writeFileSync('config.json', data);
  } catch (e) {
    console.error(e);
    throw e;
  }
};

export const loadConfig = (): IConfig => {
  try {
    const data = fs.readFileSync('config.json', 'utf8');
    return JSON.parse(data);
  } catch (e) {
    console.error(e);
    throw e;
  }
};
