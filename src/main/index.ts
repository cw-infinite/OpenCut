import { app, BrowserWindow, ipcMain, session, protocol } from 'electron';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { checkTools } from './services/tools';
import { setupTools } from './services/setupTools';
import { ProjectStore } from './services/projectStore';
import { MediaLibrary } from './services/mediaLibrary';
import { projectHandlers } from './ipc/projects';
import { serveMedia } from './services/mediaProtocol';
import { ExportRunner } from './services/exportRunner';
import { CaptionRunner } from './services/captionRunner';
import { captureHandlers } from './services/capture';

app.setName('OpenCut');
protocol.registerSchemesAsPrivileged([{ scheme: 'opencut-media', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true } }]);
if (process.env.OPENCUT_TEST_DATA) app.setPath('userData', process.env.OPENCUT_TEST_DATA);
const toolsRoot = () => app.isPackaged ? join(process.resourcesPath, 'tools') : join(app.getAppPath(), 'resources', 'tools');
let window: BrowserWindow | null = null;
let settingUp = false;
function trusted(event: Electron.IpcMainInvokeEvent): void {
  if (!window || event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) {
    throw new Error('Untrusted IPC sender');
  }
}
function createWindow(): void {
  window = new BrowserWindow({ width: 1400, height: 900, minWidth: 1000, minHeight: 720,
    title: 'OpenCut', backgroundColor: '#101113', autoHideMenuBar: true,
    webPreferences: { preload: join(__dirname, '../preload/index.js'), sandbox: true, contextIsolation: true, nodeIntegration: false }
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', event => event.preventDefault());
  window.on('closed', () => { window = null; });
  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) void window.loadURL(process.env.ELECTRON_RENDERER_URL);
  else void window.loadFile(join(__dirname, '../renderer/index.html'));
}
app.whenReady().then(() => {
  const store = new ProjectStore(app.getPath('userData'));
  const library = new MediaLibrary(store);
  projectHandlers(store, library, trusted);
  new CaptionRunner(store, toolsRoot(), trusted);
  new ExportRunner(store, library, join(__dirname, '../preload/index.js'), join(__dirname, '../renderer/index.html'), trusted);
  protocol.handle('opencut-media', request => serveMedia(request, library.files));
  captureHandlers(() => window, trusted);
  const devOrigin = !app.isPackaged && process.env.ELECTRON_RENDERER_URL ? new URL(process.env.ELECTRON_RENDERER_URL).origin : null;
  const rendererURL = pathToFileURL(join(__dirname, '../renderer/index.html')).href;
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    const url = new URL(details.url);
    const local = ['file:', 'data:', 'blob:', 'devtools:', 'opencut-media:'].includes(url.protocol);
    const development = devOrigin && (url.origin === devOrigin || details.url.startsWith(devOrigin.replace('http:', 'ws:') + '/'));
    callback({ cancel: !local && !development && details.url !== rendererURL });
  });
  ipcMain.handle('tools:check', async event => { trusted(event); return checkTools(toolsRoot()); });
  ipcMain.handle('tools:setup', async (event, small?: boolean) => {
    trusted(event);
    if (small !== undefined && typeof small !== 'boolean') throw new Error('Invalid setup request');
    if (settingUp) throw new Error('Setup is already running');
    settingUp = true;
    try {
      await setupTools(toolsRoot(), progress => { if (!event.sender.isDestroyed()) event.sender.send('tools:progress', progress); }, small);
      return await checkTools(toolsRoot());
    } finally { settingUp = false; }
  });
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => app.quit());
