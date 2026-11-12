import { test, expect, _electron as electron } from '@playwright/test';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { fixtures } from '../../scripts/fixtures';

test('timeline media panel imports picked and dropped files while preserving edits and undo', async () => {
  test.setTimeout(90000);
  const media = await fixtures();
  const app = await electron.launch({ args: ['.'], env: { ...process.env, OPENCUT_TEST_DATA: resolve('.test-data/timeline-import-' + randomUUID()) } });
  try {
    const page = await app.firstWindow();
    await page.evaluate(() => window.opencut.projects.create('Timeline import', { width: 640, height: 360, fps: 30, sampleRate: 48000 }));
    await page.getByRole('button', { name: 'Open projects', exact: true }).click();
    await page.getByRole('button', { name: 'Open timeline', exact: true }).click();
    await page.getByRole('button', { name: 'Add text', exact: true }).click();
    await expect(page.locator('.timeline-clip')).toHaveCount(1);
    await app.evaluate(({ dialog }, path) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path] }); }, media.audio);
    const panel = page.getByRole('region', { name: 'Timeline media panel', exact: true });
    await panel.getByRole('button', { name: 'Import media', exact: true }).click();
    await expect(panel.locator('.editor-asset')).toHaveCount(1, { timeout: 30000 });
    await expect(panel.getByRole('button', { name: 'Import media', exact: true })).toBeEnabled();
    await expect(page.locator('.timeline-clip')).toHaveCount(1);
    await page.getByTitle('Undo (Ctrl+Z)', { exact: true }).click();
    await expect(page.locator('.timeline-clip')).toHaveCount(0);
    await expect(panel.locator('.editor-asset')).toHaveCount(1);
    await page.getByTitle('Redo (Ctrl+Y)', { exact: true }).click();
    await expect(page.locator('.timeline-clip')).toHaveCount(1);
    await panel.locator('.editor-asset').dblclick();
    await expect(page.locator('.timeline-clip')).toHaveCount(2);

    // Use a native file input so Electron receives the real filesystem path.
    await page.evaluate(() => { const input = document.createElement('input'); input.type = 'file'; input.id = 'drop-file'; input.hidden = true; document.body.append(input); });
    await page.locator('#drop-file').setInputFiles(media.image);
    await panel.evaluate(element => {
      const transfer = new DataTransfer();
      transfer.items.add((document.querySelector('#drop-file') as HTMLInputElement).files![0]);
      element.dispatchEvent(new DragEvent('dragover', { dataTransfer: transfer, bubbles: true, cancelable: true }));
    });
    await expect(panel).toHaveClass(/file-drop-active/);
    await panel.evaluate(element => {
      const transfer = new DataTransfer();
      transfer.items.add((document.querySelector('#drop-file') as HTMLInputElement).files![0]);
      element.dispatchEvent(new DragEvent('drop', { dataTransfer: transfer, bubbles: true, cancelable: true }));
      document.querySelector('#drop-file')!.remove();
    });
    await expect(panel).not.toHaveClass(/file-drop-active/);
    await expect(panel.locator('.editor-asset')).toHaveCount(2, { timeout: 30000 });
    await expect(panel.getByRole('button', { name: 'Import media', exact: true })).toBeEnabled();
    await panel.locator('.editor-asset').filter({ hasText: 'transparent.png' }).dblclick();
    await expect(page.locator('.timeline-clip')).toHaveCount(3);
    await expect(page.getByRole('alert')).toHaveCount(0);
    await page.getByRole('button', { name: 'Source browser', exact: true }).click();
    await expect(page.locator('.media-card')).toHaveCount(2);
    const saved = await page.evaluate(async () => (await window.opencut.projects.open((await window.opencut.projects.last())!)).project);
    expect(Object.keys(saved.media)).toHaveLength(2);
    expect(saved.tracks.flatMap(track => track.clips)).toHaveLength(3);
  } finally { await app.close(); }
});
