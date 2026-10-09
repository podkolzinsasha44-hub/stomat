// Anatomical dimensions of permanent teeth (mm), FDI numbering and helpers.
// Values follow common dental anatomy tables (Wheeler's averages, rounded).

// pos 1..8 from the midline. md/bl: crown mesiodistal / buccolingual width, h: crown height,
// root: root length, cmd/cbl: cervical dimensions, type, roots: layout of separate roots.
const UPPER = {
  1: { md: 8.6, bl: 7.0, h: 10.5, root: 13.0, cmd: 6.8, cbl: 6.0, type: 'incisor' },
  2: { md: 6.6, bl: 6.0, h: 9.0, root: 13.0, cmd: 5.0, cbl: 5.0, type: 'incisor' },
  3: { md: 7.6, bl: 8.0, h: 10.0, root: 17.0, cmd: 5.6, cbl: 7.0, type: 'canine' },
  4: { md: 7.0, bl: 9.0, h: 8.5, root: 14.0, cmd: 5.0, cbl: 8.0, type: 'premolar', roots: [{ x: 0, z: 0.45, r: 0.42 }, { x: 0, z: -0.45, r: 0.4 }] },
  5: { md: 6.6, bl: 9.0, h: 8.0, root: 14.0, cmd: 5.0, cbl: 8.0, type: 'premolar' },
  6: { md: 10.2, bl: 11.0, h: 7.5, root: 12.5, cmd: 8.0, cbl: 10.0, type: 'molar', trunk: 4, roots: [{ x: 0.42, z: 0.48, r: 0.3, name: 'MB', canals: 2 }, { x: -0.45, z: 0.48, r: 0.27, name: 'DB' }, { x: 0, z: -0.5, r: 0.34, name: 'P' }] },
  7: { md: 9.2, bl: 11.0, h: 7.0, root: 12.0, cmd: 7.2, cbl: 10.0, type: 'molar', trunk: 4.5, roots: [{ x: 0.4, z: 0.45, r: 0.29, name: 'MB' }, { x: -0.4, z: 0.45, r: 0.26, name: 'DB' }, { x: 0, z: -0.45, r: 0.33, name: 'P' }] },
  8: { md: 8.6, bl: 10.0, h: 6.5, root: 11.0, cmd: 6.6, cbl: 9.4, type: 'molar', trunk: 5, roots: [{ x: 0.3, z: 0.3, r: 0.3, name: 'MB' }, { x: -0.3, z: 0.3, r: 0.28, name: 'DB' }, { x: 0, z: -0.35, r: 0.32, name: 'P' }] },
};
const LOWER = {
  1: { md: 5.2, bl: 6.0, h: 9.0, root: 12.5, cmd: 3.6, cbl: 5.4, type: 'incisor' },
  2: { md: 5.8, bl: 6.4, h: 9.5, root: 14.0, cmd: 4.0, cbl: 5.8, type: 'incisor' },
  3: { md: 7.0, bl: 7.6, h: 11.0, root: 16.0, cmd: 5.4, cbl: 7.0, type: 'canine' },
  4: { md: 7.0, bl: 7.6, h: 8.5, root: 14.0, cmd: 5.0, cbl: 6.6, type: 'premolar' },
  5: { md: 7.2, bl: 8.2, h: 8.0, root: 14.5, cmd: 5.0, cbl: 7.0, type: 'premolar' },
  6: { md: 11.2, bl: 10.4, h: 7.5, root: 14.0, cmd: 9.0, cbl: 9.0, type: 'molar', trunk: 3.5, roots: [{ x: 0.5, z: 0, r: 0.36, name: 'M', canals: 2, flat: 0.55 }, { x: -0.5, z: 0, r: 0.34, name: 'D', flat: 0.6 }] },
  7: { md: 10.6, bl: 10.0, h: 7.0, root: 13.0, cmd: 8.2, cbl: 9.0, type: 'molar', trunk: 4, roots: [{ x: 0.45, z: 0, r: 0.35, name: 'M', canals: 2, flat: 0.55 }, { x: -0.45, z: 0, r: 0.33, name: 'D', flat: 0.6 }] },
  8: { md: 10.2, bl: 9.6, h: 7.0, root: 11.0, cmd: 7.6, cbl: 9.0, type: 'molar', trunk: 4.5, roots: [{ x: 0.35, z: 0, r: 0.36, name: 'M', flat: 0.6 }, { x: -0.35, z: 0, r: 0.34, name: 'D', flat: 0.65 }] },
};

export const ALL_TEETH = [
  18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28,
  48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38,
];

export function toothSpec(fdi) {
  const quadrant = Math.floor(fdi / 10);
  const pos = fdi % 10;
  const upper = quadrant === 1 || quadrant === 2;
  const right = quadrant === 1 || quadrant === 4; // patient's right
  const base = (upper ? UPPER : LOWER)[pos];
  return { fdi, quadrant, pos, upper, right, ...base };
}

export const TYPE_NAMES = {
  incisor: ['центральный резец', 'боковой резец'],
  canine: 'клык',
  premolar: ['первый премоляр', 'второй премоляр'],
  molar: ['первый моляр', 'второй моляр', 'третий моляр (зуб мудрости)'],
};

export function toothName(fdi) {
  const s = toothSpec(fdi);
  let n;
  if (s.type === 'incisor') n = TYPE_NAMES.incisor[s.pos - 1];
  else if (s.type === 'canine') n = TYPE_NAMES.canine;
  else if (s.type === 'premolar') n = TYPE_NAMES.premolar[s.pos - 4];
  else n = TYPE_NAMES.molar[s.pos - 6];
  const jaw = s.upper ? 'верхней' : 'нижней';
  const side = s.right ? 'справа' : 'слева';
  return `${fdi} — ${n} ${jaw} челюсти ${side}`;
}

// Number of root canals typical for each tooth (used by endodontics).
export function canalCount(fdi) {
  const s = toothSpec(fdi);
  if (s.upper) {
    if (s.pos <= 3) return 1;
    if (s.pos === 4) return 2;
    if (s.pos === 5) return 1;
    if (s.pos === 6) return 4; // MB1, MB2, DB, P
    return 3;
  }
  if (s.pos <= 5) return 1;
  return 3; // ML, MB, D
}

// VITA classical shade guide approximations (sRGB)
export const SHADES = {
  A1: [240, 232, 214], A2: [236, 222, 196], A3: [228, 210, 176], 'A3.5': [220, 198, 160], B1: [242, 236, 220], B2: [234, 222, 192], C2: [222, 212, 190],
};
