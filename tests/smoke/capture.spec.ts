import { test, expect, _electron as electron } from '@playwright/test';
import { resolve, join } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

test('synthetic webcam records a playable clip and timeline markers/groups persist', async () => {
  test.setTimeout(90000);
  const root = resolve('.test-data/capture-' + randomUUID()); await mkdir(root, { recursive: true });
  const app = await electron.launch({ executablePath: process.env.OPENCUT_EXECUTABLE, args: [...(process.env.OPENCUT_EXECUTABLE ? [] : ['.']), '--use-fake-device-for-media-stream'], env: { ...process.env, OPENCUT_TEST_DATA: join(root, 'app') } });
  try {
    const page = await app.firstWindow();
    await page.evaluate(() => window.opencut.projects.create('Capture acceptance', { width: 1920, height: 1080, fps: 30, sampleRate: 48000 }));
    await page.getByRole('button', { name: 'Open projects', exact: true }).click(); await page.getByRole('button', { name: 'Open timeline', exact: true }).click();
    await page.getByRole('button', { name: 'Record video', exact: true }).click();
    await page.getByLabel('Include microphone audio').check();
    await page.getByRole('button', { name: 'Start video recording', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Stop video recording · 2s', exact: true })).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: /Stop video recording/ }).click();
    await expect(page.getByRole('dialog', { name: 'Record video', exact: true })).toHaveCount(0, { timeout: 30000 });
    await expect(page.locator('.timeline-clip')).toHaveCount(1);
    await page.getByRole('button', { name: 'Add text', exact: true }).click();
    await page.locator('.timeline-clip').first().click(); await page.locator('.timeline-clip').last().click({ modifiers: ['Control'] });
    await page.getByTitle('Group selected clips', { exact: true }).click();
    await page.getByRole('button', { name: 'Markers', exact: true }).click();
    await page.getByRole('button', { name: 'Add at playhead', exact: true }).click();
    await page.getByLabel('Marker label').fill('Intro'); await page.getByLabel('Marker seconds').fill('1.25');
    await page.getByRole('dialog', { name: 'Timeline markers' }).getByRole('button', { name: 'Close', exact: true }).click();
    await expect(page.locator('.timeline-marker')).toHaveAttribute('title', 'Intro');
    await page.getByRole('button', { name: 'Source browser', exact: true }).click(); await expect(page.getByRole('heading', { name: 'Media library', exact: true })).toBeVisible();
    const project = await page.evaluate(async () => (await window.opencut.projects.open((await window.opencut.projects.last())!)).project);
    const asset = Object.values(project.media)[0]; expect(asset).toMatchObject({ kind: 'video', hasAudio: true, status: 'ready' }); expect(asset.duration).toBeGreaterThan(1e6);
    const clips = project.tracks.flatMap(track => track.clips); expect(clips[0].linkId).toBeTruthy(); expect(clips[0].linkId).toBe(clips[1].linkId);
    expect(project.markers).toMatchObject([{ time: 1250000, label: 'Intro' }]);
    const video = page.locator('.source-stage video'); await expect(video).toBeVisible(); expect(await video.evaluate(element => (element as HTMLVideoElement).readyState)).toBeGreaterThan(0);
    await page.screenshot({ path: 'test-results/capture.png', fullPage: true });
    // Restrict capture to this isolated test window; never enumerate or record the user's desktop.
    await app.evaluate(({ desktopCapturer, BrowserWindow, nativeImage }) => {
      const window = BrowserWindow.getAllWindows()[0];
      desktopCapturer.getSources = async () => [{ id: window.getMediaSourceId(), name: 'OpenCut test window', thumbnail: nativeImage.createEmpty(), display_id: '', appIcon: nativeImage.createEmpty() }];
    });
    await page.getByRole('button', { name: 'Open timeline', exact: true }).click();
    await page.getByRole('button', { name: 'Record video', exact: true }).click();
    await page.getByLabel('Capture source').selectOption('screen');
    await expect(page.getByLabel('OpenCut test window', { exact: true })).toBeChecked();
    await page.getByRole('button', { name: 'Start video recording', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Stop video recording · 2s', exact: true })).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: /Stop video recording/ }).click();
    await expect(page.getByRole('dialog', { name: 'Record video', exact: true })).toHaveCount(0, { timeout: 30000 });
    await expect(page.locator('.timeline-clip')).toHaveCount(3);
  } finally { await app.evaluate(({ app }) => app.exit(0)).catch(() => {}); await app.close().catch(() => {}); }
});
