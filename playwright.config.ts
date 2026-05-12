import { defineConfig } from '@playwright/test';
import path from 'path';

export default defineConfig({
  testDir: path.join(__dirname, 'src/__tests__/playwright'),
  // Only run .spec.ts files (not harness sources)
  testMatch: '**/*.spec.ts',
  retries: 0,
  use: {
    headless: true,
    // Serve the harness folder as a static site on localhost
    baseURL: 'http://localhost:4321',
  },
  projects: [
    {
      name: 'smoke',
      use: {},
      grep: /@smoke/,
      timeout: 30_000,
    },
    {
      name: 'release',
      use: {},
      timeout: 60_000,
    },
  ],
  webServer: {
    command: 'npx serve . -p 4321 --no-port-switching',
    url: 'http://localhost:4321',
    reuseExistingServer: !process.env.CI,
    timeout: 15_000,
  },
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
});
