import { test, expect, _electron as electron } from '@playwright/test';
import { resolve, join } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { runProcess } from '../../src/main/services/process';
import { ffmpegPath } from '../../src/main/services/tools';
import { makeMediaClip } from '../../src/renderer/engine/timeline';

test('scrubs video while holding ruler and playhead, and enlarges portrait preview', async () => {
  const root = resolve('.test-data/scrubbing-' + randomUUID()); await mkdir(root, { recursive: true });
  const video = join(root, 'portrait.mp4');
  await runProcess(ffmpegPath, ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=red:s=180x320:d=4:r=30,drawbox=color=blue:t=fill:enable=gte(t\\,2)', '-c:v', 'libx264', video]);
  const app = await electron.launch({ args: ['.'], env: { ...process.env, OPENCUT_TEST_DATA: join(root, 'app') } });
  try {
    const page = await app.firstWindow();
    await app.evaluate(({ dialog }, path) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path] }); }, video);
    const project = await page.evaluate(async () => {
      const p = await window.opencut.projects.create('Portrait scrub', { width: 180, height: 320, fps: 30, sampleRate: 48000 });
      await window.opencut.media.pick(p.id); return (await window.opencut.projects.open(p.id)).project;
    });
    const clip = makeMediaClip('video', Object.values(project.media)[0], 'track', 0);
    project.tracks = [{ id: 'track', name: 'Video', kind: 'video', hidden: false, locked: false, muted: false, clips: [clip] }];
    await page.evaluate(p => window.opencut.projects.saveEdit(p), project);
    await page.getByRole('button', { name: 'Open projects', exact: true }).click();
    await page.getByRole('button', { name: 'Open timeline', exact: true }).click();
    const canvas = page.locator('.canvas-surface canvas');
    const large = (await canvas.boundingBox())!.height;
    await page.getByRole('button', { name: 'Standard layout', exact: true }).click();
    await expect.poll(async () => (await canvas.boundingBox())!.height).toBeLessThan(large - 50);
    await page.getByRole('button', { name: 'Large preview', exact: true }).click();
    const ruler = (await page.locator('.ruler').boundingBox())!;
    const pixel = () => canvas.evaluate(c => Array.from((c as HTMLCanvasElement).getContext('2d')!.getImageData(20, 20, 1, 1).data));
    await page.mouse.move(ruler.x + 40, ruler.y + 16); await page.mouse.down();
    await expect.poll(() => canvas.getAttribute('data-render-time')).toBe('500000');
    expect((await pixel())[0]).toBeGreaterThan(200);
    await page.mouse.move(ruler.x + 200, ruler.y + 16, { steps: 20 });
    await expect.poll(() => canvas.getAttribute('data-render-time')).toBe('2500000');
    expect((await pixel())[2]).toBeGreaterThan(200);
    await page.mouse.up();
    const handle = (await page.getByRole('slider', { name: 'Timeline playhead' }).boundingBox())!;
    await page.mouse.move(handle.x + handle.width / 2, handle.y + 5); await page.mouse.down();
    await page.mouse.move(ruler.x + 80, ruler.y + 12, { steps: 15 });
    await expect.poll(() => canvas.getAttribute('data-render-time')).toBe('1000000');
    expect((await pixel())[0]).toBeGreaterThan(200);
    await page.mouse.up();
    await page.mouse.move(ruler.x + 240, ruler.y + 15);
    await expect(page.getByRole('slider', { name: 'Timeline playhead' })).toHaveAttribute('aria-valuenow', '1');
    await expect(page.getByRole('alert')).toHaveCount(0);
    await page.screenshot({ path: 'test-results/portrait-preview.png', fullPage: true });
  } finally { await app.evaluate(({ app }) => app.exit(0)).catch(() => {}); await app.close().catch(() => {}); }
});
