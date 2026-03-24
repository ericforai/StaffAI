import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  retries: 0,
  use: {
    baseURL: 'http://127.0.0.1:3008',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run dev -- --hostname 127.0.0.1 --port 3008',
    cwd: __dirname,
    url: 'http://127.0.0.1:3008',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
