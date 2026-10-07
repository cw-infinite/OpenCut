import { expect, it } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deriveMedia } from '../src/main/services/derivedMedia';
import { ffmpegPath } from '../src/main/services/tools';
import { runProcess } from '../src/main/services/process';
import { probe } from '../src/main/services/mediaProbe';
import { prepareMedia } from '../src/main/services/ffmpeg';
import { makeMediaClip } from '../src/renderer/engine/timeline';

it('reverses frame order across chunk boundaries and captures a real freeze frame', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'opencut-derived-'));
  try {
    const path = join(folder, 'colors.mp4');
    await runProcess(ffmpegPath, ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=red:s=64x64:r=30:d=1', '-f', 'lavfi', '-i', 'color=blue:s=64x64:r=30:d=2', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=3', '-filter_complex', '[0:v][1:v]concat=n=2:v=1:a=0[v]', '-map', '[v]', '-map', '2:a', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', path]);
    const asset = await probe(path, 'original'); await prepareMedia(asset, folder, 30, () => {});
    const clip = makeMediaClip('clip', asset, 'track', 0);
    const reversed = await deriveMedia(asset, clip, 'reverse', 0, 'reversed', folder, 30, () => {});
    expect(reversed.duration).toBe(3e6); expect(reversed.hasAudio).toBe(true);
    const pixel = async (source: string, time: number) => {
      const raw = join(folder, 'pixel.rgb');
      await runProcess(ffmpegPath, ['-v', 'error', '-y', '-ss', String(time), '-i', source, '-frames:v', '1', '-vf', 'scale=1:1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', raw]);
      return readFile(raw);
    };
    const first = await pixel(reversed.path, .2), last = await pixel(reversed.path, 2.5);
    expect(first[2]).toBeGreaterThan(200); expect(first[0]).toBeLessThan(20);
    expect(last[0]).toBeGreaterThan(200); expect(last[2]).toBeLessThan(20);
    const frozen = await deriveMedia(asset, clip, 'freeze', 2e6, 'freeze', folder, 30, () => {});
    expect(frozen.kind).toBe('image'); expect(frozen.duration).toBe(5e6);
    expect((await pixel(frozen.path, 0))[2]).toBeGreaterThan(200);
  } finally { await rm(folder, { recursive: true, force: true }); }
}, 30000);
