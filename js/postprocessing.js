import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

export function createPostProcessing(renderer, scene, camera) {
  const composer = new EffectComposer(renderer);

  // 1. Base render pass
  composer.addPass(new RenderPass(scene, camera));

  // 2. Bloom — the crucial neon glow
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    1.2,   // strength — cranked for neon bleed
    0.4,   // radius
    0.85   // threshold — only bright emissive colors bloom
  );
  composer.addPass(bloomPass);

  return { composer, bloomPass };
}