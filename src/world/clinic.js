// The treatment room and the corridor with the waiting area.
// Units are meters, +Y up. Room: x [-2.5, 2.5], z [-2.1, 2.1]; corridor east of the door.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { floorTiles, wallPaint, ceilingTiles, quartz, oak, brushedSteel, blobShadow, canvas } from './textures.js';
import { buildCityView } from './cityView.js';
import { createDentalChair } from './dentalChair.js';

export const ROOM = { x0: -2.5, x1: 2.5, z0: -2.1, z1: 2.1, h: 2.9 };
export const CORRIDOR = { x0: 2.5, x1: 8.2, z0: 0.0, z1: 2.1 };
export const DOOR = { x: 2.5, z0: 0.72, z1: 1.68, h: 2.1 };
const WALL_T = 0.12;

export function buildClinic(renderer, { brand = 'Клиника на Неве', upholstery } = {}) {
  RectAreaLightUniformsLib.init();
  const group = new THREE.Group();
  group.name = 'clinic';
  const colliders = []; // {x0,z0,x1,z1}
  const interactables = [];
  const updaters = [];

  const floorT = floorTiles();
  const wallT = wallPaint([238, 240, 238]);
  const accentT = wallPaint([186, 214, 210]);
  const ceilT = ceilingTiles();
  const M = {
    floor: new THREE.MeshPhysicalMaterial({ map: floorT.map, roughnessMap: floorT.roughnessMap, normalMap: floorT.normalMap, roughness: 1, clearcoat: 0.25, clearcoatRoughness: 0.3 }),
    wall: new THREE.MeshStandardMaterial({ map: wallT.map, normalMap: wallT.normalMap, normalScale: new THREE.Vector2(0.3, 0.3), roughness: 0.92 }),
    accent: new THREE.MeshStandardMaterial({ map: accentT.map, normalMap: accentT.normalMap, normalScale: new THREE.Vector2(0.3, 0.3), roughness: 0.92 }),
    ceiling: new THREE.MeshStandardMaterial({ map: ceilT.map, normalMap: ceilT.normalMap, roughness: 0.95 }),
    white: new THREE.MeshPhysicalMaterial({ color: 0xf4f5f4, roughness: 0.3, clearcoat: 0.4, clearcoatRoughness: 0.25 }),
    frame: new THREE.MeshStandardMaterial({ color: 0xf6f6f4, roughness: 0.45 }),
    quartz: new THREE.MeshPhysicalMaterial({ map: quartz().map, roughness: 0.18, clearcoat: 0.6 }),
    oak: new THREE.MeshStandardMaterial({ map: oak().map, roughness: 0.55 }),
    steel: new THREE.MeshStandardMaterial({ color: 0xcfd4d6, metalness: 1, roughness: 0.28, roughnessMap: brushedSteel().roughnessMap }),
    dark: new THREE.MeshStandardMaterial({ color: 0x24282c, roughness: 0.5 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0xeef6f8, roughness: 0.02, metalness: 0, transparent: true, opacity: 0.12, depthWrite: false, envMapIntensity: 0.8 }),
    teal: new THREE.MeshStandardMaterial({ color: 0x2c7075, roughness: 0.55 }),
    skirting: new THREE.MeshStandardMaterial({ color: 0xd8dcdb, roughness: 0.5 }),
  };
  const mesh = (g, m, { cast = true, receive = true } = {}) => { const o = new THREE.Mesh(g, m); o.castShadow = cast; o.receiveShadow = receive; return o; };
  const box = (w, h, d, m, x, y, z, opts) => { const o = mesh(new THREE.BoxGeometry(w, h, d), m, opts); o.position.set(x, y, z); group.add(o); return o; };
  const rbox = (w, h, d, r, m, x, y, z, opts) => { const o = mesh(new RoundedBoxGeometry(w, h, d, 3, r), m, opts); o.position.set(x, y, z); group.add(o); return o; };
  const collide = (x0, z0, x1, z1) => colliders.push({ x0: Math.min(x0, x1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), z1: Math.max(z0, z1) });

  // --- floor & ceiling
  const floorGeo = new THREE.PlaneGeometry(ROOM.x1 - ROOM.x0 + CORRIDOR.x1 - CORRIDOR.x0, ROOM.z1 - ROOM.z0);
  const uv = floorGeo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (ROOM.x1 - ROOM.x0 + CORRIDOR.x1 - CORRIDOR.x0) / 1.2, uv.getY(i) * (ROOM.z1 - ROOM.z0) / 1.2);
  const floor = mesh(floorGeo, M.floor, { cast: false });
  floor.rotation.x = -Math.PI / 2;
  floor.position.set((ROOM.x0 + CORRIDOR.x1) / 2, 0, 0);
  group.add(floor);
  const ceilGeo = floorGeo.clone();
  const ceil = mesh(ceilGeo, M.ceiling, { cast: false });
  ceil.material.map.repeat.set(1, 1);
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set((ROOM.x0 + CORRIDOR.x1) / 2, ROOM.h, 0);
  const cuv = ceilGeo.attributes.uv;
  for (let i = 0; i < cuv.count; i++) cuv.setXY(i, cuv.getX(i) / 0.6 * 1.2, cuv.getY(i) / 0.6 * 1.2);
  group.add(ceil);

  // --- walls (boxes around openings)
  function wallX(z, x0, x1, holes = [], mat = M.wall) {
    // wall running along X at fixed z; holes: {a,b,y0,y1}
    let cur = x0;
    const segs = [];
    for (const h of [...holes].sort((p, q) => p.a - q.a)) {
      if (h.a > cur) segs.push([cur, h.a, 0, ROOM.h]);
      if (h.y0 > 0) segs.push([h.a, h.b, 0, h.y0]);
      segs.push([h.a, h.b, h.y1, ROOM.h]);
      cur = h.b;
    }
    if (cur < x1) segs.push([cur, x1, 0, ROOM.h]);
    for (const [a, b, y0, y1] of segs) box(b - a, y1 - y0, WALL_T, mat, (a + b) / 2, (y0 + y1) / 2, z);
    let c0 = x0;
    for (const h of [...holes].sort((p, q) => p.a - q.a)) {
      if (h.y0 > 0.3) continue; // windows still block movement
      collide(c0, z - WALL_T / 2, h.a, z + WALL_T / 2);
      c0 = h.b;
    }
    collide(c0, z - WALL_T / 2, x1, z + WALL_T / 2);
  }
  function wallZ(x, z0, z1, holes = [], mat = M.wall) {
    let cur = z0;
    const segs = [];
    for (const h of [...holes].sort((p, q) => p.a - q.a)) {
      if (h.a > cur) segs.push([cur, h.a, 0, ROOM.h]);
      if (h.y0 > 0) segs.push([h.a, h.b, 0, h.y0]);
      segs.push([h.a, h.b, h.y1, ROOM.h]);
      cur = h.b;
    }
    if (cur < z1) segs.push([cur, z1, 0, ROOM.h]);
    for (const [a, b, y0, y1] of segs) box(WALL_T, y1 - y0, b - a, mat, x, (y0 + y1) / 2, (a + b) / 2);
    let c0 = z0;
    for (const h of [...holes].sort((p, q) => p.a - q.a)) {
      if (h.y0 > 0.3) continue;
      collide(x - WALL_T / 2, c0, x + WALL_T / 2, h.a);
      c0 = h.b;
    }
    collide(x - WALL_T / 2, c0, x + WALL_T / 2, z1);
  }
  const WIN = { a: -0.9, b: 1.5, y0: 0.86, y1: 2.46 };
  wallX(ROOM.z0, ROOM.x0 - WALL_T / 2, ROOM.x1 + WALL_T / 2, [WIN]);
  wallX(ROOM.z1, ROOM.x0 - WALL_T / 2, ROOM.x1 + WALL_T / 2);
  wallZ(ROOM.x0, ROOM.z0, ROOM.z1, [], M.accent);
  wallZ(ROOM.x1, ROOM.z0, ROOM.z1, [{ a: DOOR.z0, b: DOOR.z1, y0: 0, y1: DOOR.h }]);
  // corridor
  wallX(CORRIDOR.z0, CORRIDOR.x0, CORRIDOR.x1, [{ a: 5.2, b: 6.6, y0: 0.9, y1: 2.3 }]);
  wallX(CORRIDOR.z1, CORRIDOR.x0, CORRIDOR.x1);
  wallZ(CORRIDOR.x1, CORRIDOR.z0, CORRIDOR.z1, [{ a: 0.55, b: 1.55, y0: 0, y1: 2.1 }], M.accent);

  // skirting boards
  for (const [w, d, x, z] of [[5, 0.02, 0, ROOM.z0 + 0.07], [5, 0.02, 0, ROOM.z1 - 0.07], [0.02, 4.2, ROOM.x0 + 0.07, 0]]) {
    box(w, 0.08, d, M.skirting, x, 0.04, z, { cast: false });
  }

  // --- window with frame, mullion, sill and radiator
  const winW = WIN.b - WIN.a, winH = WIN.y1 - WIN.y0, winX = (WIN.a + WIN.b) / 2, winY = (WIN.y0 + WIN.y1) / 2;
  const fz = ROOM.z0;
  const ft = 0.07;
  box(winW, ft, 0.16, M.frame, winX, WIN.y0 + ft / 2, fz);
  box(winW, ft, 0.16, M.frame, winX, WIN.y1 - ft / 2, fz);
  box(ft, winH, 0.16, M.frame, WIN.a + ft / 2, winY, fz);
  box(ft, winH, 0.16, M.frame, WIN.b - ft / 2, winY, fz);
  box(0.05, winH, 0.12, M.frame, winX, winY, fz);
  box(winW, 0.045, 0.1, M.frame, winX, WIN.y1 - 0.42, fz);
  const glass = mesh(new THREE.PlaneGeometry(winW, winH), M.glass, { cast: false, receive: false });
  glass.position.set(winX, winY, fz - 0.01);
  group.add(glass);
  box(winW + 0.16, 0.035, 0.28, M.quartz, winX, WIN.y0 - 0.015, fz + 0.14);
  const rad = rbox(1.6, 0.5, 0.09, 0.02, M.white, winX, 0.42, fz + 0.12);
  for (let i = 0; i < 26; i++) box(0.012, 0.46, 0.02, M.frame, winX - 0.78 + i * 0.0625, 0.42, fz + 0.17, { cast: false });
  collide(winX - 0.8, fz, winX + 0.8, fz + 0.2);
  rad.name = 'radiator';

  const city = buildCityView(44, 16);
  city.position.set(3.5, 1.6, ROOM.z0 - 14);
  group.add(city);

  // --- door (swings into the corridor)
  const doorPivot = new THREE.Group();
  doorPivot.position.set(DOOR.x + 0.03, 0, DOOR.z0 + 0.02);
  group.add(doorPivot);
  const leaf = mesh(new THREE.BoxGeometry(0.045, DOOR.h - 0.02, DOOR.z1 - DOOR.z0 - 0.04), M.oak);
  leaf.position.set(0.0, (DOOR.h - 0.02) / 2, (DOOR.z1 - DOOR.z0 - 0.04) / 2);
  doorPivot.add(leaf);
  const handle = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.14, 8), M.steel);
  handle.rotation.x = Math.PI / 2;
  handle.position.set(-0.05, 1.0, DOOR.z1 - DOOR.z0 - 0.14);
  doorPivot.add(handle);
  const h2 = handle.clone(); h2.position.x = 0.05; doorPivot.add(h2);
  for (const [w, h, d, x, y, z] of [[0.16, 0.06, DOOR.z1 - DOOR.z0 + 0.12, DOOR.x, DOOR.h + 0.03, (DOOR.z0 + DOOR.z1) / 2], [0.16, DOOR.h, 0.06, DOOR.x, DOOR.h / 2, DOOR.z0 - 0.03], [0.16, DOOR.h, 0.06, DOOR.x, DOOR.h / 2, DOOR.z1 + 0.03]]) box(w, h, d, M.frame, x, y, z);
  const door = { pivot: doorPivot, open: 0, target: 0 };
  updaters.push((dt) => {
    door.open += (door.target - door.open) * Math.min(1, dt * 3.5);
    doorPivot.rotation.y = door.open * 1.45;
  });

  // --- cabinet run along the south wall with sink
  const cabZ = ROOM.z1 - 0.3;
  const cabX0 = -2.42, cabX1 = 0.55;
  rbox(cabX1 - cabX0, 0.82, 0.56, 0.01, M.white, (cabX0 + cabX1) / 2, 0.43, cabZ);
  box(cabX1 - cabX0, 0.08, 0.5, M.skirting, (cabX0 + cabX1) / 2, 0.04, cabZ + 0.04, { cast: false });
  const top = box(cabX1 - cabX0 + 0.02, 0.03, 0.6, M.quartz, (cabX0 + cabX1) / 2, 0.855, cabZ - 0.01);
  top.name = 'countertop';
  for (let x = cabX0 + 0.3; x < cabX1; x += 0.6) {
    box(0.004, 0.76, 0.01, M.dark, x, 0.45, cabZ - 0.282, { cast: false });
    box(0.18, 0.012, 0.02, M.steel, x - 0.15, 0.78, cabZ - 0.29, { cast: false });
  }
  collide(cabX0, cabZ - 0.3, cabX1, ROOM.z1);
  // upper cabinets
  rbox(cabX1 - cabX0, 0.7, 0.36, 0.01, M.white, (cabX0 + cabX1) / 2, 1.85, ROOM.z1 - 0.2);
  for (let x = cabX0 + 0.3; x < cabX1; x += 0.6) box(0.004, 0.66, 0.01, M.dark, x, 1.85, ROOM.z1 - 0.382, { cast: false });
  // sink
  const sinkX = -1.55;
  const basin = mesh(new THREE.BoxGeometry(0.42, 0.012, 0.36), M.steel, { cast: false });
  basin.position.set(sinkX, 0.873, cabZ - 0.02);
  group.add(basin);
  const tap = new THREE.Group();
  tap.position.set(sinkX, 0.87, cabZ + 0.17);
  const tapPost = mesh(new THREE.CylinderGeometry(0.015, 0.018, 0.3, 12), M.steel);
  tapPost.position.y = 0.15;
  const tapArc = mesh(new THREE.TorusGeometry(0.08, 0.012, 8, 20, Math.PI), M.steel);
  tapArc.position.set(0, 0.3, -0.08);
  tapArc.rotation.y = Math.PI / 2;
  const elbow = mesh(new THREE.BoxGeometry(0.02, 0.12, 0.02), M.steel);
  elbow.position.set(0, 0.22, 0.02);
  elbow.rotation.x = -0.6;
  tap.add(tapPost, tapArc, elbow);
  group.add(tap);
  // counter props: autoclave, UV cabinet, glove boxes, cotton roll jar
  const auto = rbox(0.48, 0.38, 0.42, 0.03, M.white, -0.55, 1.06, cabZ);
  const autoDoor = mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.02, 32), M.steel);
  autoDoor.rotation.x = Math.PI / 2;
  autoDoor.position.set(-0.55, 1.07, cabZ - 0.215);
  group.add(autoDoor);
  const autoScreen = mesh(new THREE.PlaneGeometry(0.1, 0.04), new THREE.MeshStandardMaterial({ color: 0x0c1a1c, emissive: 0x39d1b6, emissiveIntensity: 0.6 }));
  autoScreen.position.set(-0.4, 1.19, cabZ - 0.211);
  group.add(autoScreen);
  auto.name = 'autoclave';
  const gloveColors = [0x6e8fd6, 0xd36e9a, 0xf2f2f2];
  gloveColors.forEach((c, i) => {
    const b = rbox(0.24, 0.12, 0.12, 0.005, new THREE.MeshStandardMaterial({ color: c, roughness: 0.7 }), -2.15 + i * 0.27, 0.93, cabZ + 0.08);
    b.rotation.y = 0.05 * (i - 1);
  });
  const jar = mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.16, 24), M.glass);
  jar.position.set(-1.05, 0.95, cabZ - 0.05);
  group.add(jar);
  for (let i = 0; i < 9; i++) {
    const roll = mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.04, 8), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 }), { cast: false });
    roll.position.set(-1.05 + (i % 3 - 1) * 0.02, 0.9 + Math.floor(i / 3) * 0.015, cabZ - 0.05 + ((i * 7) % 3 - 1) * 0.015);
    roll.rotation.z = Math.PI / 2;
    group.add(roll);
  }

  // --- doctor's desk with computer near the door
  const deskX = 1.65, deskZ = ROOM.z1 - 0.33;
  box(1.2, 0.035, 0.6, M.oak, deskX, 0.74, deskZ);
  box(0.03, 0.72, 0.56, M.white, deskX - 0.58, 0.36, deskZ);
  box(0.03, 0.72, 0.56, M.white, deskX + 0.58, 0.36, deskZ);
  rbox(0.4, 0.6, 0.55, 0.01, M.white, deskX + 0.36, 0.33, deskZ);
  collide(deskX - 0.6, deskZ - 0.3, deskX + 0.6, ROOM.z1);
  const monitor = new THREE.Group();
  monitor.position.set(deskX - 0.1, 0.76, deskZ + 0.1);
  const monBody = mesh(new RoundedBoxGeometry(0.56, 0.34, 0.03, 3, 0.01), M.dark);
  monBody.position.y = 0.3;
  const monStand = mesh(new THREE.BoxGeometry(0.04, 0.16, 0.03), M.dark);
  monStand.position.set(0, 0.08, 0.03);
  const monFoot = mesh(new THREE.BoxGeometry(0.2, 0.012, 0.15), M.dark);
  monitor.add(monBody, monStand, monFoot);
  const screenCanvas = canvas(512, 312);
  const screenTex = new THREE.CanvasTexture(screenCanvas);
  screenTex.colorSpace = THREE.SRGBColorSpace;
  const screen = mesh(new THREE.PlaneGeometry(0.53, 0.31), new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false }), { cast: false });
  screen.position.set(0, 0.3, -0.0155);
  screen.rotation.y = Math.PI;
  monitor.add(screen);
  monitor.rotation.y = Math.PI;
  group.add(monitor);
  const keyboard = rbox(0.44, 0.02, 0.14, 0.005, M.dark, deskX - 0.1, 0.77, deskZ - 0.12);
  const mouseM = rbox(0.06, 0.025, 0.1, 0.012, M.dark, deskX + 0.25, 0.77, deskZ - 0.12);
  void keyboard; void mouseM;
  // office chair
  const oc = new THREE.Group();
  oc.position.set(deskX - 0.1, 0, deskZ - 0.62);
  const ocSeat = mesh(new RoundedBoxGeometry(0.48, 0.08, 0.46, 3, 0.03), M.dark);
  ocSeat.position.y = 0.48;
  const ocBack = mesh(new RoundedBoxGeometry(0.46, 0.5, 0.06, 3, 0.03), M.dark);
  ocBack.position.set(0, 0.82, -0.22);
  const ocPost = mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.42, 10), M.steel);
  ocPost.position.y = 0.24;
  oc.add(ocSeat, ocBack, ocPost);
  for (let i = 0; i < 5; i++) {
    const legM = mesh(new THREE.BoxGeometry(0.3, 0.025, 0.04), M.dark);
    legM.position.set(Math.cos(i * 1.2566) * 0.15, 0.04, Math.sin(i * 1.2566) * 0.15);
    legM.rotation.y = -i * 1.2566;
    oc.add(legM);
  }
  oc.rotation.y = Math.PI;
  group.add(oc);
  collide(deskX - 0.38, deskZ - 0.88, deskX + 0.18, deskZ - 0.36);
  interactables.push({ object: monitor, kind: 'computer', label: 'Компьютер: расписание и карты пациентов' });

  // --- wall-mounted intraoral X-ray (visiograph) near the headrest
  const xr = new THREE.Group();
  xr.position.set(ROOM.x0 + 0.08, 1.75, 0.95);
  const xrBox = mesh(new RoundedBoxGeometry(0.12, 0.3, 0.22, 3, 0.02), M.white);
  const xrArm1 = mesh(new RoundedBoxGeometry(0.5, 0.05, 0.05, 2, 0.02), M.white);
  xrArm1.position.set(0.27, -0.05, 0);
  const xrArm2 = mesh(new RoundedBoxGeometry(0.4, 0.04, 0.04, 2, 0.015), M.white);
  xrArm2.position.set(0.6, -0.1, -0.12);
  xrArm2.rotation.y = 0.7;
  const xrHead = mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.24, 20), M.white);
  xrHead.position.set(0.78, -0.16, -0.27);
  xrHead.rotation.z = Math.PI / 2.6;
  const xrCone = mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.12, 20), M.dark);
  xrCone.position.set(0.88, -0.22, -0.27);
  xrCone.rotation.z = Math.PI / 2.6;
  const trefoil = mesh(new THREE.CircleGeometry(0.025, 3), new THREE.MeshStandardMaterial({ color: 0xf2c200 }), { cast: false });
  trefoil.position.set(0.061, 0.08, 0);
  trefoil.rotation.y = Math.PI / 2;
  xr.add(xrBox, xrArm1, xrArm2, xrHead, xrCone, trefoil);
  group.add(xr);
  interactables.push({ object: xr, kind: 'xray', label: 'Визиограф (прицельный снимок)' });

  // --- wall decor: diploma, license, tooth anatomy poster, clock
  const decor = (draw, w, h, x, y, z, ry) => {
    const c = canvas(Math.round(w * 600), Math.round(h * 600));
    draw(c.getContext('2d', { willReadFrequently: true }), c.width, c.height);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    const fr = new THREE.Group();
    const back = mesh(new THREE.BoxGeometry(w + 0.04, h + 0.04, 0.02), M.dark);
    const face = mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 }), { cast: false });
    face.position.z = 0.011;
    fr.add(back, face);
    fr.position.set(x, y, z);
    fr.rotation.y = ry;
    group.add(fr);
    return { group: fr, canvas: c, texture: t };
  };
  decor((ctx, W, H) => {
    ctx.fillStyle = '#f6f1e3'; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#8a6a2a'; ctx.lineWidth = 6; ctx.strokeRect(14, 14, W - 28, H - 28);
    ctx.fillStyle = '#2b3a55'; ctx.textAlign = 'center';
    ctx.font = 'bold 34px Georgia, serif'; ctx.fillText('ДИПЛОМ', W / 2, 70);
    ctx.font = '16px Georgia, serif';
    ctx.fillText('Первый Санкт-Петербургский государственный', W / 2, 108);
    ctx.fillText('медицинский университет имени академика И. П. Павлова', W / 2, 130);
    ctx.font = 'italic 18px Georgia, serif'; ctx.fillText('специальность «Стоматология»', W / 2, 172);
    ctx.font = '15px Georgia, serif'; ctx.fillText('квалификация: врач-стоматолог', W / 2, 200);
    ctx.fillStyle = '#b8892f'; ctx.beginPath(); ctx.arc(W - 90, H - 70, 34, 0, Math.PI * 2); ctx.fill();
  }, 0.5, 0.36, ROOM.x0 + 0.075, 1.75, -0.4, Math.PI / 2);
  decor((ctx, W, H) => {
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#1d4f55'; ctx.fillRect(0, 0, W, 60);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 26px Arial'; ctx.textAlign = 'center'; ctx.fillText('ЗУБНАЯ ФОРМУЛА', W / 2, 40);
    ctx.fillStyle = '#1d4f55'; ctx.font = '18px Arial';
    const row = (nums, y) => nums.forEach((n, i) => {
      const x = 40 + i * ((W - 80) / 15);
      ctx.strokeStyle = '#9fb3b6'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(x, y, 14, 20, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.fillText(String(n), x, y + (y < H / 2 ? -30 : 44));
    });
    row([18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28], H * 0.42);
    row([48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38], H * 0.66);
    ctx.font = '14px Arial'; ctx.fillStyle = '#555';
    ctx.fillText('C — кариес   P — пульпит   Pt — периодонтит   R — корень   П — пломба   К — коронка   О — отсутствует', W / 2, H - 24);
  }, 1.1, 0.62, -0.3, 1.7, ROOM.z1 - 0.39 - 0.02, Math.PI);
  const clock = decor(() => {}, 0.3, 0.3, 2.0, 2.25, ROOM.z0 + 0.075, 0);
  function drawClock(minutes) {
    const ctx = clock.canvas.getContext('2d', { willReadFrequently: true });
    const W = clock.canvas.width, c = W / 2;
    ctx.fillStyle = '#fbfbfa'; ctx.fillRect(0, 0, W, W);
    ctx.strokeStyle = '#22282c'; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.arc(c, c, c - 10, 0, Math.PI * 2); ctx.stroke();
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * Math.PI * 2;
      ctx.lineWidth = i % 3 === 0 ? 6 : 3;
      ctx.beginPath(); ctx.moveTo(c + Math.sin(a) * (c - 22), c - Math.cos(a) * (c - 22)); ctx.lineTo(c + Math.sin(a) * (c - 38), c - Math.cos(a) * (c - 38)); ctx.stroke();
    }
    const hA = ((minutes / 60) % 12) / 12 * Math.PI * 2, mA = (minutes % 60) / 60 * Math.PI * 2;
    ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(c, c); ctx.lineTo(c + Math.sin(hA) * c * 0.5, c - Math.cos(hA) * c * 0.5); ctx.stroke();
    ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(c, c); ctx.lineTo(c + Math.sin(mA) * c * 0.75, c - Math.cos(mA) * c * 0.75); ctx.stroke();
    ctx.fillStyle = '#c0392b'; ctx.beginPath(); ctx.arc(c, c, 6, 0, Math.PI * 2); ctx.fill();
    clock.texture.needsUpdate = true;
  }
  drawClock(9 * 60);

  // --- plant in the corner
  const plant = new THREE.Group();
  plant.position.set(ROOM.x0 + 0.35, 0, ROOM.z0 + 0.35);
  const pot = mesh(new THREE.CylinderGeometry(0.17, 0.13, 0.36, 24), new THREE.MeshStandardMaterial({ color: 0x3c4448, roughness: 0.6 }));
  pot.position.y = 0.18;
  plant.add(pot);
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2f6b3a, roughness: 0.55, side: THREE.DoubleSide });
  const leafGeo = new THREE.SphereGeometry(0.06, 8, 6);
  leafGeo.scale(1, 0.18, 0.45);
  const leaves = new THREE.InstancedMesh(leafGeo, leafMat, 140);
  leaves.castShadow = true;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  for (let i = 0; i < 140; i++) {
    const t = i / 140, a = i * 2.4;
    const y = 0.45 + t * 1.15, r = 0.12 + Math.sin(t * Math.PI) * 0.22;
    e.set((Math.random() - 0.5) * 0.8, a, -0.4 - Math.random() * 0.5);
    q.setFromEuler(e);
    m4.compose(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r), q, new THREE.Vector3(1, 1, 1).multiplyScalar(0.8 + Math.random() * 0.6));
    leaves.setMatrixAt(i, m4);
  }
  plant.add(leaves);
  const trunk = mesh(new THREE.CylinderGeometry(0.015, 0.025, 1.3, 8), new THREE.MeshStandardMaterial({ color: 0x5b4632 }));
  trunk.position.y = 0.95;
  plant.add(trunk);
  group.add(plant);
  collide(ROOM.x0, ROOM.z0, ROOM.x0 + 0.55, ROOM.z0 + 0.55);

  // --- dental chair (head toward -X, patient's right side is +Z)
  const chair = createDentalChair({ upholstery });
  chair.root.position.set(-0.35, 0, -0.1);
  group.add(chair.root);
  collide(-0.95, -0.55, 0.65, 0.35);
  collide(-1.4, -0.7, -1.2, -0.3);
  interactables.push({ object: chair.root, kind: 'chair', label: 'Стоматологическая установка' });

  // operator stools
  const stool = (x, z, colorHex) => {
    const g = new THREE.Group();
    const seatS = mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.08, 28), new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.5 }));
    seatS.position.y = 0.55;
    const post = mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.5, 10), M.steel);
    post.position.y = 0.28;
    g.add(seatS, post);
    for (let i = 0; i < 5; i++) {
      const l = mesh(new THREE.BoxGeometry(0.28, 0.025, 0.04), M.dark);
      l.position.set(Math.cos(i * 1.2566) * 0.14, 0.04, Math.sin(i * 1.2566) * 0.14);
      l.rotation.y = -i * 1.2566;
      g.add(l);
    }
    g.position.set(x, 0, z);
    group.add(g);
    return g;
  };
  const doctorStool = stool(-1.2, 0.55, 0x2c7075);
  const assistantStool = stool(-0.95, -0.95, 0x2c7075);
  void assistantStool;

  // --- corridor: waiting chairs, cooler, reception, brand sign
  for (let i = 0; i < 3; i++) {
    const wx = 3.4 + i * 0.62;
    const wc = new THREE.Group();
    const s = mesh(new RoundedBoxGeometry(0.5, 0.08, 0.48, 3, 0.03), M.teal);
    s.position.y = 0.46;
    const b = mesh(new RoundedBoxGeometry(0.5, 0.45, 0.07, 3, 0.03), M.teal);
    b.position.set(0, 0.74, -0.22);
    const fr = mesh(new THREE.BoxGeometry(0.46, 0.42, 0.42), M.steel);
    fr.scale.set(1, 1, 1);
    fr.position.y = 0.21;
    fr.material = M.dark;
    wc.add(s, b, fr);
    wc.position.set(wx, 0, CORRIDOR.z0 + 0.32);
    group.add(wc);
  }
  collide(3.1, CORRIDOR.z0, 4.95, CORRIDOR.z0 + 0.58);
  const cooler = new THREE.Group();
  const cBody = mesh(new RoundedBoxGeometry(0.32, 1.0, 0.32, 3, 0.02), M.white);
  cBody.position.y = 0.5;
  const bottle = mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.42, 24), new THREE.MeshPhysicalMaterial({ color: 0x9fd3f0, roughness: 0.05, transparent: true, opacity: 0.55, depthWrite: false }));
  bottle.position.y = 1.22;
  cooler.add(cBody, bottle);
  cooler.position.set(7.8, 0, CORRIDOR.z1 - 0.3);
  group.add(cooler);
  collide(7.6, CORRIDOR.z1 - 0.5, 8.2, CORRIDOR.z1);
  const counter = rbox(1.6, 1.05, 0.5, 0.02, M.white, 6.3, 0.525, CORRIDOR.z1 - 0.3);
  box(1.64, 0.03, 0.55, M.oak, 6.3, 1.065, CORRIDOR.z1 - 0.3);
  void counter;
  collide(5.5, CORRIDOR.z1 - 0.55, 7.1, CORRIDOR.z1);
  const sign = decor((ctx, W, H) => {
    ctx.fillStyle = '#1d4f55'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center';
    ctx.font = `600 ${Math.round(H * 0.32)}px "Golos Text", Arial`;
    ctx.fillText(brand, W / 2, H * 0.58);
    ctx.font = `${Math.round(H * 0.13)}px "Golos Text", Arial`;
    ctx.fillStyle = '#bfe0dc';
    ctx.fillText('стоматология', W / 2, H * 0.84);
  }, 1.6, 0.36, 6.3, 1.95, CORRIDOR.z1 - 0.075, Math.PI);

  // --- lights
  const panelMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 2.2 });
  const addPanel = (x, z, w = 0.6, d = 1.2, intensity = 7) => {
    const p = mesh(new THREE.PlaneGeometry(w, d), panelMat, { cast: false, receive: false });
    p.rotation.x = Math.PI / 2;
    p.position.set(x, ROOM.h - 0.005, z);
    group.add(p);
    const l = new THREE.RectAreaLight(0xfff6ea, intensity, w, d);
    l.position.set(x, ROOM.h - 0.01, z);
    l.lookAt(x, 0, z);
    group.add(l);
    return l;
  };
  addPanel(-0.4, -0.2);
  addPanel(1.3, 0.9);
  addPanel(4.2, 1.05, 1.2, 0.6, 5);
  addPanel(6.6, 1.05, 1.2, 0.6, 5);
  const hemi = new THREE.HemisphereLight(0xf2f6ff, 0xb9b2a6, 0.35);
  group.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff1dc, 2.4);
  sun.position.set(3.2, 6.5, -9);
  sun.target.position.set(0.2, 0, -0.4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -4; sun.shadow.camera.right = 4;
  sun.shadow.camera.top = 4; sun.shadow.camera.bottom = -4;
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 20;
  sun.shadow.bias = -0.0003;
  sun.shadow.normalBias = 0.02;
  group.add(sun, sun.target);

  // contact shadows under heavy furniture
  const blobMat = new THREE.MeshBasicMaterial({ map: blobShadow(), transparent: true, depthWrite: false });
  for (const [x, z, w, d] of [[-0.35, -0.1, 1.9, 1.3], [deskX - 0.1, deskZ - 0.62, 0.7, 0.7]]) {
    const b = new THREE.Mesh(new THREE.PlaneGeometry(w, d), blobMat);
    b.rotation.x = -Math.PI / 2;
    b.position.set(x, 0.002, z);
    group.add(b);
  }

  // anchor points for NPC paths
  const anchors = {
    spawn: new THREE.Vector3(7.6, 0, 1.05),
    corridorDoor: new THREE.Vector3(3.2, 0, 1.2),
    doorInside: new THREE.Vector3(2.0, 0, 1.2),
    chairFront: new THREE.Vector3(0.75, 0, -0.1),
    waiting: [new THREE.Vector3(3.4, 0, 0.42), new THREE.Vector3(4.02, 0, 0.42), new THREE.Vector3(4.64, 0, 0.42)],
    doctorStool: doctorStool.position.clone(),
    playerStart: new THREE.Vector3(1.0, 0, 1.0),
    nurse: new THREE.Vector3(-0.95, 0, -0.95),
  };

  return { group, chair, colliders, interactables, updaters, door, anchors, drawClock, screenCanvas, screenTex, sign };
}
