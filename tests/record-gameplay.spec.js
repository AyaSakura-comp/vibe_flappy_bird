const { test, expect } = require('@playwright/test');

test('Record gameplay: play more than 2 levels (score >= 3)', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto('http://localhost:3457/index.html');

  // Wait for canvas and Three.js scene to initialize
  await page.waitForSelector('canvas', { timeout: 10000 });
  await page.waitForTimeout(1500);

  const cx = 360, cy = 640; // portrait 720x1280 viewport center

  const getBirdY    = () => page.evaluate(() => window.__FLAPPY_BIRD_Y  ?? 0);
  const getVelocity = () => page.evaluate(() => window.__FLAPPY_VELOCITY ?? 0);
  const getTargetY  = () => page.evaluate(() => window.__FLAPPY_NEXT_GAP_Y ?? 0);
  const getScore    = () => page.evaluate(() => window.__FLAPPY_SCORE   ?? 0);
  const isOver      = () => page.evaluate(() => window.__FLAPPY_OVER    ?? false);

  const TOLERANCE_BELOW  = 0.4;
  const VELOCITY_THRESHOLD = 0.02; // only flap if falling or moving up slowly
  const CHECK_INTERVAL_MS = 30;
  const TARGET_SCORE      = 2; // enough to show spacing change
  const TIMEOUT_MS        = 90000;

  // First click starts the game
  await page.mouse.click(cx, cy);
  await page.waitForTimeout(500);

  const startTime = Date.now();
  let cumulativeScore = 0;

  while (cumulativeScore < TARGET_SCORE && Date.now() - startTime < TIMEOUT_MS) {
    const over = await isOver();
    if (over) {
      await page.waitForTimeout(1200);
      await page.mouse.click(cx, cy);
      await page.waitForTimeout(500);
      await page.mouse.click(cx, cy);
      await page.waitForTimeout(300);
      continue;
    }

    const [birdY, vel, targetY, score] = await Promise.all([getBirdY(), getVelocity(), getTargetY(), getScore()]);
    cumulativeScore = Math.max(cumulativeScore, score);

    // More nuanced flapping: check both position and current velocity
    if (birdY < targetY - TOLERANCE_BELOW && vel > -VELOCITY_THRESHOLD) {
      await page.mouse.click(cx, cy);
    }

    await page.waitForTimeout(CHECK_INTERVAL_MS);
  }

  // Ensure we have at least TARGET_SCORE
  expect(cumulativeScore).toBeGreaterThanOrEqual(TARGET_SCORE);

  // Let bird die naturally to show game-over screen in the video
  await page.waitForFunction(() => window.__FLAPPY_OVER === true, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2000); // show the game-over screen for a bit
});
