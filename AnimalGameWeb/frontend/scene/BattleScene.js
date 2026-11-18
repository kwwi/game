import * as THREE from 'three';
import { createCharacter, createSealedToken } from './pieces/CharacterFactory.js';
import { tickIdle, playSelect, playDeselect, playMove, playAttackLunge, ANIM_MS } from './pieces/anims.js';
import { playExit, pulseScreenFlash } from './pieces/exits.js';

const CELL = 1.15;
const GAP = 0.08;
const BASE_Y = 0.05;

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
    this.scene.fog = new THREE.FogExp2(0x120c18, 0.035);
    this.scene.background = new THREE.Color(0x140e1a);

    this.camera = new THREE.PerspectiveCamera(48, 1, 0.1, 120);
    this.resetCamera();

    this.root = new THREE.Group();
    this.scene.add(this.root);
    this.piecesRoot = new THREE.Group();
    this.root.add(this.piecesRoot);

    this.fxOverlay = document.getElementById('battleFxOverlay');

    this._buildLights();
    this._buildBoard(this.rows, this.cols);
    this._buildArenaDecor();
    this._bindPointer();
  }

  setHandlers({ onCellAction, onHoverCell } = {}) {
    if (onCellAction) this.onCellAction = onCellAction;
    if (onHoverCell) this.onHoverCell = onHoverCell;
  }

  getDefaultCamera() {
    return { x: 0, y: 11.5, z: 11.5 };
  }

  resetCamera() {
    const d = this.getDefaultCamera();
    this.camera.position.set(d.x, d.y, d.z);
    this.camera.lookAt(0, 0, 0);
  }

  _buildLights() {
    this.scene.add(new THREE.AmbientLight(0x5a4a70, 0.5));
    const key = new THREE.DirectionalLight(0xffe2b0, 0.85);
    key.position.set(6, 14, 8);
    key.castShadow = !this.reduceMotion;
    if (key.castShadow) {
      key.shadow.mapSize.set(1024, 1024);
      key.shadow.camera.near = 2;
      key.shadow.camera.far = 40;
      key.shadow.camera.left = -12;
      key.shadow.camera.right = 12;
      key.shadow.camera.top = 12;
      key.shadow.camera.bottom = -12;
    }
    this.scene.add(key);
    const fill = new THREE.PointLight(0x66ffe0, 1.2, 28, 2);
    fill.position.set(-6, 5, -4);
    this.scene.add(fill);
    const rim = new THREE.PointLight(0xff6688, 0.7, 22, 2);
    rim.position.set(5, 3, 5);
    this.scene.add(rim);
  }

  _buildArenaDecor() {
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(16, 40),
      new THREE.MeshStandardMaterial({ color: 0x1a1422, roughness: 0.95 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.08;
    ground.receiveShadow = true;
    this.root.add(ground);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(9.5, 0.08, 8, 48),
      new THREE.MeshStandardMaterial({
        color: 0xc9a45c,
        emissive: 0x664410,
        emissiveIntensity: 0.6,
        metalness: 0.7,
        roughness: 0.3
      })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.02;
    this.root.add(ring);
  }

  _buildBoard(rows, cols) {
    if (this.boardGroup) {
      this.root.remove(this.boardGroup);
      this.cellMeshes.clear();
    }
    this.rows = rows;
    this.cols = cols;
    this.boardGroup = new THREE.Group();
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x2a2030,
      roughness: 0.75,
      metalness: 0.15
    });
    const specialMat = new THREE.MeshStandardMaterial({
      color: 0x3a4a60,
      emissive: 0x203040,
      emissiveIntensity: 0.45,
      roughness: 0.55,
      metalness: 0.35
    });
    const highlightMat = new THREE.MeshStandardMaterial({
      color: 0x44dd99,
      emissive: 0x228866,
      emissiveIntensity: 0.7,
      transparent: true,
      opacity: 0.85
    });
    this._highlightMat = highlightMat;
    this._dangerMat = new THREE.MeshStandardMaterial({
      color: 0xdd4455,
      emissive: 0x881122,
      emissiveIntensity: 0.7,
      transparent: true,
      opacity: 0.8
    });

    for (let r = 1; r <= rows; r++) {
      for (let c = 1; c <= cols; c++) {
        const special = this._isSpecial(r, c);
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(CELL * 0.94, special ? 0.28 : 0.16, CELL * 0.94),
          (special ? specialMat : baseMat).clone()
        );
        const p = cellCenter(r, c, rows, cols);
        mesh.position.set(p.x, special ? 0.14 : 0.08, p.z);
        mesh.receiveShadow = true;
        mesh.userData.cell = { r, c };
        mesh.userData.baseColor = mesh.material.color.clone();
        mesh.userData.baseEmissive = mesh.material.emissive.clone();
        this.boardGroup.add(mesh);
        this.cellMeshes.set(`${r},${c}`, mesh);
      }
    }
    this.root.add(this.boardGroup);

    const rayPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(
        cols * (CELL + GAP),
        rows * (CELL + GAP)
      ),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    rayPlane.rotation.x = -Math.PI / 2;
    rayPlane.position.y = 0.2;
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
      const cell = this._pickCell(e, canvas);
      const drag = this._drag;
      this._drag = null;
      if (drag && this.selectedId != null) {
        const av = this.avatars.get(this.selectedId);
        if (av) {
          av.root.traverse(o => {
            if (o.material && o.material.opacity != null) o.material.opacity = 1;
          });
          // snap back; game logic will animate real move
          if (av.cell) {
            const p = cellCenter(av.cell.r, av.cell.c, this.rows, this.cols);
            av.root.position.set(p.x, av.baseY, p.z);
          }
        }
      }
      if (cell) this.onCellAction(cell, { dragged: !!(drag && drag.moved) });
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
    this.selectedId = id;
    if (prev && this.avatars.has(prev) && prev !== id) {
      playDeselect(this.avatars.get(prev));
    }
    if (id && this.avatars.has(id)) {
      playSelect(this.avatars.get(id));
    }
  }

  _clearAvatars() {
    this.avatars.forEach(av => this.piecesRoot.remove(av.root));
    this.avatars.clear();
  }

  update(dt) {
    this._t += dt;
    this.avatars.forEach(av => tickIdle(av, this._t, this.reduceMotion));
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
