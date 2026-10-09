// The view from the clinic window: the Neva, a granite embankment and classical facades
// with the gilded spire of the Peter and Paul Cathedral, painted procedurally on a canvas.
import * as THREE from 'three';
import { fbmField, rng } from './textures.js';

const FACADES = ['#E2C277', '#D9B36A', '#B9CDB0', '#E8BBA8', '#A9C2D3', '#EFE3C8', '#C9A78E', '#E6D19A', '#B7C9C3', '#F0D9B5'];

function drawSky(ctx, W, H, horizon) {
  const g = ctx.createLinearGradient(0, 0, 0, horizon);
  g.addColorStop(0, '#7f9bb5');
  g.addColorStop(0.55, '#b7c8d6');
  g.addColorStop(1, '#e4e8e6');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, horizon + 4);
  // soft Baltic clouds
  const S = 256;
  const n = fbmField(S, { seed: 91, base: 3, octaves: 5, gain: 0.55 });
  const c = document.createElement('canvas');
  c.width = S; c.height = S;
  const cx = c.getContext('2d', { willReadFrequently: true });
  const img = cx.createImageData(S, S);
  for (let i = 0; i < S * S; i++) {
    const a = Math.max(0, (n[i] - 0.5) * 3.2);
    img.data[i * 4] = 248; img.data[i * 4 + 1] = 249; img.data[i * 4 + 2] = 250;
    img.data[i * 4 + 3] = Math.min(220, a * 255);
  }
  cx.putImageData(img, 0, 0);
  ctx.globalAlpha = 0.85;
  ctx.drawImage(c, 0, 0, W, horizon * 0.95);
  ctx.globalAlpha = 1;
}

function drawBuilding(ctx, r, x, w, baseY, floors, color) {
  const fh = 26 + r() * 4;
  const h = floors * fh + 18;
  const top = baseY - h;
  ctx.fillStyle = color;
  ctx.fillRect(x, top, w, h);
  // rusticated ground floor
  ctx.fillStyle = 'rgba(0,0,0,0.08)';
  ctx.fillRect(x, baseY - fh - 6, w, fh + 6);
  // cornice + roof
  ctx.fillStyle = '#f4f1ea';
  ctx.fillRect(x - 2, top - 3, w + 4, 6);
  ctx.fillStyle = '#5f6b6a';
  ctx.beginPath();
  ctx.moveTo(x - 2, top - 3);
  ctx.lineTo(x + 8, top - 14 - r() * 6);
  ctx.lineTo(x + w - 8, top - 14 - r() * 6);
  ctx.lineTo(x + w + 2, top - 3);
  ctx.fill();
  // windows with white trims
  const bays = Math.max(3, Math.round(w / 22));
  const bw = w / bays;
  for (let f = 0; f < floors; f++) {
    const wy = top + 12 + f * fh;
    for (let b = 0; b < bays; b++) {
      const wx = x + b * bw + bw * 0.28;
      const ww = bw * 0.44, wh = fh * 0.58;
      ctx.fillStyle = '#f7f4ee';
      ctx.fillRect(wx - 2, wy - 2, ww + 4, wh + 4);
      ctx.fillStyle = r() < 0.15 ? '#c9c2a8' : '#465663';
      ctx.fillRect(wx, wy, ww, wh);
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(wx, wy, ww, wh * 0.35);
      if (f === 1 && r() < 0.5) { // pediment over piano nobile windows
        ctx.fillStyle = '#f7f4ee';
        ctx.beginPath();
        ctx.moveTo(wx - 3, wy - 3);
        ctx.lineTo(wx + ww / 2, wy - 9);
        ctx.lineTo(wx + ww + 3, wy - 3);
        ctx.fill();
      }
    }
  }
  // pilasters on grander facades
  if (w > 150 && r() < 0.6) {
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    for (let b = 1; b < bays; b += 2) ctx.fillRect(x + b * bw - 3, top + fh + 4, 6, h - fh * 2);
  }
  return top;
}

function drawSpire(ctx, x, baseY) {
  // bell tower of the Peter and Paul Cathedral
  ctx.fillStyle = '#E8D9B0';
  ctx.fillRect(x - 26, baseY - 140, 52, 140);
  ctx.fillRect(x - 20, baseY - 190, 40, 50);
  ctx.fillStyle = '#f7f2e4';
  for (let i = 0; i < 3; i++) ctx.fillRect(x - 14 + i * 12, baseY - 180, 6, 28);
  ctx.fillStyle = '#58705f';
  ctx.beginPath();
  ctx.moveTo(x - 22, baseY - 190); ctx.lineTo(x, baseY - 225); ctx.lineTo(x + 22, baseY - 190); ctx.fill();
  const g = ctx.createLinearGradient(x - 8, 0, x + 8, 0);
  g.addColorStop(0, '#9c7424'); g.addColorStop(0.45, '#ffe08a'); g.addColorStop(1, '#a87d2b');
  ctx.fillStyle = g;
  ctx.fillRect(x - 9, baseY - 262, 18, 40);
  ctx.beginPath();
  ctx.moveTo(x - 9, baseY - 262); ctx.lineTo(x, baseY - 470); ctx.lineTo(x + 9, baseY - 262); ctx.fill();
  ctx.fillStyle = '#ffe9a6';
  ctx.fillRect(x - 1, baseY - 492, 2, 24);
  ctx.fillRect(x - 6, baseY - 486, 12, 2);
  // fortress walls
  ctx.fillStyle = '#b07d68';
  ctx.fillRect(x - 260, baseY - 46, 520, 46);
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  for (let i = -250; i < 260; i += 34) ctx.fillRect(x + i, baseY - 46, 3, 46);
}

function drawDome(ctx, x, baseY) {
  // a distant gilded dome
  ctx.fillStyle = '#d8d1c0';
  ctx.fillRect(x - 40, baseY - 90, 80, 90);
  ctx.fillStyle = '#ebe5d6';
  for (let i = -34; i <= 34; i += 10) ctx.fillRect(x + i - 2, baseY - 120, 4, 30);
  const g = ctx.createRadialGradient(x - 10, baseY - 160, 4, x, baseY - 140, 46);
  g.addColorStop(0, '#fff1b8'); g.addColorStop(0.5, '#d7a843'); g.addColorStop(1, '#8a6420');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(x, baseY - 122, 38, 44, 0, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = '#d7a843';
  ctx.fillRect(x - 3, baseY - 186, 6, 22);
}

export function paintNevaView() {
  const W = 2048, H = 1024;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  const r = rng(2024);
  const horizon = 520;
  drawSky(ctx, W, H, horizon);

  // far bank skyline
  ctx.save();
  ctx.filter = 'blur(0.6px)';
  drawDome(ctx, 1640, horizon - 30);
  drawSpire(ctx, 520, horizon);
  let x = -20;
  while (x < W) {
    const w = 90 + r() * 170;
    if (!(x > 250 && x < 790)) drawBuilding(ctx, r, x, w, horizon, 3 + Math.floor(r() * 3), FACADES[Math.floor(r() * FACADES.length)]);
    x += w + 2;
  }
  // trees along the far embankment
  for (let i = 0; i < 70; i++) {
    const tx = r() * W, ty = horizon - 6 - r() * 8;
    ctx.fillStyle = `rgba(${70 + r() * 30},${100 + r() * 30},${70 + r() * 20},0.9)`;
    ctx.beginPath();
    ctx.ellipse(tx, ty, 14 + r() * 16, 10 + r() * 10, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // far granite embankment
  ctx.fillStyle = '#8b7d78';
  ctx.fillRect(0, horizon, W, 14);
  ctx.fillStyle = '#6f6360';
  ctx.fillRect(0, horizon + 12, W, 4);

  // the Neva with reflections
  const water = ctx.createLinearGradient(0, horizon + 16, 0, H);
  water.addColorStop(0, '#6d8396');
  water.addColorStop(0.5, '#4f6476');
  water.addColorStop(1, '#3c4e5d');
  ctx.fillStyle = water;
  ctx.fillRect(0, horizon + 16, W, H - horizon - 16);
  ctx.save();
  ctx.globalAlpha = 0.28;
  ctx.translate(0, (horizon + 16) * 2);
  ctx.scale(1, -1);
  ctx.filter = 'blur(3px)';
  ctx.drawImage(c, 0, 0, W, horizon, 0, 0, W, horizon);
  ctx.restore();
  for (let i = 0; i < 900; i++) {
    const wy = horizon + 18 + Math.pow(r(), 1.6) * (H - horizon - 20);
    const len = 8 + r() * 60 * ((wy - horizon) / (H - horizon) + 0.2);
    ctx.fillStyle = r() < 0.5 ? 'rgba(220,230,238,0.18)' : 'rgba(20,30,40,0.18)';
    ctx.fillRect(r() * W, wy, len, 1 + (wy - horizon) / 220);
  }

  // near-side embankment: granite parapet with cast-iron railing
  const nearTop = H - 150;
  ctx.fillStyle = '#7d6f6a';
  ctx.fillRect(0, nearTop + 70, W, 80);
  ctx.fillStyle = '#968782';
  ctx.fillRect(0, nearTop + 64, W, 12);
  ctx.strokeStyle = '#1f2326';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, nearTop + 2); ctx.lineTo(W, nearTop + 2);
  ctx.moveTo(0, nearTop + 60); ctx.lineTo(W, nearTop + 60);
  for (let px = 0; px < W; px += 18) { ctx.moveTo(px, nearTop); ctx.lineTo(px, nearTop + 62); }
  ctx.stroke();
  ctx.lineWidth = 2;
  for (let px = 9; px < W; px += 36) {
    ctx.beginPath();
    ctx.arc(px + 9, nearTop + 31, 11, 0, Math.PI * 2);
    ctx.stroke();
  }
  for (let px = 0; px < W; px += 216) {
    ctx.fillStyle = '#6a5d58';
    ctx.fillRect(px - 10, nearTop - 8, 22, 80);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

export function buildCityView(width = 26, height = 13) {
  const mat = new THREE.MeshBasicMaterial({ map: paintNevaView(), toneMapped: true });
  mat.color.setScalar(1.35);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), mat);
  mesh.name = 'cityView';
  return mesh;
}
