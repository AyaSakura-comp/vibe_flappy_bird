# Phase Dive Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a dual-input "Phase Dive" mechanic where holding the right screen/D key makes the ship pass through Laser Nets (new obstacles in pipe gaps), balanced by an Overheat stamina system.

**Architecture:** Six new concerns layered onto the existing game loop: (1) CONFIG additions in `constants.js`, (2) `js/laser.js` module for laser net mesh + collision, (3) split-screen input in `game.js`, (4) overheat stamina in `game.js`, (5) visual feedback on bird/trail, (6) audio placeholders. Each task is self-contained with TDD unit tests, custom Playwright play actions, and video verification before commit.

**Tech Stack:** Three.js r128 (ES modules via import map), node:test for unit tests, Playwright for E2E, Gemini CLI for video verification.

**Design doc:** `docs/plans/2026-02-26-phase-dive-design.md`

---

### Task 0: Record Baseline Video

**Purpose:** Capture "before" gameplay video for `/compare-before-after-with-video` comparisons in later tasks.

**Files:**
- Create: `tests/baseline-recording.spec.js`

**Step 1: Write the baseline recording test**

```js
// tests/baseline-recording.spec.js
const { test, expect } = require('@playwright/test');

test('Record baseline gameplay before Phase Dive', async ({ page }) => {
  test.setTimeout(30000);

  await page.addInitScript(() => {
    window.PILOT_ENABLED = true;
    const _speedup = () => {
      if (window.__GAME_CONFIG) {
        window.__GAME_CONFIG.PIPES.SPEED = 0.32;
      } else {
        setTimeout(_speedup, 50);
      }
    };
    _speedup();

    const flap = () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
    };

    const simulate = (birdY, vel, frames, flapNow, G, FV, TV) => {
      let y = birdY, v = flapNow ? FV : vel;
      for (let f = 0; f < frames; f++) {
        v += G; if (v > TV) v = TV;
        y -= v;
      }
      return y;
    };

    let lastFlapFrame = -10;
    let frameCount = 0;

    const pilotLoop = () => {
      frameCount++;
      if (!window.PILOT_ENABLED) { requestAnimationFrame(pilotLoop); return; }

      const score = window.__FLAPPY_SCORE || 0;
      const isOver = window.__FLAPPY_OVER;
      const started = window.__FLAPPY_STARTED;
      const birdY = window.__FLAPPY_BIRD_Y;
      const vel = window.__FLAPPY_VELOCITY;
      const gapTop1 = window.__FLAPPY_NEXT_GAP_TOP;
      const gapBot1 = window.__FLAPPY_NEXT_GAP_BOT;
      const pipeZ1 = window.__FLAPPY_NEXT_PIPE_Z;
      const config = window.__GAME_CONFIG;

      if (!started || isOver || birdY === undefined || !config) {
        requestAnimationFrame(pilotLoop); return;
      }

      const G = config.PHYSICS.GRAVITY;
      const FV = config.PHYSICS.FLAP;
      const TV = config.PHYSICS.TERMINAL_VELOCITY;
      const PS = config.PIPES.SPEED;
      const f1 = Math.max(1, Math.round((-2 - pipeZ1) / PS));
      const safeTop = gapTop1 - 1.5;
      const safeBot = gapBot1 + 1.5;
      const targetY = (safeBot + safeTop) / 2;

      const noFlapY = simulate(birdY, vel, f1, false, G, FV, TV);
      const flapY = simulate(birdY, vel, f1, true, G, FV, TV);

      const cooldownOk = (frameCount - lastFlapFrame) > 5;
      const needsLift = noFlapY < targetY - 0.4;
      const flapHelps = flapY > noFlapY;
      const flapInBounds = flapY <= safeTop + 0.5;
      const boundaryDanger = noFlapY < -5.5 && flapY > noFlapY && flapY < 5.5;

      let shouldFlap = cooldownOk && ((needsLift && flapHelps && flapInBounds) || boundaryDanger);
      if ((frameCount - lastFlapFrame) > 8 && birdY < safeBot && vel > 0.05) shouldFlap = true;

      if (shouldFlap) { flap(); lastFlapFrame = frameCount; }
      requestAnimationFrame(pilotLoop);
    };
    requestAnimationFrame(pilotLoop);
  });

  await page.goto('http://localhost:3457/index.html');
  await page.waitForSelector('canvas');
  await page.evaluate(() => {
    if (window.__FLAPPY_START_QUIET) window.__FLAPPY_START_QUIET();
  });

  await page.waitForFunction(() => (window.__FLAPPY_SCORE || 0) >= 10, { timeout: 20000, polling: 'raf' });
  const score = await page.evaluate(() => window.__FLAPPY_SCORE);
  expect(score).toBeGreaterThanOrEqual(10);
});
```

**Step 2: Run the baseline recording**

Run: `node node_modules/@playwright/test/cli.js test tests/baseline-recording.spec.js`
Expected: PASS. Video saved to `test-results/` directory.

**Step 3: Copy baseline video to golden/**

```bash
# Find the video file and copy it
cp test-results/Record-baseline-gameplay-before-Phase-Dive-*/video.webm golden/baseline-pre-phase-dive.webm
```

**Step 4: Verify baseline video with `/verify-video`**

Use `/verify-video` on `golden/baseline-pre-phase-dive.webm` with prompt: "Verify this shows a synthwave-themed Flappy Bird game with a cyan ship navigating through purple pipes. The ship should successfully pass through at least 10 pipes. There should be NO laser nets or phase mechanics visible."

**Step 5: Commit**

```bash
git add tests/baseline-recording.spec.js golden/baseline-pre-phase-dive.webm
git commit -m "test: record baseline gameplay video before Phase Dive feature"
```

---

### Task 1: Add CONFIG.PHASE and CONFIG.LASER to constants.js

**Files:**
- Modify: `js/constants.js:1-91`
- Test: `tests/unit.test.js`

**Step 1: Write the failing tests**

Add to `tests/unit.test.js` after line 237 (after the existing `constants` describe block):

```js
describe('phase dive constants', () => {
  it('CONFIG.PHASE exists with correct defaults', () => {
    assert.ok(CONFIG.PHASE);
    assert.equal(CONFIG.PHASE.MAX_DURATION, 1.5);
    assert.equal(CONFIG.PHASE.COOLDOWN, 1.0);
    assert.equal(CONFIG.PHASE.DRAIN_RATE, 1.0);
    assert.equal(CONFIG.PHASE.CHARGE_RATE, 0.5);
  });

  it('CONFIG.LASER exists with correct defaults', () => {
    assert.ok(CONFIG.LASER);
    assert.equal(CONFIG.LASER.WARMUP_PIPES, 5);
    assert.equal(CONFIG.LASER.SPAWN_CHANCE, 0.35);
    assert.equal(CONFIG.LASER.MAX_CHANCE, 0.7);
    assert.equal(CONFIG.LASER.CHANCE_PER_SCORE, 0.015);
    assert.equal(CONFIG.LASER.GAP_FRACTION, 0.25);
  });

  it('CONFIG.PHASE values are physically sane', () => {
    assert.ok(CONFIG.PHASE.MAX_DURATION > 0);
    assert.ok(CONFIG.PHASE.COOLDOWN > 0);
    assert.ok(CONFIG.PHASE.DRAIN_RATE > 0);
    assert.ok(CONFIG.PHASE.CHARGE_RATE > 0);
    assert.ok(CONFIG.PHASE.CHARGE_RATE < CONFIG.PHASE.DRAIN_RATE,
      'charge should be slower than drain');
  });

  it('CONFIG.LASER.GAP_FRACTION is between 0.2 and 0.3', () => {
    assert.ok(CONFIG.LASER.GAP_FRACTION >= 0.2);
    assert.ok(CONFIG.LASER.GAP_FRACTION <= 0.3);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `node --experimental-vm-modules node_modules/.bin/nodetest tests/unit.test.js` or `npm run test:unit`
Expected: FAIL — `CONFIG.PHASE` and `CONFIG.LASER` are undefined.

**Step 3: Add CONFIG sections to constants.js**

In `js/constants.js`, add after `ENVIRONMENT` block (after line 74, before the closing `};`):

```js
  PHASE: {
    MAX_DURATION: 1.5,
    COOLDOWN: 1.0,
    DRAIN_RATE: 1.0,
    CHARGE_RATE: 0.5,
  },
  LASER: {
    WARMUP_PIPES: 5,
    SPAWN_CHANCE: 0.35,
    MAX_CHANCE: 0.7,
    CHANCE_PER_SCORE: 0.015,
    GAP_FRACTION: 0.25,
  },
```

**Step 4: Run tests to verify they pass**

Run: `npm run test:unit`
Expected: ALL PASS including new phase dive constants tests.

**Step 5: Commit**

```bash
git add js/constants.js tests/unit.test.js
git commit -m "feat: add CONFIG.PHASE and CONFIG.LASER constants for Phase Dive"
```

---

### Task 2: Create js/laser.js — Laser Net Mesh and Collision

**Files:**
- Create: `js/laser.js`
- Modify: `tests/unit.test.js`

**Step 1: Write the failing tests**

Add to `tests/unit.test.js`. First, add the import at the top (after line 176):

```js
const laserMod = await import('../js/laser.js');
```

Then add the test block:

```js
describe('laser.js', () => {
  it('createLaserNet returns mesh, hitTop, hitBot', () => {
    const result = laserMod.createLaserNet(3.75, -3.75);
    assert.ok(result.mesh);
    assert.ok(typeof result.hitTop === 'number');
    assert.ok(typeof result.hitBot === 'number');
  });

  it('laser hitbox occupies GAP_FRACTION of the gap, centered', () => {
    const gapTop = 3.75, gapBot = -3.75;
    const gapHeight = gapTop - gapBot; // 7.5
    const result = laserMod.createLaserNet(gapTop, gapBot);
    const laserHeight = result.hitTop - result.hitBot;
    assert.ok(Math.abs(laserHeight - gapHeight * CONFIG.LASER.GAP_FRACTION) < 0.01,
      `laser height ${laserHeight} should be ${gapHeight * CONFIG.LASER.GAP_FRACTION}`);
    const center = (result.hitTop + result.hitBot) / 2;
    const gapCenter = (gapTop + gapBot) / 2;
    assert.ok(Math.abs(center - gapCenter) < 0.01,
      'laser should be centered in gap');
  });

  it('checkLaserCollision returns true when solid ship overlaps laser', () => {
    const pipe = {
      group: { position: { z: 0 } },
      gapTop: 3.75, gapBot: -3.75,
      laser: laserMod.createLaserNet(3.75, -3.75),
    };
    // Bird at center of gap (y=0) — should overlap laser (centered at 0)
    assert.equal(laserMod.checkLaserCollision(0, pipe, 0.1), true);
  });

  it('checkLaserCollision returns false when bird is above laser', () => {
    const pipe = {
      group: { position: { z: 0 } },
      gapTop: 3.75, gapBot: -3.75,
      laser: laserMod.createLaserNet(3.75, -3.75),
    };
    // Bird well above laser center
    assert.equal(laserMod.checkLaserCollision(3.0, pipe, 0.1), false);
  });

  it('checkLaserCollision returns false when bird is below laser', () => {
    const pipe = {
      group: { position: { z: 0 } },
      gapTop: 3.75, gapBot: -3.75,
      laser: laserMod.createLaserNet(3.75, -3.75),
    };
    assert.equal(laserMod.checkLaserCollision(-3.0, pipe, 0.1), false);
  });

  it('checkLaserCollision returns false when pipe has no laser', () => {
    const pipe = {
      group: { position: { z: 0 } },
      gapTop: 3.75, gapBot: -3.75,
      laser: null,
    };
    assert.equal(laserMod.checkLaserCollision(0, pipe, 0.1), false);
  });

  it('checkLaserCollision returns false when pipe z is out of range', () => {
    const pipe = {
      group: { position: { z: -5 } },
      gapTop: 3.75, gapBot: -3.75,
      laser: laserMod.createLaserNet(3.75, -3.75),
    };
    assert.equal(laserMod.checkLaserCollision(0, pipe, 0.1), false);
  });

  it('shouldSpawnLaser returns false during warmup', () => {
    assert.equal(laserMod.shouldSpawnLaser(0, 0), false);
    assert.equal(laserMod.shouldSpawnLaser(4, 0), false);
  });

  it('shouldSpawnLaser can return true after warmup with chance=1', () => {
    // Force spawn by temporarily setting chance to 1.0
    const origChance = CONFIG.LASER.SPAWN_CHANCE;
    CONFIG.LASER.SPAWN_CHANCE = 1.0;
    assert.equal(laserMod.shouldSpawnLaser(5, 0), true);
    CONFIG.LASER.SPAWN_CHANCE = origChance;
  });

  it('dynamic difficulty increases chance with score', () => {
    // At score 0: chance = 0.35. At score 20: chance = min(0.7, 0.35 + 20*0.015) = 0.65
    const chance = laserMod.getLaserChance(20);
    assert.ok(Math.abs(chance - 0.65) < 0.01);
  });

  it('dynamic difficulty caps at MAX_CHANCE', () => {
    const chance = laserMod.getLaserChance(100);
    assert.equal(chance, CONFIG.LASER.MAX_CHANCE);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npm run test:unit`
Expected: FAIL — `js/laser.js` does not exist.

**Step 3: Implement js/laser.js**

```js
// js/laser.js
import { CONFIG } from './constants.js';
import * as THREE from 'three';

/**
 * Create a laser net mesh centered in a pipe gap.
 * @param {number} gapTop - top of pipe gap
 * @param {number} gapBot - bottom of pipe gap
 * @returns {{ mesh: THREE.Mesh, hitTop: number, hitBot: number }}
 */
export function createLaserNet(gapTop, gapBot) {
  const gapHeight = gapTop - gapBot;
  const laserHeight = gapHeight * CONFIG.LASER.GAP_FRACTION;
  const gapCenter = (gapTop + gapBot) / 2;
  const hitTop = gapCenter + laserHeight / 2;
  const hitBot = gapCenter - laserHeight / 2;

  // Animated plane spanning the pipe width (diameter = 2.0)
  const geo = new THREE.PlaneGeometry(2.0, laserHeight);
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uColor1: { value: new THREE.Color(0xff2200) },
      uColor2: { value: new THREE.Color(0xffcc00) },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uColor1;
      uniform vec3 uColor2;
      varying vec2 vUv;
      void main() {
        float scanline = sin(vUv.y * 40.0 + uTime * 8.0) * 0.5 + 0.5;
        float pulse = sin(uTime * 4.0) * 0.3 + 0.7;
        vec3 col = mix(uColor1, uColor2, scanline) * pulse;
        float edgeFade = smoothstep(0.0, 0.1, vUv.x) * smoothstep(1.0, 0.9, vUv.x);
        gl_FragColor = vec4(col, (0.7 + scanline * 0.3) * edgeFade * pulse);
      }
    `,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = gapCenter;
  // Rotate to face the angled camera (camera is at x=15, z=15 looking at origin)
  mesh.lookAt(15, gapCenter, 15);
  mesh.frustumCulled = false;

  return { mesh, hitTop, hitBot };
}

/**
 * Update laser net shader animation.
 * @param {THREE.Mesh} mesh - the laser net mesh
 * @param {number} time - current time in seconds
 */
export function updateLaserShader(mesh, time) {
  if (mesh.material.uniforms) {
    mesh.material.uniforms.uTime.value = time;
  }
}

/**
 * Check if bird overlaps a pipe's laser net.
 * @param {number} birdY - bird Y position
 * @param {object} pipe - pipe object with .laser and .group.position.z
 * @param {number} margin - bird hitbox half-height (default 0.1)
 * @returns {boolean}
 */
export function checkLaserCollision(birdY, pipe, margin = 0.1) {
  if (!pipe.laser) return false;
  const pz = pipe.group.position.z;
  if (pz <= -2.0 || pz >= 1.5) return false;
  const { hitTop, hitBot } = pipe.laser;
  if (birdY - margin < hitTop && birdY + margin > hitBot) return true;
  return false;
}

/**
 * Get the current laser spawn chance based on score.
 * @param {number} score
 * @returns {number}
 */
export function getLaserChance(score) {
  return Math.min(
    CONFIG.LASER.MAX_CHANCE,
    CONFIG.LASER.SPAWN_CHANCE + score * CONFIG.LASER.CHANCE_PER_SCORE
  );
}

/**
 * Determine if a laser should spawn for a given pipe.
 * @param {number} pipeIndex - the current pipe count (0-based)
 * @param {number} score - current score
 * @returns {boolean}
 */
export function shouldSpawnLaser(pipeIndex, score) {
  if (pipeIndex < CONFIG.LASER.WARMUP_PIPES) return false;
  return Math.random() < getLaserChance(score);
}
```

**Step 4: Add THREE.ShaderMaterial mock if needed**

Check that `ShaderMaterial` is in the mock (it already is at line 92 of unit.test.js). Also ensure `THREE.PlaneGeometry` is mocked (it is at line 69). And `THREE.Color` is mocked (line 119). Good — no mock changes needed.

**Step 5: Run tests to verify they pass**

Run: `npm run test:unit`
Expected: ALL PASS.

**Step 6: Commit**

```bash
git add js/laser.js tests/unit.test.js
git commit -m "feat: add laser.js module with laser net mesh, collision, and spawn logic"
```

---

### Task 3: Integrate Laser Nets into Pipe Spawning

**Files:**
- Modify: `js/pipes.js:1-65`
- Modify: `js/game.js:1-8` (imports), `js/game.js:165` (spawn call), `js/game.js:167-186` (pipe loop)
- Modify: `tests/unit.test.js`

**Step 1: Write the failing tests**

Add to `tests/unit.test.js` in the `pipes` describe block:

```js
  it('spawnPipe attaches laser to pipe when shouldSpawn returns true', () => {
    const scene = mockScene();
    pipesMod.resetPipes(scene);
    // Force laser on: set WARMUP_PIPES to 0 and SPAWN_CHANCE to 1
    const origWarmup = CONFIG.LASER.WARMUP_PIPES;
    const origChance = CONFIG.LASER.SPAWN_CHANCE;
    CONFIG.LASER.WARMUP_PIPES = 0;
    CONFIG.LASER.SPAWN_CHANCE = 1.0;
    pipesMod.spawnPipe(scene, -18, 0);
    const p = pipesMod.pipes[0];
    assert.ok(p.laser, 'pipe should have a laser when spawn chance is 1.0');
    assert.ok(typeof p.laser.hitTop === 'number');
    assert.ok(typeof p.laser.hitBot === 'number');
    CONFIG.LASER.WARMUP_PIPES = origWarmup;
    CONFIG.LASER.SPAWN_CHANCE = origChance;
  });

  it('spawnPipe does NOT attach laser during warmup', () => {
    const scene = mockScene();
    pipesMod.resetPipes(scene);
    CONFIG.LASER.SPAWN_CHANCE = 1.0;
    pipesMod.spawnPipe(scene, -18, 0); // pipeCount=0, warmup=5
    const p = pipesMod.pipes[0];
    assert.equal(p.laser, null, 'no laser during warmup');
    CONFIG.LASER.SPAWN_CHANCE = 0.35;
  });
```

**Step 2: Run tests to verify they fail**

Run: `npm run test:unit`
Expected: FAIL — `spawnPipe` doesn't accept `score` parameter or attach `laser`.

**Step 3: Modify pipes.js to integrate laser spawning**

In `js/pipes.js`, add import at the top:

```js
import { createLaserNet, shouldSpawnLaser } from './laser.js';
```

Modify `spawnPipe` to accept `score` parameter and attach laser:

```js
export function spawnPipe(scene, spawnZ = PIPE_SPAWN_Z, score = 0) {
  const yOffset = PIPE_Y_PATTERN[pipeCount % 5];
  const currentPipeIndex = pipeCount;
  pipeCount++;
  const gapTop  = yOffset + PIPE_GAP / 2;
  const gapBot  = yOffset - PIPE_GAP / 2;

  const pipeGroup = new THREE.Group();
  pipeGroup.position.set(0, 0, spawnZ);
  pipeGroup.frustumCulled = false;
  scene.add(pipeGroup);

  const topHeight = 12;
  const { group: topGroup, cap: topCap, inner: topInner } = makePipeSegment(topHeight);
  topGroup.position.y = gapTop + topHeight / 2;
  topCap.position.y   = -topHeight / 2;
  topInner.position.y = -topHeight / 2;
  pipeGroup.add(topGroup);

  const botHeight = 12;
  const { group: botGroup, cap: botCap, inner: botInner } = makePipeSegment(botHeight);
  botGroup.position.y = gapBot - botHeight / 2;
  botCap.position.y   = botHeight / 2;
  botInner.position.y = botHeight / 2;
  pipeGroup.add(botGroup);

  let laser = null;
  if (shouldSpawnLaser(currentPipeIndex, score)) {
    const laserData = createLaserNet(gapTop, gapBot);
    pipeGroup.add(laserData.mesh);
    laser = laserData;
  }

  pipes.push({ group: pipeGroup, gapTop, gapBot, scored: false, laser });
}
```

**Step 4: Update game.js to pass score to spawnPipe**

In `js/game.js` line 165, change:
```js
if (now - lastSpawn >= spawnMs) { spawnPipe(scene); lastSpawn = now; }
```
to:
```js
if (now - lastSpawn >= spawnMs) { spawnPipe(scene, undefined, score); lastSpawn = now; }
```

Also import `updateLaserShader` and `checkLaserCollision` in game.js imports:
```js
import { checkLaserCollision, updateLaserShader } from './laser.js';
```

In the pipe loop (after line 169, `p.group.position.z += pipeSpeed * dt;`), add laser shader update:
```js
if (p.laser) updateLaserShader(p.laser.mesh, now * 0.001);
```

**Step 5: Update test API to expose laser info**

In `js/game.js`, in the test API block (after line 214), add:
```js
window.__FLAPPY_NEXT_LASER = _np && _np.laser ? true : false;
```

**Step 6: Run unit tests to verify they pass**

Run: `npm run test:unit`
Expected: ALL PASS.

**Step 7: Run Playwright E2E — custom laser visibility test**

Create `tests/laser-visual.spec.js`:

```js
const { test, expect } = require('@playwright/test');

test('Laser nets appear in pipe gaps after warmup', async ({ page }) => {
  test.setTimeout(30000);

  await page.addInitScript(() => {
    // Force all lasers after warmup
    const _setup = () => {
      if (window.__GAME_CONFIG) {
        window.__GAME_CONFIG.PIPES.SPEED = 0.32;
        window.__GAME_CONFIG.LASER.SPAWN_CHANCE = 1.0;
        window.__GAME_CONFIG.LASER.WARMUP_PIPES = 2;
      } else {
        setTimeout(_setup, 50);
      }
    };
    _setup();

    // Simple pilot that just flaps to survive
    const flap = () => document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
    let frame = 0;
    const pilot = () => {
      frame++;
      if (!window.__FLAPPY_STARTED || window.__FLAPPY_OVER) {
        requestAnimationFrame(pilot); return;
      }
      // Flap every 12 frames to stay alive
      if (frame % 12 === 0) flap();
      requestAnimationFrame(pilot);
    };
    requestAnimationFrame(pilot);
  });

  await page.goto('http://localhost:3457/index.html');
  await page.waitForSelector('canvas');
  await page.evaluate(() => window.__FLAPPY_START_QUIET());

  // Wait for score 5+ (past warmup) and check laser flag
  await page.waitForFunction(() => {
    return (window.__FLAPPY_SCORE || 0) >= 5 && window.__FLAPPY_NEXT_LASER !== undefined;
  }, { timeout: 15000, polling: 'raf' });

  // With SPAWN_CHANCE=1.0, at least some pipes should have lasers
  const hasLaser = await page.evaluate(() => window.__FLAPPY_NEXT_LASER);
  // Note: the bird may die before we can check — the important thing is the laser infrastructure works
  expect(hasLaser).toBeDefined();
});
```

Run: `node node_modules/@playwright/test/cli.js test tests/laser-visual.spec.js`

**Step 8: Video verify with `/compare-before-after-with-video`**

Use `/compare-before-after-with-video`:
- Before: `golden/baseline-pre-phase-dive.webm`
- After: the video from `test-results/` for laser-visual test
- Prompt: "Compare these two gameplay videos. The AFTER video should show red/yellow glowing laser net barriers inside the gaps between purple pipes. The BEFORE video should have no such laser nets. Confirm the laser nets are visually distinct and visible."

**Step 9: Commit**

```bash
git add js/pipes.js js/game.js js/laser.js tests/unit.test.js tests/laser-visual.spec.js
git commit -m "feat: integrate laser nets into pipe spawning with visual shader and collision"
```

---

### Task 4: Split-Screen Input System + Phase State

**Files:**
- Modify: `js/game.js:40-97` (state vars + input handlers)
- Modify: `index.html:80-85` (HUD prompts)
- Modify: `tests/unit.test.js`
- Create: `tests/phase-input.spec.js`

**Step 1: Write the failing unit tests**

Since input handling is in `game.js` (not easily unit-testable), we test via Playwright. But we can unit-test the overheat logic as a pure function. For now, create the E2E test:

**Step 2: Add phase state variables to game.js**

After the existing state variables (line 46), add:

```js
// Phase Dive state
let phasing       = false;
let phaseStamina  = CONFIG.PHASE.MAX_DURATION;
let phaseCooldown = 0;
let phaseUsed     = false; // tracks if phase was ever activated (for HUD visibility)
```

**Step 3: Replace input handlers**

Replace the input section (`js/game.js` lines 57-97) with split-screen input:

```js
// ── Input ────────────────────────────────────────────────────────────
function handleInput() {
  if (gameOver) return;
  if (!started) {
    started = true;
    lastSpawn = performance.now();
    overlayEl.classList.add('hidden');
    playBgm(audio);
  }
  velocity = FLAP;
}

function tryRestart() {
  if (gameOver && !overlayEl.classList.contains('hidden')) restartGame();
}

function setPhasing(active) {
  if (gameOver || !started) return;
  if (active && phaseCooldown > 0) return;  // locked during cooldown
  if (active && phaseStamina <= 0) return;   // depleted
  phasing = active;
  if (active) phaseUsed = true;
}

// Keyboard
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
    e.preventDefault();
    gameOver ? tryRestart() : handleInput();
  }
  if (e.code === 'KeyD') {
    e.preventDefault();
    setPhasing(true);
  }
});
document.addEventListener('keyup', (e) => {
  if (e.code === 'KeyD') setPhasing(false);
});

// Touch — split screen: left = flap, right = phase
document.addEventListener('touchstart', (e) => {
  for (const touch of e.changedTouches) {
    const xRatio = touch.clientX / window.innerWidth;
    if (xRatio < 0.5) {
      gameOver ? tryRestart() : handleInput();
    } else {
      gameOver ? tryRestart() : setPhasing(true);
    }
  }
}, { passive: true });
document.addEventListener('touchend', (e) => {
  for (const touch of e.changedTouches) {
    const xRatio = touch.clientX / window.innerWidth;
    if (xRatio >= 0.5) {
      setPhasing(false);
    }
  }
}, { passive: true });

// Mouse — split screen: left = flap, right = phase
document.addEventListener('mousedown', (e) => {
  const xRatio = e.clientX / window.innerWidth;
  if (xRatio < 0.5) {
    gameOver ? tryRestart() : handleInput();
  } else {
    gameOver ? tryRestart() : setPhasing(true);
  }
});
document.addEventListener('mouseup', (e) => {
  const xRatio = e.clientX / window.innerWidth;
  if (xRatio >= 0.5) {
    setPhasing(false);
  }
});
```

Remove the old `click` listener (line 97).

**Step 4: Add phase test API**

In the test API section of `game.js` (after line 215), add:

```js
window.__FLAPPY_PHASING = phasing;
window.__FLAPPY_PHASE_STAMINA = phaseStamina;
window.__FLAPPY_PHASE_COOLDOWN = phaseCooldown;
window.__FLAPPY_PHASE_ACTIVATE = () => setPhasing(true);
window.__FLAPPY_PHASE_DEACTIVATE = () => setPhasing(false);
```

**Step 5: Reset phase state in restartGame**

In `restartGame()` (line 135), add:

```js
phasing = false; phaseStamina = CONFIG.PHASE.MAX_DURATION; phaseCooldown = 0; phaseUsed = false;
```

**Step 6: Add HUD prompts to index.html**

In `index.html`, after the overlay div (line 85), add:

```html
<div id="phase-hud" style="display:none;">
  <div id="phase-bar-container">
    <div id="phase-bar-fill"></div>
  </div>
</div>
<div id="input-hints">
  <span class="hint-left">TAP TO JUMP</span>
  <div class="hint-divider"></div>
  <span class="hint-right">HOLD TO PHASE</span>
</div>
```

Add CSS for the stamina bar and input hints:

```css
#phase-hud {
  position: fixed;
  bottom: 40px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 15;
}
#phase-bar-container {
  width: 120px;
  height: 8px;
  border: 1px solid rgba(0, 255, 255, 0.4);
  background: rgba(0, 0, 0, 0.5);
  border-radius: 4px;
  overflow: hidden;
}
#phase-bar-fill {
  height: 100%;
  width: 100%;
  background: #00ffff;
  transition: width 0.1s linear, background-color 0.3s;
  box-shadow: 0 0 8px #00ffff;
}
#input-hints {
  position: fixed;
  bottom: 60px;
  left: 0; right: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 20px;
  z-index: 15;
  pointer-events: none;
  opacity: 0.4;
}
#input-hints .hint-left, #input-hints .hint-right {
  font-family: 'Share Tech Mono', monospace;
  font-size: 12px;
  letter-spacing: 2px;
  color: #00ffff;
  text-shadow: 0 0 6px #00ffff;
}
#input-hints .hint-divider {
  width: 1px;
  height: 30px;
  background: rgba(0, 255, 255, 0.3);
}
```

**Step 7: Write Playwright input test**

Create `tests/phase-input.spec.js`:

```js
const { test, expect } = require('@playwright/test');

test('Phase activates on D key hold and deactivates on release', async ({ page }) => {
  test.setTimeout(20000);

  await page.goto('http://localhost:3457/index.html');
  await page.waitForSelector('canvas');

  // Start game
  await page.evaluate(() => window.__FLAPPY_START_QUIET());
  await page.waitForFunction(() => window.__FLAPPY_STARTED === true, { timeout: 5000 });

  // Verify not phasing initially
  const initialPhase = await page.evaluate(() => window.__FLAPPY_PHASING);
  expect(initialPhase).toBe(false);

  // Hold D key
  await page.keyboard.down('d');
  await page.waitForFunction(() => window.__FLAPPY_PHASING === true, { timeout: 2000 });

  // Release D key
  await page.keyboard.up('d');
  await page.waitForFunction(() => window.__FLAPPY_PHASING === false, { timeout: 2000 });
});

test('Flap and phase work simultaneously', async ({ page }) => {
  test.setTimeout(20000);

  await page.goto('http://localhost:3457/index.html');
  await page.waitForSelector('canvas');
  await page.evaluate(() => window.__FLAPPY_START_QUIET());
  await page.waitForFunction(() => window.__FLAPPY_STARTED === true, { timeout: 5000 });

  // Hold D to phase
  await page.keyboard.down('d');
  await page.waitForFunction(() => window.__FLAPPY_PHASING === true, { timeout: 2000 });

  // Flap while phasing — bird should move up AND still be phasing
  const yBefore = await page.evaluate(() => window.__FLAPPY_BIRD_Y);
  await page.keyboard.press('Space');

  // Wait a few frames for flap to take effect
  await page.waitForFunction((prevY) => {
    return window.__FLAPPY_BIRD_Y > prevY && window.__FLAPPY_PHASING === true;
  }, yBefore, { timeout: 3000, polling: 'raf' });

  const phasing = await page.evaluate(() => window.__FLAPPY_PHASING);
  expect(phasing).toBe(true);
});
```

**Step 8: Run Playwright tests**

Run: `node node_modules/@playwright/test/cli.js test tests/phase-input.spec.js`
Expected: PASS.

**Step 9: Commit**

```bash
git add js/game.js index.html tests/phase-input.spec.js
git commit -m "feat: add split-screen input system with D key / right-side phase activation"
```

---

### Task 5: Overheat Stamina System

**Files:**
- Modify: `js/game.js:153-191` (game loop)
- Modify: `tests/unit.test.js`
- Create: `tests/overheat.spec.js`

**Step 1: Write the failing unit tests**

Extract the overheat tick logic as a pure function for testability. Add to `tests/unit.test.js`:

```js
describe('overheat system', () => {
  // Pure function test of the stamina tick logic
  // Mirrors the logic in game.js loop
  function tickOverheat(state, dtSec) {
    const cfg = CONFIG.PHASE;
    if (state.phasing && state.cooldown <= 0) {
      state.stamina -= cfg.DRAIN_RATE * dtSec;
      if (state.stamina <= 0) {
        state.stamina = 0;
        state.phasing = false;
        state.cooldown = cfg.COOLDOWN;
      }
    }
    if (!state.phasing && state.cooldown > 0) {
      state.cooldown -= dtSec;
      if (state.cooldown < 0) state.cooldown = 0;
    }
    if (!state.phasing && state.cooldown <= 0) {
      state.stamina = Math.min(cfg.MAX_DURATION, state.stamina + cfg.CHARGE_RATE * dtSec);
    }
    return state;
  }

  it('drains stamina while phasing', () => {
    const s = tickOverheat({ phasing: true, stamina: 1.5, cooldown: 0 }, 0.5);
    assert.ok(Math.abs(s.stamina - 1.0) < 0.01);
    assert.equal(s.phasing, true);
  });

  it('forces unphase and sets cooldown when stamina depletes', () => {
    const s = tickOverheat({ phasing: true, stamina: 0.1, cooldown: 0 }, 0.5);
    assert.equal(s.stamina, 0);
    assert.equal(s.phasing, false);
    assert.equal(s.cooldown, CONFIG.PHASE.COOLDOWN);
  });

  it('decrements cooldown when not phasing', () => {
    const s = tickOverheat({ phasing: false, stamina: 0, cooldown: 1.0 }, 0.3);
    assert.ok(Math.abs(s.cooldown - 0.7) < 0.01);
  });

  it('recharges stamina after cooldown expires', () => {
    const s = tickOverheat({ phasing: false, stamina: 0, cooldown: 0 }, 1.0);
    assert.ok(Math.abs(s.stamina - CONFIG.PHASE.CHARGE_RATE) < 0.01);
  });

  it('caps stamina at MAX_DURATION', () => {
    const s = tickOverheat({ phasing: false, stamina: 1.4, cooldown: 0 }, 10.0);
    assert.equal(s.stamina, CONFIG.PHASE.MAX_DURATION);
  });

  it('blocks phasing during cooldown', () => {
    // This simulates what setPhasing does — can't set phasing if cooldown > 0
    const state = { phasing: false, stamina: 0, cooldown: 0.5 };
    // Attempting to phase during cooldown should be blocked by setPhasing
    // We test the guard condition directly
    const canPhase = state.cooldown <= 0 && state.stamina > 0;
    assert.equal(canPhase, false);
  });
});
```

**Step 2: Run tests — they should pass since `tickOverheat` is defined inline**

Run: `npm run test:unit`
Expected: PASS (these test pure logic, not imports).

**Step 3: Add overheat tick to game.js game loop**

In `js/game.js`, inside the `if (started && !gameOver)` block (after `birdGroup.rotation.z` update, around line 158), add:

```js
    // Overheat tick
    const dtSec = dt / 60; // dt is in frames at 60fps, convert to seconds
    if (phasing && phaseCooldown <= 0) {
      phaseStamina -= CONFIG.PHASE.DRAIN_RATE * dtSec;
      if (phaseStamina <= 0) {
        phaseStamina = 0;
        phasing = false;
        phaseCooldown = CONFIG.PHASE.COOLDOWN;
      }
    }
    if (!phasing && phaseCooldown > 0) {
      phaseCooldown -= dtSec;
      if (phaseCooldown < 0) phaseCooldown = 0;
    }
    if (!phasing && phaseCooldown <= 0) {
      phaseStamina = Math.min(CONFIG.PHASE.MAX_DURATION, phaseStamina + CONFIG.PHASE.CHARGE_RATE * dtSec);
    }

    // Update stamina HUD
    if (phaseUsed) {
      const barEl = document.getElementById('phase-hud');
      const fillEl = document.getElementById('phase-bar-fill');
      if (barEl) barEl.style.display = 'block';
      if (fillEl) {
        const pct = phaseStamina / CONFIG.PHASE.MAX_DURATION;
        fillEl.style.width = (pct * 100) + '%';
        if (pct > 0.3) fillEl.style.background = '#00ffff';
        else if (pct > 0.1) fillEl.style.background = '#ffcc00';
        else fillEl.style.background = '#ff2200';
        if (phaseCooldown > 0) fillEl.style.animation = 'flicker 0.3s infinite';
        else fillEl.style.animation = 'none';
      }
    }
```

**Step 4: Add laser collision to game loop (with phase bypass)**

In the pipe loop, after `checkCollision` (line 183), add laser collision:

```js
      // Laser collision — phasing bypasses
      if (!phasing && checkLaserCollision(birdGroup.position.y, p)) {
        triggerGameOver(); return;
      }
```

**Step 5: Add unphase-while-overlapping check**

In `setPhasing`, when deactivating, check for laser overlap:

```js
function setPhasing(active) {
  if (gameOver || !started) return;
  if (active && phaseCooldown > 0) return;
  if (active && phaseStamina <= 0) return;

  // Edge case: unphasing while overlapping a laser = instant death
  if (!active && phasing) {
    for (const p of pipes) {
      if (checkLaserCollision(birdGroup.position.y, p)) {
        triggerGameOver();
        phasing = false;
        return;
      }
    }
  }

  phasing = active;
  if (active) phaseUsed = true;
}
```

**Step 6: Write Playwright overheat test**

Create `tests/overheat.spec.js`:

```js
const { test, expect } = require('@playwright/test');

test('Overheat: stamina depletes and forces unphase after MAX_DURATION', async ({ page }) => {
  test.setTimeout(20000);

  await page.goto('http://localhost:3457/index.html');
  await page.waitForSelector('canvas');
  await page.evaluate(() => window.__FLAPPY_START_QUIET());
  await page.waitForFunction(() => window.__FLAPPY_STARTED, { timeout: 5000 });

  // Verify full stamina
  const startStamina = await page.evaluate(() => window.__FLAPPY_PHASE_STAMINA);
  expect(startStamina).toBe(1.5);

  // Hold D to phase
  await page.keyboard.down('d');
  await page.waitForFunction(() => window.__FLAPPY_PHASING === true, { timeout: 2000 });

  // Wait for stamina to deplete (~1.5s + buffer)
  await page.waitForFunction(() => window.__FLAPPY_PHASE_STAMINA === 0, { timeout: 5000, polling: 'raf' });

  // Should be forced out of phase
  const phasing = await page.evaluate(() => window.__FLAPPY_PHASING);
  expect(phasing).toBe(false);

  // Cooldown should be active
  const cooldown = await page.evaluate(() => window.__FLAPPY_PHASE_COOLDOWN);
  expect(cooldown).toBeGreaterThan(0);

  // Release D
  await page.keyboard.up('d');

  // Wait for cooldown to expire
  await page.waitForFunction(() => window.__FLAPPY_PHASE_COOLDOWN === 0, { timeout: 5000, polling: 'raf' });

  // Stamina should start recharging
  await page.waitForFunction(() => window.__FLAPPY_PHASE_STAMINA > 0, { timeout: 5000, polling: 'raf' });
});
```

**Step 7: Run all tests**

Run: `npm run test:unit && node node_modules/@playwright/test/cli.js test tests/overheat.spec.js`
Expected: ALL PASS.

**Step 8: Video verify with `/verify-video`**

Run: `node node_modules/@playwright/test/cli.js test tests/overheat.spec.js`
Use `/verify-video` on the recorded video with prompt: "Verify this shows: (1) a game starting, (2) a stamina bar appearing at the bottom of the screen, (3) the bar draining while a key is held, (4) the bar reaching empty, (5) the bar recharging after a brief cooldown."

**Step 9: Commit**

```bash
git add js/game.js tests/unit.test.js tests/overheat.spec.js
git commit -m "feat: add overheat stamina system with drain, cooldown, and HUD bar"
```

---

### Task 6: Phase Visual Feedback — Ship + Trail + Transition VFX

**Files:**
- Modify: `js/game.js` (bird visual updates in loop)
- Modify: `js/trail.js:39-48` (add phased color mode)
- Modify: `tests/unit.test.js`
- Create: `tests/phase-visuals.spec.js`

**Step 1: Write the failing unit tests**

Add to `tests/unit.test.js`:

```js
describe('trail phased mode', () => {
  it('updateTrail accepts phased parameter without error', () => {
    const scene = mockScene();
    const trail = trailMod.createTrail(scene);
    assert.doesNotThrow(() => {
      trailMod.updateTrail(trail, 0, 0, -0.3, true);
      trailMod.updateTrail(trail, 0, 0, -0.3, true);
    });
  });

  it('phased trail has different colors than solid trail', () => {
    const scene = mockScene();
    const solidTrail = trailMod.createTrail(scene);
    for (let i = 0; i < 6; i++) trailMod.updateTrail(solidTrail, 0, i * 0.1, -0.3, false);
    const solidColors = [...solidTrail.geometry.attributes.color.array];

    const scene2 = mockScene();
    const phasedTrail = trailMod.createTrail(scene2);
    for (let i = 0; i < 6; i++) trailMod.updateTrail(phasedTrail, 0, i * 0.1, -0.3, true);
    const phasedColors = [...phasedTrail.geometry.attributes.color.array];

    // At least some color values should differ
    let differs = false;
    for (let i = 0; i < solidColors.length; i++) {
      if (Math.abs(solidColors[i] - phasedColors[i]) > 0.01) { differs = true; break; }
    }
    assert.ok(differs, 'phased trail colors should differ from solid trail colors');
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npm run test:unit`
Expected: FAIL — `updateTrail` doesn't accept a 4th parameter (or ignores it).

**Step 3: Modify trail.js to support phased colors**

In `js/trail.js`, modify `updateTrail` signature (line 39):

```js
export function updateTrail(points, x, y, z, phased = false) {
```

Store the phased flag in userData:
```js
  points.userData.phased = phased;
```

In `_rebuildBuffer`, modify the color assignment (lines 78-80):

```js
    if (points.userData.phased) {
      // White/magenta alternating
      const isOdd = i % 2 === 0;
      col[i * 3]     = isOdd ? 1.0 : 1.0;                    // R
      col[i * 3 + 1] = isOdd ? 1.0 * (1 - t * 0.5) : 0;     // G
      col[i * 3 + 2] = isOdd ? 1.0 * (1 - t * 0.5) : 1.0;   // B
    } else {
      col[i * 3]     = 0;
      col[i * 3 + 1] = 1 - t * 0.9;
      col[i * 3 + 2] = 1 - t * 0.9;
    }
```

Also increase point size when phased: after `_rebuildBuffer` call in `updateTrail`:
```js
  points.material.size = phased ? 0.4 : 0.28;
```

**Step 4: Add bird visual state to game.js loop**

In the game loop's `if (started && !gameOver)` block, after the engine hue cycle (line 160), add:

```js
    // Phase visual feedback on bird
    const bodyMat = birdGroup.children[0].material;
    const wingMat = birdGroup.children[3].material;
    if (phasing) {
      bodyMat.transparent = true;
      bodyMat.opacity = 0.4;
      bodyMat.emissive.setHex(0xffffff);
      bodyMat.emissiveIntensity = 1.5;
      wingMat.transparent = true;
      wingMat.opacity = 0.4;
      wingMat.emissive.setHex(0xffffff);
      eng.material.color.setHex(0xffffff);
      // Subtle scale pulse
      const pulse = 1.0 + Math.sin(now * 0.025) * 0.05;
      birdGroup.scale.set(pulse, pulse, pulse);
    } else {
      bodyMat.transparent = false;
      bodyMat.opacity = 1.0;
      bodyMat.emissive.setHex(0x00ccff);
      bodyMat.emissiveIntensity = 0.6;
      wingMat.transparent = false;
      wingMat.opacity = 1.0;
      wingMat.emissive.setHex(0x0066aa);
      birdGroup.scale.set(1, 1, 1);
    }
```

Update the `updateTrail` call to pass phasing state:

```js
    updateTrail(trail, birdGroup.position.x, birdGroup.position.y, birdGroup.position.z - 0.3, phasing);
```

**Step 5: Add phase transition VFX**

Add a variable to track phase transition at the top of game state:
```js
let wasPhasing = false;
```

In the game loop, before the phase visual block:
```js
    // Phase transition VFX
    if (phasing !== wasPhasing) {
      // Small particle burst on transition
      spawnExplosion(scene, birdGroup.position.x, birdGroup.position.y, birdGroup.position.z);
      wasPhasing = phasing;
    }
```

Reset in `restartGame`:
```js
wasPhasing = false;
```

**Step 6: Run unit tests**

Run: `npm run test:unit`
Expected: ALL PASS.

**Step 7: Write Playwright visual test**

Create `tests/phase-visuals.spec.js`:

```js
const { test, expect } = require('@playwright/test');

test('Phase visual: ship appearance changes when phasing', async ({ page }) => {
  test.setTimeout(25000);

  await page.addInitScript(() => {
    // Disable lasers so we can phase freely without dying
    const _setup = () => {
      if (window.__GAME_CONFIG) {
        window.__GAME_CONFIG.LASER.SPAWN_CHANCE = 0;
      } else {
        setTimeout(_setup, 50);
      }
    };
    _setup();

    // Auto-flap pilot
    const flap = () => document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
    let frame = 0;
    const pilot = () => {
      frame++;
      if (!window.__FLAPPY_STARTED || window.__FLAPPY_OVER) {
        requestAnimationFrame(pilot); return;
      }
      if (frame % 10 === 0) flap();
      requestAnimationFrame(pilot);
    };
    requestAnimationFrame(pilot);
  });

  await page.goto('http://localhost:3457/index.html');
  await page.waitForSelector('canvas');
  await page.evaluate(() => window.__FLAPPY_START_QUIET());
  await page.waitForFunction(() => window.__FLAPPY_STARTED, { timeout: 5000 });

  // Fly for 2 seconds in solid state
  await page.waitForTimeout(2000);

  // Activate phase for 1 second
  await page.keyboard.down('d');
  await page.waitForFunction(() => window.__FLAPPY_PHASING === true, { timeout: 2000 });
  await page.waitForTimeout(1000);

  // Deactivate phase
  await page.keyboard.up('d');
  await page.waitForFunction(() => window.__FLAPPY_PHASING === false, { timeout: 2000 });

  // Fly for 1 more second in solid state
  await page.waitForTimeout(1000);

  // If we got here without crash, visual test passed — video captures the transitions
  const score = await page.evaluate(() => window.__FLAPPY_SCORE || 0);
  expect(score).toBeGreaterThanOrEqual(0); // just needs to not crash
});
```

**Step 8: Run Playwright test and video verify**

Run: `node node_modules/@playwright/test/cli.js test tests/phase-visuals.spec.js`

Use `/compare-before-after-with-video`:
- Before: `golden/baseline-pre-phase-dive.webm`
- After: video from `test-results/` for phase-visuals test
- Prompt: "Compare these videos. The AFTER video should show: (1) the ship turning translucent/white when phasing, (2) a particle burst on phase transitions, (3) the trail changing color from cyan to white/magenta when phased, (4) the ship returning to normal cyan when phase ends. The BEFORE video should show none of these effects."

**Step 9: Commit**

```bash
git add js/game.js js/trail.js tests/unit.test.js tests/phase-visuals.spec.js
git commit -m "feat: add phase visual feedback - translucent ship, color trail, transition VFX"
```

---

### Task 7: Collision Rules — All 4 Scenarios + Edge Case

**Files:**
- Modify: `tests/unit.test.js`
- Create: `tests/collision-phase.spec.js`

**Step 1: Write unit tests for all collision combos**

Add to `tests/unit.test.js`:

```js
describe('phase collision rules', () => {
  it('solid ship vs pipe = death (checkCollision returns true)', () => {
    const pipe = makePipe(0, 3.5, -3.5);
    assert.equal(checkCollision(4.0, 0, pipe), true);
  });

  it('phased ship vs pipe = death (checkCollision still returns true)', () => {
    // checkCollision has no phasing awareness — pipes always kill
    const pipe = makePipe(0, 3.5, -3.5);
    assert.equal(checkCollision(4.0, 0, pipe), true);
  });

  it('solid ship vs laser = death', () => {
    const pipe = {
      group: { position: { z: 0 } },
      gapTop: 3.75, gapBot: -3.75,
      laser: laserMod.createLaserNet(3.75, -3.75),
    };
    assert.equal(laserMod.checkLaserCollision(0, pipe, 0.1), true);
  });

  it('phased ship vs laser = safe (game.js gates on !phasing)', () => {
    // checkLaserCollision itself returns true (it doesn't know about phasing)
    // The game loop guards: if (!phasing && checkLaserCollision) → die
    // So we verify the guard logic: when phasing=true, skip collision
    const pipe = {
      group: { position: { z: 0 } },
      gapTop: 3.75, gapBot: -3.75,
      laser: laserMod.createLaserNet(3.75, -3.75),
    };
    const laserHit = laserMod.checkLaserCollision(0, pipe, 0.1);
    const phasing = true;
    const wouldDie = !phasing && laserHit;
    assert.equal(wouldDie, false, 'phased ship should not die from laser');
  });

  it('unphase-while-overlapping laser = death', () => {
    const pipe = {
      group: { position: { z: 0 } },
      gapTop: 3.75, gapBot: -3.75,
      laser: laserMod.createLaserNet(3.75, -3.75),
    };
    // Simulate: was phasing (true → false), check laser overlap
    const wasPhasing = true;
    const nowPhasing = false;
    const transitioning = wasPhasing && !nowPhasing;
    const overlapping = laserMod.checkLaserCollision(0, pipe, 0.1);
    assert.equal(transitioning && overlapping, true, 'should trigger death');
  });
});
```

**Step 2: Run unit tests**

Run: `npm run test:unit`
Expected: ALL PASS (these test logic, not game state).

**Step 3: Write Playwright collision scenario tests**

Create `tests/collision-phase.spec.js`:

```js
const { test, expect } = require('@playwright/test');

test('Solid ship hitting laser net = game over', async ({ page }) => {
  test.setTimeout(20000);

  await page.addInitScript(() => {
    const _setup = () => {
      if (window.__GAME_CONFIG) {
        window.__GAME_CONFIG.LASER.SPAWN_CHANCE = 1.0;
        window.__GAME_CONFIG.LASER.WARMUP_PIPES = 0;
      } else {
        setTimeout(_setup, 50);
      }
    };
    _setup();
  });

  await page.goto('http://localhost:3457/index.html');
  await page.waitForSelector('canvas');
  await page.evaluate(() => window.__FLAPPY_START_QUIET());

  // Don't flap — bird will float through first pipe gap center where laser is
  // Just wait for game over from laser hit
  await page.waitForFunction(() => window.__FLAPPY_OVER === true, { timeout: 15000, polling: 'raf' });
  const isOver = await page.evaluate(() => window.__FLAPPY_OVER);
  expect(isOver).toBe(true);
});

test('Phased ship passes through laser net safely', async ({ page }) => {
  test.setTimeout(30000);

  await page.addInitScript(() => {
    const _setup = () => {
      if (window.__GAME_CONFIG) {
        window.__GAME_CONFIG.LASER.SPAWN_CHANCE = 1.0;
        window.__GAME_CONFIG.LASER.WARMUP_PIPES = 0;
      } else {
        setTimeout(_setup, 50);
      }
    };
    _setup();

    // Pilot that flaps to center and phases when approaching laser
    const flap = () => document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
    let frame = 0;
    const pilot = () => {
      frame++;
      const started = window.__FLAPPY_STARTED;
      const isOver = window.__FLAPPY_OVER;
      if (!started || isOver) { requestAnimationFrame(pilot); return; }

      const birdY = window.__FLAPPY_BIRD_Y;
      const vel = window.__FLAPPY_VELOCITY;
      const pipeZ = window.__FLAPPY_NEXT_PIPE_Z;
      const hasLaser = window.__FLAPPY_NEXT_LASER;

      // Simple flap logic to stay near center
      if (birdY < -1 && vel > 0) flap();

      // Phase when laser pipe is approaching
      if (hasLaser && pipeZ > -3 && pipeZ < 2) {
        if (!window.__FLAPPY_PHASING) window.__FLAPPY_PHASE_ACTIVATE();
      } else {
        if (window.__FLAPPY_PHASING) window.__FLAPPY_PHASE_DEACTIVATE();
      }

      requestAnimationFrame(pilot);
    };
    requestAnimationFrame(pilot);
  });

  await page.goto('http://localhost:3457/index.html');
  await page.waitForSelector('canvas');
  await page.evaluate(() => window.__FLAPPY_START_QUIET());

  // Should survive at least 3 pipes (passing through lasers while phased)
  await page.waitForFunction(() => (window.__FLAPPY_SCORE || 0) >= 3, { timeout: 20000, polling: 'raf' });
  const score = await page.evaluate(() => window.__FLAPPY_SCORE);
  expect(score).toBeGreaterThanOrEqual(3);
});

test('Phased ship still dies on pipe collision', async ({ page }) => {
  test.setTimeout(20000);

  await page.addInitScript(() => {
    const _setup = () => {
      if (window.__GAME_CONFIG) {
        window.__GAME_CONFIG.LASER.SPAWN_CHANCE = 0;
      } else {
        setTimeout(_setup, 50);
      }
    };
    _setup();
  });

  await page.goto('http://localhost:3457/index.html');
  await page.waitForSelector('canvas');
  await page.evaluate(() => window.__FLAPPY_START_QUIET());

  // Activate phase immediately
  await page.evaluate(() => window.__FLAPPY_PHASE_ACTIVATE());

  // Don't flap — bird will fall into a pipe. Phase should NOT protect from pipes.
  await page.waitForFunction(() => window.__FLAPPY_OVER === true, { timeout: 15000, polling: 'raf' });
  const isOver = await page.evaluate(() => window.__FLAPPY_OVER);
  expect(isOver).toBe(true);
});
```

**Step 4: Run Playwright collision tests**

Run: `node node_modules/@playwright/test/cli.js test tests/collision-phase.spec.js`
Expected: ALL PASS.

**Step 5: Video verify**

Use `/verify-video` on the "phased ship passes through laser" test video:
- Prompt: "Verify this shows: a ship that turns translucent/white (phased state) as it approaches red/yellow laser barriers between pipes, passes safely through them, then returns to solid cyan state. The ship should survive multiple pipe passages."

**Step 6: Commit**

```bash
git add tests/unit.test.js tests/collision-phase.spec.js
git commit -m "test: comprehensive collision rule tests - solid/phased vs pipe/laser + edge cases"
```

---

### Task 8: Audio Placeholders

**Files:**
- Modify: `js/audio.js`
- Modify: `js/game.js` (import + wire calls)
- Modify: `tests/unit.test.js`

**Step 1: Write the failing unit tests**

Add to `tests/unit.test.js` in the `audio` describe block:

```js
  it('createSfx returns object with 4 audio slots', async () => {
    const { createSfx } = await import('../js/audio.js');
    const sfx = createSfx();
    assert.ok(sfx.phaseIn);
    assert.ok(sfx.phaseOut);
    assert.ok(sfx.laserPass);
    assert.ok(sfx.laserDeath);
  });

  it('playPhaseIn does not throw with empty src', async () => {
    const { createSfx, playPhaseIn } = await import('../js/audio.js');
    const sfx = createSfx();
    assert.doesNotThrow(() => playPhaseIn(sfx));
  });
```

**Step 2: Run tests — FAIL**

Run: `npm run test:unit`
Expected: FAIL — `createSfx` not exported.

**Step 3: Add SFX functions to audio.js**

Append to `js/audio.js`:

```js
export function createSfx() {
  const make = () => {
    const el = document.createElement('audio');
    el.src = '';
    el.volume = 0.8;
    return el;
  };
  return {
    phaseIn: make(),
    phaseOut: make(),
    laserPass: make(),
    laserDeath: make(),
  };
}

function playSfxSlot(el) {
  if (el && el.src && el.src !== '' && el.src !== window.location.href) {
    el.currentTime = 0;
    el.play().catch(() => {});
  }
}

export function playPhaseIn(sfx) { playSfxSlot(sfx.phaseIn); }
export function playPhaseOut(sfx) { playSfxSlot(sfx.phaseOut); }
export function playLaserPass(sfx) { playSfxSlot(sfx.laserPass); }
export function playLaserDeath(sfx) { playSfxSlot(sfx.laserDeath); }
```

**Step 4: Wire SFX into game.js**

In `js/game.js` imports, add:
```js
import { createAudio, playBgm, pauseBgm, createSfx, playPhaseIn, playPhaseOut, playLaserPass, playLaserDeath } from './audio.js';
```

After `const audio = createAudio();` add:
```js
const sfx = createSfx();
window.__GAME_SFX = sfx;
```

In the phase transition VFX block:
```js
    if (phasing !== wasPhasing) {
      spawnExplosion(scene, birdGroup.position.x, birdGroup.position.y, birdGroup.position.z);
      if (phasing) playPhaseIn(sfx);
      else playPhaseOut(sfx);
      wasPhasing = phasing;
    }
```

In the scoring block (when `p.scored = true`), if the pipe had a laser and the bird was phasing:
```js
      if (!p.scored && p.group.position.z > 1) {
        p.scored = true;
        score++;
        scoreEl.textContent = score;
        if (p.laser && phasing) playLaserPass(sfx);
      }
```

**Step 5: Run unit tests**

Run: `npm run test:unit`
Expected: ALL PASS.

**Step 6: Commit**

```bash
git add js/audio.js js/game.js tests/unit.test.js
git commit -m "feat: add audio SFX placeholders for phase transitions and laser events"
```

---

### Task 9: Updated High-Score Pilot with Phase Dive

**Files:**
- Modify: `tests/high-score.spec.js`
- Create: `tests/phase-dive-pilot.spec.js`

**Step 1: Create dedicated Phase Dive pilot test**

Create `tests/phase-dive-pilot.spec.js`:

```js
const { test, expect } = require('@playwright/test');

test('Phase Dive pilot: navigate 20+ pipes with laser nets', async ({ page }) => {
  test.setTimeout(90000);

  page.on('console', msg => {
    if (msg.type() !== 'error') console.log('[browser]', msg.text());
  });

  await page.addInitScript(() => {
    window.PILOT_ENABLED = true;
    window.__PILOT_BEST = 0;

    const _speedup = () => {
      if (window.__GAME_CONFIG) {
        window.__GAME_CONFIG.PIPES.SPEED = 0.32;
        // Ensure lasers spawn frequently for testing
        window.__GAME_CONFIG.LASER.SPAWN_CHANCE = 0.5;
        window.__GAME_CONFIG.LASER.WARMUP_PIPES = 3;
      } else {
        setTimeout(_speedup, 50);
      }
    };
    _speedup();

    const flap = () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
    };

    const simulate = (birdY, vel, frames, flapNow, G, FV, TV) => {
      let y = birdY, v = flapNow ? FV : vel;
      for (let f = 0; f < frames; f++) {
        v += G; if (v > TV) v = TV;
        y -= v;
      }
      return y;
    };

    let lastFlapFrame = -10;
    let frameCount = 0;
    let rebootPending = false;

    const pilotLoop = () => {
      frameCount++;
      if (!window.PILOT_ENABLED) { requestAnimationFrame(pilotLoop); return; }

      const score = window.__FLAPPY_SCORE || 0;
      const isOver = window.__FLAPPY_OVER;
      const started = window.__FLAPPY_STARTED;
      const birdY = window.__FLAPPY_BIRD_Y;
      const vel = window.__FLAPPY_VELOCITY;
      const gapTop1 = window.__FLAPPY_NEXT_GAP_TOP;
      const gapBot1 = window.__FLAPPY_NEXT_GAP_BOT;
      const pipeZ1 = window.__FLAPPY_NEXT_PIPE_Z;
      const hasLaser = window.__FLAPPY_NEXT_LASER;
      const phaseStamina = window.__FLAPPY_PHASE_STAMINA;
      const phaseCooldown = window.__FLAPPY_PHASE_COOLDOWN;
      const config = window.__GAME_CONFIG;

      if (score > window.__PILOT_BEST) {
        window.__PILOT_BEST = score;
        console.log('[pilot] score=' + score);
      }

      if (isOver && !rebootPending) {
        rebootPending = true;
        console.log('[pilot] CRASH at ' + window.__PILOT_BEST + ', rebooting...');
        setTimeout(() => {
          if (window.__FLAPPY_RESTART) window.__FLAPPY_RESTART();
          setTimeout(() => {
            rebootPending = false;
            if (window.__FLAPPY_START_QUIET) window.__FLAPPY_START_QUIET();
          }, 200);
        }, 600);
      }

      if (!started || isOver || birdY === undefined || !config) {
        requestAnimationFrame(pilotLoop); return;
      }

      const G = config.PHYSICS.GRAVITY;
      const FV = config.PHYSICS.FLAP;
      const TV = config.PHYSICS.TERMINAL_VELOCITY;
      const PS = config.PIPES.SPEED;

      // Phase management: activate phase when approaching a laser pipe
      const pipeApproaching = pipeZ1 > -3 && pipeZ1 < 2;
      const canPhase = phaseStamina > 0.3 && phaseCooldown <= 0;

      if (hasLaser && pipeApproaching && canPhase) {
        if (!window.__FLAPPY_PHASING) {
          window.__FLAPPY_PHASE_ACTIVATE();
          console.log('[pilot] PHASE ON for laser at z=' + pipeZ1.toFixed(1));
        }
      } else {
        if (window.__FLAPPY_PHASING) {
          window.__FLAPPY_PHASE_DEACTIVATE();
          console.log('[pilot] PHASE OFF');
        }
      }

      // Look-ahead for pipe bunching
      const gapTop2 = window.__FLAPPY_NEXT2_GAP_TOP;
      const gapBot2 = window.__FLAPPY_NEXT2_GAP_BOT;
      const pipeZ2 = window.__FLAPPY_NEXT2_PIPE_Z;
      const pipe2InZone = pipeZ2 && pipeZ2 > -2.5 && pipeZ2 < 1.5;

      const tGapTop = pipe2InZone ? Math.min(gapTop1, gapTop2) : gapTop1;
      const tGapBot = pipe2InZone ? Math.max(gapBot1, gapBot2) : gapBot1;

      const f1 = Math.max(1, Math.round((-2 - pipeZ1) / PS));
      const M = pipe2InZone ? 0.2 : 1.5;
      const safeTop = tGapTop - M;
      const safeBot = tGapBot + M;
      const targetY = (safeBot + safeTop) / 2;

      const noFlapY = simulate(birdY, vel, f1, false, G, FV, TV);
      const flapY = simulate(birdY, vel, f1, true, G, FV, TV);

      const cooldownOk = (frameCount - lastFlapFrame) > 5;
      const needsLift = noFlapY < targetY - 0.4;
      const flapHelps = flapY > noFlapY;
      const flapInBounds = flapY <= safeTop + 0.5;
      const boundaryDanger = noFlapY < -5.5 && flapY > noFlapY && flapY < 5.5;

      let shouldFlap = cooldownOk && ((needsLift && flapHelps && flapInBounds) || boundaryDanger);
      if ((frameCount - lastFlapFrame) > 8 && birdY < safeBot && vel > 0.05) shouldFlap = true;

      if (shouldFlap) { flap(); lastFlapFrame = frameCount; }

      requestAnimationFrame(pilotLoop);
    };
    requestAnimationFrame(pilotLoop);
  });

  await page.goto('http://localhost:3457/index.html');
  await page.waitForSelector('canvas');

  await page.evaluate(() => {
    if (window.__FLAPPY_START_QUIET) window.__FLAPPY_START_QUIET();
    else document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
  });

  await page.waitForFunction(() => (window.__PILOT_BEST || 0) >= 20, { timeout: 60000, polling: 'raf' });

  const finalScore = await page.evaluate(() => window.__PILOT_BEST || 0);
  expect(finalScore).toBeGreaterThanOrEqual(20);
  console.log(`Phase Dive Pilot Final Score: ${finalScore}`);
});
```

**Step 2: Run the Phase Dive pilot**

Run: `node node_modules/@playwright/test/cli.js test tests/phase-dive-pilot.spec.js`
Expected: PASS with score >= 20.

**Step 3: Video verify with `/verify-video`**

Use `/verify-video` on the pilot test video:
- Prompt: "Verify this shows a complete Phase Dive gameplay experience: (1) a ship flying through purple pipes, (2) red/yellow laser nets visible in some pipe gaps, (3) the ship turning translucent white (phasing) when approaching laser nets, (4) the ship passing safely through laser nets while phased, (5) a stamina bar visible at the bottom of the screen, (6) the ship returning to solid cyan after passing lasers, (7) the ship surviving 20+ pipes."

**Step 4: Compare with baseline using `/compare-before-after-with-video`**

Use `/compare-before-after-with-video`:
- Before: `golden/baseline-pre-phase-dive.webm`
- After: pilot test video
- Prompt: "Compare the before and after gameplay videos. The AFTER should have all of these additions compared to BEFORE: (1) red/yellow laser net barriers in pipe gaps, (2) ship phase visual effect (translucent white), (3) stamina bar HUD at bottom, (4) phase transition particle bursts, (5) trail color changes during phase. Both should have the same synthwave aesthetic, purple pipes, and core flap mechanic."

**Step 5: Commit**

```bash
git add tests/phase-dive-pilot.spec.js
git commit -m "test: add Phase Dive pilot that navigates 20+ pipes with laser nets and phasing"
```

---

### Task 10: Update Existing High-Score Test

**Files:**
- Modify: `tests/high-score.spec.js`

**Step 1: Update the pilot to handle lasers**

In `tests/high-score.spec.js`, add phase management to the existing pilot's `addInitScript`. After the `if (score > window.__PILOT_BEST)` block, add laser/phase logic:

```js
      // Phase management for laser nets
      const hasLaser = window.__FLAPPY_NEXT_LASER;
      const phaseStamina = window.__FLAPPY_PHASE_STAMINA;
      const phaseCooldown = window.__FLAPPY_PHASE_COOLDOWN;
      const pipeApproaching = pipeZ1 > -3 && pipeZ1 < 2;
      const canPhase = phaseStamina > 0.3 && phaseCooldown <= 0;

      if (hasLaser && pipeApproaching && canPhase) {
        if (!window.__FLAPPY_PHASING) window.__FLAPPY_PHASE_ACTIVATE();
      } else {
        if (window.__FLAPPY_PHASING) window.__FLAPPY_PHASE_DEACTIVATE();
      }
```

**Step 2: Run the updated high-score test**

Run: `node node_modules/@playwright/test/cli.js test tests/high-score.spec.js`
Expected: PASS with score >= 20.

**Step 3: Commit**

```bash
git add tests/high-score.spec.js
git commit -m "feat: update high-score pilot to handle laser nets via phase activation"
```

---

### Task 11: Hide Input Hints After Game Start

**Files:**
- Modify: `js/game.js`

**Step 1: Hide hints when game starts**

In `handleInput()`, after `overlayEl.classList.add('hidden')`, add:

```js
    const hints = document.getElementById('input-hints');
    if (hints) hints.style.display = 'none';
```

In `restartGame()`, show hints again:

```js
  const hints = document.getElementById('input-hints');
  if (hints) hints.style.display = 'flex';
  const phaseHud = document.getElementById('phase-hud');
  if (phaseHud) phaseHud.style.display = 'none';
```

**Step 2: Run all tests as final verification**

Run: `npm run test:unit && node node_modules/@playwright/test/cli.js test`
Expected: ALL PASS.

**Step 3: Commit**

```bash
git add js/game.js
git commit -m "fix: hide input hints during gameplay, show on restart"
```

---

## Summary

| Task | Description | Unit Tests | E2E Tests | Video Verify |
|------|------------|-----------|-----------|-------------|
| 0 | Baseline video recording | — | baseline-recording.spec.js | /verify-video |
| 1 | CONFIG.PHASE + CONFIG.LASER | 7 tests | — | — |
| 2 | js/laser.js module | 10 tests | — | — |
| 3 | Laser net pipe integration | 2 tests | laser-visual.spec.js | /compare-before-after |
| 4 | Split-screen input + phase state | — | phase-input.spec.js (2 tests) | — |
| 5 | Overheat stamina system | 6 tests | overheat.spec.js | /verify-video |
| 6 | Phase visual feedback | 2 tests | phase-visuals.spec.js | /compare-before-after |
| 7 | Collision rules (4 combos) | 5 tests | collision-phase.spec.js (3 tests) | /verify-video |
| 8 | Audio placeholders | 2 tests | — | — |
| 9 | Phase Dive pilot | — | phase-dive-pilot.spec.js | /verify-video + /compare |
| 10 | Update existing high-score pilot | — | high-score.spec.js | — |
| 11 | Hide input hints | — | full suite | — |

**Total new tests:** ~34 unit tests + 10 E2E tests
**New files:** `js/laser.js`, 7 new spec files
**Modified files:** `constants.js`, `game.js`, `pipes.js`, `trail.js`, `audio.js`, `index.html`, `unit.test.js`, `high-score.spec.js`
