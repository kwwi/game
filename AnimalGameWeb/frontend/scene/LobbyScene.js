import * as THREE from 'three';

export class LobbyScene {
  constructor({ reduceMotion = false } = {}) {
    this.reduceMotion = reduceMotion;
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x0a1220, 0.028);
    this.scene.background = new THREE.Color(0x071018);

    this.camera = new THREE.PerspectiveCamera(52, 1, 0.1, 200);
    this.camera.position.set(0, 8, 18);
    this.camera.lookAt(0, 3, -8);

    this.root = new THREE.Group();
    this.scene.add(this.root);
    this._t = 0;
    this._active = true;

    this._buildLights();
    this._buildGround();
    this._buildForest();
    this._buildCastle();
    this._buildFireflies();
  }

  _buildLights() {
    const amb = new THREE.AmbientLight(0x4a6080, 0.45);
    this.scene.add(amb);
    const moon = new THREE.DirectionalLight(0xa8c8ff, 0.55);
    moon.position.set(-12, 22, 8);
    moon.castShadow = !this.reduceMotion;
    if (moon.castShadow) {
      moon.shadow.mapSize.set(1024, 1024);
      moon.shadow.camera.near = 2;
      moon.shadow.camera.far = 60;
      moon.shadow.camera.left = -20;
      moon.shadow.camera.right = 20;
      moon.shadow.camera.top = 20;
      moon.shadow.camera.bottom = -20;
    }
    this.scene.add(moon);
    this.gateLight = new THREE.PointLight(0xffc978, 2.2, 40, 2);
    this.gateLight.position.set(0, 4.5, -10);
    this.scene.add(this.gateLight);
    const rim = new THREE.PointLight(0x66ffe0, 1.1, 30, 2);
    rim.position.set(6, 6, -4);
    this.scene.add(rim);
  }

  _buildGround() {
    const geo = new THREE.CircleGeometry(48, 48);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x14301f,
      roughness: 0.92,
      metalness: 0.05
    });
    const ground = new THREE.Mesh(geo, mat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.root.add(ground);

    const path = new THREE.Mesh(
      new THREE.PlaneGeometry(3.2, 28),
      new THREE.MeshStandardMaterial({ color: 0x2a2418, roughness: 1 })
    );
    path.rotation.x = -Math.PI / 2;
    path.position.set(0, 0.02, -2);
    this.root.add(path);
  }

  _buildForest() {
    const trunkGeo = new THREE.CylinderGeometry(0.25, 0.4, 4.5, 6);
    const leafGeo = new THREE.ConeGeometry(1.6, 3.2, 7);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x2a1a10, roughness: 0.95 });
    const leafMat = new THREE.MeshStandardMaterial({
      color: 0x1a3d2e,
      emissive: 0x0a2a1a,
      emissiveIntensity: 0.15,
      roughness: 0.85
    });

    this.trees = new THREE.Group();
    const count = this.reduceMotion ? 18 : 36;
    for (let i = 0; i < count; i++) {
      const g = new THREE.Group();
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.y = 2.2;
      trunk.castShadow = !this.reduceMotion;
      const leaf = new THREE.Mesh(leafGeo, leafMat);
      leaf.position.y = 5.1;
      leaf.castShadow = !this.reduceMotion;
      g.add(trunk, leaf);
      const ang = (i / count) * Math.PI * 2 + (i % 3) * 0.2;
      const rad = 10 + (i % 5) * 2.4 + (i % 2) * 1.1;
      g.position.set(Math.cos(ang) * rad, 0, Math.sin(ang) * rad - 4);
      if (Math.abs(g.position.x) < 3.5 && g.position.z > -6 && g.position.z < 8) {
        g.position.x += g.position.x >= 0 ? 5 : -5;
      }
      g.scale.setScalar(0.75 + (i % 4) * 0.18);
      this.trees.add(g);
    }
    this.root.add(this.trees);
  }

  _buildCastle() {
    this.castle = new THREE.Group();
    this.castle.position.set(0, 0, -14);

    const stone = new THREE.MeshStandardMaterial({
      color: 0x2c3548,
      roughness: 0.78,
      metalness: 0.2,
      emissive: 0x101828,
      emissiveIntensity: 0.25
    });
    const gold = new THREE.MeshStandardMaterial({
      color: 0xc9a45c,
      emissive: 0x664410,
      emissiveIntensity: 0.55,
      metalness: 0.7,
      roughness: 0.35
    });

    const keep = new THREE.Mesh(new THREE.BoxGeometry(8, 7, 6), stone);
    keep.position.y = 3.5;
    keep.castShadow = true;
    this.castle.add(keep);

    for (const x of [-4.5, 4.5]) {
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.5, 9, 8), stone);
      tower.position.set(x, 4.5, 1.5);
      tower.castShadow = true;
      this.castle.add(tower);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(1.8, 2.2, 8), gold);
      roof.position.set(x, 10.2, 1.5);
      this.castle.add(roof);
    }

    const gate = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 3.4, 0.6),
      new THREE.MeshStandardMaterial({
        color: 0x0a0810,
        emissive: 0x3a2060,
        emissiveIntensity: 0.8,
        roughness: 0.4
      })
    );
    gate.position.set(0, 1.7, 3.05);
    this.castle.add(gate);
    this.gateMesh = gate;

    const runeRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.5, 0.08, 8, 32),
      new THREE.MeshStandardMaterial({
        color: 0x88ffee,
        emissive: 0x44ffcc,
        emissiveIntensity: 1.2,
        metalness: 0.6,
        roughness: 0.2
      })
    );
    runeRing.position.set(0, 1.7, 3.4);
    this.castle.add(runeRing);
    this.runeRing = runeRing;

    this.root.add(this.castle);
  }

  _buildFireflies() {
    const n = this.reduceMotion ? 20 : 60;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 30;
      pos[i * 3 + 1] = 1 + Math.random() * 8;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 24 - 2;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xffe6a0,
      size: 0.18,
      transparent: true,
      opacity: 0.85,
      depthWrite: false
    });
    this.fireflies = new THREE.Points(geo, mat);
    this.root.add(this.fireflies);
  }

  setActive(v) {
    this._active = v;
  }

  resize(w, h) {
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
  }

  update(dt) {
    if (!this._active && !this._forceUpdate) return;
    this._t += dt;
    const t = this._t;
    if (!this.reduceMotion) {
      this.camera.position.x = Math.sin(t * 0.15) * 1.4;
      this.camera.position.y = 8 + Math.sin(t * 0.22) * 0.35;
      this.camera.lookAt(0, 3.2, -10);
      if (this.runeRing) this.runeRing.rotation.z = t * 0.8;
      if (this.gateLight) this.gateLight.intensity = 1.8 + Math.sin(t * 2.2) * 0.5;
      if (this.fireflies) {
        const arr = this.fireflies.geometry.attributes.position.array;
        for (let i = 0; i < arr.length; i += 3) {
          arr[i + 1] += Math.sin(t + i) * 0.004;
        }
        this.fireflies.geometry.attributes.position.needsUpdate = true;
      }
    }
  }

  /** Camera fly used by transition */
  getFlyTargets() {
    return {
      fromPos: this.camera.position.clone(),
      fromTarget: new THREE.Vector3(0, 3.2, -10),
      toPos: new THREE.Vector3(0, 2.8, -10.5),
      toTarget: new THREE.Vector3(0, 1.7, -11)
    };
  }

  dispose() {
    this.scene.traverse(obj => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
        else obj.material.dispose();
      }
    });
  }
}
