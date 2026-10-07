import { test, expect, _electron as electron } from '@playwright/test';
import { resolve, join } from 'node:path';
import { mkdir, readFile, readdir, stat } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { fixtures } from '../../scripts/fixtures';
import { runProcess } from '../../src/main/services/process';
import { ffmpegPath, ffprobePath } from '../../src/main/services/tools';

test('export a real two-clip MP4 at 720p and 1080p, then cancel without partial output', async () => {
  test.setTimeout(180000);
  const media = await fixtures(), root = resolve('.test-data/export-' + randomUUID());
  await mkdir(root, { recursive: true });
  const app = await electron.launch({ args: ['.'], env: { ...process.env, OPENCUT_TEST_DATA: join(root, 'app') } });
  try {
    const page = await app.firstWindow();
    page.on('console', message => { if (message.type() === 'error') console.error(message.text()); });
    await page.getByRole('button', { name: 'Open projects', exact: true }).click();
    await page.getByRole('button', { name: 'New project', exact: true }).click();
    await page.getByLabel('Project name').fill('Export acceptance');
    await page.getByRole('button', { name: 'Create project', exact: true }).click();
    await app.evaluate(({ dialog }, path) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path] }); }, media.video);
    await page.locator('.import-button').click();
    await expect(page.locator('.media-card')).toHaveCount(1, { timeout: 30000 });
    await page.getByRole('button', { name: 'Open timeline', exact: true }).click();
    await page.locator('.editor-asset').dblclick();
    await page.locator('.timeline-clip').click();
    await page.keyboard.press('Control+d');
    await expect(page.locator('.timeline-clip')).toHaveCount(2);
    await page.getByLabel('Preview quality').selectOption('1');
    await expect(page.locator('canvas')).toHaveAttribute('data-render-time', '2000000');
    await page.screenshot({ path: 'test-results/pre-animation.png', fullPage: true });
    await expect.poll(async () => page.locator('canvas').evaluate(canvas => (canvas as HTMLCanvasElement).getContext('2d')!.getImageData(100, 100, 1, 1).data[0])).toBeGreaterThan(100);
    await page.getByLabel('Animated property').selectOption('scale');
    await page.getByRole('button', { name: 'Add keyframe', exact: true }).click();
    await page.getByLabel('Scale', { exact: true }).fill('0.5');
    await page.locator('.ruler').click({ position: { x: 240, y: 10 } });
    await page.getByRole('button', { name: 'Add keyframe', exact: true }).click();
    await page.getByLabel('Scale', { exact: true }).fill('1');
    await page.locator('.ruler').click({ position: { x: 200, y: 10 } });
    await expect(page.getByLabel('Scale', { exact: true })).toHaveValue('0.75');
    await expect(page.locator('canvas')).toHaveAttribute('data-render-time', '2500000');
    await expect.poll(async () => page.locator('canvas').evaluate(canvas => (canvas as HTMLCanvasElement).getContext('2d')!.getImageData(10, 10, 1, 1).data[0])).toBe(8);
    const diamond = page.getByRole('button', { name: 'Keyframe at 1.000 seconds', exact: true });
    const box = (await diamond.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down(); await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2); await page.mouse.up();
    await expect(page.getByRole('button', { name: 'Keyframe at 1.500 seconds', exact: true })).toBeVisible();
    await page.keyboard.press('Control+z');
    await expect(page.getByRole('button', { name: 'Keyframe at 1.000 seconds', exact: true })).toBeVisible();
    await page.locator('.timeline-clip').last().click();
    await expect(page.getByLabel('Scale', { exact: true })).toHaveValue('0.75');
    await page.getByLabel('Animated property').selectOption('scale');
    await page.getByLabel('Keyframe easing at 0').selectOption('custom');
    await expect(page.getByLabel('Bezier 0 at 0')).toHaveValue('0.42');
    await page.getByLabel('Keyframe easing at 0').selectOption('linear');
    await page.locator('.keyframe-editor').scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/keyframes.png', fullPage: true });
    const reference = await page.locator('canvas').evaluate(element => {
      const canvas = element as HTMLCanvasElement, data = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
      const samples: { index: number; rgb: number[] }[] = [];
      for (let y = 30; y < canvas.height; y += 60) for (let x = 30; x < canvas.width; x += 60) {
        const index = (y * canvas.width + x) * 4; samples.push({ index, rgb: Array.from(data.slice(index, index + 3)) });
      }
      return samples;
    });
    await page.getByRole('button', { name: 'Export', exact: true }).click();
    await page.screenshot({ path: 'test-results/export-dialog.png', fullPage: true });
    for (const resolution of [720, 1080]) {
      const output = join(root, `result-${resolution}.mp4`);
      await app.evaluate(({ dialog }, path) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: path }); }, output);
      await page.getByLabel('Resolution', { exact: true }).selectOption(String(resolution));
      await page.getByLabel('Encoder', { exact: true }).selectOption(resolution === 720 ? 'software' : 'auto');
      await page.getByRole('button', { name: 'Export MP4', exact: true }).click();
      await expect(page.getByText('Export complete', { exact: true })).toBeVisible({ timeout: 60000 });
      expect((await stat(output)).size).toBeGreaterThan(10000);
      const data = JSON.parse(await runProcess(ffprobePath, ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', output]));
      const video = data.streams.find((stream: { codec_type: string }) => stream.codec_type === 'video');
      const audio = data.streams.find((stream: { codec_type: string }) => stream.codec_type === 'audio');
      expect(video.height).toBe(resolution); expect(video.pix_fmt).toBe('yuv420p'); expect(video.codec_name).toBe('h264');
      expect(audio.codec_name).toBe('aac'); expect(Math.abs(Number(data.format.duration) - 4)).toBeLessThanOrEqual(1 / 30);
      expect(Math.abs(Number(video.duration) - Number(audio.duration))).toBeLessThanOrEqual(1 / 30);
      if (resolution === 1080) {
        const raw = join(root, 'frame-2.5s.rgba');
        await runProcess(ffmpegPath, ['-v', 'error', '-y', '-ss', '2.5', '-i', output, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgba', raw]);
        const decoded = await readFile(raw);
        const meanError = reference.reduce((sum, sample) => sum + sample.rgb.reduce((subtotal, value, channel) => subtotal + Math.abs(value - decoded[sample.index + channel]), 0), 0) / (reference.length * 3);
        expect(meanError).toBeLessThan(8);
      }
    }
    await page.screenshot({ path: 'test-results/export-complete.png', fullPage: true });
    const canceled = join(root, 'cancel-test.mp4');
    await app.evaluate(({ dialog }, path) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: path }); }, canceled);
    await page.getByRole('button', { name: 'Export MP4', exact: true }).click();
    await page.getByRole('button', { name: 'Cancel export', exact: true }).click();
    await expect(page.getByText('Export canceled', { exact: true })).toBeVisible({ timeout: 15000 });
    await expect.poll(async () => (await readdir(root)).filter(name => name.includes('partial') || name === 'cancel-test.mp4')).toEqual([]);
  } finally {
    await app.evaluate(({ app }) => app.exit(0)).catch(() => {});
    await app.close().catch(() => {});
  }
});
