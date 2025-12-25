import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: 'screenshot.spec.ts',
  use: {
    baseURL: 'http://localhost:5555',
  },
  webServer: {
    command: 'npm run dev',
    port: 5555,
    reuseExistingServer: true,
  },
});
