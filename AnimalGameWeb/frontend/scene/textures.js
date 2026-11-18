/** Procedural canvas textures for lobby / battle (no external image packs). */

export function makeNoiseCanvas(size = 256, opts = {}) {
  const {
    base = [28, 40, 36],
    variance = 28,
    crack = true,
    goldVeins = false
  } = opts;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const n = (Math.sin(x * 0.11) * Math.cos(y * 0.09) + Math.sin((x + y) * 0.07)) * 0.5;
      const v = (n + 1) * 0.5;
      const j = (Math.random() - 0.5) * variance;
      img.data[i] = Math.max(0, Math.min(255, base[0] + v * 18 + j));
      img.data[i + 1] = Math.max(0, Math.min(255, base[1] + v * 22 + j));
      img.data[i + 2] = Math.max(0, Math.min(255, base[2] + v * 16 + j * 0.6));
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  if (crack) {
    ctx.strokeStyle = 'rgba(10,14,12,0.35)';
    ctx.lineWidth = 1;
    for (let k = 0; k < 14; k++) {
      ctx.beginPath();
      let x = Math.random() * size;
      let y = Math.random() * size;
      ctx.moveTo(x, y);
      for (let s = 0; s < 6; s++) {
        x += (Math.random() - 0.5) * 40;
        y += (Math.random() - 0.5) * 40;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }
  if (goldVeins) {
    ctx.strokeStyle = 'rgba(201,164,92,0.28)';
    ctx.lineWidth = 1.2;
    for (let k = 0; k < 8; k++) {
      ctx.beginPath();
      ctx.moveTo(Math.random() * size, Math.random() * size);
      ctx.quadraticCurveTo(
        Math.random() * size,
        Math.random() * size,
        Math.random() * size,
        Math.random() * size
      );
      ctx.stroke();
    }
  }
  return canvas;
}

export function makeSkyGradientCanvas(w = 4, h = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#140828');
  g.addColorStop(0.28, '#1a1848');
  g.addColorStop(0.55, '#243060');
  g.addColorStop(0.78, '#3a5080');
  g.addColorStop(1, '#a8c0d8');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  return canvas;
}

/** Soft nebula blotches for additive sky planes. */
export function makeNebulaCanvas(size = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, size, size);
  const blobs = [
    { x: 0.35, y: 0.4, r: 0.45, c: 'rgba(160,60,180,0.55)' },
    { x: 0.65, y: 0.35, r: 0.4, c: 'rgba(40,120,200,0.5)' },
    { x: 0.5, y: 0.55, r: 0.35, c: 'rgba(200,120,80,0.28)' }
  ];
  blobs.forEach(b => {
    const g = ctx.createRadialGradient(
      b.x * size, b.y * size, 0,
      b.x * size, b.y * size, b.r * size
    );
    g.addColorStop(0, b.c);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  });
  return canvas;
}

export function makeSoftCircleSprite(size = 64) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,240,200,1)');
  g.addColorStop(0.35, 'rgba(255,220,140,0.55)');
  g.addColorStop(1, 'rgba(255,200,100,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return canvas;
}

export function makeGlyphTexture(zh, color = '#f0d9a0', bg = 'rgba(20,12,8,0.75)') {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 128, 128);
  ctx.beginPath();
  ctx.arc(64, 64, 54, 0, Math.PI * 2);
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.font = 'bold 56px "Noto Serif SC", "ZCOOL XiaoWei", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = color;
  ctx.shadowBlur = 12;
  ctx.fillText(zh || '?', 64, 66);
  return canvas;
}
