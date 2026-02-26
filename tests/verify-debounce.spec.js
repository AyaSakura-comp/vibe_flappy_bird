const { test, expect } = require('@playwright/test');

test('Verify input debounce visually', async ({ page }) => {
  test.setTimeout(30000);

  await page.goto('http://localhost:3457/index.html');
  await page.waitForSelector('canvas');

  // Inject a "Jitter Bot" that fires 10 rapid touches every 1 second
  await page.addInitScript(() => {
    let lastJitter = 0;
    const jitter = (now) => {
      if (!window.__FLAPPY_STARTED || window.__FLAPPY_OVER) {
        requestAnimationFrame(jitter); return;
      }
      
      if (now - lastJitter > 1000) {
        console.log('TEST: Firing jitter burst (10 touches)');
        for(let i=0; i<10; i++) {
          document.dispatchEvent(new TouchEvent('touchstart', {
            changedTouches: [{ clientX: 10, clientY: 10, identifier: Date.now() + i }]
          }));
        }
        lastJitter = now;
      }
      requestAnimationFrame(jitter);
    };
    requestAnimationFrame(jitter);
  });

  // Start game
  await page.evaluate(() => window.__FLAPPY_START_QUIET());
  await page.waitForFunction(() => window.__FLAPPY_STARTED === true, { timeout: 5000 });

  // Let it run for 5 seconds to capture several jitter bursts in the video
  await page.waitForTimeout(5000);

  const isOver = await page.evaluate(() => window.__FLAPPY_OVER);
  // We don't care if it dies, we just want the video evidence of the flaps
});
