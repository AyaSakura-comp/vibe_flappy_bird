const { test, expect } = require('@playwright/test');

test('Verify: fast pipe speed', async ({ page }) => {
  await page.goto('http://localhost:3457/index.html');
  await page.waitForSelector('canvas', { timeout: 10000 });
  await page.evaluate(() => { if(window.__GAME_CONFIG) { window.__GAME_CONFIG.LASER.SPAWN_CHANCE = 0; if(window.__FLAPPY_RESTART) window.__FLAPPY_RESTART(); } });
  await page.waitForTimeout(1500);

  const cx = 360, cy = 640;
  const getBirdY   = () => page.evaluate(() => window.__FLAPPY_BIRD_Y ?? 0);
  const getTargetY = () => page.evaluate(() => window.__FLAPPY_NEXT_GAP_Y ?? 0);
  const getScore   = () => page.evaluate(() => window.__FLAPPY_SCORE ?? 0);
  const isOver     = () => page.evaluate(() => window.__FLAPPY_OVER ?? false);

  await page.mouse.click(cx, cy);
  await page.waitForTimeout(300);

  const start = Date.now();
  while (Date.now() - start < 30000) {
    const [score, over] = await Promise.all([getScore(), isOver()]);
    if (score >= 4) break;
    if (over) {
      await page.waitForTimeout(1200);
      await page.mouse.click(cx, cy);
      await page.waitForTimeout(500);
      await page.mouse.click(cx, cy);
      await page.waitForTimeout(300);
      continue;
    }
    const [birdY, targetY] = await Promise.all([getBirdY(), getTargetY()]);
    if (birdY < targetY - 0.6) {
      await page.mouse.click(cx, cy);
    }
    await page.waitForTimeout(50);
  }

  const finalScore = await getScore();
  expect(finalScore).toBeGreaterThanOrEqual(4);
});
