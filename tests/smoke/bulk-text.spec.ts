import { test, expect, _electron as electron } from '@playwright/test';
import { resolve, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile } from 'node:fs/promises';
import { captionClip } from '../../src/renderer/engine/captionImport';
import { defaultTextStyle } from '../../src/renderer/engine/text';
import { runProcess } from '../../src/main/services/process';
import { ffmpegPath } from '../../src/main/services/tools';

test('bulk caption typography, mixed values, preset undo, outlines and exported styles persist without changing words', async () => {
  test.setTimeout(90000);
  const root = resolve('.test-data/bulk-text-' + randomUUID()); await mkdir(root, { recursive: true });
  const app = await electron.launch({ executablePath: process.env.OPENCUT_EXECUTABLE, args: process.env.OPENCUT_EXECUTABLE ? [] : ['.'], env: { ...process.env, OPENCUT_TEST_DATA: join(root, 'app') } });
  try {
    const page = await app.firstWindow();
    const clips = ['First caption', 'Second caption', 'Unselected'].map((text, i) => captionClip({ text, start: i * 1e6, end: (i + 1) * 1e6, words: [{ text, start: i * 1e6, end: (i + 1) * 1e6 }] }, 'captions', 'caption-' + i));
    clips[0].style.fontSize = 50; clips[1].style.fontSize = 80; clips[0].style.color = '#ff0000'; clips[1].style.color = '#0000ff'; delete clips[0].style.stroke;
    await page.evaluate(async ({ clips, style }) => {
      const project = await window.opencut.projects.create('Bulk caption styles', { width: 640, height: 360, fps: 30, sampleRate: 48000 });
      project.tracks = [{ id: 'captions', name: 'Captions', kind: 'text', hidden: false, locked: false, muted: false, clips }];
      project.captionStyles['Saved caption'] = { ...style, fontFamily: 'Anton', fontSize: 64 };
      await window.opencut.projects.saveEdit(project);
    }, { clips, style: defaultTextStyle });
    await page.getByRole('button', { name: 'Open projects', exact: true }).click(); await page.getByRole('button', { name: 'Open timeline', exact: true }).click();
    const select = async () => { await page.locator('[data-clip-id="caption-0"]').click({ position: { x: 30, y: 30 } }); await page.locator('[data-clip-id="caption-1"]').click({ position: { x: 30, y: 30 }, modifiers: ['Shift'] }); };
    await select(); await expect(page.getByLabel('Selection font size', { exact: true })).toHaveValue('');
    await expect(page.getByLabel('Selection text border', { exact: true })).toHaveJSProperty('indeterminate', true);
    await page.getByLabel('Selection style preset', { exact: true }).selectOption('Saved caption');
    await expect(page.getByLabel('Selection font size', { exact: true })).toHaveValue('64');
    await page.getByTitle('Undo (Ctrl+Z)', { exact: true }).click(); await select();
    await expect(page.getByLabel('Selection font size', { exact: true })).toHaveValue('');
    await page.getByLabel('Selection font family', { exact: true }).selectOption('Anton');
    await page.getByLabel('Selection font size', { exact: true }).fill('72');
    await page.getByLabel('Selection font weight', { exact: true }).selectOption('800');
    await page.getByLabel('Selection text color', { exact: true }).fill('#00ff00');
    await page.getByLabel('Selection italic', { exact: true }).check();
    await page.getByLabel('Selection text border', { exact: true }).check();
    await page.getByLabel('Selection border color', { exact: true }).fill('#ff0000');
    await page.getByLabel('Selection border width', { exact: true }).fill('4');
    await page.getByText('Shadow & glow', { exact: true }).click();
    await page.getByLabel('Selection text shadow', { exact: true }).check();
    await page.getByLabel('Selection shadow blur', { exact: true }).fill('8');
    await page.getByText('Background & gradient', { exact: true }).click();
    await page.getByLabel('Selection text background', { exact: true }).check();
    await page.getByLabel('Selection background opacity', { exact: true }).fill('0.5');
    await expect(page.getByRole('alert')).toHaveCount(0);
    await page.getByLabel('Selection font size', { exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/bulk-caption-style.png', fullPage: true });
    await page.getByRole('button', { name: 'Source browser', exact: true }).click(); await expect(page.getByRole('heading', { name: 'Media library' })).toBeVisible();
    const saved = await page.evaluate(async () => (await window.opencut.projects.open((await window.opencut.projects.last())!)).project);
    const changed = saved.tracks[0].clips;
    for (let i = 0; i < 2; i++) {
      expect(changed[i]).toMatchObject({ style: { fontFamily: 'Anton', fontSize: 72, weight: 800, italic: true, color: '#00ff00', stroke: { color: '#ff0000', width: 4 }, shadow: { blur: 8 }, background: { opacity: .5 } }, content: clips[i].content, start: clips[i].start, duration: clips[i].duration, caption: clips[i].caption });
    }
    expect(changed[2]).toEqual(clips[2]);
    await page.getByRole('button', { name: 'Open timeline', exact: true }).click();
    const output = join(root, 'bulk-captions.mp4');
    await app.evaluate(({ dialog }, path) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: path }); }, output);
    await page.getByRole('button', { name: 'Export', exact: true }).click(); await page.getByLabel('Resolution', { exact: true }).selectOption('1080'); await page.getByLabel('Encoder', { exact: true }).selectOption('software');
    await page.getByRole('button', { name: 'Export MP4', exact: true }).click(); await expect(page.getByText('Export complete', { exact: true })).toBeVisible({ timeout: 60000 });
    for (const time of [.5, 1.5]) {
      const pixels = join(root, `frame-${time}.rgb`); await runProcess(ffmpegPath, ['-v', 'error', '-y', '-ss', String(time), '-i', output, '-frames:v', '1', '-pix_fmt', 'rgb24', '-f', 'rawvideo', pixels]);
      const rgb = await readFile(pixels); let green = 0, red = 0;
      for (let i = 0; i < rgb.length; i += 3) { if (rgb[i + 1] > 120 && rgb[i + 1] > rgb[i] * 1.5) green++; if (rgb[i] > 120 && rgb[i] > rgb[i + 1] * 1.5) red++; }
      expect(green).toBeGreaterThan(100); expect(red).toBeGreaterThan(50);
    }
  } finally { await app.evaluate(({ app }) => app.exit(0)).catch(() => {}); await app.close().catch(() => {}); }
});
