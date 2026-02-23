const THREE = window.THREE;

export function createEnvironment(scene) {
  // Lighting
  scene.add(new THREE.AmbientLight(0x110022, 1.0));

  const cyanLight = new THREE.PointLight(0x00ffff, 1.5, 30);
  cyanLight.position.set(-3, 2, 6);
  scene.add(cyanLight);

  const magentaLight = new THREE.PointLight(0xff00aa, 1.2, 30);
  magentaLight.position.set(3, -2, 4);
  scene.add(magentaLight);

  // Ground
  const groundGeo = new THREE.PlaneGeometry(40, 200, 20, 60);
  const groundMat = new THREE.MeshBasicMaterial({ color: 0x0a0025, wireframe: false });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -6.2, -60);
  scene.add(ground);

  // Grid
  const gridHelper = new THREE.GridHelper(80, 40, 0xff00aa, 0x330066);
  gridHelper.position.set(0, -6.19, -60);
  scene.add(gridHelper);

  // City skyline
  const buildingMat = new THREE.MeshBasicMaterial({ color: 0x080018 });
  const windowMat   = new THREE.MeshBasicMaterial({ color: 0x00ffff });
  const winMat2     = new THREE.MeshBasicMaterial({ color: 0xff00aa });

  const buildingDefs = [
    { x: -14, w: 3.0, h: 12, z: -45 },
    { x: -10, w: 2.0, h:  8, z: -48 },
    { x:  -7, w: 2.5, h: 16, z: -44 },
    { x:  -4, w: 1.5, h:  7, z: -47 },
    { x:  -1, w: 2.0, h: 10, z: -46 },
    { x:   2, w: 2.5, h: 14, z: -45 },
    { x:   5, w: 1.8, h:  9, z: -48 },
    { x:   8, w: 3.0, h: 18, z: -43 },
    { x:  12, w: 2.0, h:  7, z: -47 },
    { x:  15, w: 2.5, h: 11, z: -45 },
  ];

  buildingDefs.forEach(({ x, w, h, z }) => {
    const geo  = new THREE.BoxGeometry(w, h, 1);
    const mesh = new THREE.Mesh(geo, buildingMat);
    mesh.position.set(x, h / 2 - 6.2, z);
    scene.add(mesh);

    for (let i = 0; i < 6; i++) {
      const wGeo  = new THREE.BoxGeometry(0.18, 0.18, 0.05);
      const mat   = Math.random() > 0.5 ? windowMat : winMat2;
      const win   = new THREE.Mesh(wGeo, mat);
      win.position.set(
        x + (Math.random() - 0.5) * (w - 0.4),
        (Math.random() - 0.5) * (h - 0.4) + h / 2 - 6.2,
        z + 0.55
      );
      scene.add(win);
    }
  });

  return { cyanLight, magentaLight };
}
