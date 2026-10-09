import { it, expect } from 'vitest';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ffmpegPath } from '../src/main/services/tools';
import { runProcess } from '../src/main/services/process';
import { probe } from '../src/main/services/mediaProbe';
import { prepareMedia } from '../src/main/services/ffmpeg';
import { deriveMedia } from '../src/main/services/derivedMedia';
import { makeMediaClip } from '../src/renderer/engine/timeline';

it('stabilization reduces measured camera jitter while preserving video duration and audio', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'opencut-stabilize-'));
  try {
    const w = 320, h = 240, count = 90, bytes = Buffer.alloc(w * h * 3 * count);
    for (let frame = 0; frame < count; frame++) {
      const dx = Math.round(9 * Math.sin(frame * 2.3)), dy = Math.round(6 * Math.cos(frame * 1.7));
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const sx = x - dx, sy = y - dy, at = ((frame * h + y) * w + x) * 3;
        const shade = ((Math.floor(sx / 8) * 73856093 ^ Math.floor(sy / 8) * 19349663) >>> 0) % 220;
        const red = sx > 140 && sx < 180 && sy > 100 && sy < 140;
        bytes[at] = red ? 240 : shade; bytes[at + 1] = bytes[at + 2] = red ? 10 : shade;
      }
    }
    const raw = join(folder, 'input.rgb'), source = join(folder, 'shaky.mp4'); await writeFile(raw, bytes);
    await runProcess(ffmpegPath, ['-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${w}x${h}`, '-r', '30', '-i', raw, '-f', 'lavfi', '-i', 'sine=frequency=440:duration=3', '-c:v', 'libx264', '-crf', '14', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', source]);
    const asset = await probe(source, 'source'); await prepareMedia(asset, folder, 30, () => {});
    const stabilized = await deriveMedia(asset, makeMediaClip('c', asset, 't', 0), 'stabilize', 0, 'stable', folder, 30, () => {});
    expect(stabilized.duration).toBe(3e6); expect(stabilized.hasAudio).toBe(true); expect(stabilized.path).not.toBe(source);
    const jitter = async (path: string) => {
      const output = join(folder, 'decoded.rgb'); await runProcess(ffmpegPath, ['-v', 'error', '-y', '-i', path, '-an', '-f', 'rawvideo', '-pix_fmt', 'rgb24', output]);
      const data = await readFile(output), centers: number[] = [];
      for (let frame = 15; frame < count; frame++) { let total = 0, n = 0; for (let y = 50; y < 190; y++) for (let x = 80; x < 240; x++) { const at = ((frame * h + y) * w + x) * 3; if (data[at] > 150 && data[at + 1] < 80 && data[at + 2] < 80) { total += x; n++; } } expect(n).toBeGreaterThan(500); centers.push(total / n); }
      return centers.slice(1).reduce((sum, x, i) => sum + Math.abs(x - centers[i]), 0) / (centers.length - 1);
    };
    const before = await jitter(source), after = await jitter(stabilized.path);
    console.log(`Stabilization horizontal jitter: ${before.toFixed(2)} -> ${after.toFixed(2)} pixels/frame`);
    expect(after).toBeLessThan(before * .65);
  } finally { await rm(folder, { recursive: true, force: true }); }
}, 60000);
