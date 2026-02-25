import * as THREE from 'three';

export function createBird(scene) {
  const birdGroup = new THREE.Group();
  scene.add(birdGroup);

  const bodyGeo = new THREE.BoxGeometry(0.55, 0.22, 0.38);
  const bodyMat = new THREE.MeshPhongMaterial({
    color: 0x003344,
    emissive: 0x00ccff,
    emissiveIntensity: 0.6,
    shininess: 120,
  });
  birdGroup.add(new THREE.Mesh(bodyGeo, bodyMat));

  const rimGeo = new THREE.BoxGeometry(0.57, 0.06, 0.05);
  const rimMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });
  const rim    = new THREE.Mesh(rimGeo, rimMat);
  rim.position.set(0, 0, 0.195);
  birdGroup.add(rim);

  const engGeo = new THREE.SphereGeometry(0.07, 8, 8);
  const engMat = new THREE.MeshBasicMaterial({ color: 0xff00ff });
  const eng    = new THREE.Mesh(engGeo, engMat);
  eng.position.set(0, 0, -0.22);
  birdGroup.add(eng);

  const wingGeo = new THREE.BoxGeometry(0.5, 0.05, 0.18);
  const wingMat = new THREE.MeshPhongMaterial({ color: 0x001122, emissive: 0x0066aa, emissiveIntensity: 0.4 });
  [-0.38, 0.38].forEach(xOff => {
    const wing = new THREE.Mesh(wingGeo, wingMat);
    wing.position.set(xOff, 0, 0);
    birdGroup.add(wing);
  });

  return { birdGroup, eng };
}
