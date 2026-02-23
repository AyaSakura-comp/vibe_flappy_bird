const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 90000, // 90s per test — enough for 10+ pipes + restart overhead
  use: {
    video: 'on',
    headless: true,
    viewport: { width: 1280, height: 720 },
  },
  webServer: {
    command: 'npx http-server . -p 3456 --cors',
    url: 'http://localhost:3456',
    reuseExistingServer: true,
  },
});
