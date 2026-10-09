// Merges several single-take animation GLBs (FBX2glTF output) into one animation library.
// Usage: node pack-anims.mjs <out.glb> <name>=<in.glb> ...
import { NodeIO, Document } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { mergeDocuments, prune, dedup, resample } from '@gltf-transform/functions';
import fs from 'node:fs';

const [outPath, ...pairs] = process.argv.slice(2);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const target = new Document();
target.createBuffer();
for (const pair of pairs) {
  const [name, file] = pair.split('=');
  const src = await io.read(file);
  for (const a of src.getRoot().listAnimations()) a.setName(name);
  for (const m of src.getRoot().listMeshes()) m.dispose();
  mergeDocuments(target, src);
}
// Point every channel at the first copy of each skeleton node, then drop the duplicates.
const canonical = new Map();
for (const node of target.getRoot().listNodes()) if (!canonical.has(node.getName())) canonical.set(node.getName(), node);
for (const anim of target.getRoot().listAnimations()) {
  for (const ch of anim.listChannels()) {
    const n = ch.getTargetNode();
    if (n && canonical.get(n.getName()) !== n) ch.setTargetNode(canonical.get(n.getName()));
  }
}
const scenes = target.getRoot().listScenes();
for (const sc of scenes.slice(1)) sc.dispose();
for (const node of target.getRoot().listNodes()) if (canonical.get(node.getName()) !== node) node.dispose();
const buf = target.getRoot().listBuffers()[0];
for (const acc of target.getRoot().listAccessors()) acc.setBuffer(buf);
for (const b of target.getRoot().listBuffers().slice(1)) b.dispose();
await target.transform(resample({ tolerance: 1e-4 }), prune({ keepLeaves: true }), dedup());
await io.write(outPath, target);
console.log('wrote', outPath, (fs.statSync(outPath).size / 1e6).toFixed(2), 'MB', target.getRoot().listAnimations().map(a => a.getName()).join(','));
