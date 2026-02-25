# Synthwave Visual Overhaul — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the game's visuals from a dark prototype into a full synthwave aesthetic with glowing buildings, bloom post-processing, and retro CRT effects.

**Architecture:** Four-phase approach — (1) replace building geometry with beveled skyscrapers + add wireframe mountains, (2) overhaul materials to dark-reflective base + emissive glow masks, (3) rework lighting to fake retro-future look with scrolling grid shader, (4) add bloom/vignette/film-grain post-processing via Three.js r128 examples modules from unpkg CDN.

**Tech Stack:** Three.js r128 (CDN), ES modules, unpkg CDN for post-processing (`EffectComposer`, `RenderPass`, `UnrealBloomPass`, `ShaderPass`). No bundler. Import map in `index.html` maps `'three'` → cdnjs r128 module build.

---

## Visual Verification Protocol

**Every task** follows this before/after workflow to catch regressions and confirm visual changes:

### Before making any code changes:
```bash
# Record the BEFORE video using the high-score test (see CLAUDE.md for details)
node node_modules/@playwright/test/cli.js test tests/high-score.spec.js
cp test-results/high-score-Record-high-score-gameplay-navigate-5-pipes/video.webm videos/task-N-before.webm
```

### After implementation + unit tests pass:
```bash
# Record the AFTER video
node node_modules/@playwright/test/cli.js test tests/high-score.spec.js
cp test-results/high-score-Record-high-score-gameplay-navigate-5-pipes/video.webm videos/task-N-after.webm
```

### Compare and verify:
1. Use `/compare-before-after-with-video` to compare `videos/task-N-before.webm` vs `videos/task-N-after.webm` — describe what specific visual change this task should introduce
2. If the comparison shows unexpected regressions (gameplay broken, elements missing), fix before committing
3. Optionally use `/verify-video` on the AFTER video if you need to check specific visual criteria
4. **Only commit after confirming the changes match expectations**

---

## Critical Constraint: CDN + No Bundler

Three.js r128's post-processing JSM modules (on unpkg) use `import ... from 'three'`. Our project loads Three.js via a `<script>` tag. To make both work:

1. Switch `index.html` to use an **import map** pointing `'three'` to the unpkg r128 ES module build
2. Load post-processing modules from `unpkg.com/three@0.128.0/examples/jsm/...`
3. Keep `game.js` as `<script type="module">` (already is)
4. Remove the old `<script src="...three.min.js">` tag — the import map replaces it
5. Every JS file that uses `window.THREE` must switch to `import * as THREE from 'three'`

### Verified CDN URLs (all confirmed to exist):
- `https://unpkg.com/three@0.128.0/build/three.module.js` — core
- `https://unpkg.com/three@0.128.0/examples/jsm/postprocessing/EffectComposer.js`
- `https://unpkg.com/three@0.128.0/examples/jsm/postprocessing/RenderPass.js`
- `https://unpkg.com/three@0.128.0/examples/jsm/postprocessing/UnrealBloomPass.js`
- `https://unpkg.com/three@0.128.0/examples/jsm/postprocessing/ShaderPass.js`
- `https://unpkg.com/three@0.128.0/examples/jsm/shaders/FilmShader.js` (grain + scanlines)
- `https://unpkg.com/three@0.128.0/examples/jsm/shaders/VignetteShader.js`
- `https://unpkg.com/three@0.128.0/examples/jsm/shaders/CopyShader.js` (required by EffectComposer)

---

## Phase 1: Geometry & Asset Replacement

### Task 1: Add import map and migrate Three.js imports

**Files:**
- Modify: `index.html` (replace script tag with import map)
- Modify: `js/game.js`, `js/environment.js`, `js/bird.js`, `js/pipes.js`, `js/explosion.js`, `js/trail.js`, `js/constants.js` (import change)
- Test: `tests/unit.test.js` (no change needed — unit tests mock THREE)

**Step 1: Record BEFORE video**

```bash
node node_modules/@playwright/test/cli.js test tests/high-score.spec.js
cp test-results/high-score-Record-high-score-gameplay-navigate-5-pipes/video.webm videos/task1-before.webm
```

**Step 2: Update `index.html`**

Replace the `<script src="...three.min.js">` with:

```html
<script type="importmap">
{
  "imports": {
    "three": "https://unpkg.com/three@0.128.0/build/three.module.js"
  }
}
</script>
```

Keep `<script type="module" src="js/game.js">` as-is.

**Step 3: Update all JS files**

In every `js/*.js` file, replace:
```js
const THREE = window.THREE;
```
with:
```js
import * as THREE from 'three';
```

In `js/constants.js`, remove the `const THREE = window.THREE;` line entirely (it doesn't use THREE).

**Step 4: Run unit tests**

Run: `npm run test:unit`
Expected: All 53 tests pass (unit tests use their own mock, unaffected).

**Step 5: Record AFTER video and compare**

```bash
node node_modules/@playwright/test/cli.js test tests/high-score.spec.js
cp test-results/high-score-Record-high-score-gameplay-navigate-5-pipes/video.webm videos/task1-after.webm
```

Use `/compare-before-after-with-video` on `videos/task1-before.webm` vs `videos/task1-after.webm`:
- Expected: **No visual difference** — this is a pure refactor. Gameplay, colors, buildings, sun, everything should look identical.
- If comparison shows differences, something broke in the import migration.

**Step 6: Commit (only after comparison confirms no regressions)**

```bash
git add index.html js/*.js
git commit -m "refactor: migrate Three.js from CDN script tag to import map"
```

---

### Task 2: Replace building primitives with beveled skyscrapers

**Files:**
- Modify: `js/environment.js` — rewrite building creation functions
- Test: `tests/unit.test.js` — update building tests

**Step 1: Record BEFORE video**

```bash
node node_modules/@playwright/test/cli.js test tests/high-score.spec.js
cp test-results/high-score-Record-high-score-gameplay-navigate-5-pipes/video.webm videos/task2-before.webm
```

**Step 2: Write failing test**

Add test in `tests/unit.test.js` under the environment `describe`:

```js
it('near skyline buildings use BoxGeometry with bevel-like edge meshes', () => {
  const scene = mockScene();
  createEnvironment(scene);
  // Buildings should have edge highlight children (emissive line meshes)
  const buildingGroups = scene.children.filter(c =>
    c.children && c.children.length >= 2 && c.position && c.position.y > -6
  );
  assert.ok(buildingGroups.length >= 5, `expected >= 5 beveled building groups, got ${buildingGroups.length}`);
});
```

**Step 3: Run test to verify it fails**

Run: `npm run test:unit`
Expected: FAIL — current buildings are plain meshes, not groups with edge children.

**Step 4: Implement beveled buildings**

In `js/environment.js`, create a helper function `createBuilding(w, d, h, mat, edgeMat)` that:
1. Creates a `THREE.Group`
2. Adds a `BoxGeometry(w, h, d)` main body mesh
3. Adds thin `BoxGeometry` edge highlights on the 4 vertical corners (width: 0.06, full height, depth: 0.06) using emissive `edgeMat`
4. Returns the group

Replace `buildingDefs.forEach(...)` to use this helper. Building positions remain the same (along x≈z diagonal). Use:
- Body: `MeshStandardMaterial({ color: 0x080015, metalness: 0.7, roughness: 0.3 })` (dark reflective)
- Edges: `MeshBasicMaterial({ color: 0x00ffff })` for near row, `MeshBasicMaterial({ color: 0xff00aa })` alternating

Window meshes stay as-is but increase count to 6 per building and make them slightly larger (0.2 x 0.2).

**Step 5: Run test to verify it passes**

Run: `npm run test:unit`
Expected: PASS

**Step 6: Record AFTER video and compare**

```bash
node node_modules/@playwright/test/cli.js test tests/high-score.spec.js
cp test-results/high-score-Record-high-score-gameplay-navigate-5-pipes/video.webm videos/task2-after.webm
```

Use `/compare-before-after-with-video` on `videos/task2-before.webm` vs `videos/task2-after.webm`:
- Expected changes: Buildings should now have **visible glowing cyan/magenta edge lines** (bevels) on their vertical corners. Building bodies should appear darker and more reflective.
- No regressions: Gameplay still works (score >= 5), sun still visible, grid still present, pipes unchanged.

**Step 7: Commit (only after comparison confirms expected changes)**

```bash
git add js/environment.js tests/unit.test.js
git commit -m "feat: replace building primitives with beveled skyscrapers"
```

---

### Task 3: Add wireframe mountain parallax layer

**Files:**
- Modify: `js/environment.js` — add `createWireframeMountains(scene)`
- Test: `tests/unit.test.js`

**Step 1: Record BEFORE video**

```bash
node node_modules/@playwright/test/cli.js test tests/high-score.spec.js
cp test-results/high-score-Record-high-score-gameplay-navigate-5-pipes/video.webm videos/task3-before.webm
```

**Step 2: Write failing test**

```js
it('has wireframe mountain meshes behind the skyline', () => {
  const scene = mockScene();
  createEnvironment(scene);
  // Mountains: wireframe meshes at depth > buildings, y near ground
  const mountains = scene.children.filter(c =>
    c.material && c.material.wireframe === true &&
    c.position && c.position.y < 0 && c.position.y > -7
  );
  assert.ok(mountains.length >= 3, `expected >= 3 wireframe mountains, got ${mountains.length}`);
});
```

**Step 3: Run test — expect FAIL**

**Step 4: Implement**

Create `createWireframeMountains(scene)`:
- Use `ConeGeometry(radius, height, segments)` for 5 mountain peaks
- Position them behind the far skyline (depth ~55-65, along x≈z diagonal)
- Use `MeshBasicMaterial({ color: 0x220044, wireframe: true })`
- Vary heights (3-8 units), radii (4-8 units), segments (4-6) for low-poly look
- Place at y = -6.2 (ground level) so they rise from the horizon

Call from `createEnvironment` after building creation.

**Step 5: Run test — expect PASS**

**Step 6: Record AFTER video and compare**

```bash
node node_modules/@playwright/test/cli.js test tests/high-score.spec.js
cp test-results/high-score-Record-high-score-gameplay-navigate-5-pipes/video.webm videos/task3-after.webm
```

Use `/compare-before-after-with-video` on `videos/task3-before.webm` vs `videos/task3-after.webm`:
- Expected changes: **Wireframe mountain/cone shapes visible in the far background** behind the skyline buildings, near the horizon. Dark purple wireframe color.
- No regressions: Buildings, sun, grid, gameplay all unchanged.

**Step 7: Commit**

```bash
git add js/environment.js tests/unit.test.js
git commit -m "feat: add wireframe mountain parallax layer behind skyline"
```

---

## Phase 2: Material & Shader Overhaul

### Task 4: Dark reflective building base + emissive window grids

**Files:**
- Modify: `js/environment.js`
- Test: `tests/unit.test.js`

**Step 1: Record BEFORE video**

```bash
node node_modules/@playwright/test/cli.js test tests/high-score.spec.js
cp test-results/high-score-Record-high-score-gameplay-navigate-5-pipes/video.webm videos/task4-before.webm
```

**Step 2: Write failing test**

```js
it('building body uses MeshStandardMaterial with metalness', () => {
  const scene = mockScene();
  createEnvironment(scene);
  const stdMats = scene.children.filter(c =>
    c.material && c.material.metalness !== undefined && c.material.metalness >= 0.5
  );
  assert.ok(stdMats.length >= 5, `expected >= 5 metallic meshes, got ${stdMats.length}`);
});
```

**Step 3: Run test — expect FAIL**

Current buildings use `MeshLambertMaterial` / `MeshBasicMaterial`, no `metalness` property.

**Step 4: Implement**

Update building materials in `createBuilding()`:
- Body: `MeshStandardMaterial({ color: 0x080015, metalness: 0.7, roughness: 0.3, envMapIntensity: 0.3 })`
- Windows: Keep `MeshBasicMaterial` but enforce pure neon colors:
  - Cyan windows: `{ color: 0x00ffff }` (pure emissive look)
  - Magenta windows: `{ color: 0xff00ff }` (pure hot pink)
- Window grid: Instead of random scatter, place windows in a grid pattern on building faces (every 0.5 units vertically, 0.4 units horizontally)

**Step 5: Run test — expect PASS**

**Step 6: Record AFTER video and compare**

```bash
node node_modules/@playwright/test/cli.js test tests/high-score.spec.js
cp test-results/high-score-Record-high-score-gameplay-navigate-5-pipes/video.webm videos/task4-after.webm
```

Use `/compare-before-after-with-video` on `videos/task4-before.webm` vs `videos/task4-after.webm`:
- Expected changes: Building bodies appear **darker, sleeker, more reflective**. Windows are arranged in a **regular grid pattern** instead of random scatter. Window colors are pure **cyan (#00FFFF) and hot pink (#FF00FF)**.
- No regressions: Building positions/sizes unchanged, gameplay works, score >= 5.

**Step 7: Commit**

```bash
git add js/environment.js tests/unit.test.js
git commit -m "feat: dark reflective building material with grid windows"
```

---

### Task 5: Enforce strict neon color palette

**Files:**
- Modify: `js/environment.js` — standardize all emissive colors
- Modify: `js/pipes.js` — update pipe colors
- Test: `tests/unit.test.js`

**Step 1: Record BEFORE video**

```bash
node node_modules/@playwright/test/cli.js test tests/high-score.spec.js
cp test-results/high-score-Record-high-score-gameplay-navigate-5-pipes/video.webm videos/task5-before.webm
```

**Step 2: Write failing test**

```js
it('emissive elements use pure cyan 0x00ffff or hot pink 0xff00ff', () => {
  const scene = mockScene();
  createEnvironment(scene);
  const emissiveColors = scene.children
    .filter(c => c.material && c.material.color)
    .map(c => c.material.color)
    .filter(c => c === 0x00ffff || c === 0xff00ff || c === 0xff00aa || c === 0x00ffff);
  assert.ok(emissiveColors.length >= 4, 'expected neon-colored emissive meshes');
});
```

**Step 3: Run test — expect FAIL or refine**

**Step 4: Implement**

Audit and replace all accent colors:
- `0xff00aa` → `0xff00ff` (pure hot pink everywhere)
- Keep `0x00ffff` as-is (already pure cyan)
- Pipe caps: `0xff00ff` instead of `0xff00aa`
- Pipe inner rings: keep `0x00ffff`
- Grid helper: `new THREE.GridHelper(60, 30, 0xff00ff, 0x330066)`

**Step 5: Run test — expect PASS**

**Step 6: Record AFTER video and compare**

```bash
node node_modules/@playwright/test/cli.js test tests/high-score.spec.js
cp test-results/high-score-Record-high-score-gameplay-navigate-5-pipes/video.webm videos/task5-after.webm
```

Use `/compare-before-after-with-video` on `videos/task5-before.webm` vs `videos/task5-after.webm`:
- Expected changes: Pink/magenta elements should shift slightly from `#FF00AA` to pure **`#FF00FF`** (hotter pink). Subtle color difference — pipe caps and accent elements should appear slightly more magenta/blue-shifted.
- No regressions: Gameplay, layout, all elements still present.

**Step 7: Commit**

```bash
git add js/environment.js js/pipes.js tests/unit.test.js
git commit -m "feat: enforce strict cyan/magenta neon color palette"
```

---

## Phase 3: Lighting & Environment

### Task 6: Darken ambient + remove directional light

**Files:**
- Modify: `js/environment.js`
- Test: `tests/unit.test.js`

**Step 1: Record BEFORE video**

```bash
node node_modules/@playwright/test/cli.js test tests/high-score.spec.js
cp test-results/high-score-Record-high-score-gameplay-navigate-5-pipes/video.webm videos/task6-before.webm
```

**Step 2: Write failing test**

```js
it('ambient light is dark murky purple, no directional light', () => {
  const scene = mockScene();
  createEnvironment(scene);
  const ambients = scene.children.filter(c => c._type === 'AmbientLight');
  assert.ok(ambients.length >= 1, 'should have ambient light');
  const dirs = scene.children.filter(c => c._type === 'DirectionalLight');
  assert.equal(dirs.length, 0, 'should have no directional lights');
});
```

Note: The mock THREE classes need a `_type` tag. Update the mock `DirectionalLight` and `AmbientLight` constructors to set `_type`.

**Step 3: Run test — expect FAIL**

Current code adds a `DirectionalLight`.

**Step 4: Implement**

In `createEnvironment(scene)`:
- Change ambient: `new THREE.AmbientLight(0x0a0015, 0.6)` — darker, more purple
- Remove the `dirLight` entirely
- Keep the two point lights (cyan + magenta) — these provide the neon glow on nearby objects
- Optionally add a dim `HemisphereLight(0x0a0015, 0x000005, 0.3)` for subtle ground-sky gradient

**Step 5: Run test — expect PASS**

**Step 6: Record AFTER video and compare**

```bash
node node_modules/@playwright/test/cli.js test tests/high-score.spec.js
cp test-results/high-score-Record-high-score-gameplay-navigate-5-pipes/video.webm videos/task6-after.webm
```

Use `/compare-before-after-with-video` on `videos/task6-before.webm` vs `videos/task6-after.webm`:
- Expected changes: Scene should look **darker overall**. Buildings lit only by point lights (cyan/magenta), no even directional illumination. More dramatic shadows and contrast. Buildings that are far from point lights appear as near-silhouettes.
- No regressions: Gameplay works, all elements still visible (though darker), score >= 5.

**Step 7: Commit**

```bash
git add js/environment.js tests/unit.test.js
git commit -m "feat: darken ambient light and remove directional light"
```

---

### Task 7: Scrolling neon grid floor shader

**Files:**
- Modify: `js/environment.js` — replace GridHelper with ShaderMaterial plane
- Test: `tests/unit.test.js`

**Step 1: Record BEFORE video**

```bash
node node_modules/@playwright/test/cli.js test tests/high-score.spec.js
cp test-results/high-score-Record-high-score-gameplay-navigate-5-pipes/video.webm videos/task7-before.webm
```

**Step 2: Write failing test**

```js
it('ground uses ShaderMaterial with scrollable UV offset', () => {
  const scene = mockScene();
  const { envState } = createEnvironment(scene);
  assert.ok(envState.gridMaterial, 'envState should expose gridMaterial');
  assert.ok(envState.gridMaterial.uniforms, 'grid material should have uniforms');
  assert.ok(envState.gridMaterial.uniforms.uOffset, 'grid should have uOffset uniform');
});
```

**Step 3: Run test — expect FAIL**

**Step 4: Implement**

Replace the `GridHelper` + `ground` mesh with a single `PlaneGeometry(60, 60)` using a custom `ShaderMaterial`:

```js
const gridMaterial = new THREE.ShaderMaterial({
  uniforms: {
    uOffset: { value: 0.0 },
    uColor1: { value: new THREE.Color(0xff00ff) },
    uColor2: { value: new THREE.Color(0x00ffff) },
    uBgColor: { value: new THREE.Color(0x0a0025) },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform float uOffset;
    uniform vec3 uColor1;
    uniform vec3 uColor2;
    uniform vec3 uBgColor;
    varying vec2 vUv;
    void main() {
      vec2 uv = vUv * 30.0;
      uv.y += uOffset;
      vec2 grid = abs(fract(uv - 0.5) - 0.5) / fwidth(uv);
      float line = min(grid.x, grid.y);
      float mask = 1.0 - min(line, 1.0);
      vec2 cell = floor(uv);
      float checker = mod(cell.x + cell.y, 2.0);
      vec3 lineColor = mix(uColor1, uColor2, checker * 0.3);
      vec3 color = mix(uBgColor, lineColor, mask * 0.7);
      float fade = smoothstep(0.0, 0.4, vUv.y);
      color = mix(uBgColor, color, fade);
      gl_FragColor = vec4(color, 1.0);
    }
  `,
  side: THREE.DoubleSide,
});
```

Store `gridMaterial` in `envState`. In `updateEnvironment`, scroll it:
```js
if (envState.gridMaterial && isMoving) {
  envState.gridMaterial.uniforms.uOffset.value += 0.025 * dt;
}
```

Remove old `gridHelper` scroll logic.

**Step 5: Run test — expect PASS**

**Step 6: Record AFTER video and compare**

```bash
node node_modules/@playwright/test/cli.js test tests/high-score.spec.js
cp test-results/high-score-Record-high-score-gameplay-navigate-5-pipes/video.webm videos/task7-after.webm
```

Use `/compare-before-after-with-video` on `videos/task7-before.webm` vs `videos/task7-after.webm`:
- Expected changes: Ground floor now has a **glowing neon pink/cyan perspective grid** that **scrolls toward the camera** during gameplay. Lines should appear to glow. Grid fades with distance.
- No regressions: Buildings, sun, pipes all still present. Gameplay works, score >= 5.

**Step 7: Commit**

```bash
git add js/environment.js tests/unit.test.js
git commit -m "feat: scrolling neon grid floor shader"
```

---

## Phase 4: Post-Processing Stack

### Task 8: Set up EffectComposer with bloom

**Files:**
- Modify: `index.html` — add import map entries for postprocessing modules
- Create: `js/postprocessing.js` — new module that creates and exports the composer
- Modify: `js/game.js` — use `composer.render()` instead of `renderer.render()`

**Step 1: Record BEFORE video**

```bash
node node_modules/@playwright/test/cli.js test tests/high-score.spec.js
cp test-results/high-score-Record-high-score-gameplay-navigate-5-pipes/video.webm videos/task8-before.webm
```

**Step 2: Update import map in `index.html`**

Add to the import map:
```json
{
  "imports": {
    "three": "https://unpkg.com/three@0.128.0/build/three.module.js",
    "three/examples/jsm/postprocessing/EffectComposer.js": "https://unpkg.com/three@0.128.0/examples/jsm/postprocessing/EffectComposer.js",
    "three/examples/jsm/postprocessing/RenderPass.js": "https://unpkg.com/three@0.128.0/examples/jsm/postprocessing/RenderPass.js",
    "three/examples/jsm/postprocessing/UnrealBloomPass.js": "https://unpkg.com/three@0.128.0/examples/jsm/postprocessing/UnrealBloomPass.js",
    "three/examples/jsm/postprocessing/ShaderPass.js": "https://unpkg.com/three@0.128.0/examples/jsm/postprocessing/ShaderPass.js",
    "three/examples/jsm/shaders/CopyShader.js": "https://unpkg.com/three@0.128.0/examples/jsm/shaders/CopyShader.js",
    "three/examples/jsm/shaders/LuminosityHighPassShader.js": "https://unpkg.com/three@0.128.0/examples/jsm/shaders/LuminosityHighPassShader.js",
    "three/examples/jsm/shaders/FilmShader.js": "https://unpkg.com/three@0.128.0/examples/jsm/shaders/FilmShader.js",
    "three/examples/jsm/shaders/VignetteShader.js": "https://unpkg.com/three@0.128.0/examples/jsm/shaders/VignetteShader.js"
  }
}
```

Note: The unpkg modules import internally from relative paths (`../shaders/CopyShader.js`, etc.) which resolve within unpkg. The import map entry for `'three'` is what they need to resolve their `import { ... } from 'three'` statements.

**Step 3: Create `js/postprocessing.js`**

```js
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

export function createPostProcessing(renderer, scene, camera) {
  const composer = new EffectComposer(renderer);

  // 1. Base render pass
  composer.addPass(new RenderPass(scene, camera));

  // 2. Bloom — the crucial neon glow
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    1.2,   // strength — cranked for neon bleed
    0.4,   // radius
    0.85   // threshold — only bright emissive colors bloom
  );
  composer.addPass(bloomPass);

  return { composer, bloomPass };
}
```

**Step 4: Integrate into `js/game.js`**

```js
import { createPostProcessing } from './postprocessing.js';
// ... after renderer, scene, camera setup ...
const { composer } = createPostProcessing(renderer, scene, camera);

// In loop(), replace:
//   renderer.render(scene, camera);
// with:
//   composer.render();

// In resize handler, add:
//   composer.setSize(window.innerWidth, window.innerHeight);
```

**Step 5: Record AFTER video and compare**

```bash
node node_modules/@playwright/test/cli.js test tests/high-score.spec.js
cp test-results/high-score-Record-high-score-gameplay-navigate-5-pipes/video.webm videos/task8-after.webm
```

Use `/compare-before-after-with-video` on `videos/task8-before.webm` vs `videos/task8-after.webm`:
- Expected changes: Bright cyan/magenta elements should now have a visible **bloom/glow effect** — light bleeds outward from neon-colored surfaces into the surrounding dark. The entire scene should feel more "neon."
- No regressions: All geometry still visible, gameplay works, score >= 5. If the screen is blank/white, bloom setup is broken.

Use `/verify-video` on `videos/task8-after.webm` if needed to confirm bloom is visible:
- Check: "Do bright cyan and magenta elements have a visible glow/halo bleeding into surrounding dark areas?"

**Step 6: Commit**

```bash
git add index.html js/postprocessing.js js/game.js
git commit -m "feat: add bloom post-processing via UnrealBloomPass"
```

---

### Task 9: Add color grading (shadow crush + magenta push)

**Files:**
- Modify: `js/postprocessing.js` — add color grading ShaderPass

**Step 1: Record BEFORE video**

```bash
node node_modules/@playwright/test/cli.js test tests/high-score.spec.js
cp test-results/high-score-Record-high-score-gameplay-navigate-5-pipes/video.webm videos/task9-before.webm
```

**Step 2: Implement color grading shader**

Add to `createPostProcessing()` after bloom:

```js
// 3. Color grading — crush shadows, push midtones to magenta
const ColorGradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    shadowCrush: { value: 0.15 },
    magentaPush: { value: 0.08 },
    contrast: { value: 1.2 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float shadowCrush;
    uniform float magentaPush;
    uniform float contrast;
    varying vec2 vUv;
    void main() {
      vec4 tex = texture2D(tDiffuse, vUv);
      vec3 c = tex.rgb;
      c = max(c - shadowCrush, 0.0) / (1.0 - shadowCrush);
      c = (c - 0.5) * contrast + 0.5;
      float lum = dot(c, vec3(0.299, 0.587, 0.114));
      float midMask = smoothstep(0.0, 0.5, lum) * smoothstep(1.0, 0.5, lum);
      c.r += magentaPush * midMask;
      c.b += magentaPush * midMask * 0.5;
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), tex.a);
    }
  `,
};
const gradePass = new ShaderPass(ColorGradeShader);
composer.addPass(gradePass);
```

**Step 3: Record AFTER video and compare**

```bash
node node_modules/@playwright/test/cli.js test tests/high-score.spec.js
cp test-results/high-score-Record-high-score-gameplay-navigate-5-pipes/video.webm videos/task9-after.webm
```

Use `/compare-before-after-with-video` on `videos/task9-before.webm` vs `videos/task9-after.webm`:
- Expected changes: **Deeper shadows** (dark areas become darker/crushed), **higher contrast**, and a subtle **magenta/purple tint** in midtones. Overall color palette should feel warmer and more stylized.
- No regressions: All elements visible, gameplay works. If scene is too dark to play, reduce `shadowCrush` or `contrast`.

**Step 4: Commit**

```bash
git add js/postprocessing.js
git commit -m "feat: add color grading pass (shadow crush + magenta midtones)"
```

---

### Task 10: Add vignette

**Files:**
- Modify: `js/postprocessing.js`

**Step 1: Record BEFORE video**

```bash
node node_modules/@playwright/test/cli.js test tests/high-score.spec.js
cp test-results/high-score-Record-high-score-gameplay-navigate-5-pipes/video.webm videos/task10-before.webm
```

**Step 2: Implement**

```js
import { VignetteShader } from 'three/examples/jsm/shaders/VignetteShader.js';

// 4. Vignette — darken edges
const vignettePass = new ShaderPass(VignetteShader);
vignettePass.uniforms['offset'].value = 1.0;
vignettePass.uniforms['darkness'].value = 1.4;
composer.addPass(vignettePass);
```

**Step 3: Record AFTER video and compare**

```bash
node node_modules/@playwright/test/cli.js test tests/high-score.spec.js
cp test-results/high-score-Record-high-score-gameplay-navigate-5-pipes/video.webm videos/task10-after.webm
```

Use `/compare-before-after-with-video` on `videos/task10-before.webm` vs `videos/task10-after.webm`:
- Expected changes: **Edges/corners of the screen are noticeably darker** than the center, creating a spotlight/tunnel effect that draws the eye to the gameplay area.
- No regressions: Center gameplay area still clearly visible, gameplay works.

**Step 4: Commit**

```bash
git add js/postprocessing.js
git commit -m "feat: add vignette post-processing pass"
```

---

### Task 11: Add film grain + chromatic aberration

**Files:**
- Modify: `js/postprocessing.js`
- Modify: `js/game.js` — pass time to film shader
- Modify: `index.html` — remove CSS scanlines (shader replaces them)

**Step 1: Record BEFORE video**

```bash
node node_modules/@playwright/test/cli.js test tests/high-score.spec.js
cp test-results/high-score-Record-high-score-gameplay-navigate-5-pipes/video.webm videos/task11-before.webm
```

**Step 2: Implement film grain**

```js
import { FilmShader } from 'three/examples/jsm/shaders/FilmShader.js';

// 5. Film grain + scanlines
const filmPass = new ShaderPass(FilmShader);
filmPass.uniforms['nIntensity'].value = 0.25;  // subtle grain
filmPass.uniforms['sIntensity'].value = 0.04;  // faint scanlines
filmPass.uniforms['sCount'].value = 800;
filmPass.uniforms['grayscale'].value = 0;
composer.addPass(filmPass);
```

Export `filmPass` so `game.js` can update `filmPass.uniforms['time'].value = now * 0.001` each frame.

**Step 3: Add chromatic aberration**

```js
const ChromaticAberrationShader = {
  uniforms: {
    tDiffuse: { value: null },
    amount: { value: 0.003 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float amount;
    varying vec2 vUv;
    void main() {
      vec2 offset = (vUv - 0.5) * amount;
      float r = texture2D(tDiffuse, vUv + offset).r;
      float g = texture2D(tDiffuse, vUv).g;
      float b = texture2D(tDiffuse, vUv - offset).b;
      gl_FragColor = vec4(r, g, b, 1.0);
    }
  `,
};
const chromaPass = new ShaderPass(ChromaticAberrationShader);
composer.addPass(chromaPass);
```

**Step 4: Update `js/game.js` loop**

```js
// After composer.render():
if (filmPass) filmPass.uniforms['time'].value = now * 0.001;
```

**Step 5: Remove CSS scanlines from `index.html`**

Delete the `body::after` CSS block (the FilmShader replaces it).

**Step 6: Record AFTER video and compare**

```bash
node node_modules/@playwright/test/cli.js test tests/high-score.spec.js
cp test-results/high-score-Record-high-score-gameplay-navigate-5-pipes/video.webm videos/task11-after.webm
```

Use `/compare-before-after-with-video` on `videos/task11-before.webm` vs `videos/task11-after.webm`:
- Expected changes: **Subtle film grain/noise** visible over the entire scene (animated, not static). **Faint horizontal scanlines** (replacing the CSS version). **Slight color fringing** at screen edges (chromatic aberration — red/blue split).
- No regressions: Scene still readable, gameplay works. If grain is too heavy or scanlines too dominant, tune `nIntensity`/`sIntensity`.

Use `/verify-video` on `videos/task11-after.webm` for final retro-feel check:
- "Does the scene have visible film grain noise, faint scanlines, and subtle color splitting at the edges?"

**Step 7: Commit**

```bash
git add js/postprocessing.js js/game.js index.html
git commit -m "feat: add film grain, scanlines, and chromatic aberration"
```

---

## Phase 5: Final Integration & Polish

### Task 12: End-to-end visual verification

**Step 1: Run all unit tests**

Run: `npm run test:unit`
Expected: All tests pass.

**Step 2: Run high-score gameplay test**

Run: `node node_modules/@playwright/test/cli.js test tests/high-score.spec.js`
Expected: Score >= 5.

**Step 3: Record final video**

```bash
node node_modules/@playwright/test/cli.js test tests/high-score.spec.js
cp test-results/high-score-Record-high-score-gameplay-navigate-5-pipes/video.webm videos/synthwave-final.webm
```

**Step 4: Full before/after comparison**

Use `/compare-before-after-with-video` on `videos/task1-before.webm` (the original, pre-overhaul) vs `videos/synthwave-final.webm`:
- This is the big-picture comparison. Describe ALL visual differences between the original and the final synthwave version.

**Step 5: Verify final aesthetics with Gemini**

Use `/verify-video videos/synthwave-final.webm` with these checks:
1. Buildings have visible glowing cyan/magenta edge lines (bevels)
2. Bloom effect visible — bright elements bleed light into surrounding dark
3. Ground has a glowing grid that scrolls toward the camera
4. Dark purple background, no bright directional lighting
5. Vignette visible — edges of screen darker than center
6. Subtle film grain/noise texture visible
7. Wireframe mountains visible in far background below sun
8. Overall aesthetic reads as "synthwave / retrowave / outrun"

**Step 6: Save golden recording**

```bash
cp videos/synthwave-final.webm golden/synthwave-overhaul.webm
git add golden/synthwave-overhaul.webm
git commit -m "chore: add synthwave overhaul golden recording"
```

**Step 7: Update `CLAUDE.md` and `HANDOFF.md`**

Document new post-processing pipeline, import map setup, and updated file structure.

```bash
git add CLAUDE.md HANDOFF.md
git commit -m "docs: document synthwave visual overhaul"
```

---

## Risk Notes

1. **Import map + unpkg**: If unpkg is slow/down, the game won't load. Consider vendoring the postprocessing modules locally as a fallback.
2. **MeshStandardMaterial performance**: Standard material is heavier than Basic/Lambert. Monitor FPS. If it drops below 30fps in Playwright, fall back to `MeshPhongMaterial`.
3. **Bloom + headless Chrome**: Bloom requires proper WebGL support. Playwright's headless Chromium should handle it, but if post-processing causes blank screens, add a `?nopp` query param that skips post-processing for testing.
4. **Film grain `time` uniform**: Must be updated every frame or the grain will be static. Pass `now * 0.001` in the game loop.
5. **Existing CSS scanlines**: The `body::after` CSS already adds scanlines. Task 11 removes them in favor of the shader-based approach. If the shader scanlines look different, we can keep both or tune `sIntensity`.
