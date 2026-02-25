const { test, expect } = require('@playwright/test');

test('Record high-score gameplay: navigate 5+ pipes', async ({ page }) => {
  test.setTimeout(120000);

  // Inject a zero-latency in-browser pilot using physics prediction
  await page.addInitScript(() => {
    window.PILOT_ENABLED = true;

    const flap = () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
    };

    const pilotLoop = () => {
      if (!window.PILOT_ENABLED) {
        requestAnimationFrame(pilotLoop);
        return;
      }

      const birdY = window.__FLAPPY_BIRD_Y;
      const targetY = window.__FLAPPY_NEXT_GAP_Y;
      const gapTop = window.__FLAPPY_NEXT_GAP_TOP;
      const gapBot = window.__FLAPPY_NEXT_GAP_BOT;
      const vel = window.__FLAPPY_VELOCITY;
      const isOver = window.__FLAPPY_OVER;
      const started = window.__FLAPPY_STARTED;
      const config = window.__GAME_CONFIG;

      if (started && !isOver && birdY !== undefined && targetY !== undefined && vel !== undefined && config) {
        // Physics derived dynamically from the game's single source of truth
        const GRAVITY = config.PHYSICS.GRAVITY;
        const FLAP_VEL = config.PHYSICS.FLAP;

        // Strategy: keep bird in the LOWER portion of the gap.
        const safeFloor = gapBot + 1.5;

        // Dynamic peak calculation based on current gravity/flap
        // v^2 / 2g = peak height
        const peakHeight = (FLAP_VEL * FLAP_VEL) / (2 * GRAVITY);
        const peakAfterFlap = birdY + peakHeight;

        // Only flap if:
        // 1. Bird is near or below the safe floor
        // 2. Bird is falling (vel > 0)
        // 3. Peak after flap won't exceed gap top
        const shouldFlap = (
          birdY < safeFloor + 0.3 &&
          vel > 0.01 &&
          peakAfterFlap < (gapTop - 0.5)
        );

        if (shouldFlap) {
          flap();
        }
      }

      requestAnimationFrame(pilotLoop);
    };
    requestAnimationFrame(pilotLoop);
  });

  await page.goto('http://localhost:3457/index.html');
  await page.waitForSelector('canvas');
  await page.waitForTimeout(1000);

  const cx = 360, cy = 640;

  const startOrReboot = async () => {
    const isOver = await page.evaluate(() => window.__FLAPPY_OVER);
    if (isOver) {
      await page.mouse.click(cx, cy);
      await page.waitForTimeout(1500);
      await page.mouse.click(cx, cy);
    } else {
      await page.mouse.click(cx, cy);
    }
  };

  await startOrReboot();

  const TARGET_SCORE = 5;
  const startTime = Date.now();
  const MAX_TIME = 150000;

  let currentMax = 0;
  while (currentMax < TARGET_SCORE && (Date.now() - startTime < MAX_TIME)) {
    const [score, over] = await page.evaluate(() => [window.__FLAPPY_SCORE || 0, window.__FLAPPY_OVER]);
    if (score > currentMax) {
      currentMax = score;
      console.log(`Current Score: ${currentMax}`);
    }

    if (over) {
      console.log(`Crashed. Best so far: ${currentMax}. Rebooting...`);
      await startOrReboot();
      await page.waitForTimeout(1000);
    }
    await page.waitForTimeout(200);
  }

  expect(currentMax).toBeGreaterThanOrEqual(TARGET_SCORE);
  console.log(`Reached Final Score: ${currentMax}`);

  await page.waitForTimeout(5000);
  await page.evaluate(() => { window.PILOT_ENABLED = false; });
  await page.waitForFunction(() => window.__FLAPPY_OVER === true, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1000);
});