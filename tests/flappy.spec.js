const { test, expect } = require('@playwright/test');

test('3D Flappy Bird - bird flaps and survives', async ({ page }) => {
  await page.goto('http://localhost:3456/index.html');

  // Wait for canvas and Three.js scene to initialize
  await page.waitForSelector('canvas', { timeout: 10000 });
  await page.waitForTimeout(1500);

  const cx = 360, cy = 640; // portrait 720x1280 viewport center

  // Read game state exposed by the animation loop
  const getBirdY    = () => page.evaluate(() => window.__FLAPPY_BIRD_Y  ?? 0);
  const getTargetY  = () => page.evaluate(() => window.__FLAPPY_NEXT_GAP_Y ?? 0);
  const getScore    = () => page.evaluate(() => window.__FLAPPY_SCORE   ?? 0);
  const isOver      = () => page.evaluate(() => window.__FLAPPY_OVER    ?? false);

  // Gap-targeting flap strategy:
  //   - Read the next pipe's gap center (exposed as __FLAPPY_NEXT_GAP_Y)
  //   - Flap when bird is more than 1.0 units below that target
  const TOLERANCE_BELOW  = 1.0;
  const CHECK_INTERVAL_MS = 50;   // fast polling so we never miss a flap window
  const TARGET_SCORE      = 10;   // must pass at least 10 obstacles
  const TIMEOUT_MS        = 60000; // safety timeout

  // First click starts the game
  await page.mouse.click(cx, cy);
  await page.waitForTimeout(500);

  const startTime = Date.now();
  let cumulativeScore = 0;

  while (cumulativeScore < TARGET_SCORE && Date.now() - startTime < TIMEOUT_MS) {
    const over = await isOver();
    if (over) {
      // Game over — wait for explosion + overlay (900ms delay), then restart
      await page.waitForTimeout(1200);
      await page.mouse.click(cx, cy); // restart (shows CYBER FLAP screen)
      await page.waitForTimeout(500);
      await page.mouse.click(cx, cy); // start new game + first flap
      await page.waitForTimeout(300);
      continue;
    }

    const [birdY, targetY, score] = await Promise.all([getBirdY(), getTargetY(), getScore()]);
    cumulativeScore = Math.max(cumulativeScore, score);

    if (birdY < targetY - TOLERANCE_BELOW) {
      await page.mouse.click(cx, cy); // flap toward gap center
    }

    await page.waitForTimeout(CHECK_INTERVAL_MS);
  }

  // Stop flapping — let bird die naturally to show explosion + game-over overlay
  await page.waitForFunction(() => window.__FLAPPY_OVER === true, { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(1500); // let explosion animation play

  // Final assertions
  await expect(page.locator('#score')).toBeVisible();
  await expect(page.locator('canvas')).toBeVisible();

  const finalScore  = await page.locator('#score').textContent();
  const overlayClass = await page.locator('#overlay').getAttribute('class');
  console.log('Score at end:', finalScore);
  console.log('Cumulative best score:', cumulativeScore);
  console.log('Overlay class at end:', overlayClass);

  expect(cumulativeScore).toBeGreaterThanOrEqual(TARGET_SCORE);
});
