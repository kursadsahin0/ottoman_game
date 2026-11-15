import type { Gender } from './FamilyData';

/** Appearance options supported by the painted 2D character rig. */
export type FacePreset = 'oval' | 'round' | 'long';
export type Hairstyle = 'tied' | 'short' | 'braided';
export type FacialHair = 'none' | 'trimmed' | 'full';
export type SkinTone = 'warm' | 'olive' | 'tan' | 'deep';
export type BodyBuild = 'slim' | 'average' | 'broad';
export interface CharacterVisuals {
  face: FacePreset; hairstyle: Hairstyle; facialHair: FacialHair;
  skinTone: SkinTone; build: BodyBuild;
  ageStage?: 'young' | 'adult' | 'elder';
}

export const DEFAULT_CHARACTER_VISUALS: CharacterVisuals = {
  face: 'oval', hairstyle: 'tied', facialHair: 'trimmed', skinTone: 'warm', build: 'average',
};
export const CHARACTER_PRESETS: ReadonlyArray<{ name: string; gender: Gender; background: 'Çiftçi'|'Akıncı'|'Kervancı'; visuals: CharacterVisuals }> = [
  { name: 'Hasan', gender: 'male', background: 'Çiftçi', visuals: { ...DEFAULT_CHARACTER_VISUALS, face: 'long', hairstyle: 'short', facialHair: 'full', skinTone: 'tan' } },
  { name: 'Aysun', gender: 'female', background: 'Akıncı', visuals: { ...DEFAULT_CHARACTER_VISUALS, face: 'oval', hairstyle: 'braided', facialHair: 'none', skinTone: 'olive' } },
  { name: 'Yusuf', gender: 'male', background: 'Kervancı', visuals: { ...DEFAULT_CHARACTER_VISUALS, face: 'round', hairstyle: 'tied', facialHair: 'trimmed', skinTone: 'warm' } },
];

export function normalizeCharacterVisuals(value: unknown, gender: Gender): CharacterVisuals {
  const v = value && typeof value === 'object' ? value as Partial<CharacterVisuals> : {};
  const oneOf = <T extends string>(x: unknown, values: readonly T[], fallback: T): T => values.includes(x as T) ? x as T : fallback;
  return {
    face: oneOf(v.face, ['oval','round','long'], 'oval'),
    hairstyle: oneOf(v.hairstyle, ['tied','short','braided'], 'tied'),
    facialHair: gender === 'female' ? 'none' : oneOf(v.facialHair, ['none','trimmed','full'], 'trimmed'),
    skinTone: oneOf(v.skinTone, ['warm','olive','tan','deep'], 'warm'),
    build: oneOf(v.build, ['slim','average','broad'], 'average'),
    ...(v.ageStage === 'young' || v.ageStage === 'adult' || v.ageStage === 'elder' ? { ageStage: v.ageStage } : {}),
  };
}

export function visualsForAge(visuals: CharacterVisuals, age: number): CharacterVisuals {
  return { ...visuals, ageStage: age < 18 ? 'young' : age >= 60 ? 'elder' : 'adult' };
}

/** Equipment appearance is a separate rendering profile; it does not modify stats. */
export function resolveEquipmentAppearance(armor: string, weapon: string): { armor: 'none'|'leather'|'chainmail'; weapon: string } {
  return {
    armor: armor === 'leather' || armor === 'chainmail' ? armor : 'none',
    weapon: ['melee_dagger','melee_sword','melee_spear','melee_axe','bow'].includes(weapon) ? weapon : 'melee_dagger',
  };
}

/** Deterministically combines visual traits while changing at least one trait. */
export function inheritCharacterVisuals(a: CharacterVisuals, b: CharacterVisuals, gender: Gender, seed: number): CharacterVisuals {
  const choose = <T extends string>(x: T, y: T, salt: number): T => ((Math.imul(seed ^ salt, 0x45d9f3b) >>> 0) & 1) ? x : y;
  const result = normalizeCharacterVisuals({
    face: choose(a.face,b.face,11), hairstyle: choose(a.hairstyle,b.hairstyle,23),
    facialHair: choose(a.facialHair,b.facialHair,31), skinTone: choose(a.skinTone,b.skinTone,47),
    build: choose(a.build,b.build,59),
  }, gender);
  if (JSON.stringify(result) === JSON.stringify(normalizeCharacterVisuals(a, gender))) {
    result.face = result.face === 'oval' ? 'round' : 'oval';
  }
  return result;
}
