const { test, expect } = require('@playwright/test');

test('Phase activates on D key hold and deactivates on release', async ({ page }) => {
  test.setTimeout(20000);

  await page.goto('http://localhost:3457/index.html');
  await page.waitForSelector('canvas');

  // Start game quietly (no flap velocity)
  await page.evaluate(() => window.__FLAPPY_START_QUIET());
  await page.waitForFunction(() => window.__FLAPPY_STARTED === true, { timeout: 5000 });

  // Verify not phasing initially
  const initialPhase = await page.evaluate(() => window.__FLAPPY_PHASING);
  expect(initialPhase).toBe(false);

  // Hold D key — should activate phase
  await page.keyboard.down('d');
  await page.waitForFunction(() => window.__FLAPPY_PHASING === true, { timeout: 2000, polling: 'raf' });

  // Release D key — should deactivate phase
  await page.keyboard.up('d');
  await page.waitForFunction(() => window.__FLAPPY_PHASING === false, { timeout: 2000, polling: 'raf' });
});

test('Flap and phase work simultaneously', async ({ page }) => {
  test.setTimeout(20000);

  await page.goto('http://localhost:3457/index.html');
  await page.waitForSelector('canvas');
  await page.evaluate(() => window.__FLAPPY_START_QUIET());
  await page.waitForFunction(() => window.__FLAPPY_STARTED === true, { timeout: 5000 });

  // Hold D to phase
  await page.keyboard.down('d');
  await page.waitForFunction(() => window.__FLAPPY_PHASING === true, { timeout: 2000, polling: 'raf' });

  // Flap while phasing — bird should gain upward velocity AND still be phasing
  const yBefore = await page.evaluate(() => window.__FLAPPY_BIRD_Y);
  await page.keyboard.press('Space');

  // Wait a few frames for flap to take effect
  await page.waitForFunction((prevY) => {
    return window.__FLAPPY_BIRD_Y > prevY && window.__FLAPPY_PHASING === true;
  }, yBefore, { timeout: 3000, polling: 'raf' });

  const phasing = await page.evaluate(() => window.__FLAPPY_PHASING);
  await page.keyboard.up('d');
  expect(phasing).toBe(true);
});
