import { test, expect, _electron as electron } from '@playwright/test';
import { resolve, join } from 'node:path';
import { mkdir, readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { runProcess } from '../../src/main/services/process';
import { ffmpegPath } from '../../src/main/services/tools';

test('organized video properties, horizontal/vertical mirror toggles, undo, persistence and mirrored export', async () => {
  test.setTimeout(120000);
  const root = resolve('.test-data/video-inspector-' + randomUUID()); await mkdir(root, { recursive: true });
  const video = join(root, 'quadrants.mp4');
  await runProcess(ffmpegPath, ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=red:s=320x180:d=1,drawbox=x=160:y=0:w=160:h=90:color=blue:t=fill,drawbox=x=0:y=90:w=160:h=90:color=green:t=fill,drawbox=x=160:y=90:w=160:h=90:color=yellow:t=fill', '-c:v', 'libx264', video]);
  const app = await electron.launch({ executablePath: process.env.OPENCUT_EXECUTABLE, args: process.env.OPENCUT_EXECUTABLE ? [] : ['.'], env: { ...process.env, OPENCUT_TEST_DATA: join(root, 'app') } });
  try {
    const page = await app.firstWindow();
    await app.evaluate(({ dialog }, path) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path] }); }, video);
    await page.evaluate(async () => { const project = await window.opencut.projects.create('Video properties', { width: 320, height: 180, fps: 30, sampleRate: 48000 }); await window.opencut.media.pick(project.id); });
    await page.getByRole('button', { name: 'Open projects', exact: true }).click(); await page.getByRole('button', { name: 'Open timeline', exact: true }).click();
    await page.locator('.editor-asset').dblclick(); await expect(page.locator('.timeline-clip')).toHaveCount(1);
    await expect(page.getByRole('heading', { name: 'Video properties', exact: true })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Video property sections' }).locator('button')).toHaveCount(6);
    await page.getByLabel('Preview quality').selectOption('1');
    const sample = () => page.locator('.canvas-surface canvas').evaluate(element => {
      const canvas = element as HTMLCanvasElement; return Array.from(canvas.getContext('2d')!.getImageData(Math.round(canvas.width * .2), Math.round(canvas.height * .25), 1, 1).data).slice(0, 3);
    });
    await expect.poll(async () => (await sample())[0]).toBeGreaterThan(200);
    await page.getByRole('navigation', { name: 'Video property sections' }).getByRole('button', { name: 'Framing', exact: true }).click();
    await expect(page.getByLabel('Crop left', { exact: true })).toBeVisible();
    const mirror = page.getByRole('button', { name: /^Mirror left \/ right/ }), vertical = page.getByRole('button', { name: /^Flip top \/ bottom/ });
    await mirror.click(); await expect(mirror).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(async () => (await sample())[2]).toBeGreaterThan(200);
    await vertical.click(); await expect(vertical).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(async () => (await sample())[0]).toBeGreaterThan(200); await expect.poll(async () => (await sample())[1]).toBeGreaterThan(200);
    await page.getByTitle('Undo (Ctrl+Z)', { exact: true }).click(); await page.locator('.timeline-clip').click();
    await expect(vertical).toHaveAttribute('aria-pressed', 'false'); await expect(mirror).toHaveAttribute('aria-pressed', 'true');
    await mirror.click(); await expect(mirror).toHaveAttribute('aria-pressed', 'false'); await expect.poll(async () => (await sample())[0]).toBeGreaterThan(200);
    await page.getByTitle('Undo (Ctrl+Z)', { exact: true }).click(); await page.locator('.timeline-clip').click();
    await expect(mirror).toHaveAttribute('aria-pressed', 'true'); await expect.poll(async () => (await sample())[2]).toBeGreaterThan(200);
    await page.locator('.inspector').evaluate(element => { element.scrollTop = 0; }); await page.screenshot({ path: 'test-results/video-properties.png', fullPage: true });
    const output = join(root, 'mirrored.mp4');
    await app.evaluate(({ dialog }, path) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: path }); }, output);
    await page.getByRole('button', { name: 'Export', exact: true }).click(); await page.getByLabel('Encoder', { exact: true }).selectOption('software');
    await page.getByRole('button', { name: 'Export MP4', exact: true }).click(); await expect(page.getByText('Export complete', { exact: true })).toBeVisible({ timeout: 60000 });
    const raw = join(root, 'mirrored.rgb'); await runProcess(ffmpegPath, ['-v', 'error', '-y', '-ss', '0.5', '-i', output, '-vf', 'scale=320:180', '-frames:v', '1', '-pix_fmt', 'rgb24', '-f', 'rawvideo', raw]);
    const bytes = await readFile(raw), pixel = (45 * 320 + 64) * 3; expect(bytes[pixel + 2]).toBeGreaterThan(200); expect(bytes[pixel]).toBeLessThan(30);
    await page.getByRole('button', { name: 'Close export', exact: true }).click(); await page.getByRole('button', { name: 'Source browser', exact: true }).click();
    const saved = await page.evaluate(async () => (await window.opencut.projects.open((await window.opencut.projects.last())!)).project);
    expect(saved.tracks[0].clips[0].effects).toContainEqual({ type: 'flip', enabled: true, params: { x: 1, y: 0 } });
    await expect(page.getByRole('alert')).toHaveCount(0);
  } finally { await app.evaluate(({ app }) => app.exit(0)).catch(() => {}); await app.close().catch(() => {}); }
});
