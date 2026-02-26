import { CONFIG, SPAWN_MS, GRAVITY, FLAP, PIPE_SPEED, PIPE_REMOVE_Z } from './constants.js';
import { createBird } from './bird.js';

// Expose CONFIG for tests and debugging
window.__GAME_CONFIG = CONFIG;

import { createEnvironment, updateEnvironment } from './environment.js';
import { pipes, spawnPipe, prefillPipes, resetPipes, pipeCount } from './pipes.js';
import { spawnExplosion, updateExplosion, clearParticles } from './explosion.js';
import { checkCollision } from './collision.js';
import { checkLaserCollision, updateLaserShader } from './laser.js';
import { createTrail, updateTrail, resetTrail } from './trail.js';
import { createPostProcessing } from './postprocessing.js';
import * as THREE from 'three';
import { createAudio, playBgm, pauseBgm, createSfx, playPhaseIn, playPhaseOut, playLaserPass, playLaserDeath } from './audio.js';

const audio = createAudio();
const sfx = createSfx();
window.__GAME_SFX = sfx;

// ── Scene setup ──────────────────────────────────────────────────────────
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight, 0.1, 400);
camera.position.set(15, 5, 15);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.body.appendChild(renderer.domElement);

const { composer, filmPass } = createPostProcessing(renderer, scene, camera);

// ── Environment ──────────────────────────────────────────────────────────
const { cyanLight, magentaLight, envState } = createEnvironment(scene);

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

// Phase Dive state
let phasing       = false;
let phaseStamina  = CONFIG.PHASE.MAX_DURATION;
let phaseCooldown = 0;
let phaseUsed     = false; // tracks if phase was ever activated (for HUD visibility)

// Phase transition VFX
let wasPhasing = false;
let lastPhaseVfxTime = 0;  // debounce VFX spam
const PHASE_VFX_COOLDOWN = 100; // ms — minimum gap between phase transition VFX

// Screen shake state
let shakeAmp = 0;     // current shake amplitude (decays to 0)
const SHAKE_DECAY = 0.92; // multiplier per frame at 60fps (~2s duration)
const SHAKE_INIT  = 1.2;  // initial amplitude on game over (in world units)

const scoreEl      = document.getElementById('score');
const overlayEl    = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayMsg   = document.getElementById('overlay-msg');

const phaseHudEl = document.getElementById('phase-hud');
const phaseBarFillEl = document.getElementById('phase-bar-fill');
const inputHintsEl = document.getElementById('input-hints');

// ── Input ────────────────────────────────────────────────────────────────
let lastInputTime = 0;
let lastTouchTime = 0;
const INPUT_DEBOUNCE = 20; // ms

function handleInput() {
  if (gameOver) return;
  const now = performance.now();
  if (now - lastInputTime < INPUT_DEBOUNCE) return;
  lastInputTime = now;

  if (!started) {
    started = true;
    lastSpawn = performance.now();
    overlayEl.classList.add('hidden');
    if (inputHintsEl) inputHintsEl.style.display = 'none';
    playBgm(audio);
  }
  velocity = FLAP;
}

function tryRestart() {
  if (gameOver && !overlayEl.classList.contains('hidden')) restartGame();
}

// Shared: transition from phased → solid, checking for laser overlap (instant death).
// Called by both setPhasing(false) and the stamina-depletion path in the game loop.
function forceUnphase() {
  if (!phasing) return;
  for (const p of pipes) {
    if (checkLaserCollision(birdGroup.position.y, p)) {
      phasing = false;
      playLaserDeath(sfx);
      triggerGameOver();
      return;
    }
  }
  phasing = false;
}

function setPhasing(active) {
  if (gameOver || !started) return;
  if (active && phaseCooldown > 0) return;  // locked during cooldown
  if (active && phaseStamina <= 0) return;   // depleted
  if (!active && phasing) {
    forceUnphase();
    return;
  }
  phasing = active;
  if (active) phaseUsed = true;
}

// Key
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
    e.preventDefault();
    gameOver ? tryRestart() : handleInput();
  }
  if (e.code === 'KeyD') {
    e.preventDefault();
    setPhasing(true);
  }
});
document.addEventListener('keyup', (e) => {
  if (e.code === 'KeyD') setPhasing(false);
});

// Touch — split screen: left = flap, right = phase
// touchend checks e.touches (all remaining fingers) — not changedTouches —
// to avoid unphasing when only one of multiple right-side fingers lifts.
// NOTE: passive:false + preventDefault() is intentional — prevents the browser
// from synthesizing mousedown/mouseup after touch, which would cause a double-flap.
document.addEventListener('touchstart', (e) => {
  e.preventDefault(); // suppress synthetic mouse events (double-flap fix)
  lastTouchTime = performance.now();

  let leftSideTouched = false;
  let rightSideTouched = false;

  for (const touch of e.changedTouches) {
    const xRatio = touch.clientX / window.innerWidth;
    if (xRatio < 0.5) leftSideTouched = true;
    else rightSideTouched = true;
  }

  // Handle restart first
  if (gameOver && (leftSideTouched || rightSideTouched)) {
    tryRestart();
    return;
  }

  // Action: Phase takes precedence if both touched in same event, or just handle both
  if (leftSideTouched) handleInput();
  if (rightSideTouched) setPhasing(true);
}, { passive: false });

document.addEventListener('touchend', (e) => {
  e.preventDefault();
  lastTouchTime = performance.now();
  let rightSideStillHeld = false;
  for (const touch of e.touches) {
    if (touch.clientX / window.innerWidth >= 0.5) {
      rightSideStillHeld = true;
      break;
    }
  }
  if (!rightSideStillHeld) setPhasing(false);
}, { passive: false });

document.addEventListener('touchcancel', (e) => {
  e.preventDefault();
  lastTouchTime = performance.now();
  let rightSideStillHeld = false;
  for (const touch of e.touches) {
    if (touch.clientX / window.innerWidth >= 0.5) {
      rightSideStillHeld = true;
      break;
    }
  }
  if (!rightSideStillHeld) setPhasing(false);
}, { passive: false });

/*
// Mouse — split screen: left = flap, right = phase
document.addEventListener('mousedown', (e) => {
  // Suppress synthetic mouse events on mobile
  if (performance.now() - lastTouchTime < 500) return;

  const xRatio = e.clientX / window.innerWidth;
  if (xRatio < 0.5) {
    gameOver ? tryRestart() : handleInput();
  } else {
    gameOver ? tryRestart() : setPhasing(true);
  }
});

document.addEventListener('mouseup', (e) => {
  if (performance.now() - lastTouchTime < 500) return;
  const xRatio = e.clientX / window.innerWidth;
  if (xRatio >= 0.5) setPhasing(false);
});
*/

function updateCameraProjection() {
  const aspect = window.innerWidth / window.innerHeight;
  camera.aspect = aspect;
  
  // Aspect-Aware FOV:
  // We want to ensure that portrait view doesn't look "too closed in".
  // Base FOV is 30 for landscape. In portrait, we increase FOV.
  const baseFov = 30;
  if (aspect < 1) {
    // Increase FOV proportionally to maintain horizontal visibility
    camera.fov = baseFov / aspect;
  } else {
    camera.fov = baseFov;
  }
  
  camera.updateProjectionMatrix();
}

window.addEventListener('resize', () => {
  updateCameraProjection();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});

// Initial call to set correct FOV
updateCameraProjection();

// ── Game over / restart ──────────────────────────────────────────────────
function triggerGameOver() {
  gameOver = true;
  phasing = false;
  pauseBgm(audio);
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
  phasing = false; phaseStamina = CONFIG.PHASE.MAX_DURATION; phaseCooldown = 0; phaseUsed = false;
  wasPhasing = false;
  scoreEl.textContent = '0';
  overlayTitle.textContent = 'CYBER FLAP';
  overlayMsg.textContent   = '[ CLICK OR SPACE TO JACK IN ]';
  overlayEl.classList.remove('hidden');

  if (inputHintsEl) inputHintsEl.style.display = 'flex';
  if (phaseHudEl) phaseHudEl.style.display = 'none';

  prefillPipes(scene);
  lastSpawn = performance.now();
  prevTime = performance.now();
  playBgm(audio);
}

// ── Animation loop ───────────────────────────────────────────────────────
let prevTime = performance.now();
function loop(now) {
  animId = requestAnimationFrame(loop);
  const dt = Math.min((now - prevTime) / (1000 / 60), 3);
  prevTime = now;

  if (started && !gameOver) {
    const gravScale = window.__FLAPPY_GRAVITY_SCALE ?? 1;
    velocity += GRAVITY * dt * gravScale;
    birdGroup.position.y -= velocity * dt;

    // Phase transition VFX (debounced to prevent memory leak from rapid toggling)
    if (phasing !== wasPhasing) {
      if (now - lastPhaseVfxTime > PHASE_VFX_COOLDOWN) {
        spawnExplosion(scene, birdGroup.position.x, birdGroup.position.y, birdGroup.position.z);
        if (phasing) playPhaseIn(sfx);
        else playPhaseOut(sfx);
        lastPhaseVfxTime = now;
      }
      wasPhasing = phasing;
    }

    updateTrail(trail, birdGroup.position.x, birdGroup.position.y, birdGroup.position.z - 0.3, phasing);
    const targetRot = Math.max(-0.6, Math.min(0.6, velocity * 4));
    birdGroup.rotation.z += (targetRot - birdGroup.rotation.z) * 0.15 * dt;

    // Phase visual feedback on bird
    const bodyMat = birdGroup.children[0].material;
    const wingMat = birdGroup.children[3].material;
    if (phasing) {
      bodyMat.transparent = true;
      bodyMat.opacity = 0.4;
      bodyMat.emissive.setHex(0xffffff);
      bodyMat.emissiveIntensity = 1.5;
      wingMat.transparent = true;
      wingMat.opacity = 0.4;
      wingMat.emissive.setHex(0xffffff);
      eng.material.color.setHex(0xffffff);
      // Subtle scale pulse
      const pulse = 1.0 + Math.sin(now * 0.025) * 0.05;
      birdGroup.scale.set(pulse, pulse, pulse);
    } else {
      bodyMat.transparent = false;
      bodyMat.opacity = 1.0;
      bodyMat.emissive.setHex(0x00ccff);
      bodyMat.emissiveIntensity = 0.6;
      wingMat.transparent = false;
      wingMat.opacity = 1.0;
      wingMat.emissive.setHex(0x0066aa);
      birdGroup.scale.set(1, 1, 1);
    }

    // ── Overheat tick ─────────────────────────────────────────────────────
    const dtSec = dt / 60; // dt is in frames at 60fps, convert to seconds
    if (phasing && phaseCooldown <= 0) {
      phaseStamina -= CONFIG.PHASE.DRAIN_RATE * dtSec;
      if (phaseStamina <= 0) {
        phaseStamina = 0;
        forceUnphase();  // checks laser overlap before unphasing
        if (gameOver) return;
        phaseCooldown = CONFIG.PHASE.COOLDOWN;
      }
    }
    if (!phasing && phaseCooldown > 0) {
      phaseCooldown -= dtSec;
      if (phaseCooldown < 0) phaseCooldown = 0;
    }
    if (!phasing && phaseCooldown <= 0) {
      phaseStamina = Math.min(CONFIG.PHASE.MAX_DURATION, phaseStamina + CONFIG.PHASE.CHARGE_RATE * dtSec);
    }

    // Update stamina HUD (shown once phase is first used)
    if (phaseUsed) {
      if (phaseHudEl) phaseHudEl.style.display = 'block';
      if (phaseBarFillEl) {
        const pct = phaseStamina / CONFIG.PHASE.MAX_DURATION;
        phaseBarFillEl.style.width = (pct * 100) + '%';
        if (pct > 0.3) phaseBarFillEl.style.background = '#00ffff';
        else if (pct > 0.1) phaseBarFillEl.style.background = '#ffcc00';
        else phaseBarFillEl.style.background = '#ff2200';
        phaseBarFillEl.style.animation = phaseCooldown > 0 ? 'flicker 0.3s infinite' : 'none';
      }
    }

    eng.material.color.setHSL((now * 0.001) % 1, 1, 0.6);

    // Allow test override of pipe speed via window.__GAME_CONFIG mutation
    const pipeSpeed = CONFIG.PIPES.SPEED;
    const spawnMs   = Math.round(CONFIG.PIPES.SPACING / (pipeSpeed * 60) * 1000);
    if (now - lastSpawn >= spawnMs) { spawnPipe(scene, undefined, score); lastSpawn = now; }

    for (let i = pipes.length - 1; i >= 0; i--) {
      const p = pipes[i];
      p.group.position.z += pipeSpeed * dt;
      if (p.laser) updateLaserShader(p.laser.mesh, now * 0.001);

      if (!p.scored && p.group.position.z > 1) {
        p.scored = true;
        score++;
        scoreEl.textContent = score;
        if (p.laser && phasing) playLaserPass(sfx);
      }

      if (p.group.position.z > PIPE_REMOVE_Z) {
        scene.remove(p.group);
        pipes.splice(i, 1);
        continue;
      }

      if (checkCollision(birdGroup.position.y, birdGroup.position.x, p)) {
        triggerGameOver(); return;
      }

      // Laser collision — phasing bypasses
      if (!phasing && checkLaserCollision(birdGroup.position.y, p)) {
        playLaserDeath(sfx);
        triggerGameOver(); return;
      }
    }

    if (birdGroup.position.y > 6 || birdGroup.position.y < -6) {
      triggerGameOver(); return;
    }
  }

  updateExplosion(scene, dt);
  updateEnvironment(envState, dt, started && !gameOver);

  cyanLight.intensity    = 1.5 + Math.sin(now * 0.003) * 0.3;
  magentaLight.intensity = 1.2 + Math.cos(now * 0.004) * 0.3;

  // Expose state for Playwright adaptive test
  window.__FLAPPY_BIRD_Y  = birdGroup.position.y;
  window.__FLAPPY_VELOCITY = velocity;
  window.__FLAPPY_SCORE   = score;
  window.__FLAPPY_STARTED = started;
  window.__FLAPPY_OVER    = gameOver;
  const _unscored = pipes.filter(p => !p.scored).sort((a, b) => b.group.position.z - a.group.position.z);
  const _np  = _unscored[0];
  const _np2 = _unscored[1];
  window.__FLAPPY_NEXT_GAP_Y   = _np ? (_np.gapTop + _np.gapBot) / 2 : 0;
  window.__FLAPPY_NEXT_GAP_TOP = _np ? _np.gapTop : 0;
  window.__FLAPPY_NEXT_GAP_BOT = _np ? _np.gapBot : 0;
  window.__FLAPPY_NEXT_PIPE_Z  = _np ? _np.group.position.z : -99;
  window.__FLAPPY_NEXT2_GAP_TOP = _np2 ? _np2.gapTop : 0;
  window.__FLAPPY_NEXT2_GAP_BOT = _np2 ? _np2.gapBot : 0;
  window.__FLAPPY_NEXT2_PIPE_Z  = _np2 ? _np2.group.position.z : -99;
  window.__FLAPPY_NEXT_LASER      = _np && _np.laser ? true : false;
  window.__FLAPPY_PHASING         = phasing;
  window.__FLAPPY_PHASE_STAMINA   = phaseStamina;
  window.__FLAPPY_PHASE_COOLDOWN  = phaseCooldown;
  window.__FLAPPY_PHASE_ACTIVATE  = () => setPhasing(true);
  window.__FLAPPY_PHASE_DEACTIVATE = () => setPhasing(false);
  window.__FLAPPY_SHAKE_AMP    = shakeAmp;

  // Screen shake — sine wave at ~8Hz so it's visible in compressed video
  if (shakeAmp > 0.001) {
    const sx = 15 + Math.sin(now * 0.05) * shakeAmp;
    const sy = 5 + Math.cos(now * 0.07) * shakeAmp;
    camera.position.set(sx, sy, 15);
    shakeAmp *= Math.pow(SHAKE_DECAY, dt);
  } else {
    shakeAmp = 0;
    camera.position.set(15, 5, 15);
  }

  if (filmPass) filmPass.uniforms['time'].value = now * 0.001;
  composer.render();
}

// ── Test API: quiet start (no flap velocity) for Playwright pilot ─────────
// The normal click-to-start also fires a flap (velocity = FLAP), which sends
// the bird to y≈2.86. With PIPE_SPACING=4.5, pipe 2 (y=-2.0, gapTop=1.75)
// arrives at the collision zone only ~12 frames after start — before the bird
// has fallen back below 1.75. Starting quietly (vel stays 0) keeps the bird
// near y=0 so the pilot can navigate from a neutral position.
window.__FLAPPY_START_QUIET = () => {
  if (!started && !gameOver) {
    started = true;
    lastSpawn = performance.now();
    overlayEl.classList.add('hidden');
  }
};

// ── Test API: direct restart (bypasses overlay timing) ───────────────────
window.__FLAPPY_RESTART = () => {
  if (gameOver) restartGame();
};

// ── Test API: clear all pipes (for stamina/phase tests that need no collisions) ──
window.__FLAPPY_CLEAR_PIPES = () => {
  resetPipes(scene);
};

// ── Test API: gravity multiplier (0 = freeze bird Y, for isolated mechanic tests) ──
window.__FLAPPY_GRAVITY_SCALE = 1;

// ── Init ─────────────────────────────────────────────────────────────────
prefillPipes(scene);
lastSpawn = performance.now();
animId = requestAnimationFrame(loop);
