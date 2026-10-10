import { app, ipcMain } from 'electron';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { MediaLibrary } from './mediaLibrary';
import { creativeReady, setupCreative, type CreativeTool } from './creativeTools';
import { generateSpeech } from './speech';
import { removeBackground } from './background';

export function creativeHandlers(library: MediaLibrary, bundled: string, trusted: (event: Electron.IpcMainInvokeEvent) => void) {
  const local = join(app.getPath('userData'), 'creative-tools');
  let controller: AbortController | undefined, settingUp = false;
  app.once('before-quit', () => controller?.abort());
  const root = async (kind: CreativeTool) => (await creativeReady(bundled))[kind] ? bundled : local;
  const status = async () => { const a = await creativeReady(bundled), b = await creativeReady(local); return { speech: a.speech || b.speech, background: a.background || b.background }; };
  const progress = (event: Electron.IpcMainInvokeEvent, stage: string, percent: number | null) => { if (!event.sender.isDestroyed()) event.sender.send('creative:progress', { stage, percent }); };
  ipcMain.handle('creative:status', event => { trusted(event); return status(); });
  ipcMain.handle('creative:setup', async (event, kind: CreativeTool) => {
    trusted(event); if (!['speech', 'background'].includes(kind)) throw new Error('Unknown tool');
    if (settingUp || controller) throw new Error('Wait for current processing to finish.');
    settingUp = true;
    try { await setupCreative(local, kind, (stage, percent) => progress(event, stage, percent)); return await status(); }
    finally { settingUp = false; }
  });
  ipcMain.handle('creative:cancel', event => { trusted(event); controller?.abort(); });
  ipcMain.handle('creative:generate', async (event, request: { kind: CreativeTool; projectId: string; text?: string; rate?: number; clipId?: string }) => {
    trusted(event);
    if (!request || !['speech', 'background'].includes(request.kind)) throw new Error('Unknown operation');
    if (controller || settingUp) throw new Error('Another creative operation is running.');
    const abort = new AbortController(); controller = abort;
    try {
      const tools = await root(request.kind);
      if (!(await creativeReady(tools))[request.kind]) throw new Error('Download the local tool first.');
      return await library.createGenerated(request.projectId, async (project, folder) => {
        progress(event, request.kind === 'speech' ? 'Generating speech' : 'Removing portrait background', 0);
        if (request.kind === 'speech') return generateSpeech(tools, folder, randomUUID(), request.text!, request.rate!, project.settings.fps, abort.signal);
        const track = project.tracks.find(track => track.clips.some(clip => clip.id === request.clipId));
        const clip = track?.clips.find(clip => clip.id === request.clipId);
        if (!track || track.locked || clip?.type !== 'media') throw new Error('Select an unlocked photo or video clip.');
        return removeBackground(tools, folder, randomUUID(), project.media[clip.mediaId], clip, project.settings.fps, abort.signal, percent => progress(event, 'Removing portrait background', percent));
      });
    } finally { controller = undefined; }
  });
}
