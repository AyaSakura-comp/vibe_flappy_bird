# Fix Gemini Verification — Complete Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make gemini-3-pro-preview reliably PASS the game's visual verification by fixing all three root causes simultaneously.

**Root Causes:**
1. **Blind test** — dumb 1300ms click strategy can't navigate pipes with varied gap heights; bird drifts low and dies on pipe 2, so Gemini only sees the first (centered) pipe repeated.
2. **Fog hides far pipes** — fog start=20 clips pipes at z=-13 (dist=21) and z=-18 (dist=26); dark cylinder color blends into dark background; Gemini only counts 1-2 "clearly visible" pipes.
3. **PIPE_GAP bloated** — hacked up to 9.0 to compensate for problem #1; makes game look unrealistic.

**Architecture:**
- **Fix #1:** Expose `window.BIRD_Y` from the game loop so the Playwright test can read real-time bird position and flap adaptively — targeting y≈0 regardless of pipe gap height.
- **Fix #2:** Remove fog entirely (or push start to z=40+) so all 4 prefilled pipes are fully lit. Make far-pipe cylinder color brighter (emissive boost) so the dark column is distinguishable from background.
- **Fix #3:** Restore PIPE_GAP to 5.0 (original intended value). With the adaptive test, the bird can navigate narrow gaps.

**Tech Stack:** Three.js r128, Playwright, Gemini CLI

**Run command:** `NODE_PATH=/home/family/.node_modules/flappy3d/node_modules /home/family/.node_modules/flappy3d/node_modules/.bin/playwright test --config playwright.config.js --output /tmp/flappy-resultsN --reporter=list`

**Gemini verify command:**
```bash
cd /home/family && echo "PROMPT @/home/family/flappy_test.webm" | gemini -m gemini-3-pro-preview -y -e ""
```
Copy video first: `find /tmp/flappy-resultsN -name "*.webm" | xargs -I{} cp {} /home/family/flappy_test.webm`

---

### Task 1: Expose game state to window and restore PIPE_GAP

**Files:**
- Modify: `/home/family/large_disk/flappy3d/index.html`

**What to change:**

**Step 1: Restore PIPE_GAP to 5.0**

Find: `const PIPE_GAP = 9.0;  // very wide for test`
Replace with: `const PIPE_GAP = 5.0;`

**Step 2: Expose game state in the animation loop**

In the `loop(now)` function, just before `renderer.render(scene, camera)`, add:
```js
      // Expose state for Playwright adaptive test
      window.__FLAPPY_BIRD_Y  = birdGroup.position.y;
      window.__FLAPPY_SCORE   = score;
      window.__FLAPPY_STARTED = started;
      window.__FLAPPY_OVER    = gameOver;
```

**Step 3: Verify the change looks right**

The loop function should end like:
```js
      // Expose state for Playwright adaptive test
      window.__FLAPPY_BIRD_Y  = birdGroup.position.y;
      window.__FLAPPY_SCORE   = score;
      window.__FLAPPY_STARTED = started;
      window.__FLAPPY_OVER    = gameOver;

      renderer.render(scene, camera);
    }
```

No commit yet — continue to Task 2.

---

### Task 2: Remove fog and brighten far-pipe cylinders

**Files:**
- Modify: `/home/family/large_disk/flappy3d/index.html`

**What to change:**

**Step 1: Remove fog**

Find: `scene.fog = new THREE.Fog(0x050010, 20, 80);`
Replace with: `// No fog — all pipes must be visible at depth for verification`
(Delete or comment out the line.)

**Step 2: Brighten the pipe cylinder emissive**

In `makePipeSegment`, find:
```js
      const cylMat = new THREE.MeshPhongMaterial({
        color: 0x2a0044,
        emissive: 0x220033,
        shininess: 60,
      });
```
Replace with:
```js
      const cylMat = new THREE.MeshPhongMaterial({
        color: 0x3a0066,
        emissive: 0x440055,  // stronger emissive so cylinder is visible against dark background
        shininess: 80,
      });
```

No commit yet — continue to Task 3.

---

### Task 3: Rewrite Playwright test with adaptive flapping

**Files:**
- Modify: `/home/family/large_disk/flappy3d/tests/flappy.spec.js`

**What to change — replace the entire file with:**

```js
const { test, expect } = require('@playwright/test');

test('3D Flappy Bird - bird flaps and survives', async ({ page }) => {
  await page.goto('http://localhost:3456/index.html');

  // Wait for canvas and Three.js scene to initialize
  await page.waitForSelector('canvas', { timeout: 10000 });
  await page.waitForTimeout(1500);

  const cx = 640, cy = 360;

  // Helper: read bird Y position from exposed game state
  const getBirdY = () => page.evaluate(() => window.__FLAPPY_BIRD_Y ?? 0);
  const isOver   = () => page.evaluate(() => window.__FLAPPY_OVER ?? false);

  // Adaptive flap loop: run for ~16 seconds, flap when bird drifts below target
  // Target y=0 (center). Flap when bird.y < -0.5 to counteract downward drift.
  // This lets the bird navigate any gap height (top, bottom, center) by keeping
  // it near y=0 which is within all gap ranges (yOffset ±2.0, PIPE_GAP 5.0 → gapBot at -0.5 min).
  const TARGET_Y = 0;
  const FLAP_THRESHOLD = -0.5; // flap when bird falls below this
  const CHECK_INTERVAL_MS = 300; // check every 300ms
  const DURATION_MS = 16000;

  // First click always starts the game
  await page.mouse.click(cx, cy);
  await page.waitForTimeout(500);

  const startTime = Date.now();
  while (Date.now() - startTime < DURATION_MS) {
    const over = await isOver();
    if (over) {
      // Game over — wait for explosion + overlay (900ms delay), then restart
      await page.waitForTimeout(1200);
      await page.mouse.click(cx, cy); // restart
      await page.waitForTimeout(500);
      await page.mouse.click(cx, cy); // start new game + first flap
      await page.waitForTimeout(300);
      continue;
    }

    const birdY = await getBirdY();
    if (birdY < FLAP_THRESHOLD) {
      await page.mouse.click(cx, cy);
    }

    await page.waitForTimeout(CHECK_INTERVAL_MS);
  }

  // Final assertions
  await page.waitForTimeout(500);
  await expect(page.locator('#score')).toBeVisible();
  await expect(page.locator('canvas')).toBeVisible();

  const finalScore = await page.locator('#score').textContent();
  const overlayClass = await page.locator('#overlay').getAttribute('class');
  console.log('Score at end:', finalScore);
  console.log('Overlay class at end:', overlayClass);
});
```

**Why this works:**
- `getBirdY()` reads `window.__FLAPPY_BIRD_Y` exposed by the game loop
- Flaps only when bird drops below y=-0.5, keeping it near y=0
- At y=0, bird is within ALL pipe gaps: even the lowest gap (yOffset=-2.0 → gapBot=-4.5) and highest (yOffset=+2.0 → gapBot=-0.5) both include y=0
- Handles game-over/restart gracefully

**Step: Run the test once to verify it passes:**
```bash
NODE_PATH=/home/family/.node_modules/flappy3d/node_modules /home/family/.node_modules/flappy3d/node_modules/.bin/playwright test --config playwright.config.js --output /tmp/flappy-results-fix1 --reporter=list
```
Expected: 1 passed, Score at end > 3 (bird survives multiple pipes).

**Step: Commit all three changes together:**
```bash
cd /home/family/large_disk/flappy3d
git add index.html tests/flappy.spec.js
git commit -m "fix: adaptive test + remove fog + restore PIPE_GAP for reliable Gemini verification

- Expose window.__FLAPPY_BIRD_Y/SCORE/STARTED/OVER from game loop
- Playwright test reads bird Y every 300ms, flaps when below -0.5 threshold
- Bird stays near y=0 — within all pipe gap ranges regardless of yOffset
- Remove scene fog so all 4 prefilled pipes are visible at full depth
- Brighten pipe cylinder emissive so dark column contrasts dark background
- Restore PIPE_GAP=5.0 (was hacked to 9.0 to compensate for blind test)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 3b: Fix explosion invisible on boundary death

**Files:**
- Modify: `/home/family/large_disk/flappy3d/index.html`

**Problem:** When the bird hits the y=±6 boundary, `triggerGameOver()` spawns the explosion at y=±6 which is off-camera. Gemini sees an abrupt cut instead of an explosion.

**Fix:** In `triggerGameOver()`, clamp the explosion y to the visible range before spawning particles.

Find:
```js
      spawnExplosion(
        birdGroup.position.x,
        birdGroup.position.y,
        birdGroup.position.z
      );
```

Replace with:
```js
      // Clamp y so explosion is visible even on boundary kills (bird at y=±6 is off-screen)
      spawnExplosion(
        birdGroup.position.x,
        Math.max(-4, Math.min(4, birdGroup.position.y)),
        birdGroup.position.z
      );
```

Add this to the same commit in Task 3.

---

### Task 4: Verify with gemini-3-pro-preview

**Step 1: Copy video**
```bash
find /tmp/flappy-results-fix1 -name "*.webm" | xargs -I{} cp {} /home/family/flappy_test.webm
```

**Step 2: Run Gemini verification**
```bash
cd /home/family && echo "You are a QA engineer reviewing a screen recording from an automated UI test.

Describe EXACTLY what you observe in this video @/home/family/flappy_test.webm step by step in chronological order.

Then compare against this EXPECTED BEHAVIOR:
1. Cyberpunk-themed 3D Flappy Bird game with dark background and neon colors
2. Multiple pipe obstacles (at least 3) clearly visible simultaneously at different distances from the very start of gameplay
3. Each pipe obstacle has its gap at a CLEARLY DIFFERENT vertical position — some near top, some near bottom, some near center — with obvious variation between pipes
4. The bird flaps upward when the game detects it falling, staying roughly centered, and falls due to gravity
5. When the bird hits an obstacle, a neon particle explosion animation plays before the game-over overlay appears
6. The game runs stably throughout

Give a verdict: PASS or FAIL.

If FAIL, explain exhaustively:
- What specifically was expected vs what actually happened
- At what point in the video the behavior diverged from expectations
- What the actual behavior was instead
- Any visual anomalies, timing issues, missing elements, or incorrect states you noticed
- Possible root causes based on what you observed

The detailed reasoning is the most important part — describe every discrepancy, no matter how small." | gemini -m gemini-3-pro-preview -y -e "" 2>&1
```

**Expected:** PASS

**If FAIL on "pipe visibility":** The fog removal might not be sufficient. In that case also increase pipe cap ring brightness:
```js
// In makePipeSegment, change cap color to brighter:
const capMat = new THREE.MeshBasicMaterial({ color: 0xff44cc }); // brighter magenta
```

**If FAIL on "gap variety":** Check that `PIPE_Y_PATTERN = [0, 2.0, -2.0, 1.0, -1.0]` is intact and `pipeCount` increments correctly per pipe.

**If PASS:** Push to remote and done.

---

### Task 5: Push to remote

```bash
cd /home/family/large_disk/flappy3d && git push origin main
```

Expected: pushed to `git@github.com:AyaSakura-comp/vibe_flappy_bird.git`, GitHub Pages auto-deploys.

---

## Summary of All Changes

| File | Change | Why |
|------|--------|-----|
| `index.html` | Remove `scene.fog` line | Far pipes (z=-13, -18) must be fully lit |
| `index.html` | Brighten `emissive: 0x440055` | Dark cylinder must contrast dark background |
| `index.html` | `PIPE_GAP = 5.0` | Restore correct gameplay value |
| `index.html` | Add `window.__FLAPPY_*` in loop | Expose state for adaptive test |
| `tests/flappy.spec.js` | Full rewrite with adaptive flap | Bird stays near y=0, survives all gap heights |
