import Phaser from 'phaser';
import { ISOMETRIC_CONFIG } from '@core/GameConfig';
import {
  clipDiamond,
  createCanvasTexture,
  darken,
  drawSoftEllipse,
  drawTileShading,
  lighten,
  makeRng,
  paintGrassTuft,
  paintMottle,
  pick,
  randomPointInDiamond,
  range,
  rangeInt,
  rgbaStr,
  speckle,
  traceDiamond,
} from './ArtUtils';

const TILE_W = ISOMETRIC_CONFIG.tileWidth;
const TILE_H = ISOMETRIC_CONFIG.tileHeight;

interface GrassPalette {
  base: number;
  light: number;
  dark: number;
  blades: readonly string[];
  accents: readonly string[];
}

const GRASS_PALETTES: readonly GrassPalette[] = [
  {
    base: 0x7a7442,
    light: 0x918b4f,
    dark: 0x554b2c,
    blades: ['#857b47', '#978d52', '#6b6337', '#a59a5a', '#766f3f'],
    accents: ['#d9d09a', '#c9c08a', '#e6dfb3'],
  },
  {
    base: 0x756d3d,
    light: 0x89824a,
    dark: 0x50462a,
    blades: ['#7d7543', '#8a834b', '#5d5533', '#9a9355'],
    accents: ['#d4cc92', '#c4bc7f'],
  },
  {
    base: 0x817a46,
    light: 0x97904f,
    dark: 0x58522f,
    blades: ['#89814a', '#96904f', '#645d35', '#a9a25a'],
    accents: ['#e0d69c', '#d1c892', '#e8e0b0'],
  },
  {
    base: 0x7b7240,
    light: 0x90884d,
    dark: 0x534d2d,
    blades: ['#827a46', '#8e854c', '#5f5734', '#9f9656'],
    accents: ['#d6cd8a', '#e0d49e'],
  },
];

function paintGrassTile(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  variant: number,
): void {
  const rng = makeRng(7100 + variant * 131);
  const palette = GRASS_PALETTES[variant % GRASS_PALETTES.length]!;

  ctx.save();
  clipDiamond(ctx, width / 2, 0, width, height);

  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, rgbaStr(lighten(palette.base, 0.12)));
  gradient.addColorStop(0.55, rgbaStr(palette.base));
  gradient.addColorStop(1, rgbaStr(darken(palette.base, 0.16)));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  paintMottle(ctx, rng, width, height, palette.base, palette.light, palette.dark, 18);

  // Keep the base tile calm; per-cell scatter adds the natural variation so
  // the same painted tuft pattern does not read as a repeated carpet.
  for (let i = 0; i < 6 + (variant % 3); i++) {
    const point = randomPointInDiamond(rng, width / 2, 0, width, height, 0.95);
    paintGrassTuft(ctx, rng, point.x, point.y + 3, range(rng, 7, 16), palette.blades, rangeInt(rng, 3, 7));
  }

  speckle(
    ctx,
    rng,
    0,
    0,
    width,
    height,
    240,
    [rgbaStr(darken(palette.base, 0.22), 0.5), rgbaStr(lighten(palette.base, 0.22), 0.42)],
    0.5,
    1.4,
  );

  // Sparse dried flowers and seed heads for a more arid frontier look.
  for (let i = 0; i < 4; i++) {
    const point = randomPointInDiamond(rng, width / 2, 0, width, height, 0.85);
    ctx.fillStyle = pick(rng, palette.accents);
    ctx.beginPath();
    ctx.arc(point.x, point.y, range(rng, 0.7, 1.4), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(214, 206, 170, 0.45)';
    ctx.fillRect(point.x - 0.3, point.y - 0.3, 0.6, 0.6);
  }

  // Tiny stones and bare patches.
  for (let i = 0; i < 6; i++) {
    const point = randomPointInDiamond(rng, width / 2, 0, width, height, 0.8);
    ctx.fillStyle = 'rgba(94, 82, 60, 0.25)';
    ctx.beginPath();
    ctx.ellipse(point.x, point.y, range(rng, 1, 2.6), range(rng, 0.6, 1.4), 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
  drawTileShading(ctx, width, height, 0.24, 0.28);
}

function paintDirtTile(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  variant: number,
  road: boolean,
): void {
  const rng = makeRng((road ? 9200 : 8300) + variant * 173);
  const base = road ? 0x8d7346 : 0x856d44;
  const light = road ? 0xa68b5a : 0x9a7e54;
  const dark = road ? 0x56402a : 0x54402c;

  ctx.save();
  clipDiamond(ctx, width / 2, 0, width, height);

  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, rgbaStr(lighten(base, 0.12)));
  gradient.addColorStop(0.5, rgbaStr(base));
  gradient.addColorStop(1, rgbaStr(darken(base, 0.2)));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  paintMottle(ctx, rng, width, height, base, light, dark, 16);

  // Grit and small dust patches.
  speckle(
    ctx,
    rng,
    0,
    0,
    width,
    height,
    1600,
    ['rgba(54, 40, 24, 0.38)', 'rgba(196, 176, 138, 0.24)', 'rgba(108, 88, 58, 0.32)'],
    0.5,
    1.6,
  );

  if (road) {
    // Two wheel ruts follow the tile's long diagonal (the east-west road).
    for (const offset of [-6, 6]) {
      ctx.beginPath();
      ctx.moveTo(width * 0.04, height * 0.5 + offset);
      ctx.bezierCurveTo(
        width * 0.3,
        height * 0.5 + offset - 2.5,
        width * 0.68,
        height * 0.5 + offset + 2.5,
        width * 0.96,
        height * 0.5 + offset,
      );
      ctx.strokeStyle = 'rgba(58, 42, 26, 0.26)';
      ctx.lineWidth = 3.2;
      ctx.lineCap = 'round';
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(width * 0.06, height * 0.5 + offset - 1.6);
      ctx.lineTo(width * 0.94, height * 0.5 + offset - 1.6);
      ctx.strokeStyle = 'rgba(214, 194, 156, 0.09)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }

    // Central dust ridge.
    ctx.beginPath();
    ctx.moveTo(width * 0.14, height * 0.5);
    ctx.lineTo(width * 0.86, height * 0.5);
    ctx.strokeStyle = 'rgba(218, 196, 154, 0.06)';
    ctx.lineWidth = 7;
    ctx.stroke();
  }

  for (let i = 0; i < (road ? 16 : 22); i++) {
    const point = randomPointInDiamond(rng, width / 2, 0, width, height, 0.86);
    const rx = range(rng, 1.2, 3.2);
    const ry = rx * range(rng, 0.5, 0.75);
    ctx.fillStyle = pick(rng, ['rgba(96, 82, 60, 0.72)', 'rgba(116, 98, 74, 0.72)', 'rgba(76, 64, 46, 0.64)']);
    ctx.beginPath();
    ctx.ellipse(point.x, point.y, rx, ry, range(rng, -0.4, 0.4), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(220, 200, 162, 0.22)';
    ctx.beginPath();
    ctx.ellipse(point.x - rx * 0.25, point.y - ry * 0.3, rx * 0.5, ry * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Sparse dry tufts at the edges.
  for (let i = 0; i < 4; i++) {
    const point = randomPointInDiamond(rng, width / 2, 0, width, height, 0.92);
    paintGrassTuft(ctx, rng, point.x, point.y, range(rng, 4, 8), ['#8b864b', '#989158', '#706b39'], 3);
  }

  ctx.restore();
  drawTileShading(ctx, width, height, 0.18, 0.3);
}

function paintWaterTile(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  variant: number,
): void {
  const rng = makeRng(10400 + variant * 311);

  ctx.save();
  clipDiamond(ctx, width / 2, 0, width, height);

  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, '#6b7f6f');
  gradient.addColorStop(0.45, '#5a6b5a');
  gradient.addColorStop(1, '#3d4a3d');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  paintMottle(ctx, rng, width, height, 0x5a6b5a, 0x7b8973, 0x394139, 12);

  // Long horizontal ripples with dull crests.
  for (let i = 0; i < 22; i++) {
    const x = rng() * width;
    const y = rng() * height;
    const length = range(rng, 8, 30);
    ctx.beginPath();
    ctx.moveTo(x - length / 2, y);
    ctx.quadraticCurveTo(x, y - range(rng, 0.6, 2.0), x + length / 2, y);
    ctx.strokeStyle = `rgba(206, 214, 196, ${range(rng, 0.04, 0.14)})`;
    ctx.lineWidth = range(rng, 0.6, 1.4);
    ctx.stroke();
  }

  // Fainter glints.
  for (let i = 0; i < 10; i++) {
    const x = rng() * width;
    const y = rng() * height;
    const length = range(rng, 2, 7);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + length, y - 0.6);
    ctx.strokeStyle = `rgba(226, 232, 218, ${range(rng, 0.12, 0.32)})`;
    ctx.lineWidth = range(rng, 0.6, 1.2);
    ctx.stroke();
  }

  // Darker water at the bottom edge gives the surface depth.
  const depth = ctx.createLinearGradient(0, height * 0.6, 0, height);
  depth.addColorStop(0, 'rgba(26, 32, 24, 0)');
  depth.addColorStop(1, 'rgba(26, 32, 24, 0.42)');
  ctx.fillStyle = depth;
  ctx.fillRect(0, height * 0.6, width, height * 0.4);

  ctx.restore();
  traceDiamond(ctx, width / 2, 0, width, height);
  ctx.strokeStyle = 'rgba(32, 40, 30, 0.46)';
  ctx.lineWidth = 2;
  ctx.stroke();
}

function paintGrassTuftTexture(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  variant: number,
): void {
  const rng = makeRng(12000 + variant * 71);
  drawSoftEllipse(ctx, width / 2, height - 3, width * 0.34, height * 0.12, 0.24);
  const baseY = height - 2;
  for (let i = 0; i < 14; i++) {
    paintGrassTuft(
      ctx,
      rng,
      width / 2 + range(rng, -width * 0.28, width * 0.28),
      baseY,
      range(rng, height * 0.45, height * 0.95),
      variant === 0
        ? ['#7f9a4c', '#93ad59', '#5f7a38', '#a9bc6e']
        : ['#8b9c4d', '#a3ad5c', '#6f8039', '#b8bf74'],
      1,
    );
  }
}

function paintFlowerTexture(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  variant: number,
): void {
  const rng = makeRng(13000 + variant * 53);
  const baseX = width / 2;
  const baseY = height - 2;
  drawSoftEllipse(ctx, baseX, baseY, 5, 2, 0.18);

  for (let i = 0; i < 3; i++) {
    const stemX = baseX + range(rng, -6, 6);
    const topY = baseY - range(rng, 8, 14);
    ctx.beginPath();
    ctx.moveTo(stemX, baseY);
    ctx.quadraticCurveTo(stemX - 2, baseY - 6, stemX, topY);
    ctx.strokeStyle = '#5d7a36';
    ctx.lineWidth = 1.1;
    ctx.stroke();

    const petalColor = variant === 0 ? '#f0ead2' : '#c54a3d';
    for (let p = 0; p < 5; p++) {
      const angle = (p / 5) * Math.PI * 2 + rng();
      ctx.fillStyle = petalColor;
      ctx.beginPath();
      ctx.ellipse(
        stemX + Math.cos(angle) * 2.6,
        topY + Math.sin(angle) * 2,
        2.1,
        1.4,
        angle,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
    ctx.fillStyle = variant === 0 ? '#d6b64d' : '#4a3120';
    ctx.beginPath();
    ctx.arc(stemX, topY, 1.3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function paintPebbleTexture(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  variant: number,
): void {
  const rng = makeRng(14000 + variant * 37);
  drawSoftEllipse(ctx, width / 2, height - 3, width * 0.4, 2.5, 0.22);
  for (let i = 0; i < 3; i++) {
    const x = width / 2 + range(rng, -6, 6);
    const y = height - 4 - rng() * 5;
    const rx = range(rng, 2.4, 4.6);
    const ry = rx * range(rng, 0.55, 0.75);
    const shade = pick(rng, [0x7a7466, 0x686458, 0x8d8576]);
    const gradient = ctx.createLinearGradient(x - rx, y - ry, x + rx, y + ry);
    gradient.addColorStop(0, rgbaStr(lighten(shade, 0.28)));
    gradient.addColorStop(1, rgbaStr(darken(shade, 0.28)));
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, range(rng, -0.4, 0.4), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 250, 232, 0.3)';
    ctx.beginPath();
    ctx.ellipse(x - rx * 0.25, y - ry * 0.35, rx * 0.4, ry * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function paintReedsTexture(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): void {
  const rng = makeRng(15003);
  drawSoftEllipse(ctx, width / 2, height - 4, width * 0.3, 4, 0.22);
  for (let i = 0; i < 9; i++) {
    const baseX = width / 2 + range(rng, -width * 0.28, width * 0.28);
    const stemHeight = range(rng, height * 0.55, height * 0.94);
    const lean = range(rng, -7, 7);
    const topX = baseX + lean;
    const topY = height - 4 - stemHeight;
    ctx.beginPath();
    ctx.moveTo(baseX, height - 3);
    ctx.quadraticCurveTo(baseX + lean * 0.3, height - stemHeight * 0.55, topX, topY);
    ctx.strokeStyle = pick(rng, ['#6d7f3c', '#82914a', '#596b30']);
    ctx.lineWidth = range(rng, 1, 2);
    ctx.stroke();

    if (rng() > 0.45) {
      ctx.fillStyle = '#6b4a2b';
      ctx.beginPath();
      ctx.ellipse(topX, topY + 2, 1.7, 4.5, lean * 0.02, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(196, 154, 98, 0.35)';
      ctx.beginPath();
      ctx.ellipse(topX - 0.6, topY + 1, 0.6, 2.2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Long blade leaves at the base.
  for (let i = 0; i < 7; i++) {
    const baseX = width / 2 + range(rng, -width * 0.3, width * 0.3);
    const tipX = baseX + range(rng, -16, 16);
    const tipY = height - 4 - range(rng, 14, height * 0.5);
    ctx.beginPath();
    ctx.moveTo(baseX, height - 3);
    ctx.quadraticCurveTo(baseX + (tipX - baseX) * 0.2, (height + tipY) / 2, tipX, tipY);
    ctx.strokeStyle = pick(rng, ['#77883f', '#8b9a4c', '#617233']);
    ctx.lineWidth = range(rng, 1.4, 2.6);
    ctx.stroke();
  }
}

function paintWaterGlint(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  variant: number,
): void {
  const rng = makeRng(16000 + variant * 17);
  const gradient = ctx.createLinearGradient(0, height / 2, width, height / 2);
  gradient.addColorStop(0, 'rgba(235, 252, 248, 0)');
  gradient.addColorStop(0.5, `rgba(235, 252, 248, ${range(rng, 0.35, 0.65)})`);
  gradient.addColorStop(1, 'rgba(235, 252, 248, 0)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.ellipse(width / 2, height / 2, width / 2, range(rng, 1.2, 2.2), 0, 0, Math.PI * 2);
  ctx.fill();
}

/** Generates every ground tile, plant and scatter texture. */
export function generateTerrainArt(scene: Phaser.Scene): void {
  // A broader seeded set prevents the same few grass marks repeating as a
  // visible checker across large mobile-camera views.
  for (let i = 0; i < 16; i++) {
    createCanvasTexture(scene, `tile_grass_${i}`, TILE_W, TILE_H, (ctx, w, h) =>
      paintGrassTile(ctx, w, h, i));
  }
  for (let i = 0; i < 3; i++) {
    createCanvasTexture(scene, `tile_dirt_${i}`, TILE_W, TILE_H, (ctx, w, h) =>
      paintDirtTile(ctx, w, h, i, false));
    createCanvasTexture(scene, `tile_road_${i}`, TILE_W, TILE_H, (ctx, w, h) =>
      paintDirtTile(ctx, w, h, i, true));
    createCanvasTexture(scene, `tile_water_${i}`, TILE_W, TILE_H, (ctx, w, h) =>
      paintWaterTile(ctx, w, h, i));
  }
  for (let i = 0; i < 3; i++) {
    createCanvasTexture(scene, `decor_tuft_${i}`, 46, 32, (ctx, w, h) =>
      paintGrassTuftTexture(ctx, w, h, i));
    createCanvasTexture(scene, `water_glint_${i}`, 46, 12, (ctx, w, h) =>
      paintWaterGlint(ctx, w, h, i));
  }
  for (let i = 0; i < 2; i++) {
    createCanvasTexture(scene, `decor_flower_${i}`, 20, 22, (ctx, w, h) =>
      paintFlowerTexture(ctx, w, h, i));
    createCanvasTexture(scene, `decor_pebble_${i}`, 24, 16, (ctx, w, h) =>
      paintPebbleTexture(ctx, w, h, i));
  }
  createCanvasTexture(scene, 'decor_reeds', 64, 86, paintReedsTexture);
}

/** Total number of grass tile variants, exported for deterministic selection. */
export const GRASS_VARIANTS = 4;
export const DIRT_VARIANTS = 3;
export const WATER_VARIANTS = 3;
