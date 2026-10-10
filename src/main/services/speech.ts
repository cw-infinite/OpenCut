import { join } from 'node:path';
import { mkdir, rm } from 'node:fs/promises';
import { creativeProcess } from './creativeProcess';
import { probe } from './mediaProbe';
import { prepareMedia } from './ffmpeg';

export async function generateSpeech(root: string, folder: string, id: string, text: string, rate: number, fps: number, signal: AbortSignal) {
  if (typeof text !== 'string' || !text.trim() || text.length > 5000 || /\u0000/.test(text)) throw new Error('Enter 1–5000 characters of speech.');
  if (!Number.isFinite(rate) || rate < .5 || rate > 2) throw new Error('Speech speed must be 0.5–2×.');
  await mkdir(join(folder, 'derived'), { recursive: true });
  const output = join(folder, 'derived', `speech-${id}.wav`);
  try {
    await creativeProcess(join(root, 'piper', 'piper.exe'), ['--model', join(root, 'voice.onnx'), '--output_file', output, '--length_scale', String(1 / rate)], signal, text.replace(/\r?\n/g, ' ') + '\n');
    signal.throwIfAborted();
    const asset = await probe(output, id);
    await prepareMedia(asset, folder, fps, () => {}); signal.throwIfAborted(); return asset;
  } catch (error) { await rm(output, { force: true }); throw error; }
}
