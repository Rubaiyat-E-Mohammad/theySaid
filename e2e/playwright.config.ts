import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

// Load .env BEFORE the runner imports any spec / util so process.env is
// populated when utils/testData.ts evaluates.
dotenv.config();

/**
 * Playwright config for the TheySaid E2E suite.
 * - 4 parallel workers (each spec signs in fresh; no shared storageState).
 * - Single chromium project; add Firefox/WebKit later by listing more projects.
 * - Reporters: list (console), html (artifact), featureMapReporter (CI summary).
 */
export default defineConfig({
  testDir: './tests',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  workers: 4,
  retries: process.env.CI ? 1 : 0,
  reporter: [
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
