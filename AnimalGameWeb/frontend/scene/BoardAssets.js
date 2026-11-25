import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const FILES = {
  platform: 'board-platform.glb',
  surface: 'board-surface.glb'
};

const templates = new Map();
const sources = new Map();
let preloadPromise = null;

function modelsBaseUrl() {
  const base = new URL('.', window.location.href);
  return new URL('assets/models/', base).href;
}

function prepareScene(scene) {
  scene.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    mats.forEach((m) => {
      if (!m) return;
      if ('envMapIntensity' in m) m.envMapIntensity = 1.1;
      if (m.map) m.map.colorSpace = THREE.SRGBColorSpace;
      m.needsUpdate = true;
    });
  });
  return scene;
}

/**
 * Fit model so its max horizontal span matches targetSpan (XZ), keep Y proportional.
 * @param {'bottom'|'top'} alignY - bottom: place bbox.min.y at groundY; top: place bbox.max.y at groundY
 */
export function fitBoardAsset(root, { targetSpan = 22, groundY = -0.02, alignY = 'bottom' } = {}) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  box.getSize(size);
  const span = Math.max(size.x, size.z, 1e-4);
  const s = targetSpan / span;
  root.scale.multiplyScalar(s);
  root.updateMatrixWorld(true);
  const box2 = new THREE.Box3().setFromObject(root);
  const center = new THREE.Vector3();
  box2.getCenter(center);
  root.position.x -= center.x;
  root.position.z -= center.z;
  if (alignY === 'top') {
    root.position.y += groundY - box2.max.y;
  } else {
    root.position.y += groundY - box2.min.y;
  }
  return root;
}

export function preloadBoardModels() {
  if (preloadPromise) return preloadPromise;
  const loader = new GLTFLoader();
  const draco = new DRACOLoader();
  draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
  loader.setDRACOLoader(draco);
  loader.setMeshoptDecoder(MeshoptDecoder);
  const base = modelsBaseUrl();
  preloadPromise = Promise.all(
    Object.entries(FILES).map(async ([key, file]) => {
      try {
        const gltf = await loader.loadAsync(`${base}${file}`);
        const scene = gltf.scene || gltf.scenes?.[0];
        if (!scene) throw new Error('empty gltf');
        templates.set(key, prepareScene(scene));
        sources.set(key, 'glb');
      } catch (err) {
        console.warn(`[board] GLB load failed for ${key}, keep procedural`, err?.message || err);
        sources.set(key, 'procedural');
      }
    })
  ).then(() => sources);
  return preloadPromise;
}

export function getBoardSource(key) {
  return sources.get(key) || 'procedural';
}

export function cloneBoardAsset(key) {
  const tpl = templates.get(key);
  if (!tpl) return null;
  return tpl.clone(true);
}
