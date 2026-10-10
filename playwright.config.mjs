import { defineConfig, devices } from '@playwright/test';
// LOCAL tests only: throwaway codes, stubbed or local relay. iPhone 15 WebKit is primary; emulation is not a real iPhone.
const chrome = { launchOptions: { executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox'] } };
export default defineConfig({
  testDir: 'tests',
  testMatch: /.*\.spec\.mjs/,
  timeout: 45_000,
  retries: 0, // flaky = fail (quality bar gate 1)
  workers: 2,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:8847/', trace: 'off', screenshot: 'off', video: 'off' },
  webServer: { command: 'OUT=.test-dist node scripts/build.mjs >/dev/null && node tests/serve.mjs .test-dist 8847', url: 'http://localhost:8847/', reuseExistingServer: false, timeout: 60_000 },
  projects: [
    { name: 'iphone-webkit', use: { ...devices['iPhone 15'] } },
    { name: 'iphone-webkit-dark', use: { ...devices['iPhone 15'], colorScheme: 'dark' } },
    { name: 'pixel-chromium', use: { ...devices['Pixel 7'], ...chrome } },
  ],
});
