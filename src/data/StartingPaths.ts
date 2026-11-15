import { ArmorType, WeaponType } from '@data/CombatData';
import type { CharacterStats } from './FamilyData';

export type StartingPath = 'Çiftçi' | 'Akıncı' | 'Kervancı';

export interface StartingPathProfile {
  stats: CharacterStats;
  currency: number;
  items: Record<string, number>;
  weapon: WeaponType;
  armor: ArmorType;
}

/** Distinct, balanced campaign starts; saved equipment and inventory use the ordinary game systems. */
export const STARTING_PATHS: Record<StartingPath, StartingPathProfile> = {
  Çiftçi: {
    stats: { farming: 65, combat: 35, trade: 40, leadership: 40, craftsmanship: 55, diplomacy: 40 },
    currency: 30,
    items: { hoe: 1, seed_wheat: 3, seed_barley: 2 },
    weapon: WeaponType.MELEE_DAGGER,
    armor: ArmorType.NONE,
  },
  Akıncı: {
    stats: { farming: 30, combat: 70, trade: 30, leadership: 55, craftsmanship: 35, diplomacy: 40 },
    currency: 25,
    items: { seed_barley: 1 },
    weapon: WeaponType.MELEE_SPEAR,
    armor: ArmorType.LEATHER,
  },
  Kervancı: {
    stats: { farming: 35, combat: 30, trade: 70, leadership: 40, craftsmanship: 45, diplomacy: 65 },
    currency: 100,
    items: { hoe: 1, seed_wheat: 1, seed_barley: 1 },
    weapon: WeaponType.MELEE_DAGGER,
    armor: ArmorType.NONE,
  },
};
