import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ffmpegPath } from './tools';
import type { MediaAsset } from '../../shared/types';

export async function ffmpegJob(args: string[], duration: number, progress: (percent: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, ['-hide_banner', '-nostdin', '-y', '-progress', 'pipe:1', ...args], { windowsHide: true });
    let tail = '', pending = '';
    child.stderr.on('data', (chunk: Buffer) => { tail = (tail + chunk).slice(-12000); });
    child.stdout.on('data', (chunk: Buffer) => {
      pending += chunk.toString();
      const lines = pending.split(/\r?\n/); pending = lines.pop() ?? '';
      for (const line of lines) if (line.startsWith('out_time_us=')) progress(Math.max(0, Math.min(99, Math.round(Number(line.slice(12)) / duration * 100))));
    });
    child.on('error', reject);
    child.on('close', code => { if (code === 0) { progress(100); resolve(); } else reject(new Error(tail || `FFmpeg exited ${code}`)); });
  });
}
export function proxyArgs(asset: MediaAsset, fps: number, output: string): string[] {
  if (asset.kind === 'audio') return ['-i', asset.path, '-vn', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', output];
  return ['-i', asset.path, '-map', '0:v:0', '-map', '0:a?', '-vf',
    `scale=w='min(1920,iw)':h='min(1080,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2,setsar=1,fps=${fps}`,
    '-fps_mode', 'cfr', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '14', '-g', '1', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', output];
}
export async function generatePeaks(asset: MediaAsset, output: string): Promise<void> {
  const peaks: number[] = [];
  const samplesPerPeak = Math.max(80, Math.ceil(asset.duration / 1_000_000 * 8000 / 12000));
  await new Promise<void>((resolve, reject) => {
    const child = spawn(ffmpegPath, ['-v', 'error', '-nostdin', '-i', asset.path, '-vn', '-ac', '1', '-ar', '8000', '-f', 's16le', 'pipe:1'], { windowsHide: true });
    let max = 0, count = 0, tail = '';
    let carry: Buffer = Buffer.alloc(0);
    child.stdout.on('data', (chunk: Buffer) => {
      const data = carry.length ? Buffer.concat([carry, chunk]) : chunk;
      const size = data.length - data.length % 2;
      for (let i = 0; i < size; i += 2) {
        max = Math.max(max, Math.abs(data.readInt16LE(i)) / 32768);
        if (++count === samplesPerPeak) { peaks.push(Math.round(max * 1000) / 1000); count = 0; max = 0; }
      }
      carry = data.subarray(size);
    });
    child.stderr.on('data', chunk => { tail = (tail + chunk).slice(-2000); });
    child.on('error', reject);
    child.on('close', code => { if (code === 0) { if (count) peaks.push(max); resolve(); } else reject(new Error(tail)); });
  });
  await writeFile(output, JSON.stringify(peaks), 'utf8');
}
export async function prepareMedia(asset: MediaAsset, folder: string, fps: number, progress: (stage: string, percent: number) => void): Promise<MediaAsset> {
  await Promise.all(['proxies', 'thumbs', 'peaks'].map(dir => mkdir(join(folder, dir), { recursive: true })));
  if (asset.kind !== 'image') {
    asset.proxyPath = join(folder, 'proxies', asset.id + (asset.kind === 'video' ? '.mp4' : '.m4a'));
    await ffmpegJob(proxyArgs(asset, fps, asset.proxyPath), asset.duration, percent => progress('Creating seekable proxy', percent));
  } else {
    asset.proxyPath = join(folder, 'proxies', asset.id + '.png');
    await ffmpegJob(['-i', asset.path, '-frames:v', '1', asset.proxyPath], asset.duration, percent => progress('Preparing still image', percent));
  }
  if (asset.kind !== 'audio') {
    asset.thumbDir = join(folder, 'thumbs', asset.id);
    await mkdir(asset.thumbDir, { recursive: true });
    const args = ['-i', asset.proxyPath ?? asset.path, '-vf', asset.kind === 'image' ? 'scale=-2:160' : 'fps=1,scale=-2:160', '-q:v', '3'];
    if (asset.kind === 'image') args.push('-frames:v', '1');
    await ffmpegJob([...args, join(asset.thumbDir, '%05d.jpg')], asset.duration, percent => progress('Generating thumbnails', percent));
  }
  if (asset.hasAudio) {
    asset.peaksPath = join(folder, 'peaks', asset.id + '.json');
    progress('Drawing waveform', 0);
    await generatePeaks(asset, asset.peaksPath);
  }
  asset.status = 'ready';
  return asset;
}
