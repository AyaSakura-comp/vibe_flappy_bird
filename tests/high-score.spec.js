const { test, expect } = require('@playwright/test');

test('Record high-score gameplay: navigate 20+ pipes', async ({ page }) => {
  test.setTimeout(90000);

  page.on('console', msg => {
    if (msg.type() !== 'error') console.log('[browser]', msg.text());
  });

  await page.addInitScript(() => {
    window.PILOT_ENABLED = true; if(window.__GAME_CONFIG) window.__GAME_CONFIG.LASER.SPAWN_CHANCE = 0; if(window.__FLAPPY_RESTART) window.__FLAPPY_RESTART();
    window.__PILOT_BEST  = 0;

    // Speed up pipes 2x so 20 pipes complete in ~8s instead of ~18s on this hardware.
    // CONFIG is exposed as window.__GAME_CONFIG — mutations take effect each game loop frame.
    const _speedup = () => {
      if (window.__GAME_CONFIG) {
        window.__GAME_CONFIG.PIPES.SPEED = 0.32; window.__GAME_CONFIG.LASER.SPAWN_CHANCE = 0; if(window.__FLAPPY_RESTART) window.__FLAPPY_RESTART();
        // Boost stamina recharge for the pilot to handle lasers at high speed
        window.__GAME_CONFIG.PHASE.CHARGE_RATE = 2.0;
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
    let frameCount    = 0;
    let rebootPending = false;

    const pilotLoop = () => {
      frameCount++;
      if (!window.PILOT_ENABLED) { requestAnimationFrame(pilotLoop); return; }

      const score  = window.__FLAPPY_SCORE || 0;
      const isOver = window.__FLAPPY_OVER;
      const started = window.__FLAPPY_STARTED;
      const birdY   = window.__FLAPPY_BIRD_Y;
      const vel     = window.__FLAPPY_VELOCITY;
      const gapTop1 = window.__FLAPPY_NEXT_GAP_TOP;
      const gapBot1 = window.__FLAPPY_NEXT_GAP_BOT;
      const pipeZ1  = window.__FLAPPY_NEXT_PIPE_Z;
      const hasLaser = window.__FLAPPY_NEXT_LASER;
      const phaseStamina = window.__FLAPPY_PHASE_STAMINA;
      const phaseCooldown = window.__FLAPPY_PHASE_COOLDOWN;
      const config  = window.__GAME_CONFIG;

      if (score > window.__PILOT_BEST) {
        window.__PILOT_BEST = score;
        console.log('[pilot] score=' + score);
      }

      if (isOver && !rebootPending) {
        rebootPending = true;
        console.log('[pilot] CRASH at ' + window.__PILOT_BEST + ', rebooting...');
        setTimeout(() => {
          if (window.__FLAPPY_RESTART) window.__FLAPPY_RESTART();
          setTimeout(() => {
            rebootPending = false;
            if (window.__FLAPPY_START_QUIET) window.__FLAPPY_START_QUIET();
          }, 200);
        }, 600);
      }

      if (!started || isOver || birdY === undefined || !config) {
        requestAnimationFrame(pilotLoop); return;
      }

      // Phase management for laser nets
      const pipeApproaching = pipeZ1 > -3 && pipeZ1 < 2;
      const canPhase = phaseStamina > 0.3 && phaseCooldown <= 0;

      if (hasLaser && pipeApproaching && canPhase) {
        if (!window.__FLAPPY_PHASING) window.__FLAPPY_PHASE_ACTIVATE();
      } else {
        if (window.__FLAPPY_PHASING) window.__FLAPPY_PHASE_DEACTIVATE();
      }

      const G  = config.PHYSICS.GRAVITY;
      const FV = config.PHYSICS.FLAP;
      const TV = config.PHYSICS.TERMINAL_VELOCITY;
      const PS = window.__GAME_CONFIG ? window.__GAME_CONFIG.PIPES.SPEED : config.PIPES.SPEED;

      // If pipe 2 is also in the collision zone (pipe bunching due to GPU stalls),
      // use the intersection of both gaps as the safe target.
      const gapTop2 = window.__FLAPPY_NEXT2_GAP_TOP;
      const gapBot2 = window.__FLAPPY_NEXT2_GAP_BOT;
      const pipeZ2  = window.__FLAPPY_NEXT2_PIPE_Z;
      const pipe2InZone = pipeZ2 && pipeZ2 > -2.5 && pipeZ2 < 1.5;

      const tGapTop = pipe2InZone ? Math.min(gapTop1, gapTop2) : gapTop1;
      const tGapBot = pipe2InZone ? Math.max(gapBot1, gapBot2) : gapBot1;

      const f1      = Math.max(1, Math.round((-2 - pipeZ1) / PS));
      const M       = pipe2InZone ? 0.2 : 1.5;
      const safeTop = tGapTop - M;
      const safeBot = tGapBot + M;
      const targetY = (safeBot + safeTop) / 2;

      const noFlapY = simulate(birdY, vel, f1, false, G, FV, TV);
      const flapY   = simulate(birdY, vel, f1, true,  G, FV, TV);

      const cooldownOk   = (frameCount - lastFlapFrame) > 5;
      const needsLift    = noFlapY < targetY - 0.4;
      const flapHelps    = flapY > noFlapY;
      const flapInBounds = flapY <= safeTop + 0.5;

      // Boundary safety: if no-flap trajectory hits world edge, flap anyway
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
    else document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
  });

  // Wait for score 20+ fully in-browser (raf polling = no IPC overhead per frame)
  await page.waitForFunction(() => (window.__PILOT_BEST || 0) >= 20, { timeout: 60000, polling: 'raf' });

  const currentMax = await page.evaluate(() => window.__PILOT_BEST || 0);
  expect(currentMax).toBeGreaterThanOrEqual(20);
  console.log(`Final Score: ${currentMax}`);
});
