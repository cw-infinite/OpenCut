import { randomUUID } from 'node:crypto';
import { parseWaveformCache } from './waveformCache';
import { stat, readFile, readdir, mkdir, writeFile, rm } from 'node:fs/promises';
import { basename, isAbsolute, join } from 'node:path';
import { probe } from './mediaProbe';
import { prepareMedia, ffmpegJob } from './ffmpeg';
import type { ProjectStore } from './projectStore';
import type { ImportProgress, MediaView } from '../../shared/api';
import { deriveMedia } from './derivedMedia';
import { validateTimeline } from '../../renderer/engine/timeline';
import type { Project } from '../../shared/types';

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
  async cover(id: string): Promise<string | undefined> {
    const path = join(this.store.folder(id), 'cover.png');
    const info = await stat(path).catch(() => null);
    return info ? this.url(path) + '?v=' + info.mtimeMs : undefined;
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
  async relink(projectId: string, assetId: string, path: string, progress: (update: ImportProgress) => void) {
    this.assertIdle(projectId); this.busy.add(projectId);
    try {
      const { project } = await this.store.readStable(projectId), original = project.media[assetId];
      if (!original || !isAbsolute(path)) throw new Error('Invalid replacement media');
      const replacement = await probe(path, randomUUID());
      if (replacement.kind !== original.kind || (original.hasAudio && !replacement.hasAudio)) throw new Error('Replacement must have the same media type and required audio');
      const check = (current: typeof project) => {
        if (!current.media[assetId]) throw new Error('The media was removed while relinking');
        if (replacement.kind !== 'image' && current.tracks.some(track => track.clips.some(clip => clip.type === 'media' && clip.mediaId === assetId && clip.sourceOut > replacement.duration))) throw new Error('Replacement is shorter than a used source range');
      };
      check(project);
      await prepareMedia(replacement, this.store.folder(projectId), project.settings.fps, (stage, percent) => progress({ projectId, name: basename(path), stage, percent }));
      replacement.id = assetId;
      return await this.store.update(projectId, current => { check(current); current.media[assetId] = replacement; validateTimeline(current); });
    } finally { this.busy.delete(projectId); }
  }
  async record(projectId: string, bytes: ArrayBuffer) {
    this.assertIdle(projectId); this.busy.add(projectId);
    try {
      if (!(bytes instanceof ArrayBuffer) || bytes.byteLength < 4 || bytes.byteLength > 64 * 1024 * 1024 || new DataView(bytes).getUint32(0) !== 0x1a45dfa3) throw new Error('Invalid or oversized audio recording');
      const { project } = await this.store.readStable(projectId), id = randomUUID(), folder = this.store.folder(projectId);
      await mkdir(join(folder, 'derived'), { recursive: true });
      const path = join(folder, 'derived', `voiceover-${id}.webm`); await writeFile(path, Buffer.from(bytes));
      const wav = join(folder, 'derived', `voiceover-${id}.wav`);
      await ffmpegJob(['-i', path, '-vn', '-c:a', 'pcm_s16le', '-ar', '48000', wav], 1, () => {});
      const asset = await probe(wav, id); if (asset.kind !== 'audio') throw new Error('Expected an audio-only recording');
      await prepareMedia(asset, folder, project.settings.fps, () => {});
      await this.store.update(projectId, current => { current.media[id] = asset; }); return asset;
    } finally { this.busy.delete(projectId); }
  }
  async recordVideo(projectId: string, bytes: ArrayBuffer) {
    this.assertIdle(projectId); this.busy.add(projectId);
    let raw: string | undefined;
    try {
      if (!(bytes instanceof ArrayBuffer) || bytes.byteLength < 4 || bytes.byteLength > 128 * 1024 * 1024 || new DataView(bytes).getUint32(0) !== 0x1a45dfa3) throw new Error('Invalid or oversized video recording');
      const { project } = await this.store.readStable(projectId), id = randomUUID(), folder = this.store.folder(projectId);
      await mkdir(join(folder, 'derived'), { recursive: true });
      raw = join(folder, 'derived', `recording-${id}.webm`); await writeFile(raw, Buffer.from(bytes));
      const path = join(folder, 'derived', `recording-${id}.mp4`);
      await ffmpegJob(['-i', raw, '-map', '0:v:0', '-map', '0:a?', '-t', '300', '-vf', `scale=w='min(1920,iw)':h='min(1080,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2,setsar=1,fps=${project.settings.fps}`, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-movflags', '+faststart', path], 1, () => {});
      const asset = await probe(path, id); if (asset.kind !== 'video') throw new Error('Expected a video recording');
      await prepareMedia(asset, folder, project.settings.fps, () => {});
      await this.store.update(projectId, current => { current.media[id] = asset; }); return asset;
    } finally { if (raw) await rm(raw, { force: true }).catch(() => {}); this.busy.delete(projectId); }
  }
  async derive(projectId: string, clipId: string, operation: 'freeze' | 'reverse', time: number, progress: (update: ImportProgress) => void) {
    this.assertIdle(projectId); this.busy.add(projectId);
    try {
      if (!['freeze', 'reverse'].includes(operation)) throw new Error('Invalid media operation');
      const { project } = await this.store.readStable(projectId);
      const track = project.tracks.find(track => track.clips.some(clip => clip.id === clipId));
      const clip = track?.clips.find(clip => clip.id === clipId);
      if (!track || track.locked || clip?.type !== 'media') throw new Error('Select an unlocked media clip');
      const asset = project.media[clip.mediaId];
      const derived = await deriveMedia(asset, clip, operation, time, randomUUID(), this.store.folder(projectId), project.settings.fps,
        (stage, percent) => progress({ projectId, name: operation, stage, percent }));
      await this.store.update(projectId, current => { current.media[derived.id] = derived; });
      return derived;
    } finally { this.busy.delete(projectId); }
  }
  async views(projectId: string, snapshot?: Project): Promise<MediaView[]> {
    const project = snapshot ?? (await this.store.read(projectId)).project;
    return Promise.all(Object.values(project.media).map(async asset => {
      const files = asset.thumbDir ? await readdir(asset.thumbDir).catch(() => []) : [];
      const first = files.sort()[0];
      const peaks = asset.peaksPath ? parseWaveformCache(await readFile(asset.peaksPath, 'utf8').catch(() => '[]')) : [];
      return { asset, url: this.url(asset.proxyPath ?? asset.path), peaks, missing: !(await stat(asset.path).catch(() => null))?.isFile(),
        thumbnail: first && asset.thumbDir ? this.url(join(asset.thumbDir, first)) : undefined };
    }));
  }
}
