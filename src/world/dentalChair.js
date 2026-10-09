// Procedural dental unit: chair with lift, reclining backrest, headrest and leg rest,
// doctor's delivery unit, assistant element with suction, cuspidor and operating light.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { leather, brushedSteel } from './textures.js';

const DEG = Math.PI / 180;

function cushionGeometry(w, l, t, r = 0.04) {
  // soft cushion: rounded rectangle extruded with a generous bevel
  const s = new THREE.Shape();
  const hw = w / 2 - r, hl = l / 2 - r;
  s.moveTo(-hw, -hl - r);
  s.lineTo(hw, -hl - r);
  s.quadraticCurveTo(hw + r, -hl - r, hw + r, -hl);
  s.lineTo(hw + r, hl);
  s.quadraticCurveTo(hw + r, hl + r, hw, hl + r);
  s.lineTo(-hw, hl + r);
  s.quadraticCurveTo(-hw - r, hl + r, -hw - r, hl);
  s.lineTo(-hw - r, -hl);
  s.quadraticCurveTo(-hw - r, -hl - r, -hw, -hl - r);
  const g = new THREE.ExtrudeGeometry(s, { depth: t - 0.03, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.018, bevelSegments: 5, curveSegments: 10 });
  g.translate(0, 0, -(t - 0.03) / 2);
  g.rotateX(-Math.PI / 2); // lie flat: width along X, length along Z, thickness along Y
  g.computeVertexNormals();
  return g;
}

// Turn a flat cushion upright: width -> Z, length -> Y (up), thickness -> X (facing the patient).
const UPRIGHT = new THREE.Quaternion().setFromRotationMatrix(
  new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0)));
function standUp(m) { m.quaternion.copy(UPRIGHT); }

export function createDentalChair({ upholstery = [44, 112, 117] } = {}) {
  const lea = leather(upholstery);
  for (const t of [lea.map, lea.normalMap, lea.roughnessMap]) t.repeat.set(5, 5);
  const steel = brushedSteel();
  const M = {
    shell: new THREE.MeshPhysicalMaterial({ color: 0xf2f3f2, roughness: 0.28, clearcoat: 0.6, clearcoatRoughness: 0.2 }),
    shellDark: new THREE.MeshStandardMaterial({ color: 0x9aa3a6, roughness: 0.4, metalness: 0.2 }),
    leather: new THREE.MeshPhysicalMaterial({ map: lea.map, normalMap: lea.normalMap, normalScale: new THREE.Vector2(0.35, 0.35), roughnessMap: lea.roughnessMap, roughness: 1, sheen: 0.4, sheenRoughness: 0.6, sheenColor: new THREE.Color(0x6aa0a4) }),
    steel: new THREE.MeshStandardMaterial({ color: 0xd6dadc, metalness: 1, roughness: 0.3, roughnessMap: steel.roughnessMap }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x2a2d30, roughness: 0.8 }),
    hose: new THREE.MeshStandardMaterial({ color: 0x3a3f44, roughness: 0.55 }),
    ceramic: new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.12, clearcoat: 1 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.05, transparent: true, opacity: 0.35, depthWrite: false }),
    led: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff4e6, emissiveIntensity: 0 }),
    screen: new THREE.MeshStandardMaterial({ color: 0x0b0f12, roughness: 0.2, emissive: 0xffffff, emissiveIntensity: 0 }),
  };
  const mesh = (g, m, cast = true) => { const o = new THREE.Mesh(g, m); o.castShadow = cast; o.receiveShadow = true; return o; };

  const root = new THREE.Group();
  root.name = 'dentalChair';

  // base plate and lift column
  const base = mesh(new RoundedBoxGeometry(0.62, 0.06, 0.95, 4, 0.025), M.shell);
  base.position.set(0.05, 0.03, 0);
  root.add(base);
  const columnBody = mesh(new RoundedBoxGeometry(0.34, 1, 0.4, 4, 0.05), M.shell);
  columnBody.position.set(0.0, 0.5, 0);
  const column = new THREE.Group();
  column.add(columnBody);
  root.add(column);
  const footPedal = mesh(new RoundedBoxGeometry(0.22, 0.05, 0.16, 3, 0.02), M.shellDark);
  footPedal.position.set(0.25, 0.03, 0.62);
  root.add(footPedal);

  const lift = new THREE.Group();
  root.add(lift);
  const seatFrame = mesh(new RoundedBoxGeometry(0.5, 0.08, 0.46, 4, 0.03), M.shell);
  seatFrame.position.set(0.05, 0.0, 0);
  lift.add(seatFrame);
  const seat = mesh(cushionGeometry(0.5, 0.52, 0.09), M.leather);
  seat.rotation.y = Math.PI / 2; // length along X
  seat.position.set(0.04, 0.075, 0);
  lift.add(seat);

  // backrest pivots at the back edge of the seat (toward -X)
  const backPivot = new THREE.Group();
  backPivot.position.set(-0.22, 0.09, 0);
  lift.add(backPivot);
  const backShell = mesh(new RoundedBoxGeometry(0.06, 0.66, 0.48, 4, 0.025), M.shell);
  backShell.position.set(-0.07, 0.33, 0);
  backPivot.add(backShell);
  const back = mesh(cushionGeometry(0.5, 0.66, 0.08), M.leather);
  standUp(back);
  back.position.set(-0.01, 0.34, 0);
  backPivot.add(back);

  const headPivot = new THREE.Group();
  headPivot.position.set(-0.03, 0.68, 0);
  backPivot.add(headPivot);
  const headBar = mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.2, 12), M.steel);
  headBar.position.set(-0.05, 0.03, 0);
  headPivot.add(headBar);
  const headrest = mesh(cushionGeometry(0.27, 0.22, 0.07, 0.06), M.leather);
  standUp(headrest);
  headrest.position.set(0.0, 0.14, 0);
  headPivot.add(headrest);

  // leg rest pivots at the front edge
  const legPivot = new THREE.Group();
  legPivot.position.set(0.3, 0.07, 0);
  lift.add(legPivot);
  const leg = mesh(cushionGeometry(0.46, 0.62, 0.08), M.leather);
  leg.rotation.y = Math.PI / 2;
  leg.position.set(0.32, 0.0, 0);
  legPivot.add(leg);
  const legShell = mesh(new RoundedBoxGeometry(0.62, 0.05, 0.42, 4, 0.02), M.shell);
  legShell.position.set(0.32, -0.06, 0);
  legPivot.add(legShell);

  // armrests (doctor side swings away, assistant side fixed)
  for (const side of [-1, 1]) {
    const arm = mesh(new RoundedBoxGeometry(0.42, 0.05, 0.07, 3, 0.022), M.leather);
    arm.position.set(0.0, 0.26, side * 0.3);
    const post = mesh(new RoundedBoxGeometry(0.04, 0.2, 0.04, 2, 0.015), M.shell);
    post.position.set(-0.12, 0.15, side * 0.3);
    lift.add(arm, post);
  }

  const patientAnchor = new THREE.Group();
  patientAnchor.name = 'patientAnchor';
  patientAnchor.position.set(0.02, 0.12, 0);
  lift.add(patientAnchor);

  // doctor's delivery unit on the patient's right (+Z)
  const unitArm = new THREE.Group();
  unitArm.position.set(0.18, 0.0, 0.32);
  lift.add(unitArm);
  const armA = mesh(new RoundedBoxGeometry(0.08, 0.06, 0.5, 3, 0.025), M.shell);
  armA.position.set(0.0, 0.32, 0.22);
  unitArm.add(armA);
  const tray = mesh(new RoundedBoxGeometry(0.42, 0.06, 0.3, 4, 0.03), M.shell);
  tray.position.set(0.0, 0.38, 0.5);
  unitArm.add(tray);
  const panel = mesh(new RoundedBoxGeometry(0.16, 0.012, 0.1, 2, 0.005), M.screen);
  panel.position.set(-0.08, 0.415, 0.58);
  unitArm.add(panel);
  const handpieces = [];
  for (let i = 0; i < 4; i++) {
    const hp = new THREE.Group();
    const body = mesh(new THREE.CylinderGeometry(0.009, 0.011, 0.16, 12), i === 0 ? M.steel : M.shellDark);
    body.rotation.z = Math.PI / 2 - 0.35;
    hp.add(body);
    hp.position.set(0.08 + (i - 1.5) * 0.05, 0.47, 0.44);
    unitArm.add(hp);
    handpieces.push(hp);
    const hoseCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.08 + (i - 1.5) * 0.05 - 0.07, 0.44, 0.44),
      new THREE.Vector3(0.08 + (i - 1.5) * 0.05 - 0.1, 0.3, 0.46),
      new THREE.Vector3(0.08 + (i - 1.5) * 0.05 - 0.05, 0.22, 0.52),
      new THREE.Vector3(0.08 + (i - 1.5) * 0.05, 0.36, 0.6),
    ]);
    unitArm.add(mesh(new THREE.TubeGeometry(hoseCurve, 24, 0.006, 8), M.hose));
  }

  // assistant element and cuspidor on the patient's left (-Z)
  const cuspPost = mesh(new RoundedBoxGeometry(0.12, 0.62, 0.12, 3, 0.03), M.shell);
  cuspPost.position.set(-0.05, 0.31, -0.5);
  root.add(cuspPost);
  const bowl = mesh(new THREE.SphereGeometry(0.11, 32, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2.4), M.ceramic);
  bowl.material = M.ceramic.clone();
  bowl.material.side = THREE.DoubleSide;
  bowl.position.set(-0.05, 0.78, -0.56);
  bowl.rotation.x = Math.PI;
  root.add(bowl);
  const filler = mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.12, 8), M.steel);
  filler.position.set(-0.13, 0.8, -0.5);
  filler.rotation.z = 0.6;
  root.add(filler);
  const suctionArm = mesh(new RoundedBoxGeometry(0.34, 0.05, 0.08, 3, 0.02), M.shell);
  suctionArm.position.set(-0.15, 0.68, -0.4);
  suctionArm.rotation.y = 0.6;
  root.add(suctionArm);

  // operating light on a pole behind the headrest
  const pole = mesh(new THREE.CylinderGeometry(0.035, 0.04, 2.0, 16), M.shell);
  pole.position.set(-0.95, 1.0, -0.42);
  root.add(pole);
  const lightArm = new THREE.Group();
  lightArm.position.set(-0.95, 1.98, -0.42);
  root.add(lightArm);
  const arm1 = mesh(new RoundedBoxGeometry(0.06, 0.06, 0.6, 3, 0.025), M.shell);
  arm1.position.set(0.18, 0, 0.22);
  arm1.rotation.y = -0.6;
  lightArm.add(arm1);
  const lampJoint = new THREE.Group();
  lampJoint.position.set(0.38, -0.05, 0.38);
  lightArm.add(lampJoint);
  const arm2 = mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.32, 10), M.shell);
  arm2.position.set(0, -0.16, 0);
  lampJoint.add(arm2);
  const lampHead = new THREE.Group();
  lampHead.position.set(0, -0.34, 0);
  lampJoint.add(lampHead);
  const lampBody = mesh(new RoundedBoxGeometry(0.34, 0.07, 0.16, 4, 0.035), M.shell);
  lampHead.add(lampBody);
  const lens = mesh(new RoundedBoxGeometry(0.26, 0.01, 0.1, 2, 0.004), M.led, false);
  lens.position.set(0, -0.036, 0);
  lampHead.add(lens);
  const handleL = mesh(new THREE.TorusGeometry(0.03, 0.007, 8, 16, Math.PI), M.shellDark);
  handleL.position.set(-0.19, 0, 0);
  handleL.rotation.set(0, Math.PI / 2, Math.PI / 2);
  lampHead.add(handleL);
  const handleR = handleL.clone();
  handleR.position.x = 0.19;
  lampHead.add(handleR);
  const spot = new THREE.SpotLight(0xfff3e0, 0, 3, 18 * DEG, 0.55, 1.6);
  spot.castShadow = true;
  spot.shadow.mapSize.set(1024, 1024);
  spot.shadow.bias = -0.0004;
  spot.shadow.normalBias = 0.01;
  spot.shadow.camera.near = 0.1;
  spot.shadow.camera.far = 3;
  spot.position.set(0, -0.04, 0);
  lampHead.add(spot);
  lampHead.add(spot.target);

  // patient education monitor on the pole
  const monitorPivot = new THREE.Group();
  monitorPivot.position.set(-0.95, 1.55, -0.42);
  root.add(monitorPivot);
  const monArm = mesh(new RoundedBoxGeometry(0.04, 0.04, 0.32, 2, 0.015), M.shell);
  monArm.position.set(0.1, 0, 0.12);
  monArm.rotation.y = 0.8;
  monitorPivot.add(monArm);
  const monitor = mesh(new RoundedBoxGeometry(0.42, 0.27, 0.025, 3, 0.01), M.shell);
  monitor.position.set(0.28, 0.0, 0.2);
  monitor.rotation.set(0, -0.6 + Math.PI / 2, 0);
  monitorPivot.add(monitor);
  const monitorScreen = mesh(new THREE.PlaneGeometry(0.38, 0.235), M.screen.clone(), false);
  monitorScreen.position.set(0, 0, 0.0131);
  monitor.add(monitorScreen);

  // pose state: lift height (m), back recline (deg from vertical), leg rest drop (deg), head tilt (deg)
  const pose = { lift: 0.42, back: 12, leg: 48, head: 0, lamp: 0 };
  const target = { ...pose };

  function apply() {
    lift.position.set(0.02, pose.lift, 0);
    column.scale.y = Math.max(0.2, pose.lift - 0.02);
    column.position.y = 0;
    columnBody.position.y = 0.5;
    backPivot.rotation.z = pose.back * DEG;
    headPivot.rotation.z = pose.head * DEG;
    legPivot.rotation.z = -pose.leg * DEG;
    M.led.emissiveIntensity = pose.lamp * 3;
    spot.intensity = pose.lamp * 9;
    // keep the lamp aimed at the mouth area
    const mouth = new THREE.Vector3();
    patientMouthWorld(mouth);
    spot.target.position.copy(lampHead.worldToLocal(mouth.clone()));
  }

  const tmpV = new THREE.Vector3();
  function patientMouthWorld(out) {
    // approximate mouth location in the chair frame for the current pose
    const back = pose.back * DEG;
    const local = new THREE.Vector3(-0.22 - Math.sin(back) * 0.66, pose.lift + 0.09 + Math.cos(back) * 0.66 + 0.06, 0);
    root.updateMatrixWorld(true);
    return out.copy(local).applyMatrix4(root.matrixWorld);
  }

  function setPose(p) { Object.assign(target, p); }
  function snap(p) { Object.assign(target, p); Object.assign(pose, p); apply(); }
  function update(dt) {
    let moving = false;
    for (const k of Object.keys(pose)) {
      const d = target[k] - pose[k];
      if (Math.abs(d) > 1e-3) {
        const speed = k === 'lift' ? 0.12 : k === 'lamp' ? 3 : 22;
        pose[k] += Math.sign(d) * Math.min(Math.abs(d), speed * dt);
        moving = true;
      }
    }
    apply();
    return moving;
  }
  apply();

  return {
    root, pose, setPose, snap, update, patientAnchor, backPivot, legPivot, headPivot, lift, lampHead, spot,
    monitorScreen, patientMouthWorld, isMoving: () => Object.keys(pose).some(k => Math.abs(target[k] - pose[k]) > 1e-3),
    tmpV,
  };
}
