import { defineConfig } from '@playwright/test';
export default defineConfig({ testDir: './tests/stability', timeout: 300000, workers: 1, reporter: 'list', outputDir: 'test-results/stability' });
