import { CONFIG } from './constants.js';

export function checkCollision(birdY, birdX, pipe, margin = 0.1) {
  const pz = pipe.group.position.z;
  if (pz > CONFIG.PIPES.HIT_Z_MIN && pz < CONFIG.PIPES.HIT_Z_MAX) {
    if (Math.abs(birdX) < 1.1) {
      if (birdY + margin > pipe.gapTop || birdY - margin < pipe.gapBot) {
        return true;
      }
    }
  }
  return false;
}
