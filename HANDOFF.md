# Hand-off Document: Cyber Flap 3D

## Project Overview
Cyber Flap is a cyberpunk-themed 3D Flappy Bird clone built with Three.js (r128) and ES Modules. It uses a modular architecture and features automated testing with Playwright, including video-based visual verification via Gemini.

## Recent Accomplishments (Session Feb 24, 2026 — Bugfix)
- **Bug 1: Background Fixed**: Repositioned buildings from z=-43...-48 to z=-16...-22 with 3D depth (2-3.5 units). Moved ground/grid from z=-60 to z=-10. Buildings now visible from angled camera.
- **Bug 2: Trail Fixed**: Trail was stacking vertically because bird doesn't move in Z. Added +Z spread (`+ i * 0.18`) so trail extends behind bird toward camera. Reduced X_WOBBLE from 0.12 to 0.04.
- **Bug 3: Pipe Persistence Fixed**: Changed pipe removal from `z > 2` to `z > PIPE_REMOVE_Z (15)`. Pipes now stay visible after bird passes them.
- **Verification**: All bugs confirmed fixed via Gemini video analysis (`videos/final-verification-v2.webm`).
- **Unit Tests**: Grew from 34 to 38 (added tests for building depth, ground position, trail z-spread, PIPE_REMOVE_Z).

## Previous Accomplishments (Session Feb 24, 2026)
- **Visual Improvements**: Rotated the camera to a **45-degree over-the-shoulder angle** (`15, 5, 15`) to provide better depth perception and visibility of the distance between the bird and tubes.
- **Gameplay Tuning**: 
    - Set `PIPE_SPEED` to `0.1` for a balanced pace.
    - Shortened `PIPE_SPACING` to `5` to increase obstacle frequency.
    - Increased `PIPE_GAP` to `7.5` and reduced collision margin to `0.1` to assist the AI bot and improve playability.
- **Automation & Bots**: 
    - Created `tests/record-gameplay.spec.js` for generating gameplay videos.
    - Enhanced the bot's strategy by exposing `window.__FLAPPY_VELOCITY` in the game loop.
- **Project Hygiene**: 
    - Organized all `.webm` recordings into a `videos/` directory.
    - Updated `.gitignore` to exclude `*.webm` files.
    - Updated `CLAUDE.md` with the standard deployment command.

## Technical Context
- **Architecture**: ES Modules served directly (no bundler). Three.js is loaded via CDN and accessed via `window.THREE`.
- **Test Suite**:
    - **Unit Tests**: 38 tests in `tests/unit.test.js` using `node:test`. All are currently PASSING.
    - **E2E/Verification**: Playwright tests in `tests/*.spec.js`. These generate videos in `test-results/` which are then moved to `videos/`.
- **Global API**: The game exposes state via `window.__FLAPPY_*` (BIRD_Y, VELOCITY, SCORE, OVER, etc.) for Playwright to read.

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
- **Run E2E Tests**: `node node_modules/@playwright/test/cli.js test`

## Known Observations
- **Screen Shake**: There is code in `game.js` for screen shake on death, but visual verification via Gemini has reported it as subtle/invisible in compressed video.
- **Bot Performance**: The AI bot in `record-gameplay.spec.js` is tuned for the current `0.1` speed and `5` spacing. If speed is increased significantly, the `TOLERANCE_BELOW` and `VELOCITY_THRESHOLD` in the spec may need further adjustment.
