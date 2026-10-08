import { test, expect, _electron as electron } from '@playwright/test';
import { resolve, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { writeFile, mkdir } from 'node:fs/promises';
import { ProjectStore } from '../../src/main/services/projectStore';

test('opening Projects restores an audio project with a wrapped waveform cache', async () => {
  const root = resolve('.test-data/waveform-navigation-' + randomUUID());
  const store = new ProjectStore(root);
  const project = await store.create('Existing audio project', { width: 1920, height: 1080, fps: 30, sampleRate: 48000 });
  const peaksPath = join(store.folder(project.id), 'peaks', 'audio.json');
  await mkdir(join(store.folder(project.id), 'peaks'), { recursive: true });
  await writeFile(peaksPath, JSON.stringify({ buckets: 4, peaks: [.1, .5, .8, .2] }));
  await store.update(project.id, project => { project.media.audio = { id: 'audio', path: join(root, 'missing-source.mp3'), kind: 'audio', duration: 2e6, hasAudio: true, status: 'ready', peaksPath }; });
  await store.remember(project.id);
  const app = await electron.launch({ executablePath: process.env.OPENCUT_EXECUTABLE, args: process.env.OPENCUT_EXECUTABLE ? [] : ['.'], env: { ...process.env, OPENCUT_TEST_DATA: root } });
  try {
    const page = await app.firstWindow(), errors: string[] = [];
    page.on('pageerror', error => { errors.push(error.message); console.error(error.message); });
    await page.getByRole('button', { name: 'Open projects', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Media library' })).toBeVisible();
    await expect(page.locator('.media-card')).toHaveCount(1);
    await expect(page.getByLabel('Audio waveform').first()).toBeVisible();
    await page.getByRole('button', { name: 'Projects', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Recent projects' })).toBeVisible();
    expect(errors).toEqual([]);
  } finally { await app.evaluate(({ app }) => app.exit(0)).catch(() => {}); await app.close().catch(() => {}); }
});

test('Projects navigation saves the edit and keeps the workspace usable', async () => {
  const root = resolve('.test-data/navigation-' + randomUUID());
  const app = await electron.launch({ executablePath: process.env.OPENCUT_EXECUTABLE, args: process.env.OPENCUT_EXECUTABLE ? [] : ['.'], env: { ...process.env, OPENCUT_TEST_DATA: root } });
  try {
    const page = await app.firstWindow();
    const errors: string[] = [];
    page.on('pageerror', error => { errors.push(error.message); console.error(error.stack); });
    await page.getByRole('button', { name: 'Open projects', exact: true }).click();
    await page.getByRole('button', { name: 'New project', exact: true }).click();
    await page.getByLabel('Project name').fill('Navigation test');
    await page.getByRole('button', { name: 'Create project', exact: true }).click();
    await page.getByRole('button', { name: 'Projects', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Recent projects' })).toBeVisible();
    await page.locator('.project-open').filter({ hasText: 'Navigation test' }).click();
    await page.getByRole('button', { name: 'Open timeline', exact: true }).click();
    await page.getByRole('button', { name: 'Add text', exact: true }).click();
    await page.getByLabel('Text content', { exact: true }).fill('Keep my changes');
    await page.getByRole('button', { name: 'Projects', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Recent projects' })).toBeVisible();
    await page.locator('.project-open').filter({ hasText: 'Navigation test' }).click();
    await page.getByRole('button', { name: 'Open timeline', exact: true }).click();
    await expect(page.locator('.timeline-clip')).toHaveText('Keep my changes');
    expect(errors).toEqual([]);
  } finally { await app.evaluate(({ app }) => app.exit(0)).catch(() => {}); await app.close().catch(() => {}); }
});
