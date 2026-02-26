const { test, expect } = require('@playwright/test');

test('Golden: navigate 4+ pipes then crash', async ({ page }) => {
  await page.goto('http://localhost:3457/index.html');
  await page.waitForSelector('canvas', { timeout: 10000 });
  await page.evaluate(() => { if(window.__GAME_CONFIG) { window.__GAME_CONFIG.LASER.SPAWN_CHANCE = 0; if(window.__FLAPPY_RESTART) window.__FLAPPY_RESTART(); } });
  await page.waitForTimeout(1500);

  const cx = 360, cy = 640;

  const getBirdY   = () => page.evaluate(() => window.__FLAPPY_BIRD_Y ?? 0);
  const getTargetY = () => page.evaluate(() => window.__FLAPPY_NEXT_GAP_Y ?? 0);
  const getScore   = () => page.evaluate(() => window.__FLAPPY_SCORE ?? 0);
  const isOver     = () => page.evaluate(() => window.__FLAPPY_OVER ?? false);

  const TARGET_SCORE = 4;
  const TOLERANCE_BELOW = 0.8;

  // Start game
  await page.mouse.click(cx, cy);
  await page.waitForTimeout(300);

  // Phase 1: Navigate through 4+ pipes
  const startTime = Date.now();
  while (Date.now() - startTime < 40000) {
    const [score, over] = await Promise.all([getScore(), isOver()]);
    if (score >= TARGET_SCORE) break;
    if (over) {
      // Restart if died early
      await page.waitForTimeout(1200);
      await page.mouse.click(cx, cy);
      await page.waitForTimeout(500);
      await page.mouse.click(cx, cy);
      await page.waitForTimeout(300);
      continue;
    }

    const [birdY, targetY] = await Promise.all([getBirdY(), getTargetY()]);
    if (birdY < targetY - TOLERANCE_BELOW) {
      await page.mouse.click(cx, cy);
    }
    await page.waitForTimeout(50);
  }

  const scoreBeforeCrash = await getScore();
  console.log('Score before intentional crash:', scoreBeforeCrash);
  expect(scoreBeforeCrash).toBeGreaterThanOrEqual(TARGET_SCORE);

  // Phase 2: Stop flapping — let bird crash
  await page.waitForFunction(() => window.__FLAPPY_OVER === true, { timeout: 15000 });

  // Let explosion play
  await page.waitForTimeout(2000);

  // Verify game over state
  const overlayVisible = await page.locator('#overlay').evaluate(el => !el.classList.contains('hidden'));
  const overlayText = await page.locator('#overlay-title').textContent();
  console.log('Overlay visible:', overlayVisible, 'Title:', overlayText);

  expect(overlayVisible).toBe(true);
  expect(overlayText).toBe('SYSTEM FAILURE');
});
