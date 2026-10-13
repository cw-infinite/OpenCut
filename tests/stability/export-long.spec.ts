import { test, expect, _electron as electron } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { makeMediaClip, makeTrack } from '../../src/renderer/engine/timeline';
import { makeTextClip } from '../../src/renderer/engine/text';
import { runProcess } from '../../src/main/services/process';
import { ffmpegPath, ffprobePath } from '../../src/main/services/tools';

test('one-hour MP4 preserves flash/beep synchronization and bounded export memory', async () => {
  test.skip(process.env.OPENCUT_LONG_EXPORT !== '1', 'Explicit long-running acceptance: set OPENCUT_LONG_EXPORT=1');
  test.setTimeout(45 * 60 * 1000);
  const root = resolve('.test-data/long-export-' + randomUUID()); await mkdir(root, { recursive: true });
  const white = join(root, 'white.png'), beep = join(root, 'beep.wav'), output = join(root, 'one-hour.mp4');
  await runProcess(ffmpegPath, ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=white:s=320x180', '-frames:v', '1', white]);
  await runProcess(ffmpegPath, ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'sine=frequency=1000:duration=0.1:sample_rate=48000', beep]);
  const app = await electron.launch({ executablePath: process.env.OPENCUT_EXECUTABLE, args: process.env.OPENCUT_EXECUTABLE ? [] : ['.'], env: { ...process.env, OPENCUT_TEST_DATA: join(root, 'app') } });
  try {
    const page = await app.firstWindow();
    await app.evaluate(({ dialog }, paths) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: paths }); }, [white, beep]);
    const p = await page.evaluate(async () => { const p = await window.opencut.projects.create('One-hour sync acceptance', { width: 1920, height: 1080, fps: 30, sampleRate: 48000 }); return window.opencut.media.pick(p.id); });
    const title = makeTrack('title', 'text', 'Duration'), video = makeTrack('flash', 'video', 'Flash'), audio = makeTrack('beep', 'audio', 'Beep');
    const text = makeTextClip('duration-title', title.id, 0); text.content = 'One-hour timing acceptance'; text.duration = 3600e6; title.clips.push(text);
    for (const [i, start] of [500000, 3599500000].entries()) {
      const flash = makeMediaClip('flash-' + i, Object.values(p.media).find(a => a.kind === 'image')!, video.id, start); flash.duration = 100000; flash.sourceOut = 100000; flash.fit = 'stretch'; video.clips.push(flash);
      audio.clips.push(makeMediaClip('beep-' + i, Object.values(p.media).find(a => a.kind === 'audio')!, audio.id, start));
    }
    p.tracks = [title, video, audio]; await page.evaluate(p => window.opencut.projects.saveEdit(p), p);
    await app.evaluate(({ dialog }, output) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: output }); }, output);
    await page.evaluate(async projectId => {
      (window as any).__longExport = null;
      window.opencut.export.onProgress(progress => { (window as any).__longExport = progress; });
      await window.opencut.export.start({ projectId, resolution: 480, fps: 30, quality: 'low', bitrateMbps: 2, audioBitrate: 128, encoderPreference: 'auto' });
    }, p.id);
    const started = Date.now(); let encoder: string | undefined;
    const samples: { frame: number; rssMiB: number; fps: number }[] = [];
    while (true) {
      await page.waitForTimeout(10000);
      const progress = await page.evaluate(() => (window as any).__longExport);
      const rssMiB = await app.evaluate(({ app }) => app.getAppMetrics().reduce((sum, item) => sum + item.memory.workingSetSize / 1024, 0));
      if (progress) {
        encoder = progress.encoder ?? encoder;
        samples.push({ frame: progress.frame, fps: progress.fps, rssMiB });
        if (samples.length % 3 === 0 || ['complete', 'error', 'canceled'].includes(progress.stage)) console.log('Long export:', progress.stage, progress.frame, '/', progress.total, 'fps', Math.round(progress.fps), 'app MiB', Math.round(rssMiB));
        expect(progress.stage, progress.message).not.toBe('error'); expect(progress.stage).not.toBe('canceled');
        if (progress.stage === 'complete') break;
      }
    }
    const meta = JSON.parse(await runProcess(ffprobePath, ['-v', 'error', '-show_streams', '-of', 'json', output]));
    const durations = meta.streams.map((s: any) => Number(s.duration));
    expect(Math.max(...durations) - Math.min(...durations)).toBeLessThan(1 / 30);
    expect(durations[0]).toBeCloseTo(3600, 2);
    const offsets: number[] = [];
    for (const start of [0, 3598]) {
      const pcm = join(root, `audio-${start}.pcm`), pixels = join(root, `video-${start}.rgb`);
      await runProcess(ffmpegPath, ['-v', 'error', '-y', '-ss', String(start), '-i', output, '-t', '2', '-vn', '-ac', '1', '-ar', '48000', '-f', 'f32le', pcm]);
      await runProcess(ffmpegPath, ['-v', 'error', '-y', '-ss', String(start), '-i', output, '-t', '2', '-an', '-vf', 'scale=1:1:flags=area', '-pix_fmt', 'rgb24', '-f', 'rawvideo', pixels]);
      const sound = await readFile(pcm), frames = await readFile(pixels);
      let onset = -1; for (let i = 0; i < sound.length; i += 4) if (Math.abs(sound.readFloatLE(i)) > .02) { onset = i / 4 / 48000; break; }
      let flash = -1; for (let i = 0; i < frames.length; i += 3) if (frames[i] > 220 && frames[i + 1] > 220 && frames[i + 2] > 220) { flash = i / 3 / 30; break; }
      expect(onset).toBeGreaterThanOrEqual(0); expect(flash).toBeGreaterThanOrEqual(0); offsets.push(onset - flash);
    }
    const active = samples.filter(s => s.frame > 1000 && s.frame < 108000), split = Math.floor(active.length / 3);
    const mean = (s: typeof samples) => s.reduce((sum, item) => sum + item.rssMiB, 0) / s.length;
    const retainedGrowthMiB = split ? mean(active.slice(-split)) - mean(active.slice(0, split)) : 0;
    const report = { output, resolution: '854x480', fps: 30, encoder, elapsedSeconds: (Date.now() - started) / 1000, durations, offsets, driftMs: Math.abs(offsets[1] - offsets[0]) * 1000, retainedGrowthMiB, samples };
    await writeFile(resolve('.test-data/long-export-latest.json'), JSON.stringify(report, null, 2)); console.log('One-hour sync:', { offsets, retainedGrowthMiB });
    expect(Math.abs(offsets[1] - offsets[0])).toBeLessThan(1 / 30);
    expect(offsets.every(offset => Math.abs(offset) < 1 / 30)).toBe(true);
    expect(retainedGrowthMiB).toBeLessThan(256);
  } finally { await app.evaluate(({ app }) => app.exit(0)).catch(() => {}); await app.close().catch(() => {}); }
});

