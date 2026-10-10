import { test, expect, _electron as electron } from '@playwright/test';
import { resolve, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { makeTextClip } from '../../src/renderer/engine/text';
import { runProcess } from '../../src/main/services/process';
import { ffmpegPath } from '../../src/main/services/tools';

test('preview move, resize and rotation update while pressed, cancel and commit one undo step', async () => {
  const app = await electron.launch({ executablePath: process.env.OPENCUT_EXECUTABLE, args: process.env.OPENCUT_EXECUTABLE ? [] : ['.'], env: { ...process.env, OPENCUT_TEST_DATA: resolve('.test-data/preview-gestures-' + randomUUID()) } });
  try {
    const page = await app.firstWindow(), clip = makeTextClip('title', 'titles', 0); clip.content = 'Move';
    await page.evaluate(async clip => {
      const project = await window.opencut.projects.create('Live preview', { width: 640, height: 360, fps: 30, sampleRate: 48000 });
      project.tracks = [{ id: 'titles', kind: 'text', name: 'Titles', locked: false, hidden: false, muted: false, clips: [clip] }];
      await window.opencut.projects.saveEdit(project);
    }, clip);
    await page.getByRole('button', { name: 'Open projects', exact: true }).click(); await page.getByRole('button', { name: 'Open timeline', exact: true }).click();
    await page.locator('[data-clip-id="title"]').click();
    const canvas = page.locator('.canvas-surface canvas'), box = page.locator('.transform-box');
    await canvas.scrollIntoViewIfNeeded(); await expect(box).toBeVisible();
    const centroid = () => canvas.evaluate(element => {
      const canvas = element as HTMLCanvasElement, pixels = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
      let n = 0, sum = 0; for (let i = 0; i < pixels.length; i += 4) if (pixels[i] > 180 && pixels[i + 1] > 180 && pixels[i + 2] > 180) { sum += (i / 4) % canvas.width; n++; }
      return n ? sum / n / canvas.width : 0;
    });
    await expect.poll(centroid).toBeGreaterThan(.4);
    const initial = await centroid(), bounds = (await canvas.boundingBox())!, original = (await box.boundingBox())!;
    const start = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
    await page.mouse.move(start.x, start.y); await page.mouse.down();
    for (const delta of [20, 40, 60]) {
      await page.mouse.move(start.x + delta, start.y + 15, { steps: 3 });
      await expect.poll(async () => Math.round((await box.boundingBox())!.x - original.x)).toBe(delta);
      await expect.poll(centroid).toBeGreaterThan(initial + (delta - 5) / bounds.width);
    }
    await page.mouse.up(); await page.keyboard.press('Control+z');
    await expect.poll(centroid).toBeCloseTo(initial, 2);
    await page.locator('[data-clip-id="title"]').click(); await canvas.scrollIntoViewIfNeeded();
    const scale = page.getByRole('button', { name: 'Scale selected clip', exact: true }), handle = (await scale.boundingBox())!, before = (await box.boundingBox())!;
    await page.mouse.move(handle.x + 7, handle.y + 7); await page.mouse.down(); await page.mouse.move(handle.x + 57, handle.y + 27, { steps: 8 });
    await expect.poll(async () => (await box.boundingBox())!.width).toBeGreaterThan(before.width + 50);
    await page.keyboard.press('Escape'); await page.mouse.up();
    await expect.poll(async () => (await box.boundingBox())!.width).toBeCloseTo(before.width, 0);
    const nextHandle = (await scale.boundingBox())!;
    await page.mouse.move(nextHandle.x + 7, nextHandle.y + 7); await page.mouse.down(); await page.mouse.move(nextHandle.x + 37, nextHandle.y + 17, { steps: 6 });
    await expect.poll(async () => (await box.boundingBox())!.width).toBeGreaterThan(before.width + 30);
    await page.mouse.up(); await page.keyboard.press('Control+z'); await page.locator('[data-clip-id="title"]').click(); await canvas.scrollIntoViewIfNeeded();
    await expect.poll(async () => (await box.boundingBox())!.width).toBeCloseTo(before.width, 0);
    const rotate = (await page.getByRole('button', { name: 'Rotate selected clip', exact: true }).boundingBox())!;
    await page.mouse.move(rotate.x + 7, rotate.y + 7); await page.mouse.down(); await page.mouse.move(rotate.x + 47, rotate.y + 7, { steps: 6 });
    await expect.poll(() => box.evaluate(element => Math.abs(new DOMMatrix(getComputedStyle(element).transform).b))).toBeGreaterThan(.1);
    await page.mouse.up(); await page.keyboard.press('Control+z');
    await expect(page.getByRole('button', { name: 'Undo (Ctrl+Z)', exact: true })).toBeDisabled();
    await expect(page.getByRole('alert')).toHaveCount(0);
  } finally { await app.evaluate(({ app }) => app.exit(0)).catch(() => {}); await app.close().catch(() => {}); }
});

test('drag text, video and audio directly into new and existing tracks with placement preview and undo', async () => {
  const root = resolve('.test-data/direct-drop-' + randomUUID()); await mkdir(root, { recursive: true });
  const video = join(root, 'clip.mp4'), audio = join(root, 'tone.wav');
  await runProcess(ffmpegPath, ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=size=320x240:duration=1', '-c:v', 'libx264', video]);
  await runProcess(ffmpegPath, ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'sine=duration=1', audio]);
  const app = await electron.launch({ executablePath: process.env.OPENCUT_EXECUTABLE, args: process.env.OPENCUT_EXECUTABLE ? [] : ['.'], env: { ...process.env, OPENCUT_TEST_DATA: join(root, 'app') } });
  try {
    const page = await app.firstWindow();
    await app.evaluate(({ dialog }, paths) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: paths }); }, [video, audio]);
    await page.evaluate(async () => { const project = await window.opencut.projects.create('Direct drops', { width: 640, height: 360, fps: 30, sampleRate: 48000 }); await window.opencut.media.pick(project.id); });
    await page.getByRole('button', { name: 'Open projects', exact: true }).click(); await page.getByRole('button', { name: 'Open timeline', exact: true }).click();
    await expect(page.getByLabel('Add track', { exact: true })).toHaveCount(0);
    // Native dragover exposes only MIME types; the library drag state supplies
    // duration/type for a placement preview before the payload can be read.
    const transfer = await page.evaluateHandle(() => new DataTransfer());
    await page.locator('.library-text-tile').dispatchEvent('dragstart', { dataTransfer: transfer });
    const destination = page.locator('.new-track-zone.bottom'), rect = (await destination.boundingBox())!;
    for (const x of [80, 160]) {
      await destination.dispatchEvent('dragover', { dataTransfer: transfer, clientX: rect.x + x, clientY: rect.y + 20 });
      await expect(page.locator('.drop-ghost')).toHaveCSS('left', `${x}px`);
      await expect(page.locator('.drop-ghost')).toContainText('New track');
    }
    await page.locator('.library-text-tile').dispatchEvent('dragend', { dataTransfer: transfer });
    await expect(page.locator('.drop-ghost')).toHaveCount(0); await transfer.dispose();
    await page.locator('.library-text-tile').dragTo(page.locator('.new-track-zone.bottom'), { targetPosition: { x: 80, y: 30 } });
    await expect(page.locator('.timeline-clip.text')).toHaveCount(1);
    await expect(page.locator('.timeline-clip.text')).toHaveCSS('left', '80px');
    // Media dropped onto an incompatible text track creates a video track above it.
    await page.locator('.editor-asset').filter({ hasText: 'clip.mp4' }).dragTo(page.locator('.track-lane').first(), { targetPosition: { x: 1, y: 30 } });
    await expect(page.locator('.timeline-clip.video')).toHaveCount(1);
    await page.locator('.new-track-zone.bottom').scrollIntoViewIfNeeded();
    await page.locator('.editor-asset').filter({ hasText: 'tone.wav' }).dragTo(page.locator('.new-track-zone.bottom'), { targetPosition: { x: 160, y: 30 } });
    await expect(page.locator('.timeline-clip.audio')).toHaveCount(1);
    await page.locator('.editor-asset').filter({ hasText: 'clip.mp4' }).dragTo(page.locator('.track-lane').filter({ has: page.locator('.timeline-clip.video') }), { targetPosition: { x: 80, y: 30 } });
    await expect(page.locator('.timeline-clip.video')).toHaveCount(2); await expect(page.locator('.track-row')).toHaveCount(3);
    await page.keyboard.press('Control+z'); await expect(page.locator('.timeline-clip.video')).toHaveCount(1);
    await page.keyboard.press('Control+z'); await expect(page.locator('.track-row')).toHaveCount(2);
    await page.keyboard.press('Control+Shift+z'); await expect(page.locator('.track-row')).toHaveCount(3);
    await expect(page.getByRole('alert')).toHaveCount(0);
    await page.screenshot({ path: 'test-results/direct-drag-editing.png', fullPage: true });
    await page.getByRole('button', { name: 'Source browser', exact: true }).click(); await expect(page.getByRole('heading', { name: 'Media library' })).toBeVisible();
    const saved = await page.evaluate(async () => (await window.opencut.projects.open((await window.opencut.projects.last())!)).project);
    expect(saved.tracks.map(track => track.kind)).toEqual(['audio', 'text', 'video']);
    expect(saved.tracks[0].clips[0].start).toBe(2e6); expect(saved.tracks[1].clips[0].start).toBe(1e6);
  } finally { await app.evaluate(({ app }) => app.exit(0)).catch(() => {}); await app.close().catch(() => {}); }
});
