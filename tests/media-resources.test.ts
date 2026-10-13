import { afterEach, expect, it, vi } from 'vitest';
import { mediaEvent } from '../src/renderer/engine/mediaEvent';
import { MediaResources } from '../src/renderer/engine/resources';
import { createProject } from '../src/shared/project';
import { makeMediaClip, makeTrack } from '../src/renderer/engine/timeline';

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

it('settles decode waits on success, failure, timeout, cancellation and synchronous errors', async () => {
  vi.useFakeTimers();
  const target = new EventTarget() as HTMLVideoElement, abort = new AbortController();
  await mediaEvent(target, 'loadeddata', () => target.dispatchEvent(new Event('loadeddata')), abort.signal);
  await expect(mediaEvent(target, 'loadeddata', () => target.dispatchEvent(new Event('error')), abort.signal)).rejects.toThrow('decode');
  await expect(mediaEvent(target, 'loadeddata', () => { throw new Error('broken source'); }, abort.signal)).rejects.toThrow('broken source');
  const pending = mediaEvent(target, 'seeked', () => {}, abort.signal), failed = expect(pending).rejects.toThrow('timed out');
  await vi.advanceTimersByTimeAsync(15000); await failed;
  const canceled = mediaEvent(target, 'seeked', () => {}, abort.signal); abort.abort(); await expect(canceled).rejects.toMatchObject({ name: 'AbortError' });
  expect(vi.getTimerCount()).toBe(0);
});

class Video extends EventTarget {
  private time = 0;
  set src(_value: string) { queueMicrotask(() => this.dispatchEvent(new Event('loadeddata'))); }
  get currentTime() { return this.time; }
  set currentTime(time: number) { this.time = time; }
  pause() {} load() {} removeAttribute() {} async play() {}
}
class Node {
  connected = false; gain = { value: 0 };
  connect(target: Node) { this.connected = true; return target; }
  disconnect() { this.connected = false; }
}
function fixture() {
  const nodes: Node[] = [];
  const context = { state: 'running', destination: new Node(), createGain: () => { const n = new Node(); nodes.push(n); return n; }, createMediaElementSource: () => { const n = new Node(); nodes.push(n); return n; }, close: vi.fn(async () => {}) };
  vi.stubGlobal('HTMLVideoElement', Video); vi.stubGlobal('HTMLImageElement', class {});
  vi.stubGlobal('document', { createElement: () => new Video() }); vi.stubGlobal('AudioContext', class { constructor() { return context; } });
  const project = createProject('p', 'Resources', { width: 1920, height: 1080, fps: 30, sampleRate: 48000 });
  const asset = { id: 'a', path: 'a.mp4', kind: 'video' as const, duration: 2e6, hasAudio: true, status: 'ready' as const };
  project.media.a = asset; const track = makeTrack('t', 'video', 'Video'); project.tracks.push(track);
  track.clips = Array.from({ length: 20 }, (_, i) => makeMediaClip(String(i), asset, track.id, i * 2e6));
  return { project, nodes, context, pool: new MediaResources([{ asset, url: 'opencut-media://test', peaks: [] }]) };
}

it('disconnects retired audio graph nodes across repeated clip boundaries', async () => {
  const { pool, project, nodes, context } = fixture();
  for (let i = 0; i < 20; i++) {
    await pool.prepare(project, i * 2e6, true);
    expect(nodes.filter(n => n.connected)).toHaveLength(2);
  }
  pool.dispose(); expect(nodes.filter(n => n.connected)).toHaveLength(0); expect(context.close).toHaveBeenCalledOnce();
});

it('disposal rejects an outstanding seek instead of leaving preparation hanging', async () => {
  const { pool, project } = fixture(); await pool.prepare(project, 0);
  const pending = pool.prepare(project, 1e6); await Promise.resolve(); pool.dispose();
  await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
});
