// Loading and caching of glTF assets (Rocketbox avatars and animation libraries).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

const loader = new GLTFLoader();
const cache = new Map();

export function modelUrl(name) {
  return new URL(`models/${name}.glb`, document.baseURI).href;
}

export function loadGLB(name, onProgress) {
  if (!cache.has(name)) {
    cache.set(name, new Promise((resolve, reject) => {
      loader.load(modelUrl(name), resolve, (e) => onProgress?.(e.total ? e.loaded / e.total : 0), reject);
    }));
  }
  return cache.get(name);
}

// Animation clips: remove horizontal root motion from locomotion so the game drives position.
const clipCache = new Map();
export async function loadAnimations(sex) {
  const key = sex === 'f' ? 'f' : 'm';
  if (!clipCache.has(key)) {
    clipCache.set(key, loadGLB(`anims_${key}`).then((g) => {
      const clips = {};
      for (const c of g.animations) {
        const clip = c.clone();
        clip.tracks = clip.tracks.filter((t) => !/^(Bip01_Footsteps|MotionExtractionHelper)/.test(t.name));
        if (clip.name === 'walk') {
          const t = clip.tracks.find((tr) => tr.name === 'Bip01.position');
          if (t) for (let i = 0; i < t.values.length; i += 3) { t.values[i] = 0; t.values[i + 2] = 0; }
        }
        clips[clip.name] = clip;
      }
      return clips;
    }));
  }
  return clipCache.get(key);
}

export async function instantiateAvatar(name) {
  const g = await loadGLB(name);
  const model = SkeletonUtils.clone(g.scene);
  const meshes = [];
  model.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
      o.frustumCulled = false;
      o.material = o.material.clone();
      if (/head/i.test(o.material.name)) {
        // a touch of subsurface warmth for skin
        o.material.sheen = 0;
      }
      meshes.push(o);
    }
  });
  return { model, meshes };
}

export { THREE };
