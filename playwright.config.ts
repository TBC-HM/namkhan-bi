// playwright.config.ts
// Minimal Playwright config for the ADR-112 critical-path e2e suite.
// CI / local: set E2E_BASE_URL to point at the running app (defaults to
// http://localhost:3000). webServer block intentionally omitted — the
// dev server is started outside of Playwright so the same config works
// against local, preview, and prod URLs.

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
