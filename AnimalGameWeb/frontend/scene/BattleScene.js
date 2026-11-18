import * as THREE from 'three';
import { createCharacter, createSealedToken } from './pieces/CharacterFactory.js';
import { tickIdle, playSelect, playDeselect, playMove, playAttackLunge, ANIM_MS } from './pieces/anims.js';
import { playExit, pulseScreenFlash } from './pieces/exits.js';
import { makeNoiseCanvas, makeSkyGradientCanvas } from './textures.js';

const CELL = 1.15;
const GAP = 0.08;
const BASE_Y = 0.22;

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
    this.scene.fog = new THREE.FogExp2(0x1a2848, 0.018);
    this.scene.background = new THREE.Color(0x0c1430);

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

    const starN = this.reduceMotion ? 60 : 140;
    const starPos = new Float32Array(starN * 3);
    for (let i = 0; i < starN; i++) {
      const th = Math.random() * Math.PI * 2;
      const ph = Math.random() * 0.9;
      starPos[i * 3] = Math.sin(ph) * Math.cos(th) * 90;
      starPos[i * 3 + 1] = 20 + Math.cos(ph) * 50;
      starPos[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * 90;
    }
    this.scene.add(new THREE.Points(
      new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(starPos, 3)),
      new THREE.PointsMaterial({ color: 0xe8f0ff, size: 0.4, transparent: true, opacity: 0.8, depthWrite: false })
    ));

    const cloudMat = new THREE.MeshBasicMaterial({
      color: 0xb8d0ea,
      transparent: true,
      opacity: 0.28,
      depthWrite: false
    });
    this.clouds = new THREE.Group();
    for (let i = 0; i < (this.reduceMotion ? 8 : 14); i++) {
      const c = new THREE.Mesh(new THREE.SphereGeometry(5 + (i % 4), 12, 8), cloudMat);
      c.scale.set(2.8 + (i % 3) * 0.5, 0.28, 2.0);
      c.position.set((i - 7) * 6.5, -9.5 + (i % 3) * 0.6, -22 + (i % 5) * 4);
      this.clouds.add(c);
    }
    this.scene.add(this.clouds);

    // distant peaks + pagodas
    const peakMat = new THREE.MeshStandardMaterial({ color: 0x1a2438, roughness: 0.95 });
    for (let i = 0; i < 7; i++) {
      const peak = new THREE.Mesh(new THREE.ConeGeometry(3 + (i % 3), 10 + i, 5), peakMat);
      peak.position.set(-24 + i * 8, -2, -42 - (i % 3) * 4);
      this.scene.add(peak);
      if (i % 2 === 0) {
        const pagoda = new THREE.Group();
        const stone = new THREE.MeshStandardMaterial({ color: 0x2a3040, roughness: 0.8 });
        const warm = new THREE.MeshStandardMaterial({
          color: 0xffc070,
          emissive: 0xff9940,
          emissiveIntensity: 1.2
        });
        for (let t = 0; t < 3; t++) {
          const tier = new THREE.Mesh(new THREE.BoxGeometry(1.4 - t * 0.25, 0.55, 1.4 - t * 0.25), stone);
          tier.position.y = t * 0.7;
          pagoda.add(tier);
          const roof = new THREE.Mesh(new THREE.ConeGeometry(1.0 - t * 0.15, 0.4, 4), warm);
          roof.position.y = t * 0.7 + 0.35;
          pagoda.add(roof);
        }
        pagoda.position.copy(peak.position);
        pagoda.position.y = 4.2;
        pagoda.scale.setScalar(0.9);
        this.scene.add(pagoda);
      }
    }
  }

  _buildLights() {
    this.scene.add(new THREE.HemisphereLight(0x9ab8ff, 0x1a2030, 0.55));
    const key = new THREE.DirectionalLight(0xffe6c0, 0.9);
    key.position.set(8, 16, 10);
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
    const fill = new THREE.PointLight(0x66d0ff, 1.0, 30, 2);
    fill.position.set(-7, 6, -3);
    this.scene.add(fill);
    const rim = new THREE.PointLight(0xff80a0, 0.55, 24, 2);
    rim.position.set(6, 4, 5);
    this.scene.add(rim);
  }

  _buildArenaDecor() {
    // Octagonal floating platform
    const jadeTex = new THREE.CanvasTexture(makeNoiseCanvas(256, {
      base: [22, 48, 40],
      variance: 26,
      crack: true,
      goldVeins: true
    }));
    jadeTex.colorSpace = THREE.SRGBColorSpace;
    const platform = new THREE.Mesh(
      new THREE.CylinderGeometry(11.2, 11.6, 1.1, 8),
      new THREE.MeshStandardMaterial({
        map: jadeTex,
        color: 0x1e3a32,
        roughness: 0.55,
        metalness: 0.28,
        emissive: 0x0a1814,
        emissiveIntensity: 0.2
      })
    );
    platform.position.y = -0.45;
    platform.receiveShadow = true;
    platform.castShadow = true;
    this.root.add(platform);

    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(11.35, 0.12, 8, 8),
      new THREE.MeshStandardMaterial({
        color: 0xc9a45c,
        emissive: 0x664410,
        emissiveIntensity: 0.7,
        metalness: 0.75,
        roughness: 0.28
      })
    );
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.12;
    this.root.add(rim);

    // gem inlays on rim
    const gemColors = [0xff3355, 0x44e0c0, 0x4488ff, 0xffcc44];
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2 + Math.PI / 8;
      const gem = new THREE.Mesh(
        new THREE.SphereGeometry(0.18, 10, 8),
        new THREE.MeshStandardMaterial({
          color: gemColors[i % gemColors.length],
          emissive: gemColors[i % gemColors.length],
          emissiveIntensity: 0.85,
          metalness: 0.4,
          roughness: 0.2
        })
      );
      gem.position.set(Math.cos(ang) * 11.2, 0.22, Math.sin(ang) * 11.2);
      this.root.add(gem);
    }

    // side lantern / box props (subtle)
    const lantern = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.4, 1.6, 8),
      new THREE.MeshStandardMaterial({
        color: 0xffb060,
        emissive: 0xff8020,
        emissiveIntensity: 0.9
      })
    );
    lantern.position.set(-9.5, 0.9, 6);
    this.root.add(lantern);
  }

  _buildBoard(rows, cols) {
    if (this.boardGroup) {
      this.root.remove(this.boardGroup);
      this.cellMeshes.clear();
    }
    this.rows = rows;
    this.cols = cols;
    this.boardGroup = new THREE.Group();

    const jadeA = new THREE.CanvasTexture(makeNoiseCanvas(128, { base: [18, 52, 42], variance: 18, goldVeins: true }));
    const jadeB = new THREE.CanvasTexture(makeNoiseCanvas(128, { base: [58, 44, 24], variance: 16, goldVeins: true }));
    jadeA.colorSpace = jadeB.colorSpace = THREE.SRGBColorSpace;

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

    for (let r = 1; r <= rows; r++) {
      for (let c = 1; c <= cols; c++) {
        const special = this._isSpecial(r, c);
        const alt = (r + c) % 2 === 0;
        const mat = new THREE.MeshStandardMaterial({
          map: (alt ? jadeA : jadeB).clone(),
          color: special ? 0x3a5068 : (alt ? 0x1a3d34 : 0x5a4020),
          emissive: special ? 0x203848 : (alt ? 0x0a2018 : 0x2a1808),
          emissiveIntensity: special ? 0.55 : 0.22,
          roughness: 0.48,
          metalness: 0.32
        });
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(CELL * 0.92, special ? 0.32 : 0.18, CELL * 0.92),
          mat
        );
        const p = cellCenter(r, c, rows, cols);
        mesh.position.set(p.x, special ? 0.2 : 0.12, p.z);
        mesh.receiveShadow = true;
        mesh.userData.cell = { r, c };
        mesh.userData.baseColor = mesh.material.color.clone();
        mesh.userData.baseEmissive = mesh.material.emissive.clone();
        mesh.userData.baseEmissiveIntensity = mesh.material.emissiveIntensity;
        this.boardGroup.add(mesh);
        this.cellMeshes.set(`${r},${c}`, mesh);

        // gold inlay frame
        const frame = new THREE.Mesh(
          new THREE.BoxGeometry(CELL * 0.96, 0.03, CELL * 0.96),
          new THREE.MeshStandardMaterial({
            color: 0xc9a45c,
            emissive: 0x664410,
            emissiveIntensity: 0.45,
            metalness: 0.7,
            roughness: 0.3
          })
        );
        frame.position.set(p.x, 0.03, p.z);
        this.boardGroup.add(frame);
      }
    }
    this.root.add(this.boardGroup);

    const rayPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(cols * (CELL + GAP), rows * (CELL + GAP)),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    rayPlane.rotation.x = -Math.PI / 2;
    rayPlane.position.y = 0.25;
    this.rayPlane = rayPlane;
    this.root.add(rayPlane);
  }

  _isSpecial(r, c) {
    return (r === 2 && c === 2) || (r === 2 && c === 7) ||
      (r === 6 && c === 2) || (r === 6 && c === 7);
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
    });
    (dangerSet || []).forEach(({ r, c }) => {
      const m = this.cellMeshes.get(`${r},${c}`);
      if (!m) return;
      m.material.color.copy(this._dangerMat.color);
      m.material.emissive.copy(this._dangerMat.emissive);
      m.material.emissiveIntensity = 0.75;
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

  syncBoard(state, opts = {}) {
    if (!state) {
      this._clearAvatars();
      return Promise.resolve();
    }
    if (state.rows !== this.rows || state.cols !== this.cols) {
      this._buildBoard(state.rows || 7, state.cols || 8);
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
    if (this.clouds && !this.reduceMotion) {
      this.clouds.rotation.y += dt * 0.02;
      this.clouds.children.forEach((c, i) => {
        c.position.x += Math.sin(this._t * 0.15 + i) * 0.004;
      });
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
