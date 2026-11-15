import { Season } from '@systems/TimeManager';
import { TimeManager } from '@systems/TimeManager';
import type { CharacterVisuals } from './CharacterCustomization';

export type Gender = 'male' | 'female';
export type CharacterAppearance = 'Çiftçi' | 'Akıncı' | 'Kervancı';

/** Ottoman frontier life stages, derived from age in whole years. */
export type LifeStage = 'infant' | 'child' | 'adolescent' | 'adult' | 'elder';

export type CharacterTrait =
  | 'brave'
  | 'cautious'
  | 'greedy'
  | 'generous'
  | 'scholarly'
  | 'hardy'
  | 'charismatic'
  | 'stubborn'
  | 'diplomatic'
  | 'impulsive';

export type SkillKey =
  | 'farming'
  | 'combat'
  | 'trade'
  | 'leadership'
  | 'craftsmanship'
  | 'diplomacy';

export type RelationshipType = 'parent' | 'child' | 'spouse' | 'sibling' | 'rival' | 'ally';

export type CauseOfDeath = 'natural_age' | 'illness' | 'battle' | 'accident' | 'unknown';
export type FamilyLandPlotId = number | string;

export type InheritanceRule =
  | 'primogeniture'
  | 'ultimogeniture'
  | 'partible'
  | 'agnatic'
  | 'elective';

export interface CharacterStats {
  farming: number;
  combat: number;
  trade: number;
  leadership: number;
  craftsmanship: number;
  diplomacy: number;
}

export interface GameDate {
  day: number;
  month: number;
  year: number;
  season: Season;
}

export interface FamilyRelationship {
  targetId: string;
  type: RelationshipType;
  strength: number;
  sinceYear: number;
}

export interface PoliticalRelationship {
  faction: string;
  /** -100 (enmity) to 100 (firm alliance). */
  standing: number;
}

export interface MilitaryService {
  served: boolean;
  years: number;
  rank: string;
  battles: number;
  medals: number;
}

export type HistoryKind =
  | 'birth'
  | 'coming_of_age'
  | 'marriage'
  | 'child'
  | 'death'
  | 'retirement'
  | 'succession'
  | 'military'
  | 'land'
  | 'choice'
  | 'event'
  | 'rivalry'
  | 'alliance'
  | 'other';

export interface PersonalHistoryEntry {
  year: number;
  age: number;
  kind: HistoryKind;
  text: string;
}

export interface FamilyMember {
  id: string;
  firstName: string;
  familyName: string;
  gender: Gender;
  appearance: CharacterAppearance;
  /** Optional for backwards-compatible saves; normalized when loading. */
  visuals?: CharacterVisuals;
  birthDate: GameDate;
  deathDate: GameDate | null;
  retirementDate: GameDate | null;
  causeOfDeath: CauseOfDeath | null;
  age: number;
  lifeStage: LifeStage;
  isAlive: boolean;
  isPlayable: boolean;
  /** False when an heir is exiled, missing, or otherwise unavailable. */
  isAvailableForSuccession?: boolean;
  successionUnavailableReason?: string | null;
  generation: number;
  traits: CharacterTrait[];
  skills: CharacterStats;
  reputation: number;
  militaryService: MilitaryService;
  landPlots: FamilyLandPlotId[];
  equipment: string[];
  wealth: number;
  debts: number;
  health: number;
  maxHealth: number;
  fatherId: string | null;
  motherId: string | null;
  spouseId: string | null;
  childrenIds: string[];
  relationships: FamilyRelationship[];
  politicalRelationships: PoliticalRelationship[];
  personalHistory: PersonalHistoryEntry[];
}

export interface FamilyLegacy {
  generationsSurvived: number;
  landAcquired: number;
  landLost: number;
  militaryAchievements: number;
  importantChoices: string[];
  historicalEventsInfluenced: string[];
  reputationAcrossGenerations: number;
  rivalries: Array<{ familyId: string; intensity: number }>;
  alliances: Array<{ familyId: string; strength: number }>;
  legacy: string[];
  /** Event-derived journal that descendants can read; never synthesized as backstory. */
  records: FamilyLegacyRecord[];
  politicalCommitments: string[];
  traditions: Array<{ id: string; title: string; originYear: number; originMemberId: string; sourceRecordId: string }>;
  heirlooms: HeirloomRecord[];
  relationships: Array<{ kind: 'settlement' | 'faction' | 'family'; targetId: string; standing: number }>;
  sharedLand: Array<{ plotId: FamilyLandPlotId; ownerMemberIds: string[] }>;
  /**
   * Per-generation summary snapshots: a descendant can browse what the world
   * looked like when their ancestor ruled. Written on each succession.
   */
  generationSnapshots: GenerationSnapshot[];
}

/**
 * Snapshot of the family's standing at the moment a successor took over.
 * Descendants can browse these to understand how earlier decisions shaped
 * the world they now inhabit. Written from real simulation state, never invented.
 */
export interface GenerationSnapshot {
  generation: number;
  year: number;
  reigningMemberId: string;
  reigningMemberName: string;
  /** Wealth at the moment of succession. */
  wealthAtSuccession: number;
  /** Outstanding debt passed to the heir. */
  debtAtSuccession: number;
  /** Land plots held at the time. */
  landCount: number;
  /** Family reputation score. */
  reputation: number;
  /** Active alliances at the time (family or faction ids). */
  activeAlliances: string[];
  /** Active rivalries at the time (family or faction ids). */
  activeRivalries: string[];
  /** Notable legacy lines from this generation. */
  notableEvents: string[];
  /** Heirlooms that changed hands during this succession. */
  heirloomsTransferred: string[];
  /** Key political commitments made during this reign. */
  politicalCommitments: string[];
  /** Settlement/faction relationship standings at succession time. */
  relationshipStandings: Array<{ kind: 'settlement' | 'faction' | 'family'; targetId: string; standing: number }>;
}

/**
 * Conditions a successor inherits from the world shaped by earlier decisions.
 * These are applied on top of the heir's own skills and traits — not replacing them.
 */
export interface SuccessorWorldContext {
  /** Reputation modifier from family standing (can be negative). */
  reputationModifier: number;
  /** Debt carried forward, possibly reduced by debt-ward heirlooms. */
  inheritedDebt: number;
  /** Settlement/faction standings the heir inherits. */
  inheritedStandings: Array<{ kind: 'settlement' | 'faction' | 'family'; targetId: string; standing: number }>;
  /** Heirloom effects active for this successor. */
  heirloomEffects: HeirloomEffect[];
  /** Goals derived from unresolved legacy obligations (debts, obligations, traditions). */
  inheritedGoals: InheritedGoal[];
  /** Challenges from unresolved rivalries or contested succession. */
  inheritedChallenges: InheritedChallenge[];
}

/** A gameplay goal derived from a real legacy event, not a random prompt. */
export interface InheritedGoal {
  id: string;
  title: string;
  description: string;
  /** Which legacy record originated this goal. */
  sourceRecordId: string;
  /** Optional numerical threshold (e.g. repay 100 akçe). */
  targetValue?: number;
  kind: 'debt' | 'land' | 'military' | 'alliance' | 'political' | 'tradition';
}

/** A challenge derived from a real unresolved rivalry or contested succession. */
export interface InheritedChallenge {
  id: string;
  title: string;
  description: string;
  sourceRecordId: string;
  kind: 'rivalry' | 'contested_succession' | 'political_debt' | 'missing_heir';
  severity: 'minor' | 'moderate' | 'major';
}

export type FamilyLegacyRecordKind = 'land_acquired' | 'land_lost' | 'military' | 'debt' | 'alliance' | 'rivalry' | 'political' | 'historical' | 'heirloom' | 'succession' | 'tradition';
export interface FamilyLegacyRecord {
  id: string;
  year: number;
  generation: number;
  memberId: string | null;
  kind: FamilyLegacyRecordKind;
  title: string;
  description: string;
  targetId?: string;
  value?: number;
}
export type HeirloomEffectKind =
  | 'reputation_bonus'      // flat boost to heir's starting reputation
  | 'skill_bonus'           // small skill improvement in one area
  | 'settlement_standing'   // modifies relationship with a specific settlement/faction
  | 'social_prestige'       // narrative/social only; no direct stat change
  | 'military_morale'       // modest combat-related bonus
  | 'debt_ward';            // reduces inherited debt slightly

/**
 * Bounded gameplay effect carried by an heirloom. Effects decay over transfers
 * so a sword never becomes supernaturally powerful just by passing hands.
 * Maximum effective magnitude is capped per kind (see HEIRLOOM_EFFECT_CAPS).
 */
export interface HeirloomEffect {
  kind: HeirloomEffectKind;
  /** Positive or negative magnitude. Always capped at HEIRLOOM_EFFECT_CAPS[kind]. */
  magnitude: number;
  /** Optional secondary target (skill key or settlement/faction id). */
  targetKey?: string;
}

/** Hard ceiling for each effect kind so items cannot grow unbounded. */
export const HEIRLOOM_EFFECT_CAPS: Record<HeirloomEffectKind, number> = {
  reputation_bonus: 20,
  skill_bonus: 8,
  settlement_standing: 15,
  social_prestige: 0,   // narrative only
  military_morale: 12,
  debt_ward: 25,
};

export interface HeirloomRecord {
  itemId: string;
  originMemberId: string;
  originYear: number;
  context: string;
  currentHolderId: string | null;
  transfers: number;
  /** Optional gameplay effect. Magnitude decays slightly with each transfer. */
  effect?: HeirloomEffect;
  /** Human-readable provenance chain: "Given by X to Y in year Z." */
  provenanceChain: string[];
}

export interface Family {
  id: string;
  name: string;
  founderId: string;
  currentPlayableId: string | null;
  members: FamilyMember[];
  worldPopulation: number;
  foundedYear: number;
  legacy: FamilyLegacy;
}

export interface InheritedProperty {
  wealth: number;
  debts: number;
  equipment: string[];
  landPlots: FamilyLandPlotId[];
  familyReputation: number;
}

export interface InheritanceResult {
  deceasedId: string;
  eligibleHeirIds: string[];
  primaryHeirId: string | null;
  /** Wealth share per heir. Partible inheritance splits evenly. */
  shares: Record<string, number>;
  debtShares: Record<string, number>;
  landShares: Record<string, FamilyLandPlotId[]>;
  property: InheritedProperty;
  consequences: string[];
  disputes: string[];
  gameOver: boolean;
}

export interface PendingSuccession {
  deceasedId: string;
  inheritance: InheritanceResult;
  year: number;
  reason?: 'death' | 'retirement';
  contestedBy?: string[];
}

export interface SuccessionOutcome {
  success: boolean;
  heirId: string | null;
  message: string;
  inheritance: InheritanceResult | null;
}

export type FamilyEventType =
  | 'birth'
  | 'coming_of_age'
  | 'marriage'
  | 'death'
  | 'retirement'
  | 'succession_required'
  | 'rivalry'
  | 'alliance'
  | 'land'
  | 'military'
  | 'game_over';

export interface FamilyEvent {
  type: FamilyEventType;
  memberId: string | null;
  year: number;
  message: string;
}

export interface FamilyConfig {
  /** Hard cap on living family members. Prevents runaway dynasties. */
  maxFamilyMembers: number;
  /** Cap on generated people (spouses and outside kin) in the simulation. */
  maxWorldPopulation: number;
  minMarriageAge: number;
  minChildbearingAge: number;
  maxChildbearingAge: number;
  birthChancePerYear: number;
  maxChildrenPerCouple: number;
  /** Base yearly chance of death before old age. */
  baseMortalityPerYear: number;
  /** Multiplier applied to the age-based mortality curve. */
  mortalityMultiplier: number;
  /** Yearly chance that an adult dies in a simulated historical cause. */
  historicalDeathChance: number;
  inheritanceRule: InheritanceRule;
  inheritancePolicyId: string;
  landInheritanceRule: 'primary' | 'divided' | 'shared';
  /** Optional historical context used by content/UI to select a period-specific policy. */
  inheritanceContext: { regionId: string; periodId: string };
  heirMinAge: number;
  considerSpouseAsHeir: boolean;
  reputationInheritanceRatio: number;
  debtInheritanceRatio: number;
  disputeChance: number;
  traitInheritanceChance: number;
}

export const DEFAULT_FAMILY_CONFIG: FamilyConfig = {
  maxFamilyMembers: 24,
  maxWorldPopulation: 160,
  minMarriageAge: 15,
  minChildbearingAge: 16,
  maxChildbearingAge: 40,
  birthChancePerYear: 0.22,
  maxChildrenPerCouple: 5,
  baseMortalityPerYear: 0.006,
  mortalityMultiplier: 1,
  historicalDeathChance: 0.012,
  inheritanceRule: 'primogeniture',
  inheritancePolicyId: 'frontier_household_early_ottoman',
  landInheritanceRule: 'primary',
  inheritanceContext: { regionId: 'northwest_anatolia', periodId: 'early_frontier' },
  heirMinAge: 16,
  considerSpouseAsHeir: true,
  reputationInheritanceRatio: 0.5,
  debtInheritanceRatio: 0.75,
  disputeChance: 0.25,
  traitInheritanceChance: 0.6,
};

/** Configurable abstractions for gameplay; not universal claims about Ottoman law. */
export const INHERITANCE_POLICIES: Record<string, Pick<FamilyConfig, 'inheritanceRule' | 'landInheritanceRule' | 'debtInheritanceRatio' | 'considerSpouseAsHeir'>> = {
  frontier_household_early_ottoman: { inheritanceRule: 'primogeniture', landInheritanceRule: 'primary', debtInheritanceRatio: 0.75, considerSpouseAsHeir: true },
  household_partition: { inheritanceRule: 'partible', landInheritanceRule: 'divided', debtInheritanceRatio: 1, considerSpouseAsHeir: true },
  council_election: { inheritanceRule: 'elective', landInheritanceRule: 'shared', debtInheritanceRatio: 0.75, considerSpouseAsHeir: true },
};

export const INHERITANCE_RULE_LABELS: Record<InheritanceRule, string> = {
  primogeniture: 'Primogeniture — eldest child inherits',
  ultimogeniture: 'Ultimogeniture — youngest child inherits',
  partible: 'Partible — estate divided among children',
  agnatic: 'Agnatic — male heirs only',
  elective: 'Elective — family council chooses the ablest',
};

export const TRAIT_LABELS: Record<CharacterTrait, string> = {
  brave: 'Cesur',
  cautious: 'Temkinli',
  greedy: 'Açgözlü',
  generous: 'Cömert',
  scholarly: 'Alim',
  hardy: 'Dayanıklı',
  charismatic: 'Karizmatik',
  stubborn: 'İnatçı',
  diplomatic: 'Diplomat',
  impulsive: 'Düşüncesiz',
};

export const SKILL_LABELS: Record<SkillKey, string> = {
  farming: 'Tarım',
  combat: 'Savaş',
  trade: 'Ticaret',
  leadership: 'Liderlik',
  craftsmanship: 'Zanaat',
  diplomacy: 'Diplomasi',
};

export const TRAIT_MODIFIERS: Record<CharacterTrait, Partial<CharacterStats>> = {
  brave: { combat: 4, leadership: 1 },
  cautious: { diplomacy: 2, farming: 1 },
  greedy: { trade: 4 },
  generous: { diplomacy: 3, leadership: 1 },
  scholarly: { craftsmanship: 2, diplomacy: 2 },
  hardy: { farming: 3, combat: 1 },
  charismatic: { leadership: 4, diplomacy: 2 },
  stubborn: { combat: 2, leadership: 1, diplomacy: -1 },
  diplomatic: { diplomacy: 4, trade: 1 },
  impulsive: { combat: 2, trade: 1, leadership: -1 },
};

const MALE_NAMES = ['Osman', 'Orhan', 'Murad', 'Bayezid', 'Süleyman', 'Mehmed', 'İsa', 'Hüseyin', 'Yakup', 'Mustafa', 'Ali', 'Hamza'];
const FEMALE_NAMES = ['Fatma', 'Hatice', 'Zeynep', 'Emine', 'Ayşe', 'Gülbahar', 'Nilüfer', 'Hafsa', 'Esma', 'Rabi\'a', 'Meryem', 'Şahzade'];
const FAMILY_NAMES = ['Köprülü', 'Çandarlı', 'Timurtaş', 'Evrenos', 'Mihaloğlu', 'Aydınoğlu', 'Saruhanlı', 'Germiyanoğlu', 'Karası', 'Menteşe'];
const RANKS = ['Yaya', 'Azap', 'Müsellem', 'Sipahi', 'Subaşı', 'Sancak Beyi'];

export function seasonForMonth(month: number): Season {
  const { spring, summer, autumn, winter } = TimeManager.getInstance().getCalendarConfig().seasonStarts;
  const ranges = [
    { season: Season.SPRING, start: spring, end: summer },
    { season: Season.SUMMER, start: summer, end: autumn },
    { season: Season.AUTUMN, start: autumn, end: winter },
  ];
  return ranges.find(r => r.start <= r.end ? month >= r.start && month < r.end : month >= r.start || month < r.end)?.season ?? Season.WINTER;
}

export function createGameDate(year: number, month = 3, day = 1): GameDate {
  return { year, month, day, season: seasonForMonth(month) };
}

/** Age in whole years, adjusted for whether the birthday has passed. */
export function ageAtDate(birth: GameDate, current: GameDate): number {
  let age = current.year - birth.year;
  if (current.month < birth.month || (current.month === birth.month && current.day < birth.day)) {
    age -= 1;
  }
  return Math.max(0, age);
}

export function lifeStageForAge(age: number): LifeStage {
  if (age < 2) return 'infant';
  if (age < 12) return 'child';
  if (age < 16) return 'adolescent';
  if (age < 45) return 'adult';
  return 'elder';
}

export function lifeStageLabel(stage: LifeStage): string {
  switch (stage) {
    case 'infant':
      return 'Bebek';
    case 'child':
      return 'Çocuk';
    case 'adolescent':
      return 'Genç';
    case 'adult':
      return 'Yetişkin';
    case 'elder':
      return 'Yaşlı';
  }
}

export function createBaseStats(): CharacterStats {
  return {
    farming: 10,
    combat: 10,
    trade: 10,
    leadership: 10,
    craftsmanship: 10,
    diplomacy: 10,
  };
}

/** Applies trait bonuses on top of the generated base skills. */
export function applyTraitModifiers(traits: CharacterTrait[], stats: CharacterStats): CharacterStats {
  const result: CharacterStats = { ...stats };
  for (const trait of traits) {
    const mods = TRAIT_MODIFIERS[trait];
    for (const key of Object.keys(mods) as SkillKey[]) {
      result[key] = Math.max(1, result[key] + (mods[key] ?? 0));
    }
  }
  return result;
}

export function skillTotal(stats: CharacterStats): number {
  return Object.values(stats).reduce((sum, value) => sum + value, 0);
}

export function randomName(gender: Gender, rng: () => number): string {
  const pool = gender === 'male' ? MALE_NAMES : FEMALE_NAMES;
  return pool[Math.floor(rng() * pool.length)] ?? (gender === 'male' ? 'Osman' : 'Fatma');
}

export function randomFamilyName(rng: () => number): string {
  return FAMILY_NAMES[Math.floor(rng() * FAMILY_NAMES.length)] ?? 'Köprülü';
}

export function randomRank(rng: () => number): string {
  return RANKS[Math.floor(rng() * RANKS.length)] ?? 'Yaya';
}

export function randomTrait(rng: () => number): CharacterTrait {
  const all = Object.keys(TRAIT_LABELS) as CharacterTrait[];
  return all[Math.floor(rng() * all.length)] ?? 'brave';
}

export function createRandomTraits(rng: () => number, count = 2): CharacterTrait[] {
  const traits: CharacterTrait[] = [];
  let guard = 0;
  while (traits.length < count && guard < 30) {
    const trait = randomTrait(rng);
    if (!traits.includes(trait)) traits.push(trait);
    guard++;
  }
  return traits;
}

/**
 * Mixes parental traits probabilistically and adds fresh variation. Children
 * are deliberately never an exact copy of either parent.
 */
export function inheritTraits(
  parentTraits: CharacterTrait[],
  rng: () => number,
  chance: number,
): CharacterTrait[] {
  const inherited: CharacterTrait[] = [];
  for (const trait of parentTraits) {
    if (rng() < chance && !inherited.includes(trait)) {
      inherited.push(trait);
    }
  }

  // Every child develops at least one trait of their own.
  const ownTrait = randomTrait(rng);
  if (!inherited.includes(ownTrait)) inherited.push(ownTrait);

  // Occasionally a second new trait appears.
  if (rng() < 0.35 && inherited.length < 3) {
    const extra = randomTrait(rng);
    if (!inherited.includes(extra)) inherited.push(extra);
  }

  // Guard against an exact copy of a parent's trait list.
  if (
    inherited.length === parentTraits.length &&
    inherited.every((trait) => parentTraits.includes(trait))
  ) {
    const replacement = randomTrait(rng);
    inherited[inherited.length - 1] = replacement;
  }

  return inherited.slice(0, 3);
}

export function generateSkills(rng: () => number, parentStats?: CharacterStats): CharacterStats {
  const stats = createBaseStats();
  for (const key of Object.keys(stats) as SkillKey[]) {
    const parentValue = parentStats ? parentStats[key] : 10;
    // Regression to the mean plus individual variation.
    stats[key] = Math.round(
      parentValue * 0.25 + 10 * 0.55 + rng() * 7 - 1,
    );
  }
  return stats;
}

export function createMilitaryService(): MilitaryService {
  return { served: false, years: 0, rank: 'Yaya', battles: 0, medals: 0 };
}
