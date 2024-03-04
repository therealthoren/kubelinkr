import path from 'path';
import { Tray, Menu, app } from 'electron';

const RESOURCES_PATH = app.isPackaged
  ? path.join(process.resourcesPath, 'assets')
  : path.join(__dirname, '../../assets');

const getAssetPath = (...paths: string[]): string => {
  return path.join(RESOURCES_PATH, ...paths);
};

class TrayGenerator {
  tray: any = null;

  mainWindow: any = null;

  constructor(mainWindow: any) {
    this.tray = null;
    this.mainWindow = mainWindow;
  }

  getWindowPosition = () => {
    if (this.tray === null || this.mainWindow === null) {
      return;
    }
    const windowBounds = this.mainWindow.getBounds();
    const trayBounds = this.tray.getBounds();
    const x = Math.round(
      trayBounds.x + trayBounds.width / 2 - windowBounds.width / 2,
    );
    const y = Math.round(trayBounds.y + trayBounds.height);
    // eslint-disable-next-line consistent-return
    return { x, y };
  };

  showWindow = () => {
    const position = this.getWindowPosition();
    if (position === undefined) {
      return;
    }
    this.mainWindow.setPosition(position.x, position.y, false);
    this.mainWindow.show();
    this.mainWindow.setVisibleOnAllWorkspaces(true);
    this.mainWindow.focus();
    this.mainWindow.setVisibleOnAllWorkspaces(false);
  };

  toggleWindow = () => {
    if (this.mainWindow.isVisible()) {
      this.mainWindow.hide();
      this.tray.setImage(getAssetPath('tray/inactive.png'));
    } else {
      this.tray.setImage(getAssetPath('tray/active.png'));
      this.showWindow();
    }
  };

  rightClickMenu = () => {
    const menu: any = [
      {
        role: 'quit',
        accelerator: 'Command+Q',
      },
    ];
    this.tray.popUpContextMenu(Menu.buildFromTemplate(menu));
  };

  createTray = () => {
    this.tray = new Tray(getAssetPath('tray/inactive.png'));
    this.tray.setIgnoreDoubleClickEvents(true);
    this.tray.on('click', this.toggleWindow);
    this.tray.on('right-click', this.rightClickMenu);
  };
}

export default TrayGenerator;
