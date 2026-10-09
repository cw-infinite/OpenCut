import { desktopCapturer, ipcMain, session, type BrowserWindow } from 'electron';

export function captureHandlers(editor: () => BrowserWindow | null, trusted: (event: Electron.IpcMainInvokeEvent) => void): void {
  let videoUntil = 0;
  let selection: { id: string; audio: boolean; until: number } | null = null;
  ipcMain.handle('capture:sources', async event => {
    trusted(event);
    return (await desktopCapturer.getSources({ types: ['screen', 'window'], thumbnailSize: { width: 240, height: 135 } })).map(source => ({ id: source.id, name: source.name, thumbnail: source.thumbnail.toDataURL() }));
  });
  ipcMain.handle('capture:authorize', (event, mode: string, source: string, audio: boolean) => {
    trusted(event);
    if (!['camera', 'screen'].includes(mode) || typeof source !== 'string' || typeof audio !== 'boolean') throw new Error('Invalid capture request');
    videoUntil = Date.now() + 60000;
    selection = mode === 'screen' ? { id: source, audio, until: videoUntil } : null;
  });
  session.defaultSession.setPermissionRequestHandler((contents, permission, callback, details) => {
    if (permission === 'display-capture') { callback(contents === editor()?.webContents && Boolean(selection && Date.now() < selection.until)); return; }
    const types = 'mediaTypes' in details ? details.mediaTypes : [];
    // Electron reports an empty mediaTypes list for getDisplayMedia before source selection.
    const allowed = types?.length ? types.every(type => type === 'audio' || (type === 'video' && Date.now() < videoUntil)) : Boolean(selection && Date.now() < selection.until);
    callback(contents === editor()?.webContents && details.isMainFrame && permission === 'media' && allowed);
  });
  session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
    const chosen = selection; selection = null;
    if (request.frame !== editor()?.webContents.mainFrame || !chosen || Date.now() > chosen.until) { callback({}); return; }
    void desktopCapturer.getSources({ types: ['screen', 'window'], thumbnailSize: { width: 0, height: 0 } }).then(sources => {
      const source = sources.find(source => source.id === chosen.id);
      if (!source || request.frame !== editor()?.webContents.mainFrame) { callback({}); return; }
      callback({ video: source, audio: chosen.audio && request.audioRequested ? 'loopback' : undefined });
    }).catch(() => callback({}));
  });
}
