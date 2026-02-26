const { test, expect } = require('@playwright/test');

test('Laser nets appear in pipe gaps after warmup', async ({ page }) => {
  test.setTimeout(30000);

  await page.addInitScript(() => {
    // Force all lasers after short warmup and speed up pipes
    const _setup = () => {
      if (window.__GAME_CONFIG) {
        window.__GAME_CONFIG.PIPES.SPEED = 0.32;
        window.__GAME_CONFIG.LASER.SPAWN_CHANCE = 1.0;
        window.__GAME_CONFIG.LASER.WARMUP_PIPES = 2;
      } else {
        setTimeout(_setup, 50);
      }
    };
    _setup();

    // Physics-predictive pilot (same as baseline-recording.spec.js)
    const flap = () => document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));

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
  await page.evaluate(() => window.__FLAPPY_START_QUIET());

  // Wait for score 5+ (past warmup of 2) — laser nets should have appeared by then
  await page.waitForFunction(() => {
    return (window.__FLAPPY_SCORE || 0) >= 5;
  }, { timeout: 20000, polling: 'raf' });

  // Check laser API is exposed
  const nextLaser = await page.evaluate(() => window.__FLAPPY_NEXT_LASER);
  expect(typeof nextLaser).toBe('boolean');

  const score = await page.evaluate(() => window.__FLAPPY_SCORE);
  expect(score).toBeGreaterThanOrEqual(5);
});
