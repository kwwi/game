/**
 * AI-authored low-poly spirit animals → GLB for AnimalGameWeb.
 * Silhouettes/colors follow the celestial board reference art.
 */
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Blob as NodeBlob } from 'buffer';

if (!globalThis.Blob) globalThis.Blob = NodeBlob;
if (!globalThis.FileReader) {
  globalThis.FileReader = class FileReader {
    constructor() {
      this.result = null;
      this.onload = null;
      this.onloadend = null;
      this.onerror = null;
    }
    readAsArrayBuffer(blob) {
      Promise.resolve(blob.arrayBuffer()).then((buf) => {
        this.result = buf;
        this.onload?.({ target: this });
        this.onloadend?.({ target: this });
      }).catch((e) => this.onerror?.(e));
    }
  };
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, '../../frontend/assets/models');

function mat(color, ei = 0.55, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    emissive: opts.emissive ?? color,
    emissiveIntensity: ei,
    metalness: opts.metalness ?? 0.35,
    roughness: opts.roughness ?? 0.4,
    transparent: opts.opacity != null,
    opacity: opts.opacity ?? 1
  });
}

function add(parent, geo, material, pos = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1]) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(...pos);
  m.rotation.set(...rot);
  m.scale.set(...scale);
  m.castShadow = true;
  parent.add(m);
  return m;
}

function finalize(root) {
  // Center XZ, plant on y=0, normalize height ~0.95
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  root.position.x -= center.x;
  root.position.z -= center.z;
  root.position.y -= box.min.y;
  root.updateMatrixWorld(true);
  const box2 = new THREE.Box3().setFromObject(root);
  const h = box2.max.y - box2.min.y || 1;
  const s = 0.95 / h;
  root.scale.setScalar(s);
  root.updateMatrixWorld(true);
  // re-plant after scale
  const box3 = new THREE.Box3().setFromObject(root);
  root.position.y -= box3.min.y;
  return root;
}

function makeWhale() {
  const g = new THREE.Group();
  const m = mat(0x3aa8e0, 0.85);
  const accent = mat(0x88e8ff, 1.0);
  add(g, new THREE.SphereGeometry(0.42, 16, 12), m, [0, 0.45, 0], [0, 0, 0], [1.7, 0.85, 1]);
  add(g, new THREE.SphereGeometry(0.28, 14, 12), m, [0.55, 0.42, 0], [0, 0, 0], [1.15, 0.9, 1]);
  add(g, new THREE.ConeGeometry(0.26, 0.45, 10), m, [-0.7, 0.42, 0], [0, 0, Math.PI / 2]);
  // fluke
  add(g, new THREE.BoxGeometry(0.08, 0.35, 0.55), accent, [-0.95, 0.42, 0], [0, 0, 0.2]);
  // spout spray
  add(g, new THREE.CylinderGeometry(0.04, 0.07, 0.35, 8), accent, [0.4, 0.85, 0]);
  add(g, new THREE.SphereGeometry(0.12, 10, 8), accent, [0.4, 1.05, 0], [0, 0, 0], [1.4, 0.7, 1.4]);
  return finalize(g);
}

function makePhoenix() {
  const g = new THREE.Group();
  const m = mat(0xff5520, 1.0);
  const wing = mat(0xffaa40, 0.95);
  const crest = mat(0xffe080, 1.1);
  add(g, new THREE.SphereGeometry(0.26, 14, 12), m, [0, 0.55, 0], [0, 0, 0], [0.95, 1.1, 0.9]);
  add(g, new THREE.SphereGeometry(0.16, 12, 10), m, [0, 0.78, 0.12]);
  add(g, new THREE.ConeGeometry(0.2, 0.85, 8), wing, [-0.45, 0.65, 0], [0, 0, Math.PI / 2.1], [1, 1, 0.35]);
  add(g, new THREE.ConeGeometry(0.2, 0.85, 8), wing, [0.45, 0.65, 0], [0, 0, -Math.PI / 2.1], [1, 1, 0.35]);
  add(g, new THREE.ConeGeometry(0.1, 0.7, 6), m, [0, 0.35, -0.35], [0.9, 0, 0]);
  add(g, new THREE.ConeGeometry(0.07, 0.55, 6), wing, [-0.08, 0.3, -0.45], [1.0, 0, 0.2]);
  add(g, new THREE.ConeGeometry(0.07, 0.55, 6), wing, [0.08, 0.3, -0.45], [1.0, 0, -0.2]);
  add(g, new THREE.ConeGeometry(0.08, 0.28, 6), crest, [0, 1.0, 0.05]);
  return finalize(g);
}

function makeDragon() {
  const g = new THREE.Group();
  const m = mat(0xc8b040, 0.9, { emissive: 0x6a9020 });
  const accent = mat(0xffe080, 0.85);
  const segs = 7;
  for (let i = 0; i < segs; i++) {
    const t = i / (segs - 1);
    const y = 0.35 + Math.sin(t * Math.PI) * 0.55;
    const x = -0.55 + t * 1.15;
    const r = 0.2 - t * 0.08;
    add(g, new THREE.SphereGeometry(r, 12, 10), m, [x, y, Math.sin(t * 4) * 0.08]);
  }
  add(g, new THREE.ConeGeometry(0.18, 0.4, 8), m, [0.72, 0.85, 0], [0, 0, -Math.PI / 2]);
  add(g, new THREE.ConeGeometry(0.045, 0.22, 6), accent, [0.55, 1.1, 0.1]);
  add(g, new THREE.ConeGeometry(0.045, 0.22, 6), accent, [0.55, 1.1, -0.1]);
  add(g, new THREE.SphereGeometry(0.14, 10, 8), accent, [0.1, 0.95, 0], [0, 0, 0], [1.6, 0.5, 0.8]);
  return finalize(g);
}

function makeElephant() {
  const g = new THREE.Group();
  const m = mat(0xc8d0c0, 0.5, { roughness: 0.55 });
  const tusk = mat(0xf0e8d0, 0.35);
  add(g, new THREE.SphereGeometry(0.45, 16, 14), m, [0, 0.55, 0], [0, 0, 0], [1.2, 1, 1.35]);
  add(g, new THREE.SphereGeometry(0.3, 14, 12), m, [0.45, 0.62, 0]);
  add(g, new THREE.CylinderGeometry(0.07, 0.11, 0.65, 10), m, [0.7, 0.28, 0], [0, 0, 0.55]);
  add(g, new THREE.CircleGeometry(0.28, 12), m, [0.35, 0.7, 0.32], [0, 0.6, 0]);
  add(g, new THREE.CircleGeometry(0.28, 12), m, [0.35, 0.7, -0.32], [0, -0.6, 0]);
  add(g, new THREE.CylinderGeometry(0.035, 0.045, 0.35, 8), tusk, [0.55, 0.4, 0.12], [0, 0, 1.1]);
  add(g, new THREE.CylinderGeometry(0.035, 0.045, 0.35, 8), tusk, [0.55, 0.4, -0.12], [0, 0, 1.1]);
  // legs
  for (const z of [-0.22, 0.22]) {
    for (const x of [-0.2, 0.15]) {
      add(g, new THREE.CylinderGeometry(0.09, 0.1, 0.35, 8), m, [x, 0.18, z]);
    }
  }
  return finalize(g);
}

function makeLion() {
  const g = new THREE.Group();
  const m = mat(0xf0b030, 0.8);
  const mane = mat(0xc87818, 0.7);
  add(g, new THREE.CapsuleGeometry(0.28, 0.35, 6, 12), m, [0, 0.45, 0], [0, 0, Math.PI / 2]);
  add(g, new THREE.SphereGeometry(0.26, 14, 12), m, [0.42, 0.62, 0]);
  add(g, new THREE.TorusGeometry(0.3, 0.14, 10, 18), mane, [0.38, 0.62, 0], [0, Math.PI / 2, 0]);
  add(g, new THREE.SphereGeometry(0.12, 10, 8), mane, [0.38, 0.62, 0], [0, 0, 0], [1.5, 1.5, 0.8]);
  add(g, new THREE.ConeGeometry(0.08, 0.28, 6), m, [-0.4, 0.4, 0], [0, 0, Math.PI / 2.5]);
  return finalize(g);
}

function makeTiger() {
  const g = new THREE.Group();
  const m = mat(0xe87820, 0.75);
  const stripe = mat(0x1a1008, 0.15, { emissive: 0x000000 });
  add(g, new THREE.CapsuleGeometry(0.26, 0.45, 6, 12), m, [0, 0.42, 0], [0, 0, Math.PI / 2]);
  add(g, new THREE.SphereGeometry(0.24, 14, 12), m, [0.48, 0.52, 0]);
  for (let i = 0; i < 5; i++) {
    add(g, new THREE.BoxGeometry(0.05, 0.32, 0.38), stripe, [-0.25 + i * 0.12, 0.48, 0]);
  }
  add(g, new THREE.ConeGeometry(0.09, 0.2, 6), m, [0.4, 0.78, 0.12]);
  add(g, new THREE.ConeGeometry(0.09, 0.2, 6), m, [0.4, 0.78, -0.12]);
  add(g, new THREE.ConeGeometry(0.08, 0.4, 6), m, [-0.5, 0.4, 0], [0, 0, Math.PI / 2.3]);
  return finalize(g);
}

function makeLeopard() {
  const g = new THREE.Group();
  const m = mat(0x40d0e8, 0.85);
  const spot = mat(0x1a4050, 0.4);
  add(g, new THREE.CapsuleGeometry(0.22, 0.48, 6, 12), m, [0, 0.4, 0], [0, 0, Math.PI / 2]);
  add(g, new THREE.SphereGeometry(0.2, 12, 10), m, [0.48, 0.48, 0]);
  for (let i = 0; i < 8; i++) {
    add(g, new THREE.SphereGeometry(0.035, 6, 6), spot, [
      -0.25 + (i % 4) * 0.14,
      0.48 + (i > 3 ? 0.06 : 0),
      -0.12 + (i % 2) * 0.2
    ]);
  }
  add(g, new THREE.ConeGeometry(0.06, 0.5, 6), m, [-0.45, 0.55, 0], [0.4, 0, Math.PI / 2.5]);
  // raised paw
  add(g, new THREE.CapsuleGeometry(0.05, 0.18, 4, 8), m, [0.25, 0.55, 0.22], [0.6, 0, 0.3]);
  return finalize(g);
}

function makeJackal() {
  const g = new THREE.Group();
  const m = mat(0xd44828, 0.85);
  const dark = mat(0x8a2818, 0.55);
  add(g, new THREE.CapsuleGeometry(0.2, 0.42, 6, 12), m, [0, 0.4, 0], [0, 0, Math.PI / 2], [1, 0.9, 0.85]);
  add(g, new THREE.SphereGeometry(0.18, 12, 10), m, [0.42, 0.52, 0], [0, 0, 0], [1.1, 0.9, 0.85]);
  add(g, new THREE.ConeGeometry(0.08, 0.3, 8), m, [0.68, 0.45, 0], [0, 0, -Math.PI / 2]);
  add(g, new THREE.ConeGeometry(0.06, 0.24, 6), m, [0.35, 0.78, 0.1]);
  add(g, new THREE.ConeGeometry(0.06, 0.24, 6), m, [0.35, 0.78, -0.1]);
  add(g, new THREE.TorusGeometry(0.14, 0.04, 6, 12), dark, [0.28, 0.5, 0], [0, Math.PI / 2, 0]);
  add(g, new THREE.ConeGeometry(0.08, 0.42, 6), m, [-0.42, 0.42, 0], [0, 0, Math.PI / 2.4]);
  return finalize(g);
}

function makeWolf() {
  const g = new THREE.Group();
  const m = mat(0xc8d8e8, 0.7);
  const mane = mat(0x8898b0, 0.45);
  add(g, new THREE.CapsuleGeometry(0.24, 0.4, 6, 12), m, [0, 0.42, 0], [0, 0, Math.PI / 2]);
  add(g, new THREE.SphereGeometry(0.2, 12, 10), m, [0.42, 0.58, 0]);
  add(g, new THREE.ConeGeometry(0.07, 0.22, 8), m, [0.62, 0.52, 0], [0, 0, -Math.PI / 2]);
  add(g, new THREE.ConeGeometry(0.07, 0.22, 6), m, [0.35, 0.82, 0.1]);
  add(g, new THREE.ConeGeometry(0.07, 0.22, 6), m, [0.35, 0.82, -0.1]);
  add(g, new THREE.TorusGeometry(0.16, 0.05, 6, 12), mane, [0.3, 0.55, 0], [0, Math.PI / 2, 0]);
  // howl tilt
  g.rotation.z = 0.12;
  return finalize(g);
}

function makeDog() {
  const g = new THREE.Group();
  const m = mat(0xd4a060, 0.55);
  add(g, new THREE.CapsuleGeometry(0.26, 0.32, 6, 12), m, [0, 0.4, 0], [0, 0, Math.PI / 2]);
  add(g, new THREE.SphereGeometry(0.22, 12, 10), m, [0.4, 0.5, 0]);
  add(g, new THREE.CylinderGeometry(0.07, 0.1, 0.2, 8), m, [0.58, 0.42, 0], [0, 0, Math.PI / 2]);
  // floppy ears
  add(g, new THREE.BoxGeometry(0.08, 0.22, 0.12), m, [0.32, 0.55, 0.16], [0.5, 0, 0.2]);
  add(g, new THREE.BoxGeometry(0.08, 0.22, 0.12), m, [0.32, 0.55, -0.16], [0.5, 0, -0.2]);
  add(g, new THREE.ConeGeometry(0.07, 0.28, 6), m, [-0.35, 0.35, 0], [0.3, 0, Math.PI / 2.2]);
  return finalize(g);
}

function makeCat() {
  const g = new THREE.Group();
  const m = mat(0xa060d0, 0.7);
  add(g, new THREE.SphereGeometry(0.32, 14, 12), m, [0, 0.4, 0], [0, 0, 0], [1, 0.95, 1.2]);
  add(g, new THREE.SphereGeometry(0.22, 12, 10), m, [0, 0.62, 0.22]);
  add(g, new THREE.ConeGeometry(0.09, 0.18, 6), m, [-0.12, 0.82, 0.2]);
  add(g, new THREE.ConeGeometry(0.09, 0.18, 6), m, [0.12, 0.82, 0.2]);
  // curled tail
  add(g, new THREE.TorusGeometry(0.18, 0.04, 6, 14, Math.PI * 1.3), m, [0.05, 0.45, -0.35], [Math.PI / 2, 0.4, 0]);
  return finalize(g);
}

function makeMouse() {
  const g = new THREE.Group();
  const m = mat(0xa898b0, 0.5);
  const ear = mat(0xc8b8d0, 0.4);
  add(g, new THREE.SphereGeometry(0.3, 14, 12), m, [0, 0.35, 0], [0, 0, 0], [1.15, 0.85, 1.3]);
  add(g, new THREE.SphereGeometry(0.2, 12, 10), m, [0, 0.42, 0.28]);
  add(g, new THREE.CircleGeometry(0.12, 12), ear, [-0.16, 0.58, 0.22], [0, 0.3, 0]);
  add(g, new THREE.CircleGeometry(0.12, 12), ear, [0.16, 0.58, 0.22], [0, -0.3, 0]);
  add(g, new THREE.CylinderGeometry(0.025, 0.02, 0.65, 6), m, [0.3, 0.28, -0.25], [0, 0, Math.PI / 2.3]);
  return finalize(g);
}

const BUILDERS = {
  whale: makeWhale,
  phoenix: makePhoenix,
  dragon: makeDragon,
  elephant: makeElephant,
  lion: makeLion,
  tiger: makeTiger,
  leopard: makeLeopard,
  jackal: makeJackal,
  wolf: makeWolf,
  dog: makeDog,
  cat: makeCat,
  mouse: makeMouse
};

function exportGlb(root) {
  return new Promise((resolve, reject) => {
    const exporter = new GLTFExporter();
    exporter.parse(
      root,
      (result) => resolve(Buffer.from(result)),
      (err) => reject(err),
      { binary: true }
    );
  });
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  for (const [name, build] of Object.entries(BUILDERS)) {
    const root = build();
    const buf = await exportGlb(root);
    const dest = path.join(OUT, `${name}.glb`);
    fs.writeFileSync(dest, buf);
    console.log('wrote', dest, buf.length, 'bytes');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
