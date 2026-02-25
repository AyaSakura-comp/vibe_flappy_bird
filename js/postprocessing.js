import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { VignetteShader } from 'three/examples/jsm/shaders/VignetteShader.js';

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

  // 3. Color grading — crush shadows, push midtones to magenta
  const ColorGradeShader = {
    uniforms: {
      tDiffuse: { value: null },
      shadowCrush: { value: 0.15 },
      magentaPush: { value: 0.08 },
      contrast: { value: 1.2 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
    `,
    fragmentShader: `
      uniform sampler2D tDiffuse;
      uniform float shadowCrush;
      uniform float magentaPush;
      uniform float contrast;
      varying vec2 vUv;
      void main() {
        vec4 tex = texture2D(tDiffuse, vUv);
        vec3 c = tex.rgb;
        c = max(c - shadowCrush, 0.0) / (1.0 - shadowCrush);
        c = (c - 0.5) * contrast + 0.5;
        float lum = dot(c, vec3(0.299, 0.587, 0.114));
        float midMask = smoothstep(0.0, 0.5, lum) * smoothstep(1.0, 0.5, lum);
        c.r += magentaPush * midMask;
        c.b += magentaPush * midMask * 0.5;
        gl_FragColor = vec4(clamp(c, 0.0, 1.0), tex.a);
      }
    `,
  };
  const gradePass = new ShaderPass(ColorGradeShader);
  composer.addPass(gradePass);

  // 4. Vignette — darken edges
  const vignettePass = new ShaderPass(VignetteShader);
  vignettePass.uniforms['offset'].value = 1.0;
  vignettePass.uniforms['darkness'].value = 1.4;
  composer.addPass(vignettePass);

  return { composer, bloomPass };
}