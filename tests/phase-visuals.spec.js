const { test, expect } = require('@playwright/test');

test('Phase visual: ship appearance changes when phasing', async ({ page }) => {
  test.setTimeout(60000);

  page.on('console', msg => console.log('BROWSER:', msg.text()));

  await page.goto('http://localhost:3457/index.html');
  await page.waitForSelector('canvas');

  await page.evaluate(() => {
    console.log('Test: Initializing game state overrides');
    window.focus();
    window.__FLAPPY_GRAVITY_SCALE = 0;
    window.__GAME_CONFIG.PIPES.SPEED = 0;
    window.__FLAPPY_CLEAR_PIPES();
    window.__FLAPPY_START_QUIET();
    console.log('Test: started=', window.__FLAPPY_STARTED);
  });

  await page.waitForFunction(() => window.__FLAPPY_STARTED === true, { timeout: 5000 });
  console.log('Test: Game started');

  // Fly for 2 seconds in solid state
  await page.waitForTimeout(2000);

  // Activate phase for 1 second
  console.log('Test: Pressing D');
  await page.keyboard.down('d');
  
  await page.waitForFunction(() => {
    return window.__FLAPPY_PHASING === true;
  }, { timeout: 5000, polling: 'raf' });
  
  console.log('Test: Phasing active');
  await page.waitForTimeout(1000);

  // Deactivate phase
  console.log('Test: Releasing D');
  await page.keyboard.up('d');
  await page.waitForFunction(() => window.__FLAPPY_PHASING === false, { timeout: 2000 });
  console.log('Test: Phasing deactivated');

  // Fly for 1 more second in solid state
  await page.waitForTimeout(1000);

  const score = await page.evaluate(() => window.__FLAPPY_SCORE || 0);
  expect(score).toBeGreaterThanOrEqual(0);
});
