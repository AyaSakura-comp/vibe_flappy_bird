# Phase 1: Game Feel Enhancement

## 1. Velocity-Linked Rotation (subtle, ±30°)
- Keep `rotation.z = clamp(-velocity * K)`, tune clamp to ±0.52 rad (~30°)
- Add lerp smoothing: `rotation.z += (target - current) * 0.15` per frame
- On flap: nose-up; falling: nose-down proportional to speed

## 2. Neon Data Trail (fading line)
- New module `js/trail.js` with fixed-length position buffer (20 points)
- `THREE.BufferGeometry` + `THREE.Line` with vertex colors fading cyan → transparent
- Update each frame: shift positions, insert bird position at head
- Trail length scales slightly with fall speed
- Clear on death/restart

## 3. Screen Shake on Death (quick jolt, 0.15s)
- On `triggerGameOver()`: start 150ms shake timer
- Each frame: offset camera ±0.15 units in x/y, amplitude decays linearly
- Camera snaps back when shake ends

## 4. Speed Increase
- `PIPE_SPEED`: 0.04 → 0.07 (75% faster)
- `SPAWN_MS` auto-recalculates (derived from PIPE_SPEED)
- Tune FLAP/PIPE_GAP if needed for playability

## Files
- `js/trail.js` — new module
- `js/constants.js` — PIPE_SPEED change
- `js/game.js` — integrate trail, shake, tweaked rotation
- `tests/unit.test.js` — trail tests, updated constant tests
