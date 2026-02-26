const { test, expect } = require('@playwright/test');

test('Stamina depletes while phasing', async ({ page }) => {
  test.setTimeout(20000);

  await page.goto('http://localhost:3457/index.html');
  await page.waitForSelector('canvas');
  await page.evaluate(() => window.__FLAPPY_START_QUIET());
  await page.waitForFunction(() => window.__FLAPPY_STARTED === true, { timeout: 5000 });

  const initialStamina = await page.evaluate(() => window.__FLAPPY_PHASE_STAMINA);
  expect(initialStamina).toBeCloseTo(1.5, 1);

  // Hold D and flap immediately to keep bird alive
  await page.keyboard.down('d');
  await page.keyboard.press('Space');
  await page.waitForFunction(() => window.__FLAPPY_PHASING === true, { timeout: 2000, polling: 'raf' });

  // Wait for stamina to decrease
  await page.waitForFunction(
    (start) => window.__FLAPPY_PHASE_STAMINA < start - 0.05,
    initialStamina,
    { timeout: 5000, polling: 'raf' }
  );

  const depletedStamina = await page.evaluate(() => window.__FLAPPY_PHASE_STAMINA);
  expect(depletedStamina).toBeLessThan(initialStamina);

  await page.keyboard.up('d');
});

test('Stamina fully depletes and cooldown activates', async ({ page }) => {
  test.setTimeout(30000);

  await page.goto('http://localhost:3457/index.html');
  await page.waitForSelector('canvas');

  // Wait for game module to fully load
  await page.waitForFunction(() => typeof window.__FLAPPY_CLEAR_PIPES === 'function', { timeout: 5000 });

  // Disable gravity, freeze pipes, clear pipes — isolate overheat mechanic
  await page.evaluate(() => {
    window.__FLAPPY_GRAVITY_SCALE = 0;
    window.__GAME_CONFIG.PIPES.SPEED = 0;
    window.__FLAPPY_CLEAR_PIPES();
  });

  await page.evaluate(() => window.__FLAPPY_START_QUIET());
  await page.waitForFunction(() => window.__FLAPPY_STARTED === true, { timeout: 5000 });

  // Hold D until stamina hits 0 (MAX_DURATION=1.5s at DRAIN_RATE=1.0/s → ~1.5s to deplete)
  await page.keyboard.down('d');

  // Wait for cooldown to kick in (stamina=0 triggers force-unphase + cooldown)
  await page.waitForFunction(
    () => window.__FLAPPY_PHASE_COOLDOWN > 0,
    { timeout: 10000, polling: 'raf' }
  );

  const cooldown = await page.evaluate(() => window.__FLAPPY_PHASE_COOLDOWN);
  const phasing  = await page.evaluate(() => window.__FLAPPY_PHASING);
  const stamina  = await page.evaluate(() => window.__FLAPPY_PHASE_STAMINA);

  expect(phasing).toBe(false);
  expect(stamina).toBeCloseTo(0, 1);
  expect(cooldown).toBeGreaterThan(0);

  await page.keyboard.up('d');
});

test('Stamina recharges after cooldown expires', async ({ page }) => {
  test.setTimeout(30000);

  await page.goto('http://localhost:3457/index.html');
  await page.waitForSelector('canvas');

  // Wait for game module to fully load
  await page.waitForFunction(() => typeof window.__FLAPPY_CLEAR_PIPES === 'function', { timeout: 5000 });

  // Disable gravity, freeze pipes, clear pipes — isolate overheat mechanic
  await page.evaluate(() => {
    window.__FLAPPY_GRAVITY_SCALE = 0;
    window.__GAME_CONFIG.PIPES.SPEED = 0;
    window.__FLAPPY_CLEAR_PIPES();
  });

  await page.evaluate(() => window.__FLAPPY_START_QUIET());
  await page.waitForFunction(() => window.__FLAPPY_STARTED === true, { timeout: 5000 });

  // Hold D until stamina depletes
  await page.keyboard.down('d');
  await page.waitForFunction(
    () => window.__FLAPPY_PHASE_COOLDOWN > 0,
    { timeout: 10000, polling: 'raf' }
  );
  await page.keyboard.up('d');

  // Wait for cooldown to expire
  await page.waitForFunction(
    () => window.__FLAPPY_PHASE_COOLDOWN <= 0,
    { timeout: 5000, polling: 'raf' }
  );

  // Wait for stamina to start recharging
  await page.waitForFunction(
    () => window.__FLAPPY_PHASE_STAMINA > 0.05,
    { timeout: 5000, polling: 'raf' }
  );

  const recharged = await page.evaluate(() => window.__FLAPPY_PHASE_STAMINA);
  expect(recharged).toBeGreaterThan(0.05);
});

test('Laser kills bird when not phasing', async ({ page }) => {
  test.setTimeout(30000);

  await page.goto('http://localhost:3457/index.html');
  await page.waitForSelector('canvas');

  // Force all pipes to have lasers and no warmup
  await page.evaluate(() => {
    window.__GAME_CONFIG.LASER.SPAWN_CHANCE = 1.0;
    window.__GAME_CONFIG.LASER.WARMUP_PIPES = 0;
    window.__GAME_CONFIG.LASER.GAP_FRACTION = 0.99; // laser fills nearly the whole gap
  });

  await page.evaluate(() => window.__FLAPPY_START_QUIET());
  await page.waitForFunction(() => window.__FLAPPY_STARTED === true, { timeout: 5000 });

  // Don't phase — bird should hit laser and die
  await page.waitForFunction(
    () => window.__FLAPPY_OVER === true,
    { timeout: 20000, polling: 'raf' }
  );

  const over = await page.evaluate(() => window.__FLAPPY_OVER);
  expect(over).toBe(true);
});
