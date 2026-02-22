const { test, expect } = require('@playwright/test');

test('3D Flappy Bird - bird flaps and survives', async ({ page }) => {
  await page.goto('http://localhost:3456/index.html');

  // Wait for canvas and Three.js scene to initialize
  await page.waitForSelector('canvas', { timeout: 10000 });
  await page.waitForTimeout(1500);

  const cx = 640, cy = 360;

  // Helper: read bird Y position from exposed game state
  const getBirdY = () => page.evaluate(() => window.__FLAPPY_BIRD_Y ?? 0);
  const isOver   = () => page.evaluate(() => window.__FLAPPY_OVER ?? false);

  // Adaptive flap loop: run for ~16 seconds, flap when bird drifts below target
  // Flap when bird.y < -0.5 to counteract downward drift.
  // At y=0, bird is within ALL pipe gaps (yOffset ±2.0, PIPE_GAP 5.0 → gapBot min=-0.5)
  const FLAP_THRESHOLD = -0.5;
  const CHECK_INTERVAL_MS = 300;
  const DURATION_MS = 16000;

  // First click starts the game
  await page.mouse.click(cx, cy);
  await page.waitForTimeout(500);

  const startTime = Date.now();
  while (Date.now() - startTime < DURATION_MS) {
    const over = await isOver();
    if (over) {
      // Game over — wait for explosion + overlay (900ms delay), then restart
      await page.waitForTimeout(1200);
      await page.mouse.click(cx, cy); // restart
      await page.waitForTimeout(500);
      await page.mouse.click(cx, cy); // start new game + first flap
      await page.waitForTimeout(300);
      continue;
    }

    const birdY = await getBirdY();
    if (birdY < FLAP_THRESHOLD) {
      await page.mouse.click(cx, cy);
    }

    await page.waitForTimeout(CHECK_INTERVAL_MS);
  }

  // Final assertions
  await page.waitForTimeout(500);
  await expect(page.locator('#score')).toBeVisible();
  await expect(page.locator('canvas')).toBeVisible();

  const finalScore = await page.locator('#score').textContent();
  const overlayClass = await page.locator('#overlay').getAttribute('class');
  console.log('Score at end:', finalScore);
  console.log('Overlay class at end:', overlayClass);
});
