import { describe, expect, it } from 'vitest';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fixtures } from '../scripts/fixtures';
import { probe } from '../src/main/services/mediaProbe';
import { prepareMedia } from '../src/main/services/ffmpeg';
import { runProcess } from '../src/main/services/process';
import { ffprobePath } from '../src/main/services/tools';

describe('real FFmpeg import pipeline', () => {
  it('normalizes 1080p VFR footage to all-intra CFR and produces thumbnails, audio proxies and peaks', async () => {
    const paths = await fixtures();
    const folder = await mkdtemp(join(tmpdir(), 'opencut-media-test-'));
    try {
      const video = await prepareMedia(await probe(paths.video, 'video'), folder, 30, () => {});
      expect(video.status).toBe('ready'); expect(video.hasAudio).toBe(true);
      expect(await readdir(video.thumbDir!)).toHaveLength(2);
      const proxy = await probe(video.proxyPath!, 'proxy');
      expect(proxy.fps).toBe(30); expect(proxy.width).toBe(1920); expect(proxy.height).toBe(1080);
      expect(Math.abs(proxy.duration - video.duration)).toBeLessThanOrEqual(1000000 / 30 + 20000);
      const raw = await runProcess(ffprobePath, ['-v', 'error', '-select_streams', 'v', '-show_frames', '-show_entries', 'frame=key_frame,best_effort_timestamp_time', '-of', 'json', video.proxyPath!]);
      const frames = JSON.parse(raw).frames;
      expect(frames.length).toBeGreaterThan(55);
      expect(frames.every((frame: { key_frame: number }) => frame.key_frame === 1)).toBe(true);
      for (let i = 1; i < frames.length; i++) expect(Number(frames[i].best_effort_timestamp_time) - Number(frames[i - 1].best_effort_timestamp_time)).toBeCloseTo(1 / 30, 5);
      const audio = await prepareMedia(await probe(paths.audio, 'audio'), folder, 30, () => {});
      expect(audio.kind).toBe('audio'); expect(audio.proxyPath).toMatch(/\.m4a$/);
      const peaks = JSON.parse(await readFile(audio.peaksPath!, 'utf8')) as number[];
      expect(peaks.length).toBeGreaterThan(100); expect(Math.max(...peaks)).toBeGreaterThan(.05);
      const image = await prepareMedia(await probe(paths.image, 'image'), folder, 30, () => {});
      expect(image.kind).toBe('image'); expect(image.status).toBe('ready');
      expect(await readdir(image.thumbDir!)).toHaveLength(1);
    } finally { await rm(folder, { recursive: true, force: true }); }
  }, 60000);
});
