# BGM Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add `sounds/Neon_Velocity.mp3` as looping background music that starts on first flap, pauses on death, and resumes (from current position) on restart.

**Architecture:** A new `js/audio.js` ES module creates a hidden `<audio>` element and exports `createAudio`, `playBgm`, and `pauseBgm`. `game.js` imports these and calls them at three state transition points.

**Tech Stack:** Vanilla ES Modules, HTML `<audio>` API, Playwright (E2E tests already use `page.evaluate` to inspect game state)

---

### Task 1: Create `js/audio.js`

**Files:**
- Create: `js/audio.js`

**Step 1: Write the file**

```js
export function createAudio() {
  const audio = document.createElement('audio');
  audio.src = 'sounds/Neon_Velocity.mp3';
  audio.loop = true;
  audio.volume = 0.6;
  return audio;
}

export function playBgm(audio) {
  audio.play();
}

export function pauseBgm(audio) {
  audio.pause();
}
```

**Step 2: Verify file exists**

```bash
ls js/audio.js
```
Expected: file listed

**Step 3: Commit**

```bash
git add js/audio.js
git commit -m "feat: add audio.js module for BGM control"
```

---

### Task 2: Wire `audio.js` into `game.js`

**Files:**
- Modify: `js/game.js`

The three edit sites in `game.js`:

**Step 1: Add import at top of file (after existing imports)**

At line ~13, after `import * as THREE from 'three';`, add:

```js
import { createAudio, playBgm, pauseBgm } from './audio.js';
```

**Step 2: Instantiate audio after imports**

After the import block (around line 14, before `// ── Scene setup`), add:

```js
const audio = createAudio();
```

**Step 3: Start BGM on first flap**

In `handleInput()`, the block reads:
```js
  if (!started) {
    started = true;
    lastSpawn = performance.now();
    overlayEl.classList.add('hidden');
  }
```
Change to:
```js
  if (!started) {
    started = true;
    lastSpawn = performance.now();
    overlayEl.classList.add('hidden');
    playBgm(audio);
  }
```

**Step 4: Pause BGM on game over**

In `triggerGameOver()`, after `gameOver = true;`, add:
```js
  pauseBgm(audio);
```

**Step 5: Resume BGM on restart**

In `restartGame()`, at the end of the function (after `prefillPipes(scene);`), add:
```js
  playBgm(audio);
```

**Step 6: Verify the game runs without JS errors**

```bash
node node_modules/http-server/bin/http-server . -p 1124 --cors -c-1 &
# Open browser to http://localhost:1124 and check console — no errors expected
```

**Step 7: Commit**

```bash
git add js/game.js
git commit -m "feat: wire BGM play/pause into game state transitions"
```

---

### Task 3: Smoke-test with Playwright

**Files:**
- No new files — run existing E2E suite to confirm nothing is broken

**Step 1: Run the full E2E test suite**

```bash
node node_modules/@playwright/test/cli.js test
```

Expected: all tests pass (the BGM `audio.play()` call in a headless browser may emit an unhandled promise rejection warning — this is acceptable since headless Chrome blocks autoplay, but it must not crash the game or fail any assertions).

**Step 2: If `audio.play()` rejection causes test failures**

Guard the call in `audio.js`:

```js
export function playBgm(audio) {
  audio.play().catch(() => {});
}
```

Commit the fix:

```bash
git add js/audio.js
git commit -m "fix: swallow autoplay rejection in headless/test environments"
```

**Step 3: Confirm all tests still pass**

```bash
node node_modules/@playwright/test/cli.js test
```

Expected: all tests pass, no regressions.
