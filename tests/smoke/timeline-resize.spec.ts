import { test, expect, _electron as electron } from '@playwright/test';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

test('timeline divider resizes both panels, clamps and resets without changing the edit', async () => {
  const app = await electron.launch({ args: ['.'], env: { ...process.env, OPENCUT_TEST_DATA: resolve('.test-data/timeline-resize-' + randomUUID()) } });
  try {
    const page = await app.firstWindow();
    await page.evaluate(() => window.opencut.projects.create('Resizable timeline', { width: 1920, height: 1080, fps: 30, sampleRate: 48000 }));
    await page.getByRole('button', { name: 'Open projects', exact: true }).click();
    await page.getByRole('button', { name: 'Open timeline', exact: true }).click();
    const divider = page.getByRole('separator', { name: 'Resize timeline panel' });
    const timeline = page.locator('.timeline'), top = page.locator('.editor-top');
    const height = async () => (await timeline.boundingBox())!.height;
    const before = await height();
    const handle = (await divider.boundingBox())!;
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
    await page.mouse.down();
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2 - 80, { steps: 10 });
    await page.mouse.up();
    expect(await height()).toBeGreaterThan(before + 60);
    const expanded = await height();
    await page.mouse.move(10, 10);
    expect(await height()).toBe(expanded);
    await divider.focus();
    await page.keyboard.press('ArrowDown');
    expect(await height()).toBeCloseTo(expanded - 20, 0);
    await page.keyboard.press('Home');
    expect((await top.boundingBox())!.height).toBeCloseTo(240, 0);
    await page.keyboard.press('End');
    expect(await height()).toBeGreaterThanOrEqual(180);
    await divider.dblclick();
    expect(await height()).toBeCloseTo(before, 0);
    await page.screenshot({ path: 'test-results/timeline-resize.png', fullPage: true });
    const project = await page.evaluate(async () => (await window.opencut.projects.open((await window.opencut.projects.last())!)).project);
    expect(project.tracks.flatMap(track => track.clips)).toHaveLength(0);
  } finally { await app.close(); }
});
