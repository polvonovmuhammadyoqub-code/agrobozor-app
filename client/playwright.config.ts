import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './test',
  use: {
    baseURL: 'http://127.0.0.1:5000',
    headless: true,
    launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
  },
  webServer: {
    command: 'node ../server/dist/index.js',
    url: 'http://127.0.0.1:5000/api/health',
    reuseExistingServer: !process.env.CI,
    env: { PORT: '5000' },
  },
});
