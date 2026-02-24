const { test, expect } = require('@playwright/test');

/**
 * Super-stable E2E gameplay test for a high score (>= 10).
 * Improved controller with predictive flapping for smoother flight.
 */
test('Record high-score gameplay: navigate 10+ pipes', async ({ page }) => {
  test.setTimeout(420000); 
  await page.goto('http://localhost:3456/index.html');

  await page.waitForSelector('canvas', { timeout: 10000 });
  await page.waitForTimeout(2000);

  const cx = 360, cy = 640;

  const getBirdY    = () => page.evaluate(() => window.__FLAPPY_BIRD_Y  ?? 0);
  const getVelocity = () => page.evaluate(() => window.__FLAPPY_VELOCITY ?? 0);
  const getTargetY  = () => page.evaluate(() => window.__FLAPPY_NEXT_GAP_Y ?? 0);
  const getScore    = () => page.evaluate(() => window.__FLAPPY_SCORE   ?? 0);
  const isOver      = () => page.evaluate(() => window.__FLAPPY_OVER    ?? false);

  const TARGET_SCORE  = 10;
  const TIMEOUT_MS    = 360000;

  // Start the game
  await page.mouse.click(cx, cy);
  await page.waitForTimeout(500);

  const startTime = Date.now();
  let maxScore = 0;

  while (maxScore < TARGET_SCORE && (Date.now() - startTime < TIMEOUT_MS)) {
    const [over, birdY, vel, targetY, score] = await Promise.all([
      isOver(), getBirdY(), getVelocity(), getTargetY(), getScore()
    ]);
    
    maxScore = Math.max(maxScore, score);

    if (over) {
      // Re-start
      await page.waitForTimeout(1000);
      await page.mouse.click(cx, cy); 
      await page.waitForTimeout(1500);
      await page.mouse.click(cx, cy); 
      await page.waitForTimeout(1000);
      continue;
    }

    // Predictive Controller:
    // If bird will be significantly below target in 5 frames, flap.
    const GRAVITY = 0.003; 
    const futureBirdY = birdY - (vel * 5) - (0.5 * GRAVITY * 25);
    const gapCenter = targetY;

    // Use a smaller margin to stay tighter to the center
    if (futureBirdY < (gapCenter - 0.2)) {
      await page.mouse.click(cx, cy);
    }

    // High speed feedback loop
    await page.waitForTimeout(16); 
  }

  expect(maxScore).toBeGreaterThanOrEqual(TARGET_SCORE);
  await page.waitForTimeout(2000);
  while (!(await isOver())) { await page.waitForTimeout(100); }
  await page.waitForTimeout(2000);
});
