import Phaser from 'phaser';
import {
  createCanvasTexture,
  darken,
  drawSoftEllipse,
  fillPolygon,
  lighten,
  makeRng,
  rgbaStr,
} from './ArtUtils';
import type { CharacterVisuals } from '@data/CharacterCustomization';

export type CharacterDirection = 'front' | 'back' | 'side';

const FRAME_W = 128;
const FRAME_H = 176;
const FEET_Y = 158;
/**
 * Local y of the feet in the body-drawing coordinate space. The body is
 * painted around y=0..137 (head at the top, boots at the bottom); the whole
 * group is then shifted so those boots land on FEET_Y inside the frame.
 */
const BODY_BASELINE = 137;

const SKIN = 0xc99a6b;
const SKIN_DARK = 0x9d7048;
const KAFTAN = 0x8f3b2c;
const KAFTAN_DARK = 0x65251b;
const KAFTAN_LIGHT = 0xb15440;
const TUNIC = 0xe3d6b4;
const GOLD = 0xc9a648;
const BOOT = 0x3b2a1a;
const BEARD = 0x33200f;
const CAP = 0x7d2c21;
const CLOAK = 0x53613c;
function skinColor(tone?: CharacterVisuals['skinTone']): number {
  return tone === 'deep' ? 0x8e6045 : tone === 'tan' ? 0xb78055 : tone === 'olive' ? 0xb98b61 : SKIN;
}

function drawBoot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  facing: number,
  lift: number,
): void {
  ctx.save();
  ctx.translate(x, y - lift);
  const legGradient = ctx.createLinearGradient(-5, 0, 5, 0);
  legGradient.addColorStop(0, rgbaStr(darken(0x6b4a2e, 0.18)));
  legGradient.addColorStop(0.5, '#765334');
  legGradient.addColorStop(1, '#4d3520');
  ctx.fillStyle = legGradient;
  ctx.beginPath();
  ctx.roundRect(-4.5, -24, 9, 24, 3);
  ctx.fill();

  // Soft leather boot.
  ctx.fillStyle = rgbaStr(BOOT);
  ctx.beginPath();
  ctx.roundRect(-5.5, -8, 11, 9, 3);
  ctx.fill();
  ctx.fillStyle = rgbaStr(lighten(BOOT, 0.16));
  ctx.beginPath();
  ctx.ellipse(facing * 2.5, -2.5, 6.5, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(18, 12, 6, 0.35)';
  ctx.beginPath();
  ctx.ellipse(facing * 2.5, -0.8, 6.5, 1.6, 0, 0, Math.PI * 2);
  ctx.fill();
  // Strap.
  ctx.strokeStyle = 'rgba(190, 150, 96, 0.5)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-4, -6);
  ctx.lineTo(4, -6);
  ctx.stroke();
  ctx.restore();
}

function drawArm(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  swing: number,
  front: boolean,
  skinTone?: CharacterVisuals['skinTone'],
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(swing * 0.16);
  const gradient = ctx.createLinearGradient(-5, 0, 5, 0);
  gradient.addColorStop(0, rgbaStr(front ? KAFTAN_DARK : darken(KAFTAN, 0.22)));
  gradient.addColorStop(0.55, rgbaStr(front ? KAFTAN : KAFTAN_DARK));
  gradient.addColorStop(1, rgbaStr(darken(KAFTAN, 0.3)));
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.roundRect(-5, 0, 10, 30, 4);
  ctx.fill();

  // Cuff.
  ctx.fillStyle = rgbaStr(GOLD, 0.85);
  ctx.fillRect(-5.2, 24, 10.4, 2.4);

  // Hand.
  const skinGradient = ctx.createRadialGradient(-1, 31, 0, 0, 32, 5);
  const skin=skinColor(skinTone);
  skinGradient.addColorStop(0, rgbaStr(lighten(skin,0.2)));
  skinGradient.addColorStop(1, rgbaStr(darken(skin,0.24)));
  ctx.fillStyle = skinGradient;
  ctx.beginPath();
  ctx.ellipse(0, 32, 4.2, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawHead(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  direction: CharacterDirection,
  rng: () => number,
  role?: string,
  gender: 'male' | 'female' = 'male',
  visuals?: CharacterVisuals,
): void {
  const female = gender === 'female';
  const hairColor = visuals?.ageStage === 'elder' ? '#8b8170' : '#38261a';
  ctx.save();
  ctx.translate(x, y);

  // Neck.
  const tone=skinColor(visuals?.skinTone);
  ctx.fillStyle = rgbaStr(darken(tone,0.24));
  ctx.beginPath();
  ctx.roundRect(-4.5, 4, 9, 9, 2);
  ctx.fill();

  if (direction === 'back') {
    // Back of the head; keep hair and facial hair distinct from gender.
    ctx.fillStyle = rgbaStr(darken(tone, 0.08));
    ctx.beginPath();
    ctx.ellipse(0, 0, 10.5, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = hairColor;
    ctx.beginPath();
    ctx.ellipse(0, 4, 9, female && visuals?.hairstyle === 'braided' ? 9 : female && visuals?.hairstyle === 'short' ? 3.5 : 5, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    if (female) {
      // Dark hair visible beneath the felt cap, rather than the shared beard silhouette.
      ctx.fillStyle = hairColor;
      ctx.beginPath();
      const shortHair = visuals?.hairstyle === 'short';
      const braided = visuals?.hairstyle === 'braided';
      ctx.moveTo(-9, -5);
      ctx.quadraticCurveTo(-13, 5, shortHair ? -9 : braided ? -13 : -10, shortHair ? 7 : 14);
      ctx.lineTo(-6, 11);
      ctx.lineTo(-5, -2);
      ctx.moveTo(9, -5);
      ctx.quadraticCurveTo(13, 5, shortHair ? 9 : braided ? 13 : 10, shortHair ? 7 : 14);
      ctx.lineTo(6, 11);
      ctx.lineTo(5, -2);
      ctx.fill();
      if (braided) { ctx.strokeStyle='#9b7650';ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(-11,4);ctx.lineTo(-12,8);ctx.lineTo(-10,11);ctx.lineTo(-12,14);ctx.moveTo(11,4);ctx.lineTo(12,8);ctx.lineTo(10,11);ctx.lineTo(12,14);ctx.stroke(); }
    }
    const faceGradient = ctx.createRadialGradient(
      direction === 'side' ? 3 : -2,
      -4,
      1,
      0,
      0,
      14,
    );
    const skin = tone;
    faceGradient.addColorStop(0, rgbaStr(lighten(skin, 0.2)));
    faceGradient.addColorStop(0.65, rgbaStr(skin));
    faceGradient.addColorStop(1, rgbaStr(darken(skin, 0.24)));
    ctx.fillStyle = faceGradient;
    ctx.beginPath();
    if (direction === 'side') {
      ctx.ellipse(1.5, 0, 10.5, 12.5, 0, 0, Math.PI * 2);
    } else if (female) {
      ctx.moveTo(-8, -9);ctx.quadraticCurveTo(-7,-13,0,-13);
      ctx.quadraticCurveTo(8,-13,9,-7);ctx.lineTo(8,4);
      ctx.quadraticCurveTo(5,11,0,12);ctx.quadraticCurveTo(-6,10,-8,4);ctx.closePath();
    } else {
      const face = visuals?.face ?? 'oval';
      ctx.ellipse(0, 0, face === 'round' ? 12 : face === 'long' ? 9.5 : 11, face === 'round' ? 11.5 : 12.5, 0, 0, Math.PI * 2);
    }
    ctx.fill();

    // Ears.
    ctx.fillStyle = rgbaStr(tone);
    ctx.beginPath();
    if (direction === 'side') {
      ctx.ellipse(-7, 1, 3, 4.6, 0, 0, Math.PI * 2);
    } else {
      ctx.ellipse(-10, 1, 2.6, 4.2, 0, 0, Math.PI * 2);
      ctx.ellipse(10, 1, 2.6, 4.2, 0, 0, Math.PI * 2);
    }
    ctx.fill();

    if (!female && visuals?.facialHair !== 'none') {
      // A smaller, shaped beard leaves more of the face visible.
      ctx.fillStyle = rgbaStr(BEARD);
      ctx.beginPath();
      if (direction === 'side') {
        ctx.moveTo(-4, 5); ctx.quadraticCurveTo(3, 9, 11, 6);
        ctx.quadraticCurveTo(8, 12, 2, 12); ctx.quadraticCurveTo(-5, 11, -4, 5);
      } else {
        ctx.moveTo(-8, 5); ctx.quadraticCurveTo(-7, visuals?.facialHair === 'full' ? 16 : 12, 0, visuals?.facialHair === 'full' ? 17 : 13);
        ctx.quadraticCurveTo(7, 12, 8, 5); ctx.quadraticCurveTo(0, 9, -8, 5);
      }
      ctx.fill();
      ctx.strokeStyle = 'rgba(90, 60, 34, 0.45)';
      ctx.lineWidth = 0.7;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(-3 + i * 2.4, 8 + Math.abs(i - 1));
        ctx.lineTo(-2 + i * 2.4, 11 - Math.abs(i - 1));
        ctx.stroke();
      }
    }

    if (direction === 'front') {
      // Eyes, brows, nose.
      ctx.fillStyle = 'rgba(246, 229, 199, 0.95)';
      ctx.beginPath();
      ctx.ellipse(-4.2, -2, 1.75, 1.15, 0, 0, Math.PI * 2);
      ctx.ellipse(4.2, -2, 1.75, 1.15, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(42, 31, 22, 0.95)';
      ctx.beginPath();
      ctx.ellipse(-4.1, -2, 0.72, 1, 0, 0, Math.PI * 2);
      ctx.ellipse(4.3, -2, 0.72, 1, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(52, 34, 18, 0.8)';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(-6.5, -5);
      ctx.quadraticCurveTo(-4, -6.5, -2, -5);
      ctx.moveTo(2, -5);
      ctx.quadraticCurveTo(4, -6.5, 6.5, -5);
      ctx.stroke();
      ctx.fillStyle = rgbaStr(SKIN_DARK);
      ctx.beginPath();
      ctx.moveTo(0, -1);
      ctx.lineTo(-1.8, 2.4);
      ctx.lineTo(1.8, 2.4);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(70, 32, 22, 0.5)';
      ctx.beginPath();
      ctx.moveTo(-2.5, 5.4);
      ctx.lineTo(2.5, 5.4);
      ctx.stroke();
    } else if (direction === 'side') {
      // Profile eye, brow and nose.
      ctx.fillStyle = 'rgba(40, 26, 14, 0.9)';
      ctx.beginPath();
      ctx.ellipse(6, -2, 1.4, 1.1, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(52, 34, 18, 0.8)';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(3.5, -5);
      ctx.quadraticCurveTo(6, -6.2, 8, -5);
      ctx.stroke();
      ctx.fillStyle = rgbaStr(SKIN_DARK);
      ctx.beginPath();
      ctx.moveTo(10, -1);
      ctx.quadraticCurveTo(14.5, 1, 12, 3.2);
      ctx.lineTo(10, 3);
      ctx.closePath();
      ctx.fill();
    }
  }

  if (role === 'Akıncı') {
    // Early frontier helmet: shaded steel dome, brow rim and a short nose guard.
    const steel = ctx.createLinearGradient(-12, -16, 12, -3);
    steel.addColorStop(0, '#b6a98a'); steel.addColorStop(0.35, '#6f7169'); steel.addColorStop(0.72, '#444943'); steel.addColorStop(1, '#282d2b');
    ctx.fillStyle = steel; ctx.beginPath(); ctx.ellipse(0, -10, 11.8, 8.5, 0, Math.PI, Math.PI * 2);
    ctx.lineTo(10, -3); ctx.lineTo(-10, -3); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#c3ad79'; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(-11, -4); ctx.lineTo(11, -4); ctx.stroke();
    ctx.strokeStyle = 'rgba(231, 218, 184, 0.45)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-5, -14); ctx.quadraticCurveTo(-1, -17, 3, -15); ctx.stroke();
    if (direction !== 'back') { ctx.strokeStyle = '#81775f'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(0, 3); ctx.stroke(); }
  } else if (role === 'Kervancı') {
    // Layered cream turban with a wrapped edge and restrained cloth folds.
    ctx.fillStyle = '#c9b991'; ctx.beginPath(); ctx.ellipse(0, -10, 12.2, 7.5, 0, Math.PI, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e2d4b4'; ctx.beginPath(); ctx.ellipse(0, -11, 9.2, 6, 0, Math.PI, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(107, 86, 57, 0.65)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-10, -6); ctx.quadraticCurveTo(-2, -10, 10, -6); ctx.moveTo(-7, -11); ctx.quadraticCurveTo(-1, -14, 6, -11); ctx.stroke();
  } else if (female) {
    // Plain woven head wrap; muted linen with stitched folds, avoiding a
    // role-specific military or merchant marker on civilian women.
    const wrap=ctx.createLinearGradient(-9,-16,9,-4);
    wrap.addColorStop(0,'#c8b99b');wrap.addColorStop(0.5,'#9e8b6b');wrap.addColorStop(1,'#756346');
    ctx.fillStyle=wrap;ctx.beginPath();ctx.ellipse(0,-9,11.8,8,0,Math.PI,Math.PI*2);ctx.lineTo(10,-2);ctx.quadraticCurveTo(7,2,5,4);ctx.lineTo(-7,4);ctx.quadraticCurveTo(-12,0,-11,-7);ctx.closePath();ctx.fill();
    ctx.strokeStyle='rgba(235, 224, 199, 0.48)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(-9,-5);ctx.quadraticCurveTo(0,-8,10,-5);ctx.moveTo(-5,-12);ctx.quadraticCurveTo(0,-15,5,-12);ctx.stroke();
  } else if (role === 'Çiftçi') {
    // Plain woolen cap, worn and unadorned.
    ctx.fillStyle = '#67523a'; ctx.beginPath(); ctx.ellipse(0, -10, 11.4, 7, 0, Math.PI, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#806a4b'; ctx.beginPath(); ctx.ellipse(0, -6, 11, 2.4, 0, Math.PI, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(35, 27, 18, 0.55)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(-9, -6); ctx.quadraticCurveTo(0, -8, 9, -6); ctx.stroke();
  } else {
    // Felt cap for legacy villagers and NPCs.
    const capGradient = ctx.createLinearGradient(-10, -16, 8, -4);
    capGradient.addColorStop(0, rgbaStr(lighten(CAP, 0.2))); capGradient.addColorStop(0.55, rgbaStr(CAP)); capGradient.addColorStop(1, rgbaStr(darken(CAP, 0.28)));
    ctx.fillStyle = capGradient; ctx.beginPath(); ctx.ellipse(0, -11, 11.6, 7.4, 0, Math.PI, Math.PI * 2);
    ctx.quadraticCurveTo(12, -5, 9, -3.5); ctx.lineTo(-9, -3.5); ctx.quadraticCurveTo(-12, -5, -11.6, -11); ctx.fill();
    ctx.fillStyle = '#e3d7bb'; ctx.beginPath(); ctx.roundRect(-10.4, -6.6, 20.8, 3.2, 1.6); ctx.fill();
    ctx.fillStyle = 'rgba(255, 244, 214, 0.35)'; ctx.beginPath(); ctx.ellipse(-3, -12, 5.5, 2.2, -0.2, 0, Math.PI * 2); ctx.fill();
  }

  // Stray beard speckle.
  for (let i = 0; !female && i < 8; i++) {
    ctx.fillStyle = 'rgba(90, 62, 36, 0.35)';
    ctx.fillRect(-7 + rng() * 14, 3 + rng() * 9, 0.8, 1.6);
  }

  ctx.restore();
}

/** Fine, restrained cloth folds that retain their shape at the game's native zoom. */
function paintClothFinish(ctx:CanvasRenderingContext2D,direction:CharacterDirection,phase:number,female=false):void {
  const side=direction==='side';
  ctx.save();
  ctx.beginPath();
  if(side){ctx.moveTo(-13,72);ctx.quadraticCurveTo(12,70,15,88);ctx.lineTo(female?18:13,female?121:112);ctx.lineTo(female?-14:-11,female?120:112);ctx.quadraticCurveTo(-16,92,-13,72);}
  else if(female){ctx.moveTo(-15,74);ctx.quadraticCurveTo(0,68,15,74);ctx.quadraticCurveTo(13,89,10,97);ctx.quadraticCurveTo(15,105,18,121);ctx.quadraticCurveTo(0,127,-18,121);ctx.quadraticCurveTo(-15,105,-10,97);ctx.quadraticCurveTo(-13,89,-15,74);}
  else{ctx.moveTo(-19,74);ctx.quadraticCurveTo(0,66,19,74);ctx.quadraticCurveTo(17,94,14,112);ctx.lineTo(-14,112);ctx.quadraticCurveTo(-17,94,-19,74);}
  ctx.closePath();ctx.clip();
  const shift=Math.sin(phase)*0.7;
  ctx.lineCap='round';
  ctx.strokeStyle='rgba(245, 218, 175, 0.22)';ctx.lineWidth=1.15;
  ctx.beginPath();ctx.moveTo(side?-8:female?-11:-14,78);ctx.quadraticCurveTo(side?-11:female?-8:-10,94,side?-7:female?-12:-8,female?117:106);ctx.stroke();
  ctx.beginPath();ctx.moveTo(side?8:female?11:14,80);ctx.quadraticCurveTo(side?6:female?8:10,96,side?9:female?12:9,female?117:108);ctx.stroke();
  ctx.strokeStyle='rgba(48, 24, 17, 0.19)';ctx.lineWidth=1.6;
  ctx.beginPath();ctx.moveTo(-2+shift,82);ctx.quadraticCurveTo(-7+shift,97,-3+shift,female?118:110);ctx.stroke();
  ctx.beginPath();ctx.moveTo(5-shift,84);ctx.quadraticCurveTo(9-shift,99,5-shift,female?118:111);ctx.stroke();
  // A quiet hand-finished hem seam, not metallic decoration.
  ctx.strokeStyle='rgba(235, 210, 170, 0.34)';ctx.lineWidth=0.8;ctx.setLineDash([2,2]);
  ctx.beginPath();ctx.moveTo(side?(female?-12:-10):female?-15:-12,female?120:110);ctx.lineTo(side?(female?14:11):female?15:12,female?120:110);ctx.stroke();ctx.setLineDash([]);
  ctx.restore();
}

function paintCharacter(
  ctx: CanvasRenderingContext2D,
  direction: CharacterDirection,
  phase: number,
  walking: boolean,
  role?: string,
  gender: 'male' | 'female' = 'male',
  visuals?: CharacterVisuals,
  weapon = 'melee_dagger',
): void {
  const rng = makeRng(42000 + (direction === 'front' ? 1 : direction === 'back' ? 2 : 3) * 97);
  const swing = walking ? Math.sin(phase) : 0;
  const bob = walking ? -Math.abs(Math.cos(phase)) * 1.6 : Math.sin(phase * 0.4) * 0.4;
  const side = direction === 'side';
  const facing = direction === 'front' ? 1 : 1;

  ctx.clearRect(0, 0, FRAME_W, FRAME_H);
  drawSoftEllipse(ctx, FRAME_W / 2 + 2, FEET_Y, 24, 7.5, 0.3);

  ctx.save();
  ctx.translate(FRAME_W / 2, FEET_Y - BODY_BASELINE + bob);
  ctx.scale(visuals?.build === 'slim' ? 0.94 : visuals?.build === 'broad' ? 1.06 : 1, 1);

  // Back arm first so it sits behind the torso.
  if (direction === 'front') {
    drawArm(ctx, gender==='female'?-16:-19, 76, -swing, false, visuals?.skinTone);
    drawArm(ctx, gender==='female'?16:19, 76, swing, false, visuals?.skinTone);
  } else if (direction === 'back') {
    drawArm(ctx, gender==='female'?-16:-19, 76, swing, false, visuals?.skinTone);
    drawArm(ctx, gender==='female'?16:19, 76, -swing, false, visuals?.skinTone);
  } else {
    drawArm(ctx, -4, 78, -swing * 0.7, false, visuals?.skinTone);
  }

  // Legs.
  if (side) {
    drawBoot(ctx, -4 + swing * 7, BODY_BASELINE, facing, Math.max(0, -swing) * 3.2);
    drawBoot(ctx, 3 - swing * 7, BODY_BASELINE, facing, Math.max(0, swing) * 3.2);
  } else {
    drawBoot(ctx, gender==='female'?-6:-7, BODY_BASELINE, facing, Math.max(0, swing) * 3.4);
    drawBoot(ctx, gender==='female'?6:7, BODY_BASELINE, facing, Math.max(0, -swing) * 3.4);
  }

  // Cloak behind the torso for the back view.
  if (direction === 'back') {
    const cloakGradient = ctx.createLinearGradient(-22, 68, 22, gender==='female'?124:118);
    cloakGradient.addColorStop(0, rgbaStr(lighten(CLOAK, 0.12)));
    cloakGradient.addColorStop(0.6, rgbaStr(CLOAK));
    cloakGradient.addColorStop(1, rgbaStr(darken(CLOAK, 0.28)));
    fillPolygon(
      ctx,
      [
        [-22, 72],
        [22, 72],
        [gender==='female'?15:18, gender==='female'?118:112],
        [0, gender==='female'?126:122],
        [gender==='female'?-15:-18, gender==='female'?118:112],
      ],
      cloakGradient,
    );
    ctx.strokeStyle = 'rgba(38, 46, 28, 0.45)';
    ctx.lineWidth = 1;
    for (const x of [-12, -4, 4, 12]) {
      ctx.beginPath();
      ctx.moveTo(x * 0.8, 76);
      ctx.quadraticCurveTo(x, 96, x * 1.15, 114);
      ctx.stroke();
    }
  }

  // Torso.
  const torsoGradient = ctx.createLinearGradient(-20, 70, 20, 118);
  torsoGradient.addColorStop(0, rgbaStr(KAFTAN_DARK));
  torsoGradient.addColorStop(0.35, rgbaStr(KAFTAN));
  torsoGradient.addColorStop(0.75, rgbaStr(KAFTAN_LIGHT));
  torsoGradient.addColorStop(1, rgbaStr(darken(KAFTAN, 0.24)));
  ctx.fillStyle = torsoGradient;
  ctx.beginPath();
  if (side && gender==='female') {
    ctx.moveTo(-13,72);ctx.quadraticCurveTo(11,70,15,88);ctx.lineTo(18,121);ctx.lineTo(-14,120);ctx.quadraticCurveTo(-16,92,-13,72);
  } else if (side) {
    ctx.moveTo(-13, 72);
    ctx.quadraticCurveTo(12, 70, 15, 88);
    ctx.lineTo(13, 112);
    ctx.lineTo(-11, 112);
    ctx.quadraticCurveTo(-16, 92, -13, 72);
  } else if(gender==='female') {
    ctx.moveTo(-15,74);ctx.quadraticCurveTo(0,68,15,74);
    ctx.quadraticCurveTo(13,89,10,97);ctx.quadraticCurveTo(15,105,18,121);
    ctx.quadraticCurveTo(0,127,-18,121);ctx.quadraticCurveTo(-15,105,-10,97);
    ctx.quadraticCurveTo(-13,89,-15,74);
  } else {
    ctx.moveTo(-19, 74);
    ctx.quadraticCurveTo(0, 66, 19, 74);
    ctx.quadraticCurveTo(17, 94, 14, 112);
    ctx.lineTo(-14, 112);
    ctx.quadraticCurveTo(-17, 94, -19, 74);
  }
  ctx.closePath();
  ctx.fill();

  paintClothFinish(ctx,direction,phase,gender==='female');

  // Tunic collar.
  if (direction !== 'back') {
    ctx.fillStyle = rgbaStr(TUNIC);
    ctx.beginPath();
    if (side) {
      ctx.moveTo(5, 72);
      ctx.lineTo(15, 78);
      ctx.lineTo(11, 88);
      ctx.lineTo(4, 82);
    } else {
      ctx.moveTo(-6, 71);
      ctx.lineTo(0, 88);
      ctx.lineTo(6, 71);
      ctx.lineTo(2, 69);
      ctx.lineTo(0, 76);
      ctx.lineTo(-2, 69);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = rgbaStr(GOLD, 0.85);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    if (side) {
      ctx.moveTo(5, 72);
      ctx.lineTo(11, 88);
    } else {
      ctx.moveTo(-6, 71);
      ctx.lineTo(0, 88);
      ctx.lineTo(6, 71);
    }
    ctx.stroke();
  }

  // Work clothes, campaign armor and merchant's cross-body travel strap.
  if (role === 'Çiftçi' && direction !== 'back') {
    ctx.fillStyle = '#776144';
    ctx.beginPath(); ctx.moveTo(-10, 96); ctx.lineTo(10, 96);
    ctx.lineTo(gender==='female'?14:12, gender==='female'?119:112); ctx.lineTo(gender==='female'?-14:-12, gender==='female'?119:112); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(225, 204, 162, 0.45)'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(-8, 99); ctx.lineTo(-9, 109); ctx.moveTo(8, 99); ctx.lineTo(9, 109); ctx.stroke();
  } else if (role === 'Akıncı' && direction !== 'back') {
    ctx.fillStyle = '#60452e';
    ctx.beginPath(); ctx.moveTo(-15, 77); ctx.lineTo(-8, 73); ctx.lineTo(0, 81);
    ctx.lineTo(8, 73); ctx.lineTo(15, 77); ctx.lineTo(11, 104); ctx.lineTo(-11, 104); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(207, 177, 126, 0.8)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-8, 78); ctx.lineTo(-6, 101); ctx.moveTo(8, 78); ctx.lineTo(6, 101); ctx.stroke();
    ctx.fillStyle = '#b7a070';
    for (const x of [-9, 9]) for (const y of [81, 91, 101]) {
      ctx.beginPath(); ctx.arc(x, y, 1.1, 0, Math.PI * 2); ctx.fill();
    }
  } else if (role === 'Kervancı' && direction === 'front') {
    ctx.strokeStyle = '#60452e'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(-13, 75); ctx.lineTo(12, 105); ctx.stroke();
    ctx.strokeStyle = 'rgba(220, 190, 140, 0.65)'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(-14, 75); ctx.lineTo(11, 105); ctx.stroke();
    ctx.fillStyle = '#745536'; ctx.beginPath(); ctx.roundRect(8, 96, 9, 12, 2); ctx.fill();
    ctx.strokeStyle = '#c3a56c'; ctx.lineWidth = 0.8; ctx.stroke();
  }

  if(gender==='female'&&direction!=='back'){
    // Visible woven inner layer and wrap seam give women a distinct layered
    // long-tunic silhouette without relying on exaggerated body proportions.
    const linen=ctx.createLinearGradient(-8,88,8,120);
    linen.addColorStop(0,'#c3b08d');linen.addColorStop(0.55,'#a89370');linen.addColorStop(1,'#78664c');
    if(side)fillPolygon(ctx,[[2,83],[10,87],[12,117],[-8,121],[-7,95]],linen);
    else fillPolygon(ctx,[[-4,86],[4,86],[9,117],[0,124],[-9,117]],linen);
    ctx.strokeStyle='rgba(65, 48, 31, 0.55)';ctx.lineWidth=0.9;ctx.beginPath();
    if(side){ctx.moveTo(3,87);ctx.quadraticCurveTo(0,102,-5,118);}
    else{ctx.moveTo(-4,88);ctx.quadraticCurveTo(1,101,7,118);}
    ctx.stroke();
    ctx.strokeStyle='rgba(232, 216, 186, 0.46)';ctx.lineWidth=0.75;ctx.setLineDash([1.6,2]);ctx.beginPath();
    ctx.moveTo(side?-7:-8,119);ctx.lineTo(side?11:8,119);ctx.stroke();ctx.setLineDash([]);
  }

  // Front arm.
  if (direction === 'front') {
    drawArm(ctx, gender==='female'?16:19, 78, -swing, true, visuals?.skinTone);
  } else if (direction === 'back') {
    drawArm(ctx, gender==='female'?16:19, 78, swing, true, visuals?.skinTone);
  } else {
    drawArm(ctx, 9, 80, swing * 0.7, true, visuals?.skinTone);
  }

  // Sash and belt knot.
  const sashColor=gender==='female'?0x887455:GOLD;
  const sashGradient = ctx.createLinearGradient(0, 104, 0, 112);
  sashGradient.addColorStop(0, rgbaStr(lighten(sashColor, 0.18)));
  sashGradient.addColorStop(0.6, rgbaStr(sashColor));
  sashGradient.addColorStop(1, rgbaStr(darken(sashColor, 0.3)));
  ctx.fillStyle = sashGradient;
  ctx.beginPath();
  if (side) {
    ctx.roundRect(gender==='female'?-11:-12, 103, gender==='female'?23:26, gender==='female'?6:8, 2);
  } else {
    ctx.roundRect(gender==='female'?-13:-15, 103, gender==='female'?26:30, gender==='female'?6:8, 2);
  }
  ctx.fill();
  ctx.strokeStyle = rgbaStr(darken(sashColor, 0.4));
  ctx.lineWidth = 0.8;
  ctx.stroke();

  if (direction === 'back') {
    ctx.fillStyle = rgbaStr(darken(sashColor, 0.18));
    ctx.beginPath();
    ctx.ellipse(0, 107, 3.2, 2.2, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Belt end and tassel.
    ctx.fillStyle = rgbaStr(darken(sashColor, 0.22));
    ctx.beginPath();
    ctx.moveTo(side ? 10 : 8, 108);
    ctx.lineTo(side ? 18 : 14, 122);
    ctx.lineTo(side ? 13 : 10, 122);
    ctx.closePath();
    ctx.fill();
  }

  // Equipment silhouette is intentionally subdued and anchored at the belt.
  ctx.save();
  ctx.translate(side ? -9 : -15, 106);
  ctx.rotate(weapon === 'bow' ? 0 : -0.55);
  ctx.strokeStyle = 'rgba(220, 224, 226, 0.9)';
  ctx.lineWidth = weapon === 'melee_spear' ? 2.2 : weapon === 'melee_axe' ? 3 : 2;
  ctx.beginPath();
  if (weapon === 'bow') { ctx.moveTo(0,-18);ctx.quadraticCurveTo(12,-10,0,0);ctx.stroke();ctx.strokeStyle='#c9b991';ctx.lineWidth=0.8;ctx.beginPath();ctx.moveTo(0,-18);ctx.lineTo(0,0);ctx.stroke(); }
  else if (weapon === 'melee_spear') { ctx.moveTo(0,2);ctx.lineTo(0,-26);ctx.stroke();ctx.beginPath();ctx.moveTo(-3,-22);ctx.lineTo(0,-28);ctx.lineTo(3,-22);ctx.stroke(); }
  else if (weapon === 'melee_axe') { ctx.moveTo(0,1);ctx.lineTo(0,-19);ctx.stroke();ctx.fillStyle='#a9a69a';ctx.fillRect(-4,-19,8,7); }
  else { ctx.moveTo(0, 0);ctx.quadraticCurveTo(-6, -10, -10, -20);ctx.stroke(); }
  ctx.strokeStyle = '#5b3c22';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(1, 1);
  ctx.lineTo(-2, -6);
  ctx.stroke();
  ctx.fillStyle = rgbaStr(GOLD);
  ctx.beginPath();
  ctx.ellipse(1, 2, 3, 1.7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Head.
  drawHead(ctx, side ? 2 : 0, 46, direction, rng, role, gender, visuals);

  ctx.restore();
}

/** Generates idle and six-frame walk cycles for each facing direction. */
export function generateCharacterArt(scene: Phaser.Scene): void {
  const directions: CharacterDirection[] = ['front', 'back', 'side'];
  for (const direction of directions) {
    createCanvasTexture(scene, `player_${direction}_idle`, FRAME_W, FRAME_H, (ctx) =>
      paintCharacter(ctx, direction, 0, false));
    for (let frame = 0; frame < 6; frame++) {
      createCanvasTexture(scene, `player_${direction}_walk_${frame}`, FRAME_W, FRAME_H, (ctx) =>
        paintCharacter(ctx, direction, (frame / 6) * Math.PI * 2, true));
    }
    createCanvasTexture(scene, `player_female_${direction}_idle`, FRAME_W, FRAME_H, (ctx) =>
      paintCharacter(ctx, direction, 0, false, undefined, 'female'));
    for (let frame = 0; frame < 6; frame++) {
      createCanvasTexture(scene, `player_female_${direction}_walk_${frame}`, FRAME_W, FRAME_H, (ctx) =>
        paintCharacter(ctx, direction, (frame / 6) * Math.PI * 2, true, undefined, 'female'));
    }
  }

  // Role palettes make the chosen life path visible in every direction and
  // animation frame while keeping one shared character-art pipeline.
  const roleColors: Record<string, number> = { 'Çiftçi': 0x55733d, 'Akıncı': 0x8f3b2c, 'Kervancı': 0x476579 };
  for (const [role, color] of Object.entries(roleColors)) {
      const recolor = (ctx: CanvasRenderingContext2D): void => {
      const image = ctx.getImageData(0, 0, FRAME_W, FRAME_H);
      const [targetR, targetG, targetB] = [
        (color >> 16) & 255, (color >> 8) & 255, color & 255,
      ];
      for (let i = 0; i < image.data.length; i += 4) {
        const r = image.data[i]!, g = image.data[i + 1]!, b = image.data[i + 2]!;
        const y = Math.floor(i / 4 / FRAME_W);
        // Limit palette changes to the cap and robe. Skin highlights also contain
        // red, so hue-only replacement would tint faces with the clothing color.
        const clothArea = y < 67 || (y > 90 && y < 140);
        if (clothArea && r > g * 1.28 && r > b * 1.25 && r - b > 35) {
          const brightness = Math.min(1.25, (r + g + b) / (3 * 125));
          image.data[i] = Math.min(255, targetR * brightness);
          image.data[i + 1] = Math.min(255, targetG * brightness);
          image.data[i + 2] = Math.min(255, targetB * brightness);
        }
      }
      ctx.putImageData(image, 0, 0);
    };
    for (const direction of directions) {
      createCanvasTexture(scene, `player_${role}_${direction}_idle`, FRAME_W, FRAME_H, (ctx) => {
        paintCharacter(ctx, direction, 0, false, role); recolor(ctx);
      });
      for (let frame = 0; frame < 6; frame++) {
        createCanvasTexture(scene, `player_${role}_${direction}_walk_${frame}`, FRAME_W, FRAME_H, (ctx) => {
          paintCharacter(ctx, direction, (frame / 6) * Math.PI * 2, true, role, 'male'); recolor(ctx);
        });
      }
      createCanvasTexture(scene, `player_female_${role}_${direction}_idle`, FRAME_W, FRAME_H, (ctx) => {
        paintCharacter(ctx, direction, 0, false, role, 'female'); recolor(ctx);
      });
      for (let frame = 0; frame < 6; frame++) {
        createCanvasTexture(scene, `player_female_${role}_${direction}_walk_${frame}`, FRAME_W, FRAME_H, (ctx) => {
          paintCharacter(ctx, direction, (frame / 6) * Math.PI * 2, true, role, 'female'); recolor(ctx);
        });
      }
    }
  }

  createCanvasTexture(scene, 'player_ring', 112, 56, (ctx, width, height) => {
    const cx = width / 2;
    const cy = height / 2;
    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, width / 2);
    gradient.addColorStop(0, 'rgba(201, 166, 72, 0.05)');
    gradient.addColorStop(0.62, 'rgba(201, 166, 72, 0.16)');
    gradient.addColorStop(0.92, 'rgba(226, 196, 110, 0.55)');
    gradient.addColorStop(1, 'rgba(226, 196, 110, 0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(cx, cy, width / 2, height / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(236, 208, 126, 0.8)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(cx, cy, width * 0.4, height * 0.38, 0, 0, Math.PI * 2);
    ctx.stroke();
  });
}

/** Generate dedicated, reusable idle/walk frames for one customized player. */
export function generateCustomizedCharacterArt(scene: Phaser.Scene, id: string, role: string, gender: 'male'|'female', visuals: CharacterVisuals, armor = 'none', weapon = 'melee_dagger'): string {
  // Character textures can be referenced by a live Phaser Image. Removing and
  // recreating the same key invalidates that Image's WebGL texture and leaves
  // the renderer trying to read a null glTexture. Give each appearance an
  // immutable, content-addressed key and reuse it when the same appearance is
  // requested again.
  const appearance = JSON.stringify({ id, role, gender, visuals, armor, weapon });
  let hash = 2166136261;
  for (let i = 0; i < appearance.length; i++) {
    hash = Math.imul(hash ^ appearance.charCodeAt(i), 16777619);
  }
  const prefix = `player_custom_${id}_${(hash >>> 0).toString(36)}_`;
  const directions: CharacterDirection[] = ['front','back','side'];
  for (const direction of directions) {
    const poses: Array<[string,number,boolean]> = [['idle',0,false], ...Array.from({length:6},(_,i):[string,number,boolean]=>[`walk_${i}`, (i/6)*Math.PI*2, true])];
    for (const [pose,phase,walking] of poses) {
      const key = `${prefix}${direction}_${pose}`;
      if (scene.textures.exists(key)) continue;
      createCanvasTexture(scene,key,FRAME_W,FRAME_H,ctx=>{
        paintCharacter(ctx,direction,phase,walking,role,gender,visuals,weapon);
        if (armor !== 'none' && direction !== 'back') {
          ctx.save(); ctx.translate(FRAME_W/2, FEET_Y-BODY_BASELINE+(walking?-Math.abs(Math.cos(phase))*1.6:0));
          ctx.fillStyle=armor==='chainmail'?'rgba(112,118,112,0.78)':'rgba(87,59,34,0.88)';ctx.beginPath();ctx.moveTo(-14,78);ctx.lineTo(14,78);ctx.lineTo(11,105);ctx.lineTo(-11,105);ctx.closePath();ctx.fill();
          ctx.strokeStyle=armor==='chainmail'?'rgba(196,190,164,0.78)':'#c19a5a';ctx.lineWidth=0.8;
          if(armor==='chainmail'){for(let y=82;y<103;y+=4){ctx.beginPath();ctx.moveTo(-10,y);ctx.lineTo(10,y);ctx.stroke();}}
          else {ctx.beginPath();ctx.moveTo(-10,80);ctx.lineTo(9,100);ctx.moveTo(10,80);ctx.lineTo(-9,100);ctx.stroke();}
          ctx.restore();
        }
      });
    }
  }
  return prefix;
}

export const CHARACTER_FRAME = { width: FRAME_W, height: FRAME_H, feetY: FEET_Y } as const;
