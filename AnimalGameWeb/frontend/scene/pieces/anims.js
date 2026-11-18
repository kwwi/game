import * as THREE from 'three';

export const ANIM_MS = {
  idle: 0,
  select: 220,
  flip: 520,
  move: 320,
  attack: 420,
  exit: 700
};

export function tickIdle(avatar, t, reduceMotion) {
  if (!avatar || reduceMotion) return;
  const root = avatar.root;
  if (!root || avatar.busy) return;
  const amp = avatar.faceDown ? 0.02 : 0.045;
  root.position.y = avatar.baseY + Math.sin(t * 2.2 + avatar.phase) * amp;
  const parts = root.userData.parts || {};
  if (parts.wingL && parts.wingR) {
    const flap = Math.sin(t * 5 + avatar.phase) * 0.25;
    parts.wingL.rotation.y = flap;
    parts.wingR.rotation.y = -flap;
  }
  if (parts.tail && parts.tail.rotation) {
    parts.tail.rotation.y = Math.sin(t * 3 + avatar.phase) * 0.2;
  }
}

export function tweenVec3(obj, prop, to, ms) {
  return new Promise(resolve => {
    const from = obj[prop].clone();
    const start = performance.now();
    function frame(now) {
      const u = Math.min(1, (now - start) / ms);
      const e = 1 - Math.pow(1 - u, 3);
      obj[prop].lerpVectors(from, to, e);
      if (u < 1) requestAnimationFrame(frame);
      else resolve();
    }
    requestAnimationFrame(frame);
  });
}

export function tweenNumber(getter, setter, to, ms) {
  return new Promise(resolve => {
    const from = getter();
    const start = performance.now();
    function frame(now) {
      const u = Math.min(1, (now - start) / ms);
      const e = 1 - Math.pow(1 - u, 3);
      setter(from + (to - from) * e);
      if (u < 1) requestAnimationFrame(frame);
      else resolve();
    }
    requestAnimationFrame(frame);
  });
}

export async function playSelect(avatar) {
  if (!avatar) return;
  avatar.busy = true;
  const root = avatar.root;
  await tweenVec3(root, 'position', new THREE.Vector3(root.position.x, avatar.baseY + 0.35, root.position.z), ANIM_MS.select);
  avatar.busy = false;
}

export async function playDeselect(avatar) {
  if (!avatar) return;
  const root = avatar.root;
  await tweenVec3(root, 'position', new THREE.Vector3(root.position.x, avatar.baseY, root.position.z), ANIM_MS.select * 0.7);
}

export async function playMove(avatar, toPos, ms = ANIM_MS.move) {
  if (!avatar) return;
  avatar.busy = true;
  const root = avatar.root;
  const mid = new THREE.Vector3(
    (root.position.x + toPos.x) / 2,
    avatar.baseY + 0.55,
    (root.position.z + toPos.z) / 2
  );
  await tweenVec3(root, 'position', mid, ms * 0.45);
  await tweenVec3(root, 'position', new THREE.Vector3(toPos.x, avatar.baseY, toPos.z), ms * 0.55);
  avatar.cell = { r: avatar._pendingR, c: avatar._pendingC };
  avatar.busy = false;
}

export async function playAttackLunge(avatar, toward, type) {
  if (!avatar) return;
  avatar.busy = true;
  const root = avatar.root;
  const origin = root.position.clone();
  const dir = toward.clone().sub(origin);
  dir.y = 0;
  if (dir.lengthSq() < 1e-6) dir.set(0, 0, 1);
  dir.normalize();
  const strike = origin.clone().add(dir.multiplyScalar(0.55));
  strike.y = avatar.baseY + 0.25;
  const extra = type === 'DRAGON' || type === 'PHOENIX' || type === 'WHALE' ? 80 : 0;
  await tweenVec3(root, 'position', strike, ANIM_MS.attack * 0.4 + extra * 0.2);
  await tweenVec3(root, 'position', new THREE.Vector3(origin.x, avatar.baseY, origin.z), ANIM_MS.attack * 0.45);
  avatar.busy = false;
}
