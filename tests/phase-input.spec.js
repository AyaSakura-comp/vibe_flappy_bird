const { test, expect } = require('@playwright/test');

test('Phase activates on D key hold and deactivates on release', async ({ page }) => {
  test.setTimeout(20000);

  await page.goto('http://localhost:3457/index.html');
  await page.waitForSelector('canvas');

  // Start game quietly (no flap velocity)
  await page.evaluate(() => window.__FLAPPY_START_QUIET());
  await page.waitForFunction(() => window.__FLAPPY_STARTED === true, { timeout: 5000 });

  // Verify not phasing initially
  const initialPhase = await page.evaluate(() => window.__FLAPPY_PHASING);
  expect(initialPhase).toBe(false);

  // Hold D key — should activate phase
  await page.keyboard.down('d');
  await page.waitForFunction(() => window.__FLAPPY_PHASING === true, { timeout: 2000, polling: 'raf' });

  // Release D key — should deactivate phase
  await page.keyboard.up('d');
  await page.waitForFunction(() => window.__FLAPPY_PHASING === false, { timeout: 2000, polling: 'raf' });
});

test('Flap and phase work simultaneously', async ({ page }) => {
  test.setTimeout(20000);

  await page.goto('http://localhost:3457/index.html');
  await page.waitForSelector('canvas');
  await page.evaluate(() => window.__FLAPPY_START_QUIET());
  await page.waitForFunction(() => window.__FLAPPY_STARTED === true, { timeout: 5000 });

  // Hold D to phase
  await page.keyboard.down('d');
  await page.waitForFunction(() => window.__FLAPPY_PHASING === true, { timeout: 2000, polling: 'raf' });

  // Flap while phasing — bird should gain upward velocity AND still be phasing
  const yBefore = await page.evaluate(() => window.__FLAPPY_BIRD_Y);
  await page.keyboard.press('Space');

  // Wait a few frames for flap to take effect
  await page.waitForFunction((prevY) => {
    return window.__FLAPPY_BIRD_Y > prevY && window.__FLAPPY_PHASING === true;
  }, yBefore, { timeout: 3000, polling: 'raf' });

  const phasing = await page.evaluate(() => window.__FLAPPY_PHASING);
  await page.keyboard.up('d');
  expect(phasing).toBe(true);
});

test('Touch tap does not synthesize a mousedown event (double-flap regression)', async ({ browser }) => {
  test.setTimeout(15000);

  // IMPORTANT: Must use hasTouch:true context — only touch-emulated contexts
  // activate the browser's compatibility-mouse-events pipeline that the fix suppresses.
  const context = await browser.newContext({ hasTouch: true, isMobile: true });
  const page = await context.newPage();

  await page.goto('http://localhost:3457/index.html');
  await page.waitForSelector('canvas');
  await page.evaluate(() => window.__FLAPPY_START_QUIET());
  await page.waitForFunction(() => window.__FLAPPY_STARTED === true, { timeout: 5000 });

  // Count how many times mousedown fires after a synthetic touch on the left side.
  // With the fix (e.preventDefault() on touchstart), this should be 0.
  // Also capture velocity immediately after touch to verify it flapped.
  const { mousedownCount, velocityAfterTouch } = await page.evaluate(() => {
    return new Promise((resolve) => {
      let count = 0;
      document.addEventListener('mousedown', () => { count++; }, { capture: true });

      // Dispatch on document — matches where the game listener is attached
      const target = document;
      const pointerDown = new PointerEvent('pointerdown', {
        pointerId: 101,
        clientX: window.innerWidth * 0.25, // left quarter
        clientY: window.innerHeight * 0.5,
        bubbles: true,
        cancelable: true,
        pointerType: 'touch',
      });
      const pointerUp = new PointerEvent('pointerup', {
        pointerId: 101,
        clientX: window.innerWidth * 0.25,
        clientY: window.innerHeight * 0.5,
        bubbles: true,
        cancelable: true,
        pointerType: 'touch',
      });
      target.dispatchEvent(pointerDown);
      target.dispatchEvent(pointerUp);

      // Wait for next frame for game loop to update __FLAPPY_VELOCITY
      requestAnimationFrame(() => {
        const vel = window.__FLAPPY_VELOCITY;
        // 300ms exceeds any browser compatibility-event delay (typically synchronous in Chromium)
        setTimeout(() => resolve({ mousedownCount: count, velocityAfterTouch: vel }), 300);
      });
    });
  });

  expect(mousedownCount).toBe(0);

  // Also verify the touch DID trigger a flap (feature still works).
  // FLAP = -0.25 in this game's physics (negative = upward).
  expect(velocityAfterTouch).toBeLessThan(0);

  await context.close();
});

test('Simultaneous flap and phase with multiple pointers', async ({ page }) => {
  await page.goto('http://localhost:3457/index.html');
  await page.waitForSelector('canvas');
  await page.evaluate(() => window.__FLAPPY_START_QUIET());
  await page.waitForFunction(() => window.__FLAPPY_STARTED === true, { timeout: 5000 });

  // Use page.evaluate to simulate simultaneous pointers
  await page.evaluate(() => {
    // 1. Phasing pointer on right
    const p1Down = new PointerEvent('pointerdown', {
      pointerId: 90,
      clientX: window.innerWidth * 0.8,
      clientY: window.innerHeight * 0.5,
      bubbles: true
    });
    document.dispatchEvent(p1Down);
  });
  
  await page.waitForFunction(() => window.__FLAPPY_PHASING === true);

  // 2. Flapping pointer on left
  await page.evaluate(() => {
    const p2Down = new PointerEvent('pointerdown', {
      pointerId: 91,
      clientX: window.innerWidth * 0.2,
      clientY: window.innerHeight * 0.5,
      bubbles: true
    });
    const p2Up = new PointerEvent('pointerup', {
      pointerId: 91,
      bubbles: true
    });
    document.dispatchEvent(p2Down);
    document.dispatchEvent(p2Up);
  });
  
  // Verify bird gained velocity while still phasing
  const vel = await page.evaluate(() => window.__FLAPPY_VELOCITY);
  expect(vel).toBeLessThan(0);
  expect(await page.evaluate(() => window.__FLAPPY_PHASING)).toBe(true);

  // Release the phasing pointer
  await page.evaluate(() => {
    const upEvent = new PointerEvent('pointerup', {
      pointerId: 90,
      bubbles: true
    });
    document.dispatchEvent(upEvent);
  });
  
  expect(await page.evaluate(() => window.__FLAPPY_PHASING)).toBe(false);
});
