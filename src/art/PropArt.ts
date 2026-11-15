import Phaser from 'phaser';
import {
  createCanvasTexture,
  darken,
  drawSoftEllipse,
  fillPolygon,
  lighten,
  makeRng,
  paintBark,
  pick,
  range,
  rgbaStr,
  speckle,
  strokePolygon,
} from './ArtUtils';

type Point = readonly [number, number];

const TILE_W = 128;
const TILE_H = 64;

interface Vec {
  x: number;
  y: number;
}

const vec = (x: number, y: number): Vec => ({ x, y });
const add = (a: Vec, b: Vec): Vec => vec(a.x + b.x, a.y + b.y);
const sub = (a: Vec, b: Vec): Vec => vec(a.x - b.x, a.y - b.y);
const lerp = (a: Vec, b: Vec, t: number): Vec => vec(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
const p = (v: Vec): Point => [v.x, v.y];

function wallQuad(
  start: Vec,
  end: Vec,
  t: number,
  widthFraction: number,
  height: number,
): Point[] {
  const base = lerp(start, end, t);
  const unit = sub(end, start);
  const span = Math.hypot(unit.x, unit.y);
  const u = vec((unit.x / span) * span * widthFraction, (unit.y / span) * span * widthFraction);
  return [
    p(base),
    p(add(base, u)),
    p(vec(base.x + u.x, base.y + u.y - height)),
    p(vec(base.x, base.y - height)),
  ];
}

function paintPlaster(
  ctx: CanvasRenderingContext2D,
  rng: () => number,
  polygon:Point[],
  base: number,
): void {
  const xs=polygon.map(point=>point[0]),ys=polygon.map(point=>point[1]);
  const x=Math.min(...xs),y=Math.min(...ys),width=Math.max(...xs)-x,height=Math.max(...ys)-y;
  ctx.save();
  ctx.beginPath();
  polygon.forEach(([px,py],index)=>index===0?ctx.moveTo(px,py):ctx.lineTo(px,py));
  ctx.closePath();
  ctx.clip();
  const gradient = ctx.createLinearGradient(0, y, 0, y + height);
  gradient.addColorStop(0, rgbaStr(lighten(base, 0.14)));
  gradient.addColorStop(0.7, rgbaStr(base));
  gradient.addColorStop(1, rgbaStr(darken(base, 0.12)));
  ctx.fillStyle = gradient;
  ctx.fillRect(x, y, width, height);

  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = rng() > 0.5 ? 'rgba(88, 68, 44, 0.05)' : 'rgba(255, 246, 220, 0.06)';
    ctx.beginPath();
    ctx.ellipse(
      x + rng() * width,
      y + rng() * height,
      range(rng, 1, 8),
      range(rng, 1, 4),
      rng() * Math.PI,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  speckle(ctx, rng, x, y, width, height, Math.floor(width * height * 0.06), [
    'rgba(84, 62, 38, 0.14)',
    'rgba(255, 250, 230, 0.12)',
  ]);
  ctx.restore();
}

function paintBeam(
  ctx: CanvasRenderingContext2D,
  from: Vec,
  to: Vec,
  width: number,
  color: number,
): void {
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.strokeStyle = rgbaStr(darken(color, 0.35), 0.9);
  ctx.lineWidth = width + 1.5;
  ctx.lineCap = 'butt';
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(from.x, from.y - 0.6);
  ctx.lineTo(to.x, to.y - 0.6);
  ctx.strokeStyle = rgbaStr(lighten(color, 0.12), 0.95);
  ctx.lineWidth = width;
  ctx.stroke();
}

function paintRoofPlane(
  ctx: CanvasRenderingContext2D,
  left: Vec,
  right: Vec,
  apex: Vec,
  baseColor: number,
  lightColor: number,
  rng: () => number,
): void {
  fillPolygon(ctx, [p(left), p(right), p(apex)], (() => {
    const g = ctx.createLinearGradient(0, apex.y, 0, Math.max(left.y, right.y));
    g.addColorStop(0, rgbaStr(lighten(lightColor, 0.16)));
    g.addColorStop(0.55, rgbaStr(lightColor));
    g.addColorStop(1, rgbaStr(baseColor));
    return g;
  })());

  const rows = 9;
  const width = Math.hypot(right.x - left.x, right.y - left.y);
  const columns = Math.max(6, Math.round(width / 9));
  for (let row = 1; row <= rows; row++) {
    const t = row / (rows + 1);
    const rowLeft = lerp(left, apex, t);
    const rowRight = lerp(right, apex, t);
    for (let col = 0; col < columns; col++) {
      const a = lerp(rowLeft, rowRight, col / columns);
      const b = lerp(rowLeft, rowRight, (col + 1) / columns);
      const bulge = range(rng, 1.1, 2.4);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.quadraticCurveTo((a.x + b.x) / 2, (a.y + b.y) / 2 + bulge, b.x, b.y);
      ctx.strokeStyle = rgbaStr(darken(baseColor, 0.38), 0.55);
      ctx.lineWidth = 1.1;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(a.x, a.y - 1);
      ctx.quadraticCurveTo((a.x + b.x) / 2, (a.y + b.y) / 2 + bulge - 1, b.x, b.y - 1);
      ctx.strokeStyle = `rgba(255, 226, 190, ${range(rng, 0.08, 0.2)})`;
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
  }

  // Deep eave shadow along the bottom edge.
  ctx.beginPath();
  ctx.moveTo(left.x, left.y);
  ctx.lineTo(right.x, right.y);
  ctx.strokeStyle = 'rgba(48, 26, 18, 0.45)';
  ctx.lineWidth = 5;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(left.x, left.y + 3);
  ctx.lineTo(right.x, right.y + 3);
  ctx.strokeStyle = 'rgba(28, 16, 10, 0.3)';
  ctx.lineWidth = 2;
  ctx.stroke();
}

function paintWindow(
  ctx: CanvasRenderingContext2D,
  start: Vec,
  end: Vec,
  t: number,
  widthFraction: number,
  height: number,
  warm: boolean,
): void {
  const frame = wallQuad(start, end, t, widthFraction, height);
  fillPolygon(ctx, frame, '#3a2a1c');
  const inset: Point[] = [
    [frame[0]![0] + 2.5, frame[0]![1] - 2.5],
    [frame[1]![0] - 2.5, frame[1]![1] - 2.5],
    [frame[2]![0] - 2.5, frame[2]![1] + 2.5],
    [frame[3]![0] + 2.5, frame[3]![1] + 2.5],
  ];
  if (warm) {
    const cx = (frame[0]![0] + frame[1]![0] + frame[2]![0] + frame[3]![0]) / 4;
    const cy = (frame[0]![1] + frame[1]![1] + frame[2]![1] + frame[3]![1]) / 4;
    const glow = ctx.createRadialGradient(cx, cy, 1, cx, cy, 18);
    glow.addColorStop(0, 'rgba(255, 224, 140, 0.95)');
    glow.addColorStop(1, 'rgba(232, 158, 70, 0.55)');
    fillPolygon(ctx, inset, glow);
  } else {
    fillPolygon(ctx, inset, '#2a2018');
  }
  // Mullions.
  const midX = (frame[0]![0] + frame[1]![0]) / 2;
  const midY = (frame[0]![1] + frame[1]![1]) / 2;
  ctx.beginPath();
  ctx.moveTo(midX, midY);
  ctx.lineTo(midX, midY - height);
  ctx.strokeStyle = 'rgba(70, 48, 28, 0.85)';
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(frame[0]![0], frame[0]![1] - height * 0.5);
  ctx.lineTo(frame[1]![0], frame[1]![1] - height * 0.5);
  ctx.stroke();
}

function paintHouse(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  variant: number,
): void {
  const rng = makeRng(21000 + variant * 503);
  const baseX = width / 2;
  const baseY = height - 28;

  // More compact, traditional Ottoman rural house proportions
  const span=variant===0?72:66;
  const L = vec(baseX - span, baseY - 36);
  const S = vec(baseX, baseY);
  const R = vec(baseX + span, baseY - 36);
  const wallH = variant===0?82:72;
  const Lt = sub(L, vec(0, wallH));
  const St = sub(S, vec(0, wallH));
  const Rt = sub(R, vec(0, wallH));

  const plaster = variant === 0 ? 0xb9a480 : 0xb09a7a;
  const beam = variant === 0 ? 0x3d2f22 : 0x35281d;
  const roofBase = variant === 0 ? 0x5f382a : 0x543228;
  const roofLight = variant === 0 ? 0x754436 : 0x69402f;

  drawSoftEllipse(ctx, baseX + 2, baseY + 5, 98, 28, 0.32);

  // Rough stone foundation, simpler coursing like rural Anatolian houses.
  fillPolygon(ctx, [p(L), p(S), p(vec(S.x, S.y - 12)), p(vec(L.x, L.y - 12))], '#6a6250');
  fillPolygon(ctx, [p(S), p(R), p(vec(R.x, R.y - 12)), p(vec(S.x, S.y - 12))], '#7a705c');
  for(const [start,end,shade] of [[L,S,0],[S,R,1]] as const){
    for(let i=0;i<9;i++){
      const block=wallQuad(start,end,(i+0.04)/9,0.088,range(rng,8,11));
      const stone=['#716858','#827866','#665f52','#918572'][Math.floor(rng()*4)]??'#716858';
      fillPolygon(ctx,block,stone);
      strokePolygon(ctx,block,`rgba(42, 35, 27, ${shade?0.28:0.36})`,0.7);
      ctx.strokeStyle='rgba(238, 222, 188, 0.17)';ctx.lineWidth=0.7;
      ctx.beginPath();ctx.moveTo(block[3]![0]+1,block[3]![1]+1);ctx.lineTo(block[2]![0]-1,block[2]![1]+1);ctx.stroke();
    }
  }

  // Walls.
  const leftGradient = ctx.createLinearGradient(L.x, Lt.y, S.x, S.y);
  leftGradient.addColorStop(0, rgbaStr(darken(plaster, 0.2)));
  leftGradient.addColorStop(0.6, rgbaStr(plaster));
  leftGradient.addColorStop(1, rgbaStr(darken(plaster, 0.26)));
  fillPolygon(ctx, [p(L), p(S), p(St), p(Lt)], leftGradient);

  const rightGradient = ctx.createLinearGradient(S.x, St.y, R.x, R.y);
  rightGradient.addColorStop(0, rgbaStr(lighten(plaster, 0.16)));
  rightGradient.addColorStop(0.65, rgbaStr(lighten(plaster, 0.05)));
  rightGradient.addColorStop(1, rgbaStr(darken(plaster, 0.14)));
  fillPolygon(ctx, [p(S), p(R), p(Rt), p(St)], rightGradient);

  // Keep plaster grain clipped to the actual wall planes so the texture never
  // paints an opaque rectangular halo around the isometric house silhouette.
  paintPlaster(ctx,rng,[p(L),p(S),p(St),p(Lt)],plaster);
  paintPlaster(ctx,rng,[p(S),p(R),p(Rt),p(St)],plaster);

  // Timber frame: vertical posts and horizontal rails.
  for (let i = 0; i <= 3; i++) {
    const t = i / 3;
    const bottom = lerp(L, S, t);
    paintBeam(ctx, bottom, sub(bottom, vec(0, wallH - 2)), i === 0 ? 6 : 4.2, beam);
  }
  for (let i = 0; i <= 3; i++) {
    const t = i / 3;
    const bottom = lerp(S, R, t);
    paintBeam(ctx, bottom, sub(bottom, vec(0, wallH - 2)), i === 0 || i === 3 ? 6 : 4.2, beam);
  }
  for (const fraction of [0.05, 0.5]) {
    const leftBottom = lerp(L, S, 0);
    const rightBottom = lerp(S, R, 1);
    const yLeft = leftBottom.y - wallH * fraction;
    const yRight = rightBottom.y - wallH * fraction;
    paintBeam(ctx, vec(L.x, yLeft), vec(S.x, yLeft), 4.0, beam);
    paintBeam(ctx, vec(S.x, yRight), vec(R.x, yRight), 4.0, beam);
  }
  // Diagonal braces on the shaded wall.
  paintBeam(
    ctx,
    lerp(L, S, 0.06),
    sub(lerp(L, S, 0.34), vec(0, wallH * 0.44)),
    3.2,
    beam,
  );
  paintBeam(
    ctx,
    lerp(L, S, 0.72),
    sub(lerp(L, S, 0.44), vec(0, wallH * 0.44)),
    3.2,
    beam,
  );

  // Door on the left wall with a stone step.
  const door = wallQuad(L, S, 0.36, 0.22, 50);
  fillPolygon(ctx, door, '#382618');
  const doorInset: Point[] = [
    [door[0]![0] + 3, door[0]![1] - 2],
    [door[1]![0] - 3, door[1]![1] - 2],
    [door[2]![0] - 3, door[2]![1] + 3],
    [door[3]![0] + 3, door[3]![1] + 3],
  ];
  fillPolygon(ctx, doorInset, '#513620');
  for (let i = 1; i < 4; i++) {
    const t = i / 4;
    const a = lerp(vec(doorInset[0]![0], doorInset[0]![1]), vec(doorInset[1]![0], doorInset[1]![1]), t);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(a.x, a.y - 44);
    ctx.strokeStyle = 'rgba(28, 18, 10, 0.5)';
    ctx.lineWidth = 0.9;
    ctx.stroke();
  }
  ctx.fillStyle = '#b89a5c';
  ctx.beginPath();
  ctx.arc(doorInset[1]![0] - 6, doorInset[1]![1] - 24, 1.7, 0, Math.PI * 2);
  ctx.fill();
  fillPolygon(
    ctx,
    [
      [door[0]![0] - 6, door[0]![1] + 3],
      [door[1]![0] + 6, door[1]![1] + 3],
      [door[1]![0] + 2, door[1]![1] + 11],
      [door[0]![0] - 2, door[0]![1] + 11],
    ],
    '#8d7d64',
  );

  // Smaller, more realistic Ottoman windows.
  paintWindow(ctx, S, R, 0.24, 0.14, 22, true);
  paintWindow(ctx, S, R, 0.6, 0.14, 22, false);
  paintWindow(ctx, L, S, 0.66, 0.13, 20, false);

  // Simple hanging herbs beside door.
  ctx.strokeStyle = 'rgba(50, 38, 22, 0.9)';
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(L.x + 38, L.y - wallH + 10);
  ctx.lineTo(L.x + 50, L.y - wallH + 12);
  ctx.stroke();
  for (let i = 0; i < 4; i++) {
    const x = L.x + 40 + i * 2.5;
    const y = L.y - wallH + 14 + i * 1.4;
    ctx.fillStyle = i % 2 === 0 ? '#9a3728' : '#b85d2f';
    ctx.beginPath();
    ctx.ellipse(x, y + 4, 1.2, 2.8, 0.2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Low-pitched, overhanging roof typical of rural Ottoman houses.
  const eaveOverhang = variant===0?10:7;
  const Lr = vec(Lt.x - eaveOverhang, Lt.y + 4);
  const Sr = vec(St.x, St.y + 12);
  const Rr = vec(Rt.x + eaveOverhang, Rt.y + 4);
  const apex = vec(baseX, Lt.y - (variant===0?58:46));

  paintRoofPlane(ctx, Lr, Sr, apex, roofBase, roofLight, rng);
  paintRoofPlane(ctx, Sr, Rr, apex, roofBase, roofLight, rng);

  // Ridge cap and finial.
  ctx.beginPath();
  ctx.moveTo(apex.x, apex.y);
  ctx.lineTo(apex.x, apex.y + 76);
  ctx.strokeStyle = 'rgba(58, 30, 20, 0.35)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#6f3a28';
  ctx.beginPath();
  ctx.arc(apex.x, apex.y, 3.4, 0, Math.PI * 2);
  ctx.fill();

  // Chimney with stone texture.
  const chimX = baseX + 34;
  const chimY = apex.y + 16;
  fillPolygon(
    ctx,
    [
      [chimX, chimY - 30],
      [chimX + 16, chimY - 38],
      [chimX + 16, chimY - 6],
      [chimX, chimY + 2],
    ],
    '#8b7a63',
  );
  fillPolygon(
    ctx,
    [
      [chimX, chimY - 30],
      [chimX + 10, chimY - 36],
      [chimX + 10, chimY - 4],
      [chimX, chimY + 2],
    ],
    '#a08d72',
  );
  ctx.fillStyle = '#5c4c3a';
  ctx.fillRect(chimX - 1, chimY - 32, 18, 4);
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = 'rgba(52, 44, 34, 0.25)';
    ctx.fillRect(chimX + rng() * 14, chimY - 30 + rng() * 28, 2, 1.2);
  }

  // Woodpile and clay pots at the base.
  for (let i = 0; i < 4; i++) {
    const logX = L.x + 10 + i * 5.5;
    const logY = L.y + 8 + (i % 2) * 3.5;
    ctx.fillStyle = i % 2 === 0 ? '#533d26' : '#63472e';
    ctx.beginPath();
    ctx.ellipse(logX, logY, 5.5, 2.2, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(182, 148, 108, 0.32)';
    ctx.beginPath();
    ctx.ellipse(logX - 0.5, logY - 0.4, 3.8, 1.1, -0.2, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < 2; i++) {
    const potX = R.x - 18 - i * 11;
    const potY = R.y + 8;
    ctx.fillStyle = '#9a5738';
    ctx.beginPath();
    ctx.ellipse(potX, potY, 5.5, 6.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#b96f4e';
    ctx.beginPath();
    ctx.ellipse(potX - 1.2, potY - 0.9, 3.0, 3.9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#443124';
    ctx.beginPath();
    ctx.ellipse(potX, potY - 6.5, 4.0, 1.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function paintWorkshop(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const cx = width / 2;
  const baseY = height - 22;
  const L = vec(cx - 66, baseY - 38), S = vec(cx, baseY), R = vec(cx + 66, baseY - 38);
  const Lt = vec(L.x, L.y - 62), St = vec(S.x, S.y - 62), Rt = vec(R.x, R.y - 62);
  const apex = vec(cx, 44);
  drawSoftEllipse(ctx, cx, baseY + 5, 87, 25, 0.38);
  fillPolygon(ctx, [p(vec(L.x, L.y - 12)), p(vec(S.x, S.y - 12)), p(S), p(L)], '#625a4c');
  fillPolygon(ctx, [p(vec(S.x, S.y - 12)), p(vec(R.x, R.y - 12)), p(R), p(S)], '#746954');
  const stone = ctx.createLinearGradient(0, baseY - 64, 0, baseY);
  stone.addColorStop(0, '#b2a080'); stone.addColorStop(1, '#74634b');
  fillPolygon(ctx, [p(L), p(S), p(St), p(Lt)], stone);
  fillPolygon(ctx, [p(S), p(R), p(Rt), p(St)], '#a99670');
  for (let i = 0; i < 5; i++) {
    const t = (i + 0.5) / 5;
    const left = lerp(L, S, t), right = lerp(S, R, t);
    paintBeam(ctx, vec(left.x, left.y - 60), vec(left.x, left.y - 8), 3.5, 0x493725);
    paintBeam(ctx, vec(right.x, right.y - 60), vec(right.x, right.y - 8), 3.5, 0x493725);
  }
  paintBeam(ctx, Lt, Rt, 4, 0x493725);
  // A broad double door and forge glow identify this as a working smithy.
  fillPolygon(ctx, [[cx - 44, baseY - 52], [cx - 8, baseY - 35], [cx - 8, baseY - 3], [cx - 44, baseY - 20]], '#30251a');
  fillPolygon(ctx, [[cx - 39, baseY - 47], [cx - 13, baseY - 35], [cx - 13, baseY - 7], [cx - 39, baseY - 19]], '#5d3d25');
  const glow = ctx.createRadialGradient(cx + 44, baseY - 38, 1, cx + 44, baseY - 38, 30);
  glow.addColorStop(0, 'rgba(255,188,86,.95)'); glow.addColorStop(1, 'rgba(208,79,28,0)');
  ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(cx + 44, baseY - 38, 30, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#39271b'; ctx.fillRect(cx + 32, baseY - 50, 26, 22);
  ctx.fillStyle = '#e28d3e'; ctx.beginPath(); ctx.ellipse(cx + 45, baseY - 31, 8, 5, 0, 0, Math.PI * 2); ctx.fill();
  paintRoofPlane(ctx, vec(Lt.x - 10, Lt.y + 4), vec(cx, St.y + 8), apex, 0x45291f, 0x7c4730, makeRng(36211));
  paintRoofPlane(ctx, vec(cx, St.y + 8), vec(Rt.x + 10, Rt.y + 4), apex, 0x45291f, 0x754331, makeRng(36212));
  // Short stone vent, deliberately simple and rural in scale.
  fillPolygon(ctx, [[cx + 42, 73], [cx + 58, 66], [cx + 58, 103], [cx + 42, 110]], '#786b59');
  ctx.fillStyle = '#493a2b'; ctx.fillRect(cx + 40, 70, 20, 5);
  // Anvil silhouette and a few stacked billets beside the forge.
  ctx.fillStyle = '#292b29'; ctx.beginPath(); ctx.moveTo(cx + 18, baseY - 4); ctx.lineTo(cx + 22, baseY - 17); ctx.lineTo(cx + 31, baseY - 20); ctx.lineTo(cx + 41, baseY - 17); ctx.lineTo(cx + 46, baseY - 13); ctx.lineTo(cx + 36, baseY - 13); ctx.lineTo(cx + 34, baseY - 4); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#9a8060'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx + 52, baseY - 9); ctx.lineTo(cx + 68, baseY - 9); ctx.moveTo(cx + 54, baseY - 13); ctx.lineTo(cx + 66, baseY - 13); ctx.stroke();
}

function paintGranary(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const cx = width / 2;
  const baseY = height - 18;
  const L = vec(cx - 62, baseY - 49), S = vec(cx, baseY - 14), R = vec(cx + 62, baseY - 49);
  const Lt = vec(L.x, L.y - 78), St = vec(S.x, S.y - 78), Rt = vec(R.x, R.y - 78);
  const apex = vec(cx, 38);
  drawSoftEllipse(ctx, cx, baseY + 3, 82, 23, 0.34);
  // Raised timber stilts keep the grain store distinct from family dwellings.
  for (const point of [L, S, R]) paintBeam(ctx, vec(point.x, point.y - 3), vec(point.x, baseY), 7, 0x5a4028);
  paintBeam(ctx, vec(L.x - 4, baseY - 1), vec(R.x + 4, baseY - 1), 8, 0x63492e);
  fillPolygon(ctx, [p(L), p(S), p(St), p(Lt)], '#9b825c');
  fillPolygon(ctx, [p(S), p(R), p(Rt), p(St)], '#b09a70');
  for (let i = 1; i < 8; i++) {
    const t = i / 8;
    const a = lerp(Lt, St, t), b = lerp(St, Rt, t);
    ctx.strokeStyle = 'rgba(57,39,23,.5)'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(a.x, a.y + 8); ctx.lineTo(lerp(L,S,t).x, lerp(L,S,t).y - 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(b.x, b.y + 8); ctx.lineTo(lerp(S,R,t).x, lerp(S,R,t).y - 2); ctx.stroke();
  }
  paintBeam(ctx, Lt, Rt, 4, 0x503923);
  fillPolygon(ctx, [[cx - 18, baseY - 68], [cx + 18, baseY - 68], [cx + 18, baseY - 27], [cx - 18, baseY - 27]], '#493423');
  ctx.strokeStyle = '#c1a476'; ctx.lineWidth = 2; ctx.strokeRect(cx - 18, baseY - 68, 36, 41);
  paintRoofPlane(ctx, vec(Lt.x - 10, Lt.y + 4), vec(cx, St.y + 8), apex, 0x51402a, 0x9b7942, makeRng(36221));
  paintRoofPlane(ctx, vec(cx, St.y + 8), vec(Rt.x + 10, Rt.y + 4), apex, 0x51402a, 0x8c6d3d, makeRng(36222));
  // Small ventilation slits and a tied sheaf mark the grain store.
  for (const [x, y] of [[cx - 34, baseY - 89], [cx + 33, baseY - 89]]) {
    ctx.fillStyle = '#3a2c1e'; ctx.fillRect(x!, y!, 10, 3);
  }
  ctx.strokeStyle = '#bf9c54'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(cx + 46, baseY - 6); ctx.lineTo(cx + 57, baseY - 32); ctx.moveTo(cx + 51, baseY - 8); ctx.lineTo(cx + 64, baseY - 28); ctx.stroke();
}

function paintZaviye(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const cx = width / 2;
  const baseY = height - 18;
  const L = vec(cx - 66, baseY - 40), S = vec(cx, baseY), R = vec(cx + 66, baseY - 40);
  const Lt = vec(L.x, L.y - 62), St = vec(S.x, S.y - 62), Rt = vec(R.x, R.y - 62);
  const apex = vec(cx, 42);
  drawSoftEllipse(ctx, cx, baseY + 5, 88, 26, 0.38);
  fillPolygon(ctx, [p(vec(L.x, L.y - 12)), p(vec(S.x, S.y - 12)), p(S), p(L)], '#635d50');
  fillPolygon(ctx, [p(vec(S.x, S.y - 12)), p(vec(R.x, R.y - 12)), p(R), p(S)], '#786c56');
  const plaster = ctx.createLinearGradient(cx - 50, baseY - 102, cx + 60, baseY);
  plaster.addColorStop(0, '#bba982'); plaster.addColorStop(0.55, '#ddcaa1'); plaster.addColorStop(1, '#9e8a68');
  fillPolygon(ctx, [p(L), p(S), p(St), p(Lt)], '#a89470');
  fillPolygon(ctx, [p(S), p(R), p(Rt), p(St)], plaster);
  for (const point of [L, S, R]) paintBeam(ctx, point, vec(point.x, point.y - 61), 4, 0x4b3824);
  paintBeam(ctx, Lt, St, 4, 0x4b3824);
  paintBeam(ctx, St, Rt, 4, 0x4b3824);
  // A broad entrance and covered sitting porch make this a shared lodge,
  // without giving the small rural building a monumental mosque silhouette.
  const door = [[cx - 46, baseY - 56], [cx - 10, baseY - 38], [cx - 10, baseY - 5], [cx - 46, baseY - 23]] as Point[];
  fillPolygon(ctx, door, '#39291b');
  fillPolygon(ctx, [[cx - 41, baseY - 50], [cx - 15, baseY - 37], [cx - 15, baseY - 10], [cx - 41, baseY - 23]], '#604528');
  const porchRoof = [[cx - 60, baseY - 76], [cx - 5, baseY - 50], [cx + 32, baseY - 65], [cx - 24, baseY - 91]] as Point[];
  fillPolygon(ctx, porchRoof, '#744331');
  ctx.strokeStyle = '#4d3023'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(cx - 51, baseY - 73); ctx.lineTo(cx - 51, baseY - 12); ctx.moveTo(cx + 24, baseY - 64); ctx.lineTo(cx + 24, baseY - 10); ctx.stroke();
  ctx.fillStyle = '#7b6544';
  fillPolygon(ctx, [[cx - 63, baseY - 4], [cx - 15, baseY + 8], [cx + 24, baseY - 3], [cx - 25, baseY - 15]], '#887657');
  // Main pitched roof uses the settlement's shared clay-tile language.
  paintRoofPlane(ctx, vec(Lt.x - 12, Lt.y + 5), vec(cx, St.y + 10), apex, 0x4c2d22, 0x82503a, makeRng(36231));
  paintRoofPlane(ctx, vec(cx, St.y + 10), vec(Rt.x + 12, Rt.y + 5), apex, 0x4c2d22, 0x754432, makeRng(36232));
  // Modest chimney and a low bench for travellers and neighbors.
  fillPolygon(ctx, [[cx + 42, 71], [cx + 58, 64], [cx + 58, 102], [cx + 42, 108]], '#85745d');
  ctx.fillStyle = '#554330'; ctx.fillRect(cx + 40, 68, 20, 5);
  ctx.fillStyle = '#64482d'; ctx.fillRect(cx + 26, baseY - 7, 34, 4);
  ctx.fillRect(cx + 30, baseY - 12, 4, 11); ctx.fillRect(cx + 52, baseY - 12, 4, 11);
}

function paintTree(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  variant: number,
): void {
  const rng = makeRng(23000 + variant * 619);
  const baseX = width / 2;
  const baseY = height - 18;

  drawSoftEllipse(ctx, baseX + 14, baseY + 2, 82, 23, 0.3);

  const trunkTop = vec(baseX + range(rng, -6, 6), baseY - 128);
  const trunkBottom = vec(baseX, baseY);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(trunkBottom.x - 10, trunkBottom.y);
  ctx.quadraticCurveTo(trunkBottom.x - 7, trunkBottom.y - 60, trunkTop.x - 6, trunkTop.y);
  ctx.lineTo(trunkTop.x + 7, trunkTop.y);
  ctx.quadraticCurveTo(trunkBottom.x + 8, trunkBottom.y - 55, trunkBottom.x + 11, trunkBottom.y);
  ctx.closePath();
  ctx.clip();
  paintBark(ctx, rng, baseX - 16, trunkTop.y, 34, trunkBottom.y - trunkTop.y, 0x55402a);
  ctx.restore();
  strokePolygon(
    ctx,
    [
      [trunkBottom.x - 10, trunkBottom.y],
      [trunkBottom.x - 7, trunkBottom.y - 60],
      [trunkTop.x - 6, trunkTop.y],
    ],
    'rgba(42, 28, 16, 0.4)',
    1.2,
  );

  // Exposed roots.
  for (let i = 0; i < 4; i++) {
    const dir = i < 2 ? -1 : 1;
    ctx.beginPath();
    ctx.moveTo(baseX + dir * 4, baseY - 4);
    ctx.quadraticCurveTo(baseX + dir * 16, baseY + 1, baseX + dir * range(rng, 20, 32), baseY + 2);
    ctx.strokeStyle = '#473422';
    ctx.lineWidth = range(rng, 1.9, 3.4);
    ctx.stroke();
  }

  // Branches reaching into the canopy.
  const branchTips: Vec[] = [];
  for (let i = 0; i < 5; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const from = vec(baseX + range(rng, -4, 4), baseY - range(rng, 82, 120));
    const to = vec(baseX + side * range(rng, 34, 64), baseY - range(rng, 150, 205));
    branchTips.push(to);
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.quadraticCurveTo(from.x + side * 20, from.y - 24, to.x, to.y);
    ctx.strokeStyle = '#473422';
    ctx.lineWidth = range(rng, 2.4, 4.2);
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  const palettes = [
    { dark: 0x3a4426, mid: 0x54622f, light: 0x6d7540, hi: 0x8d8f4f },
    { dark: 0x3f4627, mid: 0x596432, light: 0x727a3e, hi: 0x90944c },
    { dark: 0x364028, mid: 0x505c2d, light: 0x69743b, hi: 0x888f4b },
  ];
  const palette = palettes[variant % palettes.length]!;

  const blobs: Array<{ x: number; y: number; rx: number; ry: number; tone: number }> = [];
  for (let i = 0; i < 16; i++) {
    blobs.push({
      x: baseX + range(rng, -72, 72),
      y: baseY - 170 + range(rng, -58, 54),
      rx: range(rng, 30, 54),
      ry: range(rng, 22, 40),
      tone: rng(),
    });
  }
  for (const tip of branchTips) {
    blobs.push({
      x: tip.x + range(rng, -10, 10),
      y: tip.y + range(rng, -8, 10),
      rx: range(rng, 26, 40),
      ry: range(rng, 20, 32),
      tone: rng(),
    });
  }

  // Dark underside first.
  for (const blob of blobs) {
    const gradient = ctx.createRadialGradient(
      blob.x - blob.rx * 0.2,
      blob.y - blob.ry * 0.25,
      0,
      blob.x,
      blob.y,
      blob.rx,
    );
    gradient.addColorStop(0, rgbaStr(lighten(palette.mid, 0.08), 0.95));
    gradient.addColorStop(0.7, rgbaStr(palette.dark, 0.92));
    gradient.addColorStop(1, rgbaStr(palette.dark, 0));
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(blob.x, blob.y, blob.rx, blob.ry, range(rng, -0.4, 0.4), 0, Math.PI * 2);
    ctx.fill();
  }

  // Sunlit crowns on the upper-left of each cluster.
  for (const blob of blobs) {
    if (blob.tone < 0.35) continue;
    const hx = blob.x - blob.rx * 0.28;
    const hy = blob.y - blob.ry * 0.4;
    const gradient = ctx.createRadialGradient(hx, hy, 0, hx, hy, blob.rx * 0.75);
    gradient.addColorStop(0, rgbaStr(lighten(palette.hi, 0.1), 0.5));
    gradient.addColorStop(1, rgbaStr(palette.light, 0));
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(hx, hy, blob.rx * 0.72, blob.ry * 0.64, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Leaf texture: short strokes scattered over the silhouette.
  for (let i = 0; i < 520; i++) {
    const blob = pick(rng, blobs);
    const angle = rng() * Math.PI * 2;
    const radius = Math.sqrt(rng());
    const lx = blob.x + Math.cos(angle) * blob.rx * radius;
    const ly = blob.y + Math.sin(angle) * blob.ry * radius;
    const shade = rng();
    ctx.fillStyle = shade > 0.7
      ? rgbaStr(palette.hi, range(rng, 0.25, 0.55))
      : shade > 0.35
        ? rgbaStr(palette.light, range(rng, 0.2, 0.45))
        : rgbaStr(palette.dark, range(rng, 0.15, 0.35));
    ctx.beginPath();
    ctx.ellipse(lx, ly, range(rng, 1.2, 3), range(rng, 0.6, 1.4), rng() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }

  // Soft top highlight.
  const topGlow = ctx.createRadialGradient(baseX - 26, baseY - 210, 0, baseX - 26, baseY - 210, 72);
  topGlow.addColorStop(0, 'rgba(206, 216, 144, 0.16)');
  topGlow.addColorStop(1, 'rgba(206, 216, 144, 0)');
  ctx.fillStyle = topGlow;
  ctx.fillRect(0, 0, width, height);
}

function paintRock(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  variant: number,
): void {
  const rng = makeRng(24000 + variant * 227);
  const baseX = width / 2;
  const baseY = height - 12;
  drawSoftEllipse(ctx, baseX + 4, baseY + 2, 46, 12, 0.3);

  const rocks = [
    { x: -18, y: -10, rx: 22, ry: 15 },
    { x: 8, y: -4, rx: 26, ry: 18 },
    { x: 24, y: -14, rx: 15, ry: 11 },
  ];
  for (const rock of rocks) {
    const cx = baseX + rock.x;
    const cy = baseY + rock.y;
    const gradient = ctx.createLinearGradient(cx - rock.rx, cy - rock.ry, cx + rock.rx, cy + rock.ry);
    gradient.addColorStop(0, '#a29a8a');
    gradient.addColorStop(0.45, '#847c6d');
    gradient.addColorStop(1, '#5a5448');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rock.rx, rock.ry, range(rng, -0.25, 0.25), 0, Math.PI * 2);
    ctx.fill();

    // Facet highlight.
    ctx.fillStyle = 'rgba(236, 226, 205, 0.42)';
    ctx.beginPath();
    ctx.ellipse(cx - rock.rx * 0.28, cy - rock.ry * 0.3, rock.rx * 0.4, rock.ry * 0.3, -0.3, 0, Math.PI * 2);
    ctx.fill();

    // Crack.
    ctx.beginPath();
    ctx.moveTo(cx - rock.rx * 0.1, cy - rock.ry * 0.5);
    ctx.lineTo(cx + rock.rx * 0.18, cy);
    ctx.lineTo(cx - rock.rx * 0.05, cy + rock.ry * 0.6);
    ctx.strokeStyle = 'rgba(46, 42, 36, 0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Moss at the contact points.
  for (let i = 0; i < 10; i++) {
    ctx.fillStyle = `rgba(${rangeIntColor(rng)}, ${range(rng, 0.15, 0.35)})`;
    ctx.beginPath();
    ctx.ellipse(
      baseX + range(rng, -32, 32),
      baseY + range(rng, -6, 2),
      range(rng, 2, 6),
      range(rng, 1, 2.5),
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
}

function rangeIntColor(rng: () => number): string {
  return pick(rng, ['86, 112, 52', '104, 128, 62', '70, 94, 44']);
}

function paintMarketStall(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  variant: number,
): void {
  const rng = makeRng(25000 + variant * 313);
  const baseX = width / 2;
  const baseY = height - 24;
  const wood = 0x63462a;
  const clothA = variant === 0 ? 0xc9bc9a : 0xc4c8ba;
  const clothB = variant === 0 ? 0x9a4430 : 0x456362;

  drawSoftEllipse(ctx, baseX + 4, baseY + 2, 96, 24, 0.32);

  // Counter: an isometric box.
  const tableTop = [
    vec(baseX - 74, baseY - 46),
    vec(baseX, baseY - 28),
    vec(baseX + 74, baseY - 46),
    vec(baseX, baseY - 64),
  ];
  fillPolygon(ctx, tableTop.map(p), '#a07c4e');
  fillPolygon(
    ctx,
    [p(vec(baseX - 74, baseY - 46)), p(vec(baseX, baseY - 28)), p(vec(baseX, baseY - 4)), p(vec(baseX - 74, baseY - 22))],
    '#71502e',
  );
  fillPolygon(
    ctx,
    [p(vec(baseX, baseY - 28)), p(vec(baseX + 74, baseY - 46)), p(vec(baseX + 74, baseY - 22)), p(vec(baseX, baseY - 4))],
    '#5c4026',
  );
  // Plank seams on the counter sides.
  for (let i = 1; i < 4; i++) {
    const t = i / 4;
    const a = lerp(vec(baseX - 74, baseY - 22), vec(baseX, baseY - 4), t);
    const b = lerp(vec(baseX - 74, baseY - 46), vec(baseX, baseY - 28), t);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = 'rgba(38, 24, 12, 0.25)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Posts.
  for (const post of [{ x: -88, y: -96 }, { x: 88, y: -96 }, { x: -74, y: -34 }, { x: 74, y: -34 }]) {
    const x = baseX + post.x;
    const y = baseY + post.y;
    ctx.fillStyle = rgbaStr(wood);
    ctx.fillRect(x - 2.5, y, 5, 62);
    ctx.fillStyle = 'rgba(210, 174, 122, 0.25)';
    ctx.fillRect(x - 2, y, 1.4, 60);
  }

  // Striped awning with scalloped valance.
  const awning = [
    vec(baseX - 100, baseY - 134),
    vec(baseX + 100, baseY - 134),
    vec(baseX + 88, baseY - 96),
    vec(baseX - 88, baseY - 96),
  ];
  ctx.save();
  fillPolygon(ctx, awning.map(p), rgbaStr(clothA));
  ctx.beginPath();
  awning.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.closePath();
  ctx.clip();
  for (let i = 0; i < 10; i++) {
    if (i % 2 === 0) continue;
    const x0 = baseX - 100 + i * 20;
    ctx.fillStyle = rgbaStr(clothB, 0.9);
    ctx.beginPath();
    ctx.moveTo(x0, baseY - 134);
    ctx.lineTo(x0 + 20, baseY - 134);
    ctx.lineTo(x0 + 18, baseY - 96);
    ctx.lineTo(x0 - 1.6, baseY - 96);
    ctx.closePath();
    ctx.fill();
  }
  const awningShade = ctx.createLinearGradient(0, baseY - 134, 0, baseY - 96);
  awningShade.addColorStop(0, 'rgba(255, 245, 220, 0.22)');
  awningShade.addColorStop(1, 'rgba(30, 20, 10, 0.28)');
  ctx.fillStyle = awningShade;
  ctx.fillRect(baseX - 100, baseY - 134, 200, 38);
  ctx.restore();

  // Scalloped edge.
  for (let i = 0; i < 13; i++) {
    const x = baseX - 88 + i * 14;
    ctx.beginPath();
    ctx.arc(x + 7, baseY - 96, 7, 0, Math.PI);
    ctx.fillStyle = i % 2 === 0 ? rgbaStr(clothA) : rgbaStr(clothB);
    ctx.fill();
  }

  // Produce on the counter: grain sacks, bread, gourds, fabric.
  for (let i = 0; i < 3; i++) {
    const sx = baseX - 50 + i * 28;
    const sy = baseY - 54 - i * 2;
    ctx.fillStyle = '#c9b183';
    ctx.beginPath();
    ctx.ellipse(sx, sy, 13, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#dcc79c';
    ctx.beginPath();
    ctx.ellipse(sx - 3, sy - 2, 7, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#8a6a3e';
    ctx.beginPath();
    ctx.ellipse(sx, sy - 7, 5, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
    for (let g = 0; g < 12; g++) {
      ctx.fillStyle = pick(rng, ['#d8bf74', '#c9aa5a', '#e3cd8a']);
      ctx.fillRect(sx - 8 + rng() * 16, sy - 5 + rng() * 4, 1, 1);
    }
  }
  for (let i = 0; i < 4; i++) {
    const bx = baseX + 30 + range(rng, -8, 8);
    const by = baseY - 50 + range(rng, -6, 6);
    ctx.fillStyle = '#c08a4a';
    ctx.beginPath();
    ctx.ellipse(bx, by, 6, 3.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(246, 214, 158, 0.5)';
    ctx.beginPath();
    ctx.ellipse(bx - 1, by - 1, 3, 1.4, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < 3; i++) {
    const gx = baseX - 20 + i * 14;
    const gy = baseY - 42;
    ctx.fillStyle = '#8c9a3f';
    ctx.beginPath();
    ctx.ellipse(gx, gy, 6, 4, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#b8c05e';
    ctx.beginPath();
    ctx.ellipse(gx - 1, gy - 1, 3, 1.8, -0.3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Hanging lantern.
  ctx.strokeStyle = '#3c2a18';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(baseX + 66, baseY - 96);
  ctx.lineTo(baseX + 66, baseY - 88);
  ctx.stroke();
  ctx.fillStyle = '#e5b45c';
  ctx.beginPath();
  ctx.ellipse(baseX + 66, baseY - 84, 4, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 214, 120, 0.18)';
  ctx.beginPath();
  ctx.arc(baseX + 66, baseY - 84, 11, 0, Math.PI * 2);
  ctx.fill();

  // Crates and a barrel tucked under the counter.
  drawCrate(ctx, baseX + 42, baseY - 2, 0.9, rng);
  drawBarrel(ctx, baseX - 58, baseY - 2, 0.8, rng);
}

function drawBarrel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  rng: () => number,
): void {
  const w = 20 * scale;
  const h = 30 * scale;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  drawSoftEllipse(ctx, 0, 1, 13, 4, 0.25);
  const gradient = ctx.createLinearGradient(-10, 0, 10, 0);
  gradient.addColorStop(0, '#4b321c');
  gradient.addColorStop(0.45, '#8a6238');
  gradient.addColorStop(1, '#3f2a18');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(-9, -h + 4);
  ctx.quadraticCurveTo(-12, -h / 2, -9, 0);
  ctx.lineTo(9, 0);
  ctx.quadraticCurveTo(12, -h / 2, 9, -h + 4);
  ctx.closePath();
  ctx.fill();
  for (const hoopY of [-h + 7, -h * 0.55, -6]) {
    ctx.fillStyle = 'rgba(54, 52, 48, 0.85)';
    ctx.fillRect(-10, hoopY, 20, 2);
    ctx.fillStyle = 'rgba(180, 176, 168, 0.25)';
    ctx.fillRect(-10, hoopY, 20, 0.7);
  }
  for (let i = 0; i < 4; i++) {
    ctx.strokeStyle = 'rgba(40, 26, 14, 0.35)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(-7 + i * 4.5, -h + 6);
    ctx.lineTo(-7 + i * 4.5, -2);
    ctx.stroke();
  }
  ctx.fillStyle = '#7d5730';
  ctx.beginPath();
  ctx.ellipse(0, -h + 4, 9, 3.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#4a321c';
  ctx.beginPath();
  ctx.ellipse(0, -h + 4, 6.5, 2.2, 0, 0, Math.PI * 2);
  ctx.fill();
  void w;
  void rng;
  ctx.restore();
}

function drawCrate(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  rng: () => number,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  drawSoftEllipse(ctx, 0, 1, 14, 4, 0.25);
  const top = [
    [0, -24],
    [16, -16],
    [0, -8],
    [-16, -16],
  ] as const;
  fillPolygon(ctx, top, '#9a7444');
  fillPolygon(ctx, [[-16, -16], [0, -8], [0, 0], [-16, -8]], '#6b4a29');
  fillPolygon(ctx, [[0, -8], [16, -16], [16, -8], [0, 0]], '#7d5730');
  for (const side of [
    [[-16, -16], [0, -8], [0, 0], [-16, -8]],
    [[0, -8], [16, -16], [16, -8], [0, 0]],
  ] as const) {
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      const t = i / 3 + 0.08;
      ctx.moveTo(side[0]![0] + (side[1]![0] - side[0]![0]) * t, side[0]![1] + (side[1]![1] - side[0]![1]) * t);
      ctx.lineTo(side[3]![0] + (side[2]![0] - side[3]![0]) * t, side[3]![1] + (side[2]![1] - side[3]![1]) * t);
      ctx.strokeStyle = 'rgba(46, 28, 14, 0.4)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
  void rng;
  ctx.restore();
}

function paintWell(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const rng = makeRng(26000);
  const cx = width / 2;
  const baseY = height - 20;
  drawSoftEllipse(ctx, cx, baseY + 2, 50, 14, 0.32);

  // Stone ring.
  for (let i = 0; i < 14; i++) {
    const angle = (i / 14) * Math.PI * 2;
    const x = cx + Math.cos(angle) * 38;
    const y = baseY + Math.sin(angle) * 12;
    const shade = pick(rng, [0x857d6e, 0x766f61, 0x91877a]);
    ctx.fillStyle = rgbaStr(shade);
    ctx.beginPath();
    ctx.ellipse(x, y, 7, 5, angle, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(240, 232, 210, 0.22)';
    ctx.beginPath();
    ctx.ellipse(x - 1, y - 1.5, 4, 2.2, angle, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#242a26';
  ctx.beginPath();
  ctx.ellipse(cx, baseY - 1, 30, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1c3438';
  ctx.beginPath();
  ctx.ellipse(cx, baseY - 2, 26, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(190, 226, 220, 0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(cx - 7, baseY - 3, 8, 2, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Posts and roof.
  ctx.fillStyle = '#533b25';
  ctx.fillRect(cx - 40, baseY - 92, 6, 84);
  ctx.fillRect(cx + 34, baseY - 92, 6, 84);
  ctx.fillStyle = 'rgba(196, 156, 106, 0.22)';
  ctx.fillRect(cx - 39, baseY - 92, 1.6, 82);
  ctx.fillRect(cx + 35, baseY - 92, 1.6, 82);

  const roof = [
    [cx - 54, baseY - 92],
    [cx, baseY - 116],
    [cx + 54, baseY - 92],
    [cx, baseY - 74],
  ] as const;
  fillPolygon(ctx, roof, '#8d4732');
  fillPolygon(ctx, [[cx - 54, baseY - 92], [cx, baseY - 74], [cx, baseY - 66], [cx - 54, baseY - 84]], '#743b2a');
  fillPolygon(ctx, [[cx, baseY - 74], [cx + 54, baseY - 92], [cx + 54, baseY - 84], [cx, baseY - 66]], '#9c4f37');
  for (let i = 0; i < 8; i++) {
    ctx.beginPath();
    ctx.moveTo(cx - 48 + i * 12, baseY - 90);
    ctx.lineTo(cx, baseY - 112);
    ctx.strokeStyle = 'rgba(60, 30, 20, 0.25)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.fillStyle = '#5a3823';
  ctx.beginPath();
  ctx.arc(cx, baseY - 116, 2.5, 0, Math.PI * 2);
  ctx.fill();

  // Crossbeam, rope and bucket.
  ctx.fillStyle = '#4e3420';
  ctx.fillRect(cx - 38, baseY - 86, 76, 4);
  ctx.beginPath();
  ctx.moveTo(cx, baseY - 82);
  ctx.lineTo(cx, baseY - 46);
  ctx.strokeStyle = '#b9a179';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = '#7a5432';
  ctx.fillRect(cx - 7, baseY - 46, 14, 11);
  ctx.fillStyle = '#4a301c';
  ctx.fillRect(cx - 7, baseY - 46, 14, 2);
  ctx.fillStyle = '#3a2a1a';
  ctx.beginPath();
  ctx.ellipse(cx, baseY - 35, 7, 2.6, 0, 0, Math.PI * 2);
  ctx.fill();

  // Moss on the stones.
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = `rgba(80, 98, 54, ${range(rng, 0.16, 0.36)})`;
    ctx.beginPath();
    ctx.ellipse(cx + range(rng, -32, 32), baseY + range(rng, -8, 6), range(rng, 2, 4), 1.3, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function paintHay(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const rng = makeRng(27000);
  const cx = width / 2;
  const baseY = height - 10;
  drawSoftEllipse(ctx, cx, baseY, 40, 10, 0.26);
  const gradient = ctx.createLinearGradient(0, baseY - 46, 0, baseY);
  gradient.addColorStop(0, '#d8b967');
  gradient.addColorStop(0.6, '#b8953f');
  gradient.addColorStop(1, '#8c6c2c');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(cx - 42, baseY);
  ctx.quadraticCurveTo(cx - 38, baseY - 44, cx, baseY - 46);
  ctx.quadraticCurveTo(cx + 38, baseY - 44, cx + 42, baseY);
  ctx.closePath();
  ctx.fill();
  for (let i = 0; i < 130; i++) {
    const x = cx + range(rng, -40, 40);
    const top = baseY - 44 + Math.abs(x - cx) * 0.35;
    ctx.beginPath();
    ctx.moveTo(x, baseY);
    ctx.lineTo(x + range(rng, -8, 8), top + rng() * 10);
    ctx.strokeStyle = pick(rng, ['rgba(240, 212, 138, 0.5)', 'rgba(154, 122, 54, 0.5)', 'rgba(196, 164, 82, 0.5)']);
    ctx.lineWidth = range(rng, 0.5, 1.2);
    ctx.stroke();
  }
  ctx.strokeStyle = '#6a4c24';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(cx - 40, baseY - 8);
  ctx.quadraticCurveTo(cx, baseY + 4, cx + 40, baseY - 8);
  ctx.stroke();
}

function paintSack(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const rng = makeRng(28000);
  const cx = width / 2;
  const baseY = height - 6;
  drawSoftEllipse(ctx, cx, baseY, 16, 5, 0.25);
  const gradient = ctx.createLinearGradient(cx - 16, 0, cx + 16, 0);
  gradient.addColorStop(0, '#a58a5c');
  gradient.addColorStop(0.4, '#d6c196');
  gradient.addColorStop(1, '#8f744a');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(cx - 14, baseY);
  ctx.bezierCurveTo(cx - 20, baseY - 20, cx - 8, baseY - 34, cx - 5, baseY - 38);
  ctx.lineTo(cx + 5, baseY - 38);
  ctx.bezierCurveTo(cx + 8, baseY - 34, cx + 20, baseY - 20, cx + 14, baseY);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#6a5230';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - 7, baseY - 36);
  ctx.quadraticCurveTo(cx, baseY - 32, cx + 7, baseY - 36);
  ctx.stroke();
  for (let i = 0; i < 24; i++) {
    ctx.fillStyle = 'rgba(92, 68, 36, 0.15)';
    ctx.fillRect(cx - 13 + rng() * 26, baseY - 34 + rng() * 32, 1, 1);
  }
  ctx.fillStyle = '#c7b083';
  ctx.beginPath();
  ctx.ellipse(cx, baseY - 40, 6, 2.5, 0, 0, Math.PI * 2);
  ctx.fill();
}

function paintSign(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const cx = width / 2;
  const baseY = height - 4;
  drawSoftEllipse(ctx, cx, baseY, 16, 4, 0.24);
  ctx.fillStyle = '#5a3e24';
  ctx.fillRect(cx - 3, baseY - 64, 6, 62);
  ctx.fillStyle = '#7d5a34';
  ctx.fillRect(cx - 24, baseY - 70, 48, 26);
  ctx.fillStyle = '#9c7848';
  ctx.fillRect(cx - 21, baseY - 67, 42, 20);
  ctx.strokeStyle = '#5a3e24';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(cx - 21, baseY - 67, 42, 20);
  // Carved wheat mark.
  ctx.strokeStyle = '#4e341c';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(cx, baseY - 51);
  ctx.lineTo(cx, baseY - 64);
  ctx.stroke();
  for (let i = 0; i < 4; i++) {
    const y = baseY - 55 - i * 3;
    ctx.beginPath();
    ctx.moveTo(cx, y);
    ctx.lineTo(cx - 4, y - 2);
    ctx.moveTo(cx, y);
    ctx.lineTo(cx + 4, y - 2);
    ctx.stroke();
  }
}

function paintPot(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const cx = width / 2;
  const baseY = height - 4;
  drawSoftEllipse(ctx, cx, baseY, 12, 4, 0.25);
  const gradient = ctx.createLinearGradient(cx - 10, 0, cx + 10, 0);
  gradient.addColorStop(0, '#8e4a2c');
  gradient.addColorStop(0.45, '#c0724a');
  gradient.addColorStop(1, '#7a3c22');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(cx - 7, baseY - 26);
  ctx.bezierCurveTo(cx - 14, baseY - 18, cx - 13, baseY - 2, cx, baseY);
  ctx.bezierCurveTo(cx + 13, baseY - 2, cx + 14, baseY - 18, cx + 7, baseY - 26);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#5e2e19';
  ctx.beginPath();
  ctx.ellipse(cx, baseY - 26, 8, 2.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e0b17c';
  ctx.beginPath();
  ctx.ellipse(cx - 3, baseY - 16, 2.4, 5, -0.2, 0, Math.PI * 2);
  ctx.fill();
}

function paintFence(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const rng = makeRng(29000);
  const baseY = height - 5;
  drawSoftEllipse(ctx, width / 2, baseY, width * 0.4, 4, 0.2);
  for (const x of [12, width - 14]) {
    ctx.fillStyle = '#5b4028';
    ctx.fillRect(x - 3, baseY - 52, 6, 52);
    ctx.fillStyle = '#8a663c';
    ctx.fillRect(x - 2, baseY - 50, 2, 48);
  }
  for (const y of [baseY - 42, baseY - 22]) {
    ctx.fillStyle = '#7a5834';
    ctx.fillRect(8, y, width - 16, 5);
    ctx.fillStyle = 'rgba(214, 178, 124, 0.3)';
    ctx.fillRect(8, y, width - 16, 1.4);
  }
  for (let i = 0; i < 12; i++) {
    ctx.fillStyle = 'rgba(46, 30, 16, 0.35)';
    ctx.fillRect(range(rng, 8, width - 8), range(rng, baseY - 46, baseY - 2), 1.5, 4);
  }
}

function paintSmoke(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const gradient = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, width / 2);
  gradient.addColorStop(0, 'rgba(236, 232, 224, 0.42)');
  gradient.addColorStop(0.55, 'rgba(214, 210, 202, 0.2)');
  gradient.addColorStop(1, 'rgba(200, 198, 192, 0)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(width / 2, height / 2, width / 2, 0, Math.PI * 2);
  ctx.fill();
}

function paintShadow(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  drawSoftEllipse(ctx, width / 2, height / 2, width / 2, height / 2, 0.34);
}

/** Generates houses, trees, rocks, market props, villagers' clutter and FX. */
export function generatePropArt(scene: Phaser.Scene): void {
  for (let i = 0; i < 2; i++) {
    createCanvasTexture(scene, `prop_house_${i}`, 240, 260, (ctx, w, h) => paintHouse(ctx, w, h, i));
  }
  createCanvasTexture(scene, 'prop_workshop', 220, 250, paintWorkshop);
  createCanvasTexture(scene, 'prop_granary', 220, 260, paintGranary);
  createCanvasTexture(scene, 'prop_zaviye', 220, 250, paintZaviye);
  for (let i = 0; i < 3; i++) {
    createCanvasTexture(scene, `prop_tree_${i}`, 260, 300, (ctx, w, h) => paintTree(ctx, w, h, i));
  }
  for (let i = 0; i < 2; i++) {
    createCanvasTexture(scene, `prop_rock_${i}`, 130, 110, (ctx, w, h) => paintRock(ctx, w, h, i));
    createCanvasTexture(scene, `prop_market_${i}`, 220, 190, (ctx, w, h) => paintMarketStall(ctx, w, h, i));
  }
  createCanvasTexture(scene, 'prop_well', 140, 180, paintWell);
  createCanvasTexture(scene, 'prop_hay', 100, 70, paintHay);
  createCanvasTexture(scene, 'prop_sack', 48, 60, paintSack);
  createCanvasTexture(scene, 'prop_sign', 70, 96, paintSign);
  createCanvasTexture(scene, 'prop_pot', 40, 44, paintPot);
  createCanvasTexture(scene, 'prop_fence', 110, 78, paintFence);
  createCanvasTexture(scene, 'prop_smoke', 64, 64, paintSmoke);
  createCanvasTexture(scene, 'fx_torch_glow', 96, 56, (ctx,width,height) => {
    const gradient=ctx.createRadialGradient(width/2,height/2,1,width/2,height/2,width/2);
    gradient.addColorStop(0,'rgba(255,202,117,0.32)');gradient.addColorStop(0.45,'rgba(236,155,72,0.12)');gradient.addColorStop(1,'rgba(236,155,72,0)');
    ctx.fillStyle=gradient;ctx.fillRect(0,0,width,height);
  });
  createCanvasTexture(scene, 'prop_shadow', 160, 80, paintShadow);
  createCanvasTexture(scene, 'prop_shadow_small', 80, 40, paintShadow);
  createCanvasTexture(scene, 'prop_barrel', 40, 48, (ctx) => {
    const rng = makeRng(30001);
    drawBarrel(ctx, 20, 46, 1.4, rng);
  });
  createCanvasTexture(scene, 'prop_crate', 46, 40, (ctx) => {
    const rng = makeRng(30002);
    drawCrate(ctx, 23, 37, 1.3, rng);
  });
}

/** Scales a tile-relative offset to the current isometric configuration. */
export function propScale(): { x: number; y: number } {
  return { x: TILE_W / 128, y: TILE_H / 64 };
}
