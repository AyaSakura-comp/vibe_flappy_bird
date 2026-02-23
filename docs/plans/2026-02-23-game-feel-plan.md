# Phase 1: Game Feel Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make Cyber Flap feel responsive and intense — velocity rotation, neon trail, screen shake on death, and 75% faster pipes.

**Architecture:** Four independent features layered onto the existing module system. `trail.js` is a new module; the rest are modifications to `constants.js` and `game.js`. Screen shake is camera-based (no post-processing).

**Tech Stack:** Three.js r128 (CDN), ES modules, node:test for unit tests.

---

### Task 1: Increase pipe speed

**Files:**
- Modify: `js/constants.js:6` (PIPE_SPEED)
- Modify: `tests/unit.test.js:126-147` (constants test suite)

**Step 1: Update PIPE_SPEED**

In `js/constants.js`, change line 6:
```js
// old
export const PIPE_SPEED    = 0.04;
// new
export const PIPE_SPEED    = 0.07;
```

**Step 2: Run unit tests to verify SPAWN_MS recalculated**

Run: `node tests/unit.test.js`
Expected: All 31 tests pass. SPAWN_MS test passes because it validates the formula, not a hardcoded value.

**Step 3: Commit**

```bash
git add js/constants.js
git commit -m "feat: increase pipe speed 75% for intensity"
```

---

### Task 2: Smooth velocity-linked rotation

**Files:**
- Modify: `js/game.js:115` (rotation line in loop)

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

Note: multiplier changed from 2 to 3 to compensate for lerp lag. The `* dt` makes it frame-rate independent.

**Step 2: Verify manually (no unit test — visual/game-loop behavior)**

Run: `node node_modules/http-server/bin/http-server . -p 3456 --cors`
Open browser, confirm bird tilts up on flap, nose-dives when falling, transitions are smooth.

**Step 3: Commit**

```bash
git add js/game.js
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
    // Head position should be most recent
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

  // Initialize colors: cyan fading to transparent
  for (let i = 0; i < TRAIL_LENGTH; i++) {
    const t = i / (TRAIL_LENGTH - 1);
    colors[i * 4]     = 0;           // r
    colors[i * 4 + 1] = 1;           // g
    colors[i * 4 + 2] = 1;           // b
    colors[i * 4 + 3] = 1 - t;       // a (fades out)
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
  // Shift all positions back by one slot (tail end drops off)
  for (let i = (TRAIL_LENGTH - 1) * 3; i >= 3; i -= 3) {
    pos[i]     = pos[i - 3];
    pos[i + 1] = pos[i - 2];
    pos[i + 2] = pos[i - 1];
  }
  // Insert new head position
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

### Task 4: Integrate trail into game loop

**Files:**
- Modify: `js/game.js:1` (add import)
- Modify: `js/game.js` (init, loop update, restart reset)

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

The `z - 0.3` offsets the trail slightly behind the bird.

**Step 4: Reset trail on restart**

In `restartGame()`, after line 94 (`birdGroup.rotation.z = 0;`), add:
```js
resetTrail(trail);
```

**Step 5: Verify visually**

Run: `node node_modules/http-server/bin/http-server . -p 3456 --cors`
Open browser, confirm cyan fading line trails behind bird during flight.

**Step 6: Commit**

```bash
git add js/game.js
git commit -m "feat: integrate neon trail into game loop"
```

---

### Task 5: Add screen shake on death

**Files:**
- Modify: `js/game.js` (add shake state, trigger on death, apply in loop, reset on restart)

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

In the loop function, just before the `renderer.render(scene, camera);` line (162), add:
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

**Step 5: Verify visually**

Run the game, crash into a pipe, confirm short sharp camera shake before SYSTEM FAILURE overlay.

**Step 6: Commit**

```bash
git add js/game.js
git commit -m "feat: add screen shake on death (150ms decaying jolt)"
```

---

### Task 6: Tune e2e test bot for faster speed

**Files:**
- Modify: `tests/flappy.spec.js:21` (TOLERANCE_BELOW)
- Modify: `tests/golden.spec.js:16` (TOLERANCE_BELOW)

At 75% faster pipe speed, the AI bot needs to react more aggressively. The `TOLERANCE_BELOW` threshold (how far below the gap center the bird must be before flapping) should be reduced so the bot flaps earlier.

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
Expected: All 3 tests pass. If the bot struggles, try `0.4` instead.

**Step 4: Run unit tests**

Run: `node tests/unit.test.js`
Expected: All 34 tests pass.

**Step 5: Commit**

```bash
git add tests/flappy.spec.js tests/golden.spec.js
git commit -m "test: tune AI bot tolerance for faster pipe speed"
```

---

### Task 7: Final verification

**Step 1: Run all unit tests**

Run: `node tests/unit.test.js`
Expected: 34 tests, 0 failures.

**Step 2: Run all e2e tests**

Run: `node node_modules/@playwright/test/cli.js test`
Expected: 3 tests pass.

**Step 3: Manual play test**

Run: `node node_modules/http-server/bin/http-server . -p 3456 --cors`
Verify:
- Pipes move noticeably faster
- Bird rotation smoothly lerps with velocity
- Cyan trail follows bird, fades toward tail
- Camera shakes briefly on death
- Trail resets on restart
- Game is challenging but playable
