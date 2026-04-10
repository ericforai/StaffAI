import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  retries: 0,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3010',
    trace: 'on-first-retry',
    navigationTimeout: 60_000,
  },
  // Production server: next dev HMR WebSocket often fails under Playwright, leaving client hooks
  // (useTasks, etc.) without running effects — no API fetch and perpetual loading states.
  webServer: {
    command:
      'npm run build && npx next start --hostname 127.0.0.1 --port ' +
      (process.env.PLAYWRIGHT_FRONTEND_PORT ?? '3010'),
    cwd: __dirname,
    url: process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3010',
    reuseExistingServer: !process.env.CI,
    timeout: 300000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
