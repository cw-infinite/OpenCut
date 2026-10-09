import { test, expect, _electron as electron } from '@playwright/test';
import { resolve, join } from 'node:path';
import { mkdir, stat } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { runProcess } from '../../src/main/services/process';
import { ffmpegPath, ffprobePath } from '../../src/main/services/tools';

test('audio controls persist, beats become markers, audio exports and fake-mic voiceover work', async () => {
  test.setTimeout(120000);
  const root = resolve('.test-data/audio-' + randomUUID()); await mkdir(root, { recursive: true });
  const source = join(root, 'beats.wav');
  await runProcess(ffmpegPath, ['-v', 'error', '-y', '-f', 'lavfi', '-i', "aevalsrc='sin(2*PI*440*t)*if(lt(mod(t,0.5),0.05),0.7,0.005)':s=48000:d=3", source]);
  const app = await electron.launch({ args: ['.', '--use-fake-device-for-media-stream'], env: { ...process.env, OPENCUT_TEST_DATA: join(root, 'app') } });
  try {
    const page = await app.firstWindow();
    await page.getByRole('button', { name: 'Open projects', exact: true }).click();
    await page.getByRole('button', { name: 'New project', exact: true }).click();
    await page.getByLabel('Project name').fill('Audio acceptance');
    await page.getByRole('button', { name: 'Create project', exact: true }).click();
    await app.evaluate(({ dialog }, path) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path] }); }, source);
    await page.locator('.import-button').click(); await expect(page.locator('.media-card')).toHaveCount(1, { timeout: 30000 });
    await page.getByRole('button', { name: 'Open timeline', exact: true }).click();
    await page.locator('.editor-asset').dblclick(); await page.locator('.timeline-clip').click();
    await page.getByLabel('Master volume').fill('0.7');
    await page.getByLabel('Fade in seconds').fill('0.2'); await page.getByLabel('Fade out seconds').fill('0.3');
    await page.getByLabel('Solo selected track').check();
    await page.getByRole('button', { name: 'Detect beat markers', exact: true }).click();
    await expect.poll(async () => page.locator('.timeline-marker').count()).toBeGreaterThanOrEqual(4);
    await page.getByLabel('Normalize loudness').check(); await page.getByLabel('Reduce audio noise').check();
    await page.getByRole('button', { name: 'Export', exact: true }).click();
    for (const format of ['wav', 'mp3', 'aac']) {
      const output = join(root, 'mix.' + format);
      await app.evaluate(({ dialog }, path) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: path }); }, output);
      await page.getByLabel('Format', { exact: true }).selectOption(format);
      await page.getByRole('button', { name: 'Export audio', exact: true }).click();
      await expect(page.getByText('Export complete', { exact: true })).toBeVisible({ timeout: 30000 });
      const data = JSON.parse(await runProcess(ffprobePath, ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', output]));
      expect(data.streams).toHaveLength(1); expect(data.streams[0].codec_type).toBe('audio');
      const pcm = join(root, 'decoded-' + format + '.pcm');
      await runProcess(ffmpegPath, ['-v', 'error', '-y', '-i', output, '-ac', '1', '-ar', '48000', '-f', 's16le', pcm]);
      expect(Math.abs((await stat(pcm)).size / 96000 - 3)).toBeLessThan(.15);
    }
    await page.getByRole('button', { name: 'Close export', exact: true }).click();
    await page.getByRole('button', { name: 'Record voiceover', exact: true }).click();
    await expect(page.getByRole('button', { name: /Stop recording · [1-9]/ })).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: /Stop recording/ }).click();
    await expect(page.locator('.timeline-clip')).toHaveCount(2, { timeout: 30000 });
    await expect(page.locator('.timeline-clip').filter({ hasText: 'voiceover-' })).toHaveCount(1);
    await expect(page.getByRole('alert')).toHaveCount(0);
    await page.getByRole('button', { name: 'Source browser', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Media library' })).toBeVisible();
    const saved = await page.evaluate(async () => (await window.opencut.projects.open((await window.opencut.projects.last())!)).project);
    expect(saved.masterVolume).toBe(.7); expect(saved.tracks[0].solo).toBe(true); expect(saved.markers.length).toBeGreaterThanOrEqual(4);
    await page.screenshot({ path: 'test-results/audio-recording.png', fullPage: true });
  } finally { await app.evaluate(({ app }) => app.exit(0)).catch(() => {}); await app.close().catch(() => {}); }
});
