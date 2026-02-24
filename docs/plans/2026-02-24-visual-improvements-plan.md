# Visual Improvements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add 5 synthwave/cyberpunk visual enhancements: background gradient, retro sun, enhanced cityscape, digital rain, and parallax wireframes.

**Architecture:** All additions go into `environment.js`. `createEnvironment(scene)` returns `{ cyanLight, magentaLight, envState }`. New export `updateEnvironment(envState, dt)` handles per-frame animation. `game.js` imports and calls `updateEnvironment` each frame.

**Tech Stack:** Three.js r128 (CDN), node:test, Playwright, Gemini verify-video

---

### Task 0: Scaffold — Add envState return and updateEnvironment, wire into game loop

This task changes the API surface so all subsequent tasks can use `envState`.

**Files:**
- Modify: `js/environment.js`
- Modify: `js/game.js`
- Modify: `tests/unit.test.js`

**Step 1: Write failing tests**

Add to the `createEnvironment` describe block in `tests/unit.test.js`:

```javascript
it('returns envState object', () => {
  const scene = mockScene();
  const result = createEnvironment(scene);
  assert.ok(result.envState, 'should return envState');
  assert.equal(typeof result.envState, 'object');
});
```

Add a new describe block after `createEnvironment`:

```javascript
describe('updateEnvironment', () => {
  it('is a function that accepts envState and dt', () => {
    assert.equal(typeof updateEnvironment, 'function');
  });
  it('does not throw with empty envState', () => {
    assert.doesNotThrow(() => updateEnvironment({}, 1));
  });
});
```

Also add the import at the top (near line 128):

```javascript
const { createEnvironment, updateEnvironment } = await import('../js/environment.js');
```

(Replace the existing `createEnvironment` import.)

**Step 2: Run tests to verify failure**

Run: `npm run test:unit 2>&1 | tail -20`
Expected: FAIL — `updateEnvironment` is not exported

**Step 3: Implement scaffold**

In `js/environment.js`, at the end of `createEnvironment`, change:

```javascript
  return { cyanLight, magentaLight };
```
to:
```javascript
  const envState = {};
  return { cyanLight, magentaLight, envState };
```

Add new export after `createEnvironment`:

```javascript
export function updateEnvironment(envState, dt) {
  // animated effects will be added in subsequent tasks
}
```

In `js/game.js`, update import (line 3):

```javascript
import { createEnvironment, updateEnvironment } from './environment.js';
```

Update destructuring (line 25):

```javascript
const { cyanLight, magentaLight, envState } = createEnvironment(scene);
```

Add `updateEnvironment(envState, dt);` call in the loop, right after `updateExplosion(scene, dt);` (after line 158):

```javascript
  updateEnvironment(envState, dt);
```

**Step 4: Run tests**

Run: `npm run test:unit 2>&1 | tail -10`
Expected: All PASS

**Step 5: Commit**

```bash
git add js/environment.js js/game.js tests/unit.test.js
git commit -m "feat: scaffold envState and updateEnvironment for animated background effects"
```

---

### Task 1: Background Gradient

**Files:**
- Modify: `js/environment.js`
- Modify: `js/game.js` (remove `scene.background`)
- Modify: `tests/unit.test.js`

**Step 1: Write failing test**

Add to `createEnvironment` describe block:

```javascript
it('adds a background gradient plane far behind the scene', () => {
  const scene = mockScene();
  createEnvironment(scene);
  // Should have a mesh positioned at z <= -30 for background
  const bgPlanes = scene.children.filter(c =>
    c.position && c.position.z <= -30
  );
  assert.ok(bgPlanes.length >= 1, 'should have a background gradient plane');
});
```

Also add `CanvasTexture` to the THREE mock (after `Color` class, around line 78):

```javascript
CanvasTexture: class {
  constructor(canvas) { this.image = canvas; }
},
```

**Step 2: Run test to verify failure**

Run: `npm run test:unit 2>&1 | tail -20`
Expected: FAIL — no objects at z <= -30

**Step 3: Implement**

In `js/environment.js`, add a gradient background function at the top (after `const THREE = window.THREE;`):

```javascript
function createGradientBackground(scene) {
  // Create a canvas with a radial gradient
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(256, 256, 0, 256, 256, 360);
  gradient.addColorStop(0, '#1a0033');   // deep purple center
  gradient.addColorStop(0.6, '#0a0018'); // dark transition
  gradient.addColorStop(1, '#000005');   // near-black edges
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 512, 512);

  const texture = new THREE.CanvasTexture(canvas);
  const geo = new THREE.PlaneGeometry(120, 80);
  const mat = new THREE.MeshBasicMaterial({ map: texture });
  const plane = new THREE.Mesh(geo, mat);
  plane.position.set(0, 5, -35);
  scene.add(plane);
}
```

Call it at the start of `createEnvironment`, right after adding lights:

```javascript
  createGradientBackground(scene);
```

In `js/game.js`, remove line 13 (`scene.background = new THREE.Color(0x050010);`).

**Step 4: Run tests**

Run: `npm run test:unit 2>&1 | tail -10`
Expected: All PASS

Note: The unit test mock doesn't have `document.createElement`. Add a minimal mock before the THREE mock setup (around line 40):

```javascript
globalThis.document = {
  createElement: (tag) => ({
    width: 0, height: 0,
    getContext: () => ({
      createRadialGradient: () => ({ addColorStop: () => {} }),
      fillRect: () => {},
      fillStyle: null,
    }),
  }),
};
```

**Step 5: Record and verify video**

Run: `node node_modules/@playwright/test/cli.js test tests/record-gameplay.spec.js`
Copy video, then verify-video with expectation: "The background should show a dark purple/blue gradient, NOT solid black. There should be a subtle color transition visible behind the game elements."

**Step 6: Commit**

```bash
git add js/environment.js js/game.js tests/unit.test.js
git commit -m "feat: add radial gradient background for synthwave atmosphere"
```

---

### Task 2: Retro Sun

**Files:**
- Modify: `js/environment.js`
- Modify: `tests/unit.test.js`

**Step 1: Write failing test**

Add `CircleGeometry` to the THREE mock:

```javascript
CircleGeometry: class { constructor() {} },
```

Add to `createEnvironment` describe block:

```javascript
it('adds a retro sun with horizontal slice lines', () => {
  const scene = mockScene();
  createEnvironment(scene);
  // Sun should be a mesh near y=2, z<=-25
  const sunLike = scene.children.filter(c =>
    c.position && c.position.y >= 0 && c.position.y <= 8 && c.position.z <= -25
  );
  // At least 1 sun circle + 5 slice lines = 6 objects
  assert.ok(sunLike.length >= 6, `expected >= 6 sun objects, got ${sunLike.length}`);
});
```

**Step 2: Run test to verify failure**

Run: `npm run test:unit 2>&1 | tail -20`
Expected: FAIL

**Step 3: Implement**

Add function in `js/environment.js`:

```javascript
function createRetroSun(scene) {
  // Main sun disc
  const sunGeo = new THREE.CircleGeometry(8, 32);
  const sunMat = new THREE.MeshBasicMaterial({ color: 0xff6600 });
  const sun = new THREE.Mesh(sunGeo, sunMat);
  sun.position.set(0, 2, -30);
  scene.add(sun);

  // Horizontal slice lines (5 lines cutting through the lower half)
  const sliceMat = new THREE.MeshBasicMaterial({ color: 0x050010 });
  for (let i = 0; i < 5; i++) {
    const sliceHeight = 0.15 + i * 0.12; // lines get thicker toward bottom
    const sliceGeo = new THREE.BoxGeometry(18, sliceHeight, 0.01);
    const slice = new THREE.Mesh(sliceGeo, sliceMat);
    slice.position.set(0, 2 - 1.5 - i * 1.2, -29.9);
    scene.add(slice);
  }
}
```

Call in `createEnvironment` after `createGradientBackground(scene);`:

```javascript
  createRetroSun(scene);
```

**Step 4: Run tests**

Run: `npm run test:unit 2>&1 | tail -10`
Expected: All PASS

**Step 5: Record and verify video**

Run: `node node_modules/@playwright/test/cli.js test tests/record-gameplay.spec.js`
Verify-video: "A large glowing orange/magenta synthwave sun should be visible at the horizon behind the buildings. It should have dark horizontal lines cutting through its lower half."

**Step 6: Commit**

```bash
git add js/environment.js tests/unit.test.js
git commit -m "feat: add retro synthwave sun with horizontal slice lines"
```

---

### Task 3: Enhanced Cityscape

**Files:**
- Modify: `js/environment.js`
- Modify: `tests/unit.test.js`

**Step 1: Write failing test**

Add to `createEnvironment` describe block:

```javascript
it('has a second row of distant buildings at z=-24 to -28', () => {
  const scene = mockScene();
  createEnvironment(scene);
  const distantBuildings = scene.children.filter(c =>
    c.position && c.position.z <= -24 && c.position.z >= -28 &&
    c.position.y > -6 // above ground level, not sun slices
  );
  assert.ok(distantBuildings.length >= 6, `expected >= 6 distant buildings, got ${distantBuildings.length}`);
});
```

**Step 2: Run test to verify failure**

Run: `npm run test:unit 2>&1 | tail -20`
Expected: FAIL — no buildings at z=-24 to -28

**Step 3: Implement**

Add a second row of buildings in `createEnvironment`, after the existing `buildingDefs.forEach(...)` block:

```javascript
  // Distant skyline — taller, darker silhouettes for depth
  const distantBuildingMat = new THREE.MeshBasicMaterial({ color: 0x040010 });
  const distantDefs = [
    { x: -14, w: 4.0, d: 2.0, h: 20, z: -26 },
    { x:  -8, w: 3.0, d: 2.5, h: 14, z: -25 },
    { x:  -3, w: 3.5, d: 2.0, h: 22, z: -27 },
    { x:   2, w: 2.5, d: 2.5, h: 12, z: -26 },
    { x:   7, w: 4.0, d: 2.0, h: 24, z: -25 },
    { x:  13, w: 3.0, d: 2.5, h: 16, z: -27 },
  ];

  distantDefs.forEach(({ x, w, d, h, z }) => {
    const geo  = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, distantBuildingMat);
    mesh.position.set(x, h / 2 - 6.2, z);
    scene.add(mesh);

    // Fewer, dimmer windows on distant buildings
    for (let i = 0; i < 4; i++) {
      const wGeo = new THREE.BoxGeometry(0.15, 0.15, 0.05);
      const win  = new THREE.Mesh(wGeo, windowMat);
      win.position.set(
        x + (Math.random() - 0.5) * (w - 0.4),
        (Math.random() - 0.5) * (h - 0.4) + h / 2 - 6.2,
        z + d / 2 + 0.05
      );
      scene.add(win);
    }
  });
```

**Step 4: Run tests**

Run: `npm run test:unit 2>&1 | tail -10`
Expected: All PASS

Note: The existing test `adds objects to scene (lights, ground, grid, buildings, windows)` checks `>= 74`. With the new objects (6 buildings + 24 windows = 30 more + sun objects), the count will be well above 74, so it still passes.

**Step 5: Record and verify video**

Run: `node node_modules/@playwright/test/cli.js test tests/record-gameplay.spec.js`
Verify-video: "Multiple layers of dark building silhouettes should be visible — a near row with brighter windows and a distant row of taller, darker buildings further back. Both rows should have glowing cyan and magenta windows."

**Step 6: Commit**

```bash
git add js/environment.js tests/unit.test.js
git commit -m "feat: add distant skyline row for depth layering"
```

---

### Task 4: Digital Rain

**Files:**
- Modify: `js/environment.js`
- Modify: `tests/unit.test.js`

**Step 1: Write failing tests**

Add to `createEnvironment` describe block:

```javascript
it('envState.rainDrops has 40-60 particles', () => {
  const scene = mockScene();
  const { envState } = createEnvironment(scene);
  assert.ok(envState.rainDrops, 'should have rainDrops array');
  assert.ok(envState.rainDrops.length >= 40, `expected >= 40 rain drops, got ${envState.rainDrops.length}`);
  assert.ok(envState.rainDrops.length <= 60, `expected <= 60 rain drops, got ${envState.rainDrops.length}`);
});
```

Add to `updateEnvironment` describe block:

```javascript
it('updateEnvironment moves rain drops downward', () => {
  const scene = mockScene();
  const { envState } = createEnvironment(scene);
  const firstDrop = envState.rainDrops[0];
  const startY = firstDrop.mesh.position.y;
  updateEnvironment(envState, 1);
  assert.ok(firstDrop.mesh.position.y < startY, 'rain drop should move down');
});

it('updateEnvironment resets rain drops that fall below ground', () => {
  const scene = mockScene();
  const { envState } = createEnvironment(scene);
  const drop = envState.rainDrops[0];
  drop.mesh.position.y = -10; // below ground
  updateEnvironment(envState, 1);
  assert.ok(drop.mesh.position.y > 0, 'rain drop should reset to top');
});
```

**Step 2: Run test to verify failure**

Run: `npm run test:unit 2>&1 | tail -20`
Expected: FAIL — envState.rainDrops is undefined

**Step 3: Implement**

Add function in `js/environment.js`:

```javascript
function createDigitalRain(scene, envState) {
  const rainDrops = [];
  const rainMat1 = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.6 });
  const rainMat2 = new THREE.MeshBasicMaterial({ color: 0xff00aa, transparent: true, opacity: 0.4 });

  for (let i = 0; i < 50; i++) {
    const geo = new THREE.BoxGeometry(0.06, 0.3 + Math.random() * 0.4, 0.06);
    const mat = Math.random() > 0.3 ? rainMat1 : rainMat2;
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(
      (Math.random() - 0.5) * 30,  // x: spread across scene
      Math.random() * 20 + 5,       // y: start above view
      -15 - Math.random() * 12      // z: far background
    );
    const speed = 0.03 + Math.random() * 0.05;
    scene.add(mesh);
    rainDrops.push({ mesh, speed });
  }

  envState.rainDrops = rainDrops;
}
```

Add rain update logic in `updateEnvironment`:

```javascript
export function updateEnvironment(envState, dt) {
  // Digital rain
  if (envState.rainDrops) {
    for (const drop of envState.rainDrops) {
      drop.mesh.position.y -= drop.speed * dt;
      if (drop.mesh.position.y < -7) {
        drop.mesh.position.y = 15 + Math.random() * 10;
        drop.mesh.position.x = (Math.random() - 0.5) * 30;
      }
    }
  }
}
```

Call in `createEnvironment` before the return:

```javascript
  createDigitalRain(scene, envState);
```

**Step 4: Run tests**

Run: `npm run test:unit 2>&1 | tail -10`
Expected: All PASS

**Step 5: Record and verify video**

Run: `node node_modules/@playwright/test/cli.js test tests/record-gameplay.spec.js`
Verify-video: "Small glowing cyan and magenta particles should be falling downward in the background like digital rain or matrix-style columns. They should be visible behind the buildings and pipes."

**Step 6: Commit**

```bash
git add js/environment.js tests/unit.test.js
git commit -m "feat: add digital rain particle effect in background"
```

---

### Task 5: Parallax Wireframes

**Files:**
- Modify: `js/environment.js`
- Modify: `tests/unit.test.js`

**Step 1: Write failing tests**

Add to the THREE mock:

```javascript
IcosahedronGeometry: class { constructor() {} },
TorusGeometry: class { constructor() {} },
OctahedronGeometry: class { constructor() {} },
```

Add to `createEnvironment` describe block:

```javascript
it('envState.parallaxObjects has 3 wireframe objects', () => {
  const scene = mockScene();
  const { envState } = createEnvironment(scene);
  assert.ok(envState.parallaxObjects, 'should have parallaxObjects array');
  assert.equal(envState.parallaxObjects.length, 3);
});
```

Add to `updateEnvironment` describe block:

```javascript
it('updateEnvironment rotates parallax wireframes', () => {
  const scene = mockScene();
  const { envState } = createEnvironment(scene);
  const obj = envState.parallaxObjects[0];
  const startRotX = obj.mesh.rotation.x;
  const startRotY = obj.mesh.rotation.y;
  updateEnvironment(envState, 1);
  assert.ok(
    obj.mesh.rotation.x !== startRotX || obj.mesh.rotation.y !== startRotY,
    'parallax object should rotate'
  );
});
```

**Step 2: Run test to verify failure**

Run: `npm run test:unit 2>&1 | tail -20`
Expected: FAIL — envState.parallaxObjects is undefined

**Step 3: Implement**

Add function in `js/environment.js`:

```javascript
function createParallaxWireframes(scene, envState) {
  const parallaxObjects = [];

  const defs = [
    { geo: new THREE.IcosahedronGeometry(3, 0), x: -10, y: 6, z: -22, speedX: 0.003, speedY: 0.005 },
    { geo: new THREE.TorusGeometry(2.5, 0.3, 8, 16), x: 8, y: 8, z: -24, speedX: 0.004, speedY: 0.002 },
    { geo: new THREE.OctahedronGeometry(2, 0), x: -2, y: 10, z: -20, speedX: 0.002, speedY: 0.006 },
  ];

  defs.forEach(({ geo, x, y, z, speedX, speedY }) => {
    const mat = new THREE.MeshBasicMaterial({ color: 0x330066, wireframe: true, transparent: true, opacity: 0.3 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    scene.add(mesh);
    parallaxObjects.push({ mesh, speedX, speedY });
  });

  envState.parallaxObjects = parallaxObjects;
}
```

Update `updateEnvironment` to add parallax rotation:

```javascript
export function updateEnvironment(envState, dt) {
  // Digital rain
  if (envState.rainDrops) {
    for (const drop of envState.rainDrops) {
      drop.mesh.position.y -= drop.speed * dt;
      if (drop.mesh.position.y < -7) {
        drop.mesh.position.y = 15 + Math.random() * 10;
        drop.mesh.position.x = (Math.random() - 0.5) * 30;
      }
    }
  }

  // Parallax wireframes
  if (envState.parallaxObjects) {
    for (const obj of envState.parallaxObjects) {
      obj.mesh.rotation.x += obj.speedX * dt;
      obj.mesh.rotation.y += obj.speedY * dt;
    }
  }
}
```

Call in `createEnvironment` before the return:

```javascript
  createParallaxWireframes(scene, envState);
```

**Step 4: Run tests**

Run: `npm run test:unit 2>&1 | tail -10`
Expected: All PASS

**Step 5: Record and verify video**

Run: `node node_modules/@playwright/test/cli.js test tests/record-gameplay.spec.js`
Verify-video: "Large wireframe geometric shapes (like an icosahedron, torus, or octahedron) should be slowly rotating in the far background behind the buildings. They should appear as semi-transparent purple wireframes."

**Step 6: Commit**

```bash
git add js/environment.js tests/unit.test.js
git commit -m "feat: add slowly rotating parallax wireframe shapes in background"
```

---

### Task 6: Final Integration Verification

**Step 1: Run all unit tests**

Run: `npm run test:unit 2>&1`
Expected: All PASS

**Step 2: Run Playwright tests**

Run: `node node_modules/@playwright/test/cli.js test tests/record-gameplay.spec.js tests/collision.spec.js`
Expected: All PASS

**Step 3: Record final gameplay and verify all 5 improvements**

Run gameplay recording, copy video, then verify-video with combined expectation:

"This is a cyberpunk 3D Flappy Bird game viewed from a 45-degree over-the-shoulder camera. Verify ALL of the following visual elements are present:
1. GRADIENT: The background has a dark purple/blue gradient, NOT solid black
2. SUN: A large glowing synthwave sun at the horizon with horizontal lines cutting through its lower half
3. CITYSCAPE: Multiple layers of building silhouettes — a near row and a distant taller row — with neon windows
4. RAIN: Small glowing cyan/magenta particles falling in the background like digital rain
5. WIREFRAMES: Large wireframe geometric shapes slowly rotating in the far background

Give a verdict for EACH: PASS or FAIL."
