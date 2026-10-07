import { test, expect, _electron as electron } from '@playwright/test';
import { resolve, join } from 'node:path';
import { mkdir, readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { runProcess } from '../../src/main/services/process';
import { ffmpegPath } from '../../src/main/services/tools';

test('styled titles, canvas editing, typewriter and animated text export match preview', async () => {
  test.setTimeout(180000);
  const root = resolve('.test-data/text-' + randomUUID()); await mkdir(root, { recursive: true });
  const app = await electron.launch({ args: ['.'], env: { ...process.env, OPENCUT_TEST_DATA: join(root, 'app') } });
  try {
    const page = await app.firstWindow(); page.on('console', message => { if (message.type() === 'error' || message.text().startsWith('EXPORT:')) console.log(message.text()); });
    await page.evaluate(() => window.opencut.export.onProgress(progress => console.log('EXPORT:' + JSON.stringify(progress))));
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    await page.getByRole('button', { name: 'Open projects', exact: true }).click();
    await page.getByRole('button', { name: 'New project', exact: true }).click();
    await page.getByLabel('Project name').fill('Title acceptance');
    await page.getByRole('button', { name: 'Create project', exact: true }).click();
    await page.getByRole('button', { name: 'Open timeline', exact: true }).click();
    await page.getByRole('button', { name: 'Add text', exact: true }).click();
    await page.getByLabel('Text content', { exact: true }).fill('OpenCut');
    await page.getByLabel('Text duration', { exact: true }).fill('2');
    await page.getByLabel('Font family').selectOption('Montserrat');
    await page.getByLabel('Preview quality').selectOption('1');
    const canvasBounds = (await page.locator('canvas').boundingBox())!;
    await page.locator('canvas').dblclick({ position: { x: canvasBounds.width * .4, y: canvasBounds.height * .5 } });
    await page.getByLabel('Edit text on canvas').fill('Create with OpenCut');
    await page.getByRole('button', { name: 'Apply text', exact: true }).click();
    await expect(page.getByLabel('Text content', { exact: true })).toHaveValue('Create with OpenCut');
    await page.getByLabel('animIn preset').selectOption('typewriter');
    await page.getByLabel('animIn granularity').selectOption('char');
    const lightPixels = () => page.locator('canvas').evaluate(element => {
      const canvas = element as HTMLCanvasElement, bytes = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data; let count = 0;
      for (let i = 0; i < bytes.length; i += 4) if (bytes[i] > 100) count++; return count;
    });
    await expect.poll(lightPixels).toBe(0);
    await page.locator('.ruler').click({ position: { x: 80, y: 10 } });
    await expect.poll(lightPixels).toBeGreaterThan(1000);
    await page.getByLabel('animIn preset').selectOption('pop');
    await page.getByLabel('animOut preset').selectOption('slideDown');
    await page.getByLabel('animLoop preset').selectOption('pulse');
    for (const effect of ['stroke', 'shadow', 'background']) await page.getByLabel(`Enable text ${effect}`).check();
    await page.getByLabel('Saved style name').fill('My title');
    await page.getByRole('button', { name: 'Save style', exact: true }).click();
    await page.locator('.ruler').click({ position: { x: 64, y: 10 } });
    await expect(page.locator('canvas')).toHaveAttribute('data-render-time', '800000');
    await expect.poll(lightPixels).toBeGreaterThan(1000);
    await expect(page.getByRole('alert')).toHaveCount(0);
    const reference = await page.locator('canvas').evaluate(element => {
      const canvas = element as HTMLCanvasElement, data = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
      const samples: { index: number; rgb: number[] }[] = [];
      for (let y = 200; y < 880; y += 6) for (let x = 100; x < 1820; x += 6) {
        const index = (y * canvas.width + x) * 4; if (data[index] > 70) samples.push({ index, rgb: Array.from(data.slice(index, index + 3)) });
      }
      return samples;
    });
    expect(reference.length).toBeGreaterThan(100);
    await page.screenshot({ path: 'test-results/text-title.png', fullPage: true });
    const output = join(root, 'title.mp4');
    await app.evaluate(({ dialog }, path) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: path }); }, output);
    await page.getByRole('button', { name: 'Export', exact: true }).click();
    await page.getByLabel('Resolution', { exact: true }).selectOption('1080');
    await page.getByRole('button', { name: 'Export MP4', exact: true }).click();
    await expect(page.getByText('Export complete', { exact: true })).toBeVisible({ timeout: 60000 }).catch(async error => { console.log(await page.locator('[role=dialog]').innerText()); await page.screenshot({ path: 'test-results/text-export-error.png' }); throw error; });
    const raw = join(root, 'title.rgba');
    await runProcess(ffmpegPath, ['-v', 'error', '-y', '-ss', '0.8', '-i', output, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgba', raw]);
    const decoded = await readFile(raw);
    const error = reference.reduce((sum, sample) => sum + sample.rgb.reduce((subtotal, value, channel) => subtotal + Math.abs(value - decoded[sample.index + channel]), 0), 0) / (reference.length * 3);
    expect(error).toBeLessThan(15); expect(errors).toEqual([]);
  } finally { await app.evaluate(({ app }) => app.exit(0)).catch(() => {}); await app.close().catch(() => {}); }
});
