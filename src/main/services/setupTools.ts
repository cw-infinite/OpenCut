import { join } from 'node:path';
import { mkdir, rm } from 'node:fs/promises';
import { verifiedDownload } from './download';
import { findWhisper } from './tools';
import { runProcess } from './process';
import type { SetupProgress } from '../../shared/api';

const release = 'v1.9.2';
const binaryHash = '49dcc16de826f20bd53d44f947a1ae49dfa81f86cad67a64d80820cb192d674a';
const models = {
  'base.en': 'a03779c86df3323075f5e796cb2ce5029f00ec8869eee3fdfb897afe36c6d002',
  'small.en': 'c6138d6d58ecc8322097e0f987c32f1be8bb0a18532a3f88f734d1bbf9c41e5d'
};
/** Only called by the explicit setup command/button. No downloads during normal editing. */
export async function setupTools(root: string, report: (progress: SetupProgress) => void, small = false): Promise<void> {
  if (process.platform !== 'win32' || process.arch !== 'x64') throw new Error('OpenCut tool setup requires Windows x64.');
  await mkdir(root, { recursive: true });
  let cli = await findWhisper(join(root, 'whisper'));
  const healthy = cli && await runProcess(cli, ['--help']).then(text => text.includes('--output-json-full')).catch(() => false);
  if (!healthy) {
    const archive = join(root, 'whisper.zip');
    await verifiedDownload(`https://github.com/ggml-org/whisper.cpp/releases/download/${release}/whisper-bin-x64.zip`, archive, binaryHash,
      percent => report({ stage: 'Whisper.cpp', percent, detail: 'Downloading the local CPU speech engine' }));
    const { default: extract } = await import('@electron-internal/extract-zip');
    await extract(archive, { dir: join(root, 'whisper') });
    await rm(archive, { force: true });
    cli = await findWhisper(join(root, 'whisper'));
  }
  if (!cli) throw new Error('Downloaded archive did not contain whisper-cli.exe');
  const help = await runProcess(cli, ['--help']);
  if (!help.includes('--output-json-full')) throw new Error('Whisper CLI does not support word timestamp output');
  for (const model of small ? ['base.en', 'small.en'] as const : ['base.en'] as const) {
    await verifiedDownload(`https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-${model}.bin`,
      join(root, 'models', `ggml-${model}.bin`), models[model],
      percent => report({ stage: `Model ${model}`, percent, detail: 'Downloading and verifying the English speech model' }));
  }
  report({ stage: 'Complete', percent: 100, detail: 'Local speech tools are ready' });
}
