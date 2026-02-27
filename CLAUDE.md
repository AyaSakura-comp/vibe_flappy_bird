# CYBER FLAP — 3D Flappy Bird

A high-intensity, synthwave-themed 3D Flappy Bird clone built with Three.js (r128).

## Project Structure

```
index.html          — HTML/CSS UI + Three.js Import Map
js/
  constants.js      — Centralized CONFIG: Physics, Pipes, Visuals, Phase, and Lasers
  collision.js      — Pure function: checkCollision(birdY, birdX, pipe, margin)
  explosion.js      — Particle system: spawnExplosion(), updateExplosion()
  audio.js          — Audio manager: Background music and SFX (Phase, Laser)
  bird.js           — createBird(scene) → { birdGroup, eng }
  pipes.js          — Pipe management: spawning, recycling, laser integration
  laser.js          — Laser Net module: Mesh creation, shaders, and collision
  trail.js          — Neon data trail trailing the bird (supports phasing mode)
  environment.js    — World: Grid floor shader, Skyscrapers, Retro Sun, Digital Rain, Mountains
  postprocessing.js — EffectComposer: Bloom, Color Grading, Vignette, Film Grain, Chroma Aberration
  game.js           — Main orchestrator: Game loop, State management, Input, Test API
tests/
  unit.test.js      — 96 unit tests (node:test) covering all modules
  high-score.spec.js — Physics-predictive AI pilot: navigates 20+ pipes (updated for lasers)
  phase-dive-pilot.spec.js — Specialized Phase Dive pilot: handles laser navigation
  collision-phase.spec.js — Collision rules: solid/phased vs pipe/laser
  overheat.spec.js  — Stamina system: depletion, cooldown, and death checks
  phase-input.spec.js — Input: split-screen controls (Keyboard/Touch/Mouse) + mobile double-flap regression test
  phase-visuals.spec.js — Visuals: ship translucency and trail color changes
  laser-visual.spec.js — Lasers: spawn logic and shader visibility
  flappy.spec.js    — Survival test: simple AI navigates ≥10 pipes
  collision.spec.js — Collision test: bird dies on pipe contact
  golden.spec.js    — Golden test: verify SYSTEM FAILURE state
  baseline-recording.spec.js — Pre-feature reference recording
docs/plans/         — Design and implementation plan documents
golden/
  final-phase-dive.webm — Complete feature verification video (Cumulative)
  baseline-pre-phase-dive.webm — Reference video before Phase Dive
package.json
```

## Architecture & Design

- **ES Modules & Import Maps**: No bundler. Three.js and its JSM examples are loaded via a native import map in `index.html`.
- **Centralized Config**: All game tuning (Gravity, Speed, Colors, Phase, and Lasers) is managed in `js/constants.js`.
- **Mechanics**:
  - **Phase Dive**: Holding 'D' (or right-screen click) makes the ship translucent and immune to **Laser Nets**.
  - **Overheat System**: Phasing drains stamina; hitting zero triggers a 1s cooldown. Dying inside a laser during depletion causes instant death.
  - **Laser Nets**: Obstacles in pipe gaps using pulsating neon shaders and 3D hitboxes.
- **Visual Identity (Synthwave)**:
  - **UI**: Cyberpunk-themed overlays with dynamic click-input hints.
  - **Post-Processing**: Heavy stack including high-intensity Bloom, Film Grain, and Scanlines.
- **Input**: Split-screen mouse support (left=flap, right=phase) and keyboard support.
- **Performance**: Optimized game loop with DOM element caching and debounced VFX spawning.
- **Test API**: Exposed on `window.__FLAPPY_*` for automated E2E testing and AI bot control.
  - `__FLAPPY_BIRD_Y`, `__FLAPPY_VELOCITY`, `__FLAPPY_SCORE`, `__FLAPPY_STARTED`, `__FLAPPY_OVER`
  - `__FLAPPY_NEXT_GAP_TOP/BOT`, `__FLAPPY_NEXT_PIPE_Z`, `__FLAPPY_NEXT_LASER`
  - `__FLAPPY_PHASING`, `__FLAPPY_PHASE_STAMINA`, `__FLAPPY_PHASE_COOLDOWN`
  - `__FLAPPY_PHASE_ACTIVATE()`, `__FLAPPY_PHASE_DEACTIVATE()`
  - `__FLAPPY_START_QUIET`, `__FLAPPY_RESTART`, `__FLAPPY_CLEAR_PIPES`, `__FLAPPY_GRAVITY_SCALE`

## Running

```bash
# Serve locally
node node_modules/http-server/bin/http-server . -p 3457 --cors -c-1

# Run tests
node node_modules/@playwright/test/cli.js test
```

## Test Notes

- **Automated High-Score**: `tests/high-score.spec.js` and `tests/phase-dive-pilot.spec.js` use zero-latency pilots to record 20+ pipe navigation at 2× speed (`window.__GAME_CONFIG.PIPES.SPEED = 0.32`).
- **Unit Tests**: `npm run test:unit` runs 96 tests using a local Three.js mock.
- **Videos**: Playwright records videos of all E2E test runs. Standardized theme consistency protocol is used to verify that new features preserve the synthwave aesthetic.
