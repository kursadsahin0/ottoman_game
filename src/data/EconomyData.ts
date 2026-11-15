export interface ItemDefinition {
  id: string;
  name: string;
  description: string;
  stackable: boolean;
  maxStack: number;
  category: 'seed' | 'crop' | 'tool' | 'other';
  baseValue: number; // In akçe
}

export const ITEM_DEFINITIONS: Record<string, ItemDefinition> = {
  seed_wheat: {
    id: 'seed_wheat',
    name: 'Wheat Seeds',
    description: 'Seeds for planting wheat',
    stackable: true,
    maxStack: 99,
    category: 'seed',
    baseValue: 3,
  },
  seed_barley: {
    id: 'seed_barley',
    name: 'Barley Seeds',
    description: 'Seeds for planting barley',
    stackable: true,
    maxStack: 99,
    category: 'seed',
    baseValue: 2,
  },
  seed_oats: {
    id: 'seed_oats', name: 'Yulaf Tohumları', description: 'Tohumluk yulaf; tahıl ve hayvan yemi',
    stackable: true, maxStack: 99, category: 'seed', baseValue: 3,
  },
  wheat: {
    id: 'wheat',
    name: 'Wheat',
    description: 'Harvested wheat grain',
    stackable: true,
    maxStack: 99,
    category: 'crop',
    baseValue: 8,
  },
  barley: {
    id: 'barley',
    name: 'Barley',
    description: 'Harvested barley grain',
    stackable: true,
    maxStack: 99,
    category: 'crop',
    baseValue: 6,
  },
  oats: {
    id: 'oats', name: 'Yulaf', description: 'Hasat edilmiş yulaf tanesi',
    stackable: true, maxStack: 99, category: 'crop', baseValue: 7,
  },
  hoe: {
    id: 'hoe',
    name: 'Hoe',
    description: 'Iron-bladed wooden hoe for tilling soil',
    stackable: false,
    maxStack: 1,
    category: 'tool',
    baseValue: 15,
  },
  arrows: {
    id: 'arrows',
    name: 'Oklar',
    description: 'Bundle of arrows for a historically appropriate bow',
    stackable: true,
    maxStack: 99,
    category: 'other',
    baseValue: 2,
  },
};

export interface MarketConfig {
  /** Share of an item's value the market pays when buying from the player. */
  buyMultiplier: number;
  /** Share of an item's value the market charges when selling to the player. */
  sellMultiplier: number;
  stockRefreshDays: number;
}

export const MARKET_CONFIG: MarketConfig = {
  buyMultiplier: 0.7,
  sellMultiplier: 1.2,
  stockRefreshDays: 7,
};

/** Starting stock the local market can sell to the player. */
export const MARKET_STOCK_CONFIG: Record<string, number> = {
  seed_wheat: 12,
  seed_barley: 12,
  seed_oats: 8,
  hoe: 3,
  arrows: 24,
  wheat: 10,
  barley: 8,
  oats: 6,
};

/** Local merchant capacity and caravan restock limits, in akçe and units. */
export const MARKET_CAPITAL_CONFIG = { starting: 180, maximum: 300, weeklyCaravanCapital: 60, unitsPerItem: 2 } as const;

/** Economy rules that have no home inside the item table. */
export const FARM_ECONOMY_CONFIG = {
  /** Cost in akçe to obtain tenure of one additional plot. */
  landCost: 20,
  startingCurrency: 50,
  startingSeeds: {
    seed_wheat: 1,
    seed_barley: 1,
    seed_oats: 0,
  },
};
