# Phase Dive System — Design Document

**Date**: 2026-02-26
**Status**: Approved

## Overview

"Phase Dive" adds a dual-input mechanic to CYBER FLAP: players hold the right side of the screen (or D key) to enter a "Phased" state that passes through Laser Nets — a new obstacle spawned inside pipe gaps. An Overheat stamina bar prevents infinite phasing.

## Architecture

| Concern | Files Modified | New Files |
|---------|---------------|-----------|
| Phase State & Input | `game.js`, `constants.js` | — |
| Laser Net Obstacle | `pipes.js`, `collision.js`, `constants.js` | `js/laser.js` |
| Visual Feedback | `bird.js`, `trail.js`, `game.js` | — |
| Overheat System | `game.js`, `constants.js` | — |
| Audio Placeholders | `audio.js` | — |
| Tests | `unit.test.js` | `phase-dive.spec.js` |

Unchanged: `environment.js`, `postprocessing.js`, `explosion.js` (reused for phase VFX).

### Data Flow

```
Input (touch zones / keyboard)
  → game.js: phasing flag + overheat timer
  → collision.js: extended with phasing flag
  → bird.js: visual state swap (solid ↔ phased)
  → trail.js: color swap based on phase state
  → laser.js: spawn/move/remove laser nets, laser collision
```

## I. Input System — Split Screen + Multi-Touch

### Touch (Mobile)
- `touchstart` / `touchend` on `document`
- Each touch: `touch.clientX / window.innerWidth`
  - Left half (< 0.5): `handleInput()` (flap)
  - Right half (>= 0.5): `touchstart` → `phasing = true`, `touchend` → `phasing = false`
- Multi-touch: process each touch in `changedTouches` independently

### Keyboard (Desktop)
- `keydown` / `keyup` with `e.code === 'KeyD'`: toggle `phasing`
- Existing `Space` → flap unchanged

### Mouse (Desktop Fallback)
- Replace `click` with `mousedown` / `mouseup`
- `mousedown`: left half → flap, right half → phase
- `mouseup`: right half → unphase

### Start Screen UI
- Left side: "TAP TO JUMP"
- Right side: "HOLD TO PHASE"
- Faint vertical divider line at 50% width (CSS)

## II. Overheat System

### CONFIG Values
```js
CONFIG.PHASE = {
  MAX_DURATION: 1.5,   // seconds max continuous phase
  COOLDOWN: 1.0,       // seconds locked after depletion
  DRAIN_RATE: 1.0,     // stamina/sec while phasing
  CHARGE_RATE: 0.5,    // stamina/sec while not phasing (3s full recharge)
}
```

### State Variables
- `phaseStamina = 1.5` (starts full)
- `phaseCooldown = 0` (> 0 = phase locked)
- `phasing = false`

### Per-Frame Logic
1. If `phasing && phaseCooldown <= 0`: drain by `DRAIN_RATE * dtSec`
2. If stamina <= 0: force `phasing = false`, set `phaseCooldown = COOLDOWN`
3. If `!phasing && phaseCooldown > 0`: decrement cooldown by `dtSec`
4. If `!phasing && phaseCooldown <= 0`: recharge by `CHARGE_RATE * dtSec`, cap at `MAX_DURATION`

### HUD — Stamina Bar
- CSS overlay: thin horizontal bar, bottom-center of screen
- Width = `phaseStamina / MAX_DURATION * 100%`
- Color: cyan (> 30%), yellow (10-30%), red (< 10%)
- Pulsing glow during cooldown
- Hidden until first phase activation

## III. Laser Net — Obstacle

### New Module: `js/laser.js`
- `createLaserNet(gapTop, gapBot)` → `{ mesh, hitTop, hitBot }`
- `updateLaserShader(mesh, time)` — pulse animation via uniform
- Fragment shader: horizontal scanlines + pulse, neon red/yellow

### Spawn Logic
- Each pipe gains optional `laser` property (`{ mesh, hitTop, hitBot }` or `null`)
- Warm-up: first `CONFIG.LASER.WARMUP_PIPES = 5` pipes have no laser
- Base chance: `CONFIG.LASER.SPAWN_CHANCE = 0.35`
- Dynamic difficulty: `min(0.7, BASE_CHANCE + score * 0.015)`

### Placement
- Center of gap: `(gapTop + gapBot) / 2`
- Height: `GAP * 0.25` (25% of gap — within 20-30% spec)
- `hitTop = center + laserHeight/2`, `hitBot = center - laserHeight/2`
- Width: matches pipe diameter (2.0 units)

### Movement
- Laser mesh is a child of pipe group → moves automatically
- Removed when pipe is recycled

## IV. Collision Rules

### Extended Collision
```
for each pipe:
  if checkCollision(birdY, birdX, pipe, margin) → die   // always, phasing ignored
  if !phasing && checkLaserCollision(birdY, pipe, margin) → die
```

### Collision Matrix
| Ship State | vs Purple Pillar | vs Laser Net |
|------------|-----------------|--------------|
| Solid | DEATH | DEATH |
| Phased | DEATH | SAFE |

### Edge Case: Unphase While Overlapping Laser
When `phasing` transitions `true → false`, immediately check all pipes in collision zone for laser overlap. Overlap → instant death.

### `checkLaserCollision(birdY, pipe, margin)`
```
if pipe.laser === null → false
if pipe not in Z collision window → false
if birdY - margin < laser.hitTop && birdY + margin > laser.hitBot → true
```

## V. Visual Feedback

### Phased Ship Appearance
- Body: `opacity = 0.4`, `transparent = true`, `emissive = 0xffffff`, `emissiveIntensity = 1.5`
- Wings: same opacity/transparent, emissive white
- Engine: override rainbow → solid white
- Subtle scale pulse (1.0 → 1.05 at ~4Hz)

### Transition VFX
- Phase in/out: small particle burst (8 particles, white-only palette) via modified `spawnExplosion`
- Chromatic aberration spike: `CHROMA.AMOUNT` → `0.02` for ~150ms, ease back to `0.003`

### Trail When Phased
- Colors shift cyan → white/magenta alternating
- Point size increases to 0.4

## VI. Audio Placeholders

Extend `audio.js`:
- `createSfx()` → object with 4 `HTMLAudioElement` slots (`src = ''`)
- `playPhaseIn(sfx)`, `playPhaseOut(sfx)`, `playLaserPass(sfx)`, `playLaserDeath(sfx)`
- Exposed on `window.__GAME_SFX`

## VII. Test API Additions

| Variable | Type | Description |
|----------|------|-------------|
| `__FLAPPY_PHASING` | Boolean | Current phase state |
| `__FLAPPY_PHASE_STAMINA` | Number | Current stamina |
| `__FLAPPY_PHASE_COOLDOWN` | Number | Current cooldown timer |
| `__FLAPPY_NEXT_LASER` | Boolean | Next unscored pipe has laser? |
| `__FLAPPY_PHASE_ACTIVATE()` | Function | Programmatic phase on |
| `__FLAPPY_PHASE_DEACTIVATE()` | Function | Programmatic phase off |

## VIII. Per-Task Testing Strategy

### Workflow (Every Task)
```
Write unit tests (TDD) → Implement → Unit tests pass
  → Custom Playwright action passes → Video verify passes → Commit
```

No commit until all verification gates are green.

### Task: Input System
- **Unit tests**: zone detection (x < 0.5 = flap, x >= 0.5 = phase), simultaneous inputs
- **Playwright action**: `keydown('d')` to phase + `press('Space')` to flap simultaneously, verify `__FLAPPY_PHASING === true` while bird flaps

### Task: Overheat System
- **Unit tests**: drain rate, forced unphase at 0, cooldown timer, recharge rate
- **Playwright action**: hold D for 2s (exceeds 1.5s max), verify `__FLAPPY_PHASE_STAMINA === 0` and `__FLAPPY_PHASING === false`, wait 1s cooldown, re-phase to confirm
- **Video**: `/verify-video` — confirm HUD bar drains and pulses during cooldown

### Task: Laser Net Spawning & Visuals
- **Unit tests**: warm-up (no lasers first 5 pipes), spawn probability, dynamic difficulty
- **Playwright action**: fly 15+ pipes with `CONFIG.LASER.SPAWN_CHANCE = 1.0`, verify `__FLAPPY_NEXT_LASER` is true
- **Video**: `/compare-before-after-with-video` — confirm red/yellow pulsing nets visible in gaps

### Task: Phase Visual Feedback (Ship + Trail)
- **Unit tests**: material opacity/color in phased vs solid, trail color values
- **Playwright action**: toggle phase on/off every 2s while flying
- **Video**: `/compare-before-after-with-video` — ship goes translucent white, trail changes, chromatic flash on transition

### Task: Collision Rules
- **Unit tests**: all 4 collision combos + unphase-while-overlapping
- **Playwright actions** (4 scenarios):
  1. Solid vs laser → verify `__FLAPPY_OVER === true`
  2. Phased vs laser → verify alive, score increments
  3. Phased vs pipe → verify death
  4. Unphase on overlap → verify instant death
- **Video**: `/verify-video` per scenario

### Task: Full Integration — Updated High-Score Pilot
- **Playwright action**: pilot reads `__FLAPPY_NEXT_LASER`, activates phase via `__FLAPPY_PHASE_ACTIVATE()`, manages stamina via `__FLAPPY_PHASE_STAMINA`, navigates 20+ pipes
- **Video**: `/verify-video` — full Phase Dive gameplay works
- **Video**: `/compare-before-after-with-video` against baseline — complete visual transformation

## IX. Level Spawning Summary

- First 5 pipes: no laser (warm-up)
- Pipes 6+: 35% laser chance, increasing by `+1.5%/score` up to 70%
- Laser occupies 25% of gap height, centered in gap
- Pipe gap size, spacing, speed unchanged from current CONFIG
