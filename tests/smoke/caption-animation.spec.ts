import { test, expect, _electron as electron } from '@playwright/test';
import { resolve, join } from 'node:path';
import { mkdir, readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { captionClip } from '../../src/renderer/engine/captionImport';
import { styleCaption } from '../../src/renderer/engine/captionStyle';
import { runProcess } from '../../src/main/services/process';
import { ffmpegPath } from '../../src/main/services/tools';

test('karaoke, word pop and box highlight follow words and match MP4 export', async () => {
  test.setTimeout(180000);
  const root = resolve('.test-data/caption-style-' + randomUUID()); await mkdir(root, { recursive: true });
  const clips = ['Karaoke', 'Word pop', 'Box highlight'].map((name, i) => {
    const start = i * 2e6, clip = captionClip({ text: 'LEFT\nRIGHT', start, end: start + 2e6, words: [{ text: 'LEFT', start, end: start + 1e6 }, { text: 'RIGHT', start: start + 1e6, end: start + 2e6 }] }, 'captions', `c${i}`);
    styleCaption(clip, name, .5); return clip;
  });
  const app = await electron.launch({ executablePath: process.env.OPENCUT_EXECUTABLE, args: process.env.OPENCUT_EXECUTABLE ? [] : ['.'], env: { ...process.env, OPENCUT_TEST_DATA: join(root, 'app') } });
  try {
    const page = await app.firstWindow();
    await page.evaluate(async clips => {
      const project = await window.opencut.projects.create('Animated captions', { width: 1920, height: 1080, fps: 30, sampleRate: 48000 });
      project.tracks = [{ id: 'captions', kind: 'text', name: 'Captions', hidden: false, muted: false, locked: false, clips }];
      await window.opencut.projects.saveEdit(project);
    }, clips);
    await page.getByRole('button', { name: 'Open projects', exact: true }).click();
    await page.getByRole('button', { name: 'Open timeline', exact: true }).click();
    await page.getByLabel('Preview quality').selectOption('1');
    const references: { time: number; samples: { index: number; rgb: number[] }[] }[] = [];
    for (const time of [.2, 1.2, 2.2, 3.2, 4.2, 5.2]) {
      await page.locator('.ruler').click({ position: { x: time * 80, y: 10 } });
      await expect(page.locator('canvas')).toHaveAttribute('data-render-time', String(time * 1e6));
      const result = await page.locator('canvas').evaluate(element => {
        const c = element as HTMLCanvasElement, d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
        let greenTop = 0, greenBottom = 0, whiteBottom = 0;
        const samples: { index: number; rgb: number[] }[] = [];
        for (let y = 400; y < 680; y++) for (let x = 700; x < 1220; x++) {
          const index = (y * c.width + x) * 4;
          if (d[index + 1] > d[index] + 25 && d[index + 1] > d[index + 2] + 60) { if (y < 540) greenTop++; else greenBottom++; }
          if (y >= 540 && d[index] > 180 && d[index + 1] > 180 && d[index + 2] > 180) whiteBottom++;
          if (x % 2 === 0 && y % 2 === 0 && d[index + 1] > 100) samples.push({ index, rgb: Array.from(d.slice(index, index + 3)) });
        }
        return { greenTop, greenBottom, whiteBottom, samples };
      });
      if (time === .2 || time === 4.2) { expect(result.greenTop).toBeGreaterThan(100); expect(result.greenBottom).toBe(0); }
      if (time === 1.2 || time === 5.2) { expect(result.greenBottom).toBeGreaterThan(100); expect(result.greenTop).toBe(0); }
      if (time === 2.2) expect(result.whiteBottom).toBe(0);
      if (time === 3.2) expect(result.whiteBottom).toBeGreaterThan(100);
      expect(result.samples.length).toBeGreaterThan(100); references.push({ time, samples: result.samples });
    }
    await page.screenshot({ path: 'test-results/caption-animation.png', fullPage: true });
    const output = join(root, 'animated-captions.mp4');
    await app.evaluate(({ dialog }, path) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: path }); }, output);
    await page.getByRole('button', { name: 'Export', exact: true }).click();
    await page.getByLabel('Encoder', { exact: true }).selectOption('software');
    await page.getByRole('button', { name: 'Export MP4', exact: true }).click();
    await expect(page.getByText('Export complete', { exact: true })).toBeVisible({ timeout: 90000 });
    for (const { time, samples } of references) {
      const raw = join(root, `caption-${time}.rgba`);
      await runProcess(ffmpegPath, ['-v', 'error', '-y', '-ss', String(time), '-i', output, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgba', raw]);
      const decoded = await readFile(raw);
      const error = samples.reduce((sum, sample) => sum + sample.rgb.reduce((sum, value, channel) => sum + Math.abs(value - decoded[sample.index + channel]), 0), 0) / (samples.length * 3);
      expect(error, `caption at ${time}`).toBeLessThan(22);
    }
    await expect(page.getByRole('alert')).toHaveCount(0);
    await page.getByRole('button', { name: 'Close export', exact: true }).click();
    await page.getByRole('button', { name: 'Source browser', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Media library' })).toBeVisible();
    await page.evaluate(async () => {
      const project = (await window.opencut.projects.open((await window.opencut.projects.last())!)).project;
      const clip = project.tracks[0].clips[0];
      if (clip.type === 'text' && clip.caption) { clip.content = 'um\nRIGHT'; clip.caption.words[0].text = 'um'; }
      await window.opencut.projects.saveEdit(project);
    });
    await page.getByRole('button', { name: 'Projects', exact: true }).click();
    await page.locator('.project-open').click();
    await page.getByRole('button', { name: 'Open timeline', exact: true }).click();
    await page.getByRole('button', { name: 'Captions', exact: true }).click();
    await page.locator('.filler-words summary').click();
    await expect(page.getByRole('button', { name: 'Cut filler', exact: true })).toHaveCount(1);
    await page.getByRole('button', { name: 'Cut filler', exact: true }).click();
    await expect(page.getByLabel('Caption 1 text')).toHaveValue('RIGHT');
    await expect(page.getByLabel('Caption 2 start')).toHaveValue('1');
    await expect(page.getByRole('button', { name: 'Cut filler', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Undo edit', exact: true }).click();
    await expect(page.getByLabel('Caption 1 text')).toHaveValue('um\nRIGHT');
    await expect(page.getByLabel('Caption 2 start')).toHaveValue('2');
    await expect(page.getByRole('alert')).toHaveCount(0);
  } finally { await app.evaluate(({ app }) => app.exit(0)).catch(() => {}); await app.close().catch(() => {}); }
});
