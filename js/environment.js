const THREE = window.THREE;

function createGradientBackground(scene) {
  // Solid purple sky background — clearly visible from the angled camera
  scene.background = new THREE.Color(0x1a0044);

  // Brighter purple horizon glow plane — solid color, no transparency issues
  const geo = new THREE.PlaneGeometry(200, 120);
  const mat = new THREE.MeshBasicMaterial({ color: 0x2d0066 });
  const plane = new THREE.Mesh(geo, mat);
  plane.position.set(0, 8, -31);
  scene.add(plane);
}

function createRetroSun(scene) {
  // Sun disc — orange/magenta at horizon behind buildings
  const sunGeo = new THREE.CircleGeometry(6, 32);
  const sunMat = new THREE.MeshBasicMaterial({ color: 0xff5500 });
  const sun = new THREE.Mesh(sunGeo, sunMat);
  sun.position.set(-3, 6, -28);
  scene.add(sun);

  // Horizontal slice lines (5 lines cutting through lower half of sun)
  // These are the same color as the background to create the "cut" effect
  const sliceMat = new THREE.MeshBasicMaterial({ color: 0x1a0044 });
  for (let i = 0; i < 5; i++) {
    const thickness = 0.12 + i * 0.10;
    const sliceGeo = new THREE.BoxGeometry(14, thickness, 0.1);
    const slice = new THREE.Mesh(sliceGeo, sliceMat);
    slice.position.set(-3, 6 - 1.2 - i * 1.1, -27.9);
    scene.add(slice);
  }
}

export function createEnvironment(scene) {
  // Lighting
  scene.add(new THREE.AmbientLight(0x110022, 1.0));

  const cyanLight = new THREE.PointLight(0x00ffff, 1.5, 30);
  cyanLight.position.set(-3, 2, 6);
  scene.add(cyanLight);

  const magentaLight = new THREE.PointLight(0xff00aa, 1.2, 30);
  magentaLight.position.set(3, -2, 4);
  scene.add(magentaLight);

  createGradientBackground(scene);
  createRetroSun(scene);

  // Ground — extend along the diagonal the camera sees
  const groundGeo = new THREE.PlaneGeometry(60, 60, 30, 30);
  const groundMat = new THREE.MeshBasicMaterial({ color: 0x0a0025, wireframe: false });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -6.2, -10);
  scene.add(ground);

  // Grid
  const gridHelper = new THREE.GridHelper(60, 30, 0xff00aa, 0x330066);
  gridHelper.position.set(0, -6.19, -10);
  scene.add(gridHelper);

  // City skyline — thick buildings arranged behind the play area
  // Camera at (15,5,15) looks toward origin, so buildings at negative z are "behind" the action
  const buildingMat = new THREE.MeshBasicMaterial({ color: 0x080018 });
  const windowMat   = new THREE.MeshBasicMaterial({ color: 0x00ffff });
  const winMat2     = new THREE.MeshBasicMaterial({ color: 0xff00aa });

  const buildingDefs = [
    { x: -12, w: 3.0, d: 3.0, h: 12, z: -18 },
    { x:  -9, w: 2.0, d: 2.5, h:  8, z: -20 },
    { x:  -6, w: 2.5, d: 3.0, h: 16, z: -17 },
    { x:  -3, w: 1.5, d: 2.0, h:  7, z: -22 },
    { x:   0, w: 2.0, d: 2.5, h: 10, z: -19 },
    { x:   3, w: 2.5, d: 3.0, h: 14, z: -18 },
    { x:   6, w: 1.8, d: 2.5, h:  9, z: -21 },
    { x:   9, w: 3.0, d: 3.5, h: 18, z: -16 },
    { x:  12, w: 2.0, d: 2.0, h:  7, z: -20 },
    { x:  15, w: 2.5, d: 3.0, h: 11, z: -18 },
  ];

  buildingDefs.forEach(({ x, w, d, h, z }) => {
    const geo  = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, buildingMat);
    mesh.position.set(x, h / 2 - 6.2, z);
    scene.add(mesh);

    for (let i = 0; i < 6; i++) {
      const wGeo = new THREE.BoxGeometry(0.18, 0.18, 0.05);
      const mat  = Math.random() > 0.5 ? windowMat : winMat2;
      const win  = new THREE.Mesh(wGeo, mat);
      win.position.set(
        x + (Math.random() - 0.5) * (w - 0.4),
        (Math.random() - 0.5) * (h - 0.4) + h / 2 - 6.2,
        z + d / 2 + 0.05
      );
      scene.add(win);
    }
  });

  const envState = {};
  return { cyanLight, magentaLight, envState };
}

export function updateEnvironment(envState, dt) {
  // animated effects will be added in subsequent tasks
}
