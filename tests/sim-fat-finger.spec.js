const { test, expect } = require('@playwright/test');

test.use({ hasTouch: true });

test('Simulation: Touch + Ghost Click', async ({ page }) => {
  test.setTimeout(20000);

  await page.goto('http://localhost:3457/index.html');
  await page.waitForSelector('canvas');

  const logs = [];
  page.on('console', msg => {
    if (msg.text().startsWith('INPUT_DEBUG:')) {
      logs.push(msg.text());
      console.log('BROWSER:', msg.text());
    }
  });

  await page.evaluate(() => {
    window.__FLAPPY_GRAVITY_SCALE = 0;
    window.__FLAPPY_START_QUIET();
  });
  await page.waitForFunction(() => window.__FLAPPY_STARTED === true);

  console.log('--- Simulating Touch followed by Ghost Mouse Click (120ms later) ---');
  
  // 1. Fire a Touch
  await page.touchscreen.tap(100, 100);
  
  // 2. Wait 120ms (Ghost clicks happen after touch, typically 100-300ms)
  await page.waitForTimeout(120);
  
  // 3. Fire a Mouse Click at same spot
  await page.mouse.click(100, 100);

  // Wait for game loop
  await page.waitForTimeout(100);

  const executeCount = logs.filter(l => l.includes('Executing Flap')).length;
  console.log(`Results: Executions=${executeCount}`);
  
  // If executeCount === 2, then our 100ms debounce is too short to block ghost clicks.
  expect(executeCount).toBe(1);
});

test('Simulation: Multi-finger (Fat Finger) using touchscreen.tap', async ({ page }) => {
  await page.goto('http://localhost:3457/index.html');
  await page.waitForSelector('canvas');
  const logs = [];
  page.on('console', msg => {
    if (msg.text().startsWith('INPUT_DEBUG:')) logs.push(msg.text());
  });
  await page.evaluate(() => {
    window.__FLAPPY_GRAVITY_SCALE = 0;
    window.__FLAPPY_START_QUIET();
  });

  console.log('--- Simulating Multi-finger Rapid Taps (10ms apart) ---');
  await page.touchscreen.tap(100, 100);
  await page.waitForTimeout(10);
  await page.touchscreen.tap(105, 105);

  await page.waitForTimeout(100);
  const executeCount = logs.filter(l => l.includes('Executing Flap')).length;
  console.log(`Multi-tap Executions: ${executeCount}`);
  expect(executeCount).toBe(1);
});
