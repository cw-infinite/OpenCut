import { test, expect, _electron as electron } from '@playwright/test';
import { resolve, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { makeTextClip } from '../../src/renderer/engine/text';
import { runProcess } from '../../src/main/services/process';
import { ffmpegPath } from '../../src/main/services/tools';
import { readFile, mkdir } from 'node:fs/promises';

test('text navigation, transparent fill, animation presets and permanent preset removal', async () => {
  const root = resolve('.test-data/text-controls-' + randomUUID()); await mkdir(root, { recursive: true });
  const app = await electron.launch({ args: ['.'], env: { ...process.env, OPENCUT_TEST_DATA: join(root, 'app') } });
  try {
    const page = await app.firstWindow();
    const clip = makeTextClip('c', 't', 0); clip.duration = 2e6; clip.content = 'TEST'; clip.style.fontSize = 180; clip.style.stroke = { color: '#ff0000', width: 3 };
    await page.evaluate(async clip => {
      const p = await window.opencut.projects.create('Text controls', { width: 640, height: 360, fps: 30, sampleRate: 48000 });
      p.tracks = [{ id: 't', kind: 'text', name: 'Text', hidden: false, muted: false, locked: false, clips: [clip, { ...clip, id: 'second', start: 2250000, duration: 1e6 }] }, { id: 'cover', kind: 'text', name: 'Cover', hidden: false, muted: false, locked: false, clips: [{ ...clip, id: 'cover-clip', trackId: 'cover', content: '', duration: 4e6 }] }];
      await window.opencut.projects.saveEdit(p);
    }, clip);
    await page.getByRole('button', { name: 'Open projects', exact: true }).click(); await page.getByRole('button', { name: 'Open timeline', exact: true }).click();
    await page.locator('[data-clip-id="c"]').click({ position: { x: 30, y: 30 } });
    await page.getByRole('button', { name: 'Close gaps', exact: true }).click();
    await expect(page.locator('[data-clip-id="second"]')).toHaveCSS('left', '160px');
    await expect(page.getByRole('navigation', { name: 'Text property sections' }).locator('button')).toHaveCount(6);
    const whites = () => page.locator('.canvas-surface canvas').evaluate(element => {
      const c = element as HTMLCanvasElement, data = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
      let count = 0; for (let i = 0; i < data.length; i += 4) if (data[i] > 180 && data[i+1] > 180 && data[i+2] > 180) count++; return count;
    });
    await expect.poll(whites).toBeGreaterThan(100);
    await page.getByLabel('Transparent text fill', { exact: true }).check();
    await expect.poll(whites).toBe(0);
    await page.getByLabel('Saved style name').fill('Hollow'); await page.getByRole('button', { name: 'Save style', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('saved for all projects');
    await page.getByLabel('Saved preset to remove').selectOption('Hollow'); await page.getByRole('button', { name: 'Remove preset', exact: true }).click();
    await expect(page.getByLabel('Text style preset').locator('option', { hasText: 'Hollow' })).toHaveCount(0);
    await page.getByRole('navigation', { name: 'Text property sections' }).getByRole('button', { name: 'Animation', exact: true }).click();
    await page.getByRole('button', { name: 'Apply Creator captions', exact: true }).click();
    await expect(page.getByLabel('animIn preset', { exact: true })).toHaveValue('focusLift');
    await expect(page.getByLabel('animLoop preset', { exact: true })).toHaveValue('');
    await page.getByRole('button', { name: 'Apply Editorial reveal', exact: true }).click();
    await expect(page.getByLabel('animIn preset', { exact: true })).toHaveValue('maskRise');
    const output = join(root, 'animated.mp4');
    await app.evaluate(({ dialog }, path) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: path }); }, output);
    await page.getByRole('button', { name: 'Export', exact: true }).click(); await page.getByLabel('Encoder', { exact: true }).selectOption('software');
    await page.getByRole('button', { name: 'Export MP4', exact: true }).click(); await expect(page.getByText('Export complete', { exact: true })).toBeVisible({ timeout: 60000 });
    const pixels = join(root, 'frame.rgb'); await runProcess(ffmpegPath, ['-v', 'error', '-y', '-ss', '1', '-i', output, '-frames:v', '1', '-vf', 'scale=320:180', '-f', 'rawvideo', '-pix_fmt', 'rgb24', pixels]);
    expect((await readFile(pixels)).some(value => value > 180)).toBe(true);
    await expect(page.getByRole('alert')).toHaveCount(0);
  } finally { await app.evaluate(({ app }) => app.exit(0)).catch(() => {}); await app.close().catch(() => {}); }
});
