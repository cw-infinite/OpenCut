import { test, expect, _electron as electron } from '@playwright/test';
import { resolve, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { captionClip } from '../../src/renderer/engine/captionImport';
import { mkdir } from 'node:fs/promises';
import { runProcess } from '../../src/main/services/process';
import { ffmpegPath } from '../../src/main/services/tools';

test('marquee in all directions, toggles, live group drag, bulk edits, duplicate/delete and portrait zoom/fullscreen', async () => {
  test.setTimeout(90000);
  const root = resolve('.test-data/usability-' + randomUUID());
  const app = await electron.launch({ executablePath: process.env.OPENCUT_EXECUTABLE, args: process.env.OPENCUT_EXECUTABLE ? [] : ['.'], env: { ...process.env, OPENCUT_TEST_DATA: root } });
  try {
    const page = await app.firstWindow();
    const clips = [[1, 'bottom', 'a'], [3, 'bottom', 'b'], [1.5, 'top', 'c'], [5.5, 'top', 'd']].map(([time, track, id]) => captionClip({ text: String(id), start: Number(time) * 1e6, end: (Number(time) + 1) * 1e6, words: [] }, String(track), String(id)));
    await page.evaluate(async clips => {
      const project = await window.opencut.projects.create('Portrait editing', { width: 1080, height: 1920, fps: 30, sampleRate: 48000 });
      project.tracks = ['bottom', 'top'].map(id => ({ id, name: id, kind: 'text', locked: false, muted: false, hidden: false, clips: clips.filter(clip => clip.trackId === id) })); await window.opencut.projects.saveEdit(project);
    }, clips);
    await page.getByRole('button', { name: 'Open projects', exact: true }).click(); await page.getByRole('button', { name: 'Open timeline', exact: true }).click();
    await page.locator('[data-track-id="bottom"]').scrollIntoViewIfNeeded();
    const ruler = (await page.locator('.ruler').boundingBox())!, top = (await page.locator('[data-track-id="top"]').boundingBox())!, bottom = (await page.locator('[data-track-id="bottom"]').boundingBox())!;
    const corners = [{ x: ruler.x + 40, y: top.y + 2 }, { x: ruler.x + 340, y: bottom.y + 80 }];
    for (const [sx, sy, ex, ey] of [[0, 0, 1, 1], [1, 1, 0, 0], [0, 1, 1, 0], [1, 0, 0, 1]]) {
      await page.mouse.move(corners[sx].x, corners[sy].y); await page.mouse.down(); await page.mouse.move(corners[ex].x, corners[ey].y, { steps: 10 });
      await expect(page.locator('.selected-clip')).toHaveCount(3);
      await expect(page.locator('.selection-marquee')).toContainText('3 selected');
      await expect.poll(async () => {
        const marquee = (await page.locator('.selection-marquee').boundingBox())!;
        return Math.max(Math.abs(marquee.x + (ex ? marquee.width : 0) - corners[ex].x), Math.abs(marquee.y + (ey ? marquee.height : 0) - corners[ey].y));
      }).toBeLessThan(3);
      await page.mouse.up();
      await expect(page.locator('.selected-clip')).toHaveCount(3);
    }
    await page.locator('[data-clip-id="b"]').click({ modifiers: ['Shift'] }); await expect(page.locator('.selected-clip')).toHaveCount(2);
    await page.locator('[data-clip-id="b"]').click({ modifiers: ['Shift'] }); await expect(page.locator('.selected-clip')).toHaveCount(3);
    await page.getByLabel('Selection font size').fill('72');
    await page.getByTitle('Snapping', { exact: true }).click();
    const before = (await page.locator('[data-clip-id="a"]').boundingBox())!, partner = (await page.locator('[data-clip-id="c"]').boundingBox())!;
    await page.mouse.move(before.x + 30, before.y + 30); await page.mouse.down(); await page.mouse.move(before.x + 110, before.y + 30, { steps: 12 });
    await expect.poll(async () => Math.round((await page.locator('[data-clip-id="a"]').boundingBox())!.x - before.x)).toBe(80);
    await expect.poll(async () => Math.round((await page.locator('[data-clip-id="c"]').boundingBox())!.x - partner.x)).toBe(80);
    await page.mouse.up(); await page.keyboard.press('Control+z');
    await expect.poll(async () => Math.round((await page.locator('[data-clip-id="a"]').boundingBox())!.x)).toBe(Math.round(before.x));
    // Reselect all three and duplicate the complete span with one keyboard action.
    await page.mouse.move(corners[0].x, corners[0].y); await page.mouse.down(); await page.mouse.move(corners[1].x, corners[1].y, { steps: 10 }); await page.mouse.up();
    await page.keyboard.press('Control+d'); await expect(page.locator('.timeline-clip')).toHaveCount(7); await expect(page.locator('.selected-clip')).toHaveCount(3);
    await page.keyboard.press('Delete'); await expect(page.locator('.timeline-clip')).toHaveCount(4);
    await page.keyboard.press('Control+z'); await expect(page.locator('.timeline-clip')).toHaveCount(7);
    await page.keyboard.press('Control+z'); await expect(page.locator('.timeline-clip')).toHaveCount(4);
    const canvas = page.locator('.canvas-surface canvas');
    const fit = (await canvas.boundingBox())!; expect(fit.width / fit.height).toBeCloseTo(1080 / 1920, 2);
    await page.getByRole('button', { name: 'Zoom preview in', exact: true }).click();
    await expect.poll(async () => (await canvas.boundingBox())!.height).toBeGreaterThan(fit.height * 1.15);
    await page.getByRole('button', { name: 'Fit preview', exact: true }).click();
    await page.getByRole('button', { name: 'Fullscreen preview', exact: true }).click();
    await expect.poll(() => page.evaluate(() => document.fullscreenElement?.className)).toBe('preview-panel');
    await expect(page.getByRole('button', { name: 'Exit fullscreen preview', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Exit fullscreen preview', exact: true }).click(); await expect.poll(() => page.evaluate(() => document.fullscreenElement === null)).toBe(true);
    await page.getByRole('button', { name: 'Fullscreen preview', exact: true }).click();
    await expect.poll(() => page.evaluate(() => document.fullscreenElement !== null)).toBe(true);
    await page.keyboard.press('Escape'); await expect.poll(() => page.evaluate(() => document.fullscreenElement === null)).toBe(true);
    expect(await page.locator('.timeline-clip strong').first().evaluate(element => parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(14);
    await page.screenshot({ path: 'test-results/editing-usability.png', fullPage: true });
    await page.getByRole('button', { name: 'Source browser', exact: true }).click();
    const project = await page.evaluate(async () => (await window.opencut.projects.open((await window.opencut.projects.last())!)).project);
    for (const clip of project.tracks.flatMap(track => track.clips).filter(clip => ['a', 'b', 'c'].includes(clip.id))) { expect(clip.type).toBe('text'); if (clip.type === 'text') expect(clip.style.fontSize).toBe(72); }
  } finally { await app.evaluate(({ app }) => app.exit(0)).catch(() => {}); await app.close().catch(() => {}); }
});

test('bulk media volume and mute persist and the bulk delete action is undoable', async () => {
  const root = resolve('.test-data/bulk-media-' + randomUUID()); await mkdir(root, { recursive: true });
  const path = join(root, 'tone.wav'); await runProcess(ffmpegPath, ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=1', path]);
  const app = await electron.launch({ executablePath: process.env.OPENCUT_EXECUTABLE, args: process.env.OPENCUT_EXECUTABLE ? [] : ['.'], env: { ...process.env, OPENCUT_TEST_DATA: join(root, 'app') } });
  try {
    const page = await app.firstWindow(); await page.evaluate(() => window.opencut.projects.create('Bulk audio', { width: 1920, height: 1080, fps: 30, sampleRate: 48000 }));
    await page.getByRole('button', { name: 'Open projects', exact: true }).click();
    await app.evaluate(({ dialog }, path) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path] }); }, path);
    await page.locator('.import-button').click(); await expect(page.locator('.media-card')).toHaveCount(1);
    await page.getByRole('button', { name: 'Open timeline', exact: true }).click();
    await page.locator('.editor-asset').dblclick(); await page.locator('.editor-asset').dblclick();
    await page.locator('.timeline-clip').first().click(); await page.locator('.timeline-clip').last().click({ modifiers: ['Shift'] });
    await page.getByLabel('Selection volume', { exact: true }).fill('0.4'); await page.getByLabel('Mute selected clips', { exact: true }).check();
    await page.getByRole('button', { name: 'Delete all selected', exact: true }).click(); await expect(page.locator('.timeline-clip')).toHaveCount(0);
    await page.getByTitle('Undo (Ctrl+Z)', { exact: true }).click(); await expect(page.locator('.timeline-clip')).toHaveCount(2);
    await page.getByRole('button', { name: 'Source browser', exact: true }).click();
    const project = await page.evaluate(async () => (await window.opencut.projects.open((await window.opencut.projects.last())!)).project);
    for (const clip of project.tracks.flatMap(track => track.clips)) expect(clip).toMatchObject({ type: 'media', muted: true, volume: { value: .4 } });
  } finally { await app.evaluate(({ app }) => app.exit(0)).catch(() => {}); await app.close().catch(() => {}); }
});
