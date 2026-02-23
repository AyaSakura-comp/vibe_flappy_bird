const { test, expect } = require('@playwright/test');

test('Verify: bird rotation linked to velocity', async ({ page }) => {
  await page.goto('http://localhost:3456/index.html');
  await page.waitForSelector('canvas', { timeout: 10000 });
  await page.waitForTimeout(1500);

  const cx = 360, cy = 640;
  const isOver = () => page.evaluate(() => window.__FLAPPY_OVER ?? false);

  await page.mouse.click(cx, cy);
  await page.waitForTimeout(300);

  // Pattern: flap 3x rapidly (bird tilts up), pause 1.5s (bird nose-dives), repeat
  for (let cycle = 0; cycle < 4; cycle++) {
    const over = await isOver();
    if (over) break;

    for (let i = 0; i < 3; i++) {
      await page.mouse.click(cx, cy);
      await page.waitForTimeout(120);
    }

    await page.waitForTimeout(1500);
  }

  await page.waitForTimeout(1000);
});
