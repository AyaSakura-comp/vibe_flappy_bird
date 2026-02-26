import { CONFIG } from './constants.js';
import * as THREE from 'three';

/**
 * Create a laser net mesh centered in a pipe gap.
 * @param {number} gapTop - top of pipe gap
 * @param {number} gapBot - bottom of pipe gap
 * @returns {{ mesh: THREE.Mesh, hitTop: number, hitBot: number }}
 */
export function createLaserNet(gapTop, gapBot) {
  const gapHeight = gapTop - gapBot;
  const laserHeight = gapHeight * CONFIG.LASER.GAP_FRACTION;
  const gapCenter = (gapTop + gapBot) / 2;
  const hitTop = gapCenter + laserHeight / 2;
  const hitBot = gapCenter - laserHeight / 2;

  // Animated plane spanning the pipe width (diameter = 2.0)
  const geo = new THREE.PlaneGeometry(2.0, laserHeight);
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uColor1: { value: new THREE.Color(0xff2200) },
      uColor2: { value: new THREE.Color(0xffcc00) },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uColor1;
      uniform vec3 uColor2;
      varying vec2 vUv;
      void main() {
        float scanline = sin(vUv.y * 40.0 + uTime * 8.0) * 0.5 + 0.5;
        float pulse = sin(uTime * 4.0) * 0.3 + 0.7;
        vec3 col = mix(uColor1, uColor2, scanline) * pulse;
        float edgeFade = smoothstep(0.0, 0.1, vUv.x) * smoothstep(1.0, 0.9, vUv.x);
        gl_FragColor = vec4(col, (0.7 + scanline * 0.3) * edgeFade * pulse);
      }
    `,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = gapCenter;
  // Rotate to face the angled camera (camera is at x=15, z=15 looking at origin)
  mesh.lookAt(15, gapCenter, 15);
  mesh.frustumCulled = false;

  return { mesh, hitTop, hitBot };
}

/**
 * Update laser net shader animation.
 * @param {THREE.Mesh} mesh - the laser net mesh
 * @param {number} time - current time in seconds
 */
export function updateLaserShader(mesh, time) {
  if (mesh.material.uniforms) {
    mesh.material.uniforms.uTime.value = time;
  }
}

/**
 * Check if bird overlaps a pipe's laser net.
 * @param {number} birdY - bird Y position
 * @param {object} pipe - pipe object with .laser and .group.position.z
 * @param {number} margin - bird hitbox half-height (default 0.1)
 * @returns {boolean}
 */
export function checkLaserCollision(birdY, pipe, margin = 0.1) {
  if (!pipe.laser) return false;
  const pz = pipe.group.position.z;
  if (pz <= -2.0 || pz >= 1.5) return false;
  const { hitTop, hitBot } = pipe.laser;
  if (birdY - margin < hitTop && birdY + margin > hitBot) return true;
  return false;
}

/**
 * Get the current laser spawn chance based on score.
 * @param {number} score
 * @returns {number}
 */
export function getLaserChance(score) {
  return Math.min(
    CONFIG.LASER.MAX_CHANCE,
    CONFIG.LASER.SPAWN_CHANCE + score * CONFIG.LASER.CHANCE_PER_SCORE
  );
}

/**
 * Determine if a laser should spawn for a given pipe.
 * @param {number} pipeIndex - the current pipe count (0-based)
 * @param {number} score - current score
 * @returns {boolean}
 */
export function shouldSpawnLaser(pipeIndex, score) {
  if (pipeIndex < CONFIG.LASER.WARMUP_PIPES) return false;
  return Math.random() < getLaserChance(score);
}
