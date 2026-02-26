// tests/baseline-recording.spec.js
const { test, expect } = require('@playwright/test');

test('Record baseline gameplay before Phase Dive', async ({ page }) => {
  test.setTimeout(30000);

  await page.addInitScript(() => {
    window.PILOT_ENABLED = true;
    const _speedup = () => {
      if (window.__GAME_CONFIG) {
        window.__GAME_CONFIG.PIPES.SPEED = 0.32;
      } else {
        setTimeout(_speedup, 50);
      }
    };
    _speedup();

    const flap = () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
    };

    const simulate = (birdY, vel, frames, flapNow, G, FV, TV) => {
      let y = birdY, v = flapNow ? FV : vel;
      for (let f = 0; f < frames; f++) {
        v += G; if (v > TV) v = TV;
        y -= v;
      }
      return y;
    };

    let lastFlapFrame = -10;
    let frameCount = 0;

    const pilotLoop = () => {
      frameCount++;
      if (!window.PILOT_ENABLED) { requestAnimationFrame(pilotLoop); return; }

      const score = window.__FLAPPY_SCORE || 0;
      const isOver = window.__FLAPPY_OVER;
      const started = window.__FLAPPY_STARTED;
      const birdY = window.__FLAPPY_BIRD_Y;
      const vel = window.__FLAPPY_VELOCITY;
      const gapTop1 = window.__FLAPPY_NEXT_GAP_TOP;
      const gapBot1 = window.__FLAPPY_NEXT_GAP_BOT;
      const pipeZ1 = window.__FLAPPY_NEXT_PIPE_Z;
      const config = window.__GAME_CONFIG;

      if (!started || isOver || birdY === undefined || !config) {
        requestAnimationFrame(pilotLoop); return;
      }

      const G = config.PHYSICS.GRAVITY;
      const FV = config.PHYSICS.FLAP;
      const TV = config.PHYSICS.TERMINAL_VELOCITY;
      const PS = config.PIPES.SPEED;
      const f1 = Math.max(1, Math.round((-2 - pipeZ1) / PS));
      const safeTop = gapTop1 - 1.5;
      const safeBot = gapBot1 + 1.5;
      const targetY = (safeBot + safeTop) / 2;

      const noFlapY = simulate(birdY, vel, f1, false, G, FV, TV);
      const flapY = simulate(birdY, vel, f1, true, G, FV, TV);

      const cooldownOk = (frameCount - lastFlapFrame) > 5;
      const needsLift = noFlapY < targetY - 0.4;
      const flapHelps = flapY > noFlapY;
      const flapInBounds = flapY <= safeTop + 0.5;
      const boundaryDanger = noFlapY < -5.5 && flapY > noFlapY && flapY < 5.5;

      let shouldFlap = cooldownOk && ((needsLift && flapHelps && flapInBounds) || boundaryDanger);
      if ((frameCount - lastFlapFrame) > 8 && birdY < safeBot && vel > 0.05) shouldFlap = true;

      if (shouldFlap) { flap(); lastFlapFrame = frameCount; }
      requestAnimationFrame(pilotLoop);
    };
    requestAnimationFrame(pilotLoop);
  });

  await page.goto('http://localhost:3457/index.html');
  await page.waitForSelector('canvas');
  await page.evaluate(() => {
    if (window.__FLAPPY_START_QUIET) window.__FLAPPY_START_QUIET();
  });

  await page.waitForFunction(() => (window.__FLAPPY_SCORE || 0) >= 10, { timeout: 20000, polling: 'raf' });
  const score = await page.evaluate(() => window.__FLAPPY_SCORE);
  expect(score).toBeGreaterThanOrEqual(10);
});
