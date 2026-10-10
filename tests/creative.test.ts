import { it, expect } from 'vitest';
import { resolve, join } from 'node:path';
import { mkdir, readFile, readdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { generateSpeech } from '../src/main/services/speech';
import { removeBackground } from '../src/main/services/background';
import { runProcess } from '../src/main/services/process';
import { ffmpegPath } from '../src/main/services/tools';
import { probe } from '../src/main/services/mediaProbe';
import { makeMediaClip } from '../src/renderer/engine/timeline';

const tools = resolve('resources/tools/creative');
it('generates real local speech with speed control and rejects invalid input', async () => {
  const folder = resolve('.test-data/speech-' + randomUUID()); await mkdir(folder, { recursive: true });
  const signal = new AbortController().signal;
  const normal = await generateSpeech(tools, folder, 'normal', 'Welcome to Open Cut. This voice is generated entirely on your computer.', 1, 30, signal);
  const fast = await generateSpeech(tools, folder, 'fast', 'Welcome to Open Cut. This voice is generated entirely on your computer.', 2, 30, signal);
  expect(normal.kind).toBe('audio'); expect(normal.status).toBe('ready'); expect(normal.duration).toBeGreaterThan(2e6);
  expect(fast.duration).toBeLessThan(normal.duration * .8);
  const peaks = JSON.parse(await readFile(normal.peaksPath!, 'utf8')); expect(Math.max(...peaks)).toBeGreaterThan(.1);
  await expect(generateSpeech(tools, folder, 'bad', '', 1, 30, signal)).rejects.toThrow('characters');
  const canceled = new AbortController(); canceled.abort(); await expect(generateSpeech(tools, folder, 'canceled', 'Hello', 1, 30, canceled.signal)).rejects.toThrow();
  expect(await readdir(join(folder, 'derived'))).not.toContain('speech-canceled.wav');
}, 60000);

it('runs real portrait inference and retains alpha on photos and video, cleaning canceled work', async () => {
  const folder = resolve('.test-data/portrait-' + randomUUID()); await mkdir(folder, { recursive: true });
  const image = await probe(resolve('tests/fixtures/portrait.png'), 'portrait'); image.status = 'ready';
  const clip = makeMediaClip('c', image, 't', 0), signal = new AbortController().signal;
  clip.sourceIn = 1e6; clip.duration = 4e6;
  const photo = await removeBackground(tools, folder, 'photo', image, clip, 24, signal, () => {});
  const videoPath = join(folder, 'source.mp4');
  await runProcess(ffmpegPath, ['-v', 'error', '-y', '-loop', '1', '-i', image.path, '-f', 'lavfi', '-i', 'sine=frequency=440', '-t', '0.5', '-r', '24', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', videoPath]);
  const video = await probe(videoPath, 'video'); video.status = 'ready';
  const cutout = await removeBackground(tools, folder, 'video', video, makeMediaClip('v', video, 't', 0), 24, signal, () => {});
  expect(cutout.hasAudio).toBe(true); expect(cutout.hasAlpha).toBe(true); expect(cutout.proxyPath).toBe(cutout.path);
  for (const result of [photo, cutout]) {
    const path = join(folder, `${result.id}.rgba`);
    await runProcess(ffmpegPath, ['-v', 'error', '-y', ...(result.kind === 'video' ? ['-c:v', 'libvpx-vp9'] : []), '-i', result.path, '-frames:v', '1', '-pix_fmt', 'rgba', '-f', 'rawvideo', path]);
    const rgba = await readFile(path); let clear = 0, opaque = 0;
    for (let i = 3; i < rgba.length; i += 4) { if (rgba[i] < 20) clear++; if (rgba[i] > 230) opaque++; }
    expect(clear / (512 * 512)).toBeGreaterThan(.15); expect(opaque / (512 * 512)).toBeGreaterThan(.15);
  }
  const abort = new AbortController(); abort.abort();
  await expect(removeBackground(tools, folder, 'canceled', image, clip, 24, abort.signal, () => {})).rejects.toThrow();
  expect((await readdir(join(folder, 'derived'))).some(name => name.startsWith('portrait-work-') || name.includes('canceled'))).toBe(false);
}, 120000);

