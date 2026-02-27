# [Pointer Events Unified Input] Implementation Plan

> **For Gemini:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Unify mouse and touch input into a single Pointer Events system to support multi-touch and resolve mobile browser event conflicts.

**Architecture:** Replace separate `mousedown`, `mouseup`, `touchstart`, and `touchend` listeners with `pointerdown`, `pointerup`, and `pointercancel`. Use a `Map` to track active pointers for multi-touch coordination.

**Tech Stack:** JavaScript (ES6+), Pointer Events API, CSS `touch-action`.

---

### Task 1: CSS touch-action configuration

**Files:**
- Modify: `index.html:13-13`

**Step 1: Update CSS to disable browser touch gestures**

```css
body { overflow: hidden; background: #050010; font-family: 'Share Tech Mono', 'Courier New', monospace; touch-action: none; }
```

**Step 2: Verify existing CSS**

Ensure `touch-action: none` is already present or correctly updated.

**Step 3: Commit**

```bash
git add index.html
git commit -m "css: ensure touch-action is none for pointer events"
```

---

### Task 2: Refactor Input Logic to Pointer Events

**Files:**
- Modify: `js/game.js:146-215`

**Step 1: Replace Mouse and Touch Listeners with Pointer Listeners**

```javascript
// Track active pointers for multi-touch (split-screen logic)
const activePointers = new Map();

function handlePointerUp(e) {
  activePointers.delete(e.pointerId);
  
  // Check if any REMAINING pointers are on the right side
  let rightSideStillHeld = false;
  for (const xRatio of activePointers.values()) {
    if (xRatio >= 0.5) {
      rightSideStillHeld = true;
      break;
    }
  }
  if (!rightSideStillHeld) setPhasing(false);
}

document.addEventListener('pointerdown', (e) => {
  // pointerType can be 'mouse', 'touch', or 'pen'
  const xRatio = e.clientX / window.innerWidth;
  activePointers.set(e.pointerId, xRatio);
  
  // Ensure the target receives pointerup even if the finger/mouse leaves the window
  if (e.target.setPointerCapture) {
    e.target.setPointerCapture(e.pointerId);
  }

  if (xRatio < 0.5) {
    gameOver ? tryRestart() : handleInput();
  } else {
    gameOver ? tryRestart() : setPhasing(true);
  }
});

document.addEventListener('pointerup', handlePointerUp);
document.addEventListener('pointercancel', handlePointerUp);

// Prevent long-press context menu on mobile from interrupting gameplay
document.addEventListener('contextmenu', e => e.preventDefault());
```

**Step 2: Remove legacy mouse/touch listeners**

Delete all `mousedown`, `mouseup`, `touchstart`, `touchend`, and `touchcancel` listeners in `js/game.js`.

**Step 3: Commit**

```bash
git add js/game.js
git commit -m "feat: unified input with Pointer Events API"
```

---

### Task 3: Update E2E Tests for Pointer Events

**Files:**
- Modify: `tests/*.spec.js`

**Step 1: Use pointer-specific methods or ensure click simulates pointer events**

In Playwright, `page.mouse.click` typically generates pointer events in modern Chromium. However, for explicit multi-touch testing, we should use `page.mouse.down` and `page.mouse.up` or specialized pointer dispatch.

**Step 2: Update `tests/phase-input.spec.js` to verify multi-pointer behavior**

```javascript
test('Simultaneous flap and phase with multiple pointers', async ({ page }) => {
  await page.goto('http://localhost:3457/index.html');
  await page.evaluate(() => window.__FLAPPY_START_QUIET());

  // First pointer on right side (Phase)
  await page.mouse.move(800, 500);
  await page.mouse.down();
  await page.waitForFunction(() => window.__FLAPPY_PHASING === true);

  // Second pointer on left side (Flap) - Note: page.mouse is single-pointer.
  // To test true multi-touch in Playwright, we use touchscreen.
  await page.touchscreen.tap(200, 500);
  
  // Verify bird gained velocity while still phasing
  const vel = await page.evaluate(() => window.__FLAPPY_VELOCITY);
  expect(vel).toBeLessThan(0);
  expect(await page.evaluate(() => window.__FLAPPY_PHASING)).toBe(true);

  await page.mouse.up();
  expect(await page.evaluate(() => window.__FLAPPY_PHASING)).toBe(false);
});
```

**Step 3: Run all tests**

Run: `node node_modules/@playwright/test/cli.js test`
Expected: All core logic tests PASS.

**Step 4: Commit**

```bash
git add tests/
git commit -m "test: update tests for pointer events and multi-touch"
```
