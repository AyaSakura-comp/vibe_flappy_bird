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
  input-debounce.spec.js — Mobile fix: verify frame-based input & debouncing
  high-score.spec.js — Physics-predictive AI pilot: navigates 20+ pipes (updated for lasers)
  phase-dive-pilot.spec.js — Specialized Phase Dive pilot: handles laser navigation
  collision-phase.spec.js — Collision rules: solid/phased vs pipe/laser
  overheat.spec.js  — Stamina system: depletion, cooldown, and death checks
  phase-input.spec.js — Input: split-screen controls (Keyboard/Touch/Mouse)
  phase-visuals.spec.js — Visuals: ship translucency and trail color changes
  laser-visual.spec.js — Lasers: spawn logic and shader visibility
  flappy.spec.js    — Survival test: simple AI navigates ≥10 pipes
  collision.spec.js — Collision test: bird dies on pipe contact
  golden.spec.js    — Golden test: verify SYSTEM FAILURE state
  baseline-recording.spec.js — Pre-feature reference recording
docs/plans/         — Design and implementation plan documents
golden/
  task12-input-debounce.webm — Visual proof of input debouncing (mobile chatter fix)
  final-phase-dive.webm — Complete feature verification video (Cumulative)
  baseline-pre-phase-dive.webm — Reference video before Phase Dive
package.json
```

## Architecture & Design

- **ES Modules & Import Maps**: No bundler. Three.js and its JSM examples are loaded via a native import map in `index.html`.
- **Centralized Config**: All game tuning (Gravity, Speed, Colors, Phase, and Lasers) is managed in `js/constants.js`.
- **Mechanics**:
  - **Phase Dive**: Holding 'D' (or right-screen) makes the ship translucent and immune to **Laser Nets**.
  - **Input Debounce**: Mobile touch "chatter" is filtered via a 100ms cooldown and frame-based input queuing in `js/game.js`.
  - **Overheat System**: Phasing drains stamina; hitting zero triggers a 1s cooldown. Dying inside a laser during depletion causes instant death.
  - **Laser Nets**: Obstacles in pipe gaps using pulsating neon shaders and 3D hitboxes.
- **Visual Identity (Synthwave)**:
  - **UI**: Cyberpunk-themed overlays with dynamic input hints.
  - **Post-Processing**: Heavy stack including high-intensity Bloom (1.4 strength), Film Grain, and Scanlines.
- **Performance**: Optimized game loop with DOM element caching and debounced VFX spawning.
- **Test API**: Exposed on `window.__FLAPPY_*` for automated E2E testing and AI bot control.
  - `__FLAPPY_BIRD_Y`, `__FLAPPY_VELOCITY`, `__FLAPPY_SCORE`, `__FLAPPY_STARTED`, `__FLAPPY_OVER`
  - `__FLAPPY_PHASING`, `__FLAPPY_PHASE_STAMINA`, `__FLAPPY_PHASE_COOLDOWN`
  - `__FLAPPY_START_QUIET`, `__FLAPPY_RESTART`, `__FLAPPY_CLEAR_PIPES`, `__FLAPPY_GRAVITY_SCALE`

## 🛠 Testing & Verification Philosophy

This project follows a strict **Verify Before Commit** protocol:

1.  **TDD (Unit):** Pure functions (collision, stamina ticks, laser chance) must have 100% test coverage in `tests/unit.test.js`.
2.  **E2E (Behavior):** Complex interactions (phasing through lasers, input debouncing) are verified via Playwright using automated pilots.
3.  **Visual Verification (Golden):** Visual features require a recorded video (`golden/`) and a "Theme Consistency Check" against the `baseline-pre-phase-dive.webm`.
4.  **Aesthetic Mandates:**
    - Dark purple sky (~#1a0044)
    - Cyan/Magenta/Purple primary palette.
    - High-intensity bloom (STRENGTH: 1.4, RADIUS: 1.2).

## Running

```bash
# Serve locally
node node_modules/http-server/bin/http-server . -p 3457 --cors -c-1

# Run all tests
node node_modules/@playwright/test/cli.js test

# Run unit tests only
npm run test:unit
```
