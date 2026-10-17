import { test, expect, _electron as electron } from '@playwright/test';
import { resolve, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { makeTextClip } from '../../src/renderer/engine/text';
import { makeMediaClip } from '../../src/renderer/engine/timeline';
import { runProcess } from '../../src/main/services/process';
import { ffmpegPath } from '../../src/main/services/tools';

test('bulk video properties and shared text presets work in the app across restart', async () => {
  test.setTimeout(120000);
  const root = resolve('.test-data/shared-properties-' + randomUUID()); await mkdir(root, { recursive: true });
  const video = join(root, 'video.mp4');
  await runProcess(ffmpegPath, ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=red:s=320x180:d=1', '-c:v', 'libx264', video]);
  const options = { args: ['.'], env: { ...process.env, OPENCUT_TEST_DATA: join(root, 'app') } };
  let app = await electron.launch(options);
  try {
    let page = await app.firstWindow();
    await app.evaluate(({ dialog }, path) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path] }); }, video);
    const project = await page.evaluate(async () => {
      const project = await window.opencut.projects.create('Bulk video', { width: 320, height: 180, fps: 30, sampleRate: 48000 });
      await window.opencut.media.pick(project.id);
      return (await window.opencut.projects.open(project.id)).project;
    });
    const media = Object.values(project.media)[0];
    const clips = [0, 1, 2].map(i => makeMediaClip('c' + i, media, 'video', i * 1e6));
    clips[0].adjust.brightness = .2;
    project.tracks = [{ id: 'video', name: 'Video', kind: 'video', hidden: false, locked: false, muted: false, clips }, { id: 'text', name: 'Text', kind: 'text', hidden: false, locked: false, muted: false, clips: [makeTextClip('text1', 'text', 0)] }];
    await page.evaluate(project => window.opencut.projects.saveEdit(project), project);
    await page.getByRole('button', { name: 'Open projects', exact: true }).click();
    await page.getByRole('button', { name: 'Open timeline', exact: true }).click();
    await page.locator('[data-clip-id="c0"]').click({ position: { x: 30, y: 30 } });
    await page.locator('[data-clip-id="c1"]').click({ position: { x: 30, y: 30 }, modifiers: ['Shift'] });
    await expect(page.getByLabel('Selection brightness', { exact: true })).toHaveValue('');
    await page.getByLabel('Selection volume', { exact: true }).fill('0.5');
    await page.getByLabel('Selection filter preset', { exact: true }).selectOption('Warm');
    await page.getByLabel('Selection gaussian blur', { exact: true }).check();
    await page.locator('[data-clip-id="text1"]').click({ position: { x: 30, y: 30 } });
    await page.getByLabel('Font size', { exact: true }).fill('88');
    await page.getByLabel('Saved style name').fill('Across projects');
    await page.getByRole('button', { name: 'Save style', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('saved for all projects');
    await page.getByRole('button', { name: 'Source browser', exact: true }).click();
    const saved = await page.evaluate(async id => (await window.opencut.projects.open(id)).project, project.id);
    for (const clip of saved.tracks[0].clips.slice(0, 2)) expect(clip).toMatchObject({ volume: { value: .5 }, filter: { preset: 'Warm' }, effects: [{ type: 'blur', enabled: true }] });
    expect(saved.tracks[0].clips[2]).toEqual(clips[2]);
    await page.evaluate(async clip => {
      const next = await window.opencut.projects.create('Other project', { width: 320, height: 180, fps: 30, sampleRate: 48000 });
      next.tracks = [{ id: 'text', name: 'Text', kind: 'text', hidden: false, locked: false, muted: false, clips: [clip] }];
      await window.opencut.projects.saveEdit(next);
    }, makeTextClip('other', 'text', 0));
    await page.evaluate(() => localStorage.clear());
    await app.evaluate(({ app }) => app.exit(0)); await app.close().catch(() => {});
    app = await electron.launch(options); page = await app.firstWindow();
    await page.getByRole('button', { name: 'Open projects', exact: true }).click();
    await page.getByRole('button', { name: 'Open timeline', exact: true }).click();
    await page.locator('[data-clip-id="other"]').click({ position: { x: 30, y: 30 } });
    await page.getByLabel('Text style preset', { exact: true }).selectOption('Across projects');
    await expect(page.getByLabel('Font size', { exact: true })).toHaveValue('88');
  } finally { await app.evaluate(({ app }) => app.exit(0)).catch(() => {}); await app.close().catch(() => {}); }
});

