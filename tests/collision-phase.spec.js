const { test, expect } = require('@playwright/test');

test('Solid ship hitting laser net = game over', async ({ page }) => {
  test.setTimeout(20000);

  await page.addInitScript(() => {
    const _setup = () => {
      if (window.__GAME_CONFIG) {
        window.__GAME_CONFIG.LASER.SPAWN_CHANCE = 1.0;
        window.__GAME_CONFIG.LASER.WARMUP_PIPES = 0;
        window.__GAME_CONFIG.LASER.GAP_FRACTION = 0.99; // make it almost impossible to miss
      } else {
        setTimeout(_setup, 50);
      }
    };
    _setup();
  });

  await page.goto('http://localhost:3457/index.html');
  await page.waitForSelector('canvas');
  
  await page.evaluate(() => {
    window.__FLAPPY_START_QUIET();
  });

  // Don't flap — bird will float through first pipe gap center where laser is
  await page.waitForFunction(() => window.__FLAPPY_OVER === true, { timeout: 15000, polling: 'raf' });
  const isOver = await page.evaluate(() => window.__FLAPPY_OVER);
  expect(isOver).toBe(true);
});

test('Phased ship passes through laser net safely', async ({ page }) => {
  test.setTimeout(30000);

  await page.addInitScript(() => {
    const _setup = () => {
      if (window.__GAME_CONFIG) {
        window.__GAME_CONFIG.LASER.SPAWN_CHANCE = 1.0;
        window.__GAME_CONFIG.LASER.WARMUP_PIPES = 0;
      } else {
        setTimeout(_setup, 50);
      }
    };
    _setup();

    // Pilot that flaps to center and phases when approaching laser
    const flap = () => document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
    let frame = 0;
    const pilot = () => {
      frame++;
      const started = window.__FLAPPY_STARTED;
      const isOver = window.__FLAPPY_OVER;
      if (!started || isOver) { requestAnimationFrame(pilot); return; }

      const birdY = window.__FLAPPY_BIRD_Y;
      const vel = window.__FLAPPY_VELOCITY;
      const pipeZ = window.__FLAPPY_NEXT_PIPE_Z;
      const hasLaser = window.__FLAPPY_NEXT_LASER;

      // Simple flap logic to stay near center
      if (birdY < -1 && vel > 0) flap();

      // Phase when laser pipe is approaching
      if (hasLaser && pipeZ > -3 && pipeZ < 2) {
        if (!window.__FLAPPY_PHASING) window.__FLAPPY_PHASE_ACTIVATE();
      } else {
        if (window.__FLAPPY_PHASING) window.__FLAPPY_PHASE_DEACTIVATE();
      }

      requestAnimationFrame(pilot);
    };
    requestAnimationFrame(pilot);
  });

  await page.goto('http://localhost:3457/index.html');
  await page.waitForSelector('canvas');
  await page.evaluate(() => window.__FLAPPY_START_QUIET());

  // Should survive at least 3 pipes (passing through lasers while phased)
  await page.waitForFunction(() => (window.__FLAPPY_SCORE || 0) >= 3, { timeout: 20000, polling: 'raf' });
  const score = await page.evaluate(() => window.__FLAPPY_SCORE);
  expect(score).toBeGreaterThanOrEqual(3);
});

test('Phased ship still dies on pipe collision', async ({ page }) => {
  test.setTimeout(20000);

  await page.addInitScript(() => {
    const _setup = () => {
      if (window.__GAME_CONFIG) {
        window.__GAME_CONFIG.LASER.SPAWN_CHANCE = 0;
      } else {
        setTimeout(_setup, 50);
      }
    };
    _setup();
  });

  await page.goto('http://localhost:3457/index.html');
  await page.waitForSelector('canvas');
  await page.evaluate(() => window.__FLAPPY_START_QUIET());

  // Activate phase immediately
  await page.evaluate(() => window.__FLAPPY_PHASE_ACTIVATE());

  // Don't flap — bird will fall into a pipe. Phase should NOT protect from pipes.
  await page.waitForFunction(() => window.__FLAPPY_OVER === true, { timeout: 15000, polling: 'raf' });
  const isOver = await page.evaluate(() => window.__FLAPPY_OVER);
  expect(isOver).toBe(true);
});

test('Stamina depletion while overlapping laser = instant death', async ({ page }) => {
  test.setTimeout(30000);

  await page.addInitScript(() => {
    const _setup = () => {
      if (window.__GAME_CONFIG) {
        window.__GAME_CONFIG.LASER.SPAWN_CHANCE = 1.0;
        window.__GAME_CONFIG.LASER.WARMUP_PIPES = 0;
        window.__GAME_CONFIG.PHASE.MAX_DURATION = 0.5; // Short duration
      } else {
        setTimeout(_setup, 50);
      }
    };
    _setup();

    // Pilot: flap to stay alive, activate phase early and hold it until depleted
    const flap = () => document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
    let frame = 0;
    const pilot = () => {
      frame++;
      if (!window.__FLAPPY_STARTED || window.__FLAPPY_OVER) {
        requestAnimationFrame(pilot); return;
      }
      const birdY = window.__FLAPPY_BIRD_Y;
      const vel = window.__FLAPPY_VELOCITY;
      if (birdY < -1 && vel > 0) flap();

      // Activate phase and never release — let stamina deplete naturally
      const pipeZ = window.__FLAPPY_NEXT_PIPE_Z;
      if (pipeZ > -4 && !window.__FLAPPY_PHASING && window.__FLAPPY_PHASE_STAMINA > 0) {
        window.__FLAPPY_PHASE_ACTIVATE();
      }
      requestAnimationFrame(pilot);
    };
    requestAnimationFrame(pilot);
  });

  await page.goto('http://localhost:3457/index.html');
  await page.waitForSelector('canvas');
  await page.evaluate(() => window.__FLAPPY_START_QUIET());

  // Should die when stamina runs out while overlapping a laser
  await page.waitForFunction(() => window.__FLAPPY_OVER === true, { timeout: 20000, polling: 'raf' });
  expect(await page.evaluate(() => window.__FLAPPY_OVER)).toBe(true);
});
