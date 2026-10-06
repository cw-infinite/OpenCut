import { describe, expect, it } from 'vitest';
import { checkTools, ffmpegPath, findWhisper } from '../src/main/services/tools';
import { runProcess } from '../src/main/services/process';
import { resolve } from 'node:path';

describe('local tool diagnostics', () => {
  it('executes the real FFmpeg and FFprobe binaries without a shell', async () => {
    const report = await checkTools(resolve('.test-data/missing-tools'));
    expect(report.tools.find(tool => tool.id === 'ffmpeg')?.ready).toBe(true);
    expect(report.tools.find(tool => tool.id === 'ffprobe')?.ready).toBe(true);
    expect(report.ready).toBe(false);
    expect(report.tools.find(tool => tool.id === 'model')?.ready).toBe(false);
  });
  it('reports a missing CLI instead of throwing', async () => {
    expect(await findWhisper(resolve('.test-data/absent'))).toBeUndefined();
  });
  it('surfaces FFmpeg errors and rejects invalid commands', async () => {
    await expect(runProcess(ffmpegPath, ['-opencut-invalid-flag'])).rejects.toThrow();
  });
});
