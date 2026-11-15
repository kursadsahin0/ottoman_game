import type { GameTime } from '@systems/TimeManager';
import { Season } from '@systems/TimeManager';
import type { VillageClockState, VillagePhase, VillageWeather } from './types';

export interface VillageClockUpdate {
  hourChanged: boolean;
  dayChanged: boolean;
  phaseChanged: boolean;
  marketDayChanged: boolean;
  weatherChanged: boolean;
}

const NO_CHANGE: VillageClockUpdate = {
  hourChanged: false, dayChanged: false, phaseChanged: false,
  marketDayChanged: false, weatherChanged: false,
};

export function phaseForHour(hour: number): VillagePhase {
  const normalized = ((hour % 24) + 24) % 24;
  if (normalized >= 5 && normalized < 12) return 'morning';
  if (normalized >= 12 && normalized < 17) return 'afternoon';
  if (normalized >= 17 && normalized < 21) return 'evening';
  return 'night';
}

/** Market days are deterministic: every fifth calendar day, starting with day one. */
export function isMarketDayFor(day: number): boolean {
  const normalized = Math.max(0, Math.floor(day));
  return normalized % 5 === 0;
}

function hash(seed: number): number {
  let value = seed | 0;
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  return (value ^ (value >>> 16)) >>> 0;
}

/** Same deterministic weather table the settlement has always used. */
export function weatherFor(time: GameTime): VillageWeather {
  const roll = hash(time.year * 1000 + time.day + time.month * 31) % 100;
  const thresholds: Record<Season, readonly [number, number, number, number, number]> = {
    [Season.SPRING]: [43, 65, 86, 94, 98],
    [Season.SUMMER]: [62, 82, 96, 97, 99],
    [Season.AUTUMN]: [32, 56, 78, 91, 97],
    [Season.WINTER]: [28, 48, 66, 78, 91],
  };
  const [clear, cloudy, rain, fog, wind] = thresholds[time.season];
  if (roll < clear) return 'clear';
  if (roll < cloudy) return 'cloudy';
  if (roll < rain) return 'rain';
  if (roll < fog) return 'fog';
  if (roll < wind) return 'wind';
  return time.season === Season.WINTER ? 'snow' : 'rain';
}

const WEATHER_TRANSITION_HOURS = 6;

/**
 * Central clock for every villager. There is one instance per village and it
 * is advanced from the authoritative TimeManager, never from per-NPC timers.
 */
export class VillageClock {
  private state: VillageClockState;

  constructor(time: GameTime) {
    const absoluteHour = Math.max(0, time.totalDays) * 24;
    this.state = {
      absoluteHour,
      day: Math.floor(time.totalDays),
      hourOfDay: ((time.totalDays % 1) + 1) % 1 * 24,
      phase: phaseForHour(absoluteHour % 24),
      isMarketDay: isMarketDayFor(Math.floor(time.totalDays)),
      weather: weatherFor(time),
      weatherTarget: weatherFor(time),
      weatherFrom: weatherFor(time),
      weatherTransitionStartHour: absoluteHour,
      weatherDay: Math.floor(time.totalDays),
      emergencyUntilHour: 0,
    };
  }

  getState(): VillageClockState {
    return { ...this.state, weather: this.weather };
  }

  get hourOfDay(): number { return this.state.hourOfDay; }
  get day(): number { return this.state.day; }
  get absoluteHour(): number { return this.state.absoluteHour; }
  get phase(): VillagePhase { return this.state.phase; }
  get isMarketDay(): boolean { return this.state.isMarketDay; }
  get weather(): VillageWeather {
    const target = this.state.weatherTarget ?? this.state.weather;
    const from = this.state.weatherFrom ?? this.state.weather;
    const start = this.state.weatherTransitionStartHour ?? this.state.absoluteHour;
    return Math.max(0, this.state.absoluteHour - start) >= WEATHER_TRANSITION_HOURS / 2 ? target : from;
  }
  get weatherBlend(): number {
    const start = this.state.weatherTransitionStartHour ?? this.state.absoluteHour;
    return Math.max(0, Math.min(1, (this.state.absoluteHour - start) / WEATHER_TRANSITION_HOURS));
  }
  getWeatherIntensity(weather: VillageWeather): number {
    const from = this.state.weatherFrom ?? this.state.weather;
    const target = this.state.weatherTarget ?? this.state.weather;
    const blend = this.weatherBlend;
    if (from === target) return weather === target ? 1 : 0;
    if (weather === from) return 1 - blend;
    if (weather === target) return blend;
    return 0;
  }
  get emergencyUntilHour(): number { return this.state.emergencyUntilHour; }

  isEmergency(): boolean {
    return this.state.absoluteHour < this.state.emergencyUntilHour;
  }

  /** Advances to the authoritative game time, returning only real changes. */
  sync(time: GameTime): VillageClockUpdate {
    const absoluteHour = Math.max(0, time.totalDays) * 24;
    const day = Math.floor(time.totalDays);
    const hourOfDay = ((time.totalDays % 1) + 1) % 1 * 24;
    const hour = Math.floor(hourOfDay);
    const previousHour = Math.floor(this.state.hourOfDay);
    const previousDay = this.state.day;
    const previousPhase = this.state.phase;
    const previousMarketDay = this.state.isMarketDay;
    const previousWeather = this.weather;

    const dayChanged = day !== previousDay;
    this.state.absoluteHour = absoluteHour;
    this.state.day = day;
    this.state.hourOfDay = hourOfDay;
    this.state.phase = phaseForHour(hour);
    this.state.isMarketDay = isMarketDayFor(day);
    if (dayChanged || this.state.weatherDay !== day) {
      this.state.weatherFrom = this.weather;
      this.state.weatherTarget = weatherFor(time);
      this.state.weatherTransitionStartHour = absoluteHour;
      this.state.weather = this.state.weatherFrom;
      this.state.weatherDay = day;
    }
    const hourChanged = hour !== previousHour || dayChanged;
    if (!hourChanged && day === previousDay && this.state.phase === previousPhase
      && this.state.isMarketDay === previousMarketDay && this.weather === previousWeather) {
      return NO_CHANGE;
    }
    return {
      hourChanged,
      dayChanged,
      phaseChanged: this.state.phase !== previousPhase,
      marketDayChanged: this.state.isMarketDay !== previousMarketDay,
      weatherChanged: this.weather !== previousWeather,
    };
  }

  /** Forces a weather result; used by tests and by scripted scenes. */
  setWeather(weather: VillageWeather): void {
    this.state.weather = weather;
    this.state.weatherFrom = weather;
    this.state.weatherTarget = weather;
    this.state.weatherTransitionStartHour = this.state.absoluteHour;
  }

  setEmergencyUntil(absoluteHour: number): void {
    if (Number.isFinite(absoluteHour)) {
      this.state.emergencyUntilHour = Math.max(this.state.absoluteHour, absoluteHour);
    }
  }

  load(state: Partial<VillageClockState> | undefined): void {
    if (!state || typeof state !== 'object') return;
    if (typeof state.absoluteHour === 'number' && Number.isFinite(state.absoluteHour)) {
      this.state.absoluteHour = Math.max(0, state.absoluteHour);
    }
    if (typeof state.day === 'number' && Number.isFinite(state.day)) {
      this.state.day = Math.max(0, Math.floor(state.day));
    }
    if (typeof state.hourOfDay === 'number' && Number.isFinite(state.hourOfDay)) {
      this.state.hourOfDay = ((state.hourOfDay % 24) + 24) % 24;
    }
    if (['morning', 'afternoon', 'evening', 'night'].includes(String(state.phase))) {
      this.state.phase = state.phase as VillagePhase;
    } else {
      this.state.phase = phaseForHour(this.state.hourOfDay);
    }
    if (typeof state.isMarketDay === 'boolean') this.state.isMarketDay = state.isMarketDay;
    if (['clear', 'cloudy', 'rain', 'fog', 'wind', 'snow'].includes(String(state.weather))) {
      this.state.weather = state.weather as VillageWeather;
    }
    if (state.weatherTarget && ['clear', 'cloudy', 'rain', 'fog', 'wind', 'snow'].includes(state.weatherTarget)) this.state.weatherTarget = state.weatherTarget;
    if (state.weatherFrom && ['clear', 'cloudy', 'rain', 'fog', 'wind', 'snow'].includes(state.weatherFrom)) this.state.weatherFrom = state.weatherFrom;
    if (typeof state.weatherTransitionStartHour === 'number' && Number.isFinite(state.weatherTransitionStartHour)) this.state.weatherTransitionStartHour = state.weatherTransitionStartHour;
    if (typeof state.weatherDay === 'number' && Number.isFinite(state.weatherDay)) {
      this.state.weatherDay = Math.floor(state.weatherDay);
    }
    if (typeof state.emergencyUntilHour === 'number' && Number.isFinite(state.emergencyUntilHour)) {
      this.state.emergencyUntilHour = Math.max(0, state.emergencyUntilHour);
    }
  }
}
