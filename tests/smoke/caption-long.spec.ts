import { test, expect, _electron as electron } from '@playwright/test';
import { resolve, join } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { runProcess } from '../../src/main/services/process';
import { ffmpegPath, ffprobePath } from '../../src/main/services/tools';

test('two-minute synthetic speech keeps repeated phrase anchors within 200 ms', async () => {
  test.setTimeout(240000);
  const root = resolve('.test-data/caption-long-' + randomUUID()); await mkdir(root, { recursive: true });
  const sentence = join(root, 'sentence.wav'), source = join(root, 'two-minutes.wav');
  await runProcess('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `Add-Type -AssemblyName System.Speech; $voice = New-Object System.Speech.Synthesis.SpeechSynthesizer; $voice.SetOutputToWaveFile('${sentence.replace(/'/g, "''")}'); $voice.Speak('Welcome to Open Cut. Make your story clear with captions.'); $voice.Dispose()`], 30000);
  const probe = JSON.parse(await runProcess(ffprobePath, ['-v', 'error', '-show_format', '-of', 'json', sentence]));
  const period = Number(probe.format.duration);
  await runProcess(ffmpegPath, ['-v', 'error', '-y', '-stream_loop', '-1', '-i', sentence, '-t', '120', '-ar', '48000', source], 30000);
  const app = await electron.launch({ executablePath: process.env.OPENCUT_EXECUTABLE, args: process.env.OPENCUT_EXECUTABLE ? [] : ['.'], env: { ...process.env, OPENCUT_TEST_DATA: join(root, 'app') } });
  try {
    const page = await app.firstWindow();
    const project = await page.evaluate(() => window.opencut.projects.create('Long caption acceptance', { width: 1920, height: 1080, fps: 30, sampleRate: 48000 }));
    await page.getByRole('button', { name: 'Open projects', exact: true }).click();
    await app.evaluate(({ dialog }, path) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path] }); }, source);
    await page.locator('.import-button').click(); await expect(page.locator('.media-card')).toHaveCount(1, { timeout: 30000 });
    await page.getByRole('button', { name: 'Open timeline', exact: true }).click();
    await page.locator('.editor-asset').dblclick();
    await page.getByRole('button', { name: 'Captions', exact: true }).click();
    await page.getByLabel('Caption style', { exact: true }).selectOption('Karaoke');
    await page.getByRole('button', { name: 'Generate captions', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Added', { timeout: 180000 });
    await page.getByRole('button', { name: 'Close captions', exact: true }).click();
    await page.getByRole('button', { name: 'Source browser', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Media library' })).toBeVisible();
    const saved = await page.evaluate(async id => (await window.opencut.projects.open(id)).project, project.id);
    const anchors = saved.tracks.flatMap(track => track.clips).flatMap(clip => clip.type === 'text' ? (clip.caption?.words ?? []).filter(word => /^welcome$/i.test(word.text)).map(word => (clip.start + word.start) / 1e6) : []);
    expect(anchors.length).toBeGreaterThanOrEqual(Math.floor(120 / period) - 1);
    const errors = anchors.map(time => Math.abs(time - Math.round(time / period) * period));
    console.log(`Long speech: ${anchors.length} anchors, max onset offset ${Math.max(...errors).toFixed(3)} s`);
    expect(Math.max(...errors)).toBeLessThanOrEqual(.2);
  } finally { await app.evaluate(({ app }) => app.exit(0)).catch(() => {}); await app.close().catch(() => {}); }
});
