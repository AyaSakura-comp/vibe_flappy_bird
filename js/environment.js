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
  // Sun disc — placed along the camera view ray, rotated to face the camera
  // Camera is at (15,5,15) looking at (0,0,0). View ray center at z=-20 is ~(-20,-6.7,-20).
  // Use a Group so slices stay relative to the sun disc in local space.
  // Push sun further back so buildings don't bisect it
  const SUN_X = -22, SUN_Y = -3, SUN_Z = -22;

  const group = new THREE.Group();
  group.position.set(SUN_X, SUN_Y, SUN_Z);
  group.lookAt(15, 5, 15);

  // Sun disc in local XY plane (facing +Z before rotation)
  const sunGeo = new THREE.CircleGeometry(8, 32);
  const sunMat = new THREE.MeshBasicMaterial({ color: 0xff4400, side: THREE.DoubleSide });
  const sun = new THREE.Mesh(sunGeo, sunMat);
  group.add(sun);

  // Horizontal slice lines in local space — only 4 thin lines in the lower half
  const sliceMat = new THREE.MeshBasicMaterial({ color: 0x1a0044, side: THREE.DoubleSide });
  for (let i = 0; i < 4; i++) {
    const thickness = 0.25 + i * 0.15;
    const sliceGeo = new THREE.BoxGeometry(18, thickness, 0.2);
    const slice = new THREE.Mesh(sliceGeo, sliceMat);
    slice.position.set(0, -1.5 - i * 1.8, 0.05);
    group.add(slice);
  }

  scene.add(group);
}

function createDigitalRain(scene, envState) {
  const rainDrops = [];
  const rainMat1 = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.6 });
  const rainMat2 = new THREE.MeshBasicMaterial({ color: 0xff00aa, transparent: true, opacity: 0.4 });

  for (let i = 0; i < 50; i++) {
    const geo = new THREE.BoxGeometry(0.12, 0.6 + Math.random() * 0.8, 0.12);
    const mat = Math.random() > 0.3 ? rainMat1 : rainMat2;
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(
      (Math.random() - 0.5) * 24,
      Math.random() * 20 + 5,
      -5 - Math.random() * 10
    );
    const speed = 0.05 + Math.random() * 0.08;
    scene.add(mesh);
    rainDrops.push({ mesh, speed });
  }

  envState.rainDrops = rainDrops;
}

function createParallaxWireframes(scene, envState) {
  const parallaxObjects = [];

  const defs = [
    { geo: new THREE.IcosahedronGeometry(3, 0), x: -8, y: 3, z: -14, speedX: 0.003, speedY: 0.005 },
    { geo: new THREE.TorusGeometry(2.5, 0.3, 8, 16), x: 6, y: 4, z: -16, speedX: 0.004, speedY: 0.002 },
    { geo: new THREE.OctahedronGeometry(2, 0), x: 0, y: 5, z: -12, speedX: 0.002, speedY: 0.006 },
  ];

  defs.forEach(({ geo, x, y, z, speedX, speedY }) => {
    const mat = new THREE.MeshBasicMaterial({ color: 0xaa00ff, wireframe: true });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    scene.add(mesh);
    parallaxObjects.push({ mesh, speedX, speedY });
  });

  envState.parallaxObjects = parallaxObjects;
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

  // Distant skyline — taller, darker silhouettes for depth
  const distantBuildingMat = new THREE.MeshBasicMaterial({ color: 0x040010 });
  const distantDefs = [
    { x: -14, w: 4.0, d: 2.0, h: 20, z: -26 },
    { x:  -8, w: 3.0, d: 2.5, h: 14, z: -25 },
    { x:  -3, w: 3.5, d: 2.0, h: 22, z: -27 },
    { x:   2, w: 2.5, d: 2.5, h: 12, z: -26 },
    { x:   7, w: 4.0, d: 2.0, h: 24, z: -25 },
    { x:  13, w: 3.0, d: 2.5, h: 16, z: -27 },
  ];

  distantDefs.forEach(({ x, w, d, h, z }) => {
    const geo  = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, distantBuildingMat);
    mesh.position.set(x, h / 2 - 6.2, z);
    scene.add(mesh);

    for (let i = 0; i < 4; i++) {
      const wGeo = new THREE.BoxGeometry(0.15, 0.15, 0.05);
      const win  = new THREE.Mesh(wGeo, windowMat);
      win.position.set(
        x + (Math.random() - 0.5) * (w - 0.4),
        (Math.random() - 0.5) * (h - 0.4) + h / 2 - 6.2,
        z + d / 2 + 0.05
      );
      scene.add(win);
    }
  });

  const envState = {};
  createDigitalRain(scene, envState);
  createParallaxWireframes(scene, envState);
  return { cyanLight, magentaLight, envState };
}

export function updateEnvironment(envState, dt) {
  if (envState.rainDrops) {
    for (const drop of envState.rainDrops) {
      drop.mesh.position.y -= drop.speed * dt;
      if (drop.mesh.position.y < -7) {
        drop.mesh.position.y = 15 + Math.random() * 10;
        drop.mesh.position.x = (Math.random() - 0.5) * 30;
      }
    }
  }

  if (envState.parallaxObjects) {
    for (const obj of envState.parallaxObjects) {
      obj.mesh.rotation.x += obj.speedX * dt;
      obj.mesh.rotation.y += obj.speedY * dt;
    }
  }
}
