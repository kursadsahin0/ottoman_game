import { getOccupation } from './Occupations';
import type { GridPoint, VillageNpcState } from './types';

/** Named standing spots around the existing painted buildings. */
export const VILLAGE_LOCATIONS: Record<string, readonly GridPoint[]> = {
  market: [
    { x: 18, y: 16 }, { x: 19, y: 16 }, { x: 17, y: 16 },
    { x: 18, y: 15 }, { x: 19, y: 15 }, { x: 17, y: 15 },
  ],
  well: [{ x: 13, y: 18 }, { x: 12, y: 17 }, { x: 11, y: 18 }, { x: 13, y: 17 }],
  fields: [{ x: 10, y: 13 }, { x: 11, y: 12 }, { x: 12, y: 14 }, { x: 10, y: 14 }],
  workshop: [{ x: 5, y: 17 }, { x: 5, y: 16 }, { x: 4, y: 18 }],
  lodge: [{ x: 10, y: 21 }, { x: 9, y: 22 }, { x: 8, y: 22 }],
  granary: [{ x: 22, y: 22 }, { x: 21, y: 22 }, { x: 24, y: 24 }],
  pasture: [{ x: 7, y: 19 }, { x: 6, y: 18 }, { x: 8, y: 19 }, { x: 7, y: 20 }],
  patrol_north: [{ x: 28, y: 14 }, { x: 27, y: 13 }, { x: 28, y: 15 }, { x: 26, y: 15 }],
  patrol_south: [{ x: 24, y: 18 }, { x: 25, y: 17 }, { x: 26, y: 18 }, { x: 24, y: 19 }],
  patrol_market: [{ x: 18, y: 15 }, { x: 19, y: 16 }, { x: 17, y: 16 }, { x: 18, y: 17 }],
  gate: [{ x: 30, y: 16 }, { x: 30, y: 15 }, { x: 29, y: 16 }, { x: 30, y: 17 }],
  alarm_post: [{ x: 18, y: 15 }, { x: 13, y: 17 }, { x: 10, y: 21 }],
  home: [],
  work: [],
};

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * Resolves semantic schedule destinations without asking the renderer or the
 * AI layer to know map coordinates. Identical input always returns one spot.
 */
export function resolveDestination(
  npc: VillageNpcState,
  destination: string,
  rosterIndex: number,
): GridPoint {
  if (destination === 'home') return { ...npc.home };
  if (destination === 'work') {
    if (npc.workplace) return { ...npc.workplace };
    const fallback = getOccupation(npc.occupation).defaultDestination;
    if (fallback !== 'work') return resolveDestination(npc, fallback, rosterIndex);
    return { ...npc.home };
  }
  const spots = VILLAGE_LOCATIONS[destination];
  if (!spots || spots.length === 0) return { ...npc.home };
  // Market slots are spread by roster so merchants and shoppers do not stack.
  const index = destination === 'market'
    ? rosterIndex % spots.length
    : stableHash(`${npc.id}:${destination}`) % spots.length;
  return { ...spots[index]! };
}
