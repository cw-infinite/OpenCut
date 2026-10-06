import { randomUUID } from 'node:crypto';
import { stat, readFile, readdir } from 'node:fs/promises';
import { basename, isAbsolute, join } from 'node:path';
import { probe } from './mediaProbe';
import { prepareMedia } from './ffmpeg';
import type { ProjectStore } from './projectStore';
import type { ImportProgress, MediaView } from '../../shared/api';

export class MediaLibrary {
  readonly files = new Map<string, string>();
  private tokens = new Map<string, string>();
  private busy = new Set<string>();
  constructor(private store: ProjectStore) {}
  private url(path: string): string {
    let token = this.tokens.get(path);
    if (!token) { token = randomUUID(); this.tokens.set(path, token); this.files.set(token, path); }
    return `opencut-media://local/${token}`;
  }
  async import(projectId: string, paths: unknown, progress: (update: ImportProgress) => void) {
    if (!Array.isArray(paths) || paths.length > 200 || paths.some(path => typeof path !== 'string' || !isAbsolute(path))) throw new Error('Invalid import paths');
    if (this.busy.has(projectId)) throw new Error('Please wait for the current import to finish');
    this.busy.add(projectId);
    try {
      const { project } = await this.store.read(projectId);
      for (const path of paths as string[]) {
        const name = basename(path);
        let id: string | undefined;
        try {
          if (!(await stat(path)).isFile()) throw new Error('Not a file');
          progress({ projectId, name, stage: 'Reading media', percent: 0 });
          id = randomUUID();
          const asset = await probe(path, id);
          await this.store.update(projectId, current => { current.media[asset.id] = asset; });
          await prepareMedia(asset, this.store.folder(projectId), project.settings.fps,
            (stage, percent) => progress({ projectId, name, stage, percent }));
          await this.store.update(projectId, current => { current.media[asset.id] = asset; });
          progress({ projectId, name, stage: 'Ready', percent: 100 });
        } catch (error) {
          if (id) await this.store.update(projectId, current => { if (current.media[id!]) current.media[id!].status = 'error'; });
          progress({ projectId, name, stage: 'Import failed', percent: 0, error: String(error).slice(-1000) });
        }
      }
      return (await this.store.read(projectId)).project;
    } finally { this.busy.delete(projectId); }
  }
  assertIdle(projectId: string): void { if (this.busy.has(projectId)) throw new Error('Wait for media import to finish first'); }
  async views(projectId: string): Promise<MediaView[]> {
    const { project } = await this.store.read(projectId);
    return Promise.all(Object.values(project.media).map(async asset => {
      const files = asset.thumbDir ? await readdir(asset.thumbDir).catch(() => []) : [];
      const first = files.sort()[0];
      const peaks = asset.peaksPath ? JSON.parse(await readFile(asset.peaksPath, 'utf8').catch(() => '[]')) as number[] : [];
      return { asset, url: this.url(asset.proxyPath ?? asset.path), peaks,
        thumbnail: first && asset.thumbDir ? this.url(join(asset.thumbDir, first)) : undefined };
    }));
  }
}
