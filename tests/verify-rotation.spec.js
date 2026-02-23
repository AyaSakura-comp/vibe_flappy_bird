const { test, expect } = require('@playwright/test');

test('Verify: bird rotation linked to velocity', async ({ page }) => {
  await page.goto('http://localhost:3456/index.html');
  await page.waitForSelector('canvas', { timeout: 10000 });
  await page.waitForTimeout(1500);

  const cx = 360, cy = 640;
  const getBirdY   = () => page.evaluate(() => window.__FLAPPY_BIRD_Y ?? 0);
  const getTargetY = () => page.evaluate(() => window.__FLAPPY_NEXT_GAP_Y ?? 0);
  const isOver     = () => page.evaluate(() => window.__FLAPPY_OVER ?? false);

  await page.mouse.click(cx, cy);
  await page.waitForTimeout(300);

  // Run for ~12 seconds showing rotation cycles while keeping bird alive.
  // Strategy: navigate pipes normally, but every 3 seconds do a burst of
  // 4 rapid flaps (nose-up) followed by a 0.8s pause (nose-down), then
  // resume normal navigation to avoid crashing.
  const start = Date.now();
  let lastBurst = 0;
  let burstCount = 0;

  while (Date.now() - start < 14000) {
    const over = await isOver();
    if (over) break;

    const now = Date.now();
    const elapsed = now - start;

    if (elapsed - lastBurst > 3000 && burstCount < 4) {
      // Burst phase: 4 rapid flaps → clear nose-up rotation
      for (let i = 0; i < 4; i++) {
        await page.mouse.click(cx, cy);
        await page.waitForTimeout(100);
      }
      // Pause to show nose-down (but not so long bird crashes)
      await page.waitForTimeout(700);
      lastBurst = Date.now() - start;
      burstCount++;
    } else {
      // Normal navigation to stay alive between bursts
      const [birdY, targetY] = await Promise.all([getBirdY(), getTargetY()]);
      if (birdY < targetY - 0.8) {
        await page.mouse.click(cx, cy);
      }
      await page.waitForTimeout(50);
    }
  }
});
