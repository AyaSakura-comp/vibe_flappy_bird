# Three.Box3 Collision Enhancement Implementation Plan

> **For Gemini:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor the collision detection system to use `THREE.Box3` AABB instead of magic number coordinates to achieve robust, geometry-accurate physics.

**Architecture:** Replace coordinate-based overlap checks with Three.js built-in `Box3` intersection testing. The game loop will compute the bird's bounding box once per frame and pass it to collision checkers. The collision checkers will compute the bounding box of the pipes and laser nets dynamically from their actual 3D meshes. Magic numbers (`HIT_Z_MIN`, `HIT_Z_MAX`, etc.) will be removed from configuration, ensuring that visual properties (like `DEPTH` or object scaling) natively govern physics without drift.

**Tech Stack:** Three.js, ES Modules, Node.js (Testing), Playwright (E2E)

---

### Task 1: Expose Pipe Segments for Precise Collision

**Files:**
- Modify: `js/pipes.js`
- Test: `tests/unit.test.js`

**Step 1: Write the failing test**

```javascript
// tests/unit.test.js (Add this inside the existing pipes test suite or a new one)
import { spawnPipe, pipes } from '../js/pipes.js';
import * as THREE from 'three';

it('spawnPipe exposes topGroup and botGroup on the pipe object', () => {
  const scene = new THREE.Scene();
  spawnPipe(scene, 0, 0);
  const pipe = pipes[pipes.length - 1];
  assert.ok(pipe.topGroup instanceof THREE.Group, 'topGroup should be a THREE.Group');
  assert.ok(pipe.botGroup instanceof THREE.Group, 'botGroup should be a THREE.Group');
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:unit`
Expected: FAIL with "Cannot read properties of undefined" or similar assertion error on `topGroup` / `botGroup`.

**Step 3: Write minimal implementation**

```javascript
// js/pipes.js
// Update spawnPipe function to export topGroup and botGroup reference in the pushed object
// Find: pipes.push({ group: pipeGroup, gapTop, gapBot, scored: false, laser });
// Change to:
pipes.push({ group: pipeGroup, topGroup, botGroup, gapTop, gapBot, scored: false, laser });
```

**Step 4: Run tests to verify they pass**

Run: `npm run test:unit`
Run: `node node_modules/@playwright/test/cli.js test`
Expected: PASS

**Step 5: Commit**

```bash
git add tests/unit.test.js js/pipes.js
git commit -m "refactor: expose topGroup and botGroup on pipe object for Box3 collision"
```

---

### Task 2: Refactor Laser Collision to use Box3

**Files:**
- Modify: `js/laser.js`
- Modify: `js/game.js`
- Test: `tests/unit.test.js`

**Step 1: Write the failing test**

```javascript
// tests/unit.test.js (Update the laser collision tests)
import { checkLaserCollision, createLaserNet } from '../js/laser.js';

it('checkLaserCollision uses THREE.Box3 intersection', () => {
  const laserData = createLaserNet(2, -2);
  const pipe = { laser: laserData };
  // Mock bird Box3 directly overlapping the laser
  const birdBox = new THREE.Box3(
    new THREE.Vector3(-0.5, -0.5, -0.5),
    new THREE.Vector3(0.5, 0.5, 0.5)
  );
  assert.equal(checkLaserCollision(birdBox, pipe), true);
  
  // Mock bird Box3 completely outside the laser
  const safeBox = new THREE.Box3(
    new THREE.Vector3(10, 10, 10),
    new THREE.Vector3(11, 11, 11)
  );
  assert.equal(checkLaserCollision(safeBox, pipe), false);
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:unit`
Expected: FAIL because `checkLaserCollision` currently expects a number (birdY) instead of a `THREE.Box3`.

**Step 3: Write minimal implementation**

```javascript
// js/laser.js
// Update checkLaserCollision signature and logic
export function checkLaserCollision(birdBox, pipe) {
  if (!pipe.laser) return false;
  const laserBox = new THREE.Box3().setFromObject(pipe.laser.mesh);
  return birdBox.intersectsBox(laserBox);
}

// js/game.js
// Find where checkLaserCollision is called in animate():
// OLD:
// if (!phasing && checkLaserCollision(birdGroup.position.y, p)) {
//   triggerGameOver(); return;
// }
// NEW:
// Ensure birdBox is computed before checks if not already:
const birdBox = new THREE.Box3().setFromObject(birdGroup);
// Change check to use birdBox:
if (!phasing && checkLaserCollision(birdBox, p)) {
  triggerGameOver(); return;
}

// Ensure forceUnphase() in js/game.js also uses birdBox if it checks laser collision!
```

**Step 4: Run tests to verify they pass**

Run: `npm run test:unit`
Run: `node node_modules/@playwright/test/cli.js test`
Expected: PASS

**Step 5: Commit**

```bash
git add tests/unit.test.js js/laser.js js/game.js
git commit -m "refactor: update laser collision to use THREE.Box3 and update game loop"
```

---

### Task 3: Refactor Pipe Collision to use Box3

**Files:**
- Modify: `js/collision.js`
- Modify: `js/game.js`
- Test: `tests/unit.test.js`

**Step 1: Write the failing test**

```javascript
// tests/unit.test.js (Update the pipe collision tests)
import { checkCollision } from '../js/collision.js';

it('checkCollision uses THREE.Box3 intersection', () => {
  const scene = new THREE.Scene();
  spawnPipe(scene, 0, 0); // spawns at z=0, y near 0
  const pipe = pipes[pipes.length - 1];
  
  // Box hitting top pipe segment
  const birdBoxHit = new THREE.Box3(
    new THREE.Vector3(-0.5, pipe.gapTop + 0.1, -0.5),
    new THREE.Vector3(0.5, pipe.gapTop + 1.0, 0.5)
  );
  assert.equal(checkCollision(birdBoxHit, pipe), true);
  
  // Box safely in the gap
  const birdBoxSafe = new THREE.Box3(
    new THREE.Vector3(-0.5, (pipe.gapTop + pipe.gapBot)/2 - 0.1, -0.5),
    new THREE.Vector3(0.5, (pipe.gapTop + pipe.gapBot)/2 + 0.1, 0.5)
  );
  assert.equal(checkCollision(birdBoxSafe, pipe), false);
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:unit`
Expected: FAIL because `checkCollision` currently expects `birdY` and `birdX` as numbers.

**Step 3: Write minimal implementation**

```javascript
// js/collision.js
import * as THREE from 'three';

export function checkCollision(birdBox, pipe) {
  const topBox = new THREE.Box3().setFromObject(pipe.topGroup);
  const botBox = new THREE.Box3().setFromObject(pipe.botGroup);
  
  if (birdBox.intersectsBox(topBox) || birdBox.intersectsBox(botBox)) {
    return true;
  }
  return false;
}

// js/game.js
// Find where checkCollision is called in animate():
// OLD:
// if (checkCollision(birdGroup.position.y, birdGroup.position.x, p)) {
//   triggerGameOver(); return;
// }
// NEW:
// Using the same birdBox computed earlier
if (checkCollision(birdBox, p)) {
  triggerGameOver(); return;
}
```

**Step 4: Run tests to verify they pass**

Run: `npm run test:unit`
Run: `node node_modules/@playwright/test/cli.js test`
Expected: PASS

**Step 5: Commit**

```bash
git add tests/unit.test.js js/collision.js js/game.js
git commit -m "refactor: update pipe collision to use THREE.Box3 and update game loop"
```

---

### Task 4: Clean Configuration & Fix E2E Mocks

**Files:**
- Modify: `js/constants.js`
- Modify: `tests/unit.test.js`
- Modify: `tests/collision-phase.spec.js`

**Step 1: Write minimal implementation**

```javascript
// js/constants.js
// Remove PIPES.HIT_Z_MIN and PIPES.HIT_Z_MAX.
// Remove LASER.HIT_Z_MIN, LASER.HIT_Z_MAX, and LASER.HIT_Z_PAD if they exist.

// tests/unit.test.js
// Remove any `assert.equal(CONFIG.PIPES.HIT_Z_MIN, ...)` or laser padding assertions.

// tests/collision-phase.spec.js
// Any E2E tests that altered `HIT_Z_MIN` / `HIT_Z_MAX` dynamically for testing overlap 
// should now alter `CONFIG.LASER.DEPTH` (e.g. `window.__GAME_CONFIG.LASER.DEPTH = 4.0`) to make the geometry naturally thicker.
```

**Step 2: Run all tests to verify everything is integrated**

Run: `npm run test:unit`
Run: `node node_modules/@playwright/test/cli.js test`
Expected: PASS for all tests. If E2E testing fails with "cannot find property", ensure all replaced constants are fully cleared from mock payloads or tests.

**Step 3: Commit**

```bash
git add js/constants.js tests/unit.test.js tests/collision-phase.spec.js
git commit -m "refactor: remove magic number collision constants now superseded by Box3"
```
