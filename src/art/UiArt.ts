import Phaser from 'phaser';
import {
  createCanvasTexture,
  drawSoftEllipse,
  fillPolygon,
  lighten,
  makeRng,
  paintGrassTuft,
  pick,
  range,
  rgbaStr,
  darken,
} from './ArtUtils';

const MENU_W = 1600;
const MENU_H = 900;

function paintMenuBackground(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const rng = makeRng(61000);
  const horizon = height * 0.62;

  // Dawn sky.
  const sky = ctx.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, '#182433');
  sky.addColorStop(0.34, '#3d4150');
  sky.addColorStop(0.62, '#8a6350');
  sky.addColorStop(0.85, '#c98757');
  sky.addColorStop(1, '#e5ad6d');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, horizon + 2);

  // Sun glow low on the horizon.
  const sunX = width * 0.68;
  const sunY = horizon - 94;
  const glow = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 300);
  glow.addColorStop(0, 'rgba(255, 232, 170, 0.85)');
  glow.addColorStop(0.12, 'rgba(255, 208, 132, 0.5)');
  glow.addColorStop(0.5, 'rgba(232, 146, 84, 0.16)');
  glow.addColorStop(1, 'rgba(232, 146, 84, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, horizon);
  ctx.fillStyle = 'rgba(255, 244, 206, 0.9)';
  ctx.beginPath();
  ctx.arc(sunX, sunY, 24, 0, Math.PI * 2);
  ctx.fill();

  // Soft cloud bands.
  for (let i = 0; i < 16; i++) {
    const y = range(rng, 60, horizon - 160);
    const x = range(rng, -80, width + 80);
    const rx = range(rng, 70, 220);
    const ry = range(rng, 8, 26);
    const alpha = range(rng, 0.03, 0.1);
    const gradient = ctx.createLinearGradient(x - rx, y, x + rx, y);
    gradient.addColorStop(0, `rgba(240, 208, 172, 0)`);
    gradient.addColorStop(0.5, `rgba(244, 222, 190, ${alpha})`);
    gradient.addColorStop(1, `rgba(240, 208, 172, 0)`);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, range(rng, -0.06, 0.06), 0, Math.PI * 2);
    ctx.fill();
  }

  // Distant ridges in atmospheric haze.
  const ridges = [
    { y: horizon - 150, color: 'rgba(92, 92, 96, 0.4)', amp: 60, step: 220 },
    { y: horizon - 110, color: 'rgba(76, 76, 70, 0.55)', amp: 40, step: 170 },
    { y: horizon - 74, color: 'rgba(60, 58, 48, 0.7)', amp: 26, step: 130 },
  ];
  for (const ridge of ridges) {
    ctx.beginPath();
    ctx.moveTo(0, ridge.y + 40);
    for (let x = 0; x <= width; x += ridge.step) {
      ctx.quadraticCurveTo(
        x + ridge.step * 0.5,
        ridge.y - range(rng, ridge.amp * 0.3, ridge.amp),
        x + ridge.step,
        ridge.y + range(rng, -8, 12),
      );
    }
    ctx.lineTo(width, horizon);
    ctx.lineTo(0, horizon);
    ctx.closePath();
    ctx.fillStyle = ridge.color;
    ctx.fill();
  }

  // Village silhouette along the ridge.
  ctx.save();
  ctx.translate(0, horizon - 34);
  const silhouette = 'rgba(38, 31, 26, 0.92)';

  const drawHouse = (x: number, scale: number, roofColor = silhouette): void => {
    const w = 44 * scale;
    const h = 34 * scale;
    ctx.fillStyle = silhouette;
    ctx.fillRect(x - w / 2, -h, w, h + 8);
    ctx.fillStyle = roofColor;
    ctx.beginPath();
    ctx.moveTo(x - w * 0.64, -h);
    ctx.lineTo(x, -h - 26 * scale);
    ctx.lineTo(x + w * 0.64, -h);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 196, 118, 0.5)';
    ctx.fillRect(x - w * 0.18, -h * 0.62, 5 * scale, 7 * scale);
  };

  drawHouse(170, 1.2);
  drawHouse(250, 0.9);
  drawHouse(330, 1.4);
  drawHouse(1300, 1.25);
  drawHouse(1390, 0.85);
  drawHouse(1470, 1.1);

  // Mosque with dome and minaret.
  const mosqueX = 1160;
  ctx.fillStyle = silhouette;
  ctx.fillRect(mosqueX - 50, -58, 100, 66);
  ctx.beginPath();
  ctx.arc(mosqueX, -58, 38, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(mosqueX, -104);
  ctx.lineTo(mosqueX - 4, -92);
  ctx.lineTo(mosqueX + 4, -92);
  ctx.closePath();
  ctx.fillStyle = 'rgba(60, 50, 38, 0.95)';
  ctx.fill();
  ctx.fillStyle = silhouette;
  ctx.fillRect(mosqueX + 58, -128, 13, 136);
  ctx.beginPath();
  ctx.moveTo(mosqueX + 54, -128);
  ctx.lineTo(mosqueX + 64.5, -160);
  ctx.lineTo(mosqueX + 75, -128);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 196, 118, 0.4)';
  ctx.fillRect(mosqueX - 6, -70, 12, 18);

  // Cypress trees punctuating the skyline.
  for (const [treeX, treeH] of [[1040, 120], [1230, 90], [540, 74], [680, 58], [880, 48]] as const) {
    ctx.fillStyle = 'rgba(30, 36, 24, 0.9)';
    ctx.beginPath();
    ctx.ellipse(treeX, -treeH * 0.5, treeH * 0.16, treeH * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // Mid-ground field.
  const field = ctx.createLinearGradient(0, horizon - 20, 0, height);
  field.addColorStop(0, '#7b713c');
  field.addColorStop(0.4, '#565f2f');
  field.addColorStop(1, '#2c3a20');
  ctx.fillStyle = field;
  ctx.fillRect(0, horizon - 20, width, height - horizon + 20);

  // Field furrows converging toward the village.
  ctx.strokeStyle = 'rgba(28, 32, 18, 0.3)';
  for (let i = 0; i < 26; i++) {
    const x = range(rng, -200, width + 200);
    ctx.lineWidth = range(rng, 1, 6);
    ctx.beginPath();
    ctx.moveTo(x, height + 20);
    ctx.quadraticCurveTo(width * 0.5 + (x - width * 0.5) * 0.4, horizon + 120, width * 0.5 + (x - width * 0.5) * 0.08, horizon);
    ctx.stroke();
  }

  // Wheat in the foreground.
  for (let i = 0; i < 420; i++) {
    const x = range(rng, 0, width);
    const baseY = range(rng, horizon + 70, height + 10);
    const heightScale = 0.4 + (baseY - horizon) / (height - horizon);
    paintGrassTuft(
      ctx,
      rng,
      x,
      baseY,
      range(rng, 12, 34) * heightScale,
      ['#b39a4e', '#c7ad5c', '#8f7d3d', '#d8c072', '#6f6b34'],
      2,
    );
  }

  // Large foreground tree framing the left edge.
  ctx.save();
  ctx.translate(90, height - 40);
  const treeRng = makeRng(61002);
  ctx.fillStyle = '#2a2117';
  ctx.beginPath();
  ctx.moveTo(-14, 0);
  ctx.quadraticCurveTo(-6, -120, -18, -220);
  ctx.lineTo(20, -226);
  ctx.quadraticCurveTo(12, -110, 22, 0);
  ctx.closePath();
  ctx.fill();
  for (let i = 0; i < 26; i++) {
    const blobX = range(treeRng, -190, 150);
    const blobY = range(treeRng, -390, -160);
    const rx = range(treeRng, 42, 96);
    const ry = range(treeRng, 32, 70);
    const gradient = ctx.createRadialGradient(blobX - 20, blobY - 16, 0, blobX, blobY, rx);
    gradient.addColorStop(0, 'rgba(44, 64, 34, 0.95)');
    gradient.addColorStop(0.65, 'rgba(26, 42, 24, 0.96)');
    gradient.addColorStop(1, 'rgba(18, 30, 18, 0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(blobX, blobY, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // Warm haze and vignette.
  const haze = ctx.createLinearGradient(0, horizon - 100, 0, horizon + 180);
  haze.addColorStop(0, 'rgba(236, 160, 96, 0.16)');
  haze.addColorStop(0.5, 'rgba(236, 170, 110, 0.06)');
  haze.addColorStop(1, 'rgba(236, 170, 110, 0)');
  ctx.fillStyle = haze;
  ctx.fillRect(0, horizon - 100, width, 280);

  const vignette = ctx.createRadialGradient(width / 2, height * 0.46, height * 0.2, width / 2, height * 0.46, height * 0.9);
  vignette.addColorStop(0, 'rgba(8, 6, 4, 0)');
  vignette.addColorStop(0.6, 'rgba(8, 6, 4, 0.18)');
  vignette.addColorStop(1, 'rgba(8, 6, 4, 0.62)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);

  // Floating dust motes catching the light.
  for (let i = 0; i < 60; i++) {
    ctx.fillStyle = `rgba(255, 224, 170, ${range(rng, 0.04, 0.18)})`;
    ctx.beginPath();
    ctx.arc(range(rng, 0, width), range(rng, horizon - 120, height), range(rng, 0.7, 2), 0, Math.PI * 2);
    ctx.fill();
  }
}

function paintButton(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const rng = makeRng(62001);
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 5;
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, 'rgba(58, 44, 28, 0.94)');
  gradient.addColorStop(0.5, 'rgba(42, 31, 19, 0.96)');
  gradient.addColorStop(1, 'rgba(28, 20, 12, 0.97)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.roundRect(2, 2, width - 4, height - 4, 6);
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = 'rgba(201, 166, 72, 0.85)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(2, 2, width - 4, height - 4, 6);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(201, 166, 72, 0.25)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(7, 7, width - 14, height - 14, 4);
  ctx.stroke();

  // Corner diamonds.
  for (const [x, y] of [[15, 15], [width - 15, 15], [15, height - 15], [width - 15, height - 15]] as const) {
    ctx.fillStyle = 'rgba(214, 178, 90, 0.8)';
    ctx.beginPath();
    ctx.moveTo(x, y - 3.5);
    ctx.lineTo(x + 3.5, y);
    ctx.lineTo(x, y + 3.5);
    ctx.lineTo(x - 3.5, y);
    ctx.closePath();
    ctx.fill();
  }

  // Subtle grain.
  for (let i = 0; i < 160; i++) {
    ctx.fillStyle = 'rgba(220, 190, 130, 0.045)';
    ctx.fillRect(rng() * width, rng() * height, 1.5, 1);
  }
}

function paintCoin(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const cx = width / 2;
  const cy = height / 2;
  const gradient = ctx.createRadialGradient(cx - 3, cy - 4, 1, cx, cy, width / 2);
  gradient.addColorStop(0, '#f2d987');
  gradient.addColorStop(0.6, '#c9a648');
  gradient.addColorStop(1, '#8a6a28');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(cx, cy, width * 0.42, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(90, 66, 22, 0.8)';
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255, 244, 194, 0.55)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, width * 0.3, 0, Math.PI * 2);
  ctx.stroke();
}

function paintWheatIcon(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  barley: boolean,
): void {
  const cx = width / 2;
  const base = height - 4;
  ctx.strokeStyle = barley ? '#b09a5a' : '#c9a648';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(cx, base);
  ctx.quadraticCurveTo(cx - 1, height * 0.45, cx + 1, height * 0.2);
  ctx.stroke();
  for (let i = 0; i < 4; i++) {
    const y = 5 + i * 4.4;
    const spread = 4.2 - i * 0.4;
    ctx.fillStyle = barley ? '#c6b06a' : '#d9b957';
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(cx + dir * spread, y + 2, 2.1, 3.5, dir * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.fillStyle = barley ? '#d6c282' : '#efd17c';
  ctx.beginPath();
  ctx.ellipse(cx + 1, height * 0.18, 2, 3.4, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** UI, menu and atmosphere textures. */
export function generateUiArt(scene: Phaser.Scene): void {
  // Behind the baked ground chunks. Fills the area beyond the map edge with a
  // misty, mossy depth so the settlement never floats on a flat void.
  createCanvasTexture(scene, 'fx_backdrop', 512, 512, (ctx, width, height) => {
    const rng = makeRng(60500);
    const base = ctx.createRadialGradient(
      width * 0.5,
      height * 0.32,
      height * 0.08,
      width * 0.5,
      height * 0.42,
      height * 0.85,
    );
    base.addColorStop(0, '#3c4a2e');
    base.addColorStop(0.45, '#2b3622');
    base.addColorStop(0.8, '#1a2317');
    base.addColorStop(1, '#0d120c');
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, width, height);

    // Low haze band, like distant fields catching the morning light.
    const haze = ctx.createLinearGradient(0, height * 0.2, 0, height * 0.72);
    haze.addColorStop(0, 'rgba(154, 168, 116, 0.11)');
    haze.addColorStop(0.55, 'rgba(108, 126, 82, 0.05)');
    haze.addColorStop(1, 'rgba(40, 52, 32, 0)');
    ctx.fillStyle = haze;
    ctx.fillRect(0, height * 0.2, width, height * 0.52);

    for (let i = 0; i < 700; i++) {
      ctx.fillStyle = pick(rng, ['rgba(180, 192, 140, 0.035)', 'rgba(10, 14, 9, 0.06)']);
      const x = rng() * width;
      const y = rng() * height;
      ctx.fillRect(x, y, range(rng, 1, 3), range(rng, 1, 2));
    }
  });
  createCanvasTexture(scene, 'menu_background', MENU_W, MENU_H, paintMenuBackground);
  createCanvasTexture(scene, 'ui_button', 360, 68, paintButton);
  createCanvasTexture(scene, 'icon_coin', 28, 28, paintCoin);
  createCanvasTexture(scene, 'icon_wheat', 28, 28, (ctx, w, h) => paintWheatIcon(ctx, w, h, false));
  createCanvasTexture(scene, 'icon_barley', 28, 28, (ctx, w, h) => paintWheatIcon(ctx, w, h, true));

  createCanvasTexture(scene, 'fx_vignette', 512, 512, (ctx, width, height) => {
    const gradient = ctx.createRadialGradient(
      width / 2,
      height / 2,
      height * 0.18,
      width / 2,
      height / 2,
      height * 0.72,
    );
    gradient.addColorStop(0, 'rgba(10, 8, 4, 0)');
    gradient.addColorStop(0.62, 'rgba(10, 8, 4, 0.05)');
    gradient.addColorStop(1, 'rgba(10, 8, 4, 0.52)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    const top = ctx.createLinearGradient(0, 0, 0, height * 0.22);
    top.addColorStop(0, 'rgba(8, 6, 3, 0.34)');
    top.addColorStop(1, 'rgba(8, 6, 3, 0)');
    ctx.fillStyle = top;
    ctx.fillRect(0, 0, width, height * 0.22);

    const bottom = ctx.createLinearGradient(0, height * 0.8, 0, height);
    bottom.addColorStop(0, 'rgba(8, 6, 3, 0)');
    bottom.addColorStop(1, 'rgba(8, 6, 3, 0.3)');
    ctx.fillStyle = bottom;
    ctx.fillRect(0, height * 0.8, width, height * 0.2);
  });

  createCanvasTexture(scene, 'fx_sunbeam', 512, 512, (ctx, width, height) => {
    const gradient = ctx.createLinearGradient(0, 0, width * 0.7, height);
    gradient.addColorStop(0, 'rgba(255, 232, 168, 0.16)');
    gradient.addColorStop(0.45, 'rgba(255, 220, 150, 0.05)');
    gradient.addColorStop(1, 'rgba(255, 220, 150, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  });

  createCanvasTexture(scene, 'fx_selection', 128, 64, (ctx) => {
    drawSoftEllipse(ctx, 64, 32, 30, 13, 0.3);
    ctx.strokeStyle = 'rgba(226, 196, 110, 0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(64, 32, 32, 14, 0, 0, Math.PI * 2);
    ctx.stroke();
  });

  createCanvasTexture(scene, 'ui_panel', 512, 256, (ctx, width, height) => {
    const rng = makeRng(63001);
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, 'rgba(46, 34, 21, 0.96)');
    gradient.addColorStop(0.5, 'rgba(32, 23, 14, 0.96)');
    gradient.addColorStop(1, 'rgba(22, 16, 10, 0.96)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.roundRect(2, 2, width - 4, height - 4, 10);
    ctx.fill();
    ctx.strokeStyle = 'rgba(201, 166, 72, 0.65)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(2, 2, width - 4, height - 4, 10);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(201, 166, 72, 0.18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(9, 9, width - 18, height - 18, 6);
    ctx.stroke();
    for (let i = 0; i < 260; i++) {
      ctx.fillStyle = pick(rng, ['rgba(226, 196, 130, 0.03)', 'rgba(20, 14, 8, 0.05)']);
      ctx.fillRect(rng() * width, rng() * height, 2, 1);
    }
    // Parchment corners.
    ctx.fillStyle = 'rgba(214, 178, 90, 0.7)';
    for (const [x, y] of [[12, 12], [width - 12, 12], [12, height - 12], [width - 12, height - 12]] as const) {
      ctx.beginPath();
      ctx.moveTo(x, y - 3);
      ctx.lineTo(x + 3, y);
      ctx.lineTo(x, y + 3);
      ctx.lineTo(x - 3, y);
      ctx.closePath();
      ctx.fill();
    }
  });

  createCanvasTexture(scene, 'ui_ribbon', 420, 54, (ctx, width, height) => {
    const gradient = ctx.createLinearGradient(0, 0, width, 0);
    gradient.addColorStop(0, 'rgba(58, 38, 22, 0)');
    gradient.addColorStop(0.18, 'rgba(58, 38, 22, 0.9)');
    gradient.addColorStop(0.82, 'rgba(58, 38, 22, 0.9)');
    gradient.addColorStop(1, 'rgba(58, 38, 22, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = 'rgba(201, 166, 72, 0.55)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(40, 6);
    ctx.lineTo(width - 40, 6);
    ctx.moveTo(40, height - 6);
    ctx.lineTo(width - 40, height - 6);
    ctx.stroke();
    ctx.fillStyle = 'rgba(214, 178, 90, 0.85)';
    for (const x of [24, width - 24]) {
      ctx.beginPath();
      ctx.moveTo(x, height / 2 - 5);
      ctx.lineTo(x + 5, height / 2);
      ctx.lineTo(x, height / 2 + 5);
      ctx.lineTo(x - 5, height / 2);
      ctx.closePath();
      ctx.fill();
    }
  });
  void lighten;
  void darken;
  void rgbaStr;
  void fillPolygon;
}
