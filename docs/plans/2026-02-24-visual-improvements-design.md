# Visual Improvements Design

## Goal
Enhance the cyberpunk/synthwave aesthetic with 5 visual improvements: background gradient, retro sun, enhanced cityscape, digital rain, and parallax wireframes.

## Architecture
- All additions in `environment.js` (single-file approach)
- `createEnvironment(scene)` returns `{ cyanLight, magentaLight, envState }`
- New export: `updateEnvironment(envState, dt)` for frame-based animations (rain, parallax)
- `game.js` imports `updateEnvironment` and calls it each frame
- Camera at (15,5,15), buildings at z=-16 to -22, ground at z=-10

## Improvements

### 1. Background Gradient
Replace solid black `scene.background` with a dark radial gradient (deep purple center to black edges) using a canvas texture on a large background plane behind everything.

### 2. Retro Sun
Large glowing circle at the horizon (z≈-25, y≈2) behind buildings. Orange/magenta color. Horizontal line cutouts on the lower half (thin box meshes matching background color) for the classic synthwave look.

### 3. Enhanced Cityscape
Add a second row of taller, darker silhouette buildings further back (z=-24 to -28) for depth layering. More windows on existing buildings.

### 4. Digital Rain
Pool of 40-60 small cyan/magenta rectangles falling in columns in the far background (z=-15 to -25). Reset to top when below ground. Updated via `updateEnvironment(envState, dt)`.

### 5. Parallax Wireframes
2-3 large wireframe geometric shapes (icosahedron, torus, octahedron) far in background, slowly rotating. Move at 0.2x pipe speed for parallax depth effect.

## Verification (per task)
Each improvement follows: write failing unit tests → implement → unit tests pass → record video → verify-video with Gemini → commit.

### Unit Tests
1. Gradient: background plane/texture exists
2. Sun: circle mesh at y≈2 z≈-25, horizontal slice lines
3. Cityscape: increased building count with second row at z=-24 to -28
4. Rain: envState.rainDrops has 40-60 particles, updateEnvironment moves Y positions
5. Parallax: envState.parallaxObjects has 2-3 wireframe meshes, updateEnvironment rotates them

### verify-video Expectations
1. "Dark purple/blue gradient background, NOT solid black"
2. "Large glowing synthwave sun at horizon with horizontal lines cutting through lower half"
3. "Multiple layers of building silhouettes — near and distant rows — with neon windows"
4. "Small glowing cyan/magenta particles falling like digital rain columns"
5. "Large wireframe geometric shapes slowly rotating in far background"
