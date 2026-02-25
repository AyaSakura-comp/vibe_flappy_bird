import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { VignetteShader } from 'three/examples/jsm/shaders/VignetteShader.js';
import { FilmShader } from 'three/examples/jsm/shaders/FilmShader.js';
import { CONFIG } from './constants.js';

export function createPostProcessing(renderer, scene, camera) {
  const composer = new EffectComposer(renderer);

  // 1. Base render pass
  composer.addPass(new RenderPass(scene, camera));

  // 2. Bloom — the crucial neon glow
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    CONFIG.VISUALS.BLOOM.STRENGTH,
    CONFIG.VISUALS.BLOOM.RADIUS,
    CONFIG.VISUALS.BLOOM.THRESHOLD
  );
  composer.addPass(bloomPass);

  // 3. Color grading — crush shadows, push midtones to magenta
  const ColorGradeShader = {
    uniforms: {
      tDiffuse: { value: null },
      shadowCrush: { value: CONFIG.VISUALS.POST_PROCESSING.COLOR_GRADE.SHADOW_CRUSH },
      magentaPush: { value: CONFIG.VISUALS.POST_PROCESSING.COLOR_GRADE.MAGENTA_PUSH },
      contrast: { value: CONFIG.VISUALS.POST_PROCESSING.COLOR_GRADE.CONTRAST },
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
  vignettePass.uniforms['offset'].value = CONFIG.VISUALS.POST_PROCESSING.VIGNETTE.OFFSET;
  vignettePass.uniforms['darkness'].value = CONFIG.VISUALS.POST_PROCESSING.VIGNETTE.DARKNESS;
  composer.addPass(vignettePass);

  // 5. Film grain + scanlines
  const filmPass = new ShaderPass(FilmShader);
  filmPass.uniforms['nIntensity'].value = CONFIG.VISUALS.POST_PROCESSING.FILM.N_INTENSITY;
  filmPass.uniforms['sIntensity'].value = CONFIG.VISUALS.POST_PROCESSING.FILM.S_INTENSITY;
  filmPass.uniforms['sCount'].value = CONFIG.VISUALS.POST_PROCESSING.FILM.S_COUNT;
  filmPass.uniforms['grayscale'].value = 0;
  composer.addPass(filmPass);

  // 6. Chromatic aberration
  const ChromaticAberrationShader = {
    uniforms: {
      tDiffuse: { value: null },
      amount: { value: CONFIG.VISUALS.POST_PROCESSING.CHROMA.AMOUNT },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
    `,
    fragmentShader: `
      uniform sampler2D tDiffuse;
      uniform float amount;
      varying vec2 vUv;
      void main() {
        vec2 offset = (vUv - 0.5) * amount;
        float r = texture2D(tDiffuse, vUv + offset).r;
        float g = texture2D(tDiffuse, vUv).g;
        float b = texture2D(tDiffuse, vUv - offset).b;
        gl_FragColor = vec4(r, g, b, 1.0);
      }
    `,
  };
  const chromaPass = new ShaderPass(ChromaticAberrationShader);
  composer.addPass(chromaPass);

  return { composer, bloomPass, filmPass };
}