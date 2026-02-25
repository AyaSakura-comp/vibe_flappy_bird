# BGM Design — Neon Velocity Background Music

**Date:** 2026-02-25

## Summary

Add `sounds/Neon_Velocity.mp3` as looping background music. Music plays from first flap, pauses on death, resumes (from current position) on restart.

## Architecture

New `js/audio.js` ES module encapsulates a hidden `<audio>` element. `game.js` calls three exported functions at the appropriate state transitions.

## `js/audio.js`

```js
export function createAudio()   // creates <audio loop src="sounds/Neon_Velocity.mp3">, returns element
export function playBgm(audio)  // audio.play()
export function pauseBgm(audio) // audio.pause()
```

## `game.js` changes

| Location | Change |
|---|---|
| Module init | `import { createAudio, playBgm, pauseBgm } from './audio.js'` + `const audio = createAudio()` |
| `handleInput` | `if (!started) playBgm(audio)` — first flap starts music (satisfies browser autoplay policy) |
| `triggerGameOver` | `pauseBgm(audio)` |
| `restartGame` | `playBgm(audio)` — resumes from paused position, no seek |

## Decisions

- **Resume on restart, not restart from beginning** — continuity feels better
- **No mute toggle** — YAGNI, easy to add later via `audio.muted`
- **HTML `<audio>` not Web Audio API** — sufficient for simple BGM looping
