# CYBER FLAP — 3D Flappy Bird

A high-intensity, synthwave-themed 3D Flappy Bird clone built with Three.js (r128).

## Project Structure

```
index.html          — HTML/CSS UI + Three.js Import Map
js/
  constants.js      — Centralized CONFIG: Physics, Pipes, Visuals, and Colors
  collision.js      — Pure function: checkCollision(birdY, birdX, pipe, margin)
  explosion.js      — Particle system: spawnExplosion(), updateExplosion()
  audio.js          — Background music: createAudio(), playBgm(), pauseBgm()
  bird.js           — createBird(scene) → { birdGroup, eng }
  pipes.js          — Pipe management: spawning, recycling, pattern generation
  trail.js          — Neon data trail trailing the bird
  environment.js    — World: Grid floor shader, Skyscrapers, Retro Sun, Digital Rain, Mountains
  postprocessing.js — EffectComposer: Bloom, Color Grading, Vignette, Film Grain, Chroma Aberration (Configured via constants.js)
      game.js           — Main orchestrator: Game loop, State management, Input, Test API
  tests/
    unit.test.js      — 96 unit tests (node:test) covering all modules
    high-score.spec.js — Physics-predictive AI pilot: navigates 20+ pipes in ≤15s
  
  flappy.spec.js    — Survival test: AI navigates ≥10 pipes (Playwright)
  collision.spec.js — Collision test: bird dies on cap contact
  golden.spec.js    — Golden test: verify SYSTEM FAILURE state
  record-gameplay.spec.js — Visual verification: record gameplay video
docs/plans/         — Design and implementation plan documents
golden/
  synthwave-overhaul.webm — Reference video for the 2026-02-25 visual update
  high-score-5plus.webm   — Reference video for high-intensity physics gameplay
package.json
```

## Architecture & Design

- **ES Modules & Import Maps**: No bundler. Three.js and its JSM examples are loaded via a native import map in `index.html`.
- **Centralized Config**: All game tuning (Gravity, Speed, Colors, Bloom, and Post-processing) is managed in `js/constants.js` via the `CONFIG` object.
- **High-Intensity Physics**: Tuned for a fast, arcade feel (Gravity: 0.019, Pipe Speed: 0.16).
- **Visual Identity (Synthwave)**:
  - **UI**: Cyberpunk-themed overlays with glow effects.
    - Start: `CYBER FLAP` — `[ CLICK OR SPACE TO JACK IN ]`
    - Game Over: `SYSTEM FAILURE` — `// CLICK TO REBOOT`
  - **Environment**: Multi-layered parallax world.
    - **Foreground**: Scrolling GLSL neon grid floor (Magenta/Cyan).
    - **Midground**: Skyscrapers with neon window grids and beveled glowing edges.
    - **Background**: Sliced retro sun (Orange/Red), wireframe mountains, and digital rain particles.
  - **Post-Processing**: Heavy stack for "CRT/VHS" aesthetic.
    - High-intensity **Bloom** (neon glow).
    - **Color Grading**: Crushed shadows with magenta midtone pushes.
    - **VHS Effects**: Film grain, visible scanlines, and subtle chromatic aberration on edges.
- **Aspect-Aware Rendering**: FOV and layout are dynamically adjusted to maintain consistent gameplay across 9:16 (mobile) and 16:9 (desktop) viewports.
- **Test API**: Exposed on `window.__FLAPPY_*` for automated E2E testing and AI bot control.
  - `__FLAPPY_BIRD_Y`, `__FLAPPY_VELOCITY`, `__FLAPPY_SCORE`, `__FLAPPY_STARTED`, `__FLAPPY_OVER`
  - `__FLAPPY_NEXT_GAP_TOP/BOT`, `__FLAPPY_NEXT_PIPE_Z` — next unscored pipe
  - `__FLAPPY_NEXT2_GAP_TOP/BOT`, `__FLAPPY_NEXT2_PIPE_Z` — second unscored pipe (look-ahead)
  - `__FLAPPY_START_QUIET` — start game without flap velocity (for pilot tests)
  - `__FLAPPY_RESTART` — direct restart bypassing overlay timing
  - `__GAME_CONFIG` — live reference to CONFIG object; mutations (e.g. PIPES.SPEED) take effect each frame

## Running

```bash
# Serve locally
node node_modules/http-server/bin/http-server . -p 1124 --cors -c-1

# Run tests
node node_modules/@playwright/test/cli.js test
```

## Test Notes

- **Automated High-Score**: `tests/high-score.spec.js` uses a zero-latency in-browser pilot to record high-score gameplay.
  - Physics-predictive pilot simulates bird trajectory to target the center of each pipe's safe zone.
  - Detects pipe bunching (caused by GPU ReadPixels dt-capping) via `__FLAPPY_NEXT2_*` look-ahead; targets gap intersection when two pipes share the collision zone.
  - Applies 2× pipe speed override (`window.__GAME_CONFIG.PIPES.SPEED = 0.32`) so 20+ pipes complete in ~13s on this WSL2 hardware (vs ~20s at default speed).
  - Uses `waitForFunction({ polling: 'raf' })` for zero-IPC score detection.
- **Unit Tests**: `npm run test:unit` runs 63 tests using a local Three.js mock.
- **Videos**: Playwright is configured to record videos of all E2E test runs for visual verification.
  - Viewport: 1080×1920 (portrait/mobile). Video target: ≤15s.

