import ffmpeg from 'ffmpeg-static';
import ffprobe from 'ffprobe-static';
import { join } from 'node:path';
import { stat, readdir } from 'node:fs/promises';
import { runProcess } from './process';
import type { ToolCheck, ToolReport } from '../../shared/api';

export const ffmpegPath = (ffmpeg ?? '').replace('app.asar', 'app.asar.unpacked');
export const ffprobePath = ffprobe.path.replace('app.asar', 'app.asar.unpacked');
export async function findWhisper(root: string): Promise<string | undefined> {
  try {
    for (const entry of await readdir(root, { withFileTypes: true })) {
      const path = join(root, entry.name);
      if (entry.isFile() && entry.name === 'whisper-cli.exe') return path;
      if (entry.isDirectory() && entry.name !== 'models') {
        const found = await findWhisper(path);
        if (found) return found;
      }
    }
  } catch { /* missing tool directory is expected before setup */ }
}
async function executableCheck(id: ToolCheck['id'], name: string, path: string | undefined, args: string[]): Promise<ToolCheck> {
  if (!path) return { id, name, ready: false, detail: 'Not installed' };
  try {
    const output = await runProcess(path, args);
    if (id === 'whisper' && !output.includes('--output-json-full')) throw new Error('CLI lacks full JSON timestamps');
    return { id, name, ready: true, detail: id === 'whisper' ? 'CPU CLI · full JSON timestamps supported' : output.split(/\r?\n/)[0] };
  } catch (error) { return { id, name, ready: false, detail: String(error).slice(-500) }; }
}
export async function checkTools(root: string): Promise<ToolReport> {
  const tools = await Promise.all([
    executableCheck('ffmpeg', 'FFmpeg', ffmpegPath, ['-version']),
    executableCheck('ffprobe', 'FFprobe', ffprobePath, ['-version']),
    executableCheck('whisper', 'Whisper.cpp', await findWhisper(root), ['--help'])
  ]);
  const model = await stat(join(root, 'models', 'ggml-base.en.bin')).catch(() => null);
  tools.push({ id: 'model', name: 'English speech model', ready: Boolean(model && model.size > 140_000_000),
    detail: model && model.size > 140_000_000 ? 'base.en · installed locally' : 'base.en · one-time download required' });
  return { ready: tools.every(tool => tool.ready), tools, checkedAt: new Date().toISOString() };
}
