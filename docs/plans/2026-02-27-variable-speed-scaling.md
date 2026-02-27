# Plan: Variable Speed Scaling

**Date:** 2026-02-27
**Status:** Implemented

## Context

The game ran at a fixed pipe speed (0.08) and parallax speed (0.025) throughout the entire session. To increase difficulty over time, speed now gradually ramps up as the player passes more pipes.

## Config Changes (`js/constants.js`)

Added `CONFIG.SPEED_SCALING` section:

```js
SPEED_SCALING: {
  INITIAL_PIPE_SPEED: 0.08,       // starting pipe speed
  INITIAL_PARALLAX_SPEED: 0.025,  // starting parallax speed
  PIPES_PER_INCREASE: 5,          // increase speed every N pipes scored
  PIPE_SPEED_INCREMENT: 0.01,     // pipe speed added per step
  PARALLAX_INCREMENT: 0.003,      // parallax speed added per step (keeps ~31% ratio)
  MAX_PIPE_SPEED: 0.24,           // cap pipe speed (3x initial)
  MAX_PARALLAX_SPEED: 0.075,      // cap parallax speed (3x initial)
}
```

Set `PIPES.SPEED` default to `0.08` and `ENVIRONMENT.PARALLAX_SPEED` to `0.025`.

## Game Loop Changes (`js/game.js`)

### Scoring section — speed ramp

After score increments, every `PIPES_PER_INCREASE` pipes:

```js
if (score % CONFIG.SPEED_SCALING.PIPES_PER_INCREASE === 0) {
  const targetPipeSpeed = Math.min(
    CONFIG.SPEED_SCALING.MAX_PIPE_SPEED,
    CONFIG.SPEED_SCALING.INITIAL_PIPE_SPEED +
      (score / CONFIG.SPEED_SCALING.PIPES_PER_INCREASE) * CONFIG.SPEED_SCALING.PIPE_SPEED_INCREMENT
  );
  if (targetPipeSpeed > CONFIG.PIPES.SPEED) CONFIG.PIPES.SPEED = targetPipeSpeed;
  // Same pattern for PARALLAX_SPEED
}
```

The "only increase" guard (`targetPipeSpeed > CONFIG.PIPES.SPEED`) ensures that E2E tests which override speed to higher values (e.g., 0.32) are never clobbered by the scaling formula.

### Restart — speed reset

On `restartGame()` and `__FLAPPY_RESTART`:

```js
CONFIG.PIPES.SPEED = CONFIG.SPEED_SCALING.INITIAL_PIPE_SPEED;
CONFIG.ENVIRONMENT.PARALLAX_SPEED = CONFIG.SPEED_SCALING.INITIAL_PARALLAX_SPEED;
```

### Test API

Exposed current speed for introspection:

```js
window.__FLAPPY_PIPE_SPEED = CONFIG.PIPES.SPEED;
```

## Speed Progression Table

| Score | Pipe Speed | Parallax Speed |
|-------|-----------|----------------|
| 0     | 0.08      | 0.025          |
| 5     | 0.09      | 0.028          |
| 10    | 0.10      | 0.031          |
| 15    | 0.11      | 0.034          |
| 20    | 0.12      | 0.037          |
| 40    | 0.16      | 0.049          |
| 60    | 0.20      | 0.061          |
| 80+   | 0.24 (cap)| 0.075 (cap)    |

## Files Modified

1. `js/constants.js` — added `SPEED_SCALING` config block, reset `PIPES.SPEED` to 0.08
2. `js/game.js` — speed scaling on score, reset on restart, `__FLAPPY_PIPE_SPEED` test API

## Verification

- All 25 E2E tests pass (including pilots that override speed to 0.32)
- 86/88 unit tests pass (2 pre-existing failures unrelated to this change)
