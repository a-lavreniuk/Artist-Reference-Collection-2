import { app, BrowserWindow, protocol } from 'electron';
import path from 'path';
import { registerArcIpc, registerArcMediaProtocol } from './ipc';

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'arc-media',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true
    }
  }
]);

function createWindow(): void {
  const preloadPath = path.resolve(__dirname, '..', 'preload', 'index.js');
  const win = new BrowserWindow({
    width: 1280,
    height: 840,
    show: false,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      // sandbox: true иногда мешает загрузке preload на Windows; API через IPC всё равно изолирован
      sandbox: false
    }
  });

  win.once('ready-to-show', () => {
    win.show();
  });

  const dev = process.env.NODE_ENV === 'development';

  if (dev) {
    void win.loadURL('http://localhost:5173');
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    const indexHtml = path.join(__dirname, '..', 'renderer', 'dist', 'index.html');
    void win.loadFile(indexHtml);
  }
}

app.whenReady().then(() => {
  registerArcMediaProtocol();
  registerArcIpc();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
