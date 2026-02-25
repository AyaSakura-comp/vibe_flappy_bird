import { EXPLOSION_COLORS } from './constants.js';
import * as THREE from 'three';

const particles = [];

export function spawnExplosion(scene, x, y, z) {
  for (let i = 0; i < 24; i++) {
    const size = 0.06 + Math.random() * 0.12;
    const geo  = new THREE.BoxGeometry(size, size, size);
    const mat  = new THREE.MeshBasicMaterial({
      color: EXPLOSION_COLORS[Math.floor(Math.random() * EXPLOSION_COLORS.length)],
      transparent: true,
      opacity: 1,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    scene.add(mesh);

    const speed = 0.08 + Math.random() * 0.18;
    const theta = Math.random() * Math.PI * 2;
    const phi   = (Math.random() - 0.5) * Math.PI;
    particles.push({
      mesh,
      vx: Math.cos(theta) * Math.cos(phi) * speed,
      vy: Math.sin(phi) * speed + 0.04,
      vz: Math.sin(theta) * Math.cos(phi) * speed * 0.4,
      life: 0,
      maxLife: 45 + Math.random() * 20,
    });
  }
}

export function updateExplosion(scene, dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life += dt;
    const t = p.life / p.maxLife;
    if (t >= 1) {
      scene.remove(p.mesh);
      particles.splice(i, 1);
      continue;
    }
    p.mesh.position.x += p.vx * dt;
    p.mesh.position.y += p.vy * dt;
    p.mesh.position.z += p.vz * dt;
    p.vy -= 0.006 * dt;
    p.mesh.material.opacity = 1 - t;
    const scale = 1 - t * 0.5;
    p.mesh.scale.setScalar(scale);
  }
}

export function clearParticles(scene) {
  particles.forEach(p => scene.remove(p.mesh));
  particles.length = 0;
}
