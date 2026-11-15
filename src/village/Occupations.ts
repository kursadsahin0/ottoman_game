import type { OccupationDefinition, OccupationId } from './types';

/**
 * Occupation definitions deliberately contain only data and a few behaviour
 * tags. The village brain reads those tags; adding a job never requires a new
 * update loop or a Phaser import.
 */
export const OCCUPATIONS: Record<OccupationId, OccupationDefinition> = {
  farmer: {
    id: 'farmer', label: 'çiftçi', workActivity: 'working', walkSpeed: 2.5,
    tags: ['outdoor', 'food'], defaultDestination: 'fields',
  },
  blacksmith: {
    id: 'blacksmith', label: 'demirci', workActivity: 'working', walkSpeed: 2.6,
    tags: ['craft', 'outdoor'], defaultDestination: 'workshop',
  },
  merchant: {
    id: 'merchant', label: 'tüccar', workActivity: 'market', walkSpeed: 2.7,
    tags: ['trade', 'outdoor'], defaultDestination: 'market',
  },
  guard: {
    id: 'guard', label: 'bekçi', workActivity: 'patrolling', walkSpeed: 3.0,
    tags: ['security', 'outdoor'], defaultDestination: 'patrol_north',
  },
  weaver: {
    id: 'weaver', label: 'dokumacı', workActivity: 'working', walkSpeed: 2.3,
    tags: ['craft', 'household'], defaultDestination: 'workshop',
  },
  miller: {
    id: 'miller', label: 'değirmenci', workActivity: 'working', walkSpeed: 2.5,
    tags: ['food', 'craft'], defaultDestination: 'granary',
  },
  baker: {
    id: 'baker', label: 'fırıncı', workActivity: 'working', walkSpeed: 2.5,
    tags: ['food', 'craft', 'outdoor'], defaultDestination: 'market',
  },
  imam: {
    id: 'imam', label: 'imam', workActivity: 'working', walkSpeed: 2.3,
    tags: ['faith', 'civic'], defaultDestination: 'lodge',
  },
  scribe: {
    id: 'scribe', label: 'kâtip', workActivity: 'working', walkSpeed: 2.4,
    tags: ['civic'], defaultDestination: 'lodge',
  },
  herder: {
    id: 'herder', label: 'çoban', workActivity: 'working', walkSpeed: 2.5,
    tags: ['outdoor', 'food'], defaultDestination: 'pasture',
  },
  potter: {
    id: 'potter', label: 'çömlekçi', workActivity: 'working', walkSpeed: 2.4,
    tags: ['craft', 'outdoor'], defaultDestination: 'workshop',
  },
  carpenter: {
    id: 'carpenter', label: 'marangoz', workActivity: 'working', walkSpeed: 2.5,
    tags: ['craft'], defaultDestination: 'workshop',
  },
  healer: {
    id: 'healer', label: 'şifacı', workActivity: 'working', walkSpeed: 2.3,
    tags: ['household', 'civic'], defaultDestination: 'home',
  },
  official: {
    id: 'official', label: 'köy görevlisi', workActivity: 'working', walkSpeed: 2.5,
    tags: ['civic', 'household'], defaultDestination: 'lodge',
  },
  groom: {
    id: 'groom', label: 'seyis', workActivity: 'working', walkSpeed: 2.7,
    tags: ['outdoor', 'craft'], defaultDestination: 'pasture',
  },
  water_carrier: {
    id: 'water_carrier', label: 'su taşıyıcı', workActivity: 'fetching_water', walkSpeed: 2.4,
    tags: ['household', 'outdoor'], defaultDestination: 'well',
  },
  villager: {
    id: 'villager', label: 'köy sakini', workActivity: 'idle', walkSpeed: 2.4,
    tags: ['household'], defaultDestination: 'home',
  },
};

export function getOccupation(id: OccupationId): OccupationDefinition {
  return OCCUPATIONS[id] ?? OCCUPATIONS.villager;
}

export function isOccupationId(value: unknown): value is OccupationId {
  return typeof value === 'string' && value in OCCUPATIONS;
}
