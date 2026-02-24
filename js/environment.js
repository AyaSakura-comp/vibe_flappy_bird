const THREE = window.THREE;

function createGradientBackground(scene) {
  // Solid purple sky background — clearly visible from the angled camera
  scene.background = new THREE.Color(0x1a0044);

  // Background plane — far along diagonal, behind sun and buildings
  const geo = new THREE.PlaneGeometry(200, 120);
  const mat = new THREE.MeshBasicMaterial({ color: 0x2d0066, side: THREE.DoubleSide });
  const plane = new THREE.Mesh(geo, mat);
  plane.position.set(-32, 8, -32);
  plane.lookAt(15, 8, 15);
  scene.add(plane);
}

function createRetroSun(scene) {
  // Sun placed along the camera view diagonal at high elevation, facing camera.
  // Camera at (15,5,15) → view direction (-0.688,-0.229,-0.688).
  // Sun at roughly d=35 behind origin along that diagonal, elevated to sky.
  // Place sun at the view center along the diagonal at depth ~35,
  // view center at d=35: (-9.1, -3.0, -9.1). Raise y slightly above ground.
  const group = new THREE.Group();
  group.position.set(-9, 2, -9);
  group.lookAt(15, 5, 15);

  const sunGeo = new THREE.CircleGeometry(6, 32);
  const sunMat = new THREE.MeshBasicMaterial({ color: 0xff4400, side: THREE.DoubleSide });
  group.add(new THREE.Mesh(sunGeo, sunMat));

  const sliceMat = new THREE.MeshBasicMaterial({ color: 0x1a0044, side: THREE.DoubleSide });
  for (let i = 0; i < 5; i++) {
    const thickness = 0.25 + i * 0.18;
    const sliceGeo = new THREE.BoxGeometry(16, thickness, 0.2);
    const slice = new THREE.Mesh(sliceGeo, sliceMat);
    slice.position.set(0, -1.2 - i * 1.6, 0.05);
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
    // Rain covers the diagonal backdrop region
    mesh.position.set(
      -28 + Math.random() * 36,  // x: -28 to +8
      Math.random() * 20 + 5,
      -28 + Math.random() * 36   // z: -28 to +8
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

  // Directional light from camera side to illuminate building faces
  const dirLight = new THREE.DirectionalLight(0x220044, 0.8);
  dirLight.position.set(15, 5, 15);
  scene.add(dirLight);

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

  // City skyline — buildings arranged along the camera view diagonal.
  // Camera at (15,5,15) looks toward (-X,-Z). "Behind" origin = toward (-X,-Z).
  // Right vector in XZ: (0.707, 0, -0.707). Buildings spread along this.
  // Near row (d=20-24 from origin), far row (d=26-30).
  const buildingMat = new THREE.MeshLambertMaterial({ color: 0x180030 });
  const windowMat   = new THREE.MeshBasicMaterial({ color: 0x00ffff });
  const winMat2     = new THREE.MeshBasicMaterial({ color: 0xff00aa });

  // Near buildings: along diagonal, spread left/right with camera-right vector
  const buildingDefs = [
    { x: -25.0, w: 3.0, d: 3.0, h:  8, z:  -5.2 },
    { x: -24.3, w: 2.5, d: 2.5, h: 14, z: -10.1 },
    { x: -23.5, w: 3.5, d: 3.0, h: 11, z: -15.0 },
    { x: -22.1, w: 2.0, d: 2.5, h: 16, z: -19.2 },
    { x: -19.2, w: 2.0, d: 2.5, h: 16, z: -22.1 },
    { x: -15.0, w: 3.0, d: 3.0, h: 12, z: -23.5 },
    { x: -10.1, w: 2.5, d: 2.5, h:  9, z: -24.3 },
    { x:  -5.2, w: 3.5, d: 3.0, h:  7, z: -25.0 },
  ];

  buildingDefs.forEach(({ x, w, d, h, z }) => {
    const geo  = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, buildingMat);
    mesh.position.set(x, h / 2 - 6.2, z);
    mesh.rotation.y = Math.PI / 4; // 45° so camera sees corner, not flat face
    scene.add(mesh);

    for (let i = 0; i < 5; i++) {
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

  // Far buildings — darker, taller, further along diagonal
  const distantBuildingMat = new THREE.MeshLambertMaterial({ color: 0x0c0020 });
  const distantDefs = [
    { x: -28.0, w: 4.0, d: 2.0, h: 20, z:  -8.0 },
    { x: -26.5, w: 3.0, d: 2.0, h: 18, z: -13.5 },
    { x: -24.8, w: 3.5, d: 2.0, h: 22, z: -18.5 },
    { x: -18.5, w: 3.5, d: 2.0, h: 22, z: -24.8 },
    { x: -13.5, w: 3.0, d: 2.0, h: 18, z: -26.5 },
    { x:  -8.0, w: 4.0, d: 2.0, h: 20, z: -28.0 },
  ];

  distantDefs.forEach(({ x, w, d, h, z }) => {
    const geo  = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, distantBuildingMat);
    mesh.position.set(x, h / 2 - 6.2, z);
    mesh.rotation.y = Math.PI / 4;
    scene.add(mesh);

    for (let i = 0; i < 3; i++) {
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
        drop.mesh.position.x = -28 + Math.random() * 36;
        drop.mesh.position.z = -28 + Math.random() * 36;
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
