import { dialog, ipcMain } from 'electron';
import { createProject, validSettings } from '../../shared/project';
import type { ProjectStore } from '../services/projectStore';
import type { MediaLibrary } from '../services/mediaLibrary';
import { mediaExtensions } from '../services/mediaProbe';
import { validateTimeline } from '../../renderer/engine/timeline';
import { analyzeBeats } from '../services/beats';
import { runProcess } from '../services/process';

export function projectHandlers(store: ProjectStore, library: MediaLibrary, trusted: (event: Electron.IpcMainInvokeEvent) => void): void {
  const handle = (channel: string, fn: (event: Electron.IpcMainInvokeEvent, ...args: any[]) => unknown) =>
    ipcMain.handle(channel, (event, ...args) => { trusted(event); return fn(event, ...args); });
  let fonts: Promise<string[]> | undefined;
  handle('fonts:list', () => fonts ??= runProcess('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', 'Add-Type -AssemblyName System.Drawing; (New-Object System.Drawing.Text.InstalledFontCollection).Families.Name | ConvertTo-Json -Compress'], 15000)
    .then(raw => { const values: unknown = JSON.parse(raw); return Array.isArray(values) ? values.filter((value): value is string => typeof value === 'string') : []; }).catch(() => ['Arial', 'Segoe UI', 'Times New Roman']));
  handle('projects:list', () => store.list());
  handle('projects:last', () => store.last());
  handle('projects:saveEdit', (_event, input) => store.update(input.id, project => {
    if (!Array.isArray(input.tracks) || !Array.isArray(input.markers)) throw new Error('Invalid timeline data');
    project.masterVolume = input.masterVolume; project.tracks = input.tracks; project.markers = input.markers; project.captionStyles = input.captionStyles;
    validateTimeline(project);
  }));
  handle('projects:create', async (_event, name, settings) => { const project = await store.create(name, settings); await store.remember(project.id); return project; });
  handle('projects:open', async (_event, id) => {
    const result = await store.readStable(id);
    await store.remember(id);
    return result;
  });
  handle('projects:rename', (_event, id, name) => store.update(id, project => { createProject(id, name, project.settings); project.name = name.trim(); }));
  handle('projects:settings', (_event, id, settings) => {
    library.assertIdle(id);
    return store.update(id, project => {
      validSettings(settings);
      if (Object.keys(project.media).length && settings.fps !== project.settings.fps) throw new Error('Frame rate is fixed after import to keep proxies frame accurate. Create a new project to change it.');
      project.settings = settings;
    });
  });
  handle('projects:duplicate', (_event, id) => { library.assertIdle(id); return store.duplicate(id); });
  handle('projects:remove', (_event, id) => { library.assertIdle(id); return store.remove(id); });
  handle('media:pick', async (event, id) => {
    await store.read(id);
    const result = await dialog.showOpenDialog({ title: 'Import media into OpenCut', properties: ['openFile', 'multiSelections'], filters: [{ name: 'Video, audio and images', extensions: mediaExtensions }] });
    if (result.canceled) return (await store.read(id)).project;
    return library.import(id, result.filePaths, progress => { if (!event.sender.isDestroyed()) event.sender.send('media:progress', progress); });
  });
  handle('media:drop', (event, id, paths) => library.import(id, paths, progress => { if (!event.sender.isDestroyed()) event.sender.send('media:progress', progress); }));
  handle('media:views', (_event, id) => library.views(id));
  handle('media:record', (_event, id, bytes) => library.record(id, bytes));
  handle('media:beats', (_event, id, clipId) => analyzeBeats(store, id, clipId));
  handle('media:derive', (event, id, clipId, operation, time) => library.derive(id, clipId, operation, time, progress => { if (!event.sender.isDestroyed()) event.sender.send('media:progress', progress); }));
  handle('media:remove', (_event, id, assetId) => {
    library.assertIdle(id);
    return store.update(id, project => {
      if (project.tracks.some(track => track.clips.some(clip => clip.type === 'media' && clip.mediaId === assetId))) throw new Error('This media is used on the timeline. Remove its clips first.');
      delete project.media[assetId];
    });
  });
}
