export enum WeaponType {
  MELEE_SWORD = 'melee_sword',
  MELEE_SPEAR = 'melee_spear',
  MELEE_AXE = 'melee_axe',
  MELEE_DAGGER = 'melee_dagger',
  BOW = 'bow',
}

export enum ArmorType {
  NONE = 'none',
  LEATHER = 'leather',
  CHAINMAIL = 'chainmail',
}

export interface WeaponDefinition {
  id: WeaponType;
  name: string;
  description: string;
  damage: number;
  range: number;
  attackSpeed: number; // attacks per second
  cooldownMs: number;
  staminaCost: number;
  historicallyPlausible: boolean;
  minYear?: number;
}

export interface ArmorDefinition {
  id: ArmorType;
  name: string;
  description: string;
  defense: number;
  movementPenalty: number;
  historicallyPlausible: boolean;
}

export const WEAPON_DEFINITIONS: Record<WeaponType, WeaponDefinition> = {
  [WeaponType.MELEE_DAGGER]: {
    id: WeaponType.MELEE_DAGGER,
    name: 'Hançer (Dagger)',
    description: 'Short blade, quick and easy to handle',
    damage: 8,
    range: 1.0,
    attackSpeed: 2.0,
    cooldownMs: 500,
    staminaCost: 8,
    historicallyPlausible: true,
  },
  [WeaponType.BOW]: {
    id: WeaponType.BOW,
    name: 'Yay (Composite Bow)',
    description: 'Period-appropriate composite bow; needs a clear line of sight and careful supply.',
    damage: 7,
    range: 4.6,
    attackSpeed: 0.8,
    cooldownMs: 1250,
    staminaCost: 18,
    historicallyPlausible: true,
    minYear: 1299,
  },
  [WeaponType.MELEE_SWORD]: {
    id: WeaponType.MELEE_SWORD,
    name: 'Kılıç (Straight Sword)',
    description: 'Period-appropriate straight sword for frontier skirmishes',
    damage: 12,
    range: 1.2,
    attackSpeed: 1.2,
    cooldownMs: 833,
    staminaCost: 12,
    historicallyPlausible: true,
  },
  [WeaponType.MELEE_SPEAR]: {
    id: WeaponType.MELEE_SPEAR,
    name: 'Mızrak (Spear)',
    description: 'Reach weapon, effective in skirmishes',
    damage: 14,
    range: 1.6,
    attackSpeed: 0.9,
    cooldownMs: 1111,
    staminaCost: 14,
    historicallyPlausible: true,
  },
  [WeaponType.MELEE_AXE]: {
    id: WeaponType.MELEE_AXE,
    name: 'Baltalı Keski / Small Axe',
    description: 'Hand axe, versatile for frontier use',
    damage: 13,
    range: 1.1,
    attackSpeed: 1.0,
    cooldownMs: 1000,
    staminaCost: 13,
    historicallyPlausible: true,
  },
};

export const ARMOR_DEFINITIONS: Record<ArmorType, ArmorDefinition> = {
  [ArmorType.NONE]: {
    id: ArmorType.NONE,
    name: 'None',
    description: 'No armor',
    defense: 0,
    movementPenalty: 0,
    historicallyPlausible: true,
  },
  [ArmorType.LEATHER]: {
    id: ArmorType.LEATHER,
    name: 'Deri Zırh (Leather Armor)',
    description: 'Boiled leather, common for frontier levies',
    defense: 4,
    movementPenalty: 0.05,
    historicallyPlausible: true,
  },
  [ArmorType.CHAINMAIL]: {
    id: ArmorType.CHAINMAIL,
    name: 'Zincir Zırh (Chainmail)',
    description: 'Chainmail, heavier but offers better protection',
    defense: 8,
    movementPenalty: 0.12,
    historicallyPlausible: true,
  },
};

export const COMBAT_CONFIG = {
  maxHealth: 100,
  maxStamina: 100,
  staminaRegenRate: 10, // per second
  healthRegenRate: 0,
  baseDamage: 10,
  critChance: 0.05,
  critMultiplier: 1.5,
};
