# Player Experience Enhancements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Address all known player experience issues from HANDOFF-GEMINI.md: adaptive difficulty, audio integration, mobile touch optimization, pilot startup reliability, and scanline moiré fix.

**Architecture:** Each enhancement is self-contained with minimal blast radius. Adaptive difficulty adds live mutable speed/interval vars to `js/game.js` and new constants to `js/constants.js`. Audio is a new `js/audio.js` module using the Web Audio API (no external libs, no CDN dependencies, no import-map changes needed since it's pure browser API). Mobile touch fix is a one-liner CSS addition + touchstart handler in existing code. Pilot fix is a warm-up guard in `tests/high-score.spec.js`. Scanline fix derives `sCount` from renderer height in `js/postprocessing.js`.

**Tech Stack:** Three.js r128 (ES modules via import map), Web Audio API (native browser, zero deps), Playwright for E2E tests, `node:test` for unit tests

---

## Current State (verified from code)

- `js/game.js:156` — pipes move at fixed `PIPE_SPEED * dt`, no difficulty scaling
- `js/game.js:89` — only `click` listener; no `touchstart`
- `js/game.js:152` — spawn timer uses fixed `SPAWN_MS` constant
- `js/postprocessing.js:68` — `sCount` hardcoded to `400` (fine at 1280px height, too dense at 360px)
- `index.html:5` — viewport meta already correct: `width=device-width, initial-scale=1.0`
- `index.html:84` — overlay says "CLICK OR SPACE TO JACK IN" — no touch-action CSS
- `tests/high-score.spec.js:44-48` — pilot flaps based on physics prediction, no warm-up delay
- `js/constants.js` — no difficulty scaling constants yet
- No `js/audio.js` exists yet

---

### Task 1: Fix Scanline Moiré at Low Resolutions

**Files:**
- Modify: `js/postprocessing.js`

**Context:**
`sCount = 400` means ~400 scanlines across the render height. At 1280px height that's ~3.2px per line — fine. At 360px height (mobile landscape) that's ~0.9px per line — sub-pixel, causes moiré aliasing. Fix: derive count from actual renderer height so lines stay ~3px apart at any resolution.

**Step 1: Apply the fix**

In `js/postprocessing.js`, the `createPostProcessing` function receives `renderer` as its first argument. Replace line 68:

```js
// BEFORE (line 68):
filmPass.uniforms['sCount'].value = 400;       // thicker scanlines

// AFTER:
// ~1 scanline per 3px of render height → crisp at any resolution
const renderH = renderer.getSize(new THREE.Vector2()).y;
filmPass.uniforms['sCount'].value = Math.round(renderH / 3);
```

No other changes needed — the renderer height is already correct at call time.

**Step 2: Run unit tests to confirm no breakage**

```bash
npm run test:unit
```

Expected: all 59 tests pass (this file has no unit test coverage, we're just confirming nothing broke).

**Step 3: Run E2E test and inspect video**

```bash
node node_modules/@playwright/test/cli.js test tests/high-score.spec.js
```

Open `test-results/*/video.webm`. Verify scanlines are visible but not aliased/moiré-patterned.

**Step 4: Commit**

```bash
git add js/postprocessing.js
git commit -m "fix: derive scanline count from render height to prevent moire at low resolutions"
```

---

### Task 2: Fix Pilot Startup Reliability (First-Pipe Frame Stutter)

**Files:**
- Modify: `tests/high-score.spec.js`

**Context:**
On the very first pipe, if the browser JIT is cold, the render loop stutters, `dt` spikes large, and the bird drops faster than the pilot predicts. The pilot's physics model assumes smooth 60fps. Fix: add a 1.5s warm-up phase that uses a simple "keep flapping if falling" survival strategy while the JS engine warms up, then hand off to the predictive pilot.

**Step 1: Add warm-up phase to the pilot**

In `tests/high-score.spec.js`, inside the `addInitScript` callback, the `pilotLoop` function currently checks:

```js
if (started && !isOver && birdY !== undefined && targetY !== undefined && vel !== undefined) {
```

Replace the entire `pilotLoop` function body with:

```js
const pilotLoop = () => {
  if (!window.PILOT_ENABLED) {
    requestAnimationFrame(pilotLoop);
    return;
  }

  const birdY   = window.__FLAPPY_BIRD_Y;
  const targetY = window.__FLAPPY_NEXT_GAP_Y;
  const gapTop  = window.__FLAPPY_NEXT_GAP_TOP;
  const gapBot  = window.__FLAPPY_NEXT_GAP_BOT;
  const vel     = window.__FLAPPY_VELOCITY;
  const isOver  = window.__FLAPPY_OVER;
  const started = window.__FLAPPY_STARTED;

  if (started && !isOver && birdY !== undefined && vel !== undefined) {
    // Warm-up phase: for the first 1500ms after start, just survive with
    // a simple "flap when falling" strategy to let the JS engine warm up.
    if (!window._pilotWarmupStart) window._pilotWarmupStart = performance.now();
    const warmupDone = (performance.now() - window._pilotWarmupStart) > 1500;

    if (!warmupDone) {
      // Simple survival: flap if falling and not too close to the top of gap
      if (vel > 0.05 && birdY > (gapBot + 0.5)) flap();
    } else {
      // Full predictive pilot
      const GRAVITY = 0.007;
      const safeFloor = gapBot + 1.5;
      const peakAfterFlap = birdY + 2.85;
      const shouldFlap = (
        birdY < safeFloor + 0.3 &&
        vel > 0.01 &&
        peakAfterFlap < (gapTop - 0.5)
      );
      if (shouldFlap) flap();
    }
  }

  requestAnimationFrame(pilotLoop);
};
```

**Step 2: Run the pilot test 3 times**

```bash
node node_modules/@playwright/test/cli.js test tests/high-score.spec.js
node node_modules/@playwright/test/cli.js test tests/high-score.spec.js
node node_modules/@playwright/test/cli.js test tests/high-score.spec.js
```

All 3 should reach score >= 5. If any fail on first pipe, extend `1500` to `2000`.

**Step 3: Commit**

```bash
git add tests/high-score.spec.js
git commit -m "fix: add pilot warm-up phase to survive first-pipe frame stutter on cold start"
```

---

### Task 3: Adaptive Difficulty — Speed Scales with Score

**Files:**
- Modify: `js/constants.js`
- Modify: `js/game.js`

**Context:**
Currently `PIPE_SPEED` (0.16) and `SPAWN_MS` (~469ms) are fixed for the whole game. The enhancement: every 5 pipes scored, pipe speed increases by 0.01 and spawn interval tightens proportionally, up to a cap. This keeps the game interesting past score=10.

The spawn interval is currently managed via `setInterval`. To change it dynamically, replace `setInterval` with in-loop scheduling (checking `now - lastSpawn >= liveSpawnMs`), which `game.js` already does at line 152:
```js
if (now - lastSpawn >= SPAWN_MS) { spawnPipe(scene); lastSpawn = now; }
```
So we just need to replace the `SPAWN_MS` reference with a live variable.

**Step 1: Add difficulty constants to js/constants.js**

Append after line 10 (end of file):

```js
// Adaptive difficulty
export const DIFFICULTY_STEP   = 5;    // every N pipes, increase difficulty
export const SPEED_INCREMENT   = 0.01; // added to pipe speed per step
export const MAX_PIPE_SPEED    = 0.35; // hard cap
```

Note: `SPAWN_MS` does not need a `MIN` constant — it naturally decreases as speed increases, and at `MAX_PIPE_SPEED=0.35` with `PIPE_SPACING=4.5`, `SPAWN_MS` floors at ~214ms, which is very challenging but not broken.

**Step 2: Write a failing unit test**

In `tests/unit.test.js`, add to the constants section:

```js
import { DIFFICULTY_STEP, SPEED_INCREMENT, MAX_PIPE_SPEED, PIPE_SPEED } from '../js/constants.js';

test('adaptive difficulty constants are sane', () => {
  assert.ok(DIFFICULTY_STEP > 0);
  assert.ok(SPEED_INCREMENT > 0);
  assert.ok(MAX_PIPE_SPEED > PIPE_SPEED, 'cap must exceed base speed');
});
```

**Step 3: Run to verify it fails**

```bash
npm run test:unit
```

Expected: FAIL — `DIFFICULTY_STEP` not exported.

**Step 4: Add the constants to js/constants.js** (per Step 1)

**Step 5: Run to verify it passes**

```bash
npm run test:unit
```

Expected: all tests pass.

**Step 6: Add live speed vars and scaling logic to js/game.js**

At the top of `game.js`, update the import from `constants.js`:

```js
// BEFORE (line 1):
import { GRAVITY, FLAP, PIPE_SPEED, SPAWN_MS, PIPE_REMOVE_Z } from './constants.js';

// AFTER:
import { GRAVITY, FLAP, PIPE_SPEED, SPAWN_MS, PIPE_REMOVE_Z,
         DIFFICULTY_STEP, SPEED_INCREMENT, MAX_PIPE_SPEED } from './constants.js';
```

In the game state block (around line 33), add live difficulty vars:

```js
// After: let lastSpawn = 0;
let livePipeSpeed = PIPE_SPEED;
let liveSpawnMs   = SPAWN_MS;
```

In `restartGame()` (line 119), reset them:

```js
// After: velocity = 0; score = 0; started = false; gameOver = false; shakeAmp = 0;
livePipeSpeed = PIPE_SPEED;
liveSpawnMs   = SPAWN_MS;
```

In the game loop scoring block (line 158-162), add difficulty scaling after `score++`:

```js
score++;
scoreEl.textContent = score;
// Adaptive difficulty: increase speed every DIFFICULTY_STEP pipes
if (score % DIFFICULTY_STEP === 0) {
  livePipeSpeed = Math.min(livePipeSpeed + SPEED_INCREMENT, MAX_PIPE_SPEED);
  liveSpawnMs   = Math.round(PIPE_SPACING / (livePipeSpeed * 60) * 1000);
}
```

Replace the two places `PIPE_SPEED` and `SPAWN_MS` are used in the loop:

```js
// Line 152 — spawn check:
if (now - lastSpawn >= liveSpawnMs) { spawnPipe(scene); lastSpawn = now; }

// Line 156 — pipe movement:
p.group.position.z += livePipeSpeed * dt;
```

**Step 7: Expose live speed for the test pilot**

After the existing `window.__FLAPPY_SHAKE_AMP` line, add:

```js
window.__FLAPPY_SPEED = livePipeSpeed;
```

**Step 8: Run E2E test**

```bash
node node_modules/@playwright/test/cli.js test tests/high-score.spec.js
```

Expected: score >= 5. In the video, observe pipe approach speed visibly increases around score=5 and 10.

**Step 9: Commit**

```bash
git add js/constants.js js/game.js
git commit -m "feat: adaptive difficulty - pipe speed scales with score every 5 pipes"
```

---

### Task 4: Mobile Touch Optimization

**Files:**
- Modify: `index.html`
- Modify: `js/game.js`

**Context:**
The overlay already exists (`#overlay` covers full viewport). The two issues:
1. No `touch-action: manipulation` on the overlay → browsers add a 300ms tap delay
2. `game.js:89` only listens to `'click'`, not `'touchstart'` → on mobile, touch-to-start has latency

The viewport meta is already correct (`width=device-width, initial-scale=1.0`) at `index.html:5`.

**Step 1: Add touch-action to overlay CSS in index.html**

In the `#overlay` CSS block (lines 31-44), add:

```css
touch-action: manipulation;
-webkit-tap-highlight-color: transparent;
cursor: pointer;
```

**Step 2: Add touchstart listener in js/game.js**

Current line 89:
```js
document.addEventListener('click', () => gameOver ? tryRestart() : handleInput());
```

Replace with:
```js
document.addEventListener('click',      () => gameOver ? tryRestart() : handleInput());
document.addEventListener('touchstart', (e) => { e.preventDefault(); gameOver ? tryRestart() : handleInput(); }, { passive: false });
```

`passive: false` + `e.preventDefault()` prevents the ghost click that would fire 300ms later and double-trigger the input.

**Step 3: Run unit tests**

```bash
npm run test:unit
```

Expected: all passing (no unit test coverage for touch events, just confirming no regressions).

**Step 4: Commit**

```bash
git add index.html js/game.js
git commit -m "fix: mobile touch - add touchstart handler and touch-action CSS to overlay"
```

---

### Task 5: Audio Integration — Synthwave BGM + Death SFX

**Files:**
- Create: `js/audio.js`
- Modify: `js/game.js`

**Context:**
Web Audio API is available in all modern browsers. No CDN or import-map entry needed — it's a pure browser API. Audio must be initialized on the first user gesture (browser policy). The `handleInput()` function in `game.js` is called on first click/tap/space — that's the right place to call `initAudio()` + `startBGM()`. Death sound plays in `triggerGameOver()`. BGM restarts in `restartGame()`.

The BGM uses a repeating sawtooth-wave bass pattern (8 notes at ~120bpm) to create a minimal synthwave loop. No audio files needed.

**Step 1: Write a failing unit test**

In `tests/unit.test.js`, add:

```js
import { initAudio, startBGM, stopBGM, playDeathSound } from '../js/audio.js';

test('audio module exports expected functions', () => {
  assert.strictEqual(typeof initAudio, 'function');
  assert.strictEqual(typeof startBGM, 'function');
  assert.strictEqual(typeof stopBGM, 'function');
  assert.strictEqual(typeof playDeathSound, 'function');
});
```

**Step 2: Run to verify it fails**

```bash
npm run test:unit
```

Expected: FAIL — module not found.

**Step 3: Create js/audio.js**

```js
// js/audio.js — Procedural synthwave BGM and death SFX via Web Audio API

let ctx = null;
let bgmGain = null;
let bgmLoopTimer = null;
let scheduledUntil = 0;

// Synthwave bass line: A minor pentatonic walk at ~120bpm
// Frequencies in Hz: A1, A1, E2, D2, C2, C2, F2, D2
const BASS_NOTES = [55, 55, 82.41, 73.42, 65.41, 65.41, 87.31, 73.42];
const NOTE_DUR   = 0.25; // seconds per note (120bpm = 0.5s/beat, 2 notes/beat)
const LOOP_DUR   = BASS_NOTES.length * NOTE_DUR; // 2 seconds per loop

function scheduleLoop(startTime) {
  BASS_NOTES.forEach((freq, i) => {
    const t = startTime + i * NOTE_DUR;

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = freq;

    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.9, t + 0.02);
    env.gain.exponentialRampToValueAtTime(0.001, t + NOTE_DUR * 0.85);

    osc.connect(env);
    env.connect(bgmGain);
    osc.start(t);
    osc.stop(t + NOTE_DUR);
  });
  scheduledUntil = startTime + LOOP_DUR;
}

export function initAudio() {
  if (ctx) return;
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  bgmGain = ctx.createGain();
  bgmGain.gain.value = 0.15;
  bgmGain.connect(ctx.destination);
}

export function startBGM() {
  if (!ctx || bgmLoopTimer) return;
  const start = ctx.currentTime + 0.05;
  scheduleLoop(start);
  scheduleLoop(start + LOOP_DUR);      // buffer one loop ahead
  // Every loop duration, schedule the next loop
  bgmLoopTimer = setInterval(() => {
    scheduleLoop(scheduledUntil);
  }, LOOP_DUR * 1000 - 50); // fire 50ms before the buffer runs out
}

export function stopBGM() {
  if (bgmLoopTimer) { clearInterval(bgmLoopTimer); bgmLoopTimer = null; }
  // Fade out quickly instead of hard stop (avoids audio click)
  if (bgmGain) {
    bgmGain.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
    // Reset gain for next startBGM call
    setTimeout(() => { if (bgmGain) bgmGain.gain.value = 0.15; }, 500);
  }
}

export function playDeathSound() {
  if (!ctx) return;
  const osc  = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'square';
  // Descending power-down: 440Hz → 55Hz over 0.5s
  osc.frequency.setValueAtTime(440, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(55, ctx.currentTime + 0.5);
  gain.gain.setValueAtTime(0.25, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.55);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.6);
}
```

**Step 4: Run unit test to verify it passes**

```bash
npm run test:unit
```

Expected: all tests pass.

**Step 5: Wire audio into js/game.js**

Add import at top of file (line 1 area):

```js
import { initAudio, startBGM, stopBGM, playDeathSound } from './audio.js';
```

In `handleInput()` (line 51), inside the `if (!started)` block:

```js
// After: overlayEl.classList.add('hidden');
initAudio();
startBGM();
```

In `triggerGameOver()` (line 101), after `gameOver = true`:

```js
playDeathSound();
stopBGM();
```

In `restartGame()` (line 119), after `scoreEl.textContent = '0'`:

```js
// BGM will restart when player clicks to start — no auto-start on restart screen
```

Actually, restart should let the player click to start BGM again via the same `handleInput()` path. No extra call needed since `started` is reset to `false`, so next click will hit `if (!started)` again.

**Step 6: Run E2E test to confirm no regressions**

```bash
node node_modules/@playwright/test/cli.js test tests/high-score.spec.js
```

Expected: score >= 5, no JS errors in console.

**Step 7: Commit**

```bash
git add js/audio.js js/game.js
git commit -m "feat: add procedural synthwave BGM and death SFX via Web Audio API"
```

---

### Task 6: Final Integration Verification

**Step 1: Run full test suite**

```bash
npm run test:unit
node node_modules/@playwright/test/cli.js test tests/high-score.spec.js
```

Expected: 59+ unit tests pass, E2E score >= 5.

**Step 2: Manual checklist (review recorded video)**

Open `test-results/*/video.webm` and verify:
- [ ] Scanlines visible and sharp (no moiré at 720×1280)
- [ ] Pilot survives the first pipe without crashing
- [ ] Pipe approach speed noticeably increases after score=5
- [ ] No JS console errors

**Step 3: Update HANDOFF-GEMINI.md**

Mark resolved items complete:

```markdown
## 📊 Current Status

### ⚠️ Known Issues
- ~~**Pilot Difficulty:**~~ Fixed — warm-up phase added to pilot.
- ~~**Scanline Moire:**~~ Fixed — sCount now derived from render height.

## 🛠️ TODO / Future Work
- [x] **Adaptive Difficulty:** Speed and spacing scale every 5 pipes (capped at 0.35).
- [x] **Audio Integration:** Procedural synthwave BGM + death SFX via Web Audio API.
- [x] **Mobile Touch Optimization:** touchstart handler + touch-action CSS on overlay.
- [ ] **Optimization:** Consider instanced rendering for buildings/pipes at higher city density.
```

**Step 4: Commit**

```bash
git add HANDOFF-GEMINI.md
git commit -m "docs: mark player experience enhancements complete"
```
