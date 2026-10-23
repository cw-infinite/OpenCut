import { test, expect, _electron as electron } from '@playwright/test';
import { resolve, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { runProcess } from '../../src/main/services/process';
import { ffmpegPath } from '../../src/main/services/tools';

test('stable first video drop, source playback, live trim, gap close, panel resize and motion templates', async () => {
  test.setTimeout(120000);
  const root = resolve('.test-data/editor-improvements-' + randomUUID()); await mkdir(root, { recursive: true });
  const video = join(root, 'sample.mp4');
  await runProcess(ffmpegPath, ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=size=320x180:duration=4', '-c:v', 'libx264', video]);
  const app = await electron.launch({ executablePath: process.env.OPENCUT_EXECUTABLE, args: process.env.OPENCUT_EXECUTABLE ? [] : ['.'], env: { ...process.env, OPENCUT_TEST_DATA: join(root, 'app') } });
  try {
    const page = await app.firstWindow(), errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    await app.evaluate(({ dialog }, path) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path] }); }, video);
    await page.evaluate(async () => { const project = await window.opencut.projects.create('Editor improvements', { width: 640, height: 360, fps: 30, sampleRate: 48000 }); await window.opencut.media.pick(project.id); });
    await page.getByRole('button', { name: 'Open projects', exact: true }).click(); await page.getByRole('button', { name: 'Open timeline', exact: true }).click();
    const asset = page.locator('.editor-asset');
    await asset.click();
    await expect(page.getByRole('heading', { name: 'Source preview', exact: true })).toBeVisible();
    await expect.poll(() => page.locator('.source-preview video').evaluate((element: HTMLVideoElement) => element.currentTime)).toBeGreaterThan(.1);
    await expect(page.locator('.timeline-clip')).toHaveCount(0);
    await page.getByRole('button', { name: 'Back to timeline', exact: true }).click();
    const surface = page.locator('.canvas-surface'), initial = (await surface.boundingBox())!;
    await asset.dragTo(page.locator('.new-track-zone.bottom'), { targetPosition: { x: 80, y: 30 } });
    await expect(page.locator('.timeline-clip.video')).toHaveCount(1);
    const samples = await surface.evaluate(async element => {
      const values: number[][] = [];
      for (let i = 0; i < 30; i++) { await new Promise(requestAnimationFrame); const rect = element.getBoundingClientRect(); values.push([rect.x, rect.y, rect.width, rect.height]); }
      return values;
    });
    for (let i = 0; i < 4; i++) expect(Math.max(...samples.map(value => value[i])) - Math.min(...samples.map(value => value[i]))).toBeLessThan(1);
    expect(samples[0][2]).toBeCloseTo(initial.width, 0);
    await expect(page.getByText('Drag preview to position selected clip', { exact: true })).toHaveCount(0);
    await page.getByTitle('Snapping', { exact: true }).click();
    const clip = page.locator('.timeline-clip.video'), before = (await clip.boundingBox())!, handle = (await clip.locator('.trim-handle.right').boundingBox())!;
    await page.mouse.move(handle.x + handle.width / 2, handle.y + 10); await page.mouse.down();
    await page.mouse.move(handle.x + handle.width / 2 - 80, handle.y + 10, { steps: 12 });
    await expect.poll(async () => (await clip.boundingBox())!.width).toBeCloseTo(before.width - 80, 0);
    await page.keyboard.press('Escape'); await page.mouse.up();
    await expect.poll(async () => (await clip.boundingBox())!.width).toBeCloseTo(before.width, 0);
    const next = (await clip.locator('.trim-handle.right').boundingBox())!;
    await page.mouse.move(next.x + next.width / 2, next.y + 10); await page.mouse.down(); await page.mouse.move(next.x + next.width / 2 - 80, next.y + 10, { steps: 12 }); await page.mouse.up();
    await expect.poll(async () => (await clip.boundingBox())!.width).toBeCloseTo(before.width - 80, 0);
    await page.getByTitle('Undo (Ctrl+Z)', { exact: true }).click(); await expect.poll(async () => (await clip.boundingBox())!.width).toBeCloseTo(before.width, 0);
    await page.getByRole('button', { name: 'Close gaps', exact: true }).click(); await expect(clip).toHaveCSS('left', '0px');
    const library = page.locator('.editor-library'), width = (await library.boundingBox())!.width, resizer = (await page.getByRole('separator', { name: 'Resize media panel' }).boundingBox())!;
    await page.mouse.move(resizer.x + 3, resizer.y + 80); await page.mouse.down(); await page.mouse.move(resizer.x + 63, resizer.y + 80, { steps: 8 }); await page.mouse.up();
    await expect.poll(async () => (await library.boundingBox())!.width).toBeGreaterThan(width + 20);
    await page.getByRole('button', { name: 'Add text', exact: true }).click();
    await expect(page.locator('.text-preset-card')).toHaveCount(6);
    await expect(page.getByLabel('Text style preset').locator('option')).toHaveCount(5);
    await page.getByRole('button', { name: 'Apply Creator captions', exact: true }).click(); await expect(page.getByLabel('animIn preset', { exact: true })).toHaveValue('focusLift');
    await page.getByLabel('Text style preset').selectOption('Bold title'); await expect(page.getByLabel('Font family')).toHaveValue('Montserrat');
    await page.locator('.inspector').evaluate(element => { element.scrollTop = 0; });
    await page.locator('.editor-library').evaluate(element => { element.scrollTop = 0; });
    await page.screenshot({ path: 'test-results/editor-improvements.png', fullPage: true });
    await expect(page.getByRole('alert')).toHaveCount(0); expect(errors).toEqual([]);
  } finally { await app.evaluate(({ app }) => app.exit(0)).catch(() => {}); await app.close().catch(() => {}); }
});
