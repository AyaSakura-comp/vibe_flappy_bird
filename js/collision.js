import * as THREE from 'three';

export function checkCollision(birdBox, pipe) {
  if (!pipe.topGroup || !pipe.botGroup) return false;
  
  pipe.topGroup.updateMatrixWorld(true);
  pipe.botGroup.updateMatrixWorld(true);
  
  const topBox = new THREE.Box3().setFromObject(pipe.topGroup);
  const botBox = new THREE.Box3().setFromObject(pipe.botGroup);
  
  if (birdBox.intersectsBox(topBox) || birdBox.intersectsBox(botBox)) {
    return true;
  }
  return false;
}
