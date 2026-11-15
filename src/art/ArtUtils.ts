import Phaser from 'phaser';

/**
 * Drawing helpers shared by the procedural art painters.
 *
 * The game ships without binary art, so every texture is painted into a
 * canvas at boot. These helpers keep the painters deterministic (same seed ->
 * same texture) and give them a small vocabulary for lighting, grain and
 * isometric shapes.
 */

export type Painter = (ctx: CanvasRenderingContext2D, width: number, height: number) => void;

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export function createCanvasTexture(
  scene: Phaser.Scene,
  key: string,
  width: number,
  height: number,
  painter: Painter,
): void {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const texture = scene.textures.createCanvas(key, width, height);
  if (!texture) {
    console.warn(`Could not create canvas texture ${key}`);
    return;
  }
  const ctx = texture.getContext();
  ctx.save();
  ctx.clearRect(0, 0, width, height);
  painter(ctx, width, height);
  ctx.restore();
  texture.refresh();
}

/** Deterministic 32-bit PRNG (mulberry32). */
export function makeRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Random float in [min, max). */
export function range(rng: () => number, min: number, max: number): number {
  return min + rng() * (max - min);
}

/** Random integer in [min, max]. */
export function rangeInt(rng: () => number, min: number, max: number): number {
  return Math.floor(range(rng, min, max + 1));
}

export function pick<T>(rng: () => number, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length) % items.length]!;
}

/* ------------------------------------------------------------------ colour */

export function hexToRgb(hex: number): Rgb {
  return {
    r: (hex >> 16) & 0xff,
    g: (hex >> 8) & 0xff,
    b: hex & 0xff,
  };
}

export function rgba(hex: number, alpha = 1): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function rgbaStr(color: Rgb | number, alpha = 1): string {
  const rgb = typeof color === 'number' ? hexToRgb(color) : color;
  return `rgba(${Math.round(rgb.r)}, ${Math.round(rgb.g)}, ${Math.round(rgb.b)}, ${alpha})`;
}

/** Mixes two colours; amount 0 -> a, 1 -> b. */
export function mix(a: number, b: number, amount: number): Rgb {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  return {
    r: ca.r + (cb.r - ca.r) * amount,
    g: ca.g + (cb.g - ca.g) * amount,
    b: ca.b + (cb.b - ca.b) * amount,
  };
}

export function lighten(color: Rgb | number, amount: number): Rgb {
  const value = typeof color === 'number' ? color : (Math.round(color.r) << 16) | (Math.round(color.g) << 8) | Math.round(color.b);
  return mix(value, 0xffffff, amount);
}

export function darken(color: Rgb | number, amount: number): Rgb {
  const value = typeof color === 'number' ? color : (Math.round(color.r) << 16) | (Math.round(color.g) << 8) | Math.round(color.b);
  return mix(value, 0x000000, amount);
}

/* ------------------------------------------------------------------- noise */

function hash2(x: number, y: number, seed: number): number {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

/** Smooth value noise in [0, 1]. */
export function noise2D(x: number, y: number, seed = 1): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = smooth(x - x0);
  const fy = smooth(y - y0);
  const a = hash2(x0, y0, seed);
  const b = hash2(x0 + 1, y0, seed);
  const c = hash2(x0, y0 + 1, seed);
  const d = hash2(x0 + 1, y0 + 1, seed);
  const top = a + (b - a) * fx;
  const bottom = c + (d - c) * fx;
  return top + (bottom - top) * fy;
}

/** Fractal value noise, useful for plaster, stone and organic mottling. */
export function fbm(x: number, y: number, seed = 1, octaves = 4): number {
  let value = 0;
  let amplitude = 0.5;
  let frequency = 1;
  let total = 0;
  for (let i = 0; i < octaves; i++) {
    value += noise2D(x * frequency, y * frequency, seed + i * 37) * amplitude;
    total += amplitude;
    frequency *= 2;
    amplitude *= 0.5;
  }
  return value / total;
}

/* ------------------------------------------------------------------ shapes */

/** Diamonds are drawn with the top corner at (cx, cy). */
export function traceDiamond(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  width: number,
  height: number,
): void {
  const halfW = width / 2;
  const halfH = height / 2;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + halfW, cy + halfH);
  ctx.lineTo(cx, cy + height);
  ctx.lineTo(cx - halfW, cy + halfH);
  ctx.closePath();
}

export function clipDiamond(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  width: number,
  height: number,
): void {
  traceDiamond(ctx, cx, cy, width, height);
  ctx.clip();
}

/** Point inside a diamond whose top corner is (cx, cy). */
export function randomPointInDiamond(
  rng: () => number,
  cx: number,
  cy: number,
  width: number,
  height: number,
  inset = 0.94,
): { x: number; y: number } {
  const halfW = (width / 2) * inset;
  const halfH = (height / 2) * inset;
  const centerY = cy + height / 2;
  for (let attempt = 0; attempt < 20; attempt++) {
    const dx = range(rng, -halfW, halfW);
    const dy = range(rng, -halfH, halfH);
    if (Math.abs(dx) / halfW + Math.abs(dy) / halfH <= 1) {
      return { x: cx + dx, y: centerY + dy };
    }
  }
  return { x: cx, y: centerY };
}

export function fillPolygon(
  ctx: CanvasRenderingContext2D,
  points: ReadonlyArray<readonly [number, number]>,
  fill: string | CanvasGradient,
): void {
  ctx.beginPath();
  points.forEach(([x, y], index) => {
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

export function strokePolygon(
  ctx: CanvasRenderingContext2D,
  points: ReadonlyArray<readonly [number, number]>,
  stroke: string,
  width = 1,
): void {
  ctx.beginPath();
  points.forEach(([x, y], index) => {
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = width;
  ctx.stroke();
}

export function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

/* ------------------------------------------------------------------- light */

/** Soft elliptical shadow centred at (x, y). */
export function drawSoftEllipse(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radiusX: number,
  radiusY: number,
  alpha = 0.3,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, radiusY / radiusX);
  const gradient = ctx.createRadialGradient(0, 0, radiusX * 0.1, 0, 0, radiusX);
  gradient.addColorStop(0, `rgba(18, 12, 6, ${alpha})`);
  gradient.addColorStop(0.55, `rgba(18, 12, 6, ${alpha * 0.55})`);
  gradient.addColorStop(1, 'rgba(18, 12, 6, 0)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(0, 0, radiusX, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Grainy speckle fill, clipped by the caller. */
export function speckle(
  ctx: CanvasRenderingContext2D,
  rng: () => number,
  x: number,
  y: number,
  width: number,
  height: number,
  count: number,
  colors: readonly string[],
  sizeMin = 0.5,
  sizeMax = 1.8,
): void {
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = pick(rng, colors);
    const s = range(rng, sizeMin, sizeMax);
    ctx.fillRect(x + rng() * width, y + rng() * height, s, s);
  }
}

/**
 * Paints a mottled, grainy surface: the base gradient plus several octaves of
 * blotches. Used for grass, soil, plaster and stone.
 */
export function paintMottle(
  ctx: CanvasRenderingContext2D,
  rng: () => number,
  width: number,
  height: number,
  base: number,
  light: number,
  dark: number,
  blobs = 16,
): void {
  for (let i = 0; i < blobs; i++) {
    const x = rng() * width;
    const y = rng() * height;
    const radius = range(rng, width * 0.06, width * 0.3);
    const color = rng() > 0.5 ? light : dark;
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, rgba(color, range(rng, 0.06, 0.2)));
    gradient.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = gradient;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }
  void base;
}

/** Adds a thin lit rim and a darker base rim to an isometric tile. */
export function drawTileShading(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  lightAlpha = 0.22,
  darkAlpha = 0.24,
): void {
  const cx = width / 2;
  ctx.save();
  clipDiamond(ctx, cx, 0, width, height);

  const lightGradient = ctx.createLinearGradient(0, 0, 0, height * 0.5);
  lightGradient.addColorStop(0, `rgba(255, 245, 210, ${lightAlpha})`);
  lightGradient.addColorStop(1, 'rgba(255, 245, 210, 0)');
  ctx.fillStyle = lightGradient;
  ctx.fillRect(0, 0, width, height * 0.5);

  const darkGradient = ctx.createLinearGradient(0, height * 0.55, 0, height);
  darkGradient.addColorStop(0, 'rgba(24, 18, 8, 0)');
  darkGradient.addColorStop(1, `rgba(24, 18, 8, ${darkAlpha})`);
  ctx.fillStyle = darkGradient;
  ctx.fillRect(0, height * 0.55, width, height * 0.45);
  ctx.restore();

  traceDiamond(ctx, cx, 0, width, height);
  ctx.strokeStyle = 'rgba(30, 24, 12, 0.18)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

/** Paints a small clump of grass blades ending at (x, y). */
export function paintGrassTuft(
  ctx: CanvasRenderingContext2D,
  rng: () => number,
  x: number,
  y: number,
  height: number,
  colors: readonly string[],
  blades = 6,
): void {
  const lean = range(rng, -4, 4);
  for (let i = 0; i < blades; i++) {
    const offset = range(rng, -height * 0.25, height * 0.25);
    const bladeHeight = height * range(rng, 0.55, 1);
    const bend = range(rng, -height * 0.35, height * 0.35) + lean;
    ctx.beginPath();
    ctx.moveTo(x + offset, y);
    ctx.quadraticCurveTo(
      x + offset + bend * 0.35,
      y - bladeHeight * 0.55,
      x + offset + bend,
      y - bladeHeight,
    );
    ctx.strokeStyle = pick(rng, colors);
    ctx.lineWidth = range(rng, 0.8, 1.7);
    ctx.lineCap = 'round';
    ctx.stroke();
  }
}

/** Bark texture: a few vertical, slightly wandering grooves. */
export function paintBark(
  ctx: CanvasRenderingContext2D,
  rng: () => number,
  x: number,
  y: number,
  width: number,
  height: number,
  base: number,
): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, width, height);
  ctx.clip();
  const light = lighten(base, 0.16);
  const dark = darken(base, 0.3);
  const gradient = ctx.createLinearGradient(x, 0, x + width, 0);
  gradient.addColorStop(0, rgbaStr(darken(base, 0.18), 0.95));
  gradient.addColorStop(0.45, rgbaStr(light, 0.95));
  gradient.addColorStop(1, rgbaStr(dark, 0.95));
  ctx.fillStyle = gradient;
  ctx.fillRect(x, y, width, height);
  for (let i = 0; i < Math.max(4, width / 3); i++) {
    const gx = x + rng() * width;
    ctx.beginPath();
    ctx.moveTo(gx, y);
    ctx.bezierCurveTo(gx + range(rng, -4, 4), y + height * 0.33, gx + range(rng, -5, 5), y + height * 0.66, gx + range(rng, -3, 3), y + height);
    ctx.strokeStyle = rgbaStr(darken(base, 0.35), range(rng, 0.2, 0.5));
    ctx.lineWidth = range(rng, 0.6, 1.5);
    ctx.stroke();
  }
  ctx.restore();
}
