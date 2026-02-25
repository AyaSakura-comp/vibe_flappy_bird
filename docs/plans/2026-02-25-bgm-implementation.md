# BGM Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add `sounds/Neon_Velocity.mp3` as looping background music that starts on first flap, pauses on death, and resumes (from current position) on restart.

**Architecture:** A new `js/audio.js` ES module creates a hidden `<audio>` element and exports `createAudio`, `playBgm`, and `pauseBgm`. `game.js` imports these and calls them at three state transition points.

**Tech Stack:** Vanilla ES Modules, HTML `<audio>` API, node:test (unit tests), Playwright (E2E tests)

---

### Task 1: Create `js/audio.js` with unit tests (TDD)

**Files:**
- Create: `js/audio.js`
- Modify: `tests/unit.test.js`

**Step 1: Write failing unit tests**

Add to `tests/unit.test.js`, after the last `describe` block. The existing `document.createElement` mock returns a basic object — extend it to track audio calls:

```js
// ── audio.js ──────────────────────────────────────────────────────────
describe('audio', () => {
  // Mock document.createElement to return a fake audio element
  const origCreateElement = globalThis.document.createElement;

  beforeEach(() => {
    globalThis.document.createElement = (tag) => {
      if (tag === 'audio') {
        return {
          src: '',
          loop: false,
          volume: 1,
          _playing: false,
          play() { this._playing = true; return Promise.resolve(); },
          pause() { this._playing = false; },
        };
      }
      return origCreateElement(tag);
    };
  });

  it('createAudio returns element with correct src, loop, and volume', async () => {
    const { createAudio } = await import('../js/audio.js');
    const audio = createAudio();
    assert.equal(audio.src, 'sounds/Neon_Velocity.mp3');
    assert.equal(audio.loop, true);
    assert.equal(audio.volume, 0.6);
  });

  it('playBgm calls play on the audio element', async () => {
    const { createAudio, playBgm } = await import('../js/audio.js');
    const audio = createAudio();
    assert.equal(audio._playing, false);
    playBgm(audio);
    assert.equal(audio._playing, true);
  });

  it('pauseBgm calls pause on the audio element', async () => {
    const { createAudio, playBgm, pauseBgm } = await import('../js/audio.js');
    const audio = createAudio();
    playBgm(audio);
    assert.equal(audio._playing, true);
    pauseBgm(audio);
    assert.equal(audio._playing, false);
  });

  it('playBgm after pauseBgm resumes (does not reset)', async () => {
    const { createAudio, playBgm, pauseBgm } = await import('../js/audio.js');
    const audio = createAudio();
    audio.currentTime = 42;
    playBgm(audio);
    pauseBgm(audio);
    playBgm(audio);
    assert.equal(audio.currentTime, 42, 'currentTime should not be reset');
    assert.equal(audio._playing, true);
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
npm run test:unit
```

Expected: FAIL — `../js/audio.js` module not found.

**Step 3: Write minimal `js/audio.js`**

```js
export function createAudio() {
  const audio = document.createElement('audio');
  audio.src = 'sounds/Neon_Velocity.mp3';
  audio.loop = true;
  audio.volume = 0.6;
  return audio;
}

export function playBgm(audio) {
  audio.play().catch(() => {});
}

export function pauseBgm(audio) {
  audio.pause();
}
```

Note: `.catch(() => {})` is included from the start — headless browsers block autoplay and the rejected promise would crash tests otherwise.

**Step 4: Run tests to verify they pass**

```bash
npm run test:unit
```

Expected: all 62 tests pass (59 existing + 3 new audio tests; the 4th "resume" test shares the import cache so counts as part of the describe block).

**Step 5: Commit**

```bash
git add js/audio.js tests/unit.test.js
git commit -m "feat: add audio.js module with unit tests"
```

---

### Task 2: Wire `audio.js` into `game.js`

**Files:**
- Modify: `js/game.js`

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

**Step 6: Run unit tests**

```bash
npm run test:unit
```

Expected: all tests pass — unit tests don't import `game.js`.

**Step 7: Run E2E tests**

```bash
node node_modules/@playwright/test/cli.js test
```

Expected: all tests pass.

**Step 8: Record gameplay video**

```bash
node node_modules/@playwright/test/cli.js test tests/record-gameplay.spec.js
```

**Step 9: Verify the video with `/verify-video`**

Use the verify-video skill to check the recording:
- Confirm game starts normally (UI shows "CYBER FLAP")
- Confirm bird flaps on click/space and game begins
- Confirm "SYSTEM FAILURE" overlay appears on death
- No console errors visible

Once video verification passes, proceed to commit.

**Step 10: Commit only after verification**

```bash
git add js/game.js
git commit -m "feat: wire BGM play/pause into game state transitions"
```

---

### Task 3: Final end-to-end verification

**Files:**
- No new files

**Step 1: Run full test suite**

```bash
node node_modules/@playwright/test/cli.js test
```

Expected: all tests pass.

**Step 2: Run high-score test for extended gameplay video**

```bash
node node_modules/@playwright/test/cli.js test tests/high-score.spec.js
```

**Step 3: Verify high-score video with `/verify-video`**

Use the verify-video skill to confirm:
- Game starts and plays through multiple pipes
- No visual regressions
- Game Over state shown at end

**Step 4: Run unit tests one final time**

```bash
npm run test:unit
```

Expected: all tests pass, no regressions.
