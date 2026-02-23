import { GRAVITY, FLAP, PIPE_SPEED, SPAWN_MS } from './constants.js';
import { createBird } from './bird.js';
import { createEnvironment } from './environment.js';
import { pipes, spawnPipe, prefillPipes, resetPipes, pipeCount } from './pipes.js';
import { spawnExplosion, updateExplosion, clearParticles } from './explosion.js';
import { checkCollision } from './collision.js';
import { createTrail, updateTrail, resetTrail } from './trail.js';

const THREE = window.THREE;

// ── Scene setup ──────────────────────────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050010);

const camera = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight, 0.1, 400);
camera.position.set(0, 0, 20);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.body.appendChild(renderer.domElement);

// ── Environment ──────────────────────────────────────────────────────────
const { cyanLight, magentaLight } = createEnvironment(scene);

// ── Bird ─────────────────────────────────────────────────────────────────
const { birdGroup, eng } = createBird(scene);
const trail = createTrail(scene);

// ── Game state ───────────────────────────────────────────────────────────
let velocity  = 0;
let score     = 0;
let started   = false;
let gameOver  = false;
let animId    = null;
let lastSpawn = 0;

// Screen shake state
let shakeAmp = 0;     // current shake amplitude (decays to 0)
const SHAKE_DECAY = 0.92; // multiplier per frame at 60fps (~2s duration)
const SHAKE_INIT  = 1.2;  // initial amplitude on game over (in world units)

const scoreEl      = document.getElementById('score');
const overlayEl    = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayMsg   = document.getElementById('overlay-msg');

// ── Input ────────────────────────────────────────────────────────────────
function handleInput() {
  if (gameOver) return;
  if (!started) {
    started = true;
    lastSpawn = performance.now();
    overlayEl.classList.add('hidden');
  }
  velocity = FLAP;
}

function tryRestart() {
  if (gameOver && !overlayEl.classList.contains('hidden')) restartGame();
}

document.addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
    e.preventDefault();
    gameOver ? tryRestart() : handleInput();
  }
});
document.addEventListener('click', () => gameOver ? tryRestart() : handleInput());

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ── Game over / restart ──────────────────────────────────────────────────
function triggerGameOver() {
  gameOver = true;
  shakeAmp = SHAKE_INIT;
  spawnExplosion(
    scene,
    birdGroup.position.x,
    Math.max(-4, Math.min(4, birdGroup.position.y)),
    birdGroup.position.z
  );
  birdGroup.visible = false;
  const finalScore = score;
  setTimeout(() => {
    overlayTitle.textContent = 'SYSTEM FAILURE';
    overlayMsg.textContent   = '[ SCORE: ' + finalScore + ' ]  //  CLICK TO REBOOT';
    overlayEl.classList.remove('hidden');
  }, 900);
}

function restartGame() {
  resetPipes(scene);
  clearParticles(scene);
  birdGroup.visible = true;
  birdGroup.position.set(0, 0, 0);
  birdGroup.rotation.z = 0;
  resetTrail(trail);
  velocity = 0; score = 0; started = false; gameOver = false; shakeAmp = 0;
  scoreEl.textContent = '0';
  overlayTitle.textContent = 'CYBER FLAP';
  overlayMsg.textContent   = '[ CLICK OR SPACE TO JACK IN ]';
  overlayEl.classList.remove('hidden');
  prefillPipes(scene);
  lastSpawn = performance.now();
  prevTime = performance.now();
}

// ── Animation loop ───────────────────────────────────────────────────────
let prevTime = performance.now();
function loop(now) {
  animId = requestAnimationFrame(loop);
  const dt = Math.min((now - prevTime) / (1000 / 60), 3);
  prevTime = now;

  if (started && !gameOver) {
    velocity += GRAVITY * dt;
    birdGroup.position.y -= velocity * dt;
    updateTrail(trail, birdGroup.position.x, birdGroup.position.y, birdGroup.position.z - 0.3);
    const targetRot = Math.max(-0.6, Math.min(0.6, velocity * 4));
    birdGroup.rotation.z += (targetRot - birdGroup.rotation.z) * 0.15 * dt;

    eng.material.color.setHSL((now * 0.001) % 1, 1, 0.6);

    if (now - lastSpawn >= SPAWN_MS) { spawnPipe(scene); lastSpawn = now; }

    for (let i = pipes.length - 1; i >= 0; i--) {
      const p = pipes[i];
      p.group.position.z += PIPE_SPEED * dt;

      if (!p.scored && p.group.position.z > 1) {
        p.scored = true;
        score++;
        scoreEl.textContent = score;
      }

      if (p.group.position.z > 2) {
        scene.remove(p.group);
        pipes.splice(i, 1);
        continue;
      }

      if (checkCollision(birdGroup.position.y, birdGroup.position.x, p)) {
        triggerGameOver(); return;
      }
    }

    if (birdGroup.position.y > 6 || birdGroup.position.y < -6) {
      triggerGameOver(); return;
    }
  }

  updateExplosion(scene, dt);

  cyanLight.intensity    = 1.5 + Math.sin(now * 0.003) * 0.3;
  magentaLight.intensity = 1.2 + Math.cos(now * 0.004) * 0.3;

  // Expose state for Playwright adaptive test
  window.__FLAPPY_BIRD_Y  = birdGroup.position.y;
  window.__FLAPPY_SCORE   = score;
  window.__FLAPPY_STARTED = started;
  window.__FLAPPY_OVER    = gameOver;
  const _np = pipes.filter(p => !p.scored).sort((a, b) => b.group.position.z - a.group.position.z)[0];
  window.__FLAPPY_NEXT_GAP_Y = _np ? (_np.gapTop + _np.gapBot) / 2 : 0;
  window.__FLAPPY_NEXT_GAP_TOP = _np ? _np.gapTop : 0;
  window.__FLAPPY_NEXT_GAP_BOT = _np ? _np.gapBot : 0;
  window.__FLAPPY_SHAKE_AMP    = shakeAmp;

  // Screen shake — sine wave at ~8Hz so it's visible in compressed video
  if (shakeAmp > 0.001) {
    const sx = Math.sin(now * 0.05) * shakeAmp;
    const sy = Math.cos(now * 0.07) * shakeAmp;
    camera.position.set(sx, sy, 20);
    shakeAmp *= Math.pow(SHAKE_DECAY, dt);
  } else {
    shakeAmp = 0;
    camera.position.set(0, 0, 20);
  }

  renderer.render(scene, camera);
}

// ── Init ─────────────────────────────────────────────────────────────────
prefillPipes(scene);
lastSpawn = performance.now();
animId = requestAnimationFrame(loop);
