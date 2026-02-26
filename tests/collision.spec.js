const { test, expect } = require('@playwright/test');

test('Bird dies when hitting pipe cap', async ({ page }) => {
  await page.goto('http://localhost:3457/index.html');
  await page.waitForSelector('canvas', { timeout: 10000 });
  await page.evaluate(() => { if(window.__GAME_CONFIG) { window.__GAME_CONFIG.LASER.SPAWN_CHANCE = 0; if(window.__FLAPPY_RESTART) window.__FLAPPY_RESTART(); } });
  await page.waitForTimeout(1500);

  const cx = 360, cy = 640;

  const getBirdY   = () => page.evaluate(() => window.__FLAPPY_BIRD_Y ?? 0);
  const getGapTop  = () => page.evaluate(() => window.__FLAPPY_NEXT_GAP_TOP ?? 0);
  const getGapBot  = () => page.evaluate(() => window.__FLAPPY_NEXT_GAP_BOT ?? 0);
  const isOver     = () => page.evaluate(() => window.__FLAPPY_OVER ?? false);

  // Start the game
  await page.mouse.click(cx, cy);
  await page.waitForTimeout(300);

  // Strategy: flap aggressively to fly UP into the top cap of the next pipe.
  // Keep flapping until bird is above gapTop, then wait for collision.
  const startTime = Date.now();
  let diedFromCap = false;

  while (Date.now() - startTime < 15000) {
    const over = await isOver();
    if (over) {
      // Bird died — check if it was near a cap edge (above gapTop or below gapBot)
      diedFromCap = true;
      break;
    }

    const [birdY, gapTop] = await Promise.all([getBirdY(), getGapTop()]);

    // Flap aggressively to push bird above the gap top (into the top pipe cap)
    if (birdY < gapTop + 1.0) {
      await page.mouse.click(cx, cy);
    }

    await page.waitForTimeout(30);
  }

  console.log('Bird died from cap collision:', diedFromCap);
  expect(diedFromCap).toBe(true);

  // Now verify the bird also dies when falling into bottom cap
  // Wait for game over overlay, then restart
  await page.waitForTimeout(1500);
  await page.mouse.click(cx, cy); // back to title
  await page.waitForTimeout(500);
  await page.mouse.click(cx, cy); // start new game
  await page.waitForTimeout(300);

  // Strategy: do NOT flap at all — bird falls by gravity into bottom cap
  let diedFromBottom = false;
  const startTime2 = Date.now();

  while (Date.now() - startTime2 < 15000) {
    const over = await isOver();
    if (over) {
      diedFromBottom = true;
      break;
    }
    await page.waitForTimeout(50);
  }

  console.log('Bird died from falling into bottom:', diedFromBottom);
  expect(diedFromBottom).toBe(true);
});
