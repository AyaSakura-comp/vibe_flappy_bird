# Hand-off Document: Cyber Flap 3D

## Project Overview
Cyber Flap is a cyberpunk-themed 3D Flappy Bird clone built with Three.js (r128) and ES Modules. It uses a modular architecture and features automated testing with Playwright, including video-based visual verification via Gemini.

## Recent Accomplishments (Session Feb 24, 2026 — Parallax & Polish)
- **Parallax Background**: Implemented background movement for buildings and windows at 25% of `PIPE_SPEED` along the diagonal, creating a sense of forward motion and depth. Buildings wrap automatically at `Z=15`.
- **Infinite Grid Scroll**: Modified the ground grid to scroll toward the camera and wrap every 2 units, providing a seamless "infinite floor" effect that matches the player's speed.
- **Atmospheric Fog**: Added linear `THREE.Fog(0x1a0044, 20, 80)` matching the sky color. Distant objects now fade into a purple haze, improving immersion and hiding object pop-in.
- **High-Score E2E Test**: Created `tests/high-score.spec.js` featuring an in-browser predictive controller (Cyber-Pilot). It calculates future bird positions and flaps based on physics (gravity/velocity) to achieve scores >= 10.
- **Unit Tests**: Increased test coverage from 38 to **53 passing tests**. Added new suites for fog verification, environment state tracking, and parallax wrapping logic.
- **Configuration**: Updated `playwright.config.js` and `high-score.spec.js` to use port `3457` to resolve local port conflicts.

## Previous Accomplishments (Session Feb 24, 2026 — Bugfix)
- **Bug 1: Background Fixed**: Repositioned buildings to `z=-16...-22` with 3D depth. Moved ground/grid to `z=-10`.
- **Bug 2: Trail Fixed**: Added +Z spread so trail extends behind bird toward camera. Reduced X_WOBBLE.
- **Bug 3: Pipe Persistence Fixed**: Changed pipe removal to `z > 15`. Pipes stay visible after passing.
- **Verification**: All bugs confirmed fixed via Gemini video analysis (`videos/final-verification-v2.webm`).

## Earlier Accomplishments (Session Feb 24, 2026)
- **Visual Improvements**: Rotated camera to **45-degree over-the-shoulder angle** (`15, 5, 15`).
- **Gameplay Tuning**: `PIPE_SPEED` (0.1), `PIPE_SPACING` (5), `PIPE_GAP` (7.5).
- **Automation & Bots**: Created initial `record-gameplay.spec.js`.
- **Project Hygiene**: Organized `videos/` directory and updated `.gitignore`.

## Technical Context
- **Architecture**: ES Modules served directly (no bundler). Three.js via CDN (`window.THREE`).
- **Test Suite**:
    - **Unit Tests**: 53 tests in `tests/unit.test.js`. All are PASSING.
    - **E2E/Verification**: Playwright tests in `tests/*.spec.js`.
- **Global API**: Exposes `window.__FLAPPY_*` (BIRD_Y, VELOCITY, SCORE, OVER, etc.) for testing.

## Current Configuration (`js/constants.js`)
- `PIPE_SPEED`: 0.1
- `PIPE_SPACING`: 5
- `PIPE_GAP`: 7.5
- `PIPE_REMOVE_Z`: 15
- `GRAVITY`: 0.003
- `FLAP`: -0.13

## How to Run
- **Serve Locally**: `node node_modules/http-server/bin/http-server . -p 1124 --cors -c-1`
- **Run Unit Tests**: `npm run test:unit`
- **Run E2E Tests**: `node node_modules/@playwright/test/cli.js test` (uses port 3457)

## Known Observations
- **Parallax Speed**: Currently set to 25% of `PIPE_SPEED`. This provides a stable background drift that doesn't distract from the foreground pipes.
- **Pilot Logic**: The `high-score.spec.js` controller is tuned for port 3457. It uses an `addInitScript` to inject zero-latency control directly into the browser loop.
