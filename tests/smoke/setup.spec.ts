import { test, expect, _electron as electron } from '@playwright/test';
import { resolve } from 'node:path';

test('desktop launch, sandboxed bridge, and real local tool checks', async () => {
  const app = await electron.launch({ args: ['.'], env: { ...process.env, OPENCUT_TEST_DATA: resolve('.test-data/electron') } });
  try {
    const page = await app.firstWindow();
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await expect(page.getByRole('heading', { name: 'Prepare your workspace' })).toBeVisible();
    const report = await page.evaluate(() => window.opencut.checkTools());
    expect(report.tools.filter(tool => tool.id === 'ffmpeg' || tool.id === 'ffprobe').every(tool => tool.ready)).toBe(true);
    const sandbox = await page.evaluate(() => ({ node: typeof (globalThis as Record<string, unknown>).require, bridge: typeof window.opencut.checkTools }));
    expect(sandbox).toEqual({ node: 'undefined', bridge: 'function' });
    if (report.ready) await expect(page.getByText('Tools OK', { exact: true })).toBeVisible();
    await page.screenshot({ path: 'test-results/setup.png', fullPage: true });
    expect(errors).toEqual([]);
  } finally { await app.close(); }
});
