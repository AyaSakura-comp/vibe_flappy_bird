# Parallax Background & Visual Polish Implementation Plan

> **For Gemini:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the static background into a dynamic, deep cyberpunk cityscape by adding parallax motion and infinite grid scrolling. Enhance depth with atmospheric fog while strictly adhering to the existing "Cyberpunk" theme and color palette.

**Architecture:**
1. **Atmospheric Depth:** Add `THREE.Fog` to `js/environment.js` using the *exact* existing sky color (`0x1a0044`) to ensure the theme is preserved.
2. **Infinite Grid:** Update `envState` to include `gridHelper` and implement a modulo-based "infinite scroll" in the game loop.
3. **Parallax City:** Move `cityObjects` along the diagonal at a fraction of `PIPE_SPEED` (approx 20%).
4. **Theme Preservation:** Ensure no changes to colors (`0x1a0044`, `0xff00aa`, `0x00ffff`), fonts, or UI elements. Maintain the "Dark Silhouette" building style.
5. **E2E Gameplay Safety:** Verify that fog and motion do not obscure the bird or pipes.

**Tech Stack:** Three.js (r128), ES Modules, Node:test for unit tests, Playwright for visual recording.

---

### Task 1: Add Atmospheric Fog (Theme-Preserving)

**Files:**
- Modify: `js/environment.js`
- Test: `tests/unit.test.js`

**Step 1: Write failing unit test**
Verify fog is added and matches the background color exactly.
```javascript
it('adds fog to the scene matching the sky color exactly (0x1a0044)', () => {
  const scene = mockScene();
  createEnvironment(scene);
  assert.ok(scene.fog, 'scene.fog should be defined');
  assert.equal(scene.fog.color.getHex ? scene.fog.color.getHex() : 0, 0x1a0044);
});
```

**Step 2: Implement Fog**
Modify `createEnvironment` in `js/environment.js` to add `scene.fog = new THREE.Fog(0x1a0044, 20, 80);`.

**Step 3: Run tests to verify they pass**

**Step 4: Play, Record, and Analyze (Visibility Check)**
Confirm the fog doesn't wash out the magenta/cyan pipes or bird. It should only affect distant buildings.
Move video: `find test-results -name "video.webm" -exec cp {} videos/parallax-task1-fog.webm \;`

**Step 5: Commit**

---

### Task 2: Tracking City and Grid in Environment State

**Files:**
- Modify: `js/environment.js`
- Test: `tests/unit.test.js`

**Step 1: Write failing unit test**
Verify `envState` includes `cityObjects` and `gridHelper`.

**Step 2: Implement state tracking**
Ensure `gridHelper` and buildings are pushed to `envState`.

**Step 3: Run tests to verify they pass**

**Step 4: Commit**

---

### Task 3: Parallax and Infinite Scroll Logic

**Files:**
- Modify: `js/environment.js`
- Test: `tests/unit.test.js`

**Step 1: Write failing unit tests for movement**
Verify movement and wrapping logic.

**Step 2: Implement movement and wrapping**
Update `updateEnvironment` in `js/environment.js`. Buildings move at 20% speed; grid scrolls seamlessly.

**Step 3: Run tests to verify they pass**

**Step 4: Play, Record, and Analyze (Clipping Check)**
Ensure no background objects clip into the playable area (stay at Z < -5).
Move video: `find test-results -name "video.webm" -exec cp {} videos/parallax-task3-motion.webm \;`

**Step 5: Commit**

---

### Task 4: Hook into Game Loop

**Files:**
- Modify: `js/game.js`

**Step 1: Connect updateEnvironment to game state**
Pass `started && !gameOver` to the update function.

**Step 2: Play, Record, and Analyze Final Result (E2E Safety)**
Move video: `find test-results -name "video.webm" -exec cp {} videos/parallax-final.webm \;`
**Analyze `@videos/parallax-final.webm`:** 
1. **Theme Check:** Confirm colors and fonts are unchanged.
2. **Playability Check:** Verify the AI bot can still navigate pipes (score >= 3).
3. **Parallax Check:** Confirm buildings and grid move smoothly.

**Step 3: Commit final state**
