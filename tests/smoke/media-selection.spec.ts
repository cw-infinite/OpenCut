import { test, expect, _electron as electron } from '@playwright/test';
import { resolve } from 'node:path';
import { access } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { fixtures } from '../../scripts/fixtures';

test('library supports range, toggle and marquee selection, bulk delete and filtered delete all', async () => {
  test.setTimeout(90000);
  const media = await fixtures();
  const paths = [media.video, media.audio, media.image];
  const app = await electron.launch({ args: ['.'], env: { ...process.env, OPENCUT_TEST_DATA: resolve('.test-data/media-selection-' + randomUUID()) } });
  try {
    const page = await app.firstWindow();
    await page.evaluate(() => window.opencut.projects.create('Media selection', { width: 1920, height: 1080, fps: 30, sampleRate: 48000 }));
    await page.getByRole('button', { name: 'Open projects', exact: true }).click();
    await app.evaluate(({ dialog }, files) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: files }); }, paths);
    await page.locator('.import-button').click();
    const cards = page.locator('.media-select');
    await expect(cards).toHaveCount(3, { timeout: 30000 });
    await cards.nth(0).click();
    await cards.nth(2).click({ modifiers: ['Shift'] });
    await expect(page.locator('.media-select[aria-pressed="true"]')).toHaveCount(3);
    await cards.nth(1).click({ modifiers: ['Control'] });
    await expect(page.locator('.media-select[aria-pressed="true"]')).toHaveCount(2);
    await page.getByRole('button', { name: 'Clear selection', exact: true }).click();
    const first = (await cards.nth(0).boundingBox())!;
    const second = (await cards.nth(1).boundingBox())!;
    await page.mouse.move(first.x - 4, first.y - 4);
    await page.mouse.down();
    await page.mouse.move(second.x + second.width, second.y + second.height / 2, { steps: 10 });
    await page.mouse.up();
    await expect(page.locator('.media-select[aria-pressed="true"]')).toHaveCount(2);
    page.once('dialog', dialog => dialog.dismiss());
    await page.getByRole('button', { name: 'Delete selected (2)', exact: true }).click();
    await expect(cards).toHaveCount(3);
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: 'Delete selected (2)', exact: true }).click();
    await expect(cards).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Delete selected (0)', exact: true })).toBeDisabled();
    await page.getByLabel('Search media', { exact: true }).fill('no-matching-file');
    await expect(cards).toHaveCount(0);
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: 'Delete all (1)', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Delete all (0)', exact: true })).toBeDisabled();
    const remaining = await page.evaluate(async () => Object.keys((await window.opencut.projects.open((await window.opencut.projects.last())!)).project.media));
    expect(remaining).toEqual([]);
    for (const path of paths) await access(path);
  } finally { await app.close(); }
});

test('bulk removal rejects the entire batch when one asset is used on the timeline', async () => {
  test.setTimeout(90000);
  const media = await fixtures();
  const app = await electron.launch({ args: ['.'], env: { ...process.env, OPENCUT_TEST_DATA: resolve('.test-data/media-protection-' + randomUUID()) } });
  try {
    const page = await app.firstWindow();
    await page.evaluate(() => window.opencut.projects.create('Protected media', { width: 1920, height: 1080, fps: 30, sampleRate: 48000 }));
    await page.getByRole('button', { name: 'Open projects', exact: true }).click();
    await app.evaluate(({ dialog }, files) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: files }); }, [media.video, media.image]);
    await page.locator('.import-button').click();
    await expect(page.locator('.media-card')).toHaveCount(2, { timeout: 30000 });
    await page.getByRole('button', { name: 'Open timeline', exact: true }).click();
    await page.locator('.editor-asset').first().dblclick();
    await expect(page.locator('.timeline-clip')).toHaveCount(1);
    await page.getByRole('button', { name: 'Source browser', exact: true }).click();
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: 'Delete all (2)', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('No media was deleted');
    await expect(page.locator('.media-card')).toHaveCount(2);
    const project = await page.evaluate(async () => (await window.opencut.projects.open((await window.opencut.projects.last())!)).project);
    expect(Object.keys(project.media)).toHaveLength(2);
    expect(project.tracks.flatMap(track => track.clips)).toHaveLength(1);
  } finally { await app.close(); }
});
