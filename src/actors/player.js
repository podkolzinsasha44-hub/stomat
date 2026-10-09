// First-person doctor: walks with WASD, looks with the mouse, collides with furniture.
import * as THREE from 'three';

const R = 0.26; // body radius

export function createPlayer(camera, colliders) {
  const pos = new THREE.Vector3(1.0, 0, 1.0);
  const vel = new THREE.Vector3();
  let yaw = Math.PI * 0.75, pitch = -0.08;
  let bob = 0;
  const eye = 1.66;
  const p = {
    pos, enabled: true,
    get yaw() { return yaw; }, set yaw(v) { yaw = v; },
    get pitch() { return pitch; }, set pitch(v) { pitch = v; },
    // a camera tween overrides the first-person view (used for cut-scenes)
    tween: null,
  };

  function collide(next) {
    for (const c of colliders) {
      const cx = Math.max(c.x0, Math.min(next.x, c.x1));
      const cz = Math.max(c.z0, Math.min(next.z, c.z1));
      const dx = next.x - cx, dz = next.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < R * R) {
        if (d2 > 1e-8) {
          const d = Math.sqrt(d2);
          next.x = cx + (dx / d) * R;
          next.z = cz + (dz / d) * R;
        } else {
          // centre inside the box: push out along the shallowest axis
          const pushes = [[c.x0 - R - next.x, 0], [c.x1 + R - next.x, 0], [0, c.z0 - R - next.z], [0, c.z1 + R - next.z]];
          pushes.sort((a, b) => Math.abs(a[0] + a[1]) - Math.abs(b[0] + b[1]));
          next.x += pushes[0][0]; next.z += pushes[0][1];
        }
      }
    }
  }

  p.update = (dt, input) => {
    if (p.tween) {
      const t = p.tween;
      t.time += dt;
      const k = Math.min(1, t.time / t.duration);
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      camera.position.lerpVectors(t.fromPos, t.toPos, e);
      camera.quaternion.slerpQuaternions(t.fromQuat, t.toQuat, e);
      if (k >= 1 && t.onDone) { const cb = t.onDone; t.onDone = null; cb(); }
      return;
    }
    if (!p.enabled) return;
    const look = input.locked || (input.mouse.buttons & 2);
    if (look) {
      yaw -= input.mouse.dx * 0.0022;
      pitch -= input.mouse.dy * 0.0022;
      pitch = Math.max(-1.35, Math.min(1.35, pitch));
    }
    const f = (input.down('KeyW') || input.down('ArrowUp') ? 1 : 0) - (input.down('KeyS') || input.down('ArrowDown') ? 1 : 0);
    const s = (input.down('KeyD') || input.down('ArrowRight') ? 1 : 0) - (input.down('KeyA') || input.down('ArrowLeft') ? 1 : 0);
    const speed = input.down('ShiftLeft') ? 2.6 : 1.6;
    const fwd = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
    const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    const wish = fwd.multiplyScalar(f).add(right.multiplyScalar(s));
    if (wish.lengthSq() > 0) wish.normalize().multiplyScalar(speed);
    vel.lerp(wish, Math.min(1, dt * 10));
    const next = pos.clone().addScaledVector(vel, dt);
    collide(next);
    collide(next);
    pos.copy(next);
    const moving = vel.length();
    bob += dt * moving * 6.5;
    camera.position.set(pos.x, eye + Math.sin(bob) * 0.012 * Math.min(1, moving), pos.z);
    camera.quaternion.setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));
  };

  p.place = (x, z, yawV, pitchV = -0.08) => {
    pos.set(x, 0, z);
    yaw = yawV; pitch = pitchV;
    camera.position.set(x, eye, z);
    camera.quaternion.setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));
  };

  // smooth camera move to a pose; returns a promise
  p.flyTo = (toPos, lookAt, duration = 1.2) => new Promise((resolve) => {
    const m = new THREE.Matrix4().lookAt(toPos, lookAt, new THREE.Vector3(0, 1, 0));
    const toQuat = new THREE.Quaternion().setFromRotationMatrix(m);
    p.tween = { time: 0, duration, fromPos: camera.position.clone(), toPos: toPos.clone(), fromQuat: camera.quaternion.clone(), toQuat, onDone: resolve };
  });
  p.release = () => {
    // return control to first-person, keeping the current view direction
    const e = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
    yaw = e.y; pitch = Math.max(-1.35, Math.min(1.35, e.x));
    p.tween = null;
  };
  p.eye = eye;
  return p;
}
