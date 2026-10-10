import { join } from 'node:path';
import { mkdir, mkdtemp, open, rm, stat } from 'node:fs/promises';
import * as ort from 'onnxruntime-node';
import type { MediaAsset, MediaClip } from '../../shared/types';
import { ffmpegPath } from './tools';
import { creativeProcess } from './creativeProcess';
import { probe } from './mediaProbe';
import { generatePeaks, prepareMedia } from './ffmpeg';

export function portraitInput(rgb: Uint8Array, width: number, height: number) {
  const n = width * height, values = new Float32Array(n * 3);
  if (rgb.length !== n * 3) throw new Error('Incomplete portrait frame');
  for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) values[c * n + i] = rgb[i * 3 + c] / 127.5 - 1;
  return new ort.Tensor('float32', values, [1, 3, height, width]);
}

export async function removeBackground(root: string, folder: string, id: string, asset: MediaAsset, clip: MediaClip, fps: number, signal: AbortSignal, progress: (percent: number) => void) {
  const span = clip.sourceOut - clip.sourceIn;
  if (asset.kind === 'audio' || asset.hasAlpha) throw new Error('Choose an original photo or video.');
  if (asset.kind === 'video' && span > 30e6) throw new Error('Split video into source ranges of 30 seconds or less before background removal.');
  const derived = join(folder, 'derived'); await mkdir(derived, { recursive: true });
  const work = await mkdtemp(join(derived, 'portrait-work-'));
  const output = join(derived, `cutout-${id}.${asset.kind === 'image' ? 'png' : 'webm'}`);
  let session: ort.InferenceSession | undefined;
  try {
    signal.throwIfAborted();
    const source = await probe(asset.proxyPath ?? asset.path, 'source');
    const width = Math.max(32, Math.round(source.width! / Math.max(source.width!, source.height!) * 512 / 32) * 32);
    const height = Math.max(32, Math.round(source.height! / Math.max(source.width!, source.height!) * 512 / 32) * 32);
    const input = [...(asset.kind === 'video' ? ['-ss', String(clip.sourceIn / 1e6)] : []), '-i', asset.proxyPath ?? asset.path];
    const raw = join(work, 'frames.rgb'), mask = join(work, 'matte.gray');
    await creativeProcess(ffmpegPath, ['-v', 'error', '-y', ...input, '-t', String(span / 1e6), '-vf', `fps=${fps},scale=${width}:${height}`, ...(asset.kind === 'image' ? ['-frames:v', '1'] : []), '-an', '-pix_fmt', 'rgb24', '-f', 'rawvideo', raw], signal);
    session = await ort.InferenceSession.create(join(root, 'modnet.onnx'), { executionProviders: ['cpu'], intraOpNumThreads: 2, interOpNumThreads: 1 });
    const frameBytes = width * height * 3, frames = (await stat(raw)).size / frameBytes;
    if (!Number.isInteger(frames) || frames < 1) throw new Error('No complete video frames to process.');
    const reader = await open(raw, 'r'), writer = await open(mask, 'w');
    try {
      const rgb = Buffer.alloc(frameBytes);
      for (let frame = 0; frame < frames; frame++) {
        signal.throwIfAborted();
        const { bytesRead } = await reader.read(rgb, 0, frameBytes, frame * frameBytes);
        if (bytesRead !== frameBytes) throw new Error('Incomplete decoded frame.');
        const inputTensor = portraitInput(rgb, width, height);
        const results = await session.run({ [session.inputNames[0]]: inputTensor });
        const prediction = results[session.outputNames[0]];
        const values = prediction.data as Float32Array;
        if (values.length !== width * height) throw new Error('Unexpected portrait matte dimensions.');
        const alpha = Buffer.alloc(values.length);
        for (let i = 0; i < values.length; i++) alpha[i] = Math.round(Math.max(0, Math.min(1, values[i])) * 255);
        await writer.write(alpha); inputTensor.dispose(); Object.values(results).forEach(tensor => tensor.dispose());
        progress(Math.round((frame + 1) / frames * 90));
      }
    } finally { await reader.close(); await writer.close(); }
    const maskInput = ['-f', 'rawvideo', '-pix_fmt', 'gray', '-s', `${width}x${height}`, '-r', String(fps), '-i', mask];
    const filter = `[0:v]fps=${fps},setsar=1,format=rgb24[color];[1:v]scale=${source.width}:${source.height}:flags=bilinear[alpha];[color][alpha]alphamerge[out]`;
    await creativeProcess(ffmpegPath, ['-v', 'error', '-y', ...input, ...maskInput,
      '-filter_complex', filter, '-map', '[out]', ...(asset.kind === 'image' ? ['-frames:v', '1'] : ['-map', '0:a?', '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p', '-auto-alt-ref', '0', '-crf', '20', '-b:v', '0', '-deadline', 'good', '-cpu-used', '4', '-g', String(fps), '-c:a', 'libopus', '-t', String(span / 1e6)]), output], signal);
    const result = await probe(output, id); result.hasAlpha = true;
    if (asset.kind === 'image') await prepareMedia(result, folder, fps, () => {});
    else {
      result.duration = span; result.proxyPath = output; result.status = 'ready';
      result.thumbDir = join(folder, 'thumbs', id); await mkdir(result.thumbDir, { recursive: true });
      await creativeProcess(ffmpegPath, ['-v', 'error', '-y', '-c:v', 'libvpx-vp9', '-i', output, '-frames:v', '1', '-vf', 'scale=-2:160', join(result.thumbDir, '00001.png')], signal);
      if (result.hasAudio) { await mkdir(join(folder, 'peaks'), { recursive: true }); result.peaksPath = join(folder, 'peaks', `${id}.json`); await generatePeaks(result, result.peaksPath); }
    }
    signal.throwIfAborted(); progress(100); return result;
  } catch (error) { await rm(output, { force: true }).catch(() => {}); throw error; }
  finally { await session?.release(); await rm(work, { recursive: true, force: true }); }
}
