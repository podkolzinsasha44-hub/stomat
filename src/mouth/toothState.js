// Per-vertex clinical state of one tooth crown: caries, removed tissue, restorations,
// stains, calculus, etch/bond, and the resulting colours and surface displacement.
import * as THREE from 'three';

const srgb = (r, g, b) => new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace);

const C = {
  root: srgb(0.84, 0.74, 0.56),
  decayLight: srgb(0.55, 0.38, 0.2),
  decayDark: srgb(0.17, 0.11, 0.07),
  chalk: srgb(0.98, 0.97, 0.94),
  dentin: srgb(0.9, 0.78, 0.55),
  pulp: srgb(0.72, 0.1, 0.12),
  amalgam: srgb(0.42, 0.44, 0.47),
  temp: srgb(0.93, 0.88, 0.82),
  etch: srgb(0.12, 0.38, 0.86),
  stain: srgb(0.48, 0.34, 0.18),
  calculus: srgb(0.8, 0.73, 0.5),
  ceramic: srgb(0.95, 0.93, 0.88),
  metal: srgb(0.72, 0.72, 0.7),
  gutta: srgb(0.85, 0.45, 0.25),
};

export const FILL = { NONE: 0, COMPOSITE: 1, AMALGAM: 2, TEMP: 3 };

export class ToothState {
  constructor(tooth, shadeRGB, { incisalTranslucency = true } = {}) {
    this.tooth = tooth;
    this.spec = tooth.spec;
    const g = tooth.crown.clone();
    this.geometry = g;
    const n = g.attributes.position.count;
    this.n = n;
    this.base = Float32Array.from(g.attributes.position.array);
    this.baseNormal = Float32Array.from(g.attributes.normal.array);
    this.vt = tooth.vt;
    this.enamel = new Float32Array(n);
    this.pulpDepth = new Float32Array(n);
    this.decay = new Float32Array(n);     // lesion depth (mm) at the vertex
    this.hidden = new Uint8Array(n);      // lesion not visible on the surface (proximal)
    this.removed = new Float32Array(n);
    this.fill = new Float32Array(n);
    this.fillType = new Uint8Array(n);
    this.cured = new Float32Array(n);     // 0..1 polymerisation
    this.stain = new Float32Array(n);
    this.calculus = new Float32Array(n);
    this.etch = new Float32Array(n);
    this.bond = new Float32Array(n);
    this.gloss = new Float32Array(n);
    this.shade = new THREE.Color().setRGB(shadeRGB[0] / 255, shadeRGB[1] / 255, shadeRGB[2] / 255, THREE.SRGBColorSpace);
    this.fillShade = this.shade.clone();
    this.incisal = incisalTranslucency && (this.spec.type === 'incisor' || this.spec.type === 'canine');
    this.restoration = null; // 'crown-ceramic', 'crown-metal', null
    this.endo = null; // {canals: [{filledTo}]}
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('gloss', new THREE.BufferAttribute(this.gloss, 1));
    this._precompute();
    this.dirty = true;
    this.update();
  }

  _precompute() {
    const { tooth } = this;
    const Hc = tooth.Hc;
    const chamberTop = Hc * (this.spec.type === 'incisor' ? 0.55 : 0.4);
    const cy = (chamberTop - 1.5) / 2, ry = (chamberTop + 1.5) / 2;
    const rx = this.spec.cmd * 0.22, rz = this.spec.cbl * 0.2;
    const p = new THREE.Vector3();
    for (let i = 0; i < this.n; i++) {
      p.fromArray(this.base, i * 3);
      const t = this.vt[i];
      // enamel is thin at the CEJ and thickest over cusps / incisal edges
      this.enamel[i] = t < 0 ? 0 : t <= 1 ? THREE.MathUtils.lerp(0.25, this.spec.type === 'incisor' ? 1.0 : 1.6, t) : (this.spec.type === 'incisor' ? 1.0 : 2.2);
      // distance to the pulp chamber (ellipsoid), or to the canal for root vertices
      if (t < 0) {
        this.pulpDepth[i] = 1.2;
      } else {
        const dx = p.x / rx, dy = (p.y - cy) / ry, dz = p.z / rz;
        const k = Math.sqrt(dx * dx + dy * dy + dz * dz);
        this.pulpDepth[i] = Math.max(0.6, (k - 1) * Math.min(rx, ry, rz) * 1.05);
      }
    }
  }

  // nearest vertex to a local point
  nearest(local) {
    let best = 0, bd = Infinity;
    for (let i = 0; i < this.n; i++) {
      const dx = this.base[i * 3] - local.x, dy = this.base[i * 3 + 1] - local.y, dz = this.base[i * 3 + 2] - local.z;
      const d = dx * dx + dy * dy + dz * dz;
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }

  addLesion({ surface = 'O', depth = 2.5, radius = 2.2, hidden = false }) {
    const ref = this.tooth.ref[surface] || this.tooth.ref.O;
    const ci = this.nearest(ref);
    const c = new THREE.Vector3().fromArray(this.base, ci * 3);
    for (let i = 0; i < this.n; i++) {
      if (this.vt[i] < 0) continue;
      const dx = this.base[i * 3] - c.x, dy = this.base[i * 3 + 1] - c.y, dz = this.base[i * 3 + 2] - c.z;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz) / radius;
      if (d < 1) {
        const v = depth * Math.pow(1 - d * d, 1.4);
        if (v > this.decay[i]) { this.decay[i] = v; this.hidden[i] = hidden ? 1 : 0; }
      }
    }
    this.dirty = true;
    return { center: c, depth, radius, surface, hidden };
  }

  addOldFilling({ surface = 'O', radius = 2.4, type = FILL.AMALGAM, depth = 2 }) {
    const ci = this.nearest(this.tooth.ref[surface] || this.tooth.ref.O);
    const c = new THREE.Vector3().fromArray(this.base, ci * 3);
    for (let i = 0; i < this.n; i++) {
      if (this.vt[i] < 0) continue;
      const dx = this.base[i * 3] - c.x, dy = this.base[i * 3 + 1] - c.y, dz = this.base[i * 3 + 2] - c.z;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz) / radius;
      if (d < 1) {
        const v = depth * Math.min(1, (1 - d) * 3);
        this.removed[i] = Math.max(this.removed[i], v);
        this.fill[i] = this.removed[i];
        this.fillType[i] = type;
        this.cured[i] = 1;
      }
    }
    this.dirty = true;
  }

  setStain(amount) {
    for (let i = 0; i < this.n; i++) {
      const t = this.vt[i];
      if (t < 0 || t > 1) continue;
      // pigment collects at the cervical third and in the fissures
      this.stain[i] = amount * Math.max(1 - THREE.MathUtils.smoothstep(t, 0.05, 0.4), 0);
    }
    this.dirty = true;
  }

  setCalculus(amount, lingual = true) {
    for (let i = 0; i < this.n; i++) {
      const t = this.vt[i];
      if (t < -0.05 || t > 0.5) continue;
      const z = this.base[i * 3 + 2];
      const side = lingual ? Math.max(0, -z) / (this.spec.cbl / 2) : Math.max(0, z) / (this.spec.cbl / 2);
      const k = (1 - THREE.MathUtils.smoothstep(t, 0.05, 0.45)) * Math.min(1, side * 1.6);
      this.calculus[i] = Math.max(this.calculus[i], amount * k * (0.75 + 0.25 * Math.sin(i * 12.9898) ** 2));
    }
    this.dirty = true;
  }

  // ---- interactive operations (local coordinates, mm) ----
  _each(local, radius, fn) {
    const r2 = radius * radius;
    let touched = 0;
    for (let i = 0; i < this.n; i++) {
      const dx = this.base[i * 3] - local.x, dy = this.base[i * 3 + 1] - local.y, dz = this.base[i * 3 + 2] - local.z;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 < r2) { fn(i, 1 - Math.sqrt(d2) / radius); touched++; }
    }
    if (touched) this.dirty = true;
    return touched;
  }

  // removes tissue; returns {decayRemoved, healthyRemoved, pulpHit, dentin}
  carve(local, radius, amount, maxDepth = 6) {
    const res = { decay: 0, healthy: 0, pulp: false, enamel: 0, filling: 0 };
    this._each(local, radius, (i, w) => {
      if (this.vt[i] < -0.15) return; // do not grind the root below the gum
      const before = this.removed[i];
      const k = w * w * (3 - 2 * w);
      const add = Math.min(amount * k, maxDepth - before);
      if (add <= 0) return;
      // drilling through an old filling first removes the filling
      if (this.fill[i] > before - 1e-3 && this.fill[i] > 0) {
        const f = Math.min(add, this.fill[i]);
        this.fill[i] -= f;
        res.filling += f;
        if (this.fill[i] <= 1e-3) { this.fillType[i] = 0; this.cured[i] = 0; }
      }
      this.removed[i] = before + add;
      const d = this.decay[i];
      res.decay += Math.max(0, Math.min(this.removed[i], d) - Math.min(before, d));
      res.healthy += Math.max(0, this.removed[i] - Math.max(before, d));
      if (before < this.enamel[i]) res.enamel += Math.min(add, this.enamel[i] - before);
      if (this.removed[i] > this.pulpDepth[i]) res.pulp = true;
      this.etch[i] = 0; this.bond[i] = 0;
    });
    return res;
  }

  applyEtch(local, radius, amount = 1) { return this._each(local, radius, (i, w) => { if (this.removed[i] > 0.15 || w > 0.6) this.etch[i] = Math.min(1, this.etch[i] + amount * w); }); }
  rinse(local, radius, amount = 1) { return this._each(local, radius, (i, w) => { this.etch[i] = Math.max(0, this.etch[i] - amount * w * 2); }); }
  applyBond(local, radius, amount = 1) { return this._each(local, radius, (i, w) => { this.bond[i] = Math.min(1, this.bond[i] + amount * w); }); }

  // adds restorative material up to (and above) the original contour
  addMaterial(local, radius, amount, type = FILL.COMPOSITE) {
    let added = 0;
    this._each(local, radius, (i, w) => {
      const cap = this.removed[i] + 0.6; // allow some overfill
      const k = w * w * (3 - 2 * w);
      const before = this.fill[i];
      this.fill[i] = Math.min(cap, before + amount * k);
      if (this.fill[i] > before) {
        // the new increment is uncured until light-cured
        if (type === FILL.COMPOSITE) this.cured[i] = Math.min(this.cured[i], before > 0 ? this.cured[i] * (before / this.fill[i]) : 0);
        else this.cured[i] = 1;
        this.fillType[i] = type;
        added += this.fill[i] - before;
      }
    });
    return added;
  }

  cure(local, radius, amount) {
    return this._each(local, radius, (i, w) => {
      if (this.fill[i] > 0 && this.fillType[i] === FILL.COMPOSITE) this.cured[i] = Math.min(1, this.cured[i] + amount * (0.4 + 0.6 * w));
      if (this.bond[i] > 0) this.bond[i] = Math.max(0.35, this.bond[i] - amount * 0.2);
    });
  }

  // polishing removes excess material above the original contour and smooths stain/calculus
  polish(local, radius, amount) {
    return this._each(local, radius, (i, w) => {
      const excess = this.fill[i] - this.removed[i];
      if (excess > 0) this.fill[i] -= Math.min(excess, amount * w);
      this.stain[i] = Math.max(0, this.stain[i] - amount * w * 0.4);
    });
  }

  scale(local, radius, amount) {
    let removed = 0;
    this._each(local, radius, (i, w) => {
      const b = this.calculus[i];
      this.calculus[i] = Math.max(0, b - amount * w);
      removed += b - this.calculus[i];
    });
    return removed;
  }

  airPolish(local, radius, amount) {
    let removed = 0;
    this._each(local, radius, (i, w) => {
      const b = this.stain[i];
      this.stain[i] = Math.max(0, b - amount * w);
      removed += b - this.stain[i];
    });
    return removed;
  }

  // ---- evaluation ----
  stats() {
    let decayTotal = 0, decayLeft = 0, healthy = 0, pulp = false, excess = 0, deficit = 0, uncured = 0, filled = 0, cavity = 0, unetched = 0, unbonded = 0, calculus = 0, stain = 0;
    for (let i = 0; i < this.n; i++) {
      const d = this.decay[i], r = this.removed[i];
      decayTotal += d;
      decayLeft += Math.max(0, d - r);
      healthy += Math.max(0, r - Math.max(d, this.fillType[i] ? r : 0));
      if (r > this.pulpDepth[i]) pulp = true;
      if (r > 0.2) {
        cavity++;
        const gap = r - this.fill[i];
        if (gap > 0.15) deficit += gap;
        if (this.fill[i] > 0.05) {
          filled++;
          if (this.fillType[i] === FILL.COMPOSITE && this.cured[i] < 0.85) uncured++;
        }
      }
      if (this.fill[i] - r > 0.12) excess += this.fill[i] - r;
      calculus += this.calculus[i];
      stain += this.stain[i];
    }
    return { decayTotal, decayLeft, healthy, pulp, excess, deficit, uncured, filled, cavity, unetched, unbonded, calculus, stain };
  }

  // ---- geometry & colour refresh ----
  update() {
    if (!this.dirty) return;
    this.dirty = false;
    const pos = this.geometry.attributes.position.array;
    const col = this.geometry.attributes.color.array;
    const c = new THREE.Color();
    for (let i = 0; i < this.n; i++) {
      const off = this.fill[i] - this.removed[i] + this.calculus[i] * 0.7;
      pos[i * 3] = this.base[i * 3] + this.baseNormal[i * 3] * off;
      pos[i * 3 + 1] = this.base[i * 3 + 1] + this.baseNormal[i * 3 + 1] * off;
      pos[i * 3 + 2] = this.base[i * 3 + 2] + this.baseNormal[i * 3 + 2] * off;
      const t = this.vt[i];
      let gloss = 0.25;
      if (t < 0) {
        c.copy(C.root);
      } else {
        c.copy(this.shade);
        // cervical third warmer and more saturated, incisal edge translucent grey-blue
        const cerv = 1 - THREE.MathUtils.smoothstep(t, 0, 0.45);
        c.r *= 1 - 0.02 * cerv; c.g *= 1 - 0.05 * cerv; c.b *= 1 - 0.12 * cerv;
        if (this.incisal && t > 0.82) c.lerp(srgb(0.8, 0.82, 0.84), Math.min(0.35, (t - 0.82) * 1.6));
        if (this.restoration === 'crown-ceramic') c.copy(C.ceramic);
        if (this.restoration === 'crown-metal') c.copy(C.metal);
        const r = this.removed[i];
        const left = Math.max(0, this.decay[i] - r);
        if (r > this.enamel[i] * 0.85 && left <= 0.01) c.copy(C.dentin);
        if (left > 0.01) {
          const exposed = !this.hidden[i] || r > 0.3;
          const k = Math.min(1, left / 1.6);
          if (exposed) {
            c.lerp(C.decayLight, Math.min(1, 0.35 + k * 0.9));
            c.lerp(C.decayDark, Math.max(0, k - 0.45) * 1.4);
          } else {
            c.lerp(srgb(0.62, 0.6, 0.55), Math.min(0.3, k * 0.35));
          }
        } else if (this.decay[i] > 0 && r < 0.05 && !this.hidden[i]) {
          c.lerp(C.chalk, 0.4); // white-spot halo
        }
        if (r > this.pulpDepth[i]) c.copy(C.pulp);
        if (this.stain[i] > 0) c.lerp(C.stain, Math.min(0.85, this.stain[i]));
      }
      if (this.fill[i] > 0.04 && this.fillType[i]) {
        const ft = this.fillType[i];
        if (ft === 1) {
          c.copy(this.fillShade);
          const unc = 1 - this.cured[i];
          c.lerp(srgb(0.97, 0.95, 0.9), unc * 0.35);
          gloss = 0.4 + unc * 0.5;
        } else if (ft === 2) { c.copy(C.amalgam); gloss = 0.7; }
        else { c.copy(C.temp); gloss = 0.1; }
      }
      if (this.calculus[i] > 0.05) c.lerp(C.calculus, Math.min(0.9, this.calculus[i] * 2.2));
      if (this.etch[i] > 0.02) { c.lerp(C.etch, Math.min(0.85, this.etch[i])); gloss = 0.6; }
      if (this.bond[i] > 0.02) gloss = Math.max(gloss, 0.5 + this.bond[i] * 0.45);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
      this.gloss[i] = gloss;
    }
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;
    this.geometry.attributes.gloss.needsUpdate = true;
    this.geometry.computeVertexNormals();
    this.geometry.computeBoundingSphere();
    this.geometry.computeBoundingBox();
  }
}
