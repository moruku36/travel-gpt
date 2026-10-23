import { defineConfig, devices } from '@playwright/test';

// Runs against the production build in demo mode (no OPENAI_API_KEY), so no API cost.
// CI builds with NEXT_OUTPUT=standalone and copies static assets before running this.
export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:3100',
    trace: 'retain-on-failure',
    locale: 'ja-JP',
    timezoneId: 'Asia/Tokyo',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1400, height: 900 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'node .next/standalone/server.js',
    url: 'http://127.0.0.1:3100/api/health',
    env: { PORT: '3100', HOSTNAME: '127.0.0.1', OPENAI_API_KEY: '' },
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
