import { test, expect, _electron as electron } from '@playwright/test';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { makeTextClip } from '../../src/renderer/engine/text';
import { designedTextPresets, applyDesignedTextPreset } from '../../src/renderer/engine/designedTextPresets';
import { runProcess } from '../../src/main/services/process';
import { ffmpegPath } from '../../src/main/services/tools';
import { readFile } from 'node:fs/promises';
test('renders every designed text animation to a showcase', async () => {
  test.setTimeout(240000);
  const app = await electron.launch({ args: ['.'], env: { ...process.env, OPENCUT_TEST_DATA: resolve('.test-data/preset-reel-' + randomUUID()) } });
  try {
    const page = await app.firstWindow();
    const clips = designedTextPresets.map((preset, index) => {
      const clip = makeTextClip('c' + index, 'text', index * 3e6); clip.duration = 3e6; clip.content = preset.sample;
      applyDesignedTextPreset(clip, preset); return clip;
    });
    await page.evaluate(async clips => {
      const p = await window.opencut.projects.create('Text motion showcase', { width: 1920, height: 1080, fps: 30, sampleRate: 48000 });
      p.tracks = [{ id: 'text', kind: 'text', name: 'Titles', locked: false, hidden: false, muted: false, clips }]; await window.opencut.projects.saveEdit(p);
    }, clips);
    await page.getByRole('button', { name: 'Open projects', exact: true }).click(); await page.getByRole('button', { name: 'Open timeline', exact: true }).click();
    await page.locator('[data-clip-id="c0"]').click({ position: { x: 30, y: 30 } });
    await page.getByRole('navigation', { name: 'Text property sections' }).getByRole('button', { name: 'Animation', exact: true }).click();
    await page.getByRole('button', { name: 'Apply Editorial reveal', exact: true }).hover();
    await expect(page.locator('.text-preset-card')).toHaveCount(6);
    await expect(page.getByLabel('Text style preset').locator('option', { hasText: 'Cinema gold' })).toHaveCount(0);
    await page.screenshot({ path: 'test-results/text-preset-cards.png', fullPage: true });
    const output = resolve('test-results/text-preset-showcase.mp4');
    await app.evaluate(({ dialog }, path) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: path }); }, output);
    await page.getByRole('button', { name: 'Export', exact: true }).click(); await page.getByLabel('Encoder', { exact: true }).selectOption('software');
    await page.getByRole('button', { name: 'Export MP4', exact: true }).click(); await expect(page.getByText('Export complete', { exact: true })).toBeVisible({ timeout: 180000 });
    for (let index = 0; index < 6; index++) {
      const frame = resolve(`test-results/preset-${index}.rgb`);
      await runProcess(ffmpegPath, ['-v', 'error', '-y', '-ss', String(index * 3 + 1.5), '-i', output, '-frames:v', '1', '-vf', 'scale=320:180', '-f', 'rawvideo', '-pix_fmt', 'rgb24', frame]);
      expect((await readFile(frame)).filter(value => value > 160).length).toBeGreaterThan(100);
    }
    await runProcess(ffmpegPath, ['-v', 'error', '-y', '-ss', '1.5', '-i', output, '-vf', 'fps=1/3,scale=480:270,tile=3x2', '-frames:v', '1', resolve('test-results/text-preset-contact.png')]);
  } finally { await app.evaluate(({ app }) => app.exit(0)).catch(() => {}); await app.close().catch(() => {}); }
});

