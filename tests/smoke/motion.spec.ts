import { test, expect, _electron as electron } from '@playwright/test';
import { resolve, join } from 'node:path';
import { mkdir, readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { fixtures } from '../../scripts/fixtures';
import { runProcess } from '../../src/main/services/process';
import { ffmpegPath, ffprobePath } from '../../src/main/services/tools';

test('speed exports preserve duration and pitch; dissolve export matches its preview', async () => {
  test.setTimeout(180000);
  const media = await fixtures(), root = resolve('.test-data/motion-' + randomUUID());
  await mkdir(root, { recursive: true });
  const app = await electron.launch({ args: ['.'], env: { ...process.env, OPENCUT_TEST_DATA: join(root, 'app') } });
  try {
    const page = await app.firstWindow();
    await page.getByRole('button', { name: 'Open projects', exact: true }).click();
    await page.getByRole('button', { name: 'New project', exact: true }).click();
    await page.getByLabel('Project name').fill('Motion acceptance');
    await page.getByRole('button', { name: 'Create project', exact: true }).click();
    await app.evaluate(({ dialog }, path) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path] }); }, media.video);
    await page.locator('.import-button').click();
    await expect(page.locator('.media-card')).toHaveCount(1, { timeout: 30000 });
    await page.getByRole('button', { name: 'Open timeline', exact: true }).click();
    await page.locator('.editor-asset').dblclick();
    await page.locator('.timeline-clip').click();
    const render = async (name: string, duration: number) => {
      const output = join(root, name + '.mp4');
      await app.evaluate(({ dialog }, path) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: path }); }, output);
      await page.getByRole('button', { name: 'Export', exact: true }).click();
      await page.getByLabel('Resolution', { exact: true }).selectOption('720');
      await page.getByLabel('Encoder', { exact: true }).selectOption('software');
      await page.getByRole('button', { name: 'Export MP4', exact: true }).click();
      await expect(page.getByText('Export complete', { exact: true })).toBeVisible({ timeout: 60000 });
      const data = JSON.parse(await runProcess(ffprobePath, ['-v', 'error', '-show_format', '-of', 'json', output]));
      expect(Number(data.format.duration)).toBeCloseTo(duration, 1);
      await page.getByRole('button', { name: 'Close export', exact: true }).click();
      return output;
    };
    for (const speed of [.5, 2]) {
      await page.getByLabel('Playback speed').fill(String(speed));
      const output = await render('speed-' + speed, 2 / speed), raw = join(root, 'tone.pcm');
      await runProcess(ffmpegPath, ['-v', 'error', '-y', '-i', output, '-vn', '-ac', '1', '-ar', '48000', '-f', 's16le', raw]);
      const bytes = await readFile(raw), count = bytes.length / 2, start = Math.floor(count * .2), end = Math.floor(count * .7);
      let crossings = 0;
      for (let i = start + 1; i < end; i++) if (bytes.readInt16LE((i - 1) * 2) <= 0 && bytes.readInt16LE(i * 2) > 0) crossings++;
      expect(crossings * 48000 / (end - start)).toBeCloseTo(440, -1);
    }
    await page.getByLabel('Playback speed').fill('1');
    await page.locator('.timeline-clip').click(); await page.keyboard.press('Control+d');
    await page.getByLabel('Transition type').selectOption('dissolve');
    await expect(page.getByRole('alert')).toHaveCount(0);
    await page.getByLabel('Preview quality').selectOption('1');
    await page.locator('.ruler').click({ position: { x: 140, y: 10 } });
    await expect(page.locator('canvas')).toHaveAttribute('data-render-time', '1750000');
    const reference = await page.locator('canvas').evaluate(element => {
      const canvas = element as HTMLCanvasElement, small = document.createElement('canvas'); small.width = 1280; small.height = 720;
      const ctx = small.getContext('2d')!; ctx.drawImage(canvas, 0, 0, 1280, 720);
      const data = ctx.getImageData(0, 0, 1280, 720).data, samples: { index: number; rgb: number[] }[] = [];
      for (let y = 25; y < 720; y += 50) for (let x = 25; x < 1280; x += 50) { const index = (y * 1280 + x) * 4; samples.push({ index, rgb: Array.from(data.slice(index, index + 3)) }); }
      return samples;
    });
    await page.screenshot({ path: 'test-results/dissolve.png', fullPage: true });
    const output = await render('dissolve', 3.5), raw = join(root, 'dissolve.rgba');
    await runProcess(ffmpegPath, ['-v', 'error', '-y', '-ss', '1.75', '-i', output, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgba', raw]);
    const decoded = await readFile(raw);
    const error = reference.reduce((sum, sample) => sum + sample.rgb.reduce((subtotal, value, channel) => subtotal + Math.abs(value - decoded[sample.index + channel]), 0), 0) / (reference.length * 3);
    expect(error).toBeLessThan(12);
    await page.getByRole('button', { name: 'Reverse clip', exact: true }).click();
    await expect(page.locator('.timeline-clip').last()).toContainText('reverse-', { timeout: 30000 });
    await expect(page.getByRole('alert')).toHaveCount(0);
    await page.keyboard.press('Control+z');
    await expect(page.locator('.timeline-clip').last()).toContainText('variable-frame-rate');
    await page.locator('.timeline-clip').last().click();
    await page.getByRole('button', { name: 'Freeze frame', exact: true }).click();
    await expect(page.locator('.track-lane')).toHaveCount(2, { timeout: 30000 });
    await expect(page.locator('.timeline-clip')).toHaveCount(3);
    await expect(page.getByRole('alert')).toHaveCount(0);
    await page.screenshot({ path: 'test-results/freeze-frame.png', fullPage: true });
    await page.keyboard.press('Control+z');
    await expect(page.locator('.timeline-clip')).toHaveCount(2);
  } finally { await app.evaluate(({ app }) => app.exit(0)).catch(() => {}); await app.close().catch(() => {}); }
});
