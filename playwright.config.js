const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.js',
  workers: 1,
  timeout: 120000, // 120s per test — enough for 10+ pipes
  use: {
    video: 'on',
    headless: true,
    viewport: { width: 1080, height: 1920 },
  },
  webServer: {
    command: 'node node_modules/http-server/bin/http-server . -p 3457 --cors',
    url: 'http://localhost:3457',
    reuseExistingServer: true,
  },
});
