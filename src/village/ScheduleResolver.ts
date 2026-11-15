import type {
  NpcScheduleBlock, ResolvedScheduleBlock, VillageClockState, VillageNpcState,
} from './types';

function normalizeHour(hour: number): number {
  return ((hour % 24) + 24) % 24;
}

function covers(block: NpcScheduleBlock, hour: number): boolean {
  const start = normalizeHour(block.startHour);
  const end = normalizeHour(block.endHour);
  if (start === end) return true;
  if (start < end) return hour >= start && hour < end;
  return hour >= start || hour < end;
}

function findBlock(blocks: readonly NpcScheduleBlock[] | undefined, hour: number): NpcScheduleBlock | undefined {
  return blocks?.find(block => covers(block, hour));
}

const SLEEP_BLOCK: NpcScheduleBlock = {
  startHour: 0, endHour: 24, activity: 'sleeping', destination: 'home',
};

/**
 * Deterministic schedule resolution. One hour and one set of world modifiers
 * always produce the same block, independent of frame rate or visit order.
 *
 * Priority: military emergency > bad weather > market day > ordinary routine.
 */
export function resolveSchedule(
  npc: Pick<VillageNpcState, 'schedule'>,
  clock: Pick<VillageClockState, 'hourOfDay' | 'isMarketDay' | 'weather'>,
  emergency = false,
): ResolvedScheduleBlock {
  const hour = normalizeHour(clock.hourOfDay);
  const base = findBlock(npc.schedule.base, hour) ?? SLEEP_BLOCK;

  if (emergency) {
    const override = findBlock(npc.schedule.emergency, hour);
    if (override) return { ...override, source: 'emergency' };
  }
  if (clock.weather === 'rain' || clock.weather === 'snow' || clock.weather === 'fog' || clock.weather === 'wind') {
    const override = findBlock(npc.schedule.badWeather, hour);
    if (override) return { ...override, source: 'bad_weather' };
  }
  if (clock.isMarketDay) {
    const override = findBlock(npc.schedule.marketDay, hour);
    if (override) return { ...override, source: 'market_day' };
  }
  return { ...base, source: 'base' };
}

export function scheduleBlocksForHour(
  npc: Pick<VillageNpcState, 'schedule'>,
  hour: number,
): NpcScheduleBlock[] {
  const normalized = normalizeHour(hour);
  return [
    ...npc.schedule.base,
    ...(npc.schedule.marketDay ?? []),
    ...(npc.schedule.badWeather ?? []),
    ...(npc.schedule.emergency ?? []),
  ].filter(block => covers(block, normalized));
}

export function describeSchedule(npc: Pick<VillageNpcState, 'schedule'>): string[] {
  const format = (blocks: readonly NpcScheduleBlock[]): string =>
    blocks
      .slice()
      .sort((a, b) => a.startHour - b.startHour)
      .map(block => `${String(block.startHour).padStart(2, '0')}:00 ${block.activity} (${block.destination})`)
      .join(' · ');
  return [
    `Günlük: ${format(npc.schedule.base)}`,
    ...(npc.schedule.marketDay ? [`Pazar: ${format(npc.schedule.marketDay)}`] : []),
    ...(npc.schedule.badWeather ? [`Kötü hava: ${format(npc.schedule.badWeather)}`] : []),
    ...(npc.schedule.emergency ? [`Acil durum: ${format(npc.schedule.emergency)}`] : []),
  ];
}
