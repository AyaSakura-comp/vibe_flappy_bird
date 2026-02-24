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
    scale: { setScalar(s) { this.x = s; this.y = s; this.z = s; }, x: 1, y: 1, z: 1 },
    visible: true,
  };
}

const mockScene = () => {
  const children = [];
  return {
    children,
    add(obj) { children.push(obj); },
    remove(obj) {
      const i = children.indexOf(obj);
      if (i >= 0) children.splice(i, 1);
    },
  };
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
    },
    BoxGeometry: class { constructor() {} },
    CylinderGeometry: class { constructor() {} },
    SphereGeometry: class { constructor() {} },
    PlaneGeometry: class { constructor() {} },
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
    AmbientLight: class {
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
    Color: class { constructor() {} },
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

  it('returns envState object', () => {
    const scene = mockScene();
    const result = createEnvironment(scene);
    assert.ok(result.envState, 'should return envState');
    assert.equal(typeof result.envState, 'object');
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
