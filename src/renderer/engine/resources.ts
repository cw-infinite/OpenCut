import type { Clip, Project } from '../../shared/types';
import type { MediaView } from '../../shared/api';
import { activeAt, sourceTime } from './compositor';
interface Source { element: HTMLVideoElement | HTMLImageElement; ready: Promise<void>; gain?: GainNode }
export class MediaResources {
  private pool = new Map<string, Source>();
  private audio: AudioContext | null = null;
  constructor(private views: MediaView[]) {}
  source(clip: Clip) { return this.pool.get(clip.id)?.element; }
  async prepare(project: Project, time: number, playing = false): Promise<void> {
    const wanted = new Set<string>();
    const jobs: Promise<void>[] = [];
    for (const track of project.tracks) for (const clip of track.clips) {
      if (clip.type !== 'media' || track.hidden || time < clip.start - 1_000_000 || time >= clip.start + clip.duration) continue;
      wanted.add(clip.id);
      const view = this.views.find(view => view.asset.id === clip.mediaId); if (!view) continue;
      let item = this.pool.get(clip.id);
      if (!item) {
        const element = view.asset.kind === 'image' ? new Image() : document.createElement('video');
        element.crossOrigin = 'anonymous';
        const ready = new Promise<void>((resolve, reject) => {
          element.addEventListener(element instanceof HTMLImageElement ? 'load' : 'loadeddata', () => resolve(), { once: true });
          element.addEventListener('error', () => reject(new Error(`Cannot decode ${view.asset.path}`)), { once: true });
        });
        if (element instanceof HTMLVideoElement) { element.preload = 'auto'; element.playsInline = true; }
        element.src = view.url;
        item = { element, ready }; this.pool.set(clip.id, item);
      }
      const entry = item;
      jobs.push((async () => {
        await entry.ready;
        const element = entry.element; if (!(element instanceof HTMLVideoElement)) return;
        const active = activeAt(clip, time), desired = sourceTime(clip, Math.max(clip.start, time)) / 1e6;
        const gain = clip.muted || track.muted || !active ? 0 : clip.volume.value *
          (clip.fadeIn ? Math.min(1, (time - clip.start) / clip.fadeIn) : 1) *
          (clip.fadeOut ? Math.min(1, (clip.start + clip.duration - time) / clip.fadeOut) : 1);
        if (playing && !this.audio) this.audio = new AudioContext();
        if (this.audio && !entry.gain) {
          entry.gain = this.audio.createGain(); this.audio.createMediaElementSource(element).connect(entry.gain).connect(this.audio.destination);
        }
        if (entry.gain) entry.gain.gain.value = Math.max(0, gain); else element.muted = true;
        if (entry.gain) element.muted = false;
        if (playing && this.audio?.state === 'suspended') await this.audio.resume();
        if (Math.abs(element.currentTime - desired) > (playing && active ? .08 : .000001)) {
          await new Promise<void>((resolve, reject) => {
            const timer = setTimeout(() => { cleanup(); reject(new Error('Media seek timed out')); }, 10000);
            const done = () => { cleanup(); resolve(); };
            const cleanup = () => { clearTimeout(timer); element.removeEventListener('seeked', done); };
            element.addEventListener('seeked', done); element.currentTime = desired;
          });
        }
        if (playing && active && !clip.reverse) { element.playbackRate = Math.min(16, Math.max(.0625, clip.speed)); await element.play(); }
        else element.pause();
      })());
    }
    for (const [id, item] of this.pool) if (!wanted.has(id)) { this.release(item); this.pool.delete(id); }
    await Promise.all(jobs);
  }
  private release(item: Source): void {
    item.gain?.disconnect();
    if (item.element instanceof HTMLVideoElement) { item.element.pause(); item.element.removeAttribute('src'); item.element.load(); }
  }
  pause(): void { for (const item of this.pool.values()) if (item.element instanceof HTMLVideoElement) item.element.pause(); }
  dispose(): void { for (const item of this.pool.values()) this.release(item); this.pool.clear(); void this.audio?.close(); }
}
