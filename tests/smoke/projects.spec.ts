import { test, expect, _electron as electron } from '@playwright/test';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { fixtures } from '../../scripts/fixtures';

test('create, import VFR video and MP3, seek proxy and restore project on restart', async () => {
  const media = await fixtures();
  const env = { ...process.env, OPENCUT_TEST_DATA: resolve('.test-data/smoke-' + randomUUID()) };
  let app = await electron.launch({ args: ['.'], env });
  try {
    let page = await app.firstWindow();
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.getByRole('button', { name: 'Open projects', exact: true }).click();
    await page.getByRole('button', { name: 'New project', exact: true }).click();
    await page.getByLabel('Project name').fill('Import acceptance');
    await page.getByRole('button', { name: 'Create project', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Media library' })).toBeVisible();
    await app.evaluate(({ dialog }, paths) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: paths });
    }, [media.video, media.audio, media.image]);
    await page.locator('.import-button').click();
    await expect(page.locator('.media-card')).toHaveCount(3, { timeout: 30000 });
    const video = page.locator('video');
    await expect(video).toBeVisible();
    await expect.poll(async () => video.evaluate(element => (element as HTMLVideoElement).readyState)).toBeGreaterThanOrEqual(2);
    const frame = await video.evaluate(async element => {
      const source = element as HTMLVideoElement;
      await new Promise<void>((resolve, reject) => {
        source.addEventListener('seeked', () => resolve(), { once: true });
        source.addEventListener('error', () => reject(new Error('Video decoding failed')), { once: true });
        source.currentTime = 1.2;
      });
      return { time: source.currentTime, width: source.videoWidth, height: source.videoHeight };
    });
    expect(frame).toEqual({ time: 1.2, width: 1920, height: 1080 });
    await page.screenshot({ path: 'test-results/media-library.png', fullPage: true });
    await page.locator('.media-select').filter({ hasText: 'music.mp3' }).click();
    await expect(page.locator('audio')).toBeVisible();
    expect(await page.locator('.audio-preview .waveform rect').count()).toBe(160);
    expect(errors).toEqual([]);
    await app.close();
    app = await electron.launch({ args: ['.'], env });
    page = await app.firstWindow();
    page.on('console', message => { if (message.type() === 'error') console.error(message.text()); });
    await page.getByRole('button', { name: 'Open projects', exact: true }).click();
    await expect(page.locator('.project-title')).toHaveText('Import acceptance');
    await expect(page.locator('.media-card')).toHaveCount(3);
    await page.getByRole('button', { name: 'Open timeline', exact: true }).click();
    await page.getByLabel('Add track').selectOption('video');
    const asset = page.locator('.editor-asset').filter({ hasText: 'variable-frame-rate.mp4' });
    const lane = page.locator('.track-lane').first();
    for (const x of [1, 161, 321]) await asset.dragTo(lane, { targetPosition: { x, y: 35 } });
    await expect(page.locator('.timeline-clip')).toHaveCount(3);
    await page.screenshot({ path: 'test-results/timeline-before-preview.png', fullPage: true });
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect.poll(async () => page.locator('canvas').evaluate(canvas => {
      const data = (canvas as HTMLCanvasElement).getContext('2d')!.getImageData(20, 20, 1, 1).data;
      return data[0];
    })).toBeGreaterThan(100);
    await page.locator('.timeline-clip').nth(1).click();
    await page.locator('.ruler').click({ position: { x: 240, y: 10 } });
    await page.getByRole('button', { name: 'Split selected', exact: true }).click();
    await expect(page.locator('.timeline-clip')).toHaveCount(4);
    await page.keyboard.press('Control+z');
    await expect(page.locator('.timeline-clip')).toHaveCount(3);
    await page.keyboard.press('Control+y');
    await expect(page.locator('.timeline-clip')).toHaveCount(4);
    await page.locator('.timeline-clip').last().click();
    await page.keyboard.press('Delete');
    await expect(page.locator('.timeline-clip')).toHaveCount(3);
    await page.keyboard.press('Control+z');
    await expect(page.locator('.timeline-clip')).toHaveCount(4);
    await page.keyboard.press('Home');
    await page.getByRole('button', { name: 'Play or pause', exact: true }).click();
    await expect.poll(async () => page.locator('.player-controls > span').textContent()).not.toContain('00:00:00:00');
    await page.getByRole('button', { name: 'Play or pause', exact: true }).click();
    await expect(page.getByRole('alert')).toHaveCount(0);
    await page.screenshot({ path: 'test-results/timeline.png', fullPage: true });
    await page.getByRole('button', { name: 'Source browser', exact: true }).click();
    const saved = await page.evaluate(async () => {
      const id = await window.opencut.projects.last(); return (await window.opencut.projects.open(id!)).project;
    });
    expect(saved.tracks[0].clips).toHaveLength(4);
  } finally {
    await app.evaluate(({ BrowserWindow }) => { for (const window of BrowserWindow.getAllWindows()) window.webContents.on('will-prevent-unload', event => event.preventDefault()); });
    await app.close();
  }
});
