# CYBER FLAP — 3D Flappy Bird

A cyberpunk-themed Flappy Bird clone built with Three.js (r128 via CDN).

## Project Structure

```
index.html          — HTML/CSS only (title screen, score HUD, overlays)
js/
  constants.js      — Game tuning: GRAVITY, FLAP, PIPE_GAP, PIPE_SPEED, PIPE_REMOVE_Z, etc.
  collision.js      — Pure function: checkCollision(birdY, birdX, pipe, margin)
  explosion.js      — Particle system: spawnExplosion(), updateExplosion(), clearParticles()
  bird.js           — createBird(scene) → { birdGroup, eng }
  pipes.js          — makePipeSegment(), spawnPipe(), prefillPipes(), resetPipes(), pipes array
  trail.js          — Neon data trail: createTrail(), updateTrail(), resetTrail()
  environment.js    — Ground, grid, skyline, lighting → { cyanLight, magentaLight }
  game.js           — Main orchestrator: state, input, game loop, window.__FLAPPY_* test API
tests/
  unit.test.js      — 53 unit tests (node:test) covering all modules
  flappy.spec.js    — Survival test: AI navigates ≥10 pipes (Playwright, flaky)
  collision.spec.js — Collision test: bird dies on cap contact (Playwright)
  golden.spec.js    — Golden test: navigate 4+ pipes, crash, verify SYSTEM FAILURE
  record-gameplay.spec.js — Record gameplay video with AI bot (score >= 2)
docs/plans/         — Design and implementation plan documents
golden/
  before-refactor.webm  — Reference video from pre-module extraction
  after-refactor.webm   — Reference video after module extraction
playwright.config.js    — Playwright config: 720×1280 viewport, video on, port 3457
package.json
```

## Architecture

- ES modules (`<script type="module">`) — no bundler
- Three.js loaded via CDN `<script>` tag, accessed as `window.THREE` in modules
- `game.js` imports all modules and orchestrates the game loop
- Test API exposed on `window.__FLAPPY_*` (BIRD_Y, SCORE, STARTED, OVER, NEXT_GAP_Y/TOP/BOT)

## Running

```bash
# Serve locally
node node_modules/http-server/bin/http-server . -p 1124 --cors -c-1

# Run tests (no bin links — invoke directly)
node node_modules/@playwright/test/cli.js test
```

## Test Notes

- `flappy.spec.js` uses an adaptive AI that flaps toward `__FLAPPY_NEXT_GAP_Y`; can be flaky under resource contention
- Tests require Playwright browsers installed (`npx playwright install`)
- Videos are recorded automatically by Playwright config
- `record-gameplay.spec.js` is the most reliable E2E test (score >= 2); use it for video verification
- Unit tests: `npm run test:unit` (53 tests, all modules)

## Camera & Environment

- Camera at 45-degree over-the-shoulder angle: position `(15, 5, 15)` looking at origin
- Buildings positioned at z=-16 to -22 with 3D depth (2-3.5 units) for visibility from angled camera
- Ground/grid at z=-10, sized 60x60
- Pipes removed at `PIPE_REMOVE_Z=15` (past the camera) so they persist after the bird passes
- Bird trail spreads in +Z direction (toward camera) to appear behind the bird

## Automated High-Score Recording

A high-score E2E test is available for automated gameplay recording and visual verification.

- **Test File:** `tests/high-score.spec.js`
- **Controller:** Zero-latency in-browser pilot injected via `addInitScript`. Uses an absolute-ceiling strategy:
  - Aims for the bottom quarter of the gap (`gapBot + 1.5`) to pre-position for downward transitions
  - Only flaps when falling (`vel > 0.01`) to prevent double-flaps
  - Enforces an absolute ceiling of 1.25 — the peak after any flap (`birdY + 2.8`) must stay below this to survive worst-case gap transitions (+2 → -2 in `PIPE_Y_PATTERN`)
- **Run command:** `node node_modules/@playwright/test/cli.js test tests/high-score.spec.js`
- **Goal:** Navigates >= 5 pipes (typically scores 6–13+). Video captured in `test-results/`.
- **Golden recording:** `golden/high-score-5plus.webm` (score 13)
- **Port:** Uses port 3457 (configured in `playwright.config.js` webServer)
- **Requirements:** Requires the `window.__FLAPPY_*` test API exposed in `js/game.js`.

