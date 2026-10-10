import { test, expect, _electron as electron } from '@playwright/test';
import { resolve, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { makeTextClip } from '../../src/renderer/engine/text';
import { makeMediaClip, makeTrack } from '../../src/renderer/engine/timeline';
import { runProcess } from '../../src/main/services/process';
import { ffmpegPath } from '../../src/main/services/tools';

test('smart reframe follows a subject into a portrait canvas and exports a centered subject', async () => {
  test.setTimeout(120000);
  const root = resolve('.test-data/reframe-' + randomUUID()); await mkdir(root, { recursive: true });
  const raw = join(root, 'motion.rgb'), source = join(root, 'motion.mp4'), width = 320, height = 240;
  const data = Buffer.alloc(width * height * 3 * 60, 20);
  for (let frame = 0; frame < 60; frame++) for (let y = 100; y < 120; y++) for (let dx = 0; dx < 20; dx++) {
    const at = ((frame * height + y) * width + 100 + frame + dx) * 3;
    data[at] = 230; data[at + 1] = (dx + y) % 2 ? 160 : 40; data[at + 2] = 30;
  }
  await writeFile(raw, data);
  await runProcess(ffmpegPath, ['-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', '320x240', '-r', '30', '-i', raw, '-c:v', 'libx264', '-crf', '12', '-pix_fmt', 'yuv420p', source]);
  const app = await electron.launch({ executablePath: process.env.OPENCUT_EXECUTABLE, args: process.env.OPENCUT_EXECUTABLE ? [] : ['.'], env: { ...process.env, OPENCUT_TEST_DATA: join(root, 'app') } });
  try {
    const page = await app.firstWindow();
    await app.evaluate(({ dialog }, path) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path] }); }, source);
    const project = await page.evaluate(async () => {
      const project = await window.opencut.projects.create('Tracking acceptance', { width: 240, height: 320, fps: 30, sampleRate: 48000 });
      return window.opencut.media.pick(project.id);
    });
    const asset = Object.values(project.media)[0], video = makeTrack('video', 'video', 'Video'), text = makeTrack('text', 'text', 'Overlay');
    video.clips = [makeMediaClip('source', asset, video.id, 0)];
    const overlay = makeTextClip('overlay', text.id, 0); overlay.content = 'Follow'; overlay.duration = 2e6; overlay.transform.x.value = .25; overlay.transform.y.value = .25;
    text.clips = [overlay]; project.tracks = [video, text];
    await page.evaluate(project => window.opencut.projects.saveEdit(project), project);
    await page.getByRole('button', { name: 'Open projects', exact: true }).click(); await page.getByRole('button', { name: 'Open timeline', exact: true }).click();
    await page.locator('[data-clip-id="source"]').click({ position: { x: 30, y: 30 } });
    await page.getByText('Motion tracking', { exact: true }).click();
    await page.getByLabel('Tracking purpose').selectOption('reframe');
    const canvas = page.getByLabel('Tracking subject frame');
    const prepare = async () => {
      await page.getByRole('button', { name: 'Load tracking frame', exact: true }).click(); await expect(canvas).toBeVisible();
      await expect(page.getByRole('button', { name: 'Load tracking frame', exact: true })).toBeEnabled();
      const box = (await canvas.boundingBox())!; await canvas.click({ position: { x: box.width * 110 / 320, y: box.height * 110 / 240 } });
    };
    await prepare(); await page.getByRole('button', { name: 'Track movement', exact: true }).click(); await page.getByRole('button', { name: 'Cancel tracking', exact: true }).click();
    await expect(canvas).toHaveCount(0);
    await prepare(); await page.getByRole('button', { name: 'Track movement', exact: true }).click();
    await expect(page.getByText(/Tracking complete/)).toBeVisible({ timeout: 30000 });
    await page.screenshot({ path: 'test-results/smart-reframe.png', fullPage: true });
    await page.getByRole('button', { name: 'Apply smart reframe', exact: true }).click();
    await expect(page.getByRole('alert')).toHaveCount(0);
    await page.keyboard.press('Control+z'); await page.keyboard.press('Control+Shift+z');
    await page.getByRole('button', { name: 'Source browser', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Media library' })).toBeVisible();
    const saved = await page.evaluate(async id => (await window.opencut.projects.open(id)).project, project.id);
    const keys = saved.tracks[0].clips[0].transform.x.keyframes;
    expect(keys.length).toBe(21); expect(keys.at(-1)!.value).toBeLessThan(keys[0].value);
    expect(saved.tracks[0].clips[0]).toMatchObject({ fit: 'fill' });
    await page.getByRole('button', { name: 'Open timeline', exact: true }).click();
    const output = join(root, 'tracked.mp4');
    await app.evaluate(({ dialog }, path) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: path }); }, output);
    await page.getByRole('button', { name: 'Export', exact: true }).click();
    await page.getByLabel('Resolution', { exact: true }).selectOption('480'); await page.getByLabel('Encoder', { exact: true }).selectOption('software');
    await page.getByRole('button', { name: 'Export MP4', exact: true }).click(); await expect(page.getByText('Export complete', { exact: true })).toBeVisible({ timeout: 60000 });
    const centers: number[] = [];
    for (const time of [0, 1.8]) {
      const pixels = join(root, `frame-${time}.rgb`);
      await runProcess(ffmpegPath, ['-v', 'error', '-y', '-ss', String(time), '-i', output, '-frames:v', '1', '-pix_fmt', 'rgb24', '-f', 'rawvideo', pixels]);
      const rgb = await readFile(pixels); let sum = 0, n = 0;
      for (let y = 0; y < 640; y++) for (let x = 0; x < 480; x++) { const at = (y * 480 + x) * 3; if (rgb[at] > 180 && rgb[at + 1] < 190 && rgb[at + 2] < 80) { sum += x; n++; } }
      expect(n).toBeGreaterThan(50); centers.push(sum / n);
    }
    expect(Math.abs(centers[1] - centers[0])).toBeLessThan(5);
    expect(centers[0]).toBeGreaterThan(230); expect(centers[0]).toBeLessThan(250);
  } finally { await app.evaluate(({ app }) => app.exit(0)).catch(() => {}); await app.close().catch(() => {}); }
});
