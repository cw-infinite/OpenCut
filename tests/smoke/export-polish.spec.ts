import { test, expect, _electron as electron } from '@playwright/test';
import { resolve, join } from 'node:path';
import { mkdir, readdir, readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { captionClip } from '../../src/renderer/engine/captionImport';
import { runProcess } from '../../src/main/services/process';
import { ffprobePath } from '../../src/main/services/tools';

test('batch resolutions, portrait preset and full-size frame images export locally', async () => {
  test.setTimeout(180000);
  const root = resolve('.test-data/export-polish-' + randomUUID()); await mkdir(root, { recursive: true });
  const app = await electron.launch({ executablePath: process.env.OPENCUT_EXECUTABLE, args: process.env.OPENCUT_EXECUTABLE ? [] : ['.'], env: { ...process.env, OPENCUT_TEST_DATA: join(root, 'app') } });
  try {
    const page = await app.firstWindow();
    await page.evaluate(async clip => {
      const project = await window.opencut.projects.create('Export polish', { width: 1920, height: 1080, fps: 30, sampleRate: 48000 });
      project.tracks = [{ id: 'captions', kind: 'text', name: 'Captions', hidden: false, muted: false, locked: false, clips: [clip] }];
      await window.opencut.projects.saveEdit(project);
    }, captionClip({ text: 'OpenCut frame', start: 0, end: 500000, words: [] }, 'captions', 'c1'));
    await page.getByRole('button', { name: 'Open projects', exact: true }).click();
    await page.getByRole('button', { name: 'Open timeline', exact: true }).click();
    await page.getByLabel('Save current frame').selectOption('cover');
    await expect(page.getByLabel('Save current frame')).toContainText('Cover saved');
    const covers = await page.evaluate(async () => {
      const original = (await window.opencut.projects.list())[0];
      await window.opencut.projects.duplicate(original.id);
      return Promise.all((await window.opencut.projects.list()).map(async project => ({ cover: project.cover, status: project.cover ? (await fetch(project.cover)).status : 0 })));
    });
    expect(covers).toHaveLength(2); expect(covers.every(cover => cover.cover && cover.status === 200)).toBe(true);
    for (const format of ['png', 'jpg']) {
      const output = join(root, 'frame.' + format);
      await app.evaluate(({ dialog }, path) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: path }); }, output);
      await page.getByLabel('Save current frame').selectOption(format);
      await expect.poll(async () => (await readdir(root)).includes('frame.' + format)).toBe(true);
      const probe = JSON.parse(await runProcess(ffprobePath, ['-v', 'error', '-show_streams', '-of', 'json', output]));
      expect(probe.streams[0]).toMatchObject({ width: 1920, height: 1080 });
      expect((await readFile(output)).length).toBeGreaterThan(5000);
    }
    await app.evaluate(({ dialog }, folder) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [folder] }); }, root);
    await page.getByRole('button', { name: 'Export', exact: true }).click();
    await page.getByLabel('Encoder', { exact: true }).selectOption('software');
    await page.getByLabel('Batch export resolutions').check();
    await page.getByRole('button', { name: 'Export batch', exact: true }).click();
    await expect(page.getByText('Export complete', { exact: true })).toBeVisible({ timeout: 90000 });
    await expect(page.getByText('Output 3 of 3', { exact: true })).toBeVisible();
    const files = (await readdir(root)).filter(name => name.endsWith('.mp4')); expect(files).toHaveLength(3);
    for (const resolution of [1080, 720, 480]) {
      const file = files.find(name => name.includes('-' + resolution + 'p-'))!;
      const probe = JSON.parse(await runProcess(ffprobePath, ['-v', 'error', '-show_streams', '-of', 'json', join(root, file)]));
      expect(probe.streams.find((stream: { codec_type: string }) => stream.codec_type === 'video')).toMatchObject({ height: resolution, r_frame_rate: '30/1' });
    }
    await page.getByLabel('Batch export resolutions').uncheck();
    await page.getByLabel('Platform preset').selectOption('TikTok');
    const portrait = join(root, 'portrait.mp4');
    await app.evaluate(({ dialog }, path) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: path }); }, portrait);
    await page.getByRole('button', { name: 'Export MP4', exact: true }).click();
    await expect(page.getByText('Export complete', { exact: true })).toBeVisible({ timeout: 90000 });
    const probe = JSON.parse(await runProcess(ffprobePath, ['-v', 'error', '-show_streams', '-of', 'json', portrait]));
    expect(probe.streams[0]).toMatchObject({ width: 1080, height: 1920, r_frame_rate: '30/1' });
    await page.screenshot({ path: 'test-results/export-polish.png', fullPage: true });
    const cancelFolder = join(root, 'cancel'); await mkdir(cancelFolder);
    await app.evaluate(({ dialog }, folder) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [folder] }); }, cancelFolder);
    const canceled = await page.evaluate(async () => {
      const projectId = (await window.opencut.projects.last())!;
      return new Promise<{ stage: string; outputs: string[] }>((resolve, reject) => {
        const timer = setTimeout(() => { unsubscribe(); reject(new Error('Cancel did not complete')); }, 30000);
        const unsubscribe = window.opencut.export.onProgress(progress => {
          if (progress.stage === 'queued') void window.opencut.export.cancel();
          if (['complete', 'canceled', 'error'].includes(progress.stage)) { clearTimeout(timer); unsubscribe(); resolve({ stage: progress.stage, outputs: progress.batch?.outputs ?? [] }); }
        });
        void window.opencut.export.batch(([480, 1080, 720] as const).map(resolution => ({ projectId, format: 'mp4', resolution, fps: 30, quality: 'high', bitrateMbps: 8, audioBitrate: 192, encoderPreference: 'software' }))).catch(reject);
      });
    });
    expect(canceled.stage).toBe('canceled'); expect(canceled.outputs).toHaveLength(1);
    expect((await readdir(cancelFolder)).sort()).toEqual(canceled.outputs.map(path => path.split(/[\\/]/).pop()!).sort());
  } finally { await app.evaluate(({ app }) => app.exit(0)).catch(() => {}); await app.close().catch(() => {}); }
});
