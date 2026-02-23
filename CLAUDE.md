# CYBER FLAP — 3D Flappy Bird

A cyberpunk-themed Flappy Bird clone built with Three.js (r128 via CDN).

## Project Structure

```
index.html          — HTML/CSS only (title screen, score HUD, overlays)
js/
  constants.js      — Game tuning: GRAVITY, FLAP, PIPE_GAP, PIPE_SPEED, etc.
  collision.js      — Pure function: checkCollision(birdY, birdX, pipe, margin)
  explosion.js      — Particle system: spawnExplosion(), updateExplosion(), clearParticles()
  bird.js           — createBird(scene) → { birdGroup, eng }
  pipes.js          — makePipeSegment(), spawnPipe(), prefillPipes(), resetPipes(), pipes array
  environment.js    — Ground, grid, skyline, lighting → { cyanLight, magentaLight }
  game.js           — Main orchestrator: state, input, game loop, window.__FLAPPY_* test API
tests/
  flappy.spec.js    — Survival test: AI navigates ≥10 pipes (Playwright)
  collision.spec.js — Collision test: bird dies on cap contact (Playwright)
  golden.spec.js    — Golden test: navigate 4+ pipes, crash, verify SYSTEM FAILURE
golden/
  before-refactor.webm  — Reference video from pre-module extraction
  after-refactor.webm   — Reference video after module extraction
playwright.config.js    — Playwright config: 720×1280 viewport, video on, port 3456
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
