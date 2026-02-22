# 3D Flappy Bird Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a 3D Flappy Bird game in a single HTML file using Three.js, then verify gameplay with a Playwright test that records video.

**Architecture:** Self-contained `index.html` with Three.js loaded from CDN. A Playwright test opens it via a local HTTP server, simulates spacebar presses at timed intervals to flap through pipe gaps, records a 10-second video, then the verify-video skill checks the footage matches expected behavior.

**Tech Stack:** Three.js (CDN), HTML5 Canvas, Playwright (Node.js), npx http-server

---

### Task 1: Create project scaffold and install Playwright

**Files:**
- Create: `/home/family/large_disk/flappy3d/package.json`
- Create: `/home/family/large_disk/flappy3d/playwright.config.js`

**Step 1: Create package.json**

```json
{
  "name": "flappy3d",
  "version": "1.0.0",
  "scripts": {
    "test": "playwright test"
  },
  "devDependencies": {
    "@playwright/test": "^1.41.0",
    "http-server": "^14.1.1"
  }
}
```

Save to `/home/family/large_disk/flappy3d/package.json`

**Step 2: Create playwright.config.js**

```js
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  use: {
    video: 'on',
    headless: true,
  },
  webServer: {
    command: 'npx http-server . -p 3456 --cors',
    url: 'http://localhost:3456',
    reuseExistingServer: true,
  },
});
```

Save to `/home/family/large_disk/flappy3d/playwright.config.js`

**Step 3: Install dependencies**

```bash
cd /home/family/large_disk/flappy3d && npm install
npx playwright install chromium
```

Expected: packages installed, chromium browser downloaded.

---

### Task 2: Build the 3D Flappy Bird game (index.html)

**Files:**
- Create: `/home/family/large_disk/flappy3d/index.html`

**Step 1: Write index.html with full game**

The game must:
- Load Three.js from `https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js`
- Show a 3D bird (yellow Box mesh, 0.4×0.4×0.4) centered in a blue sky scene
- Bird falls due to gravity (velocity += 0.008 per frame), flaps on spacebar or click (velocity = -0.15)
- Pipe pairs (green CylinderGeometry, radius 0.5, height 4) scroll from z=-40 toward camera at z=5; gap of 3 units between top and bottom pipes
- New pipe pair spawns every 3 seconds at random y offset (-1 to 1)
- Bird collides with pipes → game over screen ("GAME OVER - Press Space to restart")
- Bird goes above y=5 or below y=-5 → game over
- Score increments when bird passes a pipe pair; displayed as HTML overlay top-center
- Camera fixed at (0, 0, 8) looking toward (0, 0, 0)
- Background color: sky blue `0x87CEEB`
- On game over: stop animation, show overlay; spacebar restarts

Full `index.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>3D Flappy Bird</title>
<style>
  body { margin: 0; overflow: hidden; background: #87CEEB; }
  canvas { display: block; }
  #ui {
    position: fixed; top: 20px; width: 100%; text-align: center;
    color: white; font-family: Arial, sans-serif; font-size: 28px;
    text-shadow: 2px 2px 4px #000; pointer-events: none;
  }
  #overlay {
    display: none; position: fixed; inset: 0;
    background: rgba(0,0,0,0.5); color: white;
    font-family: Arial, sans-serif; font-size: 36px;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 16px;
  }
  #overlay.hidden { display: none; }
  #overlay:not(.hidden) { display: flex; }
</style>
</head>
<body>
<div id="ui">Score: <span id="score">0</span></div>
<div id="overlay" class="hidden">
  <div id="gameOverMsg">GAME OVER</div>
  <div style="font-size:20px">Press Space or Click to Restart</div>
</div>

<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<script>
// ---- Scene Setup ----
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(0, 0, 8);
camera.lookAt(0, 0, 0);

// Lighting
const ambient = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambient);
const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(5, 10, 5);
scene.add(dirLight);

// Ground
const groundGeo = new THREE.PlaneGeometry(40, 200);
const groundMat = new THREE.MeshLambertMaterial({ color: 0x4CAF50 });
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.position.set(0, -5.5, -60);
scene.add(ground);

// Bird
const birdGeo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
const birdMat = new THREE.MeshLambertMaterial({ color: 0xFFD700 });
const bird = new THREE.Mesh(birdGeo, birdMat);
bird.position.set(0, 0, 0);
scene.add(bird);

// Bird eye detail
const eyeGeo = new THREE.SphereGeometry(0.07, 8, 8);
const eyeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
const eye = new THREE.Mesh(eyeGeo, eyeMat);
eye.position.set(0.15, 0.1, 0.2);
bird.add(eye);

// ---- Game State ----
let velocity = 0;
let score = 0;
let gameOver = false;
let started = false;
const pipes = [];
const PIPE_SPEED = 0.05;
const GRAVITY = 0.008;
const FLAP = -0.15;
const PIPE_GAP = 3.0;
const PIPE_SPAWN_Z = -40;
const KILL_Z = 7;

const scoreEl = document.getElementById('score');
const overlay = document.getElementById('overlay');
const gameOverMsg = document.getElementById('gameOverMsg');

// Pipe material
const pipeMat = new THREE.MeshLambertMaterial({ color: 0x2E7D32 });
const pipeCap = new THREE.MeshLambertMaterial({ color: 0x388E3C });

function makePipe(yOffset) {
  const group = new THREE.Group();

  // Bottom pipe
  const botGeo = new THREE.CylinderGeometry(0.5, 0.5, 4, 12);
  const bot = new THREE.Mesh(botGeo, pipeMat);
  bot.position.y = yOffset - PIPE_GAP / 2 - 2;
  group.add(bot);

  // Bottom cap
  const botCapGeo = new THREE.CylinderGeometry(0.6, 0.6, 0.3, 12);
  const botCap = new THREE.Mesh(botCapGeo, pipeCap);
  botCap.position.y = yOffset - PIPE_GAP / 2;
  group.add(botCap);

  // Top pipe
  const topGeo = new THREE.CylinderGeometry(0.5, 0.5, 4, 12);
  const top = new THREE.Mesh(topGeo, pipeMat);
  top.position.y = yOffset + PIPE_GAP / 2 + 2;
  group.add(top);

  // Top cap
  const topCapGeo = new THREE.CylinderGeometry(0.6, 0.6, 0.3, 12);
  const topCap = new THREE.Mesh(topCapGeo, pipeCap);
  topCap.position.y = yOffset + PIPE_GAP / 2;
  group.add(topCap);

  group.position.z = PIPE_SPAWN_Z;
  group.userData = { yOffset, passed: false };
  scene.add(group);
  pipes.push(group);
}

function spawnPipe() {
  const yOffset = (Math.random() - 0.5) * 2;
  makePipe(yOffset);
}

// Spawn initial pipes
spawnPipe();
let lastSpawn = 0;
const SPAWN_INTERVAL = 3000; // ms

function flap() {
  if (gameOver) {
    restart();
    return;
  }
  started = true;
  velocity = FLAP;
}

function restart() {
  // Remove all pipes
  pipes.forEach(p => scene.remove(p));
  pipes.length = 0;
  bird.position.set(0, 0, 0);
  bird.rotation.z = 0;
  velocity = 0;
  score = 0;
  scoreEl.textContent = '0';
  gameOver = false;
  started = false;
  overlay.classList.add('hidden');
  spawnPipe();
  lastSpawn = performance.now();
  requestAnimationFrame(animate);
}

document.addEventListener('keydown', e => {
  if (e.code === 'Space') { e.preventDefault(); flap(); }
});
document.addEventListener('click', () => flap());

// ---- Collision ----
function checkCollision() {
  const bx = bird.position.x;
  const by = bird.position.y;

  // Bounds
  if (by > 5 || by < -5) return true;

  for (const pipe of pipes) {
    const pz = pipe.position.z;
    // Only check pipes near the bird's z plane (bird is at z=0)
    if (pz < -1.5 || pz > 1.5) continue;
    const yo = pipe.userData.yOffset;
    const gapTop = yo + PIPE_GAP / 2;
    const gapBot = yo - PIPE_GAP / 2;
    // Horizontal: pipe is at x=0, radius 0.6 (cap), bird half-size 0.2
    if (Math.abs(bx) < 0.85) {
      if (by > gapTop + 0.2 || by < gapBot - 0.2) return true;
    }
  }
  return false;
}

// ---- Animate ----
let lastTime = 0;
function animate(time) {
  if (gameOver) return;
  requestAnimationFrame(animate);

  const dt = time - lastTime;
  lastTime = time;

  if (started) {
    velocity += GRAVITY;
    bird.position.y -= velocity;
    // Tilt bird based on velocity
    bird.rotation.z = Math.max(-0.5, Math.min(0.5, -velocity * 2));

    // Move pipes
    for (const pipe of pipes) {
      pipe.position.z += PIPE_SPEED;
      // Score: pipe passed bird
      if (!pipe.userData.passed && pipe.position.z > 1) {
        pipe.userData.passed = true;
        score++;
        scoreEl.textContent = score;
      }
    }

    // Remove old pipes
    for (let i = pipes.length - 1; i >= 0; i--) {
      if (pipes[i].position.z > KILL_Z) {
        scene.remove(pipes[i]);
        pipes.splice(i, 1);
      }
    }

    // Spawn new pipes
    if (time - lastSpawn > SPAWN_INTERVAL) {
      spawnPipe();
      lastSpawn = time;
    }

    // Collision
    if (checkCollision()) {
      gameOver = true;
      gameOverMsg.textContent = `GAME OVER — Score: ${score}`;
      overlay.classList.remove('hidden');
      return;
    }
  }

  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

lastSpawn = performance.now();
animate(0);
</script>
</body>
</html>
```

**Step 2: Verify the file was written correctly**

Open in browser manually (optional sanity check). The game should show a gold cube bird in a blue sky, press Space to flap.

---

### Task 3: Write the Playwright test

**Files:**
- Create: `/home/family/large_disk/flappy3d/tests/flappy.spec.js`

**Step 1: Create tests directory and spec file**

```js
const { test, expect } = require('@playwright/test');
const path = require('path');

test('3D Flappy Bird - bird flaps through pipes', async ({ page }) => {
  // Navigate to game
  await page.goto('http://localhost:3456/index.html');

  // Wait for Three.js canvas to appear
  await page.waitForSelector('canvas', { timeout: 10000 });

  // Give the scene 1 second to initialize
  await page.waitForTimeout(1000);

  // Flap sequence: press Space multiple times with timing
  // to navigate through the first pipe gap
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Space');
    await page.waitForTimeout(600);
  }

  // Wait a bit more to show gameplay
  await page.waitForTimeout(2000);

  // Check score element is present and visible
  const scoreEl = await page.locator('#score');
  await expect(scoreEl).toBeVisible();

  // Check the overlay (game over) is hidden — meaning bird is alive
  const overlay = await page.locator('#overlay');
  await expect(overlay).toHaveClass(/hidden/);
});
```

Save to `/home/family/large_disk/flappy3d/tests/flappy.spec.js`

---

### Task 4: Run Playwright test and capture video

**Step 1: Run the test**

```bash
cd /home/family/large_disk/flappy3d && npx playwright test --reporter=list 2>&1
```

Expected output: 1 passed, video saved to `test-results/` directory.

**Step 2: Find the video file**

```bash
find /home/family/large_disk/flappy3d/test-results -name "*.webm" | head -5
```

Note the path of the `.webm` file — you'll need it for Task 5.

---

### Task 5: Verify the video with Gemini

**Step 1: Use the verify-video skill**

Invoke skill: `verify-video`

Provide the video path found in Task 4 and ask Gemini to verify:
- A 3D scene with blue sky is visible
- A gold/yellow cube bird is present in the center
- Green pipe obstacles scroll toward the camera
- The bird visibly moves up and down (flapping)
- Score counter is visible at the top
- No game-over overlay appears during the recording

**Step 2: Interpret results**

- If PASS: game works as expected.
- If FAIL: check specific issues noted by Gemini and fix in `index.html`, then re-run Task 4.

---

## Post-Plan Changes (applied after initial implementation)

### Cyberpunk Reskin
- Dark background `0x050010`, neon cyan bird, magenta pipe rings, city skyline, CRT scanlines
- Share Tech Mono font, neon point lights (cyan + magenta)

### Explosion Animation on Collision
- 24 neon particles spawn at bird position on hit
- Bird hidden immediately; game-over overlay delayed 900ms so explosion plays out
- `triggerGameOver()` keeps animation loop alive (no cancelAnimationFrame)
- `tryRestart()` guards against restarting before overlay is shown

### Obstacle Spawning Overhaul (spec: show many obstacles at depth with different gap heights)
- `PIPE_SPACING = 5` (down from 7) for tighter corridor
- `prefillPipes()` spawns 4 pipes at z=-3,-8,-13,-18 at game start and restart
- Pipe height increased 8→12, cap ring radius 0.65→2.0 for far-depth visibility
- Gap height uses cycling pattern `[0.5, 3.0, -3.0, 1.5, -1.5]` instead of pure random
  - Guarantees: first gap is near center (reachable from y=0), then alternates top/bottom/etc.
  - `pipeCount` resets on `restartGame()` for consistent ordering
- Bird boundary unchanged: ±6; safe yOffset max: ±3.5 (gap half-width 2.5 + boundary 6)

**Gemini-2.5-flash verified (commit eb09ff2):**
- 3 pipe obstacles visible simultaneously at different distances ✓
- Gap heights vary from bottom-third to top-third of screen ✓
- Bird flaps upward on click ✓
- Neon particle explosion on collision ✓
- Stable gameplay loop ✓
