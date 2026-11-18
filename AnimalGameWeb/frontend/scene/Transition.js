import * as THREE from 'three';

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

export function playEnterRoom({ lobby, battle, overlay, duration = 1600 }) {
  return new Promise(resolve => {
    const fly = lobby.getFlyTargets();
    const start = performance.now();
    overlay.classList.add('show');
    overlay.dataset.phase = 'fly';
    overlay.style.opacity = '0';

    const cam = lobby.camera;
    const fromPos = fly.fromPos.clone();
    const toPos = fly.toPos.clone();
    const look = new THREE.Vector3();

    function frame(now) {
      const u = Math.min(1, (now - start) / duration);
      const e = easeInOut(u);

      if (u < 0.55) {
        const p = e / 0.55;
        cam.position.lerpVectors(fromPos, toPos, Math.min(1, p));
        look.lerpVectors(fly.fromTarget, fly.toTarget, Math.min(1, p));
        cam.lookAt(look);
        overlay.style.opacity = String(Math.max(0, (p - 0.35) / 0.45));
      } else {
        overlay.dataset.phase = 'battle';
        overlay.style.opacity = String(1 - (u - 0.55) / 0.45);
        // nudge battle camera in
        const bc = battle.camera;
        const base = battle.getDefaultCamera();
        bc.position.lerpVectors(
          new THREE.Vector3(base.x, base.y + 4, base.z + 6),
          new THREE.Vector3(base.x, base.y, base.z),
          (u - 0.55) / 0.45
        );
        bc.lookAt(0, 0, 0);
      }

      if (u < 1) {
        requestAnimationFrame(frame);
      } else {
        overlay.classList.remove('show');
        overlay.style.opacity = '0';
        overlay.dataset.phase = '';
        battle.resetCamera();
        resolve();
      }
    }
    requestAnimationFrame(frame);
  });
}
