export enum Season {
  SPRING = 'spring',
  SUMMER = 'summer',
  AUTUMN = 'autumn',
  WINTER = 'winter',
}

export interface GameTime {
  day: number; // 1-30
  month: number; // 1-12
  year: number;
  season: Season;
  totalDays: number; // Total days elapsed since the start of the game
}

export interface CalendarConfig {
  daysPerMonth: number;
  monthsPerYear: number;
  /** Month numbers, one-based, for the start of each season. */
  seasonStarts: { spring: number; summer: number; autumn: number; winter: number };
}

export const DEFAULT_CALENDAR: Readonly<CalendarConfig> = Object.freeze({
  daysPerMonth: 30, monthsPerYear: 12,
  seasonStarts: { spring: 3, summer: 6, autumn: 9, winter: 12 },
});

/** Real milliseconds that elapse per in-game day at 1x speed. */
export const DAY_LENGTH_MS = 30_000;

/** Online simulation only advances while the scene is running. */
export const OFFLINE_RULES = {
  /** Offline catch-up only applies when an existing save is loaded. */
  appliesOnLoadOnly: true,
  /** Hard cap so returning after months does not skip generations of content. */
  maxOfflineDays: 7,
  /** Days are intentionally not simulated while the app is closed otherwise. */
  requiresSaveTimestamp: true,
};

export class TimeManager {
  private static instance: TimeManager | null = null;
  private time: GameTime;
  private paused = true;
  private timeScale = 1;
  private lastUpdateTime = 0;
  private dayLength = DAY_LENGTH_MS;
  private calendar: CalendarConfig = { ...DEFAULT_CALENDAR, seasonStarts: { ...DEFAULT_CALENDAR.seasonStarts } };

  private constructor() {
    this.time = {
      day: 1,
      month: 3,
      year: 1299,
      season: Season.SPRING,
      totalDays: 0,
    };
  }

  public static getInstance(): TimeManager {
    if (!TimeManager.instance) {
      TimeManager.instance = new TimeManager();
    }
    return TimeManager.instance;
  }

  public getTime(): GameTime {
    return { ...this.time };
  }

  /** Hour-of-day from the fractional calendar day, in [0, 24). */
  public getHourOfDay(): number {
    const fraction = ((this.time.totalDays % 1) + 1) % 1;
    return fraction * 24;
  }

  public setDayLengthMs(milliseconds: number): void {
    if (Number.isFinite(milliseconds) && milliseconds >= 5_000) this.dayLength = milliseconds;
  }

  /** Configure the fictional simulation calendar without changing historical source dates. */
  public setCalendarConfig(config: Partial<CalendarConfig>): void {
    const daysPerMonth = config.daysPerMonth ?? this.calendar.daysPerMonth;
    const monthsPerYear = config.monthsPerYear ?? this.calendar.monthsPerYear;
    if (!Number.isInteger(daysPerMonth) || daysPerMonth < 1 || daysPerMonth > 60
      || !Number.isInteger(monthsPerYear) || monthsPerYear < 4 || monthsPerYear > 24) return;
    const starts = config.seasonStarts ?? this.calendar.seasonStarts;
    if (!starts || Object.values(starts).some(month => !Number.isInteger(month) || month < 1 || month > monthsPerYear!)) return;
    this.calendar = { daysPerMonth, monthsPerYear, seasonStarts: { ...starts } };
    this.updateSeason();
  }

  public getCalendarConfig(): CalendarConfig { return { ...this.calendar, seasonStarts: { ...this.calendar.seasonStarts } }; }

  /** Advances simulation from real elapsed time. Safe to call every frame. */
  public update(now: number = Date.now()): void {
    if (this.paused) {
      this.lastUpdateTime = now;
      return;
    }

    const delta = now - this.lastUpdateTime;
    this.lastUpdateTime = now;

    if (delta <= 0) return;

    const daysToAdvance = (delta / this.dayLength) * this.timeScale;
    this.accumulateDays(daysToAdvance);
  }

  /**
   * Adds fractional days, carrying whole days into the calendar.
   * Fractional remainders are kept in `totalDays` so crop progress is smooth.
   */
  private accumulateDays(days: number): void {
    const previousWholeDays = Math.floor(this.time.totalDays);
    this.time.totalDays += days;
    const wholeDaysGained = Math.floor(this.time.totalDays) - previousWholeDays;

    for (let i = 0; i < wholeDaysGained; i++) {
      this.advanceOneDay();
    }
  }

  public advanceDay(): void {
    this.time.totalDays = Math.floor(this.time.totalDays) + 1;
    this.advanceOneDay();
  }

  public advanceDays(days: number): void {
    for (let i = 0; i < days; i++) {
      this.advanceDay();
    }
  }

  private advanceOneDay(): void {
    this.time.day++;
    if (this.time.day > this.calendar.daysPerMonth) {
      this.time.day = 1;
      this.time.month++;
      if (this.time.month > this.calendar.monthsPerYear) {
        this.time.month = 1;
        this.time.year++;
      }
      this.updateSeason();
    }
  }

  private updateSeason(): void {
    const { spring, summer, autumn, winter } = this.calendar.seasonStarts;
    const m = this.time.month;
    const ranges = [
      { season: Season.SPRING, start: spring, end: summer },
      { season: Season.SUMMER, start: summer, end: autumn },
      { season: Season.AUTUMN, start: autumn, end: winter },
    ];
    this.time.season = ranges.find(r => r.start <= r.end ? m >= r.start && m < r.end : m >= r.start || m < r.end)?.season ?? Season.WINTER;
  }

  public pause(): void {
    this.paused = true;
  }

  public resume(now: number = Date.now()): void {
    this.paused = false;
    this.lastUpdateTime = now;
  }

  public isPaused(): boolean {
    return this.paused;
  }

  public setTimeScale(scale: number): void {
    this.timeScale = Math.max(0, scale);
  }

  public getTimeScale(): number {
    return this.timeScale;
  }

  public getDayLengthMs(): number {
    return this.dayLength;
  }

  public getSeasonName(): string {
    const seasonNames: Record<Season, string> = {
      [Season.SPRING]: 'İlkbahar (Spring)',
      [Season.SUMMER]: 'Yaz (Summer)',
      [Season.AUTUMN]: 'Sonbahar (Autumn)',
      [Season.WINTER]: 'Kış (Winter)',
    };
    return seasonNames[this.time.season];
  }

  public getDateString(): string {
    return `${this.time.day}/${this.time.month}/${this.time.year} · ${this.getSeasonName()}`;
  }

  public setTime(time: GameTime): void {
    this.time = { ...time };
    this.updateSeason();
    this.lastUpdateTime = Date.now();
  }

  /**
   * Number of in-game days that have passed since a save timestamp.
   * Explicitly capped by OFFLINE_RULES.maxOfflineDays.
   */
  public calculateOfflineDays(lastSaveTimestamp: number): number {
    const offlineMs = Math.max(0, Date.now() - lastSaveTimestamp);
    const rawDays = offlineMs / this.dayLength;
    return Math.min(Math.floor(rawDays), OFFLINE_RULES.maxOfflineDays);
  }
}
