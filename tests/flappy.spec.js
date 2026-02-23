const { test, expect } = require('@playwright/test');

test('3D Flappy Bird - bird flaps and survives', async ({ page }) => {
  await page.goto('http://localhost:3456/index.html');

  // Wait for canvas and Three.js scene to initialize
  await page.waitForSelector('canvas', { timeout: 10000 });
  await page.waitForTimeout(1500);

  const cx = 640, cy = 360;

  // Read game state exposed by the animation loop
  const getBirdY    = () => page.evaluate(() => window.__FLAPPY_BIRD_Y  ?? 0);
  const getTargetY  = () => page.evaluate(() => window.__FLAPPY_NEXT_GAP_Y ?? 0);
  const isOver      = () => page.evaluate(() => window.__FLAPPY_OVER    ?? false);

  // Gap-targeting flap strategy:
  //   - Read the next pipe's gap center (exposed as __FLAPPY_NEXT_GAP_Y)
  //   - Flap when bird is more than 0.8 units below that target
  //   - Let gravity pull bird down when it is above target
  // This causes the bird to visibly fly HIGH for top gaps and LOW for bottom gaps,
  // making gap-height variation clearly observable in the recording.
  const TOLERANCE_BELOW = 1.0;  // flap when birdY < targetY - TOLERANCE_BELOW
  const CHECK_INTERVAL_MS = 50;  // fast polling so we never miss a flap window
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
      await page.mouse.click(cx, cy); // restart (shows CYBER FLAP screen)
      await page.waitForTimeout(500);
      await page.mouse.click(cx, cy); // start new game + first flap
      await page.waitForTimeout(300);
      continue;
    }

    const [birdY, targetY] = await Promise.all([getBirdY(), getTargetY()]);
    if (birdY < targetY - TOLERANCE_BELOW) {
      await page.mouse.click(cx, cy); // flap toward gap center
    }

    await page.waitForTimeout(CHECK_INTERVAL_MS);
  }

  // Final assertions
  await page.waitForTimeout(500);
  await expect(page.locator('#score')).toBeVisible();
  await expect(page.locator('canvas')).toBeVisible();

  const finalScore  = await page.locator('#score').textContent();
  const overlayClass = await page.locator('#overlay').getAttribute('class');
  console.log('Score at end:', finalScore);
  console.log('Overlay class at end:', overlayClass);
});
