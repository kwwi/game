import * as THREE from 'three';
import { ANIM_MS, tweenVec3, tweenNumber } from './anims.js';

function burstParticles(scene, origin, color, count = 24) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const vel = [];
  for (let i = 0; i < count; i++) {
    pos[i * 3] = origin.x;
    pos[i * 3 + 1] = origin.y;
    pos[i * 3 + 2] = origin.z;
    vel.push(new THREE.Vector3(
      (Math.random() - 0.5) * 2.2,
      Math.random() * 2.5,
      (Math.random() - 0.5) * 2.2
    ));
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    color,
    size: 0.12,
    transparent: true,
    opacity: 1,
    depthWrite: false
  });
  const pts = new THREE.Points(geo, mat);
  scene.add(pts);
  const start = performance.now();
  const life = 650;
  function frame(now) {
    const u = Math.min(1, (now - start) / life);
    const arr = geo.attributes.position.array;
    for (let i = 0; i < count; i++) {
      arr[i * 3] += vel[i].x * 0.016;
      arr[i * 3 + 1] += vel[i].y * 0.016;
      arr[i * 3 + 2] += vel[i].z * 0.016;
      vel[i].y -= 0.04;
    }
    geo.attributes.position.needsUpdate = true;
    mat.opacity = 1 - u;
    if (u < 1) requestAnimationFrame(frame);
    else {
      scene.remove(pts);
      geo.dispose();
      mat.dispose();
    }
  }
  requestAnimationFrame(frame);
}

const EXIT_COLOR = {
  WHALE: 0x66ccee,
  PHOENIX: 0xff6633,
  DRAGON: 0x44dd99,
  ELEPHANT: 0x8899aa,
  LION: 0xffcc44,
  TIGER: 0xff8822,
  LEOPARD: 0xddaa44,
  JACKAL: 0xd44828,
  WOLF: 0x99aacc,
  DOG: 0xcc9955,
  CAT: 0xdda066,
  MOUSE: 0xaaaaaa
};

export async function playExit(avatar, scene, screenFx, reduceMotion) {
  if (!avatar || !avatar.root) return;
  avatar.busy = true;
  const root = avatar.root;
  const type = avatar.type || 'MOUSE';
  const color = EXIT_COLOR[type] || 0xffffff;
  const origin = root.position.clone();
  origin.y += 0.4;

  if (screenFx) screenFx(type);

  if (reduceMotion) {
    scene.remove(root);
    avatar.busy = false;
    return;
  }

  burstParticles(scene, origin, color, type === 'PHOENIX' || type === 'DRAGON' ? 36 : 22);

  switch (type) {
    case 'PHOENIX': {
      await tweenVec3(root, 'position', origin.clone().setY(origin.y + 3.5), ANIM_MS.exit);
      await tweenNumber(() => root.scale.x, v => root.scale.setScalar(v), 0.05, 280);
      break;
    }
    case 'DRAGON': {
      const start = performance.now();
      await new Promise(resolve => {
        function frame(now) {
          const u = Math.min(1, (now - start) / ANIM_MS.exit);
          root.rotation.y += 0.25;
          root.position.y = avatar.baseY + u * 1.2;
          root.scale.setScalar(1 - u * 0.9);
          if (u < 1) requestAnimationFrame(frame);
          else resolve();
        }
        requestAnimationFrame(frame);
      });
      break;
    }
    case 'WHALE': {
      await tweenVec3(root, 'position', origin.clone().setY(origin.y + 0.3), 200);
      await tweenNumber(() => root.scale.x, v => root.scale.setScalar(Math.max(0.05, v)), 0.05, ANIM_MS.exit);
      break;
    }
    case 'MOUSE': {
      await tweenVec3(root, 'position', new THREE.Vector3(origin.x, -0.8, origin.z), ANIM_MS.exit * 0.85);
      break;
    }
    case 'JACKAL': {
      const dash = origin.clone().add(new THREE.Vector3(1.8, 0.4, 0.2));
      await tweenVec3(root, 'position', dash, ANIM_MS.exit * 0.55);
      await tweenNumber(() => root.scale.x, v => root.scale.setScalar(v), 0.05, 200);
      break;
    }
    case 'ELEPHANT': {
      await tweenVec3(root, 'scale', new THREE.Vector3(1.35, 0.25, 1.35), 240);
      await tweenVec3(root, 'scale', new THREE.Vector3(0.05, 0.05, 0.05), ANIM_MS.exit * 0.7);
      break;
    }
    default: {
      // lion/tiger/leopard/wolf/dog/cat: knockback fade
      const knock = origin.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.5, 1.2, (Math.random() - 0.5)));
      await tweenVec3(root, 'position', knock, ANIM_MS.exit * 0.7);
      await tweenNumber(() => root.scale.x, v => root.scale.setScalar(v), 0.05, 220);
      break;
    }
  }

  scene.remove(root);
  avatar.busy = false;
}

export function pulseScreenFlash(overlayEl, type) {
  if (!overlayEl) return;
  const colors = {
    PHOENIX: 'rgba(255,100,40,0.35)',
    DRAGON: 'rgba(40,220,140,0.3)',
    WHALE: 'rgba(80,180,255,0.3)',
    JACKAL: 'rgba(220,70,40,0.28)'
  };
  overlayEl.style.background = colors[type] || 'rgba(200,180,120,0.18)';
  overlayEl.classList.add('fx-flash');
  setTimeout(() => overlayEl.classList.remove('fx-flash'), 280);
}
