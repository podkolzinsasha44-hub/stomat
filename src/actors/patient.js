// A patient character: walks in, sits in the dental chair, reclines with it, opens the mouth,
// reacts with facial expressions and looks at the doctor while talking.
import * as THREE from 'three';
import { instantiateAvatar, loadAnimations } from '../core/assets.js';

const WALK_SPEED = 1.01; // m/s, matches the walk clip stride
const SIT_BACK = 0.46;   // sitDown clip moves the pelvis this far back
const STAND_FWD = 0.423; // standUp clip moves the pelvis this far forward
const FACE = {
  jaw: 'AK_25_JawOpen', blinkL: 'AK_09_EyeBlinkLeft', blinkR: 'AK_10_EyeBlinkRight',
  browUp: 'AK_03_BrowInnerUp', browDownL: 'AK_01_BrowDownLeft', browDownR: 'AK_02_BrowDownRight',
  smileL: 'AK_44_MouthSmileLeft', smileR: 'AK_45_MouthSmileRight', frownL: 'AK_30_MouthFrownLeft', frownR: 'AK_31_MouthFrownRight',
  squintL: 'AK_19_EyeSquintLeft', squintR: 'AK_20_EyeSquintRight', stretchL: 'AK_46_MouthStretchLeft', stretchR: 'AK_47_MouthStretchRight',
  wideL: 'AK_21_EyeWideLeft', wideR: 'AK_22_EyeWideRight', aa: 'AA_VI_10_aa', oh: 'AA_VI_13_O', ee: 'AA_VI_11_E',
};
const EXPRESSIONS = {
  neutral: {},
  smile: { smileL: 0.7, smileR: 0.7 },
  pain: { browDownL: 0.8, browDownR: 0.8, squintL: 0.9, squintR: 0.9, stretchL: 0.5, stretchR: 0.5, browUp: 0.4 },
  fear: { browUp: 0.9, wideL: 0.6, wideR: 0.6, frownL: 0.3, frownR: 0.3 },
  worried: { browUp: 0.6, frownL: 0.35, frownR: 0.35 },
  angry: { browDownL: 0.9, browDownR: 0.9, frownL: 0.6, frownR: 0.6 },
};

export async function createPatient(scene, avatarId, sex) {
  const [{ model, meshes }, clips] = await Promise.all([instantiateAvatar(avatarId), loadAnimations(sex)]);
  const root = new THREE.Group();
  root.name = 'patient';
  root.add(model);
  scene.add(root);

  const mixer = new THREE.AnimationMixer(model);
  const actions = {};
  for (const [name, clip] of Object.entries(clips)) {
    const a = mixer.clipAction(clip);
    if (name === 'sitDown' || name === 'standUp') { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; }
    actions[name] = a;
  }
  let current = null;
  function play(name, fade = 0.35) {
    const next = actions[name];
    if (!next || next === current) return next;
    next.reset().setEffectiveWeight(1).play();
    if (current) current.crossFadeTo(next, fade, false);
    current = next;
    return next;
  }
  play('idle', 0);

  const bones = {};
  model.traverse((o) => { if (o.isBone || o.type === 'Bone' || /^Bip01/.test(o.name)) bones[o.name] = o; });
  const B = (n) => bones['Bip01_' + n] || bones['Bip01' + n];

  const faceMeshes = meshes.filter((m) => m.morphTargetDictionary && m.morphTargetDictionary[FACE.jaw] !== undefined);
  const morph = {}; // current weights by key
  const morphTarget = {};
  for (const k of Object.keys(FACE)) { morph[k] = 0; morphTarget[k] = 0; }

  const self = {
    root, model, mixer, actions, sex, avatarId,
    state: 'idle', seated: false, chair: null,
    recline: 0, legExtend: 0, headTilt: 0, mouthOpen: 0,
    lookTarget: null, expression: 'neutral', exprWeight: 1, painPulse: 0,
    speaking: 0,
  };

  // --- walking along a path
  let path = null, pathResolve = null, turnGoal = null, turnResolve = null;
  self.walkPath = (points) => new Promise((resolve) => {
    path = points.map((p) => p.clone());
    pathResolve = resolve;
    self.state = 'walk';
    play('walk');
  });
  self.turnTo = (yaw) => new Promise((resolve) => { turnGoal = yaw; turnResolve = resolve; });
  self.place = (pos, yaw) => { root.position.copy(pos); root.rotation.set(0, yaw, 0); };

  function angleDiff(a, b) { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; }

  // --- sitting in the dental chair
  self.sitInChair = async (chair) => {
    const front = new THREE.Vector3(0.62, 0, 0).applyMatrix4(chair.root.matrixWorld);
    front.y = 0;
    await self.walkPath([front]);
    const yawChairFwd = chair.root.rotation.y + Math.PI / 2;
    await self.turnTo(yawChairFwd);
    self.state = 'sitting';
    // align so that after the clip the pelvis lands on the seat
    const seatWorld = seatPelvisWorld(chair);
    const fwd = new THREE.Vector3(Math.sin(yawChairFwd), 0, Math.cos(yawChairFwd));
    root.position.set(seatWorld.x + fwd.x * SIT_BACK, 0, seatWorld.z + fwd.z * SIT_BACK);
    const a = play('sitDown', 0.25);
    await waitFinished(a);
    // re-parent to the chair so the patient moves with the lift
    chair.patientAnchor.updateMatrixWorld(true);
    chair.patientAnchor.add(root);
    root.position.set(-0.13, -0.5, 0);
    root.rotation.set(0, Math.PI / 2, 0);
    play('sitIdle', 0.2);
    self.seated = true;
    self.chair = chair;
    self.state = 'seated';
  };

  function seatPelvisWorld(chair) {
    chair.root.updateMatrixWorld(true);
    return new THREE.Vector3(-0.11, 0, 0).applyMatrix4(chair.patientAnchor.matrixWorld);
  }

  self.standUp = async (scene) => {
    if (!self.seated) return;
    const chair = self.chair;
    const world = new THREE.Vector3();
    root.getWorldPosition(world);
    scene.add(root);
    const yaw = chair.root.rotation.y + Math.PI / 2;
    root.position.set(world.x, 0, world.z);
    root.rotation.set(0, yaw, 0);
    self.seated = false;
    self.recline = 0; self.legExtend = 0; self.headTilt = 0;
    self.state = 'standing';
    const a = play('standUp', 0.3);
    await waitFinished(a);
    const fwd = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    root.position.addScaledVector(fwd, STAND_FWD);
    play('idle', 0.15);
    self.state = 'idle';
    self.chair = null;
  };

  function waitFinished(action) {
    return new Promise((resolve) => {
      const on = (e) => { if (e.action === action) { mixer.removeEventListener('finished', on); resolve(); } };
      mixer.addEventListener('finished', on);
    });
  }

  self.setExpression = (name, weight = 1) => { self.expression = name; self.exprWeight = weight; };
  self.flinch = () => { self.painPulse = 1; };
  self.say = (seconds = 2) => { self.speaking = Math.max(self.speaking, seconds); };
  self.gesture = (name) => {
    if (self.seated) return;
    if (actions[name]) play(name, 0.4);
  };

  // --- per-frame
  let blinkT = 2 + Math.random() * 3;
  let lookAmt = 0;
  let slide = 0;
  const tmpQ2b = new THREE.Quaternion();
  const tmpQ = new THREE.Quaternion(), tmpQ2 = new THREE.Quaternion(), axis = new THREE.Vector3(), tmpV = new THREE.Vector3();

  function rotateBoneWorld(bone, worldAxis, angle) {
    if (!bone || Math.abs(angle) < 1e-5) return;
    bone.parent.getWorldQuaternion(tmpQ2);
    tmpQ.setFromAxisAngle(worldAxis, angle);
    // local' = parentW^-1 * R * parentW * local
    const pInv = tmpQ2.clone().invert();
    bone.quaternion.premultiply(pInv.multiply(tmpQ).multiply(tmpQ2));
    bone.updateMatrixWorld(true);
  }

  // rotate `bone` about `axis` so the bone->child segment points along `dir` (projected on the plane)
  function alignBone(bone, child, dir, ax, gain) {
    if (!bone || !child) return;
    const a = bone.getWorldPosition(new THREE.Vector3());
    const b = child.getWorldPosition(new THREE.Vector3());
    const seg = b.sub(a).projectOnPlane(ax).normalize();
    const want = dir.clone().projectOnPlane(ax).normalize();
    const c = new THREE.Vector3().crossVectors(seg, want);
    const err = Math.atan2(c.dot(ax), seg.dot(want));
    rotateBoneWorld(bone, ax, THREE.MathUtils.clamp(err, -0.8, 0.8) * gain);
  }

  self.update = (dt, camera) => {
    // locomotion
    if (path && path.length) {
      const target = path[0];
      tmpV.set(target.x - root.position.x, 0, target.z - root.position.z);
      const dist = tmpV.length();
      const want = Math.atan2(tmpV.x, tmpV.z);
      root.rotation.y += angleDiff(root.rotation.y, want) * Math.min(1, dt * 6);
      const step = Math.min(dist, WALK_SPEED * dt);
      if (dist > 0.02) {
        const facing = Math.abs(angleDiff(root.rotation.y, want)) < 1.2 ? 1 : 0.3;
        root.position.addScaledVector(tmpV.normalize(), step * facing);
      }
      if (dist < 0.06) {
        path.shift();
        if (!path.length) { play('idle', 0.3); self.state = 'idle'; const r = pathResolve; pathResolve = null; path = null; r?.(); }
      }
    } else if (turnGoal !== null) {
      const d = angleDiff(root.rotation.y, turnGoal);
      root.rotation.y += Math.sign(d) * Math.min(Math.abs(d), dt * 3.2);
      if (Math.abs(d) < 0.02) { turnGoal = null; const r = turnResolve; turnResolve = null; r?.(); }
    }

    mixer.update(dt);
    model.updateMatrixWorld(true);

    // reclined pose layered over the seated clip
    if (self.seated && self.chair) {
      const ch = self.chair;
      const back = (ch.pose.back - 12) * Math.PI / 180;
      const legLift = (48 - ch.pose.leg) * Math.PI / 180;
      root.getWorldQuaternion(tmpQ);
      axis.set(1, 0, 0).applyQuaternion(tmpQ); // patient's left-right axis
      // In the Biped rig the thighs hang off Bip01_Spine, so thigh rotations compensate pelvis tilt.
      rotateBoneWorld(B('Spine'), axis, -back * 0.4);
      rotateBoneWorld(B('Spine1'), axis, -back * 0.38);
      rotateBoneWorld(B('Spine2'), axis, -back * 0.24);
      // then align the actual torso line with the backrest (robust to the idle clip's own lean)
      if (back > 0.05) {
        const pel = B('Pelvis').getWorldPosition(new THREE.Vector3());
        const neck = B('Neck').getWorldPosition(new THREE.Vector3());
        const torso = neck.sub(pel).projectOnPlane(axis).normalize();
        ch.backPivot.getWorldQuaternion(tmpQ2b);
        const rest = new THREE.Vector3(0, 1, 0).applyQuaternion(tmpQ2b).projectOnPlane(axis).normalize();
        const cross = new THREE.Vector3().crossVectors(torso, rest);
        const err = Math.atan2(cross.dot(axis), torso.dot(rest));
        const fix = THREE.MathUtils.clamp(err, -0.6, 0.6) * Math.min(1, back / 0.5);
        rotateBoneWorld(B('Spine'), axis, fix * 0.6);
        rotateBoneWorld(B('Spine1'), axis, fix * 0.4);
        // slide the body back until the upper back touches the cushion
        const s2 = B('Spine2').getWorldPosition(new THREE.Vector3());
        const pivot = ch.backPivot.getWorldPosition(new THREE.Vector3());
        const n = new THREE.Vector3(1, 0, 0).applyQuaternion(tmpQ2b);
        const d = s2.sub(pivot).dot(n);
        slide += THREE.MathUtils.clamp((0.14 - d) * 0.25, -0.01, 0.01);
        slide = THREE.MathUtils.clamp(slide, -0.25, 0.05);
      } else {
        slide *= 0.9;
      }
      root.position.set(-0.13 + slide, -0.5 - 0.07 * Math.min(1, back / 1.1), 0);
      rotateBoneWorld(B('Head'), axis, -back * 0.06 - self.headTilt);
      // keep the arms resting on the body as the torso goes back
      rotateBoneWorld(B('L_UpperArm'), axis, back * 0.7);
      rotateBoneWorld(B('R_UpperArm'), axis, back * 0.7);
      rotateBoneWorld(B('L_Thigh'), axis, back * 0.4 - legLift * 0.25);
      rotateBoneWorld(B('R_Thigh'), axis, back * 0.4 - legLift * 0.25);
      rotateBoneWorld(B('L_Calf'), axis, -legLift * 1.5);
      rotateBoneWorld(B('R_Calf'), axis, -legLift * 1.5);
      if (legLift > 0.05) {
        // lay thighs along the seat and calves along the leg rest
        const k = Math.min(1, legLift / 0.5);
        ch.lift.getWorldQuaternion(tmpQ2b);
        const seatDir = new THREE.Vector3(1, 0.0, 0).normalize().applyQuaternion(tmpQ2b);
        ch.legPivot.getWorldQuaternion(tmpQ2b);
        const legDir = new THREE.Vector3(1, -0.1, 0).normalize().applyQuaternion(tmpQ2b);
        for (const side of ['L', 'R']) {
          alignBone(B(side + '_Thigh'), B(side + '_Calf'), seatDir, axis, k * 0.8);
          alignBone(B(side + '_Calf'), B(side + '_Foot'), legDir, axis, k * 0.9);
        }
      }
    }

    // look at the doctor (turn the neck toward the target, smoothed)
    const head = B('Head');
    let wantLook = 0;
    if (head && self.lookTarget && !path) {
      const local = root.worldToLocal(self.lookTarget.clone());
      const hl = root.worldToLocal(head.getWorldPosition(tmpV));
      wantLook = THREE.MathUtils.clamp(Math.atan2(local.x - hl.x, local.z - hl.z), -1.0, 1.0) * (self.seated ? 0.5 : 0.65);
    }
    lookAmt += (wantLook - lookAmt) * Math.min(1, dt * 4);
    if (Math.abs(lookAmt) > 1e-3) {
      root.getWorldQuaternion(tmpQ);
      const back = self.seated && self.chair ? (self.chair.pose.back - 12) * Math.PI / 180 : 0;
      const upW = new THREE.Vector3(0, Math.cos(back), -Math.sin(back)).applyQuaternion(tmpQ);
      rotateBoneWorld(B('Neck') || head, upW, lookAmt);
    }

    // face
    blinkT -= dt;
    let blink = 0;
    if (blinkT < 0.12) blink = 1 - Math.abs(blinkT - 0.06) / 0.06;
    if (blinkT < 0) blinkT = 2 + Math.random() * 4;
    const ex = EXPRESSIONS[self.expression] || {};
    self.painPulse = Math.max(0, self.painPulse - dt * 1.5);
    const pain = EXPRESSIONS.pain;
    for (const k of Object.keys(FACE)) morphTarget[k] = (ex[k] || 0) * self.exprWeight + (pain[k] || 0) * self.painPulse;
    morphTarget.jaw = Math.max(morphTarget.jaw, self.mouthOpen);
    if (self.speaking > 0) {
      self.speaking -= dt;
      const tt = performance.now() / 1000;
      morphTarget.aa = Math.max(0, Math.sin(tt * 13)) * 0.55;
      morphTarget.oh = Math.max(0, Math.sin(tt * 7 + 1)) * 0.35;
    }
    morphTarget.blinkL = Math.max(morphTarget.blinkL, blink);
    morphTarget.blinkR = Math.max(morphTarget.blinkR, blink);
    for (const k of Object.keys(FACE)) {
      const speed = k.startsWith('blink') ? 40 : 6;
      morph[k] += (morphTarget[k] - morph[k]) * Math.min(1, dt * speed);
      for (const m of faceMeshes) {
        const idx = m.morphTargetDictionary[FACE[k]];
        if (idx !== undefined) m.morphTargetInfluences[idx] = morph[k];
      }
    }
  };

  self.headWorld = (out = new THREE.Vector3()) => { const h = B('Head'); if (h) h.getWorldPosition(out); return out; };
  self.mouthWorld = (out = new THREE.Vector3()) => {
    const h = B('MJaw') || B('Head');
    if (h) h.getWorldPosition(out);
    return out;
  };
  self.dispose = () => { root.parent?.remove(root); mixer.stopAllAction(); };
  return self;
}
