import { resolve } from 'node:path';
import { setupTools } from '../src/main/services/setupTools';
import { checkTools } from '../src/main/services/tools';
async function main(): Promise<void> {
  const root = resolve('resources/tools');
  await setupTools(root, progress => console.log(`${progress.stage}: ${progress.percent ?? '…'}% — ${progress.detail}`), process.argv.includes('--small'));
  const report = await checkTools(root);
  for (const tool of report.tools) console.log(`${tool.ready ? 'OK' : 'MISSING'} ${tool.name}: ${tool.detail}`);
  if (!report.ready) process.exitCode = 1;
}
main().catch(error => { console.error(error); process.exitCode = 1; });
