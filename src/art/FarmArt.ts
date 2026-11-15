import Phaser from 'phaser';
import {
  clipDiamond,
  createCanvasTexture,
  darken,
  drawSoftEllipse,
  lighten,
  makeRng,
  paintGrassTuft,
  pick,
  range,
  rgbaStr,
  speckle,
} from './ArtUtils';

/**
 * Farm plots are painted slightly taller than a ground tile so mature crops
 * can rise above the soil without clipping.
 */
const PLOT_W = 128;
const PLOT_H = 128;
const DIAMOND_TOP = 64;
const DIAMOND_H = 64;
const DIAMOND_CENTER_Y = DIAMOND_TOP + DIAMOND_H / 2;

export const FARM_ANCHOR = { x: 0.5, y: DIAMOND_CENTER_Y / PLOT_H } as const;

type CropLook = 'wheat' | 'barley';

interface CropPalette {
  stem: readonly string[];
  head: string;
  headLight: string;
  headDark: string;
}

const CROPS: Record<CropLook, CropPalette> = {
  wheat: {
    stem: ['#8a9a43', '#9fae52', '#748539'],
    head: '#d9bb5f',
    headLight: '#efd98b',
    headDark: '#a98a35',
  },
  barley: {
    stem: ['#8b9a52', '#a3b063', '#75853f'],
    head: '#c8b878',
    headLight: '#e5d9a6',
    headDark: '#9b884a',
  },
};

function drawSoil(
  ctx: CanvasRenderingContext2D,
  rng: () => number,
  base: number,
  light: number,
  dark: number,
  rows: boolean,
): void {
  ctx.save();
  clipDiamond(ctx, PLOT_W / 2, DIAMOND_TOP, PLOT_W, DIAMOND_H);

  const gradient = ctx.createLinearGradient(0, DIAMOND_TOP, 0, DIAMOND_TOP + DIAMOND_H);
  gradient.addColorStop(0, rgbaStr(light));
  gradient.addColorStop(0.55, rgbaStr(base));
  gradient.addColorStop(1, rgbaStr(darken(base, 0.2)));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, DIAMOND_TOP, PLOT_W, DIAMOND_H);

  // Clods and grit.
  speckle(
    ctx,
    rng,
    0,
    DIAMOND_TOP,
    PLOT_W,
    DIAMOND_H,
    1200,
    [rgbaStr(darken(base, 0.3), 0.4), rgbaStr(lighten(base, 0.26), 0.4), rgbaStr(dark, 0.32)],
    0.6,
    2.2,
  );
  for (let i = 0; i < 26; i++) {
    const x = range(rng, 8, PLOT_W - 8);
    const y = range(rng, DIAMOND_TOP + 6, DIAMOND_TOP + DIAMOND_H - 4);
    const rx = range(rng, 1.4, 4);
    ctx.fillStyle = pick(rng, [rgbaStr(darken(base, 0.26)), rgbaStr(lighten(base, 0.2))]);
    ctx.beginPath();
    ctx.ellipse(x, y, rx, rx * 0.55, range(rng, -0.5, 0.5), 0, Math.PI * 2);
    ctx.fill();
  }

  if (rows) {
    // Furrows run along the east-west isometric axis.
    for (let offset = -PLOT_W; offset <= PLOT_W; offset += 11) {
      ctx.beginPath();
      ctx.moveTo(offset - 40, DIAMOND_TOP);
      ctx.lineTo(offset + 40, DIAMOND_TOP + DIAMOND_H);
      ctx.strokeStyle = rgbaStr(darken(base, 0.38), 0.55);
      ctx.lineWidth = 3.2;
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(offset - 38.5, DIAMOND_TOP + 1.6);
      ctx.lineTo(offset + 41.5, DIAMOND_TOP + DIAMOND_H + 1.6);
      ctx.strokeStyle = rgbaStr(lighten(base, 0.3), 0.35);
      ctx.lineWidth = 1.3;
      ctx.stroke();
    }
  }

  ctx.restore();

  // Crisp tile edge.
  ctx.beginPath();
  ctx.moveTo(PLOT_W / 2, DIAMOND_TOP);
  ctx.lineTo(PLOT_W, DIAMOND_TOP + DIAMOND_H / 2);
  ctx.lineTo(PLOT_W / 2, DIAMOND_TOP + DIAMOND_H);
  ctx.lineTo(0, DIAMOND_TOP + DIAMOND_H / 2);
  ctx.closePath();
  ctx.strokeStyle = 'rgba(44, 32, 16, 0.35)';
  ctx.lineWidth = 1.4;
  ctx.stroke();
}

function drawStakes(ctx: CanvasRenderingContext2D): void {
  const posts: ReadonlyArray<readonly [number, number]> = [
    [PLOT_W / 2, DIAMOND_TOP + 2],
    [PLOT_W / 2, DIAMOND_TOP + DIAMOND_H - 1],
    [3, DIAMOND_TOP + DIAMOND_H / 2],
    [PLOT_W - 3, DIAMOND_TOP + DIAMOND_H / 2],
  ];
  for (const [x, y] of posts) {
    drawSoftEllipse(ctx, x, y + 1, 4, 1.6, 0.28);
    ctx.fillStyle = '#5b4028';
    ctx.fillRect(x - 1.6, y - 16, 3.2, 17);
    ctx.fillStyle = '#8a663c';
    ctx.fillRect(x - 1.1, y - 15, 1.1, 15);
  }
  ctx.strokeStyle = 'rgba(158, 128, 78, 0.55)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(3, DIAMOND_TOP + DIAMOND_H / 2 - 12);
  ctx.lineTo(PLOT_W / 2, DIAMOND_TOP - 12);
  ctx.lineTo(PLOT_W - 3, DIAMOND_TOP + DIAMOND_H / 2 - 12);
  ctx.stroke();
}

function drawPlant(
  ctx: CanvasRenderingContext2D,
  rng: () => number,
  x: number,
  baseY: number,
  height: number,
  palette: CropPalette,
  mature: boolean,
): void {
  const lean = range(rng, -3, 3);
  ctx.beginPath();
  ctx.moveTo(x, baseY);
  ctx.quadraticCurveTo(x + lean * 0.4, baseY - height * 0.55, x + lean, baseY - height);
  ctx.strokeStyle = pick(rng, palette.stem);
  ctx.lineWidth = mature ? 1.8 : 1.4;
  ctx.lineCap = 'round';
  ctx.stroke();

  // Long blade leaves.
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(x + lean * 0.3, baseY - height * 0.35);
    ctx.quadraticCurveTo(
      x + side * 5,
      baseY - height * 0.55,
      x + side * range(rng, 5, 9),
      baseY - height * 0.7,
    );
    ctx.strokeStyle = pick(rng, palette.stem);
    ctx.lineWidth = 1.1;
    ctx.stroke();
  }

  if (!mature) return;

  // Grain head.
  const headY = baseY - height;
  const headX = x + lean;
  ctx.strokeStyle = palette.headDark;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(headX, headY + 9);
  ctx.lineTo(headX, headY - 2);
  ctx.stroke();

  for (let i = 0; i < 5; i++) {
    const y = headY + 1 - i * 2.4;
    for (const side of [-1, 1]) {
      ctx.fillStyle = side < 0 ? palette.headLight : palette.head;
      ctx.beginPath();
      ctx.ellipse(headX + side * 1.7, y, 1.5, 2.6, side * 0.45, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.fillStyle = palette.headLight;
  ctx.beginPath();
  ctx.ellipse(headX, headY - 12, 1.3, 2.6, 0, 0, Math.PI * 2);
  ctx.fill();
}

function paintCropRows(
  ctx: CanvasRenderingContext2D,
  rng: () => number,
  look: CropLook,
  stage: number,
  mature: boolean,
): void {
  const palette = CROPS[look];
  // Sow three diagonal rows that follow the furrows.
  for (let row = 0; row < 4; row++) {
    const rowOffset = -42 + row * 28;
    for (let i = 0; i < 7; i++) {
      const t = (i + 0.5) / 7;
      const x = 24 + t * 80 + rowOffset * 0.42 + range(rng, -3, 3);
      const y = DIAMOND_TOP + 14 + row * 12 + (x - PLOT_W / 2) * 0.18 + range(rng, -2, 2);
      if (mature) {
        drawPlant(ctx, rng, x, y, range(rng, 34, 48), palette, true);
      } else if (stage >= 0) {
        drawPlant(ctx, rng, x, y, 5 + stage * 5 + range(rng, -1.5, 1.5), palette, false);
      }
    }
  }
}

function paintLocked(ctx: CanvasRenderingContext2D): void {
  const rng = makeRng(70001);
  ctx.save();
  clipDiamond(ctx, PLOT_W / 2, DIAMOND_TOP, PLOT_W, DIAMOND_H);
  const gradient = ctx.createLinearGradient(0, DIAMOND_TOP, 0, DIAMOND_TOP + DIAMOND_H);
  gradient.addColorStop(0, '#7d8f4d');
  gradient.addColorStop(0.6, '#687c3d');
  gradient.addColorStop(1, '#4d602c');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, DIAMOND_TOP, PLOT_W, DIAMOND_H);

  for (let i = 0; i < 28; i++) {
    const x = range(rng, 4, PLOT_W - 4);
    const y = range(rng, DIAMOND_TOP + 6, DIAMOND_TOP + DIAMOND_H - 2);
    paintGrassTuft(ctx, rng, x, y, range(rng, 5, 15), ['#7e914a', '#91a457', '#5f7335', '#a7b769'], 3);
  }
  for (let i = 0; i < 6; i++) {
    const x = range(rng, 12, PLOT_W - 12);
    const y = range(rng, DIAMOND_TOP + 10, DIAMOND_TOP + DIAMOND_H - 6);
    ctx.fillStyle = pick(rng, ['#d8cb7c', '#c0b264']);
    ctx.beginPath();
    ctx.arc(x, y, range(rng, 1, 1.8), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  drawStakes(ctx);
}

function paintUntouched(ctx: CanvasRenderingContext2D): void {
  const rng = makeRng(70002);
  drawSoil(ctx, rng, 0x77893f, 0x94a557, 0x53642f, false);
  for (let i = 0; i < 18; i++) {
    const x = range(rng, 8, PLOT_W - 8);
    const y = range(rng, DIAMOND_TOP + 6, DIAMOND_TOP + DIAMOND_H - 2);
    paintGrassTuft(ctx, rng, x, y, range(rng, 5, 13), ['#7e914a', '#93a557', '#627435', '#a9ba6d'], 3);
  }
  drawStakes(ctx);
}

function paintPrepared(ctx: CanvasRenderingContext2D, seeded: boolean): void {
  const rng = makeRng(seeded ? 70004 : 70003);
  drawSoil(ctx, rng, 0x8a6a44, 0xa9895c, 0x5c4327, true);
  if (seeded) {
    for (let i = 0; i < 34; i++) {
      const x = range(rng, 14, PLOT_W - 14);
      const y = range(rng, DIAMOND_TOP + 12, DIAMOND_TOP + DIAMOND_H - 6);
      ctx.fillStyle = pick(rng, ['#4a3418', '#5c4220', '#6b4c26']);
      ctx.beginPath();
      ctx.ellipse(x, y, 1.4, 0.9, range(rng, -0.4, 0.4), 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function paintGrowing(ctx: CanvasRenderingContext2D, look: CropLook, stage: number): void {
  const rng = makeRng(70010 + stage * 13 + (look === 'barley' ? 5 : 0));
  drawSoil(ctx, rng, 0x86663f, 0xa58457, 0x594025, true);
  paintCropRows(ctx, rng, look, stage, false);
}

function paintReady(ctx: CanvasRenderingContext2D, look: CropLook): void {
  const rng = makeRng(70040 + (look === 'barley' ? 3 : 0));
  drawSoil(ctx, rng, 0x7d5f3b, 0x9c7c50, 0x513a24, true);
  paintCropRows(ctx, rng, look, 3, true);
  // A few fallen grains at the base.
  for (let i = 0; i < 24; i++) {
    ctx.fillStyle = pick(rng, [CROPS[look].head, CROPS[look].headLight, CROPS[look].headDark]);
    ctx.beginPath();
    ctx.ellipse(
      range(rng, 20, PLOT_W - 20),
      range(rng, DIAMOND_TOP + 24, DIAMOND_TOP + DIAMOND_H - 6),
      1.2,
      0.7,
      range(rng, -0.6, 0.6),
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
}

function paintHarvested(ctx: CanvasRenderingContext2D): void {
  const rng = makeRng(70060);
  drawSoil(ctx, rng, 0x7a5c39, 0x97784c, 0x4e3820, true);
  // Cut stubble.
  for (let i = 0; i < 46; i++) {
    const x = range(rng, 12, PLOT_W - 12);
    const y = range(rng, DIAMOND_TOP + 10, DIAMOND_TOP + DIAMOND_H - 4);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + range(rng, -1.5, 1.5), y - range(rng, 3, 7));
    ctx.strokeStyle = pick(rng, ['#b39a5e', '#96803f', '#c7b070']);
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }
}

/** Paints every farm plot state, including both crop varieties. */
export function generateFarmArt(scene: Phaser.Scene): void {
  const paint = (
    key: string,
    painter: (ctx: CanvasRenderingContext2D, width: number, height: number) => void,
  ): void => {
    createCanvasTexture(scene, key, PLOT_W, PLOT_H, painter);
  };

  paint('farm_locked', ctx => paintLocked(ctx));
  paint('farm_untouched', ctx => paintUntouched(ctx));
  paint('farm_prepared', ctx => paintPrepared(ctx, false));
  paint('farm_seeded', ctx => paintPrepared(ctx, true));
  paint('farm_harvested', ctx => paintHarvested(ctx));

  const crops: CropLook[] = ['wheat', 'barley'];
  for (const crop of crops) {
    for (let stage = 0; stage < 4; stage++) {
      paint(`farm_${crop}_grow_${stage}`, ctx => paintGrowing(ctx, crop, stage));
    }
    paint(`farm_${crop}_ready`, ctx => paintReady(ctx, crop));
  }
}
