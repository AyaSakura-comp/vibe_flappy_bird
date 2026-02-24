const { test, expect } = require('@playwright/test');

test('Record high-score gameplay: navigate 5+ pipes', async ({ page }) => {
  test.setTimeout(60000);

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

      if (started && !isOver && birdY !== undefined && targetY !== undefined && vel !== undefined) {
        // Physics: vel += GRAVITY*dt, y -= vel*dt (dt~1 at 60fps)
        // Positive vel = falling, negative = rising. FLAP sets vel = -0.13
        const GRAVITY = 0.003;
        const FLAP_VEL = -0.13;

        // Strategy: keep bird in the LOWER portion of the gap.
        // This minimizes upward position, giving more room for sudden drops.
        // Gap is 7.5 units; aim for gapBot + 1.5 (bottom quarter)
        const safeFloor = gapBot + 1.5;

        // After flapping (vel becomes -0.13), bird rises ~2.8 units to peak.
        // Worst-case next gapTop = 1.75 (pattern goes +2 → -2).
        // So peak must NEVER exceed 1.25 (= 1.75 - 0.5 margin).
        const ABSOLUTE_CEILING = 1.25;
        const peakAfterFlap = birdY + 2.8;

        // Only flap if:
        // 1. Bird is near or below the safe floor
        // 2. Bird is falling (vel > 0) — never double-flap while rising
        // 3. Peak after flap won't exceed ABSOLUTE_CEILING
        const shouldFlap = (
          birdY < safeFloor + 0.3 &&
          vel > 0.01 &&
          peakAfterFlap < ABSOLUTE_CEILING
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
