import { test, expect, _electron as electron } from '@playwright/test';
import { resolve, join } from 'node:path';
import { mkdir, readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import type { MediaClip } from '../../src/shared/types';
import { makeMediaClip, makeTrack } from '../../src/renderer/engine/timeline';
import { filterPresets, visualEffects } from '../../src/renderer/engine/visualEffects';
import { runProcess } from '../../src/main/services/process';
import { ffmpegPath } from '../../src/main/services/tools';

test('all visual effects change preview, match exported frames, key green and persist UI settings', async () => {
  test.setTimeout(240000);
  const root = resolve('.test-data/effects-' + randomUUID()); await mkdir(root, { recursive: true });
  const source = join(root, 'green.png'), background = join(root, 'background.png');
  await runProcess(ffmpegPath, ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=0x00ff00:s=640x360,drawbox=x=80:y=80:w=200:h=180:color=red:t=fill,drawbox=x=320:y=50:w=240:h=240:color=blue:t=fill,drawgrid=w=32:h=32:t=1:c=white@0.35', '-frames:v', '1', source]);
  await runProcess(ffmpegPath, ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=0x304080:s=640x360', '-frames:v', '1', background]);
  const cases: { name: string; apply(clip: MediaClip): void }[] = [{ name: 'Original', apply: () => {} }];
  for (const preset of filterPresets) cases.push({ name: preset, apply: clip => { clip.filter = { preset, intensity: 1 }; } });
  for (const name of ['brightness', 'contrast', 'saturation', 'temperature', 'vignette', 'sharpen'] as const) cases.push({ name, apply: clip => { clip.adjust[name] = name === 'saturation' ? -.7 : .8; } });
  for (const name of Object.keys(visualEffects)) cases.push({ name, apply: clip => { clip.effects.push({ type: name, enabled: true, params: { amount: .8 } }); } });
  for (const mode of ['multiply', 'screen', 'overlay', 'add'] as const) cases.push({ name: mode, apply: clip => { clip.blendMode = mode; } });
  for (const shape of ['rectangle', 'ellipse', 'linear'] as const) cases.push({ name: shape, apply: clip => { clip.mask = { shape, x: .5, y: .5, width: .6, height: .6, rotation: 20, feather: .2, invert: false }; } });
  cases.push({ name: 'Chroma', apply: clip => { clip.chromaKey = { color: '#00ff00', similarity: .15, smoothness: .12, spill: .6 }; } });
  cases.push({ name: 'PiP', apply: clip => { clip.transform.scale.value = .35; clip.transform.x.value = .78; clip.transform.y.value = .75; clip.frame = { radius: 100, borderWidth: 14, borderColor: '#ffffff', shadow: 40 }; } });
  const app = await electron.launch({ executablePath: process.env.OPENCUT_EXECUTABLE, args: process.env.OPENCUT_EXECUTABLE ? [] : ['.'], env: { ...process.env, OPENCUT_TEST_DATA: join(root, 'app') } });
  try {
    const page = await app.firstWindow();
    await page.evaluate(() => window.opencut.projects.create('Effects acceptance', { width: 1920, height: 1080, fps: 30, sampleRate: 48000 }));
    await page.getByRole('button', { name: 'Open projects', exact: true }).click();
    await app.evaluate(({ dialog }, paths) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: paths }); }, [source, background]);
    await page.locator('.import-button').click(); await expect(page.locator('.media-card')).toHaveCount(2, { timeout: 30000 });
    const project = await page.evaluate(async () => (await window.opencut.projects.open((await window.opencut.projects.last())!)).project);
    const green = Object.values(project.media).find(asset => asset.path.endsWith('green.png'))!, backdrop = Object.values(project.media).find(asset => asset.path.endsWith('background.png'))!;
    const bottom = makeTrack('bottom', 'video', 'Background'), top = makeTrack('top', 'video', 'Effects');
    const duration = cases.length * 200000;
    for (let start = 0; start < duration; start += 5e6) { const clip = makeMediaClip('bg-' + start, backdrop, bottom.id, start); clip.duration = clip.sourceOut = Math.min(5e6, duration - start); bottom.clips.push(clip); }
    cases.forEach((item, i) => { const clip = makeMediaClip('effect-' + i, green, top.id, i * 200000); clip.duration = clip.sourceOut = 200000; item.apply(clip); top.clips.push(clip); });
    project.tracks = [bottom, top]; await page.evaluate(project => window.opencut.projects.saveEdit(project), project);
    await page.getByRole('button', { name: 'Projects', exact: true }).click(); await page.locator('.project-open').click();
    await page.getByRole('button', { name: 'Open timeline', exact: true }).click(); await page.getByLabel('Preview quality').selectOption('1');
    const references: { name: string; time: number; pixels: number[] }[] = [];
    for (let i = 0; i < cases.length; i++) {
      const time = (i * 200000 + 100000) / 1e6;
      await page.locator('.ruler').click({ position: { x: time * 80, y: 10 } });
      await expect(page.locator('canvas')).toHaveAttribute('data-render-time', String(Math.round(time * 1e6)));
      const pixels = await page.locator('canvas').evaluate(element => {
        const c = element as HTMLCanvasElement, data = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data, result: number[] = [];
        for (let y = 8; y < c.height; y += 16) for (let x = 8; x < c.width; x += 16) { const at = (y * c.width + x) * 4; result.push(data[at], data[at + 1], data[at + 2]); } return result;
      });
      if (i) {
        const differences = pixels.map((value, j) => Math.abs(value - references[0].pixels[j]));
        if (cases[i].name === 'sharpen') { expect(Math.max(...differences)).toBeGreaterThan(4); expect(differences.filter(value => value > 4).length).toBeGreaterThan(10); }
        else expect(differences.reduce((sum, value) => sum + value, 0) / pixels.length, `${cases[i].name} should be visible`).toBeGreaterThan(.2);
      }
      if (cases[i].name === 'Chroma') { expect(pixels[0]).toBeLessThan(100); expect(pixels[1]).toBeLessThan(120); expect(pixels[2]).toBeGreaterThan(100); }
      references.push({ name: cases[i].name, time, pixels });
    }
    const output = join(root, 'effects.mp4');
    await app.evaluate(({ dialog }, path) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: path }); }, output);
    await page.getByRole('button', { name: 'Export', exact: true }).click(); await page.getByLabel('Encoder', { exact: true }).selectOption('software');
    await page.getByRole('button', { name: 'Export MP4', exact: true }).click(); await expect(page.getByText('Export complete', { exact: true })).toBeVisible({ timeout: 150000 });
    for (const reference of references) {
      const raw = join(root, reference.name.replace(/\W/g, '-') + '.rgba');
      await runProcess(ffmpegPath, ['-v', 'error', '-y', '-ss', String(reference.time), '-i', output, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgba', raw]);
      const decoded = await readFile(raw); let error = 0, index = 0;
      for (let y = 8; y < 1080; y += 16) for (let x = 8; x < 1920; x += 16) for (let channel = 0; channel < 3; channel++) error += Math.abs(reference.pixels[index++] - decoded[(y * 1920 + x) * 4 + channel]);
      expect(error / index, `${reference.name} preview/export`).toBeLessThan(12);
    }
    await page.getByRole('button', { name: 'Close export', exact: true }).click();
    await page.locator('.timeline-clip').filter({ hasText: 'green.png' }).first().click({ position: { x: 8, y: 20 } });
    await page.getByLabel('Filter preset', { exact: true }).selectOption('Warm'); await page.getByLabel('Brightness', { exact: true }).fill('0.2');
    await page.locator('summary').filter({ hasText: 'Video effects' }).click(); await page.getByLabel('Gaussian blur', { exact: true }).check();
    await page.locator('summary').filter({ hasText: 'Blend & mask' }).click(); await page.getByLabel('Mask shape').selectOption('ellipse');
    await page.locator('summary').filter({ hasText: 'Chroma key' }).click(); await page.getByLabel('Enable chroma key').check();
    await page.locator('summary').filter({ hasText: 'Picture in picture' }).click(); await page.getByLabel('Picture in picture preset').selectOption('bottom-right');
    await page.locator('.ruler').click({ position: { x: 8, y: 10 } }); await expect(page.locator('canvas')).toHaveAttribute('data-render-time', '100000');
    await page.screenshot({ path: 'test-results/effects.png', fullPage: true }); await expect(page.getByRole('alert')).toHaveCount(0);
    await page.getByRole('button', { name: 'Source browser', exact: true }).click(); await expect(page.getByRole('heading', { name: 'Media library' })).toBeVisible();
    const saved = await page.evaluate(async id => (await window.opencut.projects.open(id)).project, project.id);
    const edited = saved.tracks[1].clips[0] as MediaClip; expect(edited.filter?.preset).toBe('Warm'); expect(edited.adjust.brightness).toBe(.2); expect(edited.mask?.shape).toBe('ellipse'); expect(edited.chromaKey).toBeTruthy(); expect(edited.frame).toBeTruthy();
  } finally { await app.evaluate(({ app }) => app.exit(0)).catch(() => {}); await app.close().catch(() => {}); }
});
