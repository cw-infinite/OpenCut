import { BrowserWindow, app, dialog, ipcMain, type IpcMainInvokeEvent, type WebContents } from 'electron';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { mkdtemp, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join, basename } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { ExportProgress, ExportRequest, ExportWork, Encoder } from '../../shared/export';
import type { ProjectStore } from './projectStore';
import type { MediaLibrary } from './mediaLibrary';
import { makeExportPlan, audioMixArgs, videoExportArgs } from '../../renderer/engine/ffmpegArgs';
import { exportSrt } from '../../renderer/engine/captions';
import { validateTimeline } from '../../renderer/engine/timeline';
import { selectEncoder } from './encoders';
import { ffmpegPath } from './tools';

interface Job {
  work: ExportWork; owner: WebContents; output: string; partial: string; folder: string;
  canceled: boolean; failure?: string; child?: ChildProcessWithoutNullStreams; window?: BrowserWindow;
  frame: number; writing: boolean; started: number; lastReport: number; encoder?: Encoder;
}
export class ExportRunner {
  private job: Job | null = null;
  private starting = false;
  constructor(private store: ProjectStore, private media: MediaLibrary, private preload: string, private renderer: string,
    trusted: (event: IpcMainInvokeEvent) => void) {
    ipcMain.handle('export:start', (event, request: ExportRequest) => { trusted(event); return this.start(event.sender, request); });
    ipcMain.handle('export:cancel', event => { trusted(event); this.cancel(); });
    ipcMain.handle('export:srt', async (event, id: string) => {
      trusted(event); const { project } = await this.store.read(id), text = exportSrt(project);
      if (!text) throw new Error('This project has no caption clips yet.');
      const output = await dialog.showSaveDialog({ title: 'Export captions', defaultPath: `${project.name.replace(/[<>:"/\\|?*]/g, '_')}.srt`, filters: [{ name: 'SubRip captions', extensions: ['srt'] }] });
      if (output.canceled || !output.filePath) return null;
      await writeFile(output.filePath, text, 'utf8'); return output.filePath;
    });
    ipcMain.handle('export:work', event => this.worker(event).work);
    ipcMain.handle('export:frame', (event, frame: number, bytes: ArrayBuffer) => this.frame(this.worker(event), frame, bytes));
    ipcMain.handle('export:finish', event => {
      const job = this.worker(event);
      if (job.frame !== job.work.plan.totalFrames || job.writing) throw new Error('Export did not render every frame');
      this.report(job, 'finalizing'); job.child?.stdin.end();
    });
    ipcMain.handle('export:workerError', (event, message: string) => {
      const job = this.worker(event); job.failure = String(message).slice(-4000); job.child?.kill();
    });
    app.on('before-quit', () => this.cancel());
  }
  private worker(event: IpcMainInvokeEvent): Job {
    const job = this.job;
    if (!job?.window || event.sender !== job.window.webContents || event.senderFrame !== job.window.webContents.mainFrame || job.canceled) throw new Error('No authorized export worker');
    return job;
  }
  private report(job: Job, stage: ExportProgress['stage'], message?: string): void {
    const elapsed = (Date.now() - job.started) / 1000, fps = elapsed > 0 ? job.frame / elapsed : 0;
    const progress: ExportProgress = { id: job.work.id, stage, frame: job.frame, total: job.work.plan.totalFrames, fps,
      etaSeconds: fps ? Math.max(0, (job.work.plan.totalFrames - job.frame) / fps) : null, outputPath: job.output, encoder: job.encoder, message };
    if (!job.owner.isDestroyed()) job.owner.send('export:progress', progress);
    job.lastReport = Date.now();
  }
  async start(owner: WebContents, request: ExportRequest): Promise<{ id: string; outputPath: string } | null> {
    if (this.starting || this.job) throw new Error('An export is already running');
    this.starting = true;
    try { return await this.begin(owner, request); } finally { this.starting = false; }
  }
  private async begin(owner: WebContents, request: ExportRequest): Promise<{ id: string; outputPath: string } | null> {
    if (this.job) throw new Error('An export is already running');
    const { project } = await this.store.readStable(request.projectId); validateTimeline(project);
    const plan = makeExportPlan(project, request);
    const selected = await dialog.showSaveDialog({ title: 'Export your video', defaultPath: join(app.getPath('videos'), `${project.name.replace(/[<>:"/\\|?*]/g, '_')}-${request.resolution}p.mp4`), filters: [{ name: 'MP4 video', extensions: ['mp4'] }] });
    if (selected.canceled || !selected.filePath) return null;
    if (this.job) throw new Error('An export is already running');
    const id = randomUUID(), output = selected.filePath.endsWith('.mp4') ? selected.filePath : selected.filePath + '.mp4';
    const views = await this.media.views(project.id), folder = await mkdtemp(join(app.getPath('temp'), 'opencut-export-'));
    const job: Job = { work: { id, project, plan, views }, owner, output, partial: join(dirname(output), `.${basename(output)}.${id}.partial.mp4`), folder,
      frame: 0, writing: false, canceled: false, started: Date.now(), lastReport: 0 };
    this.job = job;
    void this.run(job);
    return { id, outputPath: output };
  }
  cancel(): void {
    const job = this.job; if (!job) return;
    job.canceled = true; job.child?.kill(); job.window?.destroy();
  }
  private process(job: Job, args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      if (job.canceled) { reject(new Error('Export canceled')); return; }
      const child = spawn(ffmpegPath, args, { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] }); job.child = child;
      let tail = '';
      child.stdout.resume();
      child.stderr.on('data', (chunk: Buffer) => { tail = (tail + chunk.toString()).slice(-12000); });
      child.stdin.on('error', () => {}); // Process close supplies the complete FFmpeg diagnostic.
      child.on('error', reject);
      child.on('close', code => {
        if (job.child === child) job.child = undefined;
        if (code === 0 && !job.failure && !job.canceled) resolve(); else reject(new Error(job.failure || tail || `FFmpeg exited ${code}`));
      });
    });
  }
  private async run(job: Job): Promise<void> {
    let terminal: ExportProgress['stage'] = 'complete', message: string | undefined;
    try {
      this.report(job, 'audio');
      const mix = join(job.folder, 'mix.wav');
      await this.process(job, ['-hide_banner', '-nostdin', '-y', ...audioMixArgs(job.work.project, job.work.plan, mix)]);
      job.encoder = await selectEncoder(job.work.plan, () => job.canceled);
      if (job.canceled) throw new Error('Export canceled');
      try { await this.encode(job, mix); }
      catch (error) {
        if (job.canceled || job.encoder === 'libx264') throw error;
        await this.stopPipeline(job);
        job.encoder = 'libx264'; job.failure = undefined; job.frame = 0; job.writing = false;
        await this.encode(job, mix);
      }
      if (job.frame !== job.work.plan.totalFrames || job.canceled) throw new Error('Export did not complete');
      await rename(job.partial, job.output);
    } catch (error) {
      terminal = job.canceled ? 'canceled' : 'error';
      message = job.canceled ? 'Export canceled; incomplete output removed.' : String(error).slice(-6000);
    } finally {
      await this.stopPipeline(job);
      await rm(job.partial, { force: true }).catch(() => {});
      await rm(job.folder, { recursive: true, force: true }).catch(() => {});
      if (this.job === job) this.job = null;
      this.report(job, terminal, message);
    }
  }
  private async stopPipeline(job: Job): Promise<void> {
    const child = job.child;
    if (child && child.exitCode === null) await new Promise<void>(resolve => { child.once('close', () => resolve()); child.kill(); });
    if (job.window && !job.window.isDestroyed()) job.window.destroy();
    job.window = undefined;
  }
  private async encode(job: Job, mix: string): Promise<void> {
    job.started = Date.now(); job.lastReport = Date.now();
    const encoding = this.process(job, videoExportArgs(job.work.plan, job.encoder!, mix, job.partial));
    void encoding.catch(() => {});
    const watchdog = setInterval(() => {
      if (Date.now() - job.lastReport > 60000) { job.failure = 'Export renderer stopped making progress for 60 seconds.'; job.child?.kill(); }
    }, 5000);
    try {
      job.window = new BrowserWindow({ show: false, width: job.work.plan.width, height: job.work.plan.height,
        webPreferences: { preload: this.preload, sandbox: true, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false } });
      job.window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
      job.window.webContents.on('will-navigate', event => event.preventDefault());
      job.window.webContents.on('render-process-gone', (_event, details) => { job.failure = `Export renderer stopped: ${details.reason}`; job.child?.kill(); });
      this.report(job, 'encoding');
      if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) await job.window.loadURL(`${process.env.ELECTRON_RENDERER_URL}?export=${job.work.id}`);
      else await job.window.loadFile(this.renderer, { query: { export: job.work.id } });
      await encoding;
    } finally { clearInterval(watchdog); }
  }
  private async frame(job: Job, index: number, bytes: ArrayBuffer): Promise<void> {
    const plan = job.work.plan, stream = job.child?.stdin;
    if (!stream || job.writing || index !== job.frame || index >= plan.totalFrames || !(bytes instanceof ArrayBuffer) || bytes.byteLength !== plan.width * plan.height * 4) throw new Error('Invalid export frame');
    job.writing = true;
    try {
      await new Promise<void>((resolve, reject) => {
        const fail = (error: Error) => { cleanup(); reject(error); };
        const done = () => { cleanup(); resolve(); };
        const closed = () => fail(new Error('Encoder closed during frame transfer'));
        const cleanup = () => { stream.off('error', fail); stream.off('close', closed); stream.off('drain', done); };
        stream.once('error', fail); stream.once('close', closed);
        const accepted = stream.write(Buffer.from(bytes), error => { if (error) fail(error); else if (accepted) done(); });
        if (!accepted) stream.once('drain', done);
      });
      job.frame++;
      if (Date.now() - job.lastReport > 250) this.report(job, 'encoding');
    } finally { job.writing = false; }
  }
}
