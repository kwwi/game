import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { LobbyScene } from './LobbyScene.js';
import { BattleScene } from './BattleScene.js';
import { playEnterRoom } from './Transition.js';
import { preloadSpiritModels } from './pieces/CharacterFactory.js';
import { preloadBoardModels } from './BoardAssets.js';

const PIXEL_CAP = 1.75;

export function createApp(rootEl, opts = {}) {
  const reduceMotion = !!opts.reduceMotion;
  const renderer = new THREE.WebGLRenderer({
    antialias: !reduceMotion,
    alpha: true,
    powerPreference: 'high-performance'
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, PIXEL_CAP));
  renderer.setSize(rootEl.clientWidth || window.innerWidth, rootEl.clientHeight || window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = !reduceMotion;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.className = 'webgl-canvas';
  renderer.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;';
  rootEl.appendChild(renderer.domElement);

  const clock = new THREE.Clock();
  let mode = 'lobby';
  let raf = 0;
  let disposed = false;

  const lobby = new LobbyScene({ reduceMotion });
  const battle = new BattleScene({
    reduceMotion,
    onCellAction: opts.onCellAction,
    onHoverCell: opts.onHoverCell
  });

  const overlay = document.createElement('div');
  overlay.id = 'sceneTransitionOverlay';
  overlay.className = 'scene-transition-overlay';
  rootEl.appendChild(overlay);

  const size = new THREE.Vector2(rootEl.clientWidth || window.innerWidth, rootEl.clientHeight || window.innerHeight);
  const lobbyComposer = new EffectComposer(renderer);
  lobbyComposer.addPass(new RenderPass(lobby.scene, lobby.camera));
  const lobbyBloom = new UnrealBloomPass(size.clone(), reduceMotion ? 0.25 : 0.55, 0.6, 0.82);
  lobbyComposer.addPass(lobbyBloom);

  const battleComposer = new EffectComposer(renderer);
  battleComposer.addPass(new RenderPass(battle.scene, battle.camera));
  // Tighter bloom: gems / glyphs / spirit edges only — avoid blowing seals white
  const battleBloom = new UnrealBloomPass(size.clone(), reduceMotion ? 0.28 : 0.62, 0.5, 0.85);
  battleComposer.addPass(battleBloom);

  function resize() {
    const w = rootEl.clientWidth || window.innerWidth;
    const h = rootEl.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    lobby.resize(w, h);
    battle.resize(w, h);
    lobbyComposer.setSize(w, h);
    battleComposer.setSize(w, h);
    lobbyBloom.setSize(w, h);
    battleBloom.setSize(w, h);
  }

  function tick() {
    if (disposed) return;
    raf = requestAnimationFrame(tick);
    const dt = Math.min(0.05, clock.getDelta());
    if (mode === 'lobby' || mode === 'transition') lobby.update(dt);
    if (mode === 'battle' || mode === 'transition') battle.update(dt);

    if (mode === 'transition' && overlay.dataset.phase === 'battle') {
      battleComposer.render();
    } else if (mode === 'battle') {
      battleComposer.render();
    } else {
      lobbyComposer.render();
    }
  }

  function showLobby() {
    mode = 'lobby';
    battle.setInteractive(false);
    lobby.setActive(true);
    document.body.classList.remove('mode-battle');
    document.body.classList.add('mode-lobby');
  }

  function showBattle() {
    mode = 'battle';
    lobby.setActive(false);
    battle.setInteractive(true);
    document.body.classList.remove('mode-lobby');
    document.body.classList.add('mode-battle');
  }

  async function enterBattleWithTransition() {
    if (reduceMotion) {
      showBattle();
      return;
    }
    mode = 'transition';
    battle.setInteractive(false);
    await playEnterRoom({
      lobby,
      battle,
      overlay,
      renderer,
      duration: 1600
    });
    showBattle();
  }

  window.addEventListener('resize', resize);
  resize();
  showLobby();
  tick();

  const whenReady = Promise.all([
    preloadSpiritModels().catch((e) => console.warn('[spirits] preload', e)),
    preloadBoardModels().catch((e) => console.warn('[board] preload', e))
  ]).then(() => {
    battle._refreshPlatformFromAssets?.();
    // Rebuild board once if surface GLB arrived after initial procedural build
    if (battle._useGlbSurface === false) {
      battle._buildBoard(battle.rows, battle.cols);
    }
  });

  return {
    renderer,
    lobby,
    battle,
    whenReady,
    showLobby,
    showBattle,
    enterBattleWithTransition,
    resize,
    getMode: () => mode,
    setHandlers(handlers) {
      battle.setHandlers(handlers);
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      lobby.dispose();
      battle.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }
  };
}
