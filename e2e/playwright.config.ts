import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

// Load .env BEFORE the runner imports any spec / util so process.env is
// populated when utils/testData.ts evaluates.
dotenv.config();

export default defineConfig({
  testDir: './tests',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  workers: 1,
  retries: process.env.CI ? 0 : 0,
  reporter: process.env.CI
    ? [
        ['blob', { outputDir: 'blob-report' }],
        ['./utils/featureMapReporter.ts'],
      ]
    : [
        ['list'],
        ['html', { open: 'never', outputFolder: 'playwright-report' }],
        ['./utils/featureMapReporter.ts'],
      ],
  use: {
    baseURL: process.env.BASE_URL || process.env.APP_URL || 'https://evo.dev.theysaid.io',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    headless: true,
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
