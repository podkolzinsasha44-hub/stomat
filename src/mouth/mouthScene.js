// The intra-oral scene used for examination and treatment.
import * as THREE from 'three';
import { buildTooth } from './toothGeometry.js';
import { ALL_TEETH, SHADES } from './toothData.js';
import { ToothState, FILL } from './toothState.js';
import { quadrantLayout, toothMatrix, buildGingiva, buildPalate, buildTongue, buildLips } from './arches.js';
import { fbmField, normalFromHeight, toTexture } from '../world/textures.js';

const HINGE = new THREE.Vector3(0, 21, -64);

function gumNormalMap() {
  const S = 256;
  const h = fbmField(S, { seed: 71, base: 32, octaves: 3, gain: 0.55 });
  return toTexture(normalFromHeight(h, S, 2.2), { srgb: false, repeat: [0.06, 0.06] });
}

function toothMaterial() {
  const m = new THREE.MeshPhysicalMaterial({
    vertexColors: true, roughness: 0.36, metalness: 0, clearcoat: 0.55, clearcoatRoughness: 0.18,
    specularIntensity: 0.7,
  });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float gloss;\nvarying float vGloss;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGloss = gloss;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vGloss;')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor *= mix(1.15, 0.25, clamp(vGloss, 0.0, 1.0));')
      // cheap translucency: let some diffuse colour through even when unlit
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * 0.045;');
  };
  return m;
}

export function createMouthScene({ envMap, status = {}, shade = 'A2', skinRGB = [0.82, 0.64, 0.54], openDeg = 23 } = {}) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0606);
  scene.environment = envMap || null;
  scene.environmentIntensity = 0.55;

  const camera = new THREE.PerspectiveCamera(34, 1, 1, 2000);

  // lights: operatory lamp above the patient's chest, soft fill from the doctor's side
  const lamp = new THREE.SpotLight(0xfff2df, 5.5, 0, 0.32, 0.65, 0);
  lamp.position.set(-20, 120, 460);
  lamp.target.position.set(0, -4, 0);
  lamp.castShadow = true;
  lamp.shadow.mapSize.set(2048, 2048);
  lamp.shadow.camera.near = 250;
  lamp.shadow.camera.far = 700;
  lamp.shadow.bias = -0.00008;
  lamp.shadow.normalBias = 0.25;
  scene.add(lamp, lamp.target);
  const fill = new THREE.PointLight(0xe8f0ff, 0.9, 0, 0);
  fill.position.set(60, 140, 160);
  scene.add(fill);
  scene.add(new THREE.HemisphereLight(0xfff6ee, 0x3a1a1a, 0.35));

  const upper = new THREE.Group(); upper.name = 'upperJaw';
  const lowerPivot = new THREE.Group(); lowerPivot.position.copy(HINGE);
  const lower = new THREE.Group(); lower.name = 'lowerJaw'; lower.position.copy(HINGE).negate();
  lowerPivot.add(lower);
  scene.add(upper, lowerPivot);

  const tMat = toothMaterial();
  const rootMat = new THREE.MeshPhysicalMaterial({ color: new THREE.Color().setRGB(0.84, 0.74, 0.56, THREE.SRGBColorSpace), roughness: 0.55 });
  const shadeRGB = SHADES[shade] || SHADES.A2;

  const teeth = new Map();
  const gumInfo = { upper: [], lower: [] };
  for (const q of [1, 2, 3, 4]) {
    for (const layout of quadrantLayout(q)) {
      const fdi = layout.fdi;
      const st = status[fdi] || {};
      const present = st.present !== false;
      const tooth = buildTooth(fdi);
      const M = toothMatrix(layout, tooth.crownTop);
      const group = new THREE.Group();
      group.matrixAutoUpdate = false;
      if (st.impacted) {
        // a wisdom tooth stuck in bone: lower and tipped mesially
        const occl = new THREE.Vector3(0, tooth.spec.upper ? -1 : 1, 0);
        const sink = new THREE.Matrix4().makeTranslation(occl.x * -6, occl.y * -6, 0);
        const tilt = new THREE.Matrix4().makeRotationAxis(layout.buccal, (tooth.spec.upper ? -1 : 1) * (layout.fdi % 10 === 8 ? 0.7 : 0.4) * (tooth.spec.right ? 1 : -1));
        M.premultiply(sink).multiply(tilt);
      }
      group.matrix.copy(M);
      const state = new ToothState(tooth, st.shade ? SHADES[st.shade] : shadeRGB);
      const mesh = new THREE.Mesh(state.geometry, tMat);
      mesh.castShadow = true; mesh.receiveShadow = true;
      mesh.userData.fdi = fdi;
      group.add(mesh);
      const roots = tooth.roots.map((g) => { const m = new THREE.Mesh(g, rootMat); m.castShadow = true; m.visible = false; m.userData.fdi = fdi; return m; });
      roots.forEach((r) => group.add(r));
      group.visible = present;
      (tooth.spec.upper ? upper : lower).add(group);
      group.updateMatrixWorld(true);
      // apply initial clinical status
      for (const l of st.lesions || []) state.addLesion(l);
      if (st.oldFilling) state.addOldFilling(st.oldFilling);
      if (st.stain) state.setStain(st.stain);
      if (st.calculus) state.setCalculus(st.calculus, st.calculusSide !== 'buccal');
      if (st.crown) state.restoration = st.crown;
      if (st.destroyed) {
        state.addLesion({ surface: 'O', depth: tooth.Hc * 0.9, radius: Math.max(tooth.a1, tooth.b1) * 1.6 });
        for (let i = 0; i < state.n; i++) if (state.vt[i] > 0.2) state.removed[i] = Math.max(state.removed[i], state.decay[i] * 0.75);
        state.dirty = true;
      }
      state.update();
      const cejLocal = new THREE.Vector3(0, 0, 0).applyMatrix4(M);
      teeth.set(fdi, { fdi, tooth, state, mesh, roots, group, layout, present, matrix: M, status: st });
      gumInfo[tooth.spec.upper ? 'upper' : 'lower'].push({ fdi, layout, spec: tooth.spec, present, cejY: cejLocal.y, swelling: st.gumSwelling || 0, redness: st.gumRedness || status.gumRedness || 0 });
    }
  }

  const gumMat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.42, clearcoat: 0.8, clearcoatRoughness: 0.25, normalMap: gumNormalMap(), normalScale: new THREE.Vector2(0.25, 0.25), sheen: 0.25, sheenColor: new THREE.Color(0xffc0c0), side: THREE.DoubleSide });
  gumMat.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * 0.06;');
  };
  // triplanar-free: gum UVs are absent, so derive simple planar UVs from x/z
  function planarUV(g) {
    const p = g.attributes.position;
    const uv = new Float32Array(p.count * 2);
    for (let i = 0; i < p.count; i++) { uv[i * 2] = p.getX(i) + p.getZ(i) * 0.3; uv[i * 2 + 1] = p.getY(i) + p.getZ(i) * 0.7; }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    return g;
  }
  const upperGum = new THREE.Mesh(planarUV(buildGingiva(true, gumInfo.upper)), gumMat);
  const lowerGum = new THREE.Mesh(planarUV(buildGingiva(false, gumInfo.lower)), gumMat);
  upperGum.receiveShadow = lowerGum.receiveShadow = true;
  upperGum.castShadow = lowerGum.castShadow = true;
  upperGum.name = 'gum'; lowerGum.name = 'gum';
  upper.add(upperGum); lower.add(lowerGum);

  const softMat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.38, clearcoat: 0.9, clearcoatRoughness: 0.2, sheen: 0.3, sheenColor: new THREE.Color(0xffb0b0) });
  softMat.onBeforeCompile = gumMat.onBeforeCompile;
  const palate = new THREE.Mesh(buildPalate(upperGum.geometry.userData.lingualRim), softMat);
  palate.material = softMat.clone();
  palate.material.side = THREE.DoubleSide;
  palate.receiveShadow = true;
  upper.add(palate);
  const tongue = new THREE.Mesh(buildTongue(), softMat);
  tongue.position.set(0, -13, -17);
  tongue.receiveShadow = true; tongue.castShadow = true;
  tongue.name = 'tongue';
  lower.add(tongue);

  // dark oral cavity behind everything
  const cavity = new THREE.Mesh(new THREE.SphereGeometry(75, 32, 24), new THREE.MeshStandardMaterial({ color: 0x2a0c0e, roughness: 0.6, side: THREE.BackSide }));
  cavity.position.set(0, -6, -40);
  cavity.scale.set(0.8, 0.75, 1);
  scene.add(cavity);

  const lipMat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.4, clearcoat: 0.6, clearcoatRoughness: 0.3, sheen: 0.4, sheenColor: new THREE.Color(0xffd0d0) });
  lipMat.onBeforeCompile = gumMat.onBeforeCompile;
  const skinMat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.62, sheen: 0.6, sheenRoughness: 0.5, sheenColor: new THREE.Color(0xffd8c8), side: THREE.DoubleSide });
  const face = { upper: new THREE.Group(), lower: new THREE.Group() };
  scene.add(face.upper, face.lower);
  function rebuildLips(sepMM) {
    for (const k of ['upper', 'lower']) {
      for (const c of [...face[k].children]) { face[k].remove(c); c.geometry.dispose(); }
    }
    const L = buildLips(sepMM, skinRGB);
    for (const k of ['upper', 'lower']) {
      const l = new THREE.Mesh(L[k].lips, lipMat), sk = new THREE.Mesh(L[k].skin, skinMat);
      l.castShadow = sk.castShadow = true; l.receiveShadow = sk.receiveShadow = true;
      face[k].add(l, sk);
    }
  }

  let openDegrees = 0;
  function setOpen(deg) {
    openDegrees = deg;
    lowerPivot.rotation.x = THREE.MathUtils.degToRad(deg);
    lowerPivot.updateMatrixWorld(true);
    const sep = Math.sin(THREE.MathUtils.degToRad(deg)) * 88;
    rebuildLips(sep);
  }
  setOpen(openDeg);

  // --- camera rig (orbit around a target, constrained)
  const rig = { target: new THREE.Vector3(0, -2, 6), dist: 150, yaw: 0, pitch: 0.35, goal: null };
  const presets = {
    front: { target: new THREE.Vector3(0, -12, 16), dist: 165, yaw: 0, pitch: 0.12 },
    lower: { target: new THREE.Vector3(0, -30, 0), dist: 140, yaw: 0, pitch: 0.95 },
    upper: { target: new THREE.Vector3(0, 6, 2), dist: 140, yaw: 0, pitch: -0.75 },
  };
  function applyRig() {
    const cp = Math.cos(rig.pitch), sp = Math.sin(rig.pitch);
    camera.position.set(
      rig.target.x + Math.sin(rig.yaw) * cp * rig.dist,
      rig.target.y + sp * rig.dist,
      rig.target.z + Math.cos(rig.yaw) * cp * rig.dist,
    );
    camera.lookAt(rig.target);
  }
  function setView(name) {
    const p = presets[name];
    if (p) rig.goal = { target: p.target.clone(), dist: p.dist, yaw: p.yaw, pitch: p.pitch };
  }
  function focusTooth(fdi, close = 70) {
    const t = teeth.get(fdi);
    if (!t) return;
    const c = new THREE.Vector3(0, t.tooth.Hc * 0.6, 0).applyMatrix4(t.group.matrixWorld);
    const upperT = t.tooth.spec.upper;
    const yaw = Math.atan2(c.x, Math.max(10, c.z + 40)) * 0.9;
    rig.goal = { target: c, dist: close, yaw, pitch: upperT ? -0.8 : 0.95 };
  }
  Object.assign(rig, presets.front, { target: presets.front.target.clone() });
  applyRig();

  function updateRig(dt, input, allowOrbit = true) {
    if (input && allowOrbit) {
      if (input.mouse.buttons & 2) {
        rig.yaw -= input.mouse.dx * 0.005;
        rig.pitch += input.mouse.dy * 0.005;
        rig.goal = null;
      }
      if (input.mouse.wheel) { rig.dist *= Math.pow(1.12, input.mouse.wheel); rig.goal = null; }
      const pan = 30 * dt;
      if (input.down('KeyW')) rig.target.y += pan;
      if (input.down('KeyS')) rig.target.y -= pan;
      if (input.down('KeyA')) rig.target.x -= pan;
      if (input.down('KeyD')) rig.target.x += pan;
    }
    if (rig.goal) {
      const k = Math.min(1, dt * 4);
      rig.target.lerp(rig.goal.target, k);
      rig.dist += (rig.goal.dist - rig.dist) * k;
      rig.yaw += (rig.goal.yaw - rig.yaw) * k;
      rig.pitch += (rig.goal.pitch - rig.pitch) * k;
      if (Math.abs(rig.goal.dist - rig.dist) < 0.5 && rig.target.distanceTo(rig.goal.target) < 0.3) rig.goal = null;
    }
    rig.pitch = THREE.MathUtils.clamp(rig.pitch, -1.2, 1.35);
    rig.yaw = THREE.MathUtils.clamp(rig.yaw, -1.1, 1.1);
    rig.dist = THREE.MathUtils.clamp(rig.dist, 28, 260);
    // retract whichever lip blocks the line of sight
    face.upper.visible = rig.pitch < 0.5;
    face.lower.visible = rig.pitch > -0.3;
    // looking straight onto one arch: take the opposing arch out of the way (like a mirror view)
    upper.visible = rig.pitch < 0.62;
    lower.visible = rig.pitch > -0.45;
    rig.target.x = THREE.MathUtils.clamp(rig.target.x, -35, 35);
    rig.target.y = THREE.MathUtils.clamp(rig.target.y, -45, 25);
    applyRig();
  }

  // --- picking
  const raycaster = new THREE.Raycaster();
  const toothMeshes = () => [...teeth.values()].filter((t) => t.group.visible).map((t) => t.mesh);
  function pick(ndc, { gums = false } = {}) {
    raycaster.setFromCamera(ndc, camera);
    const targets = toothMeshes();
    if (gums) targets.push(upperGum, lowerGum, tongue, palate);
    const hit = raycaster.intersectObjects(targets, false)[0];
    if (!hit) return null;
    const fdi = hit.object.userData.fdi;
    const out = { point: hit.point.clone(), object: hit.object, fdi, distance: hit.distance };
    out.normal = hit.face ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld) : new THREE.Vector3(0, 1, 0);
    if (fdi) {
      const t = teeth.get(fdi);
      out.tooth = t;
      out.local = hit.point.clone().applyMatrix4(new THREE.Matrix4().copy(t.group.matrixWorld).invert());
    }
    return out;
  }

  function update(dt) {
    for (const t of teeth.values()) t.state.update();
  }

  function resize(aspect) { camera.aspect = aspect; camera.updateProjectionMatrix(); }

  return {
    scene, camera, teeth, upper, lower, face, lowerPivot, tongue, palate, upperGum, lowerGum, lamp,
    setOpen, get openDegrees() { return openDegrees; },
    rig, setView, focusTooth, updateRig, pick, update, resize, FILL,
  };
}
