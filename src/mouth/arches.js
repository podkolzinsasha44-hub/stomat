// Dental arches: tooth placement along anatomical arch curves, gingiva, palate, tongue, lips.
// Mouth frame (mm): +y superior, +z anterior (toward the lips), +x patient's left.
import * as THREE from 'three';

const srgb = (r, g, b) => new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace);
import { toothSpec } from './toothData.js';

// Half-arch curves (patient's left side, x >= 0) along the contact points of the teeth.
const UPPER_CURVE = [[0, 26.5], [8.5, 24.4], [15.5, 19.2], [20.2, 11.6], [22.8, 3.0], [24.8, -6.8], [26.3, -17.5], [27.4, -29], [28, -38]];
const LOWER_CURVE = [[0, 23.6], [6.8, 22.0], [12.8, 17.8], [17.4, 11.0], [20.3, 2.8], [22.3, -6.5], [23.7, -17], [24.6, -28.5], [25.2, -38]];

function halfCurve(points) {
  return new THREE.CatmullRomCurve3(points.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal');
}
export const curves = { upper: halfCurve(UPPER_CURVE), lower: halfCurve(LOWER_CURVE) };

// Occlusal plane height (curve of Spee / compensating curve) by arc distance from the midline.
function speeHeight(s, upper) {
  const lift = 1.6 * THREE.MathUtils.smoothstep(s, 18, 58);
  return upper ? lift - 0 : lift;
}

// Returns placement frames for all 8 teeth of a quadrant.
export function quadrantLayout(quadrant) {
  const upper = quadrant === 1 || quadrant === 2;
  const left = quadrant === 2 || quadrant === 3;
  const curve = upper ? curves.upper : curves.lower;
  const L = curve.getLength();
  const out = [];
  let s = 0;
  for (let pos = 1; pos <= 8; pos++) {
    const spec = toothSpec(quadrant * 10 + pos);
    const center = s + spec.md / 2;
    s += spec.md + 0.15;
    const u = Math.min(1, center / L);
    const p = curve.getPointAt(u);
    const t = curve.getTangentAt(u).normalize(); // distal direction (left side)
    const n = new THREE.Vector3(-t.z, 0, t.x).normalize(); // buccal
    if (n.z < 0 && pos < 3) n.negate();
    if (!left) { p.x = -p.x; t.x = -t.x; n.x = -n.x; }
    // incisal overlap: the upper front teeth cover the lower ones
    const overbite = upper ? -2.4 * (1 - THREE.MathUtils.smoothstep(center, 8, 26)) : 0;
    const y = speeHeight(center, upper) + overbite;
    out.push({ fdi: quadrant * 10 + pos, spec, point: new THREE.Vector3(p.x, y, p.z), mesial: t.clone().negate(), buccal: n, arc: center });
  }
  return out;
}

// Axial inclinations (degrees): torque = crown toward buccal (+), tip = crown toward mesial (+)
const TORQUE = { U: [17, 10, 7, -6, -6, -9, -9, -9], L: [-1, -1, -11, -17, -22, -28, -32, -32] };
const TIP = { U: [5, 9, 11, 2, 2, 5, 3, 0], L: [2, 2, 5, 2, 2, 2, 2, 0] };

export function toothMatrix(layout, crownTop) {
  const { spec, point, mesial, buccal } = layout;
  const occl = new THREE.Vector3(0, spec.upper ? -1 : 1, 0);
  const torque = THREE.MathUtils.degToRad(TORQUE[spec.upper ? 'U' : 'L'][spec.pos - 1]);
  const tip = THREE.MathUtils.degToRad(TIP[spec.upper ? 'U' : 'L'][spec.pos - 1]);
  // tilt the long axis: crown toward buccal by torque (about the mesial axis), toward mesial by tip
  const q = new THREE.Quaternion().setFromAxisAngle(mesial, spec.upper ? torque : -torque);
  const q2 = new THREE.Quaternion().setFromAxisAngle(buccal, spec.upper ? -tip : tip);
  const o = occl.clone().applyQuaternion(q).applyQuaternion(q2);
  const b = buccal.clone().applyQuaternion(q).applyQuaternion(q2);
  const m = mesial.clone().applyQuaternion(q).applyQuaternion(q2);
  const M = new THREE.Matrix4().makeBasis(m, o, b);
  // the cusp tips touch the occlusal plane at layout.point
  const origin = point.clone().addScaledVector(o, -crownTop);
  M.setPosition(origin);
  return M;
}

// ---------- gingiva ----------
// Builds a gum ribbon along an arch. teeth: array of {layout, present, cervBL, cejWorld (Vector3 at CEJ center)}
export function buildGingiva(upper, teethInfo, { recession = 0 } = {}) {
  const curve = upper ? curves.upper : curves.lower;
  const L = curve.getLength();
  const sign = upper ? 1 : -1; // direction away from the occlusal plane (toward the apices)
  const N = 220;
  // sample along the full arch: from right posterior to left posterior
  const samples = [];
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * 2 - 1; // -1 .. 1
    const sArc = Math.abs(a) * (L - 1);
    const u = sArc / L;
    const p = curve.getPointAt(u);
    const t = curve.getTangentAt(u).normalize();
    let n = new THREE.Vector3(-t.z, 0, t.x).normalize();
    if (a < 0) { p.x = -p.x; n.x = -n.x; }
    if (a === 0) n.set(0, 0, 1);
    samples.push({ p, n, sArc, side: a < 0 ? 'R' : 'L' });
  }
  // per-sample gingival parameters, interpolated smoothly between neighbouring teeth
  const quadR = upper ? 1 : 4, quadL = upper ? 2 : 3;
  const byQuad = {
    R: teethInfo.filter((t) => Math.floor(t.fdi / 10) === quadR).sort((p, q) => p.layout.arc - q.layout.arc),
    L: teethInfo.filter((t) => Math.floor(t.fdi / 10) === quadL).sort((p, q) => p.layout.arc - q.layout.arc),
  };
  const lerp = THREE.MathUtils.lerp;
  function params(side, sArc) {
    const list = byQuad[side];
    let i = 0;
    while (i < list.length - 1 && list[i + 1].layout.arc <= sArc) i++;
    const A = list[i], B = list[Math.min(i + 1, list.length - 1)];
    let t = A === B ? 0 : THREE.MathUtils.clamp((sArc - A.layout.arc) / (B.layout.arc - A.layout.arc), 0, 1);
    if (sArc < list[0].layout.arc) t = 0;
    const presentA = A.present ? 1 : 0, presentB = B.present ? 1 : 0;
    const last = list[list.length - 1];
    const beyondBy = Math.max(0, sArc - (last.layout.arc + last.spec.md / 2));
    let present = lerp(presentA, presentB, THREE.MathUtils.smoothstep(t, 0.3, 0.7)) * (1 - THREE.MathUtils.smoothstep(beyondBy, 0, 2.5));
    const cej = lerp(A.cejY, B.cejY, t);
    const halfBL = lerp(A.spec.cbl, B.spec.cbl, t) / 2;
    // papilla peaks at contact points between two present teeth (and at the midline)
    let pap = 0;
    const contacts = [{ s: 0, both: (list[0].present ? 1 : 0) }];
    for (let k = 0; k < list.length - 1; k++) contacts.push({ s: list[k].layout.arc + list[k].spec.md / 2 + 0.07, both: list[k].present && list[k + 1].present ? 1 : 0 });
    for (const c of contacts) pap = Math.max(pap, c.both * Math.exp(-(((sArc - c.s) / 1.6) ** 2)));
    const swelling = lerp(A.swelling, B.swelling, t), redness = lerp(A.redness, B.redness, t);
    return { present, cej, halfBL, pap, beyond: beyondBy > 0, swelling, redness };
  }
  // cross-section profile: [lateral offset multiplier type, vertical offset]
  const rows = [];
  const colors = [];
  const PROFILE = [
    // [side(-1 lingual, 0 crest, 1 buccal), extraWidth, depth below margin]
    [-1, 5.5, 16], [-1, 4.0, 10], [-1, 2.6, 5.5], [-1, 1.4, 2.4], [-1, 0.75, 0.7], [-1, 0.45, 0.05],
    [0, 0, -0.6],
    [1, 0.45, 0.05], [1, 0.75, 0.7], [1, 1.5, 2.6], [1, 2.8, 6], [1, 3.9, 10], [1, 5.0, 15],
  ];
  const pos = [];
  for (const smp of samples) {
    const g = params(smp.side, smp.sArc);
    // free gingival margin: ~1 mm over the CEJ at the tooth centre, papilla tip ~3.5 mm higher at contacts
    const dentate = g.cej + sign * (-1.0 + recession) - sign * 3.4 * g.pap;
    let margin = lerp(g.cej + sign * 1.4, dentate, g.present);
    const half = g.halfBL * lerp(0.85, 1 - 0.32 * g.pap, g.present);
    const sw = g.swelling;
    for (const [side, extra, depth] of PROFILE) {
      const lateral = side === 0 ? 0 : side * (half + extra * (1 + sw * 0.4) + (side < 0 ? 0.6 : 0));
      const y = margin + sign * depth + (side === 0 ? sign * 1.4 * g.present : 0);
      const v = smp.p.clone().addScaledVector(smp.n, lateral);
      v.y = y;
      pos.push(v.x, v.y, v.z);
      // colour: attached gingiva coral pink, mucosa redder and darker deeper down
      const deep = THREE.MathUtils.smoothstep(depth, 4, 12);
      const base = srgb(0.86, 0.5, 0.5).lerp(srgb(0.62, 0.22, 0.26), deep);
      base.lerp(srgb(0.85, 0.22, 0.25), g.redness * (1 - deep) * 0.8);
      colors.push(base.r, base.g, base.b);
    }
    rows.push(1);
  }
  const W = PROFILE.length;
  const idx = [];
  for (let i = 0; i < samples.length - 1; i++) {
    for (let j = 0; j < W - 1; j++) {
      const a = i * W + j, b = (i + 1) * W + j;
      if (upper) idx.push(a, a + 1, b, a + 1, b + 1, b);
      else idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  // innermost lingual row (first profile point) for joining the palate / floor of the mouth
  geo.userData.lingualRim = samples.map((_, i) => new THREE.Vector3(pos[i * W * 3], pos[i * W * 3 + 1], pos[i * W * 3 + 2]));
  return geo;
}

// ---------- palate ----------
// Fills the vault from the palatal gingiva rim to the midline.
export function buildPalate(rim) {
  const R = 16;
  const pos = [], col = [], idx = [];
  const n = rim.length;
  for (let i = 0; i < n; i++) {
    const p = rim[i];
    const mid = new THREE.Vector3(0, p.y, p.z);
    for (let k = 0; k <= R; k++) {
      const r = k / R;
      const v = p.clone().lerp(mid, r);
      const depthAlong = THREE.MathUtils.smoothstep(p.z, 22, -4); // shallower at the front
      const vault = (4 + 7 * depthAlong) * Math.sin((Math.PI / 2) * Math.min(1, r * 1.3));
      let y = p.y + vault;
      // transverse palatal rugae in the anterior third, incisive papilla, median raphe
      if (v.z > 2) y -= 0.55 * Math.max(0, Math.sin(v.z * 0.95 + Math.abs(v.x) * 0.3)) * (1 - r * 0.5) * THREE.MathUtils.smoothstep(v.z, 2, 10);
      y -= 0.9 * Math.exp(-((v.x * v.x) / 5 + ((v.z - 19) ** 2) / 6));
      y += 0.3 * Math.exp(-(v.x * v.x) / 0.7);
      v.y = y;
      pos.push(v.x, v.y, v.z);
      const c = srgb(0.86, 0.56, 0.57).lerp(srgb(0.68, 0.32, 0.38), r * 0.35 + THREE.MathUtils.smoothstep(-v.z, 4, 34) * 0.55);
      col.push(c.r, c.g, c.b);
    }
  }
  for (let i = 0; i < n - 1; i++) {
    for (let k = 0; k < R; k++) {
      const a = i * (R + 1) + k, b = (i + 1) * (R + 1) + k;
      idx.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// ---------- tongue ----------
export function buildTongue() {
  const g = new THREE.SphereGeometry(1, 96, 64);
  const p = g.attributes.position;
  const col = [];
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const front = Math.max(0, v.z);
    // body: wide at the back, narrowing to a rounded tip
    let x = v.x * 21 * (1 - 0.38 * front * front);
    let z = v.z * 30;
    let y = v.y * 8;
    if (v.y > 0) y = v.y * 7.2 * (1 - 0.35 * v.x * v.x); // convex dorsum
    else y = v.y * 9;
    // median sulcus and slight lateral rolls
    if (v.y > 0.1) y -= 1.0 * Math.exp(-(x * x) / 5) * THREE.MathUtils.smoothstep(z, 26, -14);
    // papillae micro-relief on the dorsum
    const n = Math.sin(x * 2.9 + z * 0.7) * Math.sin(z * 3.3 - x * 0.4) * 0.14 + Math.sin(x * 9.1 + z * 7.7) * 0.05;
    if (v.y > 0) y += n * THREE.MathUtils.smoothstep(v.y, 0, 0.5);
    p.setXYZ(i, x, y, z);
    const top = THREE.MathUtils.smoothstep(v.y, -0.3, 0.55);
    const speck = 0.5 + 0.5 * Math.sin(x * 13.7 + z * 11.3) * Math.sin(x * 7.1 - z * 9.7);
    const c = srgb(0.62, 0.26, 0.3).lerp(srgb(0.86, 0.52, 0.52), top);
    c.lerp(srgb(0.93, 0.68, 0.66), top * speck * 0.25);
    col.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

// ---------- lips and perioral skin ----------
// Upper and lower halves are separate so the view can "retract" the lip that blocks it.
export function buildLips(open, skinRGB = [0.8, 0.62, 0.52]) {
  const cx = 0, cz = 33;
  const cy = 1.0 - open * 0.5; // mid-way between the incisal edges
  const rx = 27, ry = 8 + open * 0.55;
  const skinLin = srgb(skinRGB[0], skinRGB[1], skinRGB[2]);
  const N = 60, M = 16, R = 16;

  function half(upperHalf) {
    const th0 = upperHalf ? 0 : Math.PI, th1 = upperHalf ? Math.PI : Math.PI * 2;
    const lp = [], lc = [], li = [];
    const sp = [], sc = [], si = [];
    for (let i = 0; i <= N; i++) {
      const th = th0 + (i / N) * (th1 - th0);
      const corner = Math.abs(Math.cos(th));
      const thick = (upperHalf ? 4.8 : 5.8) * (1 - 0.72 * corner ** 4) + 0.7;
      const c = new THREE.Vector3(cx + Math.cos(th) * rx, cy + Math.sin(th) * ry * (1 - 0.12 * corner), cz - corner ** 2 * 7);
      const out = new THREE.Vector3(Math.cos(th) * ry, Math.sin(th) * rx, 0).normalize();
      for (let j = 0; j <= M; j++) {
        const ph = (j / M) * Math.PI * 2;
        const v = c.clone().addScaledVector(out, Math.cos(ph) * thick * 0.9 + thick * 0.5).add(new THREE.Vector3(0, 0, Math.sin(ph) * thick * 0.75));
        lp.push(v.x, v.y, v.z);
        const red = srgb(0.74, 0.38, 0.4).lerp(srgb(0.56, 0.24, 0.27), Math.max(0, -Math.sin(ph)) * 0.6);
        lc.push(red.r, red.g, red.b);
      }
      for (let k = 0; k <= R; k++) {
        const rho = 1.15 + (k / R) * 1.9;
        const x = cx + Math.cos(th) * rx * rho;
        const y = cy + Math.sin(th) * ry * (1 - 0.12 * corner) * (1 + (rho - 1.15) * 2.4);
        const back = (rho - 1.15) ** 1.5 * 13 + corner ** 2 * 7;
        sp.push(x, y, cz + 3 - back);
        const shade = 1 - 0.3 * (k / R);
        sc.push(skinLin.r * shade, skinLin.g * shade, skinLin.b * shade);
      }
    }
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < M; j++) { const a = i * (M + 1) + j, b = (i + 1) * (M + 1) + j; li.push(a, b, a + 1, a + 1, b, b + 1); }
      for (let k = 0; k < R; k++) { const a = i * (R + 1) + k, b = (i + 1) * (R + 1) + k; si.push(a, a + 1, b, a + 1, b + 1, b); }
    }
    const mk = (p, c, idx) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
      g.setIndex(idx);
      g.computeVertexNormals();
      return g;
    };
    return { lips: mk(lp, lc, li), skin: mk(sp, sc, si) };
  }
  return { upper: half(true), lower: half(false), center: new THREE.Vector3(cx, cy, cz) };
}
