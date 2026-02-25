import * as THREE from 'three';
import { CONFIG } from './constants.js';

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

  // Radius 1.2 → ~4° angular size at depth 33.7 (~25% of 17° hFOV — tasteful)
  const sunGeo = new THREE.CircleGeometry(1.2, 32);
  const sunMat = new THREE.MeshBasicMaterial({ color: 0xff4400, side: THREE.DoubleSide });
  group.add(new THREE.Mesh(sunGeo, sunMat));

  const sliceMat = new THREE.MeshBasicMaterial({ color: 0x1a0044, side: THREE.DoubleSide });
  for (let i = 0; i < 5; i++) {
    const thickness = 0.04 + i * 0.03;
    const sliceGeo = new THREE.BoxGeometry(2.8, thickness, 0.2);
    const slice = new THREE.Mesh(sliceGeo, sliceMat);
    slice.position.set(0, -0.2 - i * 0.26, 0.05);
    group.add(slice);
  }
  scene.add(group);
}

function createDigitalRain(scene, envState) {
  const rainDrops = [];
  const rainMat1 = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.6 });
  const rainMat2 = new THREE.MeshBasicMaterial({ color: 0xff00ff, transparent: true, opacity: 0.4 });

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

function createBuilding(w, d, h, mat, edgeMat) {
  const group = new THREE.Group();
  
  const bodyGeo = new THREE.BoxGeometry(w, h, d);
  const bodyMesh = new THREE.Mesh(bodyGeo, mat);
  group.add(bodyMesh);

  if (edgeMat) {
    const edgeW = 0.06;
    const edgeGeo = new THREE.BoxGeometry(edgeW, h, edgeW);
    const edgeOffsetsX = [w/2, w/2, -w/2, -w/2];
    const edgeOffsetsZ = [d/2, -d/2, d/2, -d/2];
    
    for (let i = 0; i < 4; i++) {
      const edge = new THREE.Mesh(edgeGeo, edgeMat);
      edge.position.set(edgeOffsetsX[i], 0, edgeOffsetsZ[i]);
      group.add(edge);
    }
  }

  return group;
}

function createWireframeMountains(scene) {
  const mMat = new THREE.MeshBasicMaterial({ color: 0x220044, wireframe: true });
  for (let i = 0; i < 5; i++) {
    const r = 4 + Math.random() * 4;
    const h = 3 + Math.random() * 5;
    const seg = 4 + Math.floor(Math.random() * 3);
    const mGeo = new THREE.ConeGeometry(r, h, seg);
    const mesh = new THREE.Mesh(mGeo, mMat);
    
    const dist = 40 + Math.random() * 10; 
    mesh.position.set(-dist + (Math.random() - 0.5) * 15, h / 2 - 6.2, -dist + (Math.random() - 0.5) * 15);
    scene.add(mesh);
  }
}

export function createEnvironment(scene) {
  // Lighting
  scene.add(new THREE.AmbientLight(0x0a0015, 0.6));
  
  // Add subtle gradient lighting from sky to ground
  scene.add(new THREE.HemisphereLight(0x1a0044, 0x000005, 0.4));

  // Add linear fog matching sky color exactly
  scene.fog = new THREE.Fog(0x1a0044, 20, 80);

  const cyanLight = new THREE.PointLight(0x00ffff, 1.5, 30);
  cyanLight.position.set(-3, 2, 6);
  scene.add(cyanLight);

  const magentaLight = new THREE.PointLight(0xff00ff, 1.2, 30);
  magentaLight.position.set(3, -2, 4);
  scene.add(magentaLight);

  createGradientBackground(scene);
  createRetroSun(scene);

  // Ground with scrolling neon grid shader
  const gridMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uOffset: { value: 0.0 },
      uColor1: { value: new THREE.Color(0xff00ff) },
      uColor2: { value: new THREE.Color(0x00ffff) },
      uBgColor: { value: new THREE.Color(0x0a0025) },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uOffset;
      uniform vec3 uColor1;
      uniform vec3 uColor2;
      uniform vec3 uBgColor;
      varying vec2 vUv;
      void main() {
        vec2 uv = vUv * 30.0;
        uv.y += uOffset;
        
        // Use fixed thickness in UV space for resolution-independent lines
        float thickness = 0.04;
        vec2 grid = smoothstep(thickness, 0.0, abs(fract(uv - 0.5) - 0.5));
        float mask = max(grid.x, grid.y);
        
        vec2 cell = floor(uv);
        float checker = mod(cell.x + cell.y, 2.0);
        vec3 lineColor = mix(uColor1, uColor2, checker * 0.3);
        vec3 color = mix(uBgColor, lineColor, mask * 0.7);
        float fade = smoothstep(0.0, 0.4, vUv.y);
        color = mix(uBgColor, color, fade);
        gl_FragColor = vec4(color, 1.0);
      }
    `,
    side: THREE.DoubleSide,
  });

  const groundGeo = new THREE.PlaneGeometry(60, 60);
  const ground = new THREE.Mesh(groundGeo, gridMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -6.2, -10);
  scene.add(ground);

  // City skyline — buildings arranged along the camera view diagonal.
  // Camera at (15,5,15) looks toward (-X,-Z). "Behind" origin = toward (-X,-Z).
  // Right vector in XZ: (0.707, 0, -0.707). Buildings spread along this.
  // Near row (d=20-24 from origin), far row (d=26-30).
  const cityObjects = [];
  const blinkingWindows = [];
  const buildingMat = new THREE.MeshStandardMaterial({ color: 0x080015, metalness: 0.5, roughness: 0.6 });
  const windowMats = [
    new THREE.MeshBasicMaterial({ color: 0x00e5ff }), // Neon Cyan
    new THREE.MeshBasicMaterial({ color: 0xff00ff }), // Hot Pink
    new THREE.MeshBasicMaterial({ color: 0xbc13fe }), // Electric Purple
    new THREE.MeshBasicMaterial({ color: 0xff6600 }), // Neon Orange
  ];

  // Buildings placed along the x≈z diagonal — the camera's view center line.
  // Verified by projection math: screenX = 0.707*(x-z)/depth, so x≈z keeps buildings
  // centered. Small x-z offsets (±3) spread them left/right without going off-screen.
  // Near row (depth 32-40), far row (depth 40-50), all visible from camera.
  const buildingDefs = CONFIG.ENVIRONMENT.CITY.BUILDINGS;

  const edgeMat1 = new THREE.MeshBasicMaterial({ color: 0x00ffff });
  const edgeMat2 = new THREE.MeshBasicMaterial({ color: 0xff00ff });

  buildingDefs.forEach(({ x, w, d, h, z }, index) => {
    const edgeMat = (index % 2 === 0) ? edgeMat1 : edgeMat2;
    const group = createBuilding(w, d, h, buildingMat, edgeMat);
    group.position.set(x, h / 2 - 6.2, z);
    group.rotation.y = Math.PI / 4;
    scene.add(group);
    cityObjects.push(group);

    // Generate window grid on the front face (facing +z locally)
    const startY = -h / 2 + 0.5;
    const endY = h / 2 - 0.5;
    const startX = -w / 2 + 0.3;
    const endX = w / 2 - 0.3;
    
    for (let wy = startY; wy <= endY; wy += 0.5) {
      for (let wx = startX; wx <= endX; wx += 0.4) {
        if (Math.random() > 0.4) { // Not all windows have light
          const wGeo = new THREE.BoxGeometry(0.2, 0.2, 0.05);
          const mat = windowMats[Math.floor(Math.random() * windowMats.length)];
          const win = new THREE.Mesh(wGeo, mat);
          
          // Add window as a child of the building group so it inherits rotation
          win.position.set(wx, wy, d / 2 + 0.05);
          group.add(win);
          
          if (Math.random() > 0.85) { // 15% chance to be a blinking window
            blinkingWindows.push(win);
          }
        }
      }
    }
  });

  // Far row — darker silhouettes, all along x≈z diagonal
  const distantBuildingMat = new THREE.MeshLambertMaterial({ color: 0x0c0020 });
  const distantDefs = CONFIG.ENVIRONMENT.CITY.DISTANT_BUILDINGS;

  distantDefs.forEach(({ x, w, d, h, z }) => {
    const group = new THREE.Group();
    const geo  = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, distantBuildingMat);
    group.add(mesh);

    group.position.set(x, h / 2 - 6.2, z);
    group.rotation.y = Math.PI / 4;
    scene.add(group);
    cityObjects.push(group);

    const startY = -h / 2 + 0.5;
    const endY = h / 2 - 0.5;
    const startX = -w / 2 + 0.3;
    const endX = w / 2 - 0.3;
    
    for (let wy = startY; wy <= endY; wy += 0.5) {
      for (let wx = startX; wx <= endX; wx += 0.4) {
        if (Math.random() > 0.7) { // sparser for distant buildings
          const wGeo = new THREE.BoxGeometry(0.12, 0.12, 0.05);
          const mat = windowMats[Math.floor(Math.random() * windowMats.length)];
          const win = new THREE.Mesh(wGeo, mat);
          win.position.set(wx, wy, d / 2 + 0.05);
          group.add(win);
          
          if (Math.random() > 0.85) {
            blinkingWindows.push(win);
          }
        }
      }
    }
  });

  const envState = { cityObjects, gridMaterial, blinkingWindows };
  createWireframeMountains(scene);
  createDigitalRain(scene, envState);
  createParallaxWireframes(scene, envState);
  return { cyanLight, magentaLight, envState };
}

export function updateEnvironment(envState, dt, isMoving = false) {
  if (isMoving) {
    const parallaxSpeed = CONFIG.ENVIRONMENT.PARALLAX_SPEED;
    const wrapZ = CONFIG.ENVIRONMENT.CITY.WRAP_Z;
    const wrapDist = CONFIG.ENVIRONMENT.CITY.WRAP_DISTANCE;

    // 1. Move & Wrap Buildings
    if (envState.cityObjects) {
      for (const obj of envState.cityObjects) {
        obj.position.x += parallaxSpeed * dt;
        obj.position.z += parallaxSpeed * dt;
        
        // Wrap buildings when they go past camera view (Z=WRAP_Z)
        if (obj.position.z > wrapZ) {
          obj.position.x -= wrapDist;
          obj.position.z -= wrapDist;
        }
      }
    }

    // 2. Infinite Grid Scroll
    if (envState.gridMaterial) {
      envState.gridMaterial.uniforms.uOffset.value += parallaxSpeed * dt;
    }
  }

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

  if (envState.blinkingWindows) {
    for (const win of envState.blinkingWindows) {
      if (Math.random() < 0.02 * dt) {
        win.visible = !win.visible;
      }
    }
  }
}
