import { spawn } from 'node:child_process';

/** Kill and wait for child exit before callers clean its output files. */
export async function creativeProcess(executable: string, args: string[], signal: AbortSignal, input?: string): Promise<void> {
  signal.throwIfAborted();
  await new Promise<void>((resolve, reject) => {
    const child = spawn(executable, args, { windowsHide: true, stdio: ['pipe', 'ignore', 'pipe'] });
    let error = '', timedOut = false;
    const kill = () => { child.kill(); };
    const timer = setTimeout(() => { timedOut = true; kill(); }, 15 * 60 * 1000);
    const cleanup = () => { clearTimeout(timer); signal.removeEventListener('abort', kill); };
    signal.addEventListener('abort', kill, { once: true });
    child.stderr.on('data', chunk => { error = (error + chunk).slice(-4000); });
    child.stdin.on('error', () => {}); child.stdin.end(input);
    child.on('error', err => { cleanup(); reject(err); });
    child.on('close', code => { cleanup(); if (signal.aborted) reject(new Error('Processing canceled.')); else if (timedOut) reject(new Error('Processing timed out.')); else if (code !== 0) reject(new Error(error || `Process exited ${code}`)); else resolve(); });
  });
}
