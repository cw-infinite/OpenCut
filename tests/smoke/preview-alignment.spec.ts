import { test, expect, _electron as electron } from '@playwright/test';
import { resolve, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { constant } from '../../src/renderer/engine/timeline';
import { makeTextClip } from '../../src/renderer/engine/text';

test('preview alignment guides, free positioning, cancel and larger trim grips', async () => {
  const root = resolve('.test-data/alignment-' + randomUUID()); await mkdir(root, { recursive: true });
  const app = await electron.launch({ args: ['.'], env: { ...process.env, OPENCUT_TEST_DATA: join(root, 'app') } });
  try {
    const page = await app.firstWindow();
    const clip = makeTextClip('c', 't', 0); clip.duration = 3e6; clip.content = 'Drag me';
    const other = makeTextClip('other', 'other-track', 0); other.content = 'Reference'; other.transform.x = constant(.75); other.transform.y = constant(.3);
    await page.evaluate(async ({ clip, other }) => {
      const p = await window.opencut.projects.create('Alignment', { width: 1920, height: 1080, fps: 30, sampleRate: 48000 });
      p.tracks = [{ id: 't', kind: 'text', name: 'Text', hidden: false, muted: false, locked: false, clips: [clip] }, { id: 'other-track', kind: 'text', name: 'Reference', hidden: false, muted: false, locked: false, clips: [other] }];
      await window.opencut.projects.saveEdit(p);
    }, { clip, other });
    await page.getByRole('button', { name: 'Open projects', exact: true }).click();
    await page.getByRole('button', { name: 'Open timeline', exact: true }).click();
    const item = page.locator('[data-clip-id="c"]'); await item.click({ position: { x: 40, y: 35 } });
    const handle = item.locator('.trim-handle.right'); expect((await handle.boundingBox())!.width).toBe(16);
    const before = (await item.boundingBox())!; const grip = (await handle.boundingBox())!;
    await page.mouse.move(grip.x + 5, grip.y + 45); await page.mouse.down(); await page.mouse.move(grip.x + 45, grip.y + 45, { steps: 8 }); await page.mouse.up();
    await expect.poll(async () => (await item.boundingBox())!.width).toBeGreaterThan(before.width + 30);
    const canvas = (await page.locator('.canvas-surface canvas').boundingBox())!;
    const box = (await page.locator('.transform-box').boundingBox())!;
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y); await page.mouse.down();
    await page.mouse.move(canvas.x + canvas.width / 2 + 3, canvas.y + canvas.height / 2 + 3, { steps: 8 });
    await expect(page.locator('.alignment-guide')).toHaveCount(2);
    await expect.poll(async () => { const b = (await page.locator('.transform-box').boundingBox())!; return Math.abs(b.x + b.width / 2 - canvas.x - canvas.width / 2); }).toBeLessThan(1);
    await page.screenshot({ path: 'test-results/preview-alignment.png', fullPage: true });
    await page.keyboard.down('Alt'); await page.mouse.move(canvas.x + canvas.width / 2 + 4, canvas.y + canvas.height / 2 + 4);
    await expect(page.locator('.alignment-guide')).toHaveCount(0);
    await page.keyboard.up('Alt'); await page.keyboard.press('Escape'); await page.mouse.up();
    await expect(page.locator('.alignment-guides')).toHaveCount(0);
    await expect.poll(async () => (await page.locator('.transform-box').boundingBox())!.y).toBeCloseTo(box.y, 0);
    await page.mouse.move(x, y); await page.mouse.down();
    await page.mouse.move(canvas.x + canvas.width * .75 + 2, canvas.y + canvas.height * .3 + 2, { steps: 10 });
    await expect(page.locator('.alignment-guide')).toHaveCount(2);
    await expect(page.locator('.alignment-guide span').first()).toHaveText('Aligned');
    await page.mouse.up();
    await expect.poll(async () => { const b = (await page.locator('.transform-box').boundingBox())!; return Math.abs(b.x + b.width / 2 - canvas.x - canvas.width * .75); }).toBeLessThan(1);
    await expect(page.locator('.alignment-guides')).toHaveCount(0);
  } finally { await app.evaluate(({ app }) => app.exit(0)).catch(() => {}); await app.close().catch(() => {}); }
});
