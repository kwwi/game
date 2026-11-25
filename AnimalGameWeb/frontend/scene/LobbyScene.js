import * as THREE from 'three';
import { makeNoiseCanvas, makeSkyGradientCanvas, makeSoftCircleSprite } from './textures.js';

export class LobbyScene {
  constructor({ reduceMotion = false } = {}) {
    this.reduceMotion = reduceMotion;
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x0b1524, 0.022);
    this.scene.background = new THREE.Color(0x071018);

    this.camera = new THREE.PerspectiveCamera(52, 1, 0.1, 220);
    this.camera.position.set(2.2, 7.2, 16);
    this.camera.lookAt(1.5, 3.4, -10);

    this.root = new THREE.Group();
    this.scene.add(this.root);
    this._t = 0;
    this._active = true;
    this._pointLights = [];

    this._buildSky();
    this._buildLights();
    this._buildGround();
    this._buildForest();
    this._buildPathAndLanterns();
    this._buildCastle();
    this._buildFireflies();
  }

  _buildSky() {
    const skyTex = new THREE.CanvasTexture(makeSkyGradientCanvas());
    skyTex.colorSpace = THREE.SRGBColorSpace;
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(90, 24, 16),
      new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, depthWrite: false })
    );
    this.scene.add(sky);

    const n = this.reduceMotion ? 80 : 180;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const th = Math.random() * Math.PI * 2;
      const ph = Math.random() * Math.PI * 0.45;
      const r = 70;
      pos[i * 3] = Math.sin(ph) * Math.cos(th) * r;
      pos[i * 3 + 1] = 12 + Math.cos(ph) * r * 0.55;
      pos[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * r - 10;
    }
    const stars = new THREE.Points(
      new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(pos, 3)),
      new THREE.PointsMaterial({ color: 0xdeeeff, size: 0.35, transparent: true, opacity: 0.85, depthWrite: false })
    );
    this.scene.add(stars);
  }

  _buildLights() {
    this.scene.add(new THREE.HemisphereLight(0x8ab4ff, 0x1a2a18, 0.55));
    const moon = new THREE.DirectionalLight(0xb8d0ff, 0.5);
    moon.position.set(-14, 24, 6);
    moon.castShadow = !this.reduceMotion;
    if (moon.castShadow) {
      moon.shadow.mapSize.set(1024, 1024);
      moon.shadow.camera.near = 2;
      moon.shadow.camera.far = 70;
      moon.shadow.camera.left = -24;
      moon.shadow.camera.right = 24;
      moon.shadow.camera.top = 24;
      moon.shadow.camera.bottom = -24;
    }
    this.scene.add(moon);
    this.gateLight = new THREE.PointLight(0xffc978, 2.4, 36, 2);
    this.gateLight.position.set(0, 3.8, -11.2);
    this.scene.add(this.gateLight);
    this._pointLights.push(this.gateLight);
  }

  _buildGround() {
    const tex = new THREE.CanvasTexture(makeNoiseCanvas(256, { base: [18, 42, 28], variance: 22 }));
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(8, 8);
    tex.colorSpace = THREE.SRGBColorSpace;
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(52, 56),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, metalness: 0.04 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.root.add(ground);
  }

  _buildForest() {
    const trunkGeo = new THREE.CylinderGeometry(0.22, 0.38, 4.2, 6);
    const leafGeoA = new THREE.ConeGeometry(1.5, 2.8, 7);
    const leafGeoB = new THREE.ConeGeometry(1.15, 2.2, 6);
    const bushGeo = new THREE.SphereGeometry(0.7, 6, 5);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x2a1a10, roughness: 0.95 });
    const leafMat = new THREE.MeshStandardMaterial({
      color: 0x1c4532,
      emissive: 0x0a2418,
      emissiveIntensity: 0.18,
      roughness: 0.88
    });
    const bushMat = new THREE.MeshStandardMaterial({ color: 0x244830, roughness: 0.92 });

    this.trees = new THREE.Group();
    const count = this.reduceMotion ? 28 : 52;
    for (let i = 0; i < count; i++) {
      const g = new THREE.Group();
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.y = 2.1;
      trunk.castShadow = !this.reduceMotion;
      const leaf1 = new THREE.Mesh(leafGeoA, leafMat);
      leaf1.position.y = 4.6;
      leaf1.castShadow = !this.reduceMotion;
      const leaf2 = new THREE.Mesh(leafGeoB, leafMat);
      leaf2.position.y = 5.7;
      leaf2.scale.setScalar(0.85);
      g.add(trunk, leaf1, leaf2);
      if (i % 4 === 0) {
        const bush = new THREE.Mesh(bushGeo, bushMat);
        bush.position.set(0.7, 0.45, 0.2);
        g.add(bush);
      }
      const ang = (i / count) * Math.PI * 2 + (i % 5) * 0.15;
      const rad = 11 + (i % 6) * 2.2 + (i % 3) * 0.8;
      g.position.set(Math.cos(ang) * rad, 0, Math.sin(ang) * rad - 5);
      if (Math.abs(g.position.x) < 4 && g.position.z > -8 && g.position.z < 10) {
        g.position.x += g.position.x >= 0 ? 6 : -6;
      }
      g.scale.setScalar(0.7 + (i % 5) * 0.14);
      g.rotation.y = i * 0.4;
      this.trees.add(g);
    }
    this.root.add(this.trees);
  }

  _buildPathAndLanterns() {
    const pathTex = new THREE.CanvasTexture(makeNoiseCanvas(128, {
      base: [48, 40, 28],
      variance: 18,
      crack: true,
      goldVeins: false
    }));
    pathTex.colorSpace = THREE.SRGBColorSpace;
    const path = new THREE.Mesh(
      new THREE.PlaneGeometry(3.4, 30),
      new THREE.MeshStandardMaterial({ map: pathTex, roughness: 0.92, metalness: 0.08 })
    );
    path.rotation.x = -Math.PI / 2;
    path.position.set(0, 0.03, -2);
    this.root.add(path);

    const lanternCount = this.reduceMotion ? 4 : 6;
    for (let i = 0; i < lanternCount; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const z = -12 + i * 3.2;
      const lantern = this._makeLantern();
      lantern.position.set(side * 2.1, 0, z);
      this.root.add(lantern);
      if (this._pointLights.length < 8) {
        const pl = new THREE.PointLight(0xffb060, 0.65, 8, 2);
        pl.position.set(side * 2.1, 2.1, z);
        this.scene.add(pl);
        this._pointLights.push(pl);
      }
    }
  }

  _makeLantern() {
    const g = new THREE.Group();
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.1, 1.8, 6),
      new THREE.MeshStandardMaterial({ color: 0x2a2018, roughness: 0.9 })
    );
    post.position.y = 0.9;
    const lamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 10, 8),
      new THREE.MeshStandardMaterial({
        color: 0xffc878,
        emissive: 0xff9940,
        emissiveIntensity: 1.1,
        roughness: 0.4
      })
    );
    lamp.position.y = 2.05;
    const hat = new THREE.Mesh(
      new THREE.ConeGeometry(0.32, 0.28, 6),
      new THREE.MeshStandardMaterial({ color: 0x3a2a18, metalness: 0.4, roughness: 0.5 })
    );
    hat.position.y = 2.35;
    g.add(post, lamp, hat);
    return g;
  }

  _buildCastle() {
    this.castle = new THREE.Group();
    this.castle.position.set(0, 0, -15);

    const stone = new THREE.MeshStandardMaterial({
      color: 0x2c3548,
      roughness: 0.78,
      metalness: 0.22,
      emissive: 0x101828,
      emissiveIntensity: 0.22
    });
    const gold = new THREE.MeshStandardMaterial({
      color: 0xc9a45c,
      emissive: 0x664410,
      emissiveIntensity: 0.55,
      metalness: 0.72,
      roughness: 0.32
    });

    const keep = new THREE.Mesh(new THREE.BoxGeometry(9, 5.5, 6.5), stone);
    keep.position.y = 2.75;
    keep.castShadow = true;
    this.castle.add(keep);

    // battlements
    for (let i = -4; i <= 4; i++) {
      const merlon = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), stone);
      merlon.position.set(i * 1.0, 5.85, 3.1);
      this.castle.add(merlon);
    }

    // buttresses
    for (const x of [-4.2, 4.2]) {
      const butt = new THREE.Mesh(new THREE.BoxGeometry(1.1, 4.5, 1.4), stone);
      butt.position.set(x, 2.2, 2.8);
      this.castle.add(butt);
    }

    for (const x of [-5.2, 5.2]) {
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.55, 10, 8), stone);
      tower.position.set(x, 5, 1.2);
      tower.castShadow = true;
      this.castle.add(tower);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(1.9, 2.4, 8), gold);
      roof.position.set(x, 11.1, 1.2);
      this.castle.add(roof);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.08, 6, 16), gold);
      rim.position.set(x, 10.1, 1.2);
      rim.rotation.x = Math.PI / 2;
      this.castle.add(rim);
    }

    // arched gate frame
    const gateFrame = new THREE.Mesh(new THREE.BoxGeometry(3.2, 4.2, 1.2), stone);
    gateFrame.position.set(0, 2.1, 3.4);
    this.castle.add(gateFrame);
    const arch = new THREE.Mesh(
      new THREE.CylinderGeometry(1.35, 1.35, 1.3, 16, 1, false, 0, Math.PI),
      stone
    );
    arch.rotation.z = Math.PI / 2;
    arch.rotation.y = Math.PI / 2;
    arch.position.set(0, 4.0, 3.4);
    this.castle.add(arch);

    // portal energy
    const portalMat = new THREE.MeshBasicMaterial({
      color: 0x66ffe0,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    this.portalPlane = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 3.2), portalMat);
    this.portalPlane.position.set(0, 2.0, 4.05);
    this.castle.add(this.portalPlane);

    this.runeRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.35, 0.06, 8, 40),
      new THREE.MeshStandardMaterial({
        color: 0x88ffee,
        emissive: 0x44ffcc,
        emissiveIntensity: 1.35,
        metalness: 0.55,
        roughness: 0.2
      })
    );
    this.runeRing.position.set(0, 2.0, 4.15);
    this.castle.add(this.runeRing);

    // glowing windows
    this._windows = [];
    const winMat = new THREE.MeshStandardMaterial({
      color: 0xffcc66,
      emissive: 0xffaa33,
      emissiveIntensity: 1.4,
      roughness: 0.4
    });
    for (const [x, y, z] of [[-2.2, 3.2, 3.28], [2.2, 3.2, 3.28], [-2.2, 4.4, 3.28], [2.2, 4.4, 3.28], [-5.2, 6.5, 2.5], [5.2, 6.5, 2.5]]) {
      const w = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 0.7), winMat.clone());
      w.position.set(x, y, z);
      this.castle.add(w);
      this._windows.push(w);
    }

    this.root.add(this.castle);
  }

  _buildFireflies() {
    const n = this.reduceMotion ? 24 : 70;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 32;
      pos[i * 3 + 1] = 1 + Math.random() * 9;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 26 - 2;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const sprite = new THREE.CanvasTexture(makeSoftCircleSprite());
    const mat = new THREE.PointsMaterial({
      map: sprite,
      color: 0xffe6a0,
      size: 0.45,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true
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
      this.camera.position.x = 2.2 + Math.sin(t * 0.14) * 1.2;
      this.camera.position.y = 7.2 + Math.sin(t * 0.2) * 0.28;
      this.camera.lookAt(1.2, 3.4, -11);
      if (this.runeRing) this.runeRing.rotation.z = t * 0.85;
      if (this.portalPlane) this.portalPlane.material.opacity = 0.28 + Math.sin(t * 2.4) * 0.12;
      if (this.gateLight) this.gateLight.intensity = 2.0 + Math.sin(t * 2.1) * 0.55;
      if (this._windows) {
        this._windows.forEach((w, i) => {
          w.material.emissiveIntensity = 1.1 + Math.sin(t * 2 + i) * 0.35;
        });
      }
      if (this.fireflies) {
        const arr = this.fireflies.geometry.attributes.position.array;
        for (let i = 0; i < arr.length; i += 3) {
          arr[i + 1] += Math.sin(t * 1.5 + i) * 0.005;
        }
        this.fireflies.geometry.attributes.position.needsUpdate = true;
      }
    }
  }

  getFlyTargets() {
    return {
      fromPos: this.camera.position.clone(),
      fromTarget: new THREE.Vector3(1.2, 3.4, -11),
      toPos: new THREE.Vector3(0, 2.6, -11.2),
      toTarget: new THREE.Vector3(0, 2.0, -12.5)
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
