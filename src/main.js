import * as THREE from 'three';
import { createRenderer } from './core/renderer.js';
import { createInput } from './core/input.js';
import { buildClinic } from './world/clinic.js';
import { createPlayer } from './actors/player.js';
import { createPatient } from './actors/patient.js';
import './ui/ui.css';

const canvas = document.getElementById('gl');
const params = new URLSearchParams(location.search);
const R = createRenderer(canvas, params.get('q') || 'medium');
const input = createInput(canvas);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xdfe6ea);
scene.environment = R.roomEnv;
scene.environmentIntensity = 0.35;
const camera = new THREE.PerspectiveCamera(62, 1, 0.03, 120);
console.time('clinic');
const clinic = buildClinic(R.renderer);
console.timeEnd('clinic');
scene.add(clinic.group);
const player = createPlayer(camera, clinic.colliders);
player.place(1.6, 1.2, Math.PI * 0.62, -0.18);
R.register(scene, camera, { aoRadius: 0.35 });

function onResize() {
  camera.aspect = canvas.clientWidth / canvas.clientHeight;
  camera.updateProjectionMatrix();
}
addEventListener('resize', onResize);
onResize();

const game = { scene, camera, clinic, player, input, R, patients: [] };
window.__game = game;

const clock = new THREE.Clock();
let frames = 0;
function frame() {
  if (frames++ < 3) console.time('frame' + frames);
  const dt = Math.min(0.05, clock.getDelta());
  player.update(dt, input);
  clinic.chair.update(dt);
  for (const u of clinic.updaters) u(dt);
  for (const p of game.patients) p.update(dt, camera);
  R.render(scene, camera);
  input.endFrame();
  if (frames <= 3) console.timeEnd('frame' + frames);
  requestAnimationFrame(frame);
}
console.log('boot done');
requestAnimationFrame(frame);

// debug helpers for automated screenshots
game.spawnPatient = async (id = 'm01', sex = 'm') => {
  const p = await createPatient(scene, id, sex);
  p.place(clinic.anchors.spawn, -Math.PI / 2);
  p.lookTarget = camera.position;
  game.patients.push(p);
  return p;
};
game.stepAsync = async (seconds, fps = 30) => {
  for (let i = 0; i < seconds * fps; i++) {
    const dt = 1 / fps;
    clinic.chair.update(dt);
    for (const u of clinic.updaters) u(dt);
    for (const p of game.patients) p.update(dt, camera);
    await null;
  }
};
game.step = (seconds, fps = 30) => {
  for (let i = 0; i < seconds * fps; i++) {
    const dt = 1 / fps;
    clinic.chair.update(dt);
    for (const u of clinic.updaters) u(dt);
    for (const p of game.patients) p.update(dt, camera);
  }
};
