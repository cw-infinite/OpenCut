import { contextBridge, ipcRenderer, webUtils } from 'electron';
import type { OpenCutApi, SetupProgress, ImportProgress } from '../shared/api';
const api: OpenCutApi = {
  projects: {
    list: () => ipcRenderer.invoke('projects:list'),
    last: () => ipcRenderer.invoke('projects:last'),
    saveEdit: project => ipcRenderer.invoke('projects:saveEdit', project),
    create: (name, settings) => ipcRenderer.invoke('projects:create', name, settings),
    open: id => ipcRenderer.invoke('projects:open', id),
    rename: (id, name) => ipcRenderer.invoke('projects:rename', id, name),
    settings: (id, settings) => ipcRenderer.invoke('projects:settings', id, settings),
    duplicate: id => ipcRenderer.invoke('projects:duplicate', id),
    remove: id => ipcRenderer.invoke('projects:remove', id)
  },
  media: {
    pick: id => ipcRenderer.invoke('media:pick', id),
    drop: (id, files) => ipcRenderer.invoke('media:drop', id, files.map(file => webUtils.getPathForFile(file))),
    views: id => ipcRenderer.invoke('media:views', id),
    remove: (id, assetId) => ipcRenderer.invoke('media:remove', id, assetId),
    onProgress: callback => {
      const listener = (_event: Electron.IpcRendererEvent, progress: ImportProgress) => callback(progress);
      ipcRenderer.on('media:progress', listener);
      return () => ipcRenderer.removeListener('media:progress', listener);
    }
  },
  checkTools: () => ipcRenderer.invoke('tools:check'),
  setupTools: () => ipcRenderer.invoke('tools:setup'),
  onSetupProgress: callback => {
    const listener = (_event: Electron.IpcRendererEvent, progress: SetupProgress) => callback(progress);
    ipcRenderer.on('tools:progress', listener);
    return () => ipcRenderer.removeListener('tools:progress', listener);
  }
};
contextBridge.exposeInMainWorld('opencut', api);
