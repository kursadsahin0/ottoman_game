export enum CropType {
  WHEAT = 'wheat',
  BARLEY = 'barley',
  OATS = 'oats',
}

export enum FarmPlotState {
  UNTROUCHED = 0,
  PREPARED = 1,
  SEEDED = 2,
  GROWING = 3,
  READY_TO_HARVEST = 4,
  HARVESTED = 5,
}

export interface CropDefinition {
  id: CropType;
  name: string;
  description: string;
  growthDays: number;
  seedItemId: string;
  harvestItemId: string;
  harvestYield: number;
  seedCost: number;
  sellPrice: number;
  suitableSeasons: string[];
  waterNeed: number;
}

export const CROP_DEFINITIONS: Record<CropType, CropDefinition> = {
  [CropType.WHEAT]: {
    id: CropType.WHEAT,
    name: 'Wheat',
    description: 'Staple grain of Anatolia, main source of bread',
    growthDays: 4,
    seedItemId: 'seed_wheat',
    harvestItemId: 'wheat',
    harvestYield: 3,
    seedCost: 3,
    sellPrice: 8,
    suitableSeasons: ['spring', 'autumn'],
    waterNeed: 48,
  },
  [CropType.BARLEY]: {
    id: CropType.BARLEY,
    name: 'Barley',
    description: 'Hardy grain, grows well in drier conditions',
    growthDays: 3,
    seedItemId: 'seed_barley',
    harvestItemId: 'barley',
    harvestYield: 3,
    seedCost: 2,
    sellPrice: 6,
    suitableSeasons: ['spring', 'autumn'],
    waterNeed: 35,
  },
  [CropType.OATS]: {
    id: CropType.OATS,
    name: 'Oats',
    description: 'Hardy fodder and grain crop suited to cooler Anatolian seasons',
    growthDays: 5,
    seedItemId: 'seed_oats',
    harvestItemId: 'oats',
    harvestYield: 3,
    seedCost: 3,
    sellPrice: 7,
    suitableSeasons: ['spring', 'autumn'],
    waterNeed: 42,
  },
};

/**
 * A single tilled plot of land. Pure data: no rendering concerns.
 */
export interface FarmPlotData {
  id: string;
  gridX: number;
  gridY: number;
  state: FarmPlotState;
  cropType?: CropType;
  plantedDay?: number;
  growthProgress: number;
  /** Land tenure: locked plots must be purchased before use. */
  unlocked: boolean;
  /** Region where this plot is worked; omitted in legacy saves means the starting village. */
  locationId?: string;
  propertyId?: string;
  /** Soil and crop condition are stored per plot and do not require per-frame simulation. */
  soilQuality?: number;
  moisture?: number;
  cropQuality?: number;
  npcLastWorkHour?: number;
}
