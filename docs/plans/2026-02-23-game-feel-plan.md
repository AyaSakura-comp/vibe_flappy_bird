# Phase 1: Game Feel Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make Cyber Flap feel responsive and intense — velocity rotation, neon trail, screen shake on death, and 75% faster pipes.

**Architecture:** Four independent features layered onto the existing module system. `trail.js` is a new module; the rest are modifications to `constants.js` and `game.js`. Screen shake is camera-based (no post-processing).

**Tech Stack:** Three.js r128 (CDN), ES modules, node:test for unit tests.

**Verification approach:** Each feature task ends by (1) writing a dedicated Playwright test that produces a video optimized for that feature, (2) running it, and (3) sending the video to Gemini via verify-video skill for visual confirmation. This makes failures easy to debug — you know exactly which feature broke.

**verify-video error handling:** Retry up to 5 times on failure. If quota exhausted, fall back through: `gemini-3-flash-preview` → `gemini-3-pro-preview` → `gemini-2.5-pro` → `gemini-2.5-flash`. Replace `VIDEO_PATH` in all commands with the actual absolute path from `find test-results -name video.webm`.

---

### Task 1: Increase pipe speed + verify

**Files:**
- Modify: `js/constants.js:6` (PIPE_SPEED)
- Create: `tests/verify-speed.spec.js`

**Step 1: Update PIPE_SPEED**

In `js/constants.js`, change line 6:
```js
// old
export const PIPE_SPEED    = 0.04;
// new
export const PIPE_SPEED    = 0.07;
```

**Step 2: Run unit tests**

Run: `node tests/unit.test.js`
Expected: All 31 tests pass. SPAWN_MS test passes because it validates the formula, not a hardcoded value.

**Step 3: Write `tests/verify-speed.spec.js`**

```js
const { test, expect } = require('@playwright/test');

test('Verify: fast pipe speed', async ({ page }) => {
  await page.goto('http://localhost:3456/index.html');
  await page.waitForSelector('canvas', { timeout: 10000 });
  await page.waitForTimeout(1500);

  const cx = 360, cy = 640;
  const getBirdY   = () => page.evaluate(() => window.__FLAPPY_BIRD_Y ?? 0);
  const getTargetY = () => page.evaluate(() => window.__FLAPPY_NEXT_GAP_Y ?? 0);
  const getScore   = () => page.evaluate(() => window.__FLAPPY_SCORE ?? 0);
  const isOver     = () => page.evaluate(() => window.__FLAPPY_OVER ?? false);

  await page.mouse.click(cx, cy);
  await page.waitForTimeout(300);

  const start = Date.now();
  while (Date.now() - start < 30000) {
    const [score, over] = await Promise.all([getScore(), isOver()]);
    if (score >= 4) break;
    if (over) {
      await page.waitForTimeout(1200);
      await page.mouse.click(cx, cy);
      await page.waitForTimeout(500);
      await page.mouse.click(cx, cy);
      await page.waitForTimeout(300);
      continue;
    }
    const [birdY, targetY] = await Promise.all([getBirdY(), getTargetY()]);
    if (birdY < targetY - 0.6) {
      await page.mouse.click(cx, cy);
    }
    await page.waitForTimeout(50);
  }

  const finalScore = await getScore();
  expect(finalScore).toBeGreaterThanOrEqual(4);
});
```

**Step 4: Run the verification test**

```bash
node node_modules/@playwright/test/cli.js test tests/verify-speed.spec.js
```

**Step 5: verify-video — send to Gemini**

```bash
echo 'You are a QA engineer reviewing a screen recording from an automated UI test.

Describe EXACTLY what you observe in this video @VIDEO_PATH step by step in chronological order.

Then compare against this EXPECTED BEHAVIOR:

This is a cyberpunk-themed 3D flappy bird game where pipe obstacles approach the camera from the distance.

SPECIFIC THINGS TO VERIFY — answer YES or NO for each:
1. FAST PACE: Do the pipes move toward the camera at a fast, intense pace? They should approach noticeably quickly — a new pipe should arrive roughly every 1-2 seconds. The game should feel urgent and twitchy, NOT slow or relaxed.
2. QUICK REACTIONS: Does the bird need to react frequently (multiple flaps per pipe gap)? The bot should be clicking rapidly to keep up.
3. PIPE COUNT: Does the bird successfully navigate at least 4 pipes (score reaches 4+)?
4. CONTINUOUS FLOW: Are pipes continuously spawning from the distance? There should never be a long gap with no pipes visible.
5. CHALLENGING: Does the gameplay look challenging — the bird narrowly making it through gaps rather than leisurely floating through?

Give a verdict: PASS (all 5 YES) or FAIL (any NO).

If FAIL, explain exhaustively:
- What specifically was expected vs what actually happened
- At what point in the video the behavior diverged from expectations
- What the actual behavior was instead
- Any visual anomalies, timing issues, missing elements, or incorrect states you noticed
- Possible root causes based on what you observed

The detailed reasoning is the most important part — describe every discrepancy, no matter how small.' | gemini -m gemini-3-flash-preview -y -e ""
```

If FAIL: adjust `PIPE_SPEED` value, re-run test, re-verify. If PASS: continue.

**Step 6: Commit**

```bash
git add js/constants.js tests/verify-speed.spec.js
git commit -m "feat: increase pipe speed 75% for intensity"
```

---

### Task 2: Smooth velocity-linked rotation + verify

**Files:**
- Modify: `js/game.js:115` (rotation line in loop)
- Create: `tests/verify-rotation.spec.js`

**Step 1: Replace snap rotation with lerped rotation**

In `js/game.js`, replace line 115:
```js
// old
birdGroup.rotation.z = Math.max(-0.5, Math.min(0.5, -velocity * 2));
```
with:
```js
// new — lerp toward velocity-driven target, ±0.52 rad (~30°)
const targetRot = Math.max(-0.52, Math.min(0.52, -velocity * 3));
birdGroup.rotation.z += (targetRot - birdGroup.rotation.z) * 0.15 * dt;
```

**Step 2: Write `tests/verify-rotation.spec.js`**

```js
const { test, expect } = require('@playwright/test');

test('Verify: bird rotation linked to velocity', async ({ page }) => {
  await page.goto('http://localhost:3456/index.html');
  await page.waitForSelector('canvas', { timeout: 10000 });
  await page.waitForTimeout(1500);

  const cx = 360, cy = 640;
  const isOver = () => page.evaluate(() => window.__FLAPPY_OVER ?? false);

  await page.mouse.click(cx, cy);
  await page.waitForTimeout(300);

  // Pattern: flap 3x rapidly (bird tilts up), pause 1.5s (bird nose-dives), repeat
  for (let cycle = 0; cycle < 4; cycle++) {
    const over = await isOver();
    if (over) break;

    for (let i = 0; i < 3; i++) {
      await page.mouse.click(cx, cy);
      await page.waitForTimeout(120);
    }

    await page.waitForTimeout(1500);
  }

  await page.waitForTimeout(1000);
});
```

**Step 3: Run the verification test**

```bash
node node_modules/@playwright/test/cli.js test tests/verify-rotation.spec.js
```

**Step 4: verify-video — send to Gemini**

```bash
echo 'You are a QA engineer reviewing a screen recording from an automated UI test.

Describe EXACTLY what you observe in this video @VIDEO_PATH step by step in chronological order.

Then compare against this EXPECTED BEHAVIOR:

This is a cyberpunk-themed 3D flappy bird game. The test deliberately alternates between rapid flapping (3 clicks) and long pauses (1.5s) to make rotation changes obvious.

SPECIFIC THINGS TO VERIFY — answer YES or NO for each:
1. NOSE-UP ON FLAP: When the bird flaps (moves upward), does its front/nose visibly tilt UPWARD? The bird should rotate clockwise (front tilts up) during upward movement.
2. NOSE-DOWN ON FALL: When the bird stops flapping and falls, does its front/nose visibly tilt DOWNWARD? The bird should rotate counter-clockwise (front tilts down) during descent.
3. SMOOTH TRANSITION: Are the rotation transitions gradual and smooth (lerped over several frames), NOT instant snapping from one angle to another? You should see the bird smoothly rotating between positions.
4. VISIBLE ANGLE: Is the maximum tilt angle noticeable but moderate (roughly 20-35 degrees)? It should NOT be flat (0°) and should NOT be extreme (>60°).
5. MULTIPLE CYCLES: Does the video show at least 2 clear cycles of flap-up-then-fall-down rotation changes?

Give a verdict: PASS (all 5 YES) or FAIL (any NO).

If FAIL, explain exhaustively:
- What specifically was expected vs what actually happened
- At what point in the video the behavior diverged from expectations
- What the actual behavior was instead
- Any visual anomalies, timing issues, missing elements, or incorrect states you noticed
- Possible root causes based on what you observed

The detailed reasoning is the most important part — describe every discrepancy, no matter how small.' | gemini -m gemini-3-flash-preview -y -e ""
```

If FAIL: adjust multiplier/clamp in rotation code, re-run test, re-verify. If PASS: continue.

**Step 5: Commit**

```bash
git add js/game.js tests/verify-rotation.spec.js
git commit -m "feat: smooth lerped velocity rotation (±30°)"
```

---

### Task 3: Create trail module with tests

**Files:**
- Create: `js/trail.js`
- Modify: `tests/unit.test.js` (add trail tests + THREE mock additions)

**Step 1: Add THREE mock classes needed for trail**

In `tests/unit.test.js`, add these to the `window.THREE` mock object (after the existing `Color` class):

```js
BufferGeometry: class {
  constructor() {
    this.attributes = {};
  }
  setAttribute(name, attr) { this.attributes[name] = attr; }
  setDrawRange(start, count) { this.drawRange = { start, count }; }
},
BufferAttribute: class {
  constructor(array, itemSize) {
    this.array = array;
    this.itemSize = itemSize;
    this.needsUpdate = false;
  }
},
LineBasicMaterial: class {
  constructor(opts) { Object.assign(this, mockMaterial(opts)); }
},
Line: class {
  constructor(geo, mat) {
    this.geometry = geo;
    this.material = mat;
    this.position = mockVec3();
    this.frustumCulled = true;
  }
},
```

**Step 2: Write failing tests for trail module**

Add to `tests/unit.test.js`:

```js
// ── trail.js ──────────────────────────────────────────────────────────
describe('trail', () => {
  it('createTrail returns a line object', () => {
    const scene = mockScene();
    const trail = trailMod.createTrail(scene);
    assert.ok(trail);
    assert.ok(scene.children.length >= 1);
  });

  it('updateTrail shifts positions and inserts new head', () => {
    const scene = mockScene();
    const trail = trailMod.createTrail(scene);
    trailMod.updateTrail(trail, 0, 1.5, 0);
    trailMod.updateTrail(trail, 0, 2.0, 0);
    const posArr = trail.geometry.attributes.position.array;
    assert.equal(posArr[0], 0);   // x
    assert.equal(posArr[1], 2.0); // y
    assert.equal(posArr[2], 0);   // z
  });

  it('resetTrail zeroes all positions', () => {
    const scene = mockScene();
    const trail = trailMod.createTrail(scene);
    trailMod.updateTrail(trail, 0, 5, 0);
    trailMod.resetTrail(trail);
    const posArr = trail.geometry.attributes.position.array;
    for (let i = 0; i < posArr.length; i++) {
      assert.equal(posArr[i], 0);
    }
  });
});
```

**Step 3: Run tests to verify they fail**

Run: `node tests/unit.test.js`
Expected: FAIL — `trailMod` is not defined.

**Step 4: Write trail.js implementation**

Create `js/trail.js`:

```js
const THREE = window.THREE;

const TRAIL_LENGTH = 20;

export function createTrail(scene) {
  const positions = new Float32Array(TRAIL_LENGTH * 3);
  const colors = new Float32Array(TRAIL_LENGTH * 4);

  for (let i = 0; i < TRAIL_LENGTH; i++) {
    const t = i / (TRAIL_LENGTH - 1);
    colors[i * 4]     = 0;
    colors[i * 4 + 1] = 1;
    colors[i * 4 + 2] = 1;
    colors[i * 4 + 3] = 1 - t;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 4));

  const mat = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
  });

  const line = new THREE.Line(geo, mat);
  line.frustumCulled = false;
  scene.add(line);
  return line;
}

export function updateTrail(line, x, y, z) {
  const pos = line.geometry.attributes.position.array;
  for (let i = (TRAIL_LENGTH - 1) * 3; i >= 3; i -= 3) {
    pos[i]     = pos[i - 3];
    pos[i + 1] = pos[i - 2];
    pos[i + 2] = pos[i - 1];
  }
  pos[0] = x;
  pos[1] = y;
  pos[2] = z;
  line.geometry.attributes.position.needsUpdate = true;
}

export function resetTrail(line) {
  const pos = line.geometry.attributes.position.array;
  pos.fill(0);
  line.geometry.attributes.position.needsUpdate = true;
}
```

**Step 5: Add import to test file**

After existing imports in `tests/unit.test.js`:
```js
const trailMod = await import('../js/trail.js');
```

**Step 6: Run tests to verify they pass**

Run: `node tests/unit.test.js`
Expected: All tests pass (31 old + 3 new = 34).

**Step 7: Commit**

```bash
git add js/trail.js tests/unit.test.js
git commit -m "feat: add neon data trail module with tests"
```

---

### Task 4: Integrate trail into game loop + verify

**Files:**
- Modify: `js/game.js` (import, init, loop update, restart reset)
- Create: `tests/verify-trail.spec.js`

**Step 1: Add trail import**

In `js/game.js`, add after line 5:
```js
import { createTrail, updateTrail, resetTrail } from './trail.js';
```

**Step 2: Create trail after bird creation**

After line 27 (`const { birdGroup, eng } = createBird(scene);`), add:
```js
const trail = createTrail(scene);
```

**Step 3: Update trail each frame**

In the game loop, after line 114 (`birdGroup.position.y -= velocity * dt;`), add:
```js
updateTrail(trail, birdGroup.position.x, birdGroup.position.y, birdGroup.position.z - 0.3);
```

**Step 4: Reset trail on restart**

In `restartGame()`, after line 94 (`birdGroup.rotation.z = 0;`), add:
```js
resetTrail(trail);
```

**Step 5: Write `tests/verify-trail.spec.js`**

```js
const { test, expect } = require('@playwright/test');

test('Verify: neon trail behind bird', async ({ page }) => {
  await page.goto('http://localhost:3456/index.html');
  await page.waitForSelector('canvas', { timeout: 10000 });
  await page.waitForTimeout(1500);

  const cx = 360, cy = 640;
  const getBirdY   = () => page.evaluate(() => window.__FLAPPY_BIRD_Y ?? 0);
  const getTargetY = () => page.evaluate(() => window.__FLAPPY_NEXT_GAP_Y ?? 0);
  const getScore   = () => page.evaluate(() => window.__FLAPPY_SCORE ?? 0);
  const isOver     = () => page.evaluate(() => window.__FLAPPY_OVER ?? false);

  await page.mouse.click(cx, cy);
  await page.waitForTimeout(300);

  const start = Date.now();
  while (Date.now() - start < 30000) {
    const [score, over] = await Promise.all([getScore(), isOver()]);
    if (score >= 4) break;
    if (over) {
      await page.waitForTimeout(1200);
      await page.mouse.click(cx, cy);
      await page.waitForTimeout(500);
      await page.mouse.click(cx, cy);
      await page.waitForTimeout(300);
      continue;
    }
    const [birdY, targetY] = await Promise.all([getBirdY(), getTargetY()]);
    if (birdY < targetY - 0.6) {
      await page.mouse.click(cx, cy);
    }
    await page.waitForTimeout(50);
  }

  await page.waitForTimeout(2000);
  const finalScore = await getScore();
  expect(finalScore).toBeGreaterThanOrEqual(4);
});
```

**Step 6: Run the verification test**

```bash
node node_modules/@playwright/test/cli.js test tests/verify-trail.spec.js
```

**Step 7: verify-video — send to Gemini**

```bash
echo 'You are a QA engineer reviewing a screen recording from an automated UI test.

Describe EXACTLY what you observe in this video @VIDEO_PATH step by step in chronological order.

Then compare against this EXPECTED BEHAVIOR:

This is a cyberpunk-themed 3D flappy bird game rendered with Three.js. The bird is a small glowing cyan/blue rectangular shape that flies through purple cylindrical pipe obstacles with pink/magenta cap rings.

SPECIFIC THINGS TO VERIFY — answer YES or NO for each:
1. TRAIL EXISTENCE: Is there a visible line/streak trailing behind the bird during flight? It should look like a neon cyan/blue line extending backward from the bird.
2. TRAIL FADING: Does the trail fade from bright (near the bird) to transparent/invisible (at the far end)? It should NOT be a solid uniform line.
3. TRAIL FOLLOWS PATH: Does the trail curve and follow the bird'"'"'s vertical movement (up when bird flaps, down when bird falls)? It should NOT be a straight horizontal line.
4. TRAIL LENGTH: Is the trail approximately 1-3x the bird'"'"'s body length? It should NOT be extremely long or just a dot.
5. SCORE: Does the bird navigate at least 4 pipes (score counter reaches 4+)?

Give a verdict: PASS (all 5 YES) or FAIL (any NO).

If FAIL, explain exhaustively:
- What specifically was expected vs what actually happened
- At what point in the video the behavior diverged from expectations
- What the actual behavior was instead
- Any visual anomalies, timing issues, missing elements, or incorrect states you noticed
- Possible root causes based on what you observed

The detailed reasoning is the most important part — describe every discrepancy, no matter how small.' | gemini -m gemini-3-flash-preview -y -e ""
```

If FAIL: fix trail code, re-run test, re-verify. If PASS: continue.

**Step 8: Commit**

```bash
git add js/game.js tests/verify-trail.spec.js
git commit -m "feat: integrate neon trail into game loop"
```

---

### Task 5: Add screen shake on death + verify

**Files:**
- Modify: `js/game.js` (shake state, trigger, loop, reset)
- Create: `tests/verify-shake.spec.js`

**Step 1: Add shake state variables**

In `js/game.js`, after line 35 (`let lastSpawn = 0;`), add:
```js
let shakeTimer = 0;
const SHAKE_DURATION = 9;   // ~150ms at 60fps (9 frames)
const SHAKE_AMPLITUDE = 0.15;
```

**Step 2: Trigger shake in triggerGameOver**

In `triggerGameOver()`, after line 73 (`gameOver = true;`), add:
```js
shakeTimer = SHAKE_DURATION;
```

**Step 3: Apply shake in loop**

In the loop function, just before `renderer.render(scene, camera);`, add:
```js
// Screen shake
if (shakeTimer > 0) {
  const intensity = (shakeTimer / SHAKE_DURATION) * SHAKE_AMPLITUDE;
  camera.position.x = (Math.random() - 0.5) * 2 * intensity;
  camera.position.y = (Math.random() - 0.5) * 2 * intensity;
  shakeTimer -= dt;
  if (shakeTimer <= 0) {
    camera.position.x = 0;
    camera.position.y = 0;
  }
}
```

**Step 4: Reset shake on restart**

In `restartGame()`, add after resetting velocity/score/etc:
```js
shakeTimer = 0;
camera.position.x = 0;
camera.position.y = 0;
```

**Step 5: Write `tests/verify-shake.spec.js`**

```js
const { test, expect } = require('@playwright/test');

test('Verify: screen shake on death', async ({ page }) => {
  await page.goto('http://localhost:3456/index.html');
  await page.waitForSelector('canvas', { timeout: 10000 });
  await page.waitForTimeout(1500);

  const cx = 360, cy = 640;
  const isOver = () => page.evaluate(() => window.__FLAPPY_OVER ?? false);

  await page.mouse.click(cx, cy);
  await page.waitForTimeout(300);

  // Fly upward aggressively to crash into top pipe
  for (let i = 0; i < 20; i++) {
    const over = await isOver();
    if (over) break;
    await page.mouse.click(cx, cy);
    await page.waitForTimeout(80);
  }

  await page.waitForFunction(() => window.__FLAPPY_OVER === true, { timeout: 10000 });
  await page.waitForTimeout(2000);

  const over = await isOver();
  expect(over).toBe(true);
});
```

**Step 6: Run the verification test**

```bash
node node_modules/@playwright/test/cli.js test tests/verify-shake.spec.js
```

**Step 7: verify-video — send to Gemini**

```bash
echo 'You are a QA engineer reviewing a screen recording from an automated UI test.

Describe EXACTLY what you observe in this video @VIDEO_PATH step by step in chronological order.

Then compare against this EXPECTED BEHAVIOR:

This is a cyberpunk-themed 3D flappy bird game. The bird flies upward aggressively (many rapid clicks) and intentionally crashes into the top of a pipe obstacle.

SPECIFIC THINGS TO VERIFY — answer YES or NO for each:
1. CRASH OCCURS: Does the bird collide with a pipe and the game ends (bird disappears)?
2. SCREEN SHAKE: At the EXACT moment of collision, does the entire view/camera visibly shake or jitter? This should look like rapid small displacements (a few pixels) of the entire rendered scene, lasting roughly 0.1-0.3 seconds. It is brief and sharp, NOT a slow wobble.
3. SHAKE IS BRIEF: Does the shake stop quickly (within ~0.2 seconds)? The view should stabilize after the jolt.
4. EXPLOSION: After the crash, do colorful particles (cyan, pink, orange, white) burst outward from where the bird was?
5. SYSTEM FAILURE: Does the text "SYSTEM FAILURE" appear as an overlay after the crash (there may be a ~1 second delay)?

Give a verdict: PASS (all 5 YES) or FAIL (any NO).

If FAIL, explain exhaustively:
- What specifically was expected vs what actually happened
- At what point in the video the behavior diverged from expectations
- What the actual behavior was instead
- Any visual anomalies, timing issues, missing elements, or incorrect states you noticed
- Possible root causes based on what you observed

The detailed reasoning is the most important part — describe every discrepancy, no matter how small.' | gemini -m gemini-3-flash-preview -y -e ""
```

If FAIL: adjust shake amplitude/duration, re-run test, re-verify. If PASS: continue.

**Step 8: Commit**

```bash
git add js/game.js tests/verify-shake.spec.js
git commit -m "feat: add screen shake on death (150ms decaying jolt)"
```

---

### Task 6: Tune e2e test bot for faster speed

**Files:**
- Modify: `tests/flappy.spec.js:21` (TOLERANCE_BELOW)
- Modify: `tests/golden.spec.js:16` (TOLERANCE_BELOW)

At 75% faster pipe speed, the AI bot needs to react more aggressively.

**Step 1: Adjust flappy.spec.js**

Change `TOLERANCE_BELOW` from `1.0` to `0.6`:
```js
const TOLERANCE_BELOW = 0.6;
```

**Step 2: Adjust golden.spec.js**

Change `TOLERANCE_BELOW` from `1.0` to `0.6`:
```js
const TOLERANCE_BELOW = 0.6;
```

**Step 3: Run all e2e tests**

Run: `node node_modules/@playwright/test/cli.js test`
Expected: All tests pass. If the bot struggles, try `0.4` instead.

**Step 4: Run unit tests**

Run: `node tests/unit.test.js`
Expected: All 34 tests pass.

**Step 5: Commit**

```bash
git add tests/flappy.spec.js tests/golden.spec.js
git commit -m "test: tune AI bot tolerance for faster pipe speed"
```

---

### Task 7: Restart verification test + verify

**Files:**
- Create: `tests/verify-restart.spec.js`

**Step 1: Write `tests/verify-restart.spec.js`**

```js
const { test, expect } = require('@playwright/test');

test('Verify: restart clears trail and resets state', async ({ page }) => {
  await page.goto('http://localhost:3456/index.html');
  await page.waitForSelector('canvas', { timeout: 10000 });
  await page.waitForTimeout(1500);

  const cx = 360, cy = 640;
  const getBirdY   = () => page.evaluate(() => window.__FLAPPY_BIRD_Y ?? 0);
  const getTargetY = () => page.evaluate(() => window.__FLAPPY_NEXT_GAP_Y ?? 0);
  const getScore   = () => page.evaluate(() => window.__FLAPPY_SCORE ?? 0);
  const isOver     = () => page.evaluate(() => window.__FLAPPY_OVER ?? false);

  // --- Run 1: Play through 2 pipes then crash ---
  await page.mouse.click(cx, cy);
  await page.waitForTimeout(300);

  const start1 = Date.now();
  while (Date.now() - start1 < 15000) {
    const [score, over] = await Promise.all([getScore(), isOver()]);
    if (score >= 2 || over) break;
    const [birdY, targetY] = await Promise.all([getBirdY(), getTargetY()]);
    if (birdY < targetY - 0.6) await page.mouse.click(cx, cy);
    await page.waitForTimeout(50);
  }

  if (!(await isOver())) {
    await page.waitForFunction(() => window.__FLAPPY_OVER === true, { timeout: 10000 });
  }

  await page.waitForTimeout(1500);

  // --- Restart ---
  await page.mouse.click(cx, cy);
  await page.waitForTimeout(500);

  const scoreAfterRestart = await page.locator('#score').textContent();
  expect(scoreAfterRestart).toBe('0');

  // --- Run 2: Play through 2+ pipes to verify trail is fresh ---
  await page.mouse.click(cx, cy);
  await page.waitForTimeout(300);

  const start2 = Date.now();
  while (Date.now() - start2 < 15000) {
    const [score, over] = await Promise.all([getScore(), isOver()]);
    if (score >= 2 || over) break;
    const [birdY, targetY] = await Promise.all([getBirdY(), getTargetY()]);
    if (birdY < targetY - 0.6) await page.mouse.click(cx, cy);
    await page.waitForTimeout(50);
  }

  await page.waitForTimeout(1500);
});
```

**Step 2: Run the verification test**

```bash
node node_modules/@playwright/test/cli.js test tests/verify-restart.spec.js
```

**Step 3: verify-video — send to Gemini**

```bash
echo 'You are a QA engineer reviewing a screen recording from an automated UI test.

Describe EXACTLY what you observe in this video @VIDEO_PATH step by step in chronological order.

Then compare against this EXPECTED BEHAVIOR:

This is a cyberpunk-themed 3D flappy bird game. The test plays TWO separate game sessions with a restart in between.

SPECIFIC THINGS TO VERIFY — answer YES or NO for each:
1. FIRST SESSION: Does the bird fly and navigate through at least 1-2 pipes in the first session? A cyan trail should be visible behind the bird.
2. CRASH AND OVERLAY: Does the bird crash, showing an explosion and then a "SYSTEM FAILURE" overlay with the score?
3. RESTART TRANSITION: After clicking to restart, does the screen show the "CYBER FLAP" title with "CLICK OR SPACE TO JACK IN"? The score display should reset to 0.
4. CLEAN SECOND SESSION: When the second session starts, does the bird appear at the CENTER of the screen with NO lingering trail from the first session? The trail should only begin forming as the bird starts moving in the new session.
5. SECOND SESSION PLAYS: Does the bird fly and navigate through pipes in the second session, with a fresh new trail forming behind it?

Give a verdict: PASS (all 5 YES) or FAIL (any NO).

If FAIL, explain exhaustively:
- What specifically was expected vs what actually happened
- At what point in the video the behavior diverged from expectations
- What the actual behavior was instead
- Any visual anomalies, timing issues, missing elements, or incorrect states you noticed
- Possible root causes based on what you observed

The detailed reasoning is the most important part — describe every discrepancy, no matter how small.' | gemini -m gemini-3-flash-preview -y -e ""
```

If FAIL: fix `resetTrail()` or `restartGame()`, re-run test, re-verify. If PASS: continue.

**Step 4: Commit**

```bash
git add tests/verify-restart.spec.js
git commit -m "test: add restart verification scenario"
```

---

### Task 8: Final regression check + push

**Step 1: Run all unit tests**

```bash
node tests/unit.test.js
```
Expected: 34 tests, 0 failures.

**Step 2: Run ALL e2e + verification tests together**

```bash
node node_modules/@playwright/test/cli.js test
```
Expected: All 8 tests pass (3 original + 5 verify-* tests).

**Step 3: Handle any failures**

If any test fails:
1. Identify which test and read the error
2. Map to responsible module:
   - Trail → `js/trail.js` or trail integration in `js/game.js`
   - Rotation → rotation lerp in `js/game.js` loop
   - Shake → shake logic in `js/game.js`
   - Speed → `PIPE_SPEED` in `js/constants.js`
   - Restart → `restartGame()` in `js/game.js`, `resetTrail()` in `js/trail.js`
3. Fix, re-run, confirm pass

**Step 4: Push**

```bash
git push
```
