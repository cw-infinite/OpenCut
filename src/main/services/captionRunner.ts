import { app, ipcMain, dialog } from 'electron';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ProjectStore } from './projectStore';
import type { CaptionRequest, CaptionProgress } from '../../shared/captions';
import { ffmpegPath, findWhisper } from './tools';
import { audioMixArgs } from '../../renderer/engine/ffmpegArgs';
import { durationOf } from '../../renderer/engine/timeline';
import { whisperWords } from '../../renderer/engine/captionImport';

export class CaptionRunner {
  private busy = false;
  private cancelled = false;
  private child?: ChildProcess;
  constructor(private store: ProjectStore, private root: string, trusted: (event: Electron.IpcMainInvokeEvent) => void) {
    app.once('before-quit', () => { this.cancelled = true; this.child?.kill(); });
    ipcMain.handle('captions:models', async event => {
      trusted(event);
      const installed = async (name: string) => (await stat(join(this.root, 'models', `ggml-${name}.bin`)).catch(() => null))?.size ?? 0;
      return { 'base.en': await installed('base.en') > 140e6, 'small.en': await installed('small.en') > 450e6 };
    });
    ipcMain.handle('captions:generate', (event, request: CaptionRequest) => { trusted(event); return this.generate(request, progress => { if (!event.sender.isDestroyed()) event.sender.send('captions:progress', progress); }); });
    ipcMain.handle('captions:cancel', event => { trusted(event); this.cancelled = true; this.child?.kill(); });
    ipcMain.handle('captions:import', async event => {
      trusted(event);
      const result = await dialog.showOpenDialog({ title: 'Import subtitles', properties: ['openFile'], filters: [{ name: 'SubRip captions', extensions: ['srt'] }] });
      if (result.canceled) return null;
      if ((await stat(result.filePaths[0])).size > 5e6) throw new Error('SRT file exceeds 5 MB');
      return readFile(result.filePaths[0], 'utf8');
    });
  }
  private run(path: string, args: string[], progress: (progress: CaptionProgress) => void): Promise<void> {
    if (this.cancelled) return Promise.reject(new Error('Caption generation cancelled'));
    return new Promise((resolve, reject) => {
      const child = this.child = spawn(path, args, { windowsHide: true });
      let tail = '';
      child.stdout?.resume();
      child.stderr?.on('data', chunk => {
        tail = (tail + chunk).slice(-8000);
        const matches = [...String(chunk).matchAll(/progress\s*=\s*(\d+)%/g)];
        if (matches.length) progress({ stage: 'Transcribing locally', percent: Number(matches.at(-1)![1]) });
      });
      child.on('error', reject);
      child.on('close', code => { this.child = undefined; this.cancelled ? reject(new Error('Caption generation cancelled')) : code === 0 ? resolve() : reject(new Error(tail.slice(-2000) || 'Speech processing failed')); });
    });
  }
  async generate(request: CaptionRequest, progress: (progress: CaptionProgress) => void) {
    if (this.busy) throw new Error('Caption generation is already running');
    this.busy = true; this.cancelled = false;
    let folder: string | undefined;
    try {
      const { project } = await this.store.readStable(request.projectId);
      let start = request.range?.start ?? 0, end = request.range?.end ?? durationOf(project), offset = start;
      if (request.clipId) {
        const clip = project.tracks.flatMap(track => track.clips).find(clip => clip.id === request.clipId);
        if (clip?.type !== 'media' || !project.media[clip.mediaId]?.hasAudio) throw new Error('Select a clip with speech audio');
        offset = clip.start; start = 0; end = clip.duration;
        project.tracks = [{ id: clip.trackId, kind: 'audio', name: 'Speech', locked: false, hidden: false, muted: false, clips: [{ ...clip, start: 0, muted: false, volume: { value: 1, keyframes: [] }, fadeIn: 0, fadeOut: 0, transitionIn: undefined }] }];
        project.masterVolume = 1;
      }
      if (![start, end].every(Number.isSafeInteger) || start < 0 || end <= start || end > durationOf(project)) throw new Error('Choose a nonempty caption range');
      const modelName = request.model ?? 'base.en';
      if (!['base.en', 'small.en'].includes(modelName)) throw new Error('Invalid speech model');
      const whisper = await findWhisper(this.root), model = join(this.root, 'models', `ggml-${modelName}.bin`);
      if (!whisper || !(await stat(model).catch(() => null))) throw new Error(`Install the ${modelName} speech model first`);
      folder = await mkdtemp(join(tmpdir(), 'opencut-captions-'));
      const mix = join(folder, 'mix.wav'), mono = join(folder, 'speech.wav'), output = join(folder, 'transcript');
      progress({ stage: 'Preparing speech audio', percent: 0 });
      await this.run(ffmpegPath, ['-v', 'error', '-nostdin', '-y', ...audioMixArgs(project, { start, end, fps: 30, totalFrames: 0, format: 'wav' }, mix)], progress);
      await this.run(ffmpegPath, ['-v', 'error', '-nostdin', '-y', '-i', mix, '-ar', '16000', '-ac', '1', mono], progress);
      progress({ stage: 'Transcribing locally', percent: 0 });
      await this.run(whisper, ['-m', model, '-f', mono, '-l', 'en', '-ng', '-ojf', '-ml', '1', '-sow', '-pp', '-of', output], progress);
      const words = whisperWords(JSON.parse(await readFile(output + '.json', 'utf8')), offset, end - start);
      if (this.cancelled) throw new Error('Caption generation cancelled');
      return words;
    } finally { if (folder) await rm(folder, { recursive: true, force: true }).catch(() => {}); this.busy = false; }
  }
}
