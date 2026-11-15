export interface ScheduleEntry {
  startHour: number;
  endHour: number;
  activity: string;
  destination: string;
}

/** A small reusable clock lookup for repeating daily NPC routines. */
export class DailySchedule {
  constructor(private readonly entries: readonly ScheduleEntry[]) {}

  getEntry(hour: number): ScheduleEntry {
    const normalized = ((hour % 24) + 24) % 24;
    return this.entries.find(entry => entry.startHour <= normalized && normalized < entry.endHour)
      ?? this.entries[0]!;
  }
}
