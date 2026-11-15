/** Small, hand-painted tint and sound profiles for screen-space 2D ambience. */
export const ATMOSPHERE_PRESETS = {
  village: { daylightTint: 0xc2a25c, dawnTint: 0xc58c58, duskTint: 0xb56e43, nightTint: 0x182234, nightAlpha: 0.4, ambienceGain: 1 },
  forest: { daylightTint: 0x89a567, dawnTint: 0x9c825d, duskTint: 0x755a47, nightTint: 0x111a20, nightAlpha: 0.44, ambienceGain: 0.84 },
  market: { daylightTint: 0xc2a25c, dawnTint: 0xc58c58, duskTint: 0xb56e43, nightTint: 0x182234, nightAlpha: 0.4, ambienceGain: 1.08 },
  travel: { daylightTint: 0x9ba887, dawnTint: 0xb27f58, duskTint: 0xa25f46, nightTint: 0x18202a, nightAlpha: 0.43, ambienceGain: 0.76 },
  battlefield: { daylightTint: 0x9d8c78, dawnTint: 0xa27958, duskTint: 0x8d5945, nightTint: 0x171b24, nightAlpha: 0.46, ambienceGain: 0.9 },
} as const;

export type AtmospherePlace = keyof typeof ATMOSPHERE_PRESETS;

/** Renderer-supported quality caps; particles are drawn as one bounded batch. */
export const ATMOSPHERE_PARTICLE_BUDGET = { low: 0, balanced: 12, high: 30 } as const;

/** Smooth local lantern/window contribution, kept separate from the global tint. */
export function localLightIntensity(hour:number):number {
  if(hour>=20||hour<5)return 0.2;
  if(hour>=18)return Math.min(0.2,(hour-18)/2*0.2);
  if(hour>=5&&hour<7)return Math.max(0,(7-hour)/2*0.2);
  return 0;
}
