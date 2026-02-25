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

**Step 6: Run E2E tests to verify no regressions**

```bash
node node_modules/@playwright/test/cli.js test
```

Expected: all tests pass (the BGM `audio.play()` call in a headless browser may emit an unhandled promise rejection warning — this is acceptable since headless Chrome blocks autoplay, but it must not crash the game or fail any assertions).

**Step 7: If `audio.play()` rejection causes test failures**

Guard the call in `audio.js`:

```js
export function playBgm(audio) {
  audio.play().catch(() => {});
}
```

Edit `js/audio.js` to add the `.catch()` guard and re-run tests:

```bash
node node_modules/@playwright/test/cli.js test
```

Expected: all tests pass.

**Step 8: Record gameplay video with `record-gameplay.spec.js`**

```bash
node node_modules/@playwright/test/cli.js test tests/record-gameplay.spec.js
```

This will generate a video in `test-results/` showing the game with BGM playing.

**Step 9: Verify the video with `/verify-video`**

Use the verify-video skill to check the recording:
- Confirm game starts normally (UI shows "CYBER FLAP")
- Confirm bird flaps on click/space and game begins
- Confirm "SYSTEM FAILURE" overlay appears on death
- Check audio context (should show audio element is playing, no console errors)

Once video verification passes, proceed to commit.

**Step 10: Commit only after verification**

```bash
git add js/game.js
git commit -m "feat: wire BGM play/pause into game state transitions"
```

---

### Task 3: Verify game behavior end-to-end

**Files:**
- No new files — run the existing `high-score.spec.js` E2E test to confirm BGM doesn't break AI gameplay

**Step 1: Run high-score test**

```bash
node node_modules/@playwright/test/cli.js test tests/high-score.spec.js
```

Expected: test passes and records a video.

**Step 2: Verify high-score video with `/verify-video`**

Use the verify-video skill to confirm:
- Game starts and BGM begins playing
- Bird navigates pipes correctly
- BGM continues playing throughout (no stutters/pauses)
- Game Over state shown at end

**Step 3: Final verification — all tests pass**

```bash
node node_modules/@playwright/test/cli.js test
```

Expected: all tests pass, no regressions, BGM integrates cleanly.
