import { join } from 'node:path';
import { stat, mkdir, rm } from 'node:fs/promises';
import { verifiedDownload } from './download';
export type CreativeTool = 'speech' | 'background';
const voiceBase = 'https://huggingface.co/rhasspy/piper-voices/resolve/c10ece1aade47bb51c153c893d14e5bf8e5b7117/en/en_US/ljspeech/medium/';
export async function creativeReady(root: string) {
  const exists = (name: string, minimum: number) => stat(join(root, name)).then(s => s.size >= minimum).catch(() => false);
  return { speech: (await Promise.all([exists('piper/piper.exe', 1000), exists('voice.onnx', 63531379), exists('voice.onnx.json', 4972)])).every(Boolean), background: await exists('modnet.onnx', 25888640) };
}
/** Explicit setup only; editing and generation never fetch remote resources. */
export async function setupCreative(root: string, kind: CreativeTool, progress: (stage: string, percent: number | null) => void) {
  await mkdir(root, { recursive: true });
  const get = (name: string, url: string, hash: string) => verifiedDownload(url, join(root, name), hash, percent => progress(name, percent));
  if (kind === 'background') {
    await get('modnet.onnx', 'https://huggingface.co/gradio/Modnet/resolve/2e7196ed50d5d60f99a73f737421d9760cf05e0c/modnet.onnx', '07c308cf0fc7e6e8b2065a12ed7fc07e1de8febb7dc7839d7b7f15dd66584df9');
  } else if (kind === 'speech') {
    if (process.platform !== 'win32' || process.arch !== 'x64') throw new Error('Piper setup requires Windows x64.');
    await get('piper.zip', 'https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_windows_amd64.zip', 'f3c58906402b24f3a96d92145f58acba6d86c9b5db896d207f78dc80811efcea');
    const { default: extract } = await import('@electron-internal/extract-zip');
    await extract(join(root, 'piper.zip'), { dir: root }); await rm(join(root, 'piper.zip'), { force: true });
    await get('voice.onnx', voiceBase + 'en_US-ljspeech-medium.onnx', '6f52a751e2349abe7a76735eb09dc1875298c77ea2342ffd2fef79ff81b87f22');
    await get('voice.onnx.json', voiceBase + 'en_US-ljspeech-medium.onnx.json', '141d612cc0a95ed7efc1ca936b845c2364967f2e9217c5dbfcf69fc4d6c65860');
    await get('VOICE_MODEL_CARD', voiceBase + 'MODEL_CARD', 'fbee1529c89d36b3fe76d7e9f3f832dce17f44900a52d76a9bda735654766b4d');
  } else throw new Error('Unknown creative tool');
}
