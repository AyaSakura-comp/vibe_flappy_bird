const { test, expect } = require('@playwright/test');

test('Verify: screen shake on death', async ({ page }) => {
  await page.goto('http://localhost:3456/index.html');
  await page.waitForSelector('canvas', { timeout: 10000 });
  await page.waitForTimeout(1500);

  const cx = 360, cy = 640;
  const isOver = () => page.evaluate(() => window.__FLAPPY_OVER ?? false);

  // Start game and deliberately crash immediately (no flaps — bird falls into lower bound)
  await page.mouse.click(cx, cy);

  // Wait for game over (bird falls out of bounds or hits pipe)
  const start = Date.now();
  while (Date.now() - start < 10000) {
    if (await isOver()) break;
    await page.waitForTimeout(100);
  }

  expect(await isOver()).toBe(true);

  // Hold on game-over screen for 2s so shake animation is visible in recording
  await page.waitForTimeout(2000);
});
