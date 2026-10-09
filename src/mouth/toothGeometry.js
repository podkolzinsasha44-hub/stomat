// Parametric anatomical tooth meshes.
// Local frame (mm): +x mesial, +y occlusal (toward the bite), +z buccal/labial.
// The cemento-enamel junction (CEJ) sits at y = 0; the crown is above, roots below.
import * as THREE from 'three';
import { toothSpec } from './toothData.js';

const U = 64;     // segments around the long axis
const SIDE = 24;  // rings on the crown sides
const CAP = 14;   // rings on the occlusal table
const ROOT = 18;  // rings down the (main) root

const PROFILE = {
  incisor: { n: 2.3, tcMD: 0.72, tcBL: 0.22, shrinkMD: 0.06, shrinkBL: 0.8, shovel: 0.2 },
  canine: { n: 2.1, tcMD: 0.55, tcBL: 0.28, shrinkMD: 0.42, shrinkBL: 0.55, shovel: 0.12 },
  premolar: { n: 2.5, tcMD: 0.62, tcBL: 0.32, shrinkMD: 0.2, shrinkBL: 0.3, shovel: 0 },
  molar: { n: 3.1, tcMD: 0.62, tcBL: 0.3, shrinkMD: 0.14, shrinkBL: 0.2, shovel: 0 },
};

function superR(phi, a, b, n) {
  const c = Math.abs(Math.cos(phi)) / a, s = Math.abs(Math.sin(phi)) / b;
  return 1 / Math.pow(Math.pow(c, n) + Math.pow(s, n), 1 / n);
}
const smooth = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
const gauss = (dx, dz, sx, sz = sx) => Math.exp(-(dx * dx) / (2 * sx * sx) - (dz * dz) / (2 * sz * sz));

// Occlusal relief: height offset (mm) over normalized coordinates X (mesial+), Z (buccal+).
function occlusalFn(spec) {
  const { type, upper, pos } = spec;
  let cusps = [], extra = () => 0;
  if (type === 'molar') {
    if (upper) {
      cusps = [[0.46, 0.5, 1.7, 0.3], [-0.46, 0.52, 1.45, 0.28], [0.38, -0.45, 2.0, 0.36], [-0.5, -0.5, pos === 8 ? 0.6 : 1.1, 0.27]];
      extra = (X, Z) => {
        // oblique ridge from mesiopalatal to distobuccal cusp
        const t = THREE.MathUtils.clamp(((X - 0.38) * (-0.84) + (Z + 0.45) * 0.97) / (0.84 * 0.84 + 0.97 * 0.97), 0, 1);
        const px = 0.38 - 0.84 * t, pz = -0.45 + 0.97 * t;
        return 0.55 * gauss(X - px, Z - pz, 0.13) - 0.9 * gauss(X - 0.15, Z - 0.05, 0.22) - 0.55 * gauss(X + 0.35, Z + 0.15, 0.17)
          - 0.5 * gauss(X + 0.02, 0, 0.07, 9) * smooth(0.05, 0.3, Z);
      };
    } else if (pos === 6) {
      cusps = [[0.55, 0.47, 1.45, 0.27], [0.0, 0.56, 1.35, 0.26], [-0.62, 0.33, 0.95, 0.22], [0.5, -0.48, 1.9, 0.29], [-0.42, -0.5, 1.7, 0.28]];
      extra = (X, Z) => -0.75 * gauss(0, Z - 0.02, 1, 0.09) * (1 - smooth(0.75, 0.95, Math.abs(X))) - 0.6 * gauss(X - 0.05, Z, 0.25)
        - 0.4 * gauss(X - 0.28, 0, 0.06, 9) * smooth(0.1, 0.35, Z) - 0.35 * gauss(X + 0.33, 0, 0.06, 9) * smooth(0.1, 0.35, Z);
    } else {
      cusps = [[0.48, 0.48, 1.4, 0.28], [-0.48, 0.48, 1.3, 0.28], [0.48, -0.48, 1.75, 0.3], [-0.48, -0.48, 1.55, 0.29]];
      extra = (X, Z) => -0.7 * gauss(0, Z, 1, 0.08) * (1 - smooth(0.75, 0.95, Math.abs(X))) - 0.6 * gauss(X, 0, 0.07, 1) * (1 - smooth(0.75, 0.95, Math.abs(Z))) - 0.5 * gauss(X, Z, 0.2);
    }
  } else if (type === 'premolar') {
    if (upper) cusps = [[0.0, 0.48, 2.3, 0.36], [0.0, -0.5, pos === 4 ? 1.9 : 2.1, 0.34]];
    else if (pos === 4) cusps = [[0.0, 0.38, 2.4, 0.42], [0.0, -0.56, 0.9, 0.28]];
    else cusps = [[0.0, 0.42, 1.95, 0.38], [0.35, -0.45, 1.35, 0.26], [-0.4, -0.45, 1.05, 0.25]];
    extra = (X, Z) => -0.65 * gauss(0, Z - (upper ? 0 : -0.05), 1, 0.1) * (1 - smooth(0.6, 0.85, Math.abs(X)))
      + 0.55 * (smooth(0.62, 0.9, Math.abs(X))) - 0.4 * gauss(X, Z, 0.25);
  } else if (type === 'canine') {
    return (X, Z) => 2.9 * Math.max(0, 1 - Math.abs(X - 0.06) * 1.05) * gauss(0, Z - 0.12, 1, 0.5) - 0.3;
  } else {
    // incisal edge with faint mamelons
    return (X, Z) => 0.25 + 0.08 * Math.cos(X * Math.PI * 3) * gauss(0, Z, 1, 0.4) - 0.25 * smooth(0.6, 1, Math.abs(X));
  }
  return (X, Z) => {
    let h = 0;
    for (const [cx, cz, ch, cs] of cusps) h += ch * gauss(X - cx, Z - cz, cs);
    return h + extra(X, Z) - 0.25;
  };
}

function ringsToGeometry(rings, poleBottom, poleTop) {
  // rings: arrays of U THREE.Vector3; poles optional Vector3 closing the ends
  const n = rings.length;
  const verts = [];
  if (poleBottom) verts.push(poleBottom);
  for (const r of rings) for (const p of r) verts.push(p);
  if (poleTop) verts.push(poleTop);
  const pos = new Float32Array(verts.length * 3);
  verts.forEach((v, i) => { pos[i * 3] = v.x; pos[i * 3 + 1] = v.y; pos[i * 3 + 2] = v.z; });
  const idx = [];
  const off = poleBottom ? 1 : 0;
  const ringStart = (i) => off + i * U;
  if (poleBottom) for (let j = 0; j < U; j++) idx.push(0, ringStart(0) + j, ringStart(0) + ((j + 1) % U));
  for (let i = 0; i < n - 1; i++) {
    const a = ringStart(i), b = ringStart(i + 1);
    for (let j = 0; j < U; j++) {
      const j1 = (j + 1) % U;
      idx.push(a + j, b + j, a + j1);
      idx.push(a + j1, b + j, b + j1);
    }
  }
  if (poleTop) {
    const top = verts.length - 1, last = ringStart(n - 1);
    for (let j = 0; j < U; j++) idx.push(last + j, top, last + ((j + 1) % U));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// A tube with elliptical, tapering cross-section along a path, closed at both ends.
function rootTube(path, rx0, rz0, taperPow = 0.9, steps = 16, segs = 20) {
  const rings = [];
  const pts = path.getSpacedPoints(steps);
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const f = Math.max(0.06, Math.pow(1 - u, taperPow) * (1 - 0.15 * u)) + (u > 0.9 ? 0 : 0);
    const ring = [];
    for (let j = 0; j < segs; j++) {
      const phi = (j / segs) * Math.PI * 2;
      ring.push(new THREE.Vector3(pts[i].x + Math.cos(phi) * rx0 * f, pts[i].y, pts[i].z + Math.sin(phi) * rz0 * f));
    }
    rings.push(ring);
  }
  // build with a local ring size
  const verts = [pts[0].clone(), ...rings.flat(), pts[steps].clone().add(new THREE.Vector3(0, -0.15, 0))];
  const pos = new Float32Array(verts.length * 3);
  verts.forEach((v, i) => { pos[i * 3] = v.x; pos[i * 3 + 1] = v.y; pos[i * 3 + 2] = v.z; });
  const idx = [];
  const rs = (i) => 1 + i * segs;
  for (let j = 0; j < segs; j++) idx.push(0, rs(0) + ((j + 1) % segs), rs(0) + j);
  for (let i = 0; i < steps; i++) {
    for (let j = 0; j < segs; j++) {
      const j1 = (j + 1) % segs;
      const a = rs(i), b = rs(i + 1);
      idx.push(a + j, a + j1, b + j);
      idx.push(a + j1, b + j1, b + j);
    }
  }
  const tip = verts.length - 1;
  for (let j = 0; j < segs; j++) idx.push(rs(steps) + j, rs(steps) + ((j + 1) % segs), tip);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export function buildTooth(fdi) {
  const spec = toothSpec(fdi);
  const P = PROFILE[spec.type];
  const occ = occlusalFn(spec);
  const a1 = spec.md / 2, b1 = spec.bl / 2;
  // side surface height so that cusp tips reach the anatomical crown height
  let maxOcc = 0;
  for (let i = -10; i <= 10; i++) for (let k = -10; k <= 10; k++) maxOcc = Math.max(maxOcc, occ(i / 10, k / 10));
  const Hc = Math.max(spec.h * 0.55, spec.h - maxOcc * 0.95);

  const aAt = (t) => a1 * (t <= P.tcMD ? THREE.MathUtils.lerp(spec.cmd / spec.md, 1, Math.sin((Math.PI / 2) * t / P.tcMD)) : 1 - P.shrinkMD * ((t - P.tcMD) / (1 - P.tcMD)) ** 2);
  const bAt = (t) => b1 * (t <= P.tcBL ? THREE.MathUtils.lerp(spec.cbl / spec.bl, 1, Math.sin((Math.PI / 2) * t / P.tcBL)) : 1 - P.shrinkBL * ((t - P.tcBL) / (1 - P.tcBL)) ** 2);

  const rings = [];
  const regions = []; // per ring: param code (root: -u, side: t, cap: 1 + k/CAP)

  // --- root (main) or trunk
  const multi = !!spec.roots;
  const trunk = multi ? (spec.trunk ?? 3) : 0;
  const rootRings = multi ? 6 : ROOT;
  for (let j = rootRings; j >= 1; j--) {
    const u = j / rootRings;
    let y, f, dx = 0;
    if (multi) {
      y = -u * trunk;
      f = 1 - 0.1 * u;
    } else {
      y = -u * spec.root;
      f = Math.max(0.05, Math.pow(1 - u, 0.8) * 0.92 + 0.08 * (1 - u));
      dx = -0.07 * spec.root * u * u;
    }
    const ring = [];
    for (let k = 0; k < U; k++) {
      const phi = (k / U) * Math.PI * 2;
      const r = superR(phi, spec.cmd / 2 * f, spec.cbl / 2 * f, 2.2);
      ring.push(new THREE.Vector3(Math.cos(phi) * r + dx, y, Math.sin(phi) * r));
    }
    rings.push(ring);
    regions.push(-u);
  }

  // --- crown sides
  for (let i = 0; i <= SIDE; i++) {
    const t = Math.pow(i / SIDE, 0.85);
    const a = aAt(t), b = bAt(t);
    const w = smooth(0.55, 1, t);
    const ring = [];
    for (let k = 0; k < U; k++) {
      const phi = (k / U) * Math.PI * 2;
      let r = superR(phi, a, b, P.n);
      // lingual shovel / cingulum on anterior teeth
      if (P.shovel) {
        const ling = Math.max(0, -Math.sin(phi));
        r *= 1 - P.shovel * smooth(0.35, 0.75, t) * (1 - smooth(0.9, 1, t)) * ling * ling;
        r *= 1 + 0.08 * gauss(t - 0.2, 0, 0.1) * ling;
      }
      const x = Math.cos(phi) * r, z = Math.sin(phi) * r;
      const y = t * Hc + occ(x / a1, z / b1) * w;
      ring.push(new THREE.Vector3(x, y, z));
    }
    rings.push(ring);
    regions.push(t);
  }
  // --- occlusal cap
  const rim = rings[rings.length - 1];
  for (let k = 1; k <= CAP; k++) {
    const s = 1 - Math.pow(k / (CAP + 1), 1.15);
    const ring = rim.map((p) => {
      const x = p.x * s, z = p.z * s;
      return new THREE.Vector3(x, Hc + occ(x / a1, z / b1), z);
    });
    rings.push(ring);
    regions.push(1 + k / CAP);
  }
  const top = new THREE.Vector3(0, Hc + occ(0, 0), 0);
  let bottom;
  if (multi) {
    bottom = new THREE.Vector3(0, -trunk - 0.6, 0);
  } else {
    bottom = new THREE.Vector3(-0.07 * spec.root, -spec.root - 0.4, 0);
  }
  const crown = ringsToGeometry(rings, bottom, top);

  // per-vertex param codes in vertex order (bottom pole, rings, top pole)
  const vt = new Float32Array(crown.attributes.position.count);
  let vi = 0;
  vt[vi++] = multi ? -1 : -1;
  for (const r of regions) for (let k = 0; k < U; k++) vt[vi++] = r;
  vt[vi++] = 2;

  // --- separate roots for multi-rooted teeth
  const roots = [];
  const canals = [];
  const rootPaths = [];
  if (multi) {
    for (const r of spec.roots) {
      const x0 = r.x * spec.cmd / 2, z0 = r.z * spec.cbl / 2;
      const len = spec.root;
      const y0 = -trunk + 1.4;
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(x0, y0, z0),
        new THREE.Vector3(x0 * 1.15, y0 - (len - trunk) * 0.35, z0 * 1.2),
        new THREE.Vector3(x0 * 1.3 - 0.5, y0 - (len - trunk) * 0.7, z0 * 1.35),
        new THREE.Vector3(x0 * 1.25 - 1.1, -len, z0 * 1.3),
      ]);
      let rx, rz;
      if (spec.upper && spec.type === 'molar') { rx = rz = r.r * Math.min(spec.cmd, spec.cbl) * 0.55; }
      else if (spec.type === 'premolar') { rx = spec.cmd / 2 * 0.72; rz = spec.cbl / 2 * 0.42; }
      else { rx = spec.cmd / 2 * r.r * 0.8; rz = spec.cbl / 2 * 0.85 * (r.flat ?? 1); }
      roots.push(rootTube(curve, rx, rz, 0.85));
      rootPaths.push({ curve, rx, rz, name: r.name, canals: r.canals || 1 });
    }
  } else {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -0.5, 0),
      new THREE.Vector3(-0.07 * spec.root * 0.11, -spec.root * 0.33, 0),
      new THREE.Vector3(-0.07 * spec.root * 0.44, -spec.root * 0.66, 0),
      new THREE.Vector3(-0.07 * spec.root, -spec.root, 0),
    ]);
    rootPaths.push({ curve, rx: spec.cmd / 2 * 0.9, rz: spec.cbl / 2 * 0.9, name: 'main', canals: spec.upper && spec.pos === 4 ? 2 : 1 });
  }

  // --- pulp chamber and canals (closed shapes, used by X-ray and endodontics)
  const chamberTop = Hc * (spec.type === 'incisor' ? 0.55 : 0.4);
  const chamber = new THREE.SphereGeometry(1, 20, 14);
  chamber.scale(spec.cmd * 0.22, (chamberTop + 1.5) / 2, spec.cbl * 0.2);
  chamber.translate(0, (chamberTop - 1.5) / 2, 0);
  const pulp = [chamber];
  for (const rp of rootPaths) {
    const n = rp.canals;
    for (let c = 0; c < n; c++) {
      const off = n > 1 ? (c - (n - 1) / 2) * (rp.rz * 0.7) : 0;
      const pts = rp.curve.getPoints(10).map((p) => new THREE.Vector3(p.x * 0.97, p.y, p.z * 0.97 + off * (1 - (p.y / -spec.root) * 0.6)));
      pts[0].y = Math.min(pts[0].y, 0.2);
      pts[pts.length - 1].y += 0.6; // canal ends just short of the radiographic apex
      const cc = new THREE.CatmullRomCurve3(pts);
      pulp.push(rootTube(cc, 0.42, 0.42, 1.2, 14, 10));
      canals.push({ curve: cc, root: rp.name, length: cc.getLength() });
    }
  }

  // reference points on the crown surface for lesion placement (local)
  const ref = {
    O: new THREE.Vector3(spec.type === 'molar' ? 0.1 * a1 : 0, Hc + occ(0.1, 0), 0),
    M: new THREE.Vector3(aAt(0.7) * 0.98, Hc * 0.62, 0),
    D: new THREE.Vector3(-aAt(0.7) * 0.98, Hc * 0.62, 0),
    B: new THREE.Vector3(0, Hc * 0.22, bAt(0.22) * 0.98),
    L: new THREE.Vector3(0, Hc * 0.3, -bAt(0.3) * 0.98),
    I: new THREE.Vector3(0, Hc + 0.2, 0),
  };

  return { spec, crown, roots, pulp, vt, Hc, crownTop: top.y, ref, canals, rootPaths, a1, b1, trunk };
}
