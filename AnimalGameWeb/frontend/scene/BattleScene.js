import * as THREE from 'three';
import { createCharacter, createSealedToken, preloadSpiritModels } from './pieces/CharacterFactory.js';
import { tickIdle, playSelect, playDeselect, playMove, playAttackLunge, ANIM_MS } from './pieces/anims.js';
import { playExit, pulseScreenFlash } from './pieces/exits.js';
import { makeNoiseCanvas, makeSkyGradientCanvas, makeNebulaCanvas, makeSoftCircleSprite } from './textures.js';
import { preloadBoardModels, cloneBoardAsset, fitBoardAsset, getBoardSource } from './BoardAssets.js';

const CELL = 1.15;
const GAP = 0.08;
const BASE_Y = 0.22;
const BOARD_SPAN = 8 * CELL + 7 * GAP;
const PLATFORM_SPAN = BOARD_SPAN + 8.5;

function cellCenter(r, c, rows, cols) {
  const w = cols * CELL + (cols - 1) * GAP;
  const h = rows * CELL + (rows - 1) * GAP;
  const x = (c - 1) * (CELL + GAP) - w / 2 + CELL / 2;
  const z = (r - 1) * (CELL + GAP) - h / 2 + CELL / 2;
  return new THREE.Vector3(x, BASE_Y, z);
}

export class BattleScene {
  constructor({ reduceMotion = false, onCellAction, onHoverCell } = {}) {
    this.reduceMotion = reduceMotion;
    this.onCellAction = onCellAction || (() => {});
    this.onHoverCell = onHoverCell || (() => {});
    this.interactive = false;
    this.rows = 7;
    this.cols = 8;
    this.avatars = new Map();
    this.cellMeshes = new Map();
    this.selectedId = null;
    this._t = 0;
    this._drag = null;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x122040, 0.012);
    this.scene.background = new THREE.Color(0x0c1630);

    this.camera = new THREE.PerspectiveCamera(46, 1, 0.1, 260);
    this.resetCamera();

    this.root = new THREE.Group();
    this.scene.add(this.root);
    this.piecesRoot = new THREE.Group();
    this.root.add(this.piecesRoot);

    this.fxOverlay = document.getElementById('battleFxOverlay');

    this._buildSkyAndClouds();
    this._buildLights();
    this._buildArenaDecor();
    this._buildBoard(this.rows, this.cols);
    this._bindPointer();
  }

  setHandlers({ onCellAction, onHoverCell } = {}) {
    if (onCellAction) this.onCellAction = onCellAction;
    if (onHoverCell) this.onHoverCell = onHoverCell;
  }

  getDefaultCamera() {
    return { x: 0.8, y: 12.5, z: 13.2 };
  }

  resetCamera() {
    const d = this.getDefaultCamera();
    this.camera.position.set(d.x, d.y, d.z);
    this.camera.lookAt(0, 0.4, 0);
  }

  _buildSkyAndClouds() {
    const skyTex = new THREE.CanvasTexture(makeSkyGradientCanvas());
    skyTex.colorSpace = THREE.SRGBColorSpace;
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(120, 28, 18),
      new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, depthWrite: false })
    );
    this.scene.add(sky);

    const starN = this.reduceMotion ? 50 : 110;
    const starPos = new Float32Array(starN * 3);
    for (let i = 0; i < starN; i++) {
      const th = Math.random() * Math.PI * 2;
      const ph = Math.random() * 0.85;
      starPos[i * 3] = Math.sin(ph) * Math.cos(th) * 90;
      starPos[i * 3 + 1] = 22 + Math.cos(ph) * 48;
      starPos[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * 90;
    }
    this.scene.add(new THREE.Points(
      new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(starPos, 3)),
      new THREE.PointsMaterial({ color: 0xe8f0ff, size: 0.35, transparent: true, opacity: 0.75, depthWrite: false })
    ));

    // Horizontal nebula bands (additive soft blotches)
    const nebulaTex = new THREE.CanvasTexture(makeNebulaCanvas(256));
    nebulaTex.colorSpace = THREE.SRGBColorSpace;
    this.nebula = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const band = new THREE.Mesh(
        new THREE.PlaneGeometry(90 + i * 12, 28 + i * 6),
        new THREE.MeshBasicMaterial({
          map: nebulaTex,
          transparent: true,
          opacity: 0.22 - i * 0.04,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide
        })
      );
      band.position.set((i - 1) * 8, 14 + i * 3, -55 - i * 8);
      band.rotation.y = (i - 1) * 0.25;
      this.nebula.add(band);
    }
    this.scene.add(this.nebula);

    // Soft cloud sea — flat additive discs, dual slow spin
    const softTex = new THREE.CanvasTexture(makeSoftCircleSprite(128));
    softTex.colorSpace = THREE.SRGBColorSpace;
    const cloudMatA = new THREE.MeshBasicMaterial({
      map: softTex,
      color: 0xd8ecf8,
      transparent: true,
      opacity: 0.48,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending
    });
    const cloudMatB = new THREE.MeshBasicMaterial({
      map: softTex,
      color: 0xb0d0e8,
      transparent: true,
      opacity: 0.36,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending
    });
    this.clouds = new THREE.Group();
    this.cloudsB = new THREE.Group();
    const nCloud = this.reduceMotion ? 12 : 22;
    for (let i = 0; i < nCloud; i++) {
      const mat = i % 2 === 0 ? cloudMatA : cloudMatB;
      const c = new THREE.Mesh(new THREE.PlaneGeometry(16 + (i % 4) * 4, 10 + (i % 3) * 3), mat);
      c.rotation.x = -Math.PI / 2;
      c.position.set(
        ((i % 7) - 3) * 8 + (i % 3) * 1.4,
        -10.5 + (i % 5) * 0.55,
        -6 + Math.floor(i / 7) * 9 - (i % 4) * 1.5
      );
      (i < nCloud / 2 ? this.clouds : this.cloudsB).add(c);
    }
    this.scene.add(this.clouds, this.cloudsB);

    // Distant soft mountain silhouettes (low contrast, pushed back)
    const peakMat = new THREE.MeshBasicMaterial({
      color: 0x152038,
      transparent: true,
      opacity: 0.55,
      depthWrite: false
    });
    for (let i = 0; i < 5; i++) {
      const peak = new THREE.Mesh(new THREE.ConeGeometry(5 + (i % 2) * 2, 8 + i * 0.8, 4), peakMat);
      peak.position.set(-28 + i * 14, -4.5, -62 - (i % 2) * 6);
      this.scene.add(peak);
      if (i % 2 === 0) {
        const pagoda = new THREE.Group();
        const stone = new THREE.MeshBasicMaterial({ color: 0x1a2438, transparent: true, opacity: 0.5 });
        const warm = new THREE.MeshStandardMaterial({
          color: 0xffc070,
          emissive: 0xff9940,
          emissiveIntensity: 0.7
        });
        for (let t = 0; t < 2; t++) {
          const tier = new THREE.Mesh(new THREE.BoxGeometry(1.1 - t * 0.2, 0.45, 1.1 - t * 0.2), stone);
          tier.position.y = t * 0.55;
          pagoda.add(tier);
          const roof = new THREE.Mesh(new THREE.ConeGeometry(0.85 - t * 0.12, 0.32, 4), warm);
          roof.position.y = t * 0.55 + 0.28;
          pagoda.add(roof);
        }
        pagoda.position.copy(peak.position);
        pagoda.position.y = 1.5;
        pagoda.scale.setScalar(0.75);
        this.scene.add(pagoda);
      }
    }
  }

  _buildLights() {
    this.scene.add(new THREE.HemisphereLight(0xffe8c8, 0x101828, 0.62));
    const key = new THREE.DirectionalLight(0xffd4a0, 1.25);
    key.position.set(7, 15, 9);
    key.castShadow = !this.reduceMotion;
    if (key.castShadow) {
      key.shadow.mapSize.set(1024, 1024);
      key.shadow.camera.near = 2;
      key.shadow.camera.far = 50;
      key.shadow.camera.left = -14;
      key.shadow.camera.right = 14;
      key.shadow.camera.top = 14;
      key.shadow.camera.bottom = -14;
    }
    this.scene.add(key);
    // Soft cool fill (much weaker than before)
    const fill = new THREE.PointLight(0x6ab0d8, 0.35, 28, 2);
    fill.position.set(-8, 5, -4);
    this.scene.add(fill);
    const rim = new THREE.PointLight(0xffa070, 0.4, 22, 2);
    rim.position.set(5, 3.5, 6);
    this.scene.add(rim);
    const under = new THREE.PointLight(0x4060a0, 0.25, 20, 2);
    under.position.set(0, -4, 0);
    this.scene.add(under);
  }

  _buildArenaDecor() {
    this.platformRoot = new THREE.Group();
    this.root.add(this.platformRoot);
    this._useGlbPlatform = false;

    // Soft underside glow (kept with both procedural + GLB platform)
    const underGlow = new THREE.Mesh(
      new THREE.TorusGeometry(10.2, 0.35, 8, 32),
      new THREE.MeshBasicMaterial({
        color: 0x88c8ff,
        transparent: true,
        opacity: 0.35,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    underGlow.rotation.x = Math.PI / 2;
    underGlow.position.y = -1.15;
    this.platformRoot.add(underGlow);

    // Prefer Tripo GLB platform; fall back to procedural octagon stack
    const glb = cloneBoardAsset('platform');
    if (glb) {
      // Align platform TOP under the playable grid (cells sit near y≈0)
      fitBoardAsset(glb, { targetSpan: PLATFORM_SPAN, groundY: -0.08, alignY: 'top' });
      this.platformRoot.add(glb);
      this._useGlbPlatform = true;
      return;
    }

    const jadeTex = new THREE.CanvasTexture(makeNoiseCanvas(256, {
      base: [22, 48, 40],
      variance: 26,
      crack: true,
      goldVeins: true
    }));
    jadeTex.colorSpace = THREE.SRGBColorSpace;
    const jadeMat = new THREE.MeshStandardMaterial({
      map: jadeTex,
      color: 0x2a5a48,
      roughness: 0.48,
      metalness: 0.28,
      emissive: 0x102820,
      emissiveIntensity: 0.28
    });
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xd4b060,
      emissive: 0x775018,
      emissiveIntensity: 0.65,
      metalness: 0.78,
      roughness: 0.28
    });

    const tiers = [
      { rTop: 11.6, rBot: 12.0, h: 0.45, y: -0.85 },
      { rTop: 11.15, rBot: 11.4, h: 0.55, y: -0.4 },
      { rTop: 10.7, rBot: 10.9, h: 0.28, y: -0.02 }
    ];
    tiers.forEach((t) => {
      const mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(t.rTop, t.rBot, t.h, 8),
        jadeMat.clone()
      );
      mesh.position.y = t.y;
      mesh.receiveShadow = true;
      mesh.castShadow = true;
      this.platformRoot.add(mesh);
      const lip = new THREE.Mesh(
        new THREE.TorusGeometry(t.rTop + 0.02, 0.06, 6, 8),
        goldMat
      );
      lip.rotation.x = Math.PI / 2;
      lip.position.y = t.y + t.h * 0.45;
      this.platformRoot.add(lip);
    });

    const gemColors = [0xff3355, 0x44e0c0, 0x4488ff, 0xffcc44];
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2 + Math.PI / 8;
      const bezel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.24, 0.08, 8),
        goldMat
      );
      bezel.position.set(Math.cos(ang) * 10.85, 0.14, Math.sin(ang) * 10.85);
      this.platformRoot.add(bezel);
      const gem = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.16, 0),
        new THREE.MeshStandardMaterial({
          color: gemColors[i % gemColors.length],
          emissive: gemColors[i % gemColors.length],
          emissiveIntensity: 0.7,
          metalness: 0.35,
          roughness: 0.18
        })
      );
      gem.position.set(Math.cos(ang) * 10.85, 0.28, Math.sin(ang) * 10.85);
      this.platformRoot.add(gem);
    }

    const lantern = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.36, 1.4, 8),
      new THREE.MeshStandardMaterial({
        color: 0xffb060,
        emissive: 0xff8020,
        emissiveIntensity: 0.75
      })
    );
    lantern.position.set(-9.2, 0.85, 5.8);
    this.platformRoot.add(lantern);
  }

  /** Rebuild platform after BoardAssets preload finishes. */
  _refreshPlatformFromAssets() {
    if (getBoardSource('platform') !== 'glb' || this._useGlbPlatform) return;
    if (this.platformRoot) this.root.remove(this.platformRoot);
    this._buildArenaDecor();
  }

  _buildBoard(rows, cols) {
    if (this.boardGroup) {
      this.root.remove(this.boardGroup);
      this.cellMeshes.clear();
    }
    if (this.rayPlane) {
      this.root.remove(this.rayPlane);
      this.rayPlane = null;
    }
    this.rows = rows;
    this.cols = cols;
    this.boardGroup = new THREE.Group();
    this._useGlbSurface = false;

    const spanX = cols * CELL + (cols - 1) * GAP;
    const spanZ = rows * CELL + (rows - 1) * GAP;
    const boardSpan = Math.max(spanX, spanZ);

    // Decorative Tripo surface under interactive hitboxes
    const surface = cloneBoardAsset('surface');
    if (surface) {
      fitBoardAsset(surface, { targetSpan: boardSpan * 1.02, groundY: 0.02, alignY: 'top' });
      this.boardGroup.add(surface);
      this._useGlbSurface = true;
    }

    this._highlightMat = new THREE.MeshStandardMaterial({
      color: 0x44eebb,
      emissive: 0x22aa77,
      emissiveIntensity: 0.85,
      transparent: true,
      opacity: 0.9
    });
    this._dangerMat = new THREE.MeshStandardMaterial({
      color: 0xff5566,
      emissive: 0xaa2233,
      emissiveIntensity: 0.85,
      transparent: true,
      opacity: 0.9
    });

    const cellInner = CELL * 0.82;

    if (this._useGlbSurface) {
      // Invisible / highlight-only hitboxes over the GLB surface
      for (let r = 1; r <= rows; r++) {
        for (let c = 1; c <= cols; c++) {
          const mat = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            emissive: 0x000000,
            emissiveIntensity: 0,
            transparent: true,
            opacity: 0.0,
            depthWrite: false
          });
          const mesh = new THREE.Mesh(
            new THREE.BoxGeometry(cellInner, 0.06, cellInner),
            mat
          );
          const p = cellCenter(r, c, rows, cols);
          mesh.position.set(p.x, 0.14, p.z);
          mesh.userData.cell = { r, c };
          mesh.userData.baseColor = mat.color.clone();
          mesh.userData.baseEmissive = mat.emissive.clone();
          mesh.userData.baseEmissiveIntensity = 0;
          mesh.userData.hitboxOnly = true;
          this.boardGroup.add(mesh);
          this.cellMeshes.set(`${r},${c}`, mesh);
        }
      }
    } else {
      const jadeA = new THREE.CanvasTexture(makeNoiseCanvas(128, { base: [28, 92, 72], variance: 22, goldVeins: true }));
      const jadeB = new THREE.CanvasTexture(makeNoiseCanvas(128, { base: [110, 78, 36], variance: 20, goldVeins: true }));
      jadeA.colorSpace = jadeB.colorSpace = THREE.SRGBColorSpace;

      const grooveMat = new THREE.MeshStandardMaterial({
        color: 0xe0b858,
        emissive: 0x886010,
        emissiveIntensity: 0.7,
        metalness: 0.78,
        roughness: 0.28
      });
      const grooveW = 0.07;
      const grooveH = 0.06;

      for (let r = 1; r <= rows; r++) {
        for (let c = 1; c <= cols; c++) {
          const special = this._isSpecial(r, c);
          const alt = (r + c) % 2 === 0;
          const mat = new THREE.MeshStandardMaterial({
            map: (alt ? jadeA : jadeB).clone(),
            color: special ? 0x4a6880 : (alt ? 0x2a6a54 : 0x8a6030),
            emissive: special ? 0x284858 : (alt ? 0x143828 : 0x3a2410),
            emissiveIntensity: special ? 0.45 : 0.28,
            roughness: 0.45,
            metalness: 0.3
          });
          const cellH = special ? 0.26 : 0.12;
          const mesh = new THREE.Mesh(
            new THREE.BoxGeometry(cellInner, cellH, cellInner),
            mat
          );
          const p = cellCenter(r, c, rows, cols);
          mesh.position.set(p.x, special ? 0.12 : 0.04, p.z);
          mesh.receiveShadow = true;
          mesh.userData.cell = { r, c };
          mesh.userData.baseColor = mesh.material.color.clone();
          mesh.userData.baseEmissive = mesh.material.emissive.clone();
          mesh.userData.baseEmissiveIntensity = mesh.material.emissiveIntensity;
          this.boardGroup.add(mesh);
          this.cellMeshes.set(`${r},${c}`, mesh);

          const half = CELL * 0.5 - grooveW * 0.35;
          const len = CELL * 0.92;
          const gy = 0.1;
          const bars = [
            { sx: len, sz: grooveW, x: 0, z: half },
            { sx: len, sz: grooveW, x: 0, z: -half },
            { sx: grooveW, sz: len, x: half, z: 0 },
            { sx: grooveW, sz: len, x: -half, z: 0 }
          ];
          bars.forEach(b => {
            const bar = new THREE.Mesh(
              new THREE.BoxGeometry(b.sx, grooveH, b.sz),
              grooveMat
            );
            bar.position.set(p.x + b.x, gy, p.z + b.z);
            this.boardGroup.add(bar);
          });
        }
      }
    }
    this.root.add(this.boardGroup);

    const rayPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(cols * (CELL + GAP), rows * (CELL + GAP)),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    rayPlane.rotation.x = -Math.PI / 2;
    rayPlane.position.y = 0.22;
    this.rayPlane = rayPlane;
    this.root.add(rayPlane);
  }

  _isSpecial(r, c) {
    return (r === 2 && c === 3) || (r === 2 && c === 6) ||
      (r === 6 && c === 3) || (r === 6 && c === 6);
  }

  setInteractive(v) {
    this.interactive = v;
  }

  resize(w, h) {
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
  }

  _bindPointer() {
    this._raycaster = new THREE.Raycaster();
    this._pointer = new THREE.Vector2();
    const el = () => document.querySelector('.webgl-canvas');

    this._onPointerDown = (e) => {
      if (!this.interactive) return;
      const canvas = el();
      if (!canvas || e.target !== canvas) return;
      const cell = this._pickCell(e, canvas);
      if (!cell) return;
      this._drag = { start: cell, moved: false, pointerId: e.pointerId };
      canvas.setPointerCapture?.(e.pointerId);
    };

    this._onPointerMove = (e) => {
      if (!this.interactive) return;
      const canvas = el();
      if (!canvas) return;
      const cell = this._pickCell(e, canvas);
      if (cell) this.onHoverCell(cell);
      if (this._drag && this.selectedId != null) {
        const av = this.avatars.get(this.selectedId);
        if (av && cell) {
          this._drag.moved = true;
          const p = cellCenter(cell.r, cell.c, this.rows, this.cols);
          av.root.position.x = p.x;
          av.root.position.z = p.z;
          av.root.position.y = av.baseY + 0.45;
          av.root.traverse(o => {
            if (o.material && o.material.opacity != null) {
              o.material.transparent = true;
              o.material.opacity = 0.75;
            }
          });
        }
      }
    };

    this._onPointerUp = (e) => {
      if (!this.interactive) return;
      const canvas = el();
      if (!canvas) return;
      // Only complete a board action if the gesture started on the canvas
      // (avoids HUD mute/leave/captured clicks raycasting into cells underneath).
      const drag = this._drag;
      if (!drag) return;
      this._drag = null;
      const cell = this._pickCell(e, canvas);
      if (this.selectedId != null) {
        const av = this.avatars.get(this.selectedId);
        if (av) {
          av.root.traverse(o => {
            if (o.material && o.material.opacity != null) o.material.opacity = 1;
          });
          // snap back; game logic will animate real move
          if (av.cell) {
            const lift = av.selected ? 0.35 : 0;
            const p = cellCenter(av.cell.r, av.cell.c, this.rows, this.cols);
            av.root.position.set(p.x, av.baseY + lift, p.z);
          }
        }
      }
      if (cell) this.onCellAction(cell, { dragged: !!drag.moved });
    };

    window.addEventListener('pointerdown', this._onPointerDown);
    window.addEventListener('pointermove', this._onPointerMove);
    window.addEventListener('pointerup', this._onPointerUp);
  }

  _pickCell(e, canvas) {
    const rect = canvas.getBoundingClientRect();
    this._pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this._pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this._raycaster.setFromCamera(this._pointer, this.camera);
    const hits = this._raycaster.intersectObjects([...this.cellMeshes.values()], false);
    if (hits.length) return hits[0].object.userData.cell;
    const planeHit = this._raycaster.intersectObject(this.rayPlane, false);
    if (!planeHit.length) return null;
    const p = planeHit[0].point;
    const w = this.cols * CELL + (this.cols - 1) * GAP;
    const h = this.rows * CELL + (this.rows - 1) * GAP;
    const c = Math.floor((p.x + w / 2) / (CELL + GAP)) + 1;
    const r = Math.floor((p.z + h / 2) / (CELL + GAP)) + 1;
    if (r < 1 || c < 1 || r > this.rows || c > this.cols) return null;
    return { r, c };
  }

  clearHighlights() {
    this.cellMeshes.forEach(mesh => {
      mesh.material.color.copy(mesh.userData.baseColor);
      mesh.material.emissive.copy(mesh.userData.baseEmissive);
      mesh.material.emissiveIntensity = mesh.userData.baseEmissiveIntensity || 0.2;
      if (mesh.userData.hitboxOnly) mesh.material.opacity = 0;
    });
  }

  setHighlights(legalSet, dangerSet) {
    this.clearHighlights();
    (legalSet || []).forEach(({ r, c }) => {
      const m = this.cellMeshes.get(`${r},${c}`);
      if (!m) return;
      m.material.color.copy(this._highlightMat.color);
      m.material.emissive.copy(this._highlightMat.emissive);
      m.material.emissiveIntensity = 0.75;
      if (m.userData.hitboxOnly) m.material.opacity = 0.55;
    });
    (dangerSet || []).forEach(({ r, c }) => {
      const m = this.cellMeshes.get(`${r},${c}`);
      if (!m) return;
      m.material.color.copy(this._dangerMat.color);
      m.material.emissive.copy(this._dangerMat.emissive);
      m.material.emissiveIntensity = 0.75;
      if (m.userData.hitboxOnly) m.material.opacity = 0.55;
    });
  }

  _makeAvatar(piece) {
    const faceDown = !!piece.faceDown;
    const root = faceDown
      ? createSealedToken(piece.camp)
      : createCharacter(piece.type, piece.camp);
    const pos = cellCenter(piece.r, piece.c, this.rows, this.cols);
    root.position.copy(pos);
    this.piecesRoot.add(root);
    return {
      id: piece.id,
      type: piece.type,
      camp: piece.camp,
      faceDown,
      root,
      cell: { r: piece.r, c: piece.c },
      baseY: BASE_Y,
      phase: Math.random() * Math.PI * 2,
      busy: false
    };
  }

  async syncBoard(state, opts = {}) {
    await Promise.all([preloadSpiritModels(), preloadBoardModels()]);
    this._refreshPlatformFromAssets();
    if (!state) {
      this._clearAvatars();
      return;
    }
    const nextRows = state.rows || 7;
    const nextCols = state.cols || 8;
    const needRebuild =
      nextRows !== this.rows ||
      nextCols !== this.cols ||
      (getBoardSource('surface') === 'glb' && !this._useGlbSurface);
    if (needRebuild) {
      this._buildBoard(nextRows, nextCols);
    }

    const nextMap = new Map();
    (state.pieces || []).forEach(p => nextMap.set(p.id, p));

    if (opts.force || !opts.prevMap || this.reduceMotion || !opts.animate) {
      this._clearAvatars();
      nextMap.forEach(p => {
        const av = this._makeAvatar(p);
        this.avatars.set(p.id, av);
      });
      this.setSelected(opts.selectedId ?? null);
      return Promise.resolve();
    }

    return this._animateDiff(opts.prevMap, nextMap, state, opts.selectedId);
  }

  async _animateDiff(prevMap, nextMap, state, selectedId) {
    const flips = [];
    const moves = [];
    const captures = [];

    nextMap.forEach((next, id) => {
      const prev = prevMap.get(id);
      if (!prev) return;
      if (prev.faceDown && !next.faceDown) flips.push({ id, next });
      else if (prev.r !== next.r || prev.c !== next.c) moves.push({ id, prev, next });
    });
    prevMap.forEach((prev, id) => {
      if (!nextMap.has(id)) captures.push({ id, prev });
    });

    if (!flips.length && !moves.length && !captures.length) {
      // soft sync positions / selection without rebuild
      nextMap.forEach(p => {
        let av = this.avatars.get(p.id);
        if (!av) {
          av = this._makeAvatar(p);
          this.avatars.set(p.id, av);
        } else if (!!av.faceDown !== !!p.faceDown || av.type !== p.type) {
          this.piecesRoot.remove(av.root);
          av = this._makeAvatar(p);
          this.avatars.set(p.id, av);
        } else if (!av.busy) {
          const pos = cellCenter(p.r, p.c, this.rows, this.cols);
          av.root.position.set(pos.x, av.baseY, pos.z);
          av.cell = { r: p.r, c: p.c };
        }
      });
      [...this.avatars.keys()].forEach(id => {
        if (!nextMap.has(id)) {
          const av = this.avatars.get(id);
          if (av) this.piecesRoot.remove(av.root);
          this.avatars.delete(id);
        }
      });
      this.setSelected(selectedId ?? null);
      return;
    }

    const tasks = [];

    for (const f of flips) {
      tasks.push(this._animFlip(f.next));
    }

    for (const m of moves) {
      const victim = captures.find(c => c.prev.r === m.next.r && c.prev.c === m.next.c);
      tasks.push(this._animMove(m.prev, m.next, victim));
      if (victim) captures.splice(captures.indexOf(victim), 1);
    }

    for (const c of captures) {
      tasks.push(this._animCaptureOnly(c.prev));
    }

    await Promise.all(tasks);

    // reconcile
    this._clearAvatars();
    nextMap.forEach(p => {
      const av = this._makeAvatar(p);
      this.avatars.set(p.id, av);
    });
    this.setSelected(selectedId ?? null);
  }

  async _animFlip(piece) {
    let av = this.avatars.get(piece.id);
    if (!av) {
      av = this._makeAvatar(Object.assign({}, piece, { faceDown: true }));
      this.avatars.set(piece.id, av);
    }
    av.busy = true;
    const old = av.root;
    const pos = old.position.clone();
    // shatter sealed: scale down then spawn character
    if (!this.reduceMotion) {
      await new Promise(r => {
        const start = performance.now();
        const frame = (now) => {
          const u = Math.min(1, (now - start) / (ANIM_MS.flip * 0.45));
          old.rotation.y += 0.3;
          old.scale.setScalar(1 - u);
          if (u < 1) requestAnimationFrame(frame);
          else r();
        };
        requestAnimationFrame(frame);
      });
    }
    this.piecesRoot.remove(old);
    const neu = createCharacter(piece.type, piece.camp);
    neu.position.copy(pos);
    neu.scale.setScalar(0.2);
    this.piecesRoot.add(neu);
    av.root = neu;
    av.faceDown = false;
    av.type = piece.type;
    av.camp = piece.camp;
    if (!this.reduceMotion) {
      await new Promise(r => {
        const start = performance.now();
        const frame = (now) => {
          const u = Math.min(1, (now - start) / (ANIM_MS.flip * 0.55));
          const e = 1 - Math.pow(1 - u, 3);
          neu.scale.setScalar(0.2 + 0.8 * e);
          neu.position.y = av.baseY + Math.sin(e * Math.PI) * 0.4;
          if (u < 1) requestAnimationFrame(frame);
          else {
            neu.position.y = av.baseY;
            neu.scale.setScalar(1);
            r();
          }
        };
        requestAnimationFrame(frame);
      });
    } else {
      neu.scale.setScalar(1);
    }
    av.busy = false;
  }

  async _animMove(prev, next, victim) {
    let av = this.avatars.get(next.id);
    if (!av) {
      av = this._makeAvatar(prev);
      this.avatars.set(next.id, av);
    }
    const to = cellCenter(next.r, next.c, this.rows, this.cols);
    av._pendingR = next.r;
    av._pendingC = next.c;
    if (victim) {
      const vic = this.avatars.get(victim.id);
      await Promise.all([
        playAttackLunge(av, to, next.type),
        vic ? playExit(vic, this.piecesRoot, (t) => pulseScreenFlash(this.fxOverlay, t), this.reduceMotion) : Promise.resolve()
      ]);
      this.avatars.delete(victim.id);
      await playMove(av, to, ANIM_MS.move * 0.85);
    } else {
      await playMove(av, to, ANIM_MS.move);
    }
    av.cell = { r: next.r, c: next.c };
  }

  async _animCaptureOnly(prev) {
    const av = this.avatars.get(prev.id);
    if (!av) return;
    await playExit(av, this.piecesRoot, (t) => pulseScreenFlash(this.fxOverlay, t), this.reduceMotion);
    this.avatars.delete(prev.id);
  }

  setSelected(id) {
    const prev = this.selectedId;
    if (prev === id) {
      const same = id != null ? this.avatars.get(id) : null;
      if (!id || (same && same.selected)) return;
      // Same id after mesh rebuild: re-apply lift without deselect flicker.
      if (same) {
        same.selected = true;
        playSelect(same);
      }
      return;
    }
    this.selectedId = id;
    if (prev && this.avatars.has(prev)) {
      const old = this.avatars.get(prev);
      old.selected = false;
      playDeselect(old);
    }
    if (id && this.avatars.has(id)) {
      const av = this.avatars.get(id);
      av.selected = true;
      playSelect(av);
    }
  }

  _clearAvatars() {
    this.avatars.forEach(av => this.piecesRoot.remove(av.root));
    this.avatars.clear();
  }

  update(dt) {
    this._t += dt;
    this.avatars.forEach(av => tickIdle(av, this._t, this.reduceMotion));
    if (!this.reduceMotion) {
      if (this.clouds) {
        this.clouds.rotation.y += dt * 0.018;
        this.clouds.children.forEach((c, i) => {
          c.position.x += Math.sin(this._t * 0.12 + i) * 0.003;
        });
      }
      if (this.cloudsB) {
        this.cloudsB.rotation.y -= dt * 0.012;
      }
      if (this.nebula) {
        this.nebula.rotation.y += dt * 0.008;
      }
      if (this.platformRoot) {
        this.platformRoot.position.y = Math.sin(this._t * 0.55) * 0.035;
      }
    }
  }

  dispose() {
    window.removeEventListener('pointerdown', this._onPointerDown);
    window.removeEventListener('pointermove', this._onPointerMove);
    window.removeEventListener('pointerup', this._onPointerUp);
    this._clearAvatars();
    this.scene.traverse(obj => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
        else obj.material.dispose();
      }
    });
  }
}
