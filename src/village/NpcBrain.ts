import { getOccupation } from './Occupations';
import { resolveDestination } from './VillageLocations';
import { resolveSchedule } from './ScheduleResolver';
import type {
  GridPoint, NpcActivity, NpcAnimationState, ResolvedScheduleBlock, VillageClockState,
  VillageIncident, VillageNpcState,
} from './types';

export interface NpcDecision {
  activity: NpcActivity;
  destination: GridPoint;
  destinationKey: string;
  reason: string;
  source: ResolvedScheduleBlock['source'] | 'need' | 'reaction';
  reactingTo: string | null;
}

function distance(a: GridPoint, b: GridPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function hasTag(npc: VillageNpcState, tag: ReturnType<typeof getOccupation>['tags'][number]): boolean {
  return getOccupation(npc.occupation).tags.includes(tag);
}

/**
 * AI decisions only. This module never moves a sprite, touches Phaser, or
 * mutates rendering state; it returns the same decision for the same inputs.
 */
export class NpcBrain {
  decide(
    npc: VillageNpcState,
    clock: VillageClockState,
    rosterIndex: number,
    emergency: boolean,
    incidents: readonly VillageIncident[],
  ): NpcDecision {
    const reaction = this.reactionDecision(npc, clock, rosterIndex, incidents, emergency);
    if (reaction) return reaction;

    const resolved = resolveSchedule(npc, clock, emergency);
    const isNight = clock.phase === 'night';
    const busy = resolved.activity !== 'sleeping';

    // Urgent needs interrupt an ordinary routine but never a military alarm.
    if (!emergency && busy) {
      if (npc.needs.food < 22) {
        return this.fromNeed(npc, 'eating', 'home', rosterIndex, 'açlık');
      }
      if (npc.needs.rest < 14 && isNight) {
        return this.fromNeed(npc, 'sleeping', 'home', rosterIndex, 'yorgunluk');
      }
      if (npc.needs.safety < 18) {
        return this.fromNeed(npc, 'fleeing', 'home', rosterIndex, 'güvenlik ihtiyacı');
      }
      if (npc.needs.social < 12 && clock.phase === 'evening') {
        return this.fromNeed(npc, 'socializing', 'lodge', rosterIndex, 'sosyalleşme');
      }
    }

    const destination = resolveDestination(npc, resolved.destination, rosterIndex);
    return {
      activity: resolved.activity,
      destination,
      destinationKey: resolved.destination,
      reason: `Çizelge · ${this.sourceLabel(resolved.source)}`,
      source: resolved.source,
      reactingTo: null,
    };
  }

  private fromNeed(
    npc: VillageNpcState, activity: NpcActivity, key: string, rosterIndex: number, label: string,
  ): NpcDecision {
    return {
      activity,
      destination: resolveDestination(npc, key, rosterIndex),
      destinationKey: key,
      reason: `İhtiyaç · ${label}`,
      source: 'need',
      reactingTo: null,
    };
  }

  private reactionDecision(
    npc: VillageNpcState,
    clock: VillageClockState,
    rosterIndex: number,
    incidents: readonly VillageIncident[],
    emergency: boolean,
  ): NpcDecision | null {
    if (npc.activity === 'sleeping' && !hasTag(npc, 'security')) return null;
    const guard = hasTag(npc, 'security');
    const reactionRadius = guard ? 18 : 10;
    void reactionRadius;
    let best: VillageIncident | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const incident of incidents) {
      if (incident.status !== 'active') continue;
      if (incident.startHour > clock.absoluteHour || incident.expiresHour <= clock.absoluteHour) continue;
      const d = distance(npc.position, incident.position);
      const radius = guard ? 18 : incident.type === 'stranger' ? 4.5 : reactionRadius;
      if (d > radius || d >= bestDistance) continue;
      best = incident;
      bestDistance = d;
    }
    if (!best) return null;

    const incident = best;
    const courage = npc.personality.courage;
    let activity: NpcActivity = 'investigating';
    let reason = `${this.incidentLabel(incident.type)} tepkisi`;
    if (!guard && incident.type === 'fire' && courage < 62) {
      activity = 'fleeing';
      reason = 'yangından kaçış';
    } else if (!guard && incident.type === 'combat' && courage < 76) {
      activity = 'fleeing';
      reason = 'çatışmadan kaçış';
    } else if (!guard && incident.type === 'theft' && courage < 58) {
      activity = 'fleeing';
      reason = 'hırsızlık korkusu';
    } else if (!guard && incident.type === 'stranger' && courage < 55) {
      activity = 'idle';
      reason = 'yabancıya temkin';
    }

    void rosterIndex;
    void emergency;
    const destination = activity === 'fleeing'
      ? { ...npc.home }
      : activity === 'investigating'
        ? { ...incident.position }
        : resolveDestination(npc, 'well', 0);
    return {
      activity,
      destination,
      destinationKey: activity === 'fleeing' ? 'home' : activity === 'investigating' ? 'incident' : 'well',
      reason,
      source: 'reaction',
      reactingTo: incident.id,
    };
  }

  private sourceLabel(source: ResolvedScheduleBlock['source']): string {
    switch (source) {
      case 'market_day': return 'pazar günü';
      case 'bad_weather': return 'kötü hava';
      case 'emergency': return 'askerî alarm';
      case 'base':
      default: return 'günlük rutin';
    }
  }

  private incidentLabel(type: VillageIncident['type']): string {
    switch (type) {
      case 'fire': return 'yangın';
      case 'theft': return 'hırsızlık';
      case 'combat': return 'çatışma';
      case 'stranger':
      default: return 'yabancı';
    }
  }
}

export function animationFor(
  activity: NpcActivity,
  moving: boolean,
  atDestination: boolean,
): NpcAnimationState {
  if (moving) return 'walking';
  if (activity === 'sleeping') return 'sleeping';
  if (activity === 'working' || activity === 'fetching_water' || activity === 'patrolling' || activity === 'mustering') {
    return 'working';
  }
  if ((activity === 'socializing' || activity === 'eating') && atDestination) return 'talking';
  return 'idle';
}
