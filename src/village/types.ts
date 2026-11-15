/** Shared, rendering-free types for the living village simulation. */

export type VillagePhase = 'morning' | 'afternoon' | 'evening' | 'night';

export type VillageWeather = 'clear' | 'cloudy' | 'rain' | 'fog' | 'wind' | 'snow';

export type NpcAnimationState = 'idle' | 'walking' | 'working' | 'talking' | 'sleeping';

export type NpcActivity =
  | 'sleeping'
  | 'eating'
  | 'working'
  | 'market'
  | 'socializing'
  | 'patrolling'
  | 'fetching_water'
  | 'idle'
  | 'fleeing'
  | 'investigating'
  | 'mustering';

export type OccupationId =
  | 'farmer'
  | 'blacksmith'
  | 'merchant'
  | 'guard'
  | 'weaver'
  | 'miller'
  | 'baker'
  | 'imam'
  | 'scribe'
  | 'herder'
  | 'potter'
  | 'carpenter'
  | 'healer'
  | 'official'
  | 'groom'
  | 'water_carrier'
  | 'villager';

export type OccupationTag =
  | 'outdoor'
  | 'craft'
  | 'trade'
  | 'security'
  | 'faith'
  | 'civic'
  | 'food'
  | 'household';

export interface OccupationDefinition {
  readonly id: OccupationId;
  readonly label: string;
  readonly workActivity: NpcActivity;
  /** Grid tiles per second while walking. */
  readonly walkSpeed: number;
  readonly tags: readonly OccupationTag[];
  /** Overrides a destination key when an NPC has no explicit workplace. */
  readonly defaultDestination: string;
}

export interface GridPoint {
  x: number;
  y: number;
}

export type VillagePersonality = {
  ambition: number;
  courage: number;
  patience: number;
  generosity: number;
  caution: number;
  loyalty: number;
  negotiation: number;
  sociability: number;
};

/** Persisted, slow-changing traits. Skills are intentionally small integers. */
export interface NpcAttributes {
  strength: number;
  agility: number;
  wit: number;
  endurance: number;
  craft: number;
  faith: number;
}

export interface NpcNeeds {
  rest: number;
  food: number;
  safety: number;
  social: number;
}

export type NpcMemoryKind =
  | 'conversation'
  | 'gift'
  | 'help'
  | 'conflict'
  | 'incident'
  | 'military'
  | 'stranger'
  | 'occupation';

export interface NpcMemoryEntry {
  id: string;
  kind: NpcMemoryKind;
  day: number;
  hour: number;
  summary: string;
  /** -10..10: how strongly the memory still colours trust. */
  weight: number;
}

export interface NpcScheduleBlock {
  startHour: number;
  endHour: number;
  activity: NpcActivity;
  destination: string;
}

export interface NpcSchedule {
  base: NpcScheduleBlock[];
  marketDay?: NpcScheduleBlock[];
  badWeather?: NpcScheduleBlock[];
  emergency?: NpcScheduleBlock[];
}

export interface ResolvedScheduleBlock {
  activity: NpcActivity;
  destination: string;
  source: 'base' | 'market_day' | 'bad_weather' | 'emergency';
  startHour: number;
  endHour: number;
}

export interface VillageNpcDefinition {
  id: string;
  name: string;
  occupation: OccupationId;
  gender: 'male' | 'female';
  appearance: 'Çiftçi' | 'Akıncı' | 'Kervancı';
  home: GridPoint;
  workplace: GridPoint | null;
  motivation: string;
  personality: VillagePersonality;
  attributes: NpcAttributes;
  relationships: Record<string, number>;
  schedule: NpcSchedule;
}

export type VillageIncidentType = 'fire' | 'theft' | 'combat' | 'stranger';

export interface VillageIncident {
  id: string;
  type: VillageIncidentType;
  position: GridPoint;
  severity: number;
  startHour: number;
  expiresHour: number;
  status: 'active' | 'resolved';
  responders: string[];
  /** Deterministic short description used by debug and memory. */
  description: string;
}

export interface NpcPathState {
  path: GridPoint[];
  index: number;
  target: GridPoint | null;
  requestedAtHour: number;
  /** Number of consecutive failed path/stuck recoveries. */
  failures: number;
}

export interface VillageNpcState {
  id: string;
  name: string;
  occupation: OccupationId;
  gender: 'male' | 'female';
  appearance: 'Çiftçi' | 'Akıncı' | 'Kervancı';
  home: GridPoint;
  workplace: GridPoint | null;
  position: GridPoint;
  destination: GridPoint;
  activity: NpcActivity;
  animation: NpcAnimationState;
  phase: VillagePhase;
  motivation: string;
  needs: NpcNeeds;
  personality: VillagePersonality;
  attributes: NpcAttributes;
  relationships: Record<string, number>;
  playerTrust: number;
  conversations: number;
  memories: NpcMemoryEntry[];
  occupationHistory: Array<{ occupation: OccupationId; day: number }>;
  schedule: NpcSchedule;
  decisionReason: string;
  /** Active reaction incident, if any. */
  reactingTo: string | null;
  /** Absolute game hour when a temporary reaction ends. */
  reactionUntilHour: number;
  lastInteractionDay: number;
  lastStrangerHour: number;
  path: NpcPathState;
  /** Diagnostics only; excluded from the save payload. */
  distanceTravelled: number;
}

export interface VillageClockState {
  absoluteHour: number;
  day: number;
  hourOfDay: number;
  phase: VillagePhase;
  isMarketDay: boolean;
  weather: VillageWeather;
  weatherTarget?: VillageWeather;
  weatherFrom?: VillageWeather;
  weatherTransitionStartHour?: number;
  weatherDay: number;
  emergencyUntilHour: number;
}

export interface VillageNpcSave {
  id: string;
  name: string;
  occupation: OccupationId;
  home: GridPoint;
  workplace: GridPoint | null;
  position: GridPoint;
  destination: GridPoint;
  activity: NpcActivity;
  animation: NpcAnimationState;
  needs: NpcNeeds;
  personality: VillagePersonality;
  attributes: NpcAttributes;
  relationships: Record<string, number>;
  playerTrust: number;
  conversations: number;
  memories: NpcMemoryEntry[];
  occupationHistory: Array<{ occupation: OccupationId; day: number }>;
  reactionUntilHour: number;
  lastInteractionDay: number;
  lastStrangerHour: number;
}

export interface VillageSaveState {
  schema: 2;
  clock: VillageClockState;
  incidents: VillageIncident[];
  npcs: VillageNpcSave[];
}

export interface VillageSimulationOptions {
  width: number;
  height: number;
  isBlocked: (x: number, y: number) => boolean;
  seed?: number;
  /** Restricts reaction scans and expensive path work to these NPCs. */
  visibleNpcIds?: ReadonlySet<string>;
}

export interface VillageSimulationStats {
  fullUpdates: number;
  offscreenUpdates: number;
  pathSearches: number;
  pathCacheHits: number;
  repaths: number;
  stuckRecoveries: number;
}
