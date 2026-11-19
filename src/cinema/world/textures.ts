import * as THREE from 'three';

export function createNeonSignTexture(
  title: string,
  subtitle: string,
  primaryHex: string,
  secondaryHex: string,
  width = 512,
  height = 256
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // Dark brushed backing panel
  ctx.fillStyle = '#090612';
  ctx.fillRect(0, 0, width, height);

  // Subtle horizontal scanlines
  ctx.fillStyle = 'rgba(255,255,255,0.03)';
  for (let y = 0; y < height; y += 6) {
    ctx.fillRect(0, y, width, 2);
  }

  // Glowing outer neon border
  ctx.save();
  ctx.strokeStyle = secondaryHex;
  ctx.lineWidth = 6;
  ctx.shadowColor = secondaryHex;
  ctx.shadowBlur = 22;
  ctx.strokeRect(14, 14, width - 28, height - 28);
  ctx.restore();

  // Inner thin accent frame
  ctx.strokeStyle = primaryHex;
  ctx.lineWidth = 2;
  ctx.strokeRect(24, 24, width - 48, height - 48);

  // Main neon title
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `900 ${Math.floor(height * 0.30)}px "Impact", "Arial Black", sans-serif`;
  ctx.shadowColor = primaryHex;
  ctx.shadowBlur = 28;
  ctx.fillStyle = primaryHex;
  ctx.fillText(title, width / 2, height * 0.44);
  // Hot white inner tube core
  ctx.shadowBlur = 6;
  ctx.fillStyle = '#ffffff';
  ctx.globalAlpha = 0.72;
  ctx.fillText(title, width / 2, height * 0.44);
  ctx.restore();

  // Subtitle
  if (subtitle) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `700 ${Math.floor(height * 0.13)}px "Segoe UI", system-ui, sans-serif`;
    ctx.shadowColor = secondaryHex;
    ctx.shadowBlur = 16;
    ctx.fillStyle = secondaryHex;
    ctx.fillText(subtitle, width / 2, height * 0.74);
    ctx.restore();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function createSkyscraperWindowTexture(
  seed: number,
  accentA: string,
  accentB: string
): { map: THREE.CanvasTexture; emissiveMap: THREE.CanvasTexture } {
  const w = 256;
  const h = 512;

  const diffuseCanvas = document.createElement('canvas');
  diffuseCanvas.width = w;
  diffuseCanvas.height = h;
  const dCtx = diffuseCanvas.getContext('2d')!;

  const emissiveCanvas = document.createElement('canvas');
  emissiveCanvas.width = w;
  emissiveCanvas.height = h;
  const eCtx = emissiveCanvas.getContext('2d')!;

  // Dark glass skyscraper facade base
  dCtx.fillStyle = '#111524';
  dCtx.fillRect(0, 0, w, h);
  eCtx.fillStyle = '#000000';
  eCtx.fillRect(0, 0, w, h);

  let s = seed * 9301 + 49297;
  const rand = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };

  const cols = 8;
  const rows = 28;
  const padX = 5;
  const padY = 4;
  const cellW = w / cols;
  const cellH = h / rows;

  for (let r = 0; r < rows; r++) {
    const floorLitProb = r < 2 || r > rows - 3 ? 0.82 : 0.35 + rand() * 0.32;
    const isMechanicalFloor = r === Math.floor(rows * 0.5) && rand() > 0.5;
    for (let c = 0; c < cols; c++) {
      const rx = c * cellW + padX;
      const ry = r * cellH + padY;
      const rw = cellW - padX * 2;
      const rh = cellH - padY * 2;

      // Subtle glass reflection tint on diffuse
      dCtx.fillStyle = '#1b2238';
      dCtx.fillRect(rx, ry, rw, rh);

      if (isMechanicalFloor) continue;
      if (rand() < floorLitProb) {
        const pick = rand();
        let color = '#ffcf86'; // warm golden penthouse/office
        if (pick < 0.22) color = accentA;
        else if (pick < 0.36) color = accentB;
        else if (pick < 0.56) color = '#ffe8c8';

        const brightness = 0.45 + rand() * 0.55;
        eCtx.globalAlpha = brightness;
        eCtx.fillStyle = color;
        eCtx.fillRect(rx, ry, rw, rh);

        // Interior room blind/furniture variation
        if (rand() > 0.45) {
          eCtx.fillStyle = '#090b12';
          eCtx.globalAlpha = 0.35;
          eCtx.fillRect(rx, ry, rw, rh * (0.25 + rand() * 0.3));
        }
        eCtx.globalAlpha = 1.0;

        dCtx.fillStyle = color;
        dCtx.globalAlpha = 0.65;
        dCtx.fillRect(rx, ry, rw, rh);
        dCtx.globalAlpha = 1.0;
      }
    }
  }

  // Vertical glass mullion highlights
  dCtx.fillStyle = 'rgba(130, 170, 235, 0.14)';
  for (let c = 0; c <= cols; c++) {
    dCtx.fillRect(c * cellW - 1, 0, 2, h);
  }

  const map = new THREE.CanvasTexture(diffuseCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;

  const emissiveMap = new THREE.CanvasTexture(emissiveCanvas);
  emissiveMap.colorSpace = THREE.SRGBColorSpace;
  emissiveMap.wrapS = THREE.RepeatWrapping;
  emissiveMap.wrapT = THREE.RepeatWrapping;

  return { map, emissiveMap };
}

export function createArtDecoWindowTexture(seed: number, wallHex: string, neonHex: string): {
  map: THREE.CanvasTexture;
  emissiveMap: THREE.CanvasTexture;
} {
  const w = 256;
  const h = 256;
  const dCanvas = document.createElement('canvas');
  dCanvas.width = w;
  dCanvas.height = h;
  const dCtx = dCanvas.getContext('2d')!;

  const eCanvas = document.createElement('canvas');
  eCanvas.width = w;
  eCanvas.height = h;
  const eCtx = eCanvas.getContext('2d')!;

  dCtx.fillStyle = wallHex;
  dCtx.fillRect(0, 0, w, h);
  eCtx.fillStyle = '#000000';
  eCtx.fillRect(0, 0, w, h);

  let s = seed * 3571 + 19937;
  const rand = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };

  // Horizontal Art Deco architectural eyebrow trim lines
  const rows = 4;
  const cols = 5;
  const cellW = w / cols;
  const cellH = h / rows;

  for (let r = 0; r < rows; r++) {
    const bandY = r * cellH;
    dCtx.fillStyle = 'rgba(255,255,255,0.22)';
    dCtx.fillRect(0, bandY, w, 5);

    if (r === 0 || r === rows - 1) {
      eCtx.fillStyle = neonHex;
      eCtx.globalAlpha = 0.75;
      eCtx.fillRect(0, bandY + 2, w, 3);
      eCtx.globalAlpha = 1.0;
    }

    for (let c = 0; c < cols; c++) {
      const wx = c * cellW + 9;
      const wy = bandY + 14;
      const ww = cellW - 18;
      const wh = cellH - 24;

      dCtx.fillStyle = '#181428';
      dCtx.fillRect(wx, wy, ww, wh);

      // Warm hotel room glow
      if (r === rows - 1 || rand() < 0.62) {
        const col = r === rows - 1 ? '#ffd89a' : rand() > 0.25 ? '#ffc478' : neonHex;
        eCtx.fillStyle = col;
        eCtx.globalAlpha = 0.55 + rand() * 0.45;
        eCtx.fillRect(wx + 2, wy + 2, ww - 4, wh - 4);
        eCtx.globalAlpha = 1.0;

        dCtx.fillStyle = col;
        dCtx.globalAlpha = 0.75;
        dCtx.fillRect(wx + 2, wy + 2, ww - 4, wh - 4);
        dCtx.globalAlpha = 1.0;
      }
    }
  }

  const map = new THREE.CanvasTexture(dCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  const emissiveMap = new THREE.CanvasTexture(eCanvas);
  emissiveMap.colorSpace = THREE.SRGBColorSpace;
  return { map, emissiveMap };
}
