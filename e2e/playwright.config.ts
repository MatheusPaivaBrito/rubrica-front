import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: 'pdf-mobile.spec.ts',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  reporter: 'list',
  use: {
    baseURL: process.env['PDF_E2E_BASE_URL'] || 'http://127.0.0.1:18080',
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'iphone-antigo', use: { ...devices['iPhone 8'], browserName: 'webkit' } },
    { name: 'iphone-novo', use: { ...devices['iPhone 13'], browserName: 'webkit' } },
    { name: 'android-antigo', use: { ...devices['Pixel 2'], browserName: 'chromium' } },
    { name: 'android-novo', use: { ...devices['Pixel 7'], browserName: 'chromium' } },
    { name: 'pc', use: { ...devices['Desktop Chrome'], browserName: 'chromium' } },
  ],
});
