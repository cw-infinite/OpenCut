import { test, expect, _electron as electron } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { cpus, totalmem } from 'node:os';
import { runProcess } from '../../src/main/services/process';
import { ffmpegPath } from '../../src/main/services/tools';
import { makeMediaClip, makeTrack } from '../../src/renderer/engine/timeline';

test('one-hour five-track timeline sustains half-quality playback and responsive selection', async () => {
  const root = resolve('.test-data/performance-' + randomUUID()); await mkdir(root, { recursive: true });
  const video = join(root, '1080p.mp4');
  await runProcess(ffmpegPath, ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=size=1920x1080:rate=30:duration=20', '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '28', '-pix_fmt', 'yuv420p', video], 120000);
  const app = await electron.launch({ executablePath: process.env.OPENCUT_EXECUTABLE, args: process.env.OPENCUT_EXECUTABLE ? [] : ['.'], env: { ...process.env, OPENCUT_TEST_DATA: join(root, 'app') } });
  try {
    const page = await app.firstWindow();
    await app.evaluate(({ dialog }, path) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path] }); }, video);
    const project = await page.evaluate(async () => { const p = await window.opencut.projects.create('One hour performance', { width: 1920, height: 1080, fps: 30, sampleRate: 48000 }); return window.opencut.media.pick(p.id); });
    const asset = Object.values(project.media)[0]; expect(asset.status).toBe('ready');
    project.tracks = Array.from({ length: 5 }, (_, layer) => {
      const track = makeTrack('track-' + layer, 'video', 'Layer ' + layer);
      track.clips = Array.from({ length: 180 }, (_, i) => {
        const clip = makeMediaClip(`clip-${layer}-${i}`, asset, track.id, i * 20e6);
        if (layer) { clip.transform.scale.value = .35; clip.transform.x.value = layer % 2 ? .25 : .75; clip.transform.y.value = layer < 3 ? .25 : .75; }
        return clip;
      }); return track;
    });
    await page.evaluate(p => window.opencut.projects.saveEdit(p), project);
    await page.getByRole('button', { name: 'Open projects', exact: true }).click(); await page.getByRole('button', { name: 'Open timeline', exact: true }).click();
    const canvas = page.locator('.canvas-surface canvas'); await expect(canvas).toHaveAttribute('data-render-time', '0');
    await page.evaluate(() => {
      const state = { frames: [] as number[], observer: null as MutationObserver | null };
      state.observer = new MutationObserver(() => state.frames.push(performance.now()));
      state.observer.observe(document.querySelector('.canvas-surface canvas')!, { attributes: true, attributeFilter: ['data-render-time'] });
      (window as any).__benchmark = state;
    });
    await page.getByRole('button', { name: 'Play or pause' }).click();
    await page.waitForTimeout(10000);
    await page.getByRole('button', { name: 'Play or pause' }).click();
    const metrics = await page.evaluate(async () => {
      const state = (window as any).__benchmark; state.observer.disconnect();
      const frames: number[] = state.frames.filter((time: number) => time >= state.frames[0] + 1000);
      const gaps = frames.slice(1).map((time, i) => time - frames[i]).sort((a, b) => a - b);
      const target = document.querySelector('[data-clip-id="clip-4-0"]')!;
      const start = performance.now();
      const latency = await new Promise<number>(resolve => {
        const observer = new MutationObserver(() => { if (target.classList.contains('selected-clip')) { observer.disconnect(); resolve(performance.now() - start); } });
        observer.observe(target, { attributes: true, attributeFilter: ['class'] });
        target.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerId: 1, clientX: 220, clientY: 600 }));
        window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, pointerId: 1, clientX: 220, clientY: 600 }));
      });
      return { fps: (frames.length - 1) * 1000 / (frames.at(-1)! - frames[0]), p95FrameMs: gaps[Math.floor(gaps.length * .95)], selectionMs: latency, clips: document.querySelectorAll('.timeline-clip').length };
    });
    const report = { ...metrics, cpu: cpus()[0].model, ramGiB: Math.round(totalmem() / 2 ** 30), root };
    await writeFile(resolve('.test-data/performance-latest.json'), JSON.stringify(report, null, 2)); console.log('Performance:', report);
    expect(metrics.fps).toBeGreaterThanOrEqual(24); expect(metrics.selectionMs).toBeLessThan(100);
    await expect(page.getByRole('alert')).toHaveCount(0);
  } finally { await app.evaluate(({ app }) => app.exit(0)).catch(() => {}); await app.close().catch(() => {}); }
});
