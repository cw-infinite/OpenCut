import { test, expect, _electron as electron } from '@playwright/test';
import { resolve, join } from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { runProcess } from '../../src/main/services/process';
import { ffmpegPath } from '../../src/main/services/tools';

test('real offline speech captions, edit/merge/split, SRT interchange and persistence', async () => {
  test.setTimeout(120000);
  const root = resolve('.test-data/captions-' + randomUUID()); await mkdir(root, { recursive: true });
  const source = join(root, 'speech.wav');
  await runProcess('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `Add-Type -AssemblyName System.Speech; $voice = New-Object System.Speech.Synthesis.SpeechSynthesizer; $voice.SetOutputToWaveFile('${source.replace(/'/g, "''")}'); $voice.Speak('Welcome to Open Cut. Make your story clear with captions.'); $voice.Dispose()`], 30000);
  const app = await electron.launch({ executablePath: process.env.OPENCUT_EXECUTABLE, args: process.env.OPENCUT_EXECUTABLE ? [] : ['.'], env: { ...process.env, OPENCUT_TEST_DATA: join(root, 'app') } });
  try {
    const page = await app.firstWindow();
    await page.getByRole('button', { name: 'Open projects', exact: true }).click();
    await page.getByRole('button', { name: 'New project', exact: true }).click();
    await page.getByLabel('Project name').fill('Caption acceptance');
    await page.getByRole('button', { name: 'Create project', exact: true }).click();
    await app.evaluate(({ dialog }, path) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path] }); }, source);
    await page.locator('.import-button').click(); await expect(page.locator('.media-card')).toHaveCount(1, { timeout: 30000 });
    await page.getByRole('button', { name: 'Open timeline', exact: true }).click();
    await page.locator('.editor-asset').dblclick(); await page.locator('.timeline-clip').click();
    await page.getByRole('button', { name: 'Captions', exact: true }).click();
    const models = await page.evaluate(() => window.opencut.captions.models());
    if (!models['small.en']) {
      await page.getByLabel('Speech model').selectOption('small.en');
      await expect(page.getByRole('button', { name: 'Download speech model', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Generate captions', exact: true })).toBeDisabled();
      await page.getByLabel('Speech model').selectOption('base.en');
    }
    await page.getByLabel('Speech source').selectOption('clip');
    await page.getByRole('button', { name: 'Generate captions', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Added', { timeout: 60000 });
    await expect(page.getByLabel('Caption 1 text')).toHaveValue(/Welcome/i);
    expect(await page.locator('.caption-row').count()).toBeGreaterThanOrEqual(2);
    await page.getByLabel('Find caption text').fill('OpenCut'); await page.getByLabel('Replace caption text').fill('OpenCut Studio');
    await page.getByRole('button', { name: 'Replace all', exact: true }).click();
    await expect(page.getByLabel('Caption 1 text')).toHaveValue(/OpenCut Studio/);
    await page.getByRole('button', { name: 'Merge next', exact: true }).first().click();
    await page.getByRole('button', { name: 'Split caption', exact: true }).first().click();
    await page.getByLabel('Caption position').selectOption('0.15'); await page.getByRole('button', { name: 'Restyle all', exact: true }).click();
    const output = join(root, 'captions.srt');
    await app.evaluate(({ dialog }, path) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: path }); }, output);
    await page.getByRole('button', { name: 'Save SRT', exact: true }).click();
    await expect.poll(async () => readFile(output, 'utf8').catch(() => '')).toContain('Studio');
    const imported = join(root, 'import.srt'); await writeFile(imported, '1\n00:00:06,000 --> 00:00:07,000\nImported subtitle\n');
    await app.evaluate(({ dialog }, path) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path] }); }, imported);
    await page.getByRole('button', { name: 'Import SRT', exact: true }).click();
    await expect(page.locator('.caption-row textarea').last()).toHaveValue('Imported subtitle');
    await expect(page.getByRole('alert')).toHaveCount(0);
    await page.screenshot({ path: 'test-results/captions.png', fullPage: true });
    await page.getByRole('button', { name: 'Close captions', exact: true }).click();
    const video = join(root, 'captioned.mp4');
    await app.evaluate(({ dialog }, path) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: path }); }, video);
    await page.getByRole('button', { name: 'Export', exact: true }).click();
    await page.getByLabel('Resolution', { exact: true }).selectOption('480');
    await page.getByLabel('Encoder', { exact: true }).selectOption('software');
    await page.getByRole('button', { name: 'Export MP4', exact: true }).click();
    await expect(page.getByText('Export complete', { exact: true })).toBeVisible({ timeout: 60000 });
    for (const second of [1, 5.5, 6.5]) {
      const pixels = join(root, `frame-${second}.rgb`);
      await runProcess(ffmpegPath, ['-v', 'error', '-y', '-ss', String(second), '-i', video, '-frames:v', '1', '-pix_fmt', 'rgb24', '-f', 'rawvideo', pixels]);
      const frame = await readFile(pixels); let bright = 0;
      for (let i = 0; i < frame.length; i += 3) if (frame[i] > 180 && frame[i + 1] > 180 && frame[i + 2] > 180) bright++;
      if (second === 5.5) expect(bright).toBe(0); else expect(bright).toBeGreaterThan(100);
    }
    await page.getByRole('button', { name: 'Close export', exact: true }).click();
    await page.getByRole('button', { name: 'Source browser', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Media library' })).toBeVisible();
    const saved = await page.evaluate(async () => (await window.opencut.projects.open((await window.opencut.projects.last())!)).project);
    const captions = saved.tracks.flatMap(track => track.clips).filter(clip => clip.type === 'text');
    expect(captions.length).toBeGreaterThanOrEqual(3); expect(captions.every(clip => clip.transform.y.value === .15)).toBe(true);
    const timing = await page.evaluate(async project => {
      const shifted = structuredClone(project), clip = shifted.tracks.flatMap(track => track.clips).find(clip => clip.type === 'media')!;
      if (clip.type !== 'media') throw new Error('Missing source');
      clip.start = 2e6; clip.speed = 2; clip.duration = Math.floor((clip.sourceOut - clip.sourceIn) / 2); clip.sourceOut = clip.sourceIn + clip.duration * 2;
      await window.opencut.projects.saveEdit(shifted);
      try { return { words: await window.opencut.captions.generate({ projectId: shifted.id, clipId: clip.id }), end: clip.start + clip.duration }; }
      finally { await window.opencut.projects.saveEdit(project); }
    }, saved);
    expect(timing.words.length).toBeGreaterThan(3);
    expect(timing.words.every(word => word.start >= 2e6 && word.end <= timing.end)).toBe(true);
    const cancellation = await page.evaluate(async projectId => {
      const job = window.opencut.captions.generate({ projectId }).then(() => 'completed', error => String(error));
      await window.opencut.captions.cancel(); return job;
    }, saved.id);
    expect(cancellation).toContain('cancelled');
  } finally { await app.evaluate(({ app }) => app.exit(0)).catch(() => {}); await app.close().catch(() => {}); }
});
