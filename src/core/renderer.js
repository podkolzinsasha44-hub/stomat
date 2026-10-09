// WebGL renderer with a post-processing chain per scene (ambient occlusion, bloom, SMAA, tone mapping).
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export const QUALITY = {
  low: { pixelRatio: 0.75, ao: false, bloom: false, smaa: false, shadows: 1024 },
  medium: { pixelRatio: 1, ao: false, bloom: true, smaa: true, shadows: 2048 },
  high: { pixelRatio: 1.5, ao: true, bloom: true, smaa: true, shadows: 2048 },
};

export function createRenderer(canvas, qualityName = 'medium') {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.AgXToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const pmrem = new THREE.PMREMGenerator(renderer);
  const roomEnv = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  let quality = QUALITY[qualityName] || QUALITY.medium;
  const pipelines = new Map(); // scene -> {composer, passes}

  function size() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    return { w, h };
  }

  function buildPipeline(scene, camera, opts = {}) {
    const { w, h } = size();
    const composer = new EffectComposer(renderer);
    composer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality.pixelRatio));
    composer.setSize(w, h);
    const passes = {};
    passes.render = new RenderPass(scene, camera);
    composer.addPass(passes.render);
    if (quality.ao && opts.ao !== false) {
      passes.ao = new GTAOPass(scene, camera, w, h);
      passes.ao.blendIntensity = opts.aoIntensity ?? 0.9;
      passes.ao.updateGtaoMaterial({ radius: opts.aoRadius ?? 0.25, distanceExponent: 1, thickness: 1, scale: 1 });
      composer.addPass(passes.ao);
    }
    if (quality.bloom && opts.bloom !== false) {
      passes.bloom = new UnrealBloomPass(new THREE.Vector2(w, h), opts.bloomStrength ?? 0.18, 0.5, opts.bloomThreshold ?? 0.92);
      composer.addPass(passes.bloom);
    }
    passes.output = new OutputPass();
    composer.addPass(passes.output);
    if (quality.smaa) {
      const pr = composer._pixelRatio || 1;
      passes.smaa = new SMAAPass(w * pr, h * pr);
      composer.addPass(passes.smaa);
    }
    return { composer, passes, camera, opts };
  }

  function register(scene, camera, opts) {
    const old = pipelines.get(scene);
    if (old) old.composer.dispose();
    pipelines.set(scene, buildPipeline(scene, camera, opts));
  }

  function render(scene, camera) {
    let p = pipelines.get(scene);
    if (!p) { register(scene, camera); p = pipelines.get(scene); }
    if (p.camera !== camera) {
      p.passes.render.camera = camera;
      if (p.passes.ao) p.passes.ao.camera = camera;
      p.camera = camera;
    }
    p.composer.render();
  }

  function resize() {
    const { w, h } = size();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality.pixelRatio));
    renderer.setSize(w, h, false);
    for (const p of pipelines.values()) {
      p.composer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality.pixelRatio));
      p.composer.setSize(w, h);
      if (p.passes.ao) p.passes.ao.setSize(w, h);
    }
  }

  function setQuality(name) {
    quality = QUALITY[name] || quality;
    renderer.shadowMap.needsUpdate = true;
    for (const [scene, p] of pipelines) {
      p.composer.dispose();
      pipelines.set(scene, buildPipeline(scene, p.camera, p.opts));
    }
    resize();
  }

  window.addEventListener('resize', resize);
  resize();
  return { renderer, render, register, resize, setQuality, roomEnv, pmrem, get quality() { return quality; } };
}
