import { test, expect, _electron as electron } from '@playwright/test';
import { resolve, join } from 'node:path';
import { mkdir, rename } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { runProcess } from '../../src/main/services/process';
import { ffmpegPath } from '../../src/main/services/tools';

test('silence review cuts with undo and a missing source can be relinked from the library', async () => {
  test.setTimeout(90000);
  const root = resolve('.test-data/project-polish-' + randomUUID()); await mkdir(root, { recursive: true });
  const source = join(root, 'source.wav'), moved = join(root, 'moved.wav');
  await runProcess(ffmpegPath, ['-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=4', '-af', "volume=0:enable='between(t,1,2)'", source]);
  const app = await electron.launch({ executablePath: process.env.OPENCUT_EXECUTABLE, args: process.env.OPENCUT_EXECUTABLE ? [] : ['.'], env: { ...process.env, OPENCUT_TEST_DATA: join(root, 'app') } });
  try {
    const page = await app.firstWindow();
    await page.evaluate(() => window.opencut.projects.create('Project polish', { width: 1920, height: 1080, fps: 30, sampleRate: 48000 }));
    await page.getByRole('button', { name: 'Open projects', exact: true }).click();
    await app.evaluate(({ dialog }, path) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path] }); }, source);
    await page.locator('.import-button').click(); await expect(page.locator('.media-card')).toHaveCount(1);
    await page.getByRole('button', { name: 'Open timeline', exact: true }).click(); await page.locator('.editor-asset').dblclick(); await page.locator('.timeline-clip').click();
    await page.getByText('Remove silence', { exact: true }).click(); await page.getByRole('button', { name: 'Analyze silence', exact: true }).click();
    await expect(page.getByText(/1 quiet intervals/)).toBeVisible();
    await page.getByRole('button', { name: 'Remove detected silence', exact: true }).click(); await expect(page.locator('.timeline-clip')).toHaveCount(2);
    await page.getByTitle('Undo (Ctrl+Z)', { exact: true }).click(); await expect(page.locator('.timeline-clip')).toHaveCount(1);
    await page.getByRole('button', { name: 'Source browser', exact: true }).click(); await expect(page.getByRole('heading', { name: 'Media library', exact: true })).toBeVisible();
    await rename(source, moved);
    await page.getByRole('button', { name: 'Projects', exact: true }).click(); await page.locator('.project-open').click();
    await expect(page.getByText('Missing source', { exact: true })).toBeVisible();
    await app.evaluate(({ dialog }, path) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path] }); }, moved);
    await page.getByRole('button', { name: 'Relink selected media', exact: true }).click(); await expect(page.getByText('Missing source', { exact: true })).toHaveCount(0, { timeout: 30000 });
    const project = await page.evaluate(async () => (await window.opencut.projects.open((await window.opencut.projects.last())!)).project);
    expect(Object.values(project.media)[0].path).toBe(moved); expect(project.tracks[0].clips).toHaveLength(1); expect(project.tracks[0].clips[0].duration).toBe(4e6);
  } finally { await app.evaluate(({ app }) => app.exit(0)).catch(() => {}); await app.close().catch(() => {}); }
});
