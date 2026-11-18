import * as THREE from 'three';
import { makeGlyphTexture } from '../textures.js';

const GEO = {};
const MAT = {};

const SPIRIT = {
  WHALE: { color: 0x3aa8e0, ei: 0.85 },
  PHOENIX: { color: 0xff5520, ei: 1.0 },
  DRAGON: { color: 0xe0b84a, ei: 0.9 },
  ELEPHANT: { color: 0xc8d0c0, ei: 0.55 },
  LION: { color: 0xf0b030, ei: 0.8 },
  TIGER: { color: 0xe87820, ei: 0.75 },
  LEOPARD: { color: 0x40d0e8, ei: 0.85 },
  JACKAL: { color: 0xd44828, ei: 0.8 },
  WOLF: { color: 0xc8d8e8, ei: 0.7 },
  DOG: { color: 0xd4a060, ei: 0.55 },
  CAT: { color: 0xa060d0, ei: 0.7 },
  MOUSE: { color: 0xa898b0, ei: 0.5 }
};

const ZH = {
  WHALE: '鲸', PHOENIX: '凤', DRAGON: '龙', ELEPHANT: '象', LION: '狮', TIGER: '虎',
  LEOPARD: '豹', JACKAL: '豺', WOLF: '狼', DOG: '狗', CAT: '猫', MOUSE: '鼠'
};

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
  const spirit = SPIRIT[extras.key?.toUpperCase?.()] || SPIRIT[extras.spirit] || null;
  const key = `body_${camp}_${extras.key || 'd'}_spirit`;
  if (!MAT[key]) {
    const col = extras.color || (spirit && spirit.color) || c.primary;
    MAT[key] = new THREE.MeshStandardMaterial({
      color: col,
      emissive: extras.emissive || col,
      emissiveIntensity: extras.ei ?? (spirit ? spirit.ei : 0.55),
      metalness: extras.metalness ?? 0.35,
      roughness: extras.roughness ?? 0.35,
      transparent: true,
      opacity: extras.opacity ?? 0.92
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
  // Flat octagonal seal stamp — short enough that jade grid reads first.
  const g = new THREE.Group();
  g.name = 'sealed';
  const isRed = camp === 'RED';
  const bodyCol = isRed ? 0x6a2a30 : 0x2a3850;
  const emitCol = isRed ? 0x3a1418 : 0x142030;
  const accent = isRed ? 0xffb070 : 0x88d0ff;

  const stone = addShadow(new THREE.Mesh(
    geo('sealBodyFlat', () => new THREE.CylinderGeometry(0.34, 0.36, 0.26, 8)),
    new THREE.MeshStandardMaterial({
      color: bodyCol,
      emissive: emitCol,
      emissiveIntensity: 0.28,
      roughness: 0.5,
      metalness: 0.42
    })
  ));
  stone.position.y = 0.15;

  const lid = addShadow(new THREE.Mesh(
    geo('sealLid', () => new THREE.CylinderGeometry(0.3, 0.32, 0.06, 8)),
    new THREE.MeshStandardMaterial({
      color: bodyCol,
      emissive: emitCol,
      emissiveIntensity: 0.25,
      roughness: 0.4,
      metalness: 0.5
    })
  ));
  lid.position.y = 0.3;

  const rune = new THREE.Mesh(
    geo('sealRuneTop', () => new THREE.TorusGeometry(0.15, 0.022, 6, 20)),
    new THREE.MeshStandardMaterial({
      color: accent,
      emissive: accent,
      emissiveIntensity: 0.5,
      metalness: 0.6,
      roughness: 0.3
    })
  );
  rune.rotation.x = Math.PI / 2;
  rune.position.y = 0.34;

  const padTex = new THREE.CanvasTexture(makeGlyphTexture('封', isRed ? '#ffb070' : '#88d0ff'));
  padTex.colorSpace = THREE.SRGBColorSpace;
  const pad = new THREE.Mesh(
    geo('sealPad', () => new THREE.CircleGeometry(0.38, 20)),
    new THREE.MeshBasicMaterial({
      map: padTex,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );
  pad.rotation.x = -Math.PI / 2;
  pad.position.y = 0.02;

  const ring = new THREE.Mesh(
    geo('sealAura', () => new THREE.TorusGeometry(0.4, 0.022, 6, 20)),
    new THREE.MeshBasicMaterial({
      color: accent,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.03;

  g.add(stone, lid, rune, pad, ring);
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

function makeJackal(camp) {
  const root = baseAnimal(camp);
  const mat = bodyMat(camp, { key: 'jackal', spirit: 'JACKAL', color: 0xd44828, ei: 0.85 });
  const body = addShadow(new THREE.Mesh(geo('jBody', () => new THREE.CapsuleGeometry(0.22, 0.4, 6, 10)), mat));
  body.position.y = 0.42;
  body.rotation.z = Math.PI / 2;
  body.scale.set(1, 0.9, 0.85);
  const head = addShadow(new THREE.Mesh(geo('jHead', () => new THREE.SphereGeometry(0.2, 10, 8)), mat));
  head.position.set(0.4, 0.52, 0);
  head.scale.set(1.05, 0.9, 0.85);
  const snout = addShadow(new THREE.Mesh(geo('jSnout', () => new THREE.ConeGeometry(0.09, 0.28, 8)), mat));
  snout.rotation.z = -Math.PI / 2;
  snout.position.set(0.62, 0.46, 0);
  const earGeo = geo('jEar', () => new THREE.ConeGeometry(0.07, 0.22, 6));
  const earL = addShadow(new THREE.Mesh(earGeo, mat));
  earL.position.set(0.32, 0.74, 0.1);
  const earR = earL.clone();
  earR.position.z = -0.1;
  const mane = addShadow(new THREE.Mesh(
    geo('jMane', () => new THREE.TorusGeometry(0.16, 0.045, 6, 12)),
    bodyMat(camp, { key: 'jmane', color: 0x8a2818, ei: 0.5 })
  ));
  mane.position.set(0.28, 0.5, 0);
  mane.rotation.y = Math.PI / 2;
  const tail = addShadow(new THREE.Mesh(geo('jTail', () => new THREE.ConeGeometry(0.08, 0.4, 6)), mat));
  tail.position.set(-0.4, 0.45, 0);
  tail.rotation.z = Math.PI / 2.5;
  root.add(body, head, snout, earL, earR, mane, tail);
  root.userData.parts = { body, head, tail };
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
  JACKAL: makeJackal,
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

  const spirit = SPIRIT[type] || SPIRIT.MOUSE;
  const hex = '#' + spirit.color.toString(16).padStart(6, '0');
  const tex = new THREE.CanvasTexture(makeGlyphTexture(ZH[type] || '?', hex));
  tex.colorSpace = THREE.SRGBColorSpace;
  const pad = new THREE.Mesh(
    geo('glyphPad', () => new THREE.CircleGeometry(0.38, 24)),
    new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );
  pad.rotation.x = -Math.PI / 2;
  pad.position.y = 0.04;
  pad.name = 'nameBadge';
  mesh.add(pad);

  // soft aura ring
  const ring = new THREE.Mesh(
    geo('auraRing', () => new THREE.TorusGeometry(0.42, 0.03, 6, 24)),
    new THREE.MeshBasicMaterial({
      color: spirit.color,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.06;
  mesh.add(ring);

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
