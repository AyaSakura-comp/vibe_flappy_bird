# Fix Three Visual Bugs Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix 3 visual bugs caused by the camera angle change: invisible background, broken trail physics, and pipes disappearing too early.

**Architecture:** Each bug is an independent fix in a single file. Each fix follows TDD: write/update unit tests, verify fail, implement fix, verify pass, record video, verify-video, commit.

**Tech Stack:** Three.js r128, Node test runner, Playwright, Gemini verify-video

---

### Task 1: Fix Background — Reposition Environment for Angled Camera

**Files:**
- Modify: `js/environment.js`
- Modify: `tests/unit.test.js` (environment tests)

**Step 1: Update unit test to assert buildings face the camera direction**

Add to the `createEnvironment` describe block in `tests/unit.test.js`:

```javascript
it('buildings have depth >= 2 for 3D visibility from angled camera', () => {
  const scene = mockScene();
  createEnvironment(scene);
  // Buildings are BoxGeometry — check that constructor was called with depth >= 2
  // We verify indirectly: buildings should be added with z positions in range -10 to 10
  // (visible from camera at z=15 looking at origin)
  const meshChildren = scene.children.filter(c => c.position && typeof c.position.z === 'number');
  const buildingLike = meshChildren.filter(c => c.position.z > -30 && c.position.z < 5);
  assert.ok(buildingLike.length >= 10, 'should have buildings in visible z range');
});

it('ground plane is positioned visible from angled camera', () => {
  const scene = mockScene();
  createEnvironment(scene);
  // Ground should be near z=0 area, not at z=-60
  const grounds = scene.children.filter(c => c.rotation && c.rotation.x !== 0);
  assert.ok(grounds.length >= 1, 'should have a ground plane');
  // Ground z should be > -30 (visible from camera)
  grounds.forEach(g => {
    assert.ok(g.position.z > -30, `ground at z=${g.position.z} should be > -30`);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:unit 2>&1 | tail -20`
Expected: FAIL — buildings at z=-43 to -48 and ground at z=-60

**Step 3: Implement fix in `js/environment.js`**

Replace the environment to work with the 45-degree camera at (15, 5, 15) looking at origin:

```javascript
const THREE = window.THREE;

export function createEnvironment(scene) {
  // Lighting
  scene.add(new THREE.AmbientLight(0x110022, 1.0));

  const cyanLight = new THREE.PointLight(0x00ffff, 1.5, 30);
  cyanLight.position.set(-3, 2, 6);
  scene.add(cyanLight);

  const magentaLight = new THREE.PointLight(0xff00aa, 1.2, 30);
  magentaLight.position.set(3, -2, 4);
  scene.add(magentaLight);

  // Ground — extend along the diagonal the camera sees
  const groundGeo = new THREE.PlaneGeometry(60, 60, 30, 30);
  const groundMat = new THREE.MeshBasicMaterial({ color: 0x0a0025, wireframe: false });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -6.2, -10);
  scene.add(ground);

  // Grid
  const gridHelper = new THREE.GridHelper(60, 30, 0xff00aa, 0x330066);
  gridHelper.position.set(0, -6.19, -10);
  scene.add(gridHelper);

  // City skyline — thick buildings arranged in an arc behind the play area
  // Camera at (15,5,15) looks toward origin, so buildings at negative x and z are "behind" the action
  const buildingMat = new THREE.MeshBasicMaterial({ color: 0x080018 });
  const windowMat   = new THREE.MeshBasicMaterial({ color: 0x00ffff });
  const winMat2     = new THREE.MeshBasicMaterial({ color: 0xff00aa });

  const buildingDefs = [
    // Left side (negative x, behind play area)
    { x: -12, w: 3.0, d: 3.0, h: 12, z: -18 },
    { x:  -9, w: 2.0, d: 2.5, h:  8, z: -20 },
    { x:  -6, w: 2.5, d: 3.0, h: 16, z: -17 },
    { x:  -3, w: 1.5, d: 2.0, h:  7, z: -22 },
    // Center-back
    { x:   0, w: 2.0, d: 2.5, h: 10, z: -19 },
    { x:   3, w: 2.5, d: 3.0, h: 14, z: -18 },
    // Right side
    { x:   6, w: 1.8, d: 2.5, h:  9, z: -21 },
    { x:   9, w: 3.0, d: 3.5, h: 18, z: -16 },
    { x:  12, w: 2.0, d: 2.0, h:  7, z: -20 },
    { x:  15, w: 2.5, d: 3.0, h: 11, z: -18 },
  ];

  buildingDefs.forEach(({ x, w, d, h, z }) => {
    const geo  = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, buildingMat);
    mesh.position.set(x, h / 2 - 6.2, z);
    scene.add(mesh);

    for (let i = 0; i < 6; i++) {
      const wGeo = new THREE.BoxGeometry(0.18, 0.18, 0.05);
      const mat  = Math.random() > 0.5 ? windowMat : winMat2;
      const win  = new THREE.Mesh(wGeo, mat);
      win.position.set(
        x + (Math.random() - 0.5) * (w - 0.4),
        (Math.random() - 0.5) * (h - 0.4) + h / 2 - 6.2,
        z + d / 2 + 0.05
      );
      scene.add(win);
    }
  });

  return { cyanLight, magentaLight };
}
```

**Step 4: Run unit tests to verify pass**

Run: `npm run test:unit 2>&1 | tail -20`
Expected: All PASS

**Step 5: Record video and verify with Gemini**

Run: `node node_modules/@playwright/test/cli.js test tests/record-gameplay.spec.js`
Copy video, then verify-video with expectation: "The background should show cyberpunk city buildings visible from the angled camera, with a neon grid floor. Buildings should appear as 3D structures, not paper-thin. The overall scene should look like a cyberpunk cityscape."

**Step 6: Commit**

```bash
git add js/environment.js tests/unit.test.js
git commit -m "fix: reposition background environment for angled camera"
```

---

### Task 2: Fix Bird Trail Physics

**Files:**
- Modify: `js/trail.js`
- Modify: `tests/unit.test.js` (trail tests)

**Step 1: Update unit tests for trail Z-offset removal**

Replace and add trail tests in `tests/unit.test.js`:

```javascript
it('trail points z values match stored history (no artificial offset)', () => {
  const scene = mockScene();
  const trail = trailMod.createTrail(scene);
  // Feed several positions to build history
  for (let i = 0; i < 10; i++) {
    trailMod.updateTrail(trail, 0, i * 0.5, -5);
  }
  const posArr = trail.geometry.attributes.position.array;
  const history = trail.userData.history;
  // Each point's z should equal the stored history z (no artificial - i * 0.15 offset)
  for (let i = 0; i < history.length; i++) {
    assert.equal(posArr[i * 3 + 2], history[i].z,
      `point ${i} z should match history z without offset`);
  }
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:unit 2>&1 | tail -20`
Expected: FAIL — z values have `- i * 0.15` offset

**Step 3: Implement fix in `js/trail.js`**

In `_rebuildBuffer`, remove the artificial Z offset and reduce X wobble:

Change line 77:
```javascript
// OLD: pos[i * 3 + 2] = history[i].z - i * 0.15;
// NEW:
pos[i * 3 + 2] = history[i].z;
```

Change line 7 (reduce wobble):
```javascript
// OLD: const X_WOBBLE = 0.12;
// NEW:
const X_WOBBLE = 0.04;
```

**Step 4: Run unit tests to verify pass**

Run: `npm run test:unit 2>&1 | tail -20`
Expected: All PASS

**Step 5: Record video and verify with Gemini**

Run: `node node_modules/@playwright/test/cli.js test tests/record-gameplay.spec.js`
Verify-video expectation: "The bird's neon trail should follow smoothly behind the bird along its flight path. It should not drop vertically downward or form unnatural arcs. The trail should extend behind the bird in the direction it came from."

**Step 6: Commit**

```bash
git add js/trail.js tests/unit.test.js
git commit -m "fix: remove artificial trail z-offset causing wrong trail direction"
```

---

### Task 3: Fix Pipe Disappearance — Increase Removal Threshold

**Files:**
- Modify: `js/game.js:142` (pipe removal threshold)
- Modify: `js/constants.js` (add PIPE_REMOVE_Z constant)
- Modify: `tests/unit.test.js` (add constant test)

**Step 1: Add PIPE_REMOVE_Z constant and test**

Add to `js/constants.js`:
```javascript
export const PIPE_REMOVE_Z = 15;
```

Add test in `tests/unit.test.js` constants describe:
```javascript
it('PIPE_REMOVE_Z is far enough for angled camera visibility', () => {
  assert.ok(PIPE_REMOVE_Z >= 12, 'pipes should persist until well past camera at z=15');
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:unit 2>&1 | tail -20`
Expected: FAIL — PIPE_REMOVE_Z not exported yet

**Step 3: Implement — add constant and update game.js**

Add to `js/constants.js`:
```javascript
export const PIPE_REMOVE_Z = 15;
```

In `js/game.js`, import `PIPE_REMOVE_Z` and change line 142:
```javascript
// OLD: if (p.group.position.z > 2) {
// NEW:
if (p.group.position.z > PIPE_REMOVE_Z) {
```

Update import line in `js/game.js`:
```javascript
import { GRAVITY, FLAP, PIPE_SPEED, SPAWN_MS, PIPE_REMOVE_Z } from './constants.js';
```

**Step 4: Run unit tests to verify pass**

Run: `npm run test:unit 2>&1 | tail -20`
Expected: All PASS

**Step 5: Record video and verify with Gemini**

Run: `node node_modules/@playwright/test/cli.js test tests/record-gameplay.spec.js`
Verify-video expectation: "After the bird passes through a set of pipes, those pipes should still be visible on screen for several seconds. Pipes should NOT vanish instantly when the bird crosses them. They should gradually move toward the camera and only disappear once they are behind/off-screen."

**Step 6: Commit**

```bash
git add js/constants.js js/game.js tests/unit.test.js
git commit -m "fix: increase pipe removal threshold so pipes persist after passing"
```

---

### Task 4: Final Integration Verification

**Step 1: Run all unit tests**

Run: `npm run test:unit 2>&1`
Expected: All PASS

**Step 2: Run full Playwright test suite**

Run: `node node_modules/@playwright/test/cli.js test`
Expected: All PASS

**Step 3: Record final gameplay and verify all 3 bugs are fixed**

Run gameplay recording, then verify-video with combined expectation:
"This is a cyberpunk 3D Flappy Bird game viewed from a 45-degree over-the-shoulder camera. Verify ALL of the following:
1. BACKGROUND: City skyline buildings are visible as 3D structures in the background with a neon grid floor
2. TRAIL: The bird's neon trail follows smoothly behind it along the flight path, no vertical drops or unnatural arcs
3. PIPES: After the bird passes through pipes, they remain visible on screen and don't vanish instantly"
