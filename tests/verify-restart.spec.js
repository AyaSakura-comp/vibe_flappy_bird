const { test, expect } = require('@playwright/test');

test('Verify: restart resets game state', async ({ page }) => {
  await page.goto('http://localhost:3457/index.html');
  await page.waitForSelector('canvas', { timeout: 10000 });
  await page.evaluate(() => { if(window.__GAME_CONFIG) { window.__GAME_CONFIG.LASER.SPAWN_CHANCE = 0; if(window.__FLAPPY_RESTART) window.__FLAPPY_RESTART(); } });
  await page.waitForTimeout(1500);

  const cx = 360, cy = 640;
  const getScore  = () => page.evaluate(() => window.__FLAPPY_SCORE ?? 0);
  const isOver    = () => page.evaluate(() => window.__FLAPPY_OVER ?? false);
  const isStarted = () => page.evaluate(() => window.__FLAPPY_STARTED ?? false);

  // Start game and score at least 1 pipe
  await page.mouse.click(cx, cy);
  await page.waitForTimeout(300);

  const start = Date.now();
  while (Date.now() - start < 15000) {
    const [score, over] = await Promise.all([getScore(), isOver()]);
    if (score >= 1 || over) break;
    const birdY   = await page.evaluate(() => window.__FLAPPY_BIRD_Y ?? 0);
    const targetY = await page.evaluate(() => window.__FLAPPY_NEXT_GAP_Y ?? 0);
    if (birdY < targetY - 0.6) await page.mouse.click(cx, cy);
    await page.waitForTimeout(50);
  }

  // Let bird die (stop flapping)
  const overStart = Date.now();
  while (Date.now() - overStart < 5000) {
    if (await isOver()) break;
    await page.waitForTimeout(100);
  }
  expect(await isOver()).toBe(true);
  const scoreBeforeRestart = await getScore();

  // Wait for overlay then restart
  await page.waitForTimeout(1200);
  await page.mouse.click(cx, cy); // restart click

  // Wait for game to reset
  await page.waitForTimeout(600);

  // Verify score reset to 0 and game not over
  const scoreAfter = await getScore();
  const overAfter  = await isOver();

  expect(scoreAfter).toBe(0);
  expect(overAfter).toBe(false);

  // Play a few more seconds to show restart working
  await page.mouse.click(cx, cy); // start again
  await page.waitForTimeout(3000);
});
