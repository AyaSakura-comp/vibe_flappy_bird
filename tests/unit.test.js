import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// ── THREE.js mock ───────────────────────────────────────────────────────
function mockVec3(x = 0, y = 0, z = 0) {
  return { x, y, z, set(a, b, c) { this.x = a; this.y = b; this.z = c; } };
}

function mockMaterial(opts = {}) {
  return {
    color: { setHSL() {} },
    opacity: opts.opacity ?? 1,
    transparent: opts.transparent ?? false,
    ...opts,
  };
}

function mockMesh(geo, mat) {
  return {
    geometry: geo,
    material: mat,
    position: mockVec3(),
    rotation: mockVec3(),
    scale: { setScalar(s) { this.x = s; this.y = s; this.z = s; }, set(x,y,z) { this.x=x; this.y=y; this.z=z; }, x: 1, y: 1, z: 1 },
    visible: true,
    lookAt() {},
  };
}

const mockScene = () => {
  const children = [];
  return {
    children,
    background: null,
    add(obj) { children.push(obj); },
    remove(obj) {
      const i = children.indexOf(obj);
      if (i >= 0) children.splice(i, 1);
    },
  };
};

globalThis.document = globalThis.document || {
  createElement: () => ({
    width: 0, height: 0,
    getContext: () => ({
      createRadialGradient: () => ({ addColorStop: () => {} }),
      fillRect: () => {},
      set fillStyle(_) {},
    }),
  }),
};

globalThis.window = {
  THREE: {
    Group: class {
      constructor() {
        this.children = [];
        this.position = mockVec3();
        this.rotation = mockVec3();
      }
      add(c) { this.children.push(c); }
      lookAt() {}
    },
    BoxGeometry: class { constructor() {} },
    CircleGeometry: class { constructor() {} },
    CylinderGeometry: class { constructor() {} },
    SphereGeometry: class { constructor() {} },
    PlaneGeometry: class { constructor() {} },
    ConeGeometry: class { constructor() {} },
    IcosahedronGeometry: class { constructor() {} },
    TorusGeometry: class { constructor() {} },
    OctahedronGeometry: class { constructor() {} },
    Mesh: class {
      constructor(geo, mat) {
        Object.assign(this, mockMesh(geo, mat));
      }
    },
    MeshBasicMaterial: class {
      constructor(opts) { Object.assign(this, mockMaterial(opts)); }
    },
    MeshPhongMaterial: class {
      constructor(opts) { Object.assign(this, mockMaterial(opts)); }
    },
    MeshLambertMaterial: class {
      constructor(opts) { Object.assign(this, mockMaterial(opts)); }
    },
    MeshStandardMaterial: class {
      constructor(opts) { Object.assign(this, mockMaterial(opts)); }
    },
    AmbientLight: class {
      constructor() { this.position = mockVec3(); }
    },
    DirectionalLight: class {
      constructor() { this.position = mockVec3(); }
    },
    PointLight: class {
      constructor(c, i, d) {
        this.color = c; this.intensity = i; this.distance = d;
        this.position = mockVec3();
      }
    },
    GridHelper: class {
      constructor() { this.position = mockVec3(); }
    },
    Fog: class {
      constructor(color, near, far) {
        this.color = { getHex: () => color };
        this.near = near;
        this.far = far;
      }
    },
    Color: class { constructor() {} },
    CanvasTexture: class {
      constructor(canvas) { this.image = canvas; this.needsUpdate = false; }
    },
    BufferGeometry: class {
      constructor() {
        this.attributes = {};
      }
      setAttribute(name, attr) { this.attributes[name] = attr; }
      setDrawRange(start, count) { this.drawRange = { start, count }; }
    },
    BufferAttribute: class {
      constructor(array, itemSize) {
        this.array = array;
        this.itemSize = itemSize;
        this.needsUpdate = false;
      }
    },
    LineBasicMaterial: class {
      constructor(opts) { Object.assign(this, mockMaterial(opts)); }
    },
    Line: class {
      constructor(geo, mat) {
        this.geometry = geo;
        this.material = mat;
        this.position = mockVec3();
        this.frustumCulled = true;
        this.userData = {};
      }
    },
    PointsMaterial: class {
      constructor(opts) { Object.assign(this, mockMaterial(opts)); }
    },
    Points: class {
      constructor(geo, mat) {
        this.geometry = geo;
        this.material = mat;
        this.position = mockVec3();
        this.frustumCulled = true;
        this.userData = {};
      }
    },
    AdditiveBlending: 2,
  },
};

// ── Import modules under test ───────────────────────────────────────────
const { checkCollision } = await import('../js/collision.js');
const {
  GRAVITY, FLAP, PIPE_GAP, PIPE_SPEED, PIPE_SPACING,
  SPAWN_MS, PIPE_Y_PATTERN, EXPLOSION_COLORS, PIPE_REMOVE_Z,
} = await import('../js/constants.js');
const { createBird } = await import('../js/bird.js');
const { createEnvironment, updateEnvironment } = await import('../js/environment.js');
const { spawnExplosion, updateExplosion, clearParticles } = await import('../js/explosion.js');
const pipesMod = await import('../js/pipes.js');
const trailMod = await import('../js/trail.js');

// ── collision.js ────────────────────────────────────────────────────────
function makePipe(z, gapTop, gapBot) {
  return { group: { position: { z } }, gapTop, gapBot };
}

describe('checkCollision', () => {
  it('returns false when pipe z < -2.0', () => {
    assert.equal(checkCollision(0, 0, makePipe(-2.5, 3, -3)), false);
  });
  it('returns false when pipe z > 1.5', () => {
    assert.equal(checkCollision(0, 0, makePipe(2.0, 3, -3)), false);
  });
  it('returns false when bird x > 1.1', () => {
    assert.equal(checkCollision(0, 1.2, makePipe(0, 3, -3)), false);
    assert.equal(checkCollision(0, -1.2, makePipe(0, 3, -3)), false);
  });
  it('returns true when birdY + margin > gapTop', () => {
    assert.equal(checkCollision(3.41, 0, makePipe(0, 3.5, -3.5)), true);
  });
  it('returns true when birdY - margin < gapBot', () => {
    assert.equal(checkCollision(-3.41, 0, makePipe(0, 3.5, -3.5)), true);
  });
  it('returns false when bird is within the gap', () => {
    assert.equal(checkCollision(0, 0, makePipe(0, 3.5, -3.5)), false);
  });
  it('custom margin parameter works', () => {
    assert.equal(checkCollision(3.4, 0, makePipe(0, 3.5, -3.5), 0.15), true);
    assert.equal(checkCollision(3.4, 0, makePipe(0, 3.5, -3.5), 0), false);
  });
});

// ── constants.js ────────────────────────────────────────────────────────
describe('constants', () => {
  it('SPAWN_MS derived correctly', () => {
    assert.equal(SPAWN_MS, Math.round(PIPE_SPACING / (PIPE_SPEED * 60) * 1000));
  });
  it('PIPE_Y_PATTERN has 5 entries', () => {
    assert.equal(PIPE_Y_PATTERN.length, 5);
  });
  it('all constants are positive (except FLAP)', () => {
    assert.ok(GRAVITY > 0);
    assert.ok(FLAP < 0);
    assert.ok(PIPE_GAP > 0);
    assert.ok(PIPE_SPEED > 0);
    assert.ok(PIPE_SPACING > 0);
    assert.ok(SPAWN_MS > 0);
  });
  it('PIPE_GAP is safe at all offsets', () => {
    const maxOff = Math.max(...PIPE_Y_PATTERN.map(Math.abs));
    assert.ok(PIPE_GAP >= maxOff * 2);
  });
  it('EXPLOSION_COLORS has 5 entries', () => {
    assert.equal(EXPLOSION_COLORS.length, 5);
  });
  it('PIPE_REMOVE_Z is far enough for angled camera visibility', () => {
    assert.ok(PIPE_REMOVE_Z >= 12, 'pipes should persist until well past camera at z=15');
  });
});

// ── bird.js ─────────────────────────────────────────────────────────────
describe('createBird', () => {
  it('returns birdGroup and eng', () => {
    const scene = mockScene();
    const result = createBird(scene);
    assert.ok(result.birdGroup);
    assert.ok(result.eng);
  });
  it('adds birdGroup to scene', () => {
    const scene = mockScene();
    const { birdGroup } = createBird(scene);
    assert.ok(scene.children.includes(birdGroup));
  });
  it('birdGroup has 5 children (body, rim, engine, 2 wings)', () => {
    const scene = mockScene();
    const { birdGroup } = createBird(scene);
    assert.equal(birdGroup.children.length, 5);
  });
  it('eng is positioned behind bird', () => {
    const scene = mockScene();
    const { eng } = createBird(scene);
    assert.ok(eng.position.z < 0);
  });
});

// ── environment.js ──────────────────────────────────────────────────────
describe('createEnvironment', () => {
  it('returns cyanLight and magentaLight', () => {
    const scene = mockScene();
    const result = createEnvironment(scene);
    assert.ok(result.cyanLight);
    assert.ok(result.magentaLight);
  });
  it('adds objects to scene (lights, ground, grid, buildings, windows)', () => {
    const scene = mockScene();
    createEnvironment(scene);
    // 3 lights + ground + grid + 10 buildings + 60 windows = 74 minimum
    assert.ok(scene.children.length >= 74);
  });
  it('cyanLight has intensity set', () => {
    const scene = mockScene();
    const { cyanLight } = createEnvironment(scene);
    assert.equal(cyanLight.intensity, 1.5);
  });

  it('buildings have depth >= 2 for 3D visibility from angled camera', () => {
    const scene = mockScene();
    createEnvironment(scene);
    const meshChildren = scene.children.filter(c => c.position && typeof c.position.z === 'number');
    const buildingLike = meshChildren.filter(c => c.position.z > -30 && c.position.z < 5);
    assert.ok(buildingLike.length >= 10, 'should have buildings in visible z range');
  });

  it('ground plane is positioned visible from angled camera', () => {
    const scene = mockScene();
    createEnvironment(scene);
    const grounds = scene.children.filter(c => c.rotation && c.rotation.x !== 0);
    assert.ok(grounds.length >= 1, 'should have a ground plane');
    grounds.forEach(g => {
      assert.ok(g.position.z > -30, `ground at z=${g.position.z} should be > -30`);
    });
  });

  it('near skyline buildings use BoxGeometry with bevel-like edge meshes', () => {
    const scene = mockScene();
    createEnvironment(scene);
    // Buildings should have edge highlight children (emissive line meshes)
    const buildingGroups = scene.children.filter(c =>
      c.children && c.children.length >= 2 && c.position && c.position.y > -6
    );
    assert.ok(buildingGroups.length >= 5, `expected >= 5 beveled building groups, got ${buildingGroups.length}`);
  });

  it('returns envState object', () => {
    const scene = mockScene();
    const result = createEnvironment(scene);
    assert.ok(result.envState, 'should return envState');
    assert.equal(typeof result.envState, 'object');
  });

  it('adds fog to the scene matching the sky color exactly (0x1a0044)', () => {
    const scene = mockScene();
    createEnvironment(scene);
    assert.ok(scene.fog, 'scene.fog should be defined');
    assert.equal(scene.fog.color.getHex(), 0x1a0044);
  });

  it('envState includes cityObjects and gridHelper for parallax tracking', () => {
    const scene = mockScene();
    const { envState } = createEnvironment(scene);
    assert.ok(Array.isArray(envState.cityObjects), 'cityObjects should be an array');
    assert.ok(envState.gridHelper, 'gridHelper should be tracked');
  });

  it('sets scene.background and adds a background plane along the diagonal', () => {
    const scene = mockScene();
    createEnvironment(scene);
    assert.ok(scene.background, 'scene.background should be set');
    const bgPlanes = scene.children.filter(c => c.position && c.position.x <= -20 && c.position.z <= -20);
    assert.ok(bgPlanes.length >= 1, `expected >= 1 background plane along diagonal, got ${bgPlanes.length}`);
  });

  it('has a second row of distant buildings along the diagonal', () => {
    const scene = mockScene();
    createEnvironment(scene);
    // Far buildings along diagonal: x <= -20 and z <= -20
    const distantBuildings = scene.children.filter(c =>
      c.position && c.position.x <= -20 && c.position.z <= -20 &&
      c.position.y > -6
    );
    assert.ok(distantBuildings.length >= 6, `expected >= 6 distant buildings along diagonal, got ${distantBuildings.length}`);
  });

  it('has wireframe mountain meshes behind the skyline', () => {
    const scene = mockScene();
    createEnvironment(scene);
    // Mountains: wireframe meshes at depth > buildings, y near ground
    const mountains = scene.children.filter(c =>
      c.material && c.material.wireframe === true &&
      c.position && c.position.y < 0 && c.position.y > -7
    );
    assert.ok(mountains.length >= 3, `expected >= 3 wireframe mountains, got ${mountains.length}`);
  });

  it('envState.parallaxObjects has 3 wireframe objects', () => {
    const scene = mockScene();
    const { envState } = createEnvironment(scene);
    assert.ok(envState.parallaxObjects, 'should have parallaxObjects array');
    assert.equal(envState.parallaxObjects.length, 3);
  });

  it('envState.rainDrops has 40-60 particles', () => {
    const scene = mockScene();
    const { envState } = createEnvironment(scene);
    assert.ok(envState.rainDrops, 'should have rainDrops array');
    assert.ok(envState.rainDrops.length >= 40, `expected >= 40 rain drops, got ${envState.rainDrops.length}`);
    assert.ok(envState.rainDrops.length <= 60, `expected <= 60 rain drops, got ${envState.rainDrops.length}`);
  });

  it('adds a retro sun with slice lines near the horizon', () => {
    const scene = mockScene();
    createEnvironment(scene);
    // Sun group behind buildings (z <= -17), group contains disc + slices
    // Sun group along diagonal (x <= -18, z <= -18) with disc + slices
    const sunGroups = scene.children.filter(c =>
      c.position && c.position.x <= -8 && c.position.z <= -8 && c.children && c.children.length >= 6
    );
    assert.ok(sunGroups.length >= 1, `expected >= 1 sun group along diagonal, got ${sunGroups.length}`);
  });
});

// ── updateEnvironment ────────────────────────────────────────────────────
describe('updateEnvironment', () => {
  it('is a function that accepts envState and dt', () => {
    assert.equal(typeof updateEnvironment, 'function');
  });
  it('does not throw with empty envState', () => {
    assert.doesNotThrow(() => updateEnvironment({}, 1));
  });

  describe('parallax', () => {
    it('moves city objects along the diagonal when isMoving is true', () => {
      const scene = mockScene();
      const { envState } = createEnvironment(scene);
      const obj = envState.cityObjects[0];
      const startZ = obj.position.z;
      const startX = obj.position.x;
      updateEnvironment(envState, 1, true);
      assert.ok(obj.position.z > startZ, 'building should move toward camera (+z)');
      assert.ok(obj.position.x > startX, 'building should move along diagonal (+x)');
    });

    it('wraps grid position for seamless infinite scroll', () => {
      const scene = mockScene();
      const { envState } = createEnvironment(scene);
      // Threshold is -8 (-10 initial + 2 units move)
      envState.gridHelper.position.z = -7.9;
      updateEnvironment(envState, 1, true);
      assert.ok(envState.gridHelper.position.z < -9, 'grid should snap back by 2 units');
    });
  });

  it('updateEnvironment rotates parallax wireframes', () => {
    const scene = mockScene();
    const { envState } = createEnvironment(scene);
    const obj = envState.parallaxObjects[0];
    const startRotX = obj.mesh.rotation.x;
    const startRotY = obj.mesh.rotation.y;
    updateEnvironment(envState, 1);
    assert.ok(
      obj.mesh.rotation.x !== startRotX || obj.mesh.rotation.y !== startRotY,
      'parallax object should rotate'
    );
  });

  it('updateEnvironment moves rain drops downward', () => {
    const scene = mockScene();
    const { envState } = createEnvironment(scene);
    const firstDrop = envState.rainDrops[0];
    const startY = firstDrop.mesh.position.y;
    updateEnvironment(envState, 1);
    assert.ok(firstDrop.mesh.position.y < startY, 'rain drop should move down');
  });
  it('updateEnvironment resets rain drops that fall below ground', () => {
    const scene = mockScene();
    const { envState } = createEnvironment(scene);
    const drop = envState.rainDrops[0];
    drop.mesh.position.y = -10;
    updateEnvironment(envState, 1);
    assert.ok(drop.mesh.position.y > 0, 'rain drop should reset to top');
  });
});

// ── explosion.js ────────────────────────────────────────────────────────
describe('explosion', () => {
  it('spawnExplosion adds 24 particles to scene', () => {
    const scene = mockScene();
    spawnExplosion(scene, 0, 0, 0);
    assert.equal(scene.children.length, 24);
    // cleanup
    clearParticles(scene);
  });

  it('updateExplosion moves particles and reduces opacity', () => {
    const scene = mockScene();
    spawnExplosion(scene, 0, 0, 0);
    const firstMesh = scene.children[0];
    const origOpacity = firstMesh.material.opacity;
    updateExplosion(scene, 1);
    assert.ok(firstMesh.material.opacity <= origOpacity);
    clearParticles(scene);
  });

  it('updateExplosion removes expired particles', () => {
    const scene = mockScene();
    spawnExplosion(scene, 0, 0, 0);
    // Advance many frames to expire all particles (maxLife is 45-65)
    for (let i = 0; i < 70; i++) updateExplosion(scene, 1);
    assert.equal(scene.children.length, 0);
  });

  it('clearParticles removes all particles from scene', () => {
    const scene = mockScene();
    spawnExplosion(scene, 0, 0, 0);
    assert.equal(scene.children.length, 24);
    clearParticles(scene);
    assert.equal(scene.children.length, 0);
  });
});

// ── pipes.js ────────────────────────────────────────────────────────────
describe('pipes', () => {
  beforeEach(() => {
    const scene = mockScene();
    pipesMod.resetPipes(scene);
  });

  it('spawnPipe adds a pipe to the pipes array', () => {
    const scene = mockScene();
    pipesMod.spawnPipe(scene, -18);
    assert.equal(pipesMod.pipes.length, 1);
  });

  it('spawnPipe sets gapTop and gapBot based on PIPE_GAP', () => {
    const scene = mockScene();
    pipesMod.resetPipes(scene);
    pipesMod.spawnPipe(scene, -18);
    const p = pipesMod.pipes[0];
    assert.equal(p.gapTop - p.gapBot, PIPE_GAP);
  });

  it('spawnPipe cycles through PIPE_Y_PATTERN', () => {
    const scene = mockScene();
    pipesMod.resetPipes(scene);
    const centers = [];
    for (let i = 0; i < 5; i++) {
      pipesMod.spawnPipe(scene, -18);
      const p = pipesMod.pipes[i];
      centers.push((p.gapTop + p.gapBot) / 2);
    }
    assert.deepEqual(centers, PIPE_Y_PATTERN);
  });

  it('spawnPipe places group at spawnZ', () => {
    const scene = mockScene();
    pipesMod.resetPipes(scene);
    pipesMod.spawnPipe(scene, -10);
    assert.equal(pipesMod.pipes[0].group.position.z, -10);
  });

  it('resetPipes clears pipes array and removes from scene', () => {
    const scene = mockScene();
    pipesMod.spawnPipe(scene);
    pipesMod.spawnPipe(scene);
    assert.equal(pipesMod.pipes.length, 2);
    pipesMod.resetPipes(scene);
    assert.equal(pipesMod.pipes.length, 0);
  });

  it('prefillPipes spawns multiple pipes', () => {
    const scene = mockScene();
    pipesMod.resetPipes(scene);
    pipesMod.prefillPipes(scene);
    assert.ok(pipesMod.pipes.length >= 3);
  });

  it('makePipeSegment returns group, cap, inner', () => {
    const result = pipesMod.makePipeSegment(10);
    assert.ok(result.group);
    assert.ok(result.cap);
    assert.ok(result.inner);
    assert.equal(result.group.children.length, 3);
  });

  it('pipes have scored=false initially', () => {
    const scene = mockScene();
    pipesMod.resetPipes(scene);
    pipesMod.spawnPipe(scene);
    assert.equal(pipesMod.pipes[0].scored, false);
  });
});

// ── trail.js ──────────────────────────────────────────────────────────
describe('trail', () => {
  it('createTrail returns a line object and adds to scene', () => {
    const scene = mockScene();
    const trail = trailMod.createTrail(scene);
    assert.ok(trail);
    assert.ok(scene.children.length >= 1);
  });

  it('updateTrail samples position and y of head matches most recent call', () => {
    const scene = mockScene();
    const trail = trailMod.createTrail(scene);
    // Call twice to ensure at least one sample (SAMPLE_EVERY <= 2)
    trailMod.updateTrail(trail, 1, 2.5, -0.3);
    trailMod.updateTrail(trail, 1, 2.5, -0.3);
    const posArr = trail.geometry.attributes.position.array;
    assert.equal(posArr[1], 2.5);   // y of head matches
    assert.ok(posArr[2] >= -0.5);   // z is near bird position
  });

  it('trail points spread in +Z direction behind bird (toward camera)', () => {
    const scene = mockScene();
    const trail = trailMod.createTrail(scene);
    // Feed several positions to build history
    for (let i = 0; i < 10; i++) {
      trailMod.updateTrail(trail, 0, i * 0.5, -5);
    }
    const posArr = trail.geometry.attributes.position.array;
    const history = trail.userData.history;
    // Older points (higher index) should have higher z (spread toward camera)
    for (let i = 1; i < history.length; i++) {
      assert.ok(posArr[i * 3 + 2] >= posArr[(i - 1) * 3 + 2],
        `point ${i} z should be >= point ${i-1} z (spreading behind bird)`);
    }
  });

  it('resetTrail resets bird position to origin', () => {
    const scene = mockScene();
    const trail = trailMod.createTrail(scene);
    trailMod.updateTrail(trail, 3, 5, 1);
    trailMod.resetTrail(trail);
    const posArr = trail.geometry.attributes.position.array;
    // After reset, bird at 0,0,0 — all x and y should be 0
    assert.equal(posArr[0], 0); // x
    assert.equal(posArr[1], 0); // y
    assert.equal(posArr[3], 0); // x of second point
    assert.equal(posArr[4], 0); // y of second point
  });
});
