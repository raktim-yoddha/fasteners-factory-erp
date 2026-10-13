import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  timeout: 60000,
  expect: { timeout: 20000 },
  use: { trace: 'retain-on-failure' },
  projects: [
    {
      name: 'web',
      testMatch: /tests[\\/]web[\\/].+\.spec\.ts$/,
      use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:5173' },
    },
    { name: 'desktop', testMatch: /tests[\\/]desktop[\\/].+\.spec\.ts$/ },
  ],
  webServer: process.argv.includes('--project=desktop')
    ? undefined
    : {
        command: 'pnpm dev:web',
        url: 'http://127.0.0.1:5173',
        reuseExistingServer: !process.env.CI,
        timeout: 60000,
      },
});
