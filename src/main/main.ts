/* eslint global-require: off, no-console: off, promise/always-return: off */

/**
 * This module executes inside of electron's main process. You can start
 * electron renderer process from here and communicate with the other processes
 * through IPC.
 *
 * When running `npm run build` or `npm run build:main`, this file is compiled to
 * `./src/main.js` using webpack. This gives us some performance wins.
 */
import path from 'path';
import { app, BrowserWindow, shell, ipcMain, dialog } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import MenuBuilder from './menu';
import { resolveHtmlPath } from './util';
import TrayGenerator from './tray';
import { loadConfig, writeConfig } from './logic/config';
import { IAllTrafficData, IConfig, IProject } from '../models/IConfig';
import { Channels } from '../models/channel';
import { IState } from '../models/IState';
import {
  forwardStates,
  registerStateChanges,
  registerTrafficCallback,
  startProjectForwarding,
  stopProjectForwarding,
} from "./kube/forward";

class AppUpdater {
  constructor() {
    log.transports.file.level = 'info';
    autoUpdater.logger = log;
    autoUpdater.checkForUpdatesAndNotify();
  }
}

let mainWindow: BrowserWindow | null = null;
let config: IConfig | null = null;

if (process.env.NODE_ENV === 'production') {
  const sourceMapSupport = require('source-map-support');
  sourceMapSupport.install();
}

const isDebug =
  process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';

if (isDebug) {
  require('electron-debug')();
}

const installExtensions = async () => {
  const installer = require('electron-devtools-installer');
  const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
  const extensions = ['REACT_DEVELOPER_TOOLS'];

  return installer
    .default(
      extensions.map((name) => installer[name]),
      forceDownload,
    )
    .catch(console.log);
};

const createWindow = async () => {
  if (isDebug) {
    await installExtensions();
  }

  const RESOURCES_PATH = app.isPackaged
    ? path.join(process.resourcesPath, 'assets')
    : path.join(__dirname, '../../assets');

  const getAssetPath = (...paths: string[]): string => {
    return path.join(RESOURCES_PATH, ...paths);
  };

  mainWindow = new BrowserWindow({
    show: false,
    width: 1024,
    height: 312,
    frame: false,
    icon: getAssetPath('icon.png'),
    webPreferences: {
      preload: app.isPackaged
        ? path.join(__dirname, 'preload.js')
        : path.join(__dirname, '../../.erb/dll/preload.js'),
    },
  });

  mainWindow.loadURL(resolveHtmlPath('index.html'));

  mainWindow.on('ready-to-show', () => {
    if (!mainWindow) {
      throw new Error('"mainWindow" is not defined');
    }
    mainWindow.hide();
    const tray = new TrayGenerator(mainWindow);
    tray.createTray();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  const menuBuilder = new MenuBuilder(mainWindow);
  menuBuilder.buildMenu();

  // Open urls in the user's browser
  mainWindow.webContents.setWindowOpenHandler((edata) => {
    shell.openExternal(edata.url);
    return { action: 'deny' };
  });

  // Remove this if your app does not use auto updates
  // eslint-disable-next-line
  new AppUpdater();
};

/**
 * Add event listeners...
 */

if (app.dock) {
  app.dock.hide();
  app.dock.setBadge('');
}

app.on('browser-window-focus', () => {
  if (mainWindow) {
    mainWindow.webContents.send(Channels.CONFIG_CHANGED, config);
    mainWindow.webContents.send(Channels.STATE_CHANGED, forwardStates);
  }
});
app.on('browser-window-blur', (event, win) => {
  if (win.webContents.isDevToolsFocused()) {
    console.log('Ignore this case');
  } else if (mainWindow) {
    mainWindow.webContents.send(Channels.CONFIG_CHANGED, config);
    mainWindow.webContents.send(Channels.STATE_CHANGED, forwardStates);
  }
});

app.on('window-all-closed', () => {
  // Respect the OSX convention of having the application in memory even
  // after all windows have been closed
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app
  .whenReady()
  .then(() => {
    createWindow();
    app.on('activate', () => {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (mainWindow === null) {
        createWindow();
      }
    });
  })
  .catch(console.log);

ipcMain.on(Channels.LOADED, async (event: any) => {
  try {
    config = loadConfig();
    event.reply(Channels.CONFIG_CHANGED, config);
    event.reply(Channels.STATE_CHANGED, forwardStates);
  } catch (e) {
    /* empty */
  }
});

ipcMain.on('load-config-from-menu', () => {
  dialog
    .showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }],
    })
    .then((result) => {
      if (!result.canceled) {
        const filePath = result.filePaths[0];
        try {
          writeConfig(filePath);
          config = loadConfig();
          // @ts-ignore
          mainWindow.webContents.send(Channels.CONFIG_CHANGED, config);
          // @ts-ignore
          mainWindow.webContents.send(Channels.STATE_CHANGED, forwardStates);
        } catch (e: any) {
          dialog.showErrorBox('Error while loading config', e.message);
        }
      }
    })
    .catch((err) => {
      dialog.showErrorBox('Error while loading config', err.message);
    });
});

const refreshData = () => {
  mainWindow?.webContents.send(Channels.CONFIG_CHANGED, config);
  mainWindow?.webContents.send(Channels.STATE_CHANGED, forwardStates);
};

ipcMain.on(Channels.START_PROJECT, (event: any, data: IProject) => {
  setTimeout(() => {
    try {
      let waitForTimeout = 1;
      if (data.stagingGroup) {
        const projectsForGroup = config?.projects.filter(p => p.stagingGroup === data.stagingGroup && p.name !== data.name);
        console.log('Same group projects', projectsForGroup);
        if (projectsForGroup) {
          for (const p of projectsForGroup) {
            stopProjectForwarding(p);
            waitForTimeout = 500;
          }
        }
      }

      setTimeout(() => {
        startProjectForwarding(data, (err) => {
          if (err) {
            mainWindow?.webContents.send(Channels.SHOW_ERROR, {
              title: 'Error while starting project',
              message: err.message,
            });
          }
        });
      }, waitForTimeout);

    }
    catch(e) {
    }
    refreshData();
  }, 1);
});

ipcMain.on(Channels.STOP_PROJECT, (event: any, data: any) => {
  setTimeout(() => {
    try {
      stopProjectForwarding(data);
    }
    catch (e) {
      mainWindow?.webContents.send(Channels.SHOW_ERROR, {
        title: 'Error while stopping project',
        message: e.message,
      });
    }
    setTimeout(() => {
      refreshData();
    }, 1000);
  }, 1);
});

registerStateChanges((s: IState) => {
  mainWindow?.webContents.send(Channels.STATE_CHANGED, s);
});

registerTrafficCallback((data: IAllTrafficData) => {
  mainWindow?.webContents.send(Channels.TRAFFIC_DATA, data);
});
