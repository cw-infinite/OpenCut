import { test, expect, _electron as electron } from '@playwright/test';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

test('tag projects, combine filters with search, reuse and remove tags', async () => {
  const app = await electron.launch({ args: ['.'], env: { ...process.env, OPENCUT_TEST_DATA: resolve('.test-data/project-tags-' + randomUUID()) } });
  try {
    const page = await app.firstWindow();
    await page.evaluate(async () => {
      for (const name of ['Client intro', 'Client outro', 'Personal trip']) await window.opencut.projects.create(name, { width: 1920, height: 1080, fps: 30, sampleRate: 48000 });
    });
    await page.getByRole('button', { name: 'Open projects', exact: true }).click();
    await page.getByRole('button', { name: 'Projects', exact: true }).click();
    await page.getByLabel('Edit tags for Client intro', { exact: true }).click();
    await page.getByRole('textbox', { name: 'Project tags', exact: true }).fill('Work, Draft, work');
    await page.getByRole('button', { name: 'Save tags', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.getByLabel('Edit tags for Client outro', { exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'work', exact: true }).click();
    await page.getByRole('button', { name: 'Save tags', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    const filter = page.getByLabel('Filter projects by tag');
    await filter.selectOption('tag:work');
    await expect(page.locator('.project-card')).toHaveCount(2);
    await page.getByLabel('Search projects').fill('intro');
    await expect(page.locator('.project-card')).toHaveCount(1);
    await page.getByRole('button', { name: 'Simple list', exact: true }).click();
    await expect(page.locator('.project-simple-list li')).toHaveCount(1);
    await page.getByRole('button', { name: 'Detailed list', exact: true }).click();
    await expect(page.locator('.project-table tbody tr')).toHaveCount(1);
    await page.getByLabel('Search projects').fill('');
    await filter.selectOption('untagged');
    await expect(page.locator('.project-table tbody')).toContainText('Personal trip');
    await filter.selectOption('tag:work');
    await page.getByLabel('Edit tags for Client outro', { exact: true }).click();
    await page.getByRole('textbox', { name: 'Project tags', exact: true }).fill('');
    await page.getByRole('button', { name: 'Save tags', exact: true }).click();
    await expect(page.locator('.project-table tbody tr')).toHaveCount(1);
    await filter.selectOption('all');
    await page.getByRole('button', { name: 'Cards', exact: true }).click();
    await page.screenshot({ path: 'test-results/project-tags.png', fullPage: true });
    const tags = await page.evaluate(async () => (await window.opencut.projects.list()).find(project => project.name === 'Client intro')!.tags);
    expect(tags).toEqual(['work', 'Draft']);
  } finally { await app.close(); }
});
