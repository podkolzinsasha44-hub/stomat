// Procedural PBR textures painted on canvases: no image files needed for the interior.
import * as THREE from 'three';

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

// Tileable value noise on an integer lattice of period p.
function makeNoise(seed, period) {
  const r = rng(seed);
  const g = new Float32Array(period * period);
  for (let i = 0; i < g.length; i++) g[i] = r();
  const at = (x, y) => g[((y % period + period) % period) * period + ((x % period + period) % period)];
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}

// Fractal noise sampled in [0,1)^2 texture space, tileable.
export function fbmField(size, { seed = 1, base = 4, octaves = 5, gain = 0.5 } = {}) {
  const out = new Float32Array(size * size);
  const layers = [];
  for (let o = 0; o < octaves; o++) layers.push({ n: makeNoise(seed + o * 101, base << o), f: base << o, a: Math.pow(gain, o) });
  let norm = 0;
  for (const l of layers) norm += l.a;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let v = 0;
      for (const l of layers) v += l.n((x / size) * l.f, (y / size) * l.f) * l.a;
      out[y * size + x] = v / norm;
    }
  }
  return out;
}

function canvas(size, h = size) {
  const c = document.createElement('canvas');
  c.width = size; c.height = h;
  return c;
}

function toTexture(c, { srgb = true, repeat = [1, 1], aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = aniso;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.needsUpdate = true;
  return t;
}

// Height field -> tangent-space normal map canvas.
function normalFromHeight(h, size, strength = 2) {
  const c = canvas(size);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  const img = ctx.createImageData(size, size);
  const H = (x, y) => h[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (H(x + 1, y) - H(x - 1, y)) * strength;
      const dy = (H(x, y + 1) - H(x, y - 1)) * strength;
      const len = Math.hypot(dx, dy, 1);
      const i = (y * size + x) * 4;
      img.data[i] = ((-dx / len) * 0.5 + 0.5) * 255;
      img.data[i + 1] = ((dy / len) * 0.5 + 0.5) * 255;
      img.data[i + 2] = ((1 / len) * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function grayCanvas(values, size, map) {
  const c = canvas(size);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const v = Math.max(0, Math.min(255, map(values[i], i) * 255));
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function colorCanvas(size, fn) {
  const c = canvas(size);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const [r, g, b] = fn(x, y, y * size + x);
      const i = (y * size + x) * 4;
      img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

const cache = new Map();
function cached(key, make) {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key);
}

// Large-format porcelain floor tiles (60x60 cm). One texture covers 2x2 tiles.
export function floorTiles() {
  return cached('floor', () => {
    const S = 1024;
    const n = fbmField(S, { seed: 7, base: 8, octaves: 6, gain: 0.55 });
    const speck = fbmField(S, { seed: 19, base: 64, octaves: 2, gain: 0.5 });
    const tile = S / 2, grout = 3;
    const isGrout = (x, y) => (x % tile) < grout || (y % tile) < grout;
    const tileShade = (x, y) => [0.0, 0.025, -0.02, 0.012][Math.floor(x / tile) + 2 * Math.floor(y / tile)];
    const map = colorCanvas(S, (x, y, i) => {
      if (isGrout(x, y)) return [150, 152, 150];
      const v = 0.86 + (n[i] - 0.5) * 0.08 + tileShade(x, y) + (speck[i] > 0.78 ? -0.06 : 0);
      return [v * 222, v * 224, v * 221];
    });
    const rough = grayCanvas(n, S, (v, i) => (isGrout(i % S, (i / S) | 0) ? 0.9 : 0.32 + (v - 0.5) * 0.25));
    const h = new Float32Array(S * S);
    for (let i = 0; i < h.length; i++) h[i] = isGrout(i % S, (i / S) | 0) ? -1.2 : n[i] * 0.15;
    const normal = normalFromHeight(h, S, 1.5);
    return { map: toTexture(map), roughnessMap: toTexture(rough, { srgb: false }), normalMap: toTexture(normal, { srgb: false }) };
  });
}

// Painted plaster wall: very soft mottling and a fine roller texture.
export function wallPaint(tint = [236, 238, 236]) {
  return cached('wall' + tint.join(), () => {
    const S = 512;
    const n = fbmField(S, { seed: 3, base: 4, octaves: 6, gain: 0.6 });
    const fine = fbmField(S, { seed: 11, base: 64, octaves: 3, gain: 0.5 });
    const map = colorCanvas(S, (x, y, i) => {
      const v = 1 + (n[i] - 0.5) * 0.04 + (fine[i] - 0.5) * 0.03;
      return [tint[0] * v, tint[1] * v, tint[2] * v];
    });
    const normal = normalFromHeight(fine, S, 0.8);
    return { map: toTexture(map), normalMap: toTexture(normal, { srgb: false }) };
  });
}

// Acoustic ceiling tiles 60x60 cm.
export function ceilingTiles() {
  return cached('ceiling', () => {
    const S = 512;
    const n = fbmField(S, { seed: 23, base: 64, octaves: 3, gain: 0.6 });
    const map = colorCanvas(S, (x, y, i) => {
      const edge = (x % S) < 4 || (y % S) < 4;
      if (edge) return [205, 207, 207];
      const v = 0.95 + (n[i] - 0.5) * 0.12;
      return [v * 246, v * 246, v * 244];
    });
    const h = new Float32Array(S * S);
    for (let i = 0; i < h.length; i++) h[i] = n[i] * 0.6 - (((i % S) < 4 || ((i / S) | 0) < 4) ? 1 : 0);
    return { map: toTexture(map), normalMap: toTexture(normalFromHeight(h, S, 2), { srgb: false }) };
  });
}

// Seamless upholstery leather with grain.
export function leather(rgb) {
  return cached('leather' + rgb.join(), () => {
    const S = 512;
    const cells = fbmField(S, { seed: 31, base: 48, octaves: 3, gain: 0.55 });
    const big = fbmField(S, { seed: 5, base: 4, octaves: 3, gain: 0.5 });
    const map = colorCanvas(S, (x, y, i) => {
      const v = 0.92 + (cells[i] - 0.5) * 0.12 + (big[i] - 0.5) * 0.08;
      return [rgb[0] * v, rgb[1] * v, rgb[2] * v];
    });
    const h = new Float32Array(S * S);
    for (let i = 0; i < h.length; i++) h[i] = Math.pow(cells[i], 1.5);
    const rough = grayCanvas(cells, S, (v) => 0.45 + v * 0.25);
    return { map: toTexture(map), normalMap: toTexture(normalFromHeight(h, S, 3), { srgb: false }), roughnessMap: toTexture(rough, { srgb: false }) };
  });
}

// Brushed stainless steel: anisotropic streaks along X.
export function brushedSteel() {
  return cached('steel', () => {
    const S = 256;
    const r = rng(77);
    const rows = new Float32Array(S);
    for (let y = 0; y < S; y++) rows[y] = r();
    const n = fbmField(S, { seed: 9, base: 8, octaves: 3 });
    const rough = grayCanvas(n, S, (v, i) => 0.22 + rows[(i / S) | 0] * 0.12 + (v - 0.5) * 0.1);
    return { roughnessMap: toTexture(rough, { srgb: false }) };
  });
}

// Light oak veneer for the doctor's desk and door.
export function oak() {
  return cached('oak', () => {
    const S = 512;
    const n = fbmField(S, { seed: 41, base: 4, octaves: 5, gain: 0.55 });
    const map = colorCanvas(S, (x, y, i) => {
      const ring = Math.sin((x / S) * 80 + n[i] * 14) * 0.5 + 0.5;
      const v = 0.82 + ring * 0.12 + (n[i] - 0.5) * 0.1;
      return [196 * v, 160 * v, 118 * v];
    });
    return { map: toTexture(map) };
  });
}

// White quartz countertop with fine speckle.
export function quartz() {
  return cached('quartz', () => {
    const S = 512;
    const n = fbmField(S, { seed: 51, base: 96, octaves: 2, gain: 0.5 });
    const map = colorCanvas(S, (x, y, i) => {
      const s = n[i] > 0.72 ? 0.78 : n[i] < 0.2 ? 1.0 : 0.95;
      return [236 * s, 236 * s, 232 * s];
    });
    return { map: toTexture(map) };
  });
}

// Cast a soft blob texture used for contact shadows under furniture.
export function blobShadow() {
  return cached('blob', () => {
    const S = 128;
    const c = canvas(S);
    const ctx = c.getContext('2d', { willReadFrequently: true });
    const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    g.addColorStop(0, 'rgba(0,0,0,0.55)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  });
}

export { canvas, toTexture, rng, normalFromHeight, colorCanvas };
