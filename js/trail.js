const THREE = window.THREE;

const TRAIL_LENGTH = 20;

export function createTrail(scene) {
  const positions = new Float32Array(TRAIL_LENGTH * 3);
  const colors = new Float32Array(TRAIL_LENGTH * 4);

  for (let i = 0; i < TRAIL_LENGTH; i++) {
    const t = i / (TRAIL_LENGTH - 1);
    colors[i * 4]     = 0;
    colors[i * 4 + 1] = 1;
    colors[i * 4 + 2] = 1;
    colors[i * 4 + 3] = 1 - t;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 4));

  const mat = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
  });

  const line = new THREE.Line(geo, mat);
  line.frustumCulled = false;
  scene.add(line);
  return line;
}

export function updateTrail(line, x, y, z) {
  const pos = line.geometry.attributes.position.array;
  for (let i = (TRAIL_LENGTH - 1) * 3; i >= 3; i -= 3) {
    pos[i]     = pos[i - 3];
    pos[i + 1] = pos[i - 2];
    pos[i + 2] = pos[i - 1];
  }
  pos[0] = x;
  pos[1] = y;
  pos[2] = z;
  line.geometry.attributes.position.needsUpdate = true;
}

export function resetTrail(line) {
  const pos = line.geometry.attributes.position.array;
  pos.fill(0);
  line.geometry.attributes.position.needsUpdate = true;
}
