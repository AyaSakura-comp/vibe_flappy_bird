# Mobile Double-Flap Fix Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix mobile double-flap bug where a single left-side tap causes two flap impulses.

**Architecture:** Two-part fix. (1) JS: `e.preventDefault()` on `touchstart`/`touchend` (already applied) suppresses the browser's synthetic `mousedown` after touch. (2) CSS: `touch-action: none` on `body` reinforces this at the CSS layer and disables pinch-zoom. A new Playwright regression test verifies synthetic `mousedown` is not fired after a `touchstart`.

**Tech Stack:** Vanilla JS touch events, CSS `touch-action`, Playwright (synthetic TouchEvent injected via `page.evaluate`).

---

## What's Already Done

The JS fix is already applied in `js/game.js` (lines 134–166):
- `touchstart` and `touchend` now use `{ passive: false }` and call `e.preventDefault()`
- `touchcancel` uses `{ passive: false }`

The two remaining tasks are: CSS hardening and a regression test.

---

### Task 1: Add `touch-action: none` to index.html

**Files:**
- Modify: `index.html:11` (the `body` style rule)

**Step 1: Apply the CSS change**

In `index.html`, find the `body` style rule (line 11):
```css
body { overflow: hidden; background: #050010; font-family: 'Share Tech Mono', 'Courier New', monospace; }
```

Change it to:
```css
body { overflow: hidden; background: #050010; font-family: 'Share Tech Mono', 'Courier New', monospace; touch-action: none; }
```

`touch-action: none` tells the browser that JS handles all touch gestures — this prevents pinch-zoom, scroll, and any browser-level touch handling on the game canvas.

**Step 2: Verify the page still loads**

Run the server (if not already running):
```bash
node node_modules/http-server/bin/http-server . -p 3457 --cors -c-1
```

Open `http://localhost:3457` in a browser and confirm the canvas renders normally. No visual change expected — this is a behavioural change only.

**Step 3: Commit**

```bash
git add index.html
git commit -m "fix: add touch-action:none to body to prevent pinch-zoom and reinforce touch preventDefault"
```

---

### Task 2: Add Double-Flap Regression Test

**Files:**
- Modify: `tests/phase-input.spec.js` (append new test at end of file)

**Step 1: Understand what the test must verify**

The bug was: `touchstart` fires → `handleInput()` called → browser synthesizes `mousedown` → `handleInput()` called again.

The fix: `e.preventDefault()` in `touchstart` suppresses the synthetic `mousedown`.

The test injects a `mousedown` listener *before* dispatching a synthetic `TouchEvent`, then asserts the listener was never called after 300ms.

**Step 2: Write the failing test**

Append to `tests/phase-input.spec.js`:

```js
test('Touch tap does not synthesize a mousedown event (double-flap regression)', async ({ page }) => {
  test.setTimeout(15000);

  await page.goto('http://localhost:3457/index.html');
  await page.waitForSelector('canvas');
  await page.evaluate(() => window.__FLAPPY_START_QUIET());
  await page.waitForFunction(() => window.__FLAPPY_STARTED === true, { timeout: 5000 });

  // Count how many times mousedown fires after a synthetic touch on the left side.
  // With the fix (e.preventDefault() on touchstart), this should be 0.
  const mousedownCount = await page.evaluate(() => {
    return new Promise((resolve) => {
      let count = 0;
      document.addEventListener('mousedown', () => { count++; }, { capture: true });

      // Simulate a left-side tap via TouchEvent
      const target = document.body;
      const touch = new Touch({
        identifier: Date.now(),
        target,
        clientX: window.innerWidth * 0.25, // left quarter
        clientY: window.innerHeight * 0.5,
        radiusX: 10, radiusY: 10,
        rotationAngle: 0, force: 1,
      });
      target.dispatchEvent(new TouchEvent('touchstart', {
        changedTouches: [touch],
        touches: [touch],
        bubbles: true,
        cancelable: true,
      }));
      target.dispatchEvent(new TouchEvent('touchend', {
        changedTouches: [touch],
        touches: [],
        bubbles: true,
        cancelable: true,
      }));

      // Wait 300ms for any synthetic mouse events to fire
      setTimeout(() => resolve(count), 300);
    });
  });

  expect(mousedownCount).toBe(0);
});
```

**Step 3: Run test to verify it fails (without the fix)**

> **Note:** The fix is already applied, so this test will PASS immediately. If you want to verify the test catches the bug, temporarily revert `game.js` to `{ passive: true }` and remove `e.preventDefault()`, then run. Expect: FAIL with `mousedownCount = 1`. Then restore the fix.

**Step 4: Run the test to verify it passes**

```bash
node node_modules/@playwright/test/cli.js test tests/phase-input.spec.js
```

Expected: ALL 3 tests PASS (2 existing + 1 new).

**Step 5: Run full phase-input suite to confirm no regressions**

```bash
node node_modules/@playwright/test/cli.js test tests/phase-input.spec.js --reporter=line
```

Expected: 3 passed, 0 failed.

**Step 6: Commit**

```bash
git add tests/phase-input.spec.js
git commit -m "test: add regression test for mobile double-flap (synthetic mousedown after touchstart)"
```

---

## Verification Summary

After both tasks:
- `index.html` body has `touch-action: none`
- `game.js` touchstart/touchend use `{ passive: false }` + `e.preventDefault()`
- `phase-input.spec.js` has 3 tests, all passing
- No other test files changed

Run the full input test to confirm clean state:
```bash
node node_modules/@playwright/test/cli.js test tests/phase-input.spec.js
```
