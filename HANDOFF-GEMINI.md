# Cyber Flap: Synthwave Visual Overhaul Handoff

## 🚀 Accomplishments

### 1. High-Intensity Physics & Centralized Config
- **Centralized Configuration:** All gameplay, physics, and visual settings are now consolidated into a single `CONFIG` object in `js/constants.js`.
  - Exposed globally via `window.__GAME_CONFIG` for real-time debugging and test synchronization.
- **Rebalanced Physics:**
  - `GRAVITY`: 0.007
  - `FLAP`: -0.2
  - `PIPE_SPEED`: 0.16
  - `PIPE_SPACING`: 4.5 (High density/action)
- **Synchronized Spawning:** Resolved a major bug where prefilled pipes and the game loop spawn timer would overlap, creating "double pipes."
- **Perfect Alignment:** Spawned pipes are now perfectly aligned with the initial prefill grid to ensure a consistent rhythm from the first second.

### 2. Aspect-Aware Rendering
- **Aspect-Aware FOV:** Implemented a dynamic camera projection that increases FOV in portrait mode. This ensures that the horizontal world scale and pipe distance look consistent to the human eye, regardless of screen orientation (Desktop vs. Mobile).
- **Resolution-Independent Grid:** Replaced `fwidth`-based grid lines with a fixed world-space thickness shader. This prevents lines from becoming "fat" or "blurry" at lower resolutions, maintaining a sharp neon look at any scale.
- **Bloom Tuning:** Reduced bloom strength to `0.8` and increased threshold to `0.3` to provide a tasteful neon glow without washing out geometry.

### 3. Visual Polish
- **Blinking Windows:** Added randomized blinking logic to 15% of city windows for a "living" cyberpunk atmosphere.
- **Improved Environment:** Integrated beveled buildings, wireframe mountains, a retro sun with slice lines, and digital rain particles.
- **Post-Processing Stack:** Full pipeline including UnrealBloom, Film Grain (scanlines), Chromatic Aberration, and Color Grading (magenta midtones/crushed shadows).

## 📊 Current Status

### ✅ Verification
- **Unit Tests:** 59/59 passing (`npm run test:unit`).
- **E2E Tests:** High-score test (`tests/high-score.spec.js`) is updated with a physics-predictive pilot that handles the new high-gravity settings.
- **Golden Video:** Final verified state captured at `@golden/synthwave-overhaul.webm`.

### ⚠️ Known Issues
- **Pilot Difficulty:** Due to the extremely high gravity and speed, the Playwright pilot may occasionally fail to navigate the first pipe if the frame rate stutters during startup.
- **Scanline Moire:** At very specific low resolutions, the `FilmShader` scanlines might produce moiré patterns; `sCount` may need adjustment for mobile-only targets.

## 🛠️ TODO / Future Work
- [ ] **Adaptive Difficulty:** Scale `PIPE_SPEED` and `PIPE_SPACING` over time to increase challenge.
- [ ] **Audio Integration:** Add a synthwave soundtrack and "death" sound effects to match the explosion.
- [ ] **Mobile Touch Optimization:** Ensure the "Jack In" overlay is fully responsive for touch events.
- [ ] **Optimization:** Consider instanced rendering for buildings and pipes if city density increases further.
