const THREE = window.THREE;

// Trail: history of bird positions, with slight X wobble so it's visible
// from the front camera as a wavy neon streak.
const TRAIL_LENGTH = 16;
const SAMPLE_EVERY = 2;   // sample every 2 frames
const X_WOBBLE     = 0.12; // max X deviation per point

export function createTrail(scene) {
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(TRAIL_LENGTH * 3);
  const colors    = new Float32Array(TRAIL_LENGTH * 3);

  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color',    new THREE.BufferAttribute(colors,    3));

  const vcValue = (THREE.VertexColors !== undefined) ? THREE.VertexColors : true;
  const mat = new THREE.PointsMaterial({
    size: 0.28,
    vertexColors: vcValue,
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });

  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;

  // history: array of {x,y,z} — index 0 = newest
  points.userData.history = [];
  points.userData.frame   = 0;

  scene.add(points);
  return points;
}

export function updateTrail(points, x, y, z) {
  points.userData.frame++;
  if (points.userData.frame % SAMPLE_EVERY !== 0) return;

  const history = points.userData.history;
  history.unshift({ x, y, z });
  if (history.length > TRAIL_LENGTH) history.pop();

  _rebuildBuffer(points);
}

export function resetTrail(points) {
  points.userData.history = [];
  points.userData.frame   = 0;
  _rebuildBuffer(points);
}

function _rebuildBuffer(points) {
  const history = points.userData.history;
  const len     = history.length;
  const pos     = points.geometry.attributes.position.array;
  const col     = points.geometry.attributes.color.array;

  if (len === 0) {
    pos.fill(0);
    col.fill(0);
    points.geometry.attributes.position.needsUpdate = true;
    points.geometry.attributes.color.needsUpdate    = true;
    points.geometry.setDrawRange(0, 0);
    return;
  }

  for (let i = 0; i < len; i++) {
    const t = len > 1 ? i / (len - 1) : 0; // 0=head bright, 1=tail dim
    // Wobble X slightly per index so trail is visible as a wavy streak
    const wobble = Math.sin(i * 1.2) * X_WOBBLE * t;
    pos[i * 3]     = history[i].x + wobble;
    pos[i * 3 + 1] = history[i].y;
    pos[i * 3 + 2] = history[i].z - i * 0.15;
    col[i * 3]     = 0;
    col[i * 3 + 1] = 1 - t * 0.9;
    col[i * 3 + 2] = 1 - t * 0.9;
  }

  points.geometry.attributes.position.needsUpdate = true;
  points.geometry.attributes.color.needsUpdate    = true;
  points.geometry.setDrawRange(0, len);
}
