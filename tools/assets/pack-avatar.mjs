// Packs a Rocketbox avatar converted by FBX2glTF into a game-ready GLB:
// keeps a small set of facial blendshapes, attaches WebP textures, drops the bind-pose take.
// Usage: node pack-avatar.mjs <in.glb> <textures dir> <morph-names.json> <out.glb>
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTTextureWebP } from '@gltf-transform/extensions';
import { prune, dedup, weld } from '@gltf-transform/functions';
import fs from 'node:fs';
import path from 'node:path';

const [inPath, texDir, namesPath, outPath] = process.argv.slice(2);
const KEEP = [
  'AK_25_JawOpen', 'AK_09_EyeBlinkLeft', 'AK_10_EyeBlinkRight', 'AK_03_BrowInnerUp',
  'AK_01_BrowDownLeft', 'AK_02_BrowDownRight', 'AK_44_MouthSmileLeft', 'AK_45_MouthSmileRight',
  'AK_30_MouthFrownLeft', 'AK_31_MouthFrownRight', 'AK_19_EyeSquintLeft', 'AK_20_EyeSquintRight',
  'AK_46_MouthStretchLeft', 'AK_47_MouthStretchRight', 'AK_32_MouthFunnel', 'AK_21_EyeWideLeft', 'AK_22_EyeWideRight',
  'AA_VI_10_aa', 'AA_VI_13_O', 'AA_VI_11_E', 'AA_VI_01_PP', 'AA_VI_02_FF'
];

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(inPath);
const root = doc.getRoot();
const names = JSON.parse(fs.readFileSync(namesPath, 'utf8'));

for (const mesh of root.listMeshes()) {
  let kept = null;
  for (const prim of mesh.listPrimitives()) {
    const targets = prim.listTargets();
    if (!targets.length) continue;
    if (targets.length !== names.length) throw new Error(`target count ${targets.length} != names ${names.length}`);
    kept = [];
    targets.forEach((t, i) => {
      if (KEEP.includes(names[i])) kept.push(names[i]);
      else { prim.removeTarget(t); t.dispose(); }
    });
  }
  if (kept) {
    mesh.setWeights(kept.map(() => 0));
    mesh.setExtras({ ...(mesh.getExtras() || {}), targetNames: kept });
  }
}

for (const anim of root.listAnimations()) anim.dispose();

const webp = doc.createExtension(EXTTextureWebP).setRequired(true);
const tex = (file) => {
  const p = path.join(texDir, file);
  if (!fs.existsSync(p)) return null;
  return doc.createTexture(file).setImage(fs.readFileSync(p)).setMimeType('image/webp').setURI(file);
};
const T = {
  body: tex('body_color.webp'), bodyN: tex('body_normal.webp'),
  head: tex('head_color.webp'), headN: tex('head_normal.webp'),
  opacity: tex('opacity_color.webp'),
};
for (const mat of root.listMaterials()) {
  const n = mat.getName().toLowerCase();
  // drop placeholder 1x1 textures written by FBX2glTF
  for (const slot of ['BaseColor', 'Normal', 'MetallicRoughness', 'Occlusion', 'Emissive']) {
    if (mat[`get${slot}Texture`]()) mat[`set${slot}Texture`](null);
  }
  mat.setMetallicFactor(0).setEmissiveFactor([0, 0, 0]).setBaseColorFactor([1, 1, 1, 1]);
  if (n.endsWith('_body')) {
    mat.setBaseColorTexture(T.body).setNormalTexture(T.bodyN).setRoughnessFactor(0.78);
  } else if (n.endsWith('_head')) {
    mat.setBaseColorTexture(T.head).setNormalTexture(T.headN).setRoughnessFactor(0.55);
  } else if (n.endsWith('_opacity')) {
    mat.setBaseColorTexture(T.opacity).setAlphaMode('MASK').setAlphaCutoff(0.4).setDoubleSided(true).setRoughnessFactor(0.7);
  }
  for (const ext of mat.listExtensions()) ext.dispose?.();
}
await doc.transform(prune(), dedup());
await io.write(outPath, doc);
console.log('wrote', outPath, (fs.statSync(outPath).size / 1e6).toFixed(2), 'MB');
