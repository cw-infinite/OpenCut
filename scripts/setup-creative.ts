import { resolve } from 'node:path';
import { setupCreative } from '../src/main/services/creativeTools';

async function main() {
  const root = resolve('resources/tools/creative');
  for (const kind of ['speech', 'background'] as const) await setupCreative(root, kind, (stage, percent) => console.log(`${kind}: ${stage} ${percent ?? '…'}%`));
}
void main().catch(error => { console.error(error); process.exitCode = 1; });
