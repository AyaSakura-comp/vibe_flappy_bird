const { test, expect } = require('@playwright/test');

test('Rapid-fire inputs are debounced to single flap', async ({ page }) => {
  test.setTimeout(20000);

  await page.goto('http://localhost:3457/index.html');
  await page.waitForSelector('canvas');

  // Freeze gravity to measure velocity accurately
  await page.evaluate(() => {
    window.__FLAPPY_GRAVITY_SCALE = 0;
    window.__FLAPPY_START_QUIET();
  });
  await page.waitForFunction(() => window.__FLAPPY_STARTED === true, { timeout: 5000 });

  // Initial state: velocity 0
  const v0 = await page.evaluate(() => window.__FLAPPY_VELOCITY);
  expect(v0).toBe(0);

  // Fire 5 rapid touch events in same frame (effectively)
  await page.evaluate(() => {
    for(let i=0; i<5; i++) {
       document.dispatchEvent(new TouchEvent('touchstart', {
         changedTouches: [new Touch({ identifier: i, target: document.body, clientX: 10, clientY: 10 })]
       }));
    }
  });

  // Wait one frame and check velocity — should match exactly ONE flap (-0.25)
  // If debouncing failed, it might be -1.25 or more.
  await page.waitForFunction(() => Math.abs(window.__FLAPPY_VELOCITY) > 0, { timeout: 2000, polling: 'raf' });
  const v1 = await page.evaluate(() => window.__FLAPPY_VELOCITY);
  
  // CONFIG.PHYSICS.FLAP is -0.25
  expect(v1).toBeCloseTo(-0.25, 2);

  // Wait 150ms (more than 100ms cooldown) and flap again — should work
  await page.waitForTimeout(150);
  await page.evaluate(() => {
     document.dispatchEvent(new TouchEvent('touchstart', {
       changedTouches: [new Touch({ identifier: 99, target: document.body, clientX: 10, clientY: 10 })]
     }));
  });
  
  // Velocity should have reset to -0.25 again
  const v2 = await page.evaluate(() => window.__FLAPPY_VELOCITY);
  expect(v2).toBeCloseTo(-0.25, 2);
});
