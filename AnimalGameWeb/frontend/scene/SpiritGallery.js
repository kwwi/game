import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import {
  createCharacter,
  preloadSpiritModels,
  SPIRIT_TYPES,
  ZH,
  getSpiritLoadSource
} from './pieces/CharacterFactory.js';

const COLS = 4;
const ROWS = 3;
const SPACING = 2.15;

export async function bootSpiritGallery(rootEl) {
  const statusEl = document.getElementById('galleryStatus');
  const setStatus = (t) => { if (statusEl) statusEl.textContent = t; };

  setStatus('加载灵兽 GLB…');
  const sources = await preloadSpiritModels();

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setSize(rootEl.clientWidth, rootEl.clientHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = true;
  renderer.domElement.className = 'webgl-canvas';
  rootEl.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a1228);
  scene.fog = new THREE.FogExp2(0x122040, 0.035);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 80);
  camera.position.set(0, 7.2, 9.5);
  camera.lookAt(0, 0.4, 0);

  // Stronger lighting for Hyper3D PBR materials
  scene.add(new THREE.HemisphereLight(0xfff0dd, 0x203048, 1.15));
  const key = new THREE.DirectionalLight(0xffe2b8, 2.2);
  key.position.set(5, 12, 7);
  key.castShadow = true;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xa8c8ff, 0.85);
  fill.position.set(-6, 6, -4);
  scene.add(fill);
  scene.add(new THREE.PointLight(0xffc080, 1.1, 28, 2).translateY(5));
  scene.add(new THREE.AmbientLight(0x406080, 0.45));
  renderer.toneMappingExposure = 1.35;

  // Stage
  const stage = new THREE.Mesh(
    new THREE.CylinderGeometry(7.2, 7.5, 0.35, 8),
    new THREE.MeshStandardMaterial({
      color: 0x1e3a32,
      roughness: 0.5,
      metalness: 0.3,
      emissive: 0x0a2018,
      emissiveIntensity: 0.25
    })
  );
  stage.position.y = -0.2;
  stage.receiveShadow = true;
  scene.add(stage);

  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(7.25, 0.08, 8, 8),
    new THREE.MeshStandardMaterial({
      color: 0xc9a45c,
      emissive: 0x664410,
      emissiveIntensity: 0.6,
      metalness: 0.7,
      roughness: 0.3
    })
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.02;
  scene.add(rim);

  const root = new THREE.Group();
  scene.add(root);

  const order = SPIRIT_TYPES;
  const avatars = [];
  order.forEach((type, i) => {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const x = (col - (COLS - 1) / 2) * SPACING;
    const z = (row - (ROWS - 1) / 2) * SPACING;
    // Alternate camps so both aura colors show
    const camp = (i % 2 === 0) ? 'RED' : 'BLACK';
    const mesh = createCharacter(type, camp);
    mesh.position.set(x, 0.05, z);
    root.add(mesh);

    // Tile under each spirit
    const tile = new THREE.Mesh(
      new THREE.BoxGeometry(1.05, 0.08, 1.05),
      new THREE.MeshStandardMaterial({
        color: i % 2 === 0 ? 0x2a6a54 : 0x8a6030,
        roughness: 0.45,
        metalness: 0.28,
        emissive: i % 2 === 0 ? 0x143828 : 0x3a2410,
        emissiveIntensity: 0.25
      })
    );
    tile.position.set(x, -0.02, z);
    tile.receiveShadow = true;
    root.add(tile);

    avatars.push({ mesh, type, camp, phase: i * 0.4 });
  });

  const size = new THREE.Vector2(rootEl.clientWidth, rootEl.clientHeight);
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(size, 0.58, 0.5, 0.84));

  function resize() {
    const w = rootEl.clientWidth || window.innerWidth;
    const h = rootEl.clientHeight || window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
  }
  window.addEventListener('resize', resize);
  resize();

  const clock = new THREE.Clock();
  let t = 0;
  function tick() {
    requestAnimationFrame(tick);
    const dt = Math.min(0.05, clock.getDelta());
    t += dt;
    root.rotation.y = Math.sin(t * 0.15) * 0.08;
    avatars.forEach((a) => {
      a.mesh.position.y = 0.05 + Math.sin(t * 1.2 + a.phase) * 0.04;
      a.mesh.rotation.y = Math.sin(t * 0.6 + a.phase) * 0.15;
    });
    composer.render();
  }
  tick();

  const glbCount = order.filter((ty) => getSpiritLoadSource(ty) === 'glb').length;
  const labels = order.map((ty) => `${ZH[ty]}(${getSpiritLoadSource(ty) === 'glb' ? 'GLB' : '回退'})`).join(' · ');
  setStatus(`灵兽展示 · ${glbCount}/${order.length} GLB · ${labels}`);
  void sources;

  const api = { scene, camera, renderer, avatars };
  window.__spiritGallery = api;
  return api;
}
