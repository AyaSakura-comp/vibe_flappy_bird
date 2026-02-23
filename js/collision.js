export function checkCollision(birdY, birdX, pipe, margin = 0.1) {
  const pz = pipe.group.position.z;
  if (pz > -2.0 && pz < 1.5) {
    if (Math.abs(birdX) < 1.1) {
      if (birdY + margin > pipe.gapTop || birdY - margin < pipe.gapBot) {
        return true;
      }
    }
  }
  return false;
}
