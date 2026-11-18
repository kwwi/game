import * as THREE from 'three';

const GEO = {};
const MAT = {};

function geo(key, factory) {
  if (!GEO[key]) GEO[key] = factory();
  return GEO[key];
}

function campColors(camp) {
  if (camp === 'RED') {
    return { primary: 0xc44536, accent: 0xffd28a, emissive: 0x4a1208 };
  }
  return { primary: 0x2b3348, accent: 0x9ad7ff, emissive: 0x0a1528 };
}

function bodyMat(camp, extras = {}) {
  const c = campColors(camp);
  const key = `body_${camp}_${extras.key || 'd'}`;
  if (!MAT[key]) {
    MAT[key] = new THREE.MeshStandardMaterial({
      color: extras.color || c.primary,
      emissive: extras.emissive || c.emissive,
      emissiveIntensity: extras.ei || 0.35,
      metalness: extras.metalness ?? 0.25,
      roughness: extras.roughness ?? 0.55
    });
  }
  return MAT[key].clone();
}

function accentMat(camp) {
  const c = campColors(camp);
  const key = `acc_${camp}`;
  if (!MAT[key]) {
    MAT[key] = new THREE.MeshStandardMaterial({
      color: c.accent,
      emissive: c.accent,
      emissiveIntensity: 0.45,
      metalness: 0.5,
      roughness: 0.35
    });
  }
  return MAT[key].clone();
}

function addShadow(mesh) {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function makeSealedPillar(camp) {
  const g = new THREE.Group();
  g.name = 'sealed';
  const stone = addShadow(new THREE.Mesh(
    geo('sealBody', () => new THREE.BoxGeometry(0.72, 1.05, 0.42)),
    new THREE.MeshStandardMaterial({
      color: camp === 'RED' ? 0x4a1820 : 0x1c2433,
      emissive: camp === 'RED' ? 0x6a1820 : 0x183050,
      emissiveIntensity: 0.75,
      roughness: 0.65,
      metalness: 0.35
    })
  ));
  stone.position.y = 0.55;
  const rune = addShadow(new THREE.Mesh(
    geo('sealRune', () => new THREE.TorusGeometry(0.22, 0.035, 6, 16)),
    accentMat(camp)
  ));
  rune.position.set(0, 0.7, 0.22);
  g.add(stone, rune);
  return g;
}

function baseAnimal(camp) {
  const root = new THREE.Group();
  root.userData.camp = camp;
  root.userData.parts = {};
  return root;
}

function makeMouse(camp) {
  const root = baseAnimal(camp);
  const mat = bodyMat(camp, { key: 'mouse', color: 0x8a7a6a });
  const body = addShadow(new THREE.Mesh(geo('mBody', () => new THREE.SphereGeometry(0.32, 12, 10)), mat));
  body.position.y = 0.35;
  body.scale.set(1.1, 0.85, 1.3);
  const head = addShadow(new THREE.Mesh(geo('mHead', () => new THREE.SphereGeometry(0.2, 10, 8)), mat));
  head.position.set(0, 0.42, 0.28);
  const earG = geo('mEar', () => new THREE.CircleGeometry(0.1, 8));
  const earL = addShadow(new THREE.Mesh(earG, accentMat(camp)));
  earL.position.set(-0.14, 0.55, 0.22);
  const earR = earL.clone();
  earR.position.x = 0.14;
  const tail = addShadow(new THREE.Mesh(geo('mTail', () => new THREE.CylinderGeometry(0.03, 0.02, 0.55, 6)), mat));
  tail.rotation.z = Math.PI / 2.4;
  tail.position.set(0.28, 0.3, -0.2);
  root.add(body, head, earL, earR, tail);
  root.userData.parts = { body, head, tail };
  return root;
}

function makeCat(camp) {
  const root = baseAnimal(camp);
  const mat = bodyMat(camp, { key: 'cat', color: 0xb88a4a });
  const body = addShadow(new THREE.Mesh(geo('cBody', () => new THREE.SphereGeometry(0.34, 12, 10)), mat));
  body.position.y = 0.38;
  body.scale.set(1, 0.9, 1.25);
  const head = addShadow(new THREE.Mesh(geo('cHead', () => new THREE.SphereGeometry(0.24, 10, 8)), mat));
  head.position.set(0, 0.55, 0.28);
  const earGeo = geo('cEar', () => new THREE.ConeGeometry(0.1, 0.18, 6));
  const earL = addShadow(new THREE.Mesh(earGeo, mat));
  earL.position.set(-0.12, 0.72, 0.22);
  const earR = earL.clone();
  earR.position.x = 0.12;
  const tail = addShadow(new THREE.Mesh(geo('cTail', () => new THREE.CylinderGeometry(0.04, 0.03, 0.5, 6)), mat));
  tail.position.set(0, 0.45, -0.4);
  tail.rotation.x = 0.5;
  root.add(body, head, earL, earR, tail);
  root.userData.parts = { body, head, tail };
  return root;
}

function makeDog(camp) {
  const root = baseAnimal(camp);
  const mat = bodyMat(camp, { key: 'dog', color: 0x9a6b3c });
  const body = addShadow(new THREE.Mesh(geo('dBody', () => new THREE.CapsuleGeometry(0.28, 0.35, 6, 10)), mat));
  body.position.y = 0.4;
  body.rotation.z = Math.PI / 2;
  const head = addShadow(new THREE.Mesh(geo('dHead', () => new THREE.SphereGeometry(0.22, 10, 8)), mat));
  head.position.set(0.38, 0.48, 0);
  const snout = addShadow(new THREE.Mesh(geo('dSnout', () => new THREE.CylinderGeometry(0.08, 0.12, 0.22, 8)), mat));
  snout.rotation.z = Math.PI / 2;
  snout.position.set(0.55, 0.42, 0);
  const earL = addShadow(new THREE.Mesh(geo('dEar', () => new THREE.BoxGeometry(0.08, 0.18, 0.12)), mat));
  earL.position.set(0.3, 0.68, 0.12);
  const earR = earL.clone();
  earR.position.z = -0.12;
  root.add(body, head, snout, earL, earR);
  root.userData.parts = { body, head };
  return root;
}

function makeWolf(camp) {
  const root = makeDog(camp);
  root.scale.set(1.05, 1.1, 0.95);
  const mane = addShadow(new THREE.Mesh(
    geo('wMane', () => new THREE.TorusGeometry(0.2, 0.06, 6, 12)),
    bodyMat(camp, { key: 'wmane', color: 0x555555, ei: 0.2 })
  ));
  mane.position.set(0.28, 0.5, 0);
  mane.rotation.y = Math.PI / 2;
  root.add(mane);
  return root;
}

function makeFortune(camp) {
  const root = baseAnimal(camp);
  const coin = addShadow(new THREE.Mesh(
    geo('fCoin', () => new THREE.CylinderGeometry(0.42, 0.42, 0.12, 20)),
    bodyMat(camp, { key: 'fortune', color: 0xd4a84b, metalness: 0.8, roughness: 0.3, ei: 0.55 })
  ));
  coin.position.y = 0.5;
  coin.rotation.x = Math.PI / 2;
  const jewel = addShadow(new THREE.Mesh(
    geo('fJewel', () => new THREE.OctahedronGeometry(0.18, 0)),
    accentMat(camp)
  ));
  jewel.position.y = 0.85;
  root.add(coin, jewel);
  root.userData.parts = { body: coin, head: jewel };
  return root;
}

function makeLeopard(camp) {
  const root = baseAnimal(camp);
  const mat = bodyMat(camp, { key: 'leopard', color: 0xc9a04a });
  const body = addShadow(new THREE.Mesh(geo('lBody', () => new THREE.CapsuleGeometry(0.26, 0.4, 6, 10)), mat));
  body.position.y = 0.42;
  body.rotation.z = Math.PI / 2;
  const head = addShadow(new THREE.Mesh(geo('lHead', () => new THREE.SphereGeometry(0.22, 10, 8)), mat));
  head.position.set(0.42, 0.5, 0);
  for (let i = 0; i < 6; i++) {
    const spot = new THREE.Mesh(
      geo('spot', () => new THREE.SphereGeometry(0.04, 6, 6)),
      new THREE.MeshStandardMaterial({ color: 0x2a1a10 })
    );
    spot.position.set(-0.15 + (i % 3) * 0.15, 0.5 + (i > 2 ? 0.08 : 0), -0.18 + (i % 2) * 0.2);
    root.add(spot);
  }
  root.add(body, head);
  root.userData.parts = { body, head };
  return root;
}

function makeTigerFixed(camp) {
  const root = baseAnimal(camp);
  const mat = bodyMat(camp, { key: 'tiger', color: 0xe08a2a });
  const body = addShadow(new THREE.Mesh(geo('tBody', () => new THREE.CapsuleGeometry(0.28, 0.42, 6, 10)), mat));
  body.position.y = 0.44;
  body.rotation.z = Math.PI / 2;
  const head = addShadow(new THREE.Mesh(geo('tHead', () => new THREE.SphereGeometry(0.24, 10, 8)), mat));
  head.position.set(0.44, 0.52, 0);
  for (let i = 0; i < 4; i++) {
    const stripe = addShadow(new THREE.Mesh(
      geo('stripe', () => new THREE.BoxGeometry(0.06, 0.28, 0.36)),
      new THREE.MeshStandardMaterial({ color: 0x1a1008 })
    ));
    stripe.position.set(-0.2 + i * 0.14, 0.5, 0);
    root.add(stripe);
  }
  root.add(body, head);
  root.userData.parts = { body, head };
  return root;
}

function makeLion(camp) {
  const root = baseAnimal(camp);
  const mat = bodyMat(camp, { key: 'lion', color: 0xd4a03a });
  const body = addShadow(new THREE.Mesh(geo('liBody', () => new THREE.CapsuleGeometry(0.3, 0.35, 6, 10)), mat));
  body.position.y = 0.45;
  body.rotation.z = Math.PI / 2;
  const head = addShadow(new THREE.Mesh(geo('liHead', () => new THREE.SphereGeometry(0.26, 12, 10)), mat));
  head.position.set(0.4, 0.55, 0);
  const mane = addShadow(new THREE.Mesh(
    geo('liMane', () => new THREE.TorusGeometry(0.3, 0.12, 8, 16)),
    bodyMat(camp, { key: 'mane', color: 0xb06a18, ei: 0.4 })
  ));
  mane.position.copy(head.position);
  mane.rotation.y = Math.PI / 2;
  root.add(body, head, mane);
  root.userData.parts = { body, head, mane };
  return root;
}

function makeElephant(camp) {
  const root = baseAnimal(camp);
  const mat = bodyMat(camp, { key: 'elephant', color: 0x8a8f9a });
  const body = addShadow(new THREE.Mesh(geo('eBody', () => new THREE.SphereGeometry(0.42, 14, 12)), mat));
  body.position.y = 0.5;
  body.scale.set(1.15, 0.95, 1.3);
  const head = addShadow(new THREE.Mesh(geo('eHead', () => new THREE.SphereGeometry(0.28, 12, 10)), mat));
  head.position.set(0.4, 0.55, 0);
  const trunk = addShadow(new THREE.Mesh(geo('eTrunk', () => new THREE.CylinderGeometry(0.07, 0.1, 0.55, 8)), mat));
  trunk.position.set(0.62, 0.28, 0);
  trunk.rotation.z = 0.6;
  const earL = addShadow(new THREE.Mesh(geo('eEar', () => new THREE.CircleGeometry(0.22, 10)), mat));
  earL.position.set(0.3, 0.6, 0.28);
  earL.rotation.y = 0.5;
  const earR = earL.clone();
  earR.position.z = -0.28;
  earR.rotation.y = -0.5;
  root.add(body, head, trunk, earL, earR);
  root.userData.parts = { body, head, trunk };
  return root;
}

function makeDragon(camp) {
  const root = baseAnimal(camp);
  const mat = bodyMat(camp, { key: 'dragon', color: 0x2f8f6a, ei: 0.5 });
  const segs = [];
  for (let i = 0; i < 5; i++) {
    const seg = addShadow(new THREE.Mesh(geo('drSeg', () => new THREE.SphereGeometry(0.18 - i * 0.015, 10, 8)), mat));
    seg.position.set(-0.35 + i * 0.22, 0.45 + Math.sin(i) * 0.08, 0);
    segs.push(seg);
    root.add(seg);
  }
  const head = addShadow(new THREE.Mesh(geo('drHead', () => new THREE.ConeGeometry(0.18, 0.35, 8)), mat));
  head.rotation.z = -Math.PI / 2;
  head.position.set(0.72, 0.5, 0);
  const hornL = addShadow(new THREE.Mesh(geo('drHorn', () => new THREE.ConeGeometry(0.04, 0.2, 6)), accentMat(camp)));
  hornL.position.set(0.55, 0.72, 0.08);
  const hornR = hornL.clone();
  hornR.position.z = -0.08;
  root.add(head, hornL, hornR);
  root.userData.parts = { body: segs[2], head, segs };
  return root;
}

function makePhoenix(camp) {
  const root = baseAnimal(camp);
  const mat = bodyMat(camp, { key: 'phoenix', color: 0xe85d2a, ei: 0.65 });
  const body = addShadow(new THREE.Mesh(geo('pBody', () => new THREE.SphereGeometry(0.28, 12, 10)), mat));
  body.position.y = 0.55;
  const wingG = geo('pWing', () => new THREE.ConeGeometry(0.18, 0.7, 8));
  const wingL = addShadow(new THREE.Mesh(wingG, accentMat(camp)));
  wingL.rotation.z = Math.PI / 2.2;
  wingL.position.set(-0.35, 0.6, 0);
  const wingR = wingL.clone();
  wingR.rotation.z = -Math.PI / 2.2;
  wingR.position.x = 0.35;
  const crest = addShadow(new THREE.Mesh(geo('pCrest', () => new THREE.ConeGeometry(0.08, 0.25, 6)), accentMat(camp)));
  crest.position.set(0, 0.85, 0);
  root.add(body, wingL, wingR, crest);
  root.userData.parts = { body, wingL, wingR, head: crest };
  return root;
}

function makeWhale(camp) {
  const root = baseAnimal(camp);
  const mat = bodyMat(camp, { key: 'whale', color: 0x3a6a8a, ei: 0.4 });
  const body = addShadow(new THREE.Mesh(geo('whBody', () => new THREE.SphereGeometry(0.38, 14, 10)), mat));
  body.position.y = 0.42;
  body.scale.set(1.6, 0.85, 1);
  const head = addShadow(new THREE.Mesh(geo('whHead', () => new THREE.SphereGeometry(0.26, 12, 10)), mat));
  head.position.set(0.45, 0.4, 0);
  head.scale.set(1.1, 0.9, 1);
  const tail = addShadow(new THREE.Mesh(geo('whTail', () => new THREE.ConeGeometry(0.22, 0.4, 8)), mat));
  tail.rotation.z = Math.PI / 2;
  tail.position.set(-0.55, 0.4, 0);
  const spout = addShadow(new THREE.Mesh(geo('whSpout', () => new THREE.CylinderGeometry(0.04, 0.05, 0.25, 6)), accentMat(camp)));
  spout.position.set(0.35, 0.7, 0);
  root.add(body, head, tail, spout);
  root.userData.parts = { body, head, tail };
  return root;
}

const BUILDERS = {
  MOUSE: makeMouse,
  CAT: makeCat,
  DOG: makeDog,
  WOLF: makeWolf,
  FORTUNE: makeFortune,
  LEOPARD: makeLeopard,
  TIGER: makeTigerFixed,
  LION: makeLion,
  ELEPHANT: makeElephant,
  DRAGON: makeDragon,
  PHOENIX: makePhoenix,
  WHALE: makeWhale
};

export function createCharacter(type, camp) {
  const builder = BUILDERS[type] || makeMouse;
  const mesh = builder(camp);
  mesh.userData.type = type;
  mesh.userData.camp = camp;
  mesh.userData.faceDown = false;
  // Name plate billboard-ish
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = camp === 'RED' ? '#c44536' : '#1a2030';
  ctx.fillRect(16, 8, 96, 48);
  ctx.strokeStyle = '#f0d9a0';
  ctx.lineWidth = 4;
  ctx.strokeRect(16, 8, 96, 48);
  ctx.fillStyle = '#fff6df';
  ctx.font = 'bold 32px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const zh = ({
    WHALE: '鲸', PHOENIX: '凤', DRAGON: '龙', ELEPHANT: '象', LION: '狮', TIGER: '虎',
    LEOPARD: '豹', FORTUNE: '财', WOLF: '狼', DOG: '狗', CAT: '猫', MOUSE: '鼠'
  })[type] || '?';
  ctx.fillText(zh, 64, 34);
  const tex = new THREE.CanvasTexture(canvas);
  const badge = new THREE.Mesh(
    geo('badge', () => new THREE.PlaneGeometry(0.45, 0.22)),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })
  );
  badge.position.set(0.35, 1.05, 0.35);
  badge.name = 'nameBadge';
  mesh.add(badge);
  return mesh;
}

export function createSealedToken(camp) {
  const g = makeSealedPillar(camp || 'BLACK');
  g.userData.faceDown = true;
  g.userData.type = null;
  return g;
}

export function disposeShared() {
  Object.values(GEO).forEach(g => g.dispose && g.dispose());
  Object.values(MAT).forEach(m => m.dispose && m.dispose());
}
