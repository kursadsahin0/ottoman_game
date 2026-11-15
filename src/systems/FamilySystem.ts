import type { GameTime } from '@systems/TimeManager';
import { DEFAULT_CHARACTER_VISUALS, inheritCharacterVisuals, normalizeCharacterVisuals, type CharacterVisuals } from '@data/CharacterCustomization';
import {
  DEFAULT_FAMILY_CONFIG,
  HEIRLOOM_EFFECT_CAPS,
  INHERITANCE_POLICIES,
  ageAtDate,
  applyTraitModifiers,
  createGameDate,
  createMilitaryService,
  createRandomTraits,
  generateSkills,
  inheritTraits,
  lifeStageForAge,
  randomFamilyName,
  randomName,
  randomTrait,
  skillTotal,
  type CharacterStats,
  type CharacterTrait,
  type CauseOfDeath,
  type Family,
  type FamilyConfig,
  type FamilyEvent,
  type FamilyLandPlotId,
  type FamilyMember,
  type FamilyRelationship,
  type Gender,
  type GenerationSnapshot,
  type HeirloomEffect,
  type HeirloomRecord,
  type HistoryKind,
  type InheritedChallenge,
  type InheritedGoal,
  type InheritedProperty,
  type InheritanceResult,
  type PendingSuccession,
  type SuccessionOutcome,
  type SuccessorWorldContext,
} from '@data/FamilyData';

export const FAMILY_SAVE_VERSION = 3;

/** Reads and writes the live game's material assets around a succession. */
export interface FamilyAssetBridge {
  read(family: Family, deceased: FamilyMember | null): InheritedProperty;
  apply(property: InheritedProperty, heir: FamilyMember, family: Family): void;
}

export interface FamilySaveState {
  version: number;
  family: Family;
  config: FamilyConfig;
  nextMemberNumber: number;
  lastProcessedYear: number;
  pendingSuccession: PendingSuccession | null;
  savedAt: number;
  politicalLegacy?: number;
  /** Missing fields from v1/v2 saves are hydrated by deserialize(). */
}

export interface FamilySystemOptions {
  config?: Partial<FamilyConfig>;
  seed?: number;
  bridge?: FamilyAssetBridge;
  time?: GameTime;
  familyName?: string;
}

export interface FounderOptions {
  firstName?: string;
  familyName?: string;
  gender?: Gender;
  appearance?: FamilyMember['appearance'];
  visuals?: CharacterVisuals;
  age?: number;
  traits?: CharacterTrait[];
  stats?: CharacterStats;
  reputation?: number;
  wealth?: number;
}

export interface ChildOptions {
  firstName?: string;
  gender?: Gender;
  /** Create a child at an existing age (useful for migrations and tests). */
  age?: number;
  traits?: CharacterTrait[];
}

export interface SpouseOptions {
  firstName?: string;
  age?: number;
}

/** Small deterministic PRNG so dynasties are reproducible in tests. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function emptyLegacy(): Family['legacy'] {
  return {
    generationsSurvived: 1,
    landAcquired: 0,
    landLost: 0,
    militaryAchievements: 0,
    importantChoices: [],
    historicalEventsInfluenced: [],
    reputationAcrossGenerations: 0,
    rivalries: [],
    alliances: [],
    legacy: [],
    records: [],
    politicalCommitments: [],
    traditions: [],
    heirlooms: [],
    relationships: [],
    sharedLand: [],
    generationSnapshots: [],
  };
}

function causeLabel(cause: CauseOfDeath): string {
  switch (cause) {
    case 'natural_age':
      return 'yaşlılık';
    case 'illness':
      return 'hastalık';
    case 'battle':
      return 'savaş';
    case 'accident':
      return 'kaza';
    case 'unknown':
      return 'bilinmeyen sebep';
  }
}

/**
 * Generational family simulation: births, ageing, marriages, deaths and
 * inheritance. It stores only the family tree plus a bounded count of
 * generated outside characters, so a long campaign cannot inflate memory.
 */
export class FamilySystem {
  private config: FamilyConfig;
  private rng: () => number;
  private bridge: FamilyAssetBridge | null;
  private family: Family;
  private nextMemberNumber: number;
  private lastProcessedYear: number;
  private pendingSuccession: PendingSuccession | null;
  private politicalLegacy = 0;
  private legacySequence = 0;

  constructor(options: FamilySystemOptions = {}) {
    this.config = { ...DEFAULT_FAMILY_CONFIG, ...(options.config ?? {}) };
    this.rng = mulberry32(options.seed ?? 1337);
    this.bridge = options.bridge ?? null;
    this.nextMemberNumber = 1;
    this.lastProcessedYear = options.time?.year ?? 1299;
    this.pendingSuccession = null;
    this.family = {
      id: 'family_1',
      name: options.familyName ?? randomFamilyName(this.rng),
      founderId: '',
      currentPlayableId: null,
      members: [],
      worldPopulation: 0,
      foundedYear: options.time?.year ?? 1299,
      legacy: emptyLegacy(),
    };
    if (options.time) {
      this.initialize(options.time, options.familyName);
    }
  }

  // ---------------------------------------------------------------------
  // Setup and character creation
  // ---------------------------------------------------------------------

  /** Creates the founding character when the family is still empty. */
  initialize(time: GameTime, familyName?: string): FamilyMember {
    const existing = this.getCurrentMember();
    if (existing) return existing;
    if (familyName) {
      this.family.name = familyName;
    }
    return this.createFounder(time);
  }

  createFounder(time: GameTime, options: FounderOptions = {}): FamilyMember {
    const gender = options.gender ?? (this.rng() < 0.5 ? 'male' : 'female');
    const age = Math.max(16, Math.min(60, Math.floor(options.age ?? 24)));
    const traits = options.traits ?? createRandomTraits(this.rng, 2);
    const baseStats = options.stats ?? generateSkills(this.rng);
    const stats = applyTraitModifiers(traits, baseStats);
    const familyName = options.familyName ?? this.family.name;

    const founder = this.buildMember({
      firstName: options.firstName ?? randomName(gender, this.rng),
      familyName,
      gender,
      appearance: options.appearance ?? this.randomAppearance(),
      visuals: normalizeCharacterVisuals(options.visuals ?? DEFAULT_CHARACTER_VISUALS, gender),
      birthYear: time.year - age,
      birthDate: createGameDate(time.year - age, time.month, time.day),
      referenceDate: createGameDate(time.year, time.month, time.day),
      generation: 1,
      traits,
      stats,
      reputation: options.reputation ?? 10,
      wealth: options.wealth ?? 0,
    });

    this.family = {
      id: this.family.id,
      name: familyName,
      founderId: founder.id,
      currentPlayableId: founder.id,
      members: [founder],
      worldPopulation: Math.max(this.family.worldPopulation, 40),
      foundedYear: time.year,
      legacy: emptyLegacy(),
    };
    this.lastProcessedYear = time.year;
    this.pendingSuccession = null;
    founder.isPlayable = true;
    this.addHistory(founder, time.year, 'birth', `${familyName} ailesinin kurucusu olarak dünyaya geldi.`);
    return founder;
  }

  /** Adds a spouse to the family, if population and age rules allow it. */
  createSpouse(memberId: string, time: GameTime, options: SpouseOptions = {}): FamilyMember | null {
    const member = this.getMember(memberId);
    if (!member || !member.isAlive || member.spouseId || member.age < this.config.minMarriageAge) {
      return null;
    }
    if (!this.canGenerateOutsideCharacter()) return null;

    const gender: Gender = member.gender === 'male' ? 'female' : 'male';
    const ageOffset = Math.floor(this.rng() * 9) - 4;
    const age = Math.max(
      this.config.minMarriageAge,
      Math.min(60, options.age ?? member.age + ageOffset),
    );
    const spouse = this.buildMember({
      firstName: options.firstName ?? randomName(gender, this.rng),
      familyName: randomFamilyName(this.rng),
      gender,
      appearance: this.randomAppearance(),
      birthYear: time.year - age,
      birthDate: createGameDate(time.year - age, time.month, time.day),
      referenceDate: createGameDate(time.year, time.month, time.day),
      generation: member.generation,
      traits: createRandomTraits(this.rng, 2),
      stats: applyTraitModifiers(createRandomTraits(this.rng, 0), generateSkills(this.rng)),
      reputation: Math.max(0, Math.round(member.reputation * 0.4)),
      wealth: 0,
    });
    spouse.traits = createRandomTraits(this.rng, 2);
    spouse.skills = applyTraitModifiers(spouse.traits, generateSkills(this.rng));

    this.family.members.push(spouse);
    this.family.worldPopulation += 1;
    member.spouseId = spouse.id;
    spouse.spouseId = member.id;
    this.addRelationship(member, spouse.id, 'spouse', 60, time.year);
    this.addRelationship(spouse, member.id, 'spouse', 60, time.year);
    this.addHistory(member, time.year, 'marriage', `${spouse.firstName} ile evlendi.`);
    this.addHistory(spouse, time.year, 'marriage', `${member.firstName} ile evlendi.`);
    return spouse;
  }

  /** Creates a child of two living family members. */
  createChild(
    motherId: string,
    fatherId: string,
    time: GameTime,
    options: ChildOptions = {},
  ): FamilyMember | null {
    const mother = this.getMember(motherId);
    const father = this.getMember(fatherId);
    if (!mother || !father || !mother.isAlive || !father.isAlive) return null;
    if (mother.id === father.id || mother.gender !== 'female' || father.gender !== 'male') return null;
    const birthDate = createGameDate(time.year - Math.max(0, Math.floor(options.age ?? 0)), time.month, time.day);
    const motherAge = ageAtDate(mother.birthDate, birthDate);
    const fatherAge = ageAtDate(father.birthDate, birthDate);
    if (motherAge < this.config.minChildbearingAge || motherAge > this.config.maxChildbearingAge || fatherAge < this.config.minChildbearingAge || birthDate.year < mother.birthDate.year || birthDate.year < father.birthDate.year) return null;
    if (!this.canAddFamilyMember()) return null;

    const gender = options.gender ?? (this.rng() < 0.5 ? 'male' : 'female');
    const age = Math.max(0, Math.floor(options.age ?? 0));
    const inherited = options.traits ?? inheritTraits(
      [...mother.traits, ...father.traits],
      this.rng,
      this.config.traitInheritanceChance,
    );
    // A child may resemble a parent, but never duplicates them exactly.
    if (this.sameTraits(inherited, mother.traits) || this.sameTraits(inherited, father.traits)) {
      const replacement = randomTrait(this.rng);
      if (inherited.length === 0) inherited.push(replacement);
      else inherited[inherited.length - 1] = replacement;
    }
    const parentAverage = this.averageStats(mother.skills, father.skills);
    const stats = applyTraitModifiers(inherited, generateSkills(this.rng, parentAverage));
    const familyName = father.familyName || mother.familyName;

    const child = this.buildMember({
      firstName: options.firstName ?? randomName(gender, this.rng),
      familyName,
      gender,
      appearance: this.randomAppearance(),
      visuals: inheritCharacterVisuals(mother.visuals ?? DEFAULT_CHARACTER_VISUALS, father.visuals ?? DEFAULT_CHARACTER_VISUALS, gender, this.nextMemberNumber),
      birthYear: time.year - age,
      birthDate,
      referenceDate: createGameDate(time.year, time.month, time.day),
      generation: Math.max(mother.generation, father.generation) + 1,
      traits: inherited,
      stats,
      reputation: Math.round((mother.reputation + father.reputation) * 0.1),
      wealth: 0,
    });

    child.fatherId = father.id;
    child.motherId = mother.id;
    this.family.members.push(child);

    father.childrenIds.push(child.id);
    mother.childrenIds.push(child.id);
    this.addRelationship(father, child.id, 'child', 70, time.year);
    this.addRelationship(mother, child.id, 'child', 70, time.year);
    this.addRelationship(child, father.id, 'parent', 70, time.year);
    this.addRelationship(child, mother.id, 'parent', 70, time.year);

    // Siblings get a relationship entry so the tree can express the bond.
    for (const siblingId of [...father.childrenIds, ...mother.childrenIds]) {
      if (siblingId === child.id) continue;
      const sibling = this.getMember(siblingId);
      if (!sibling) continue;
      this.addRelationship(child, sibling.id, 'sibling', 35, time.year);
      this.addRelationship(sibling, child.id, 'sibling', 35, time.year);
    }

    this.addHistory(child, time.year, 'birth', `${mother.firstName} ile ${father.firstName}'in çocuğu olarak doğdu.`);
    this.addHistory(father, time.year, 'child', `${child.firstName} adında bir çocuğu oldu.`);
    this.addHistory(mother, time.year, 'child', `${child.firstName} adında bir çocuğu oldu.`);
    return child;
  }

  // ---------------------------------------------------------------------
  // Time and lifecycle
  // ---------------------------------------------------------------------

  /**
   * Advances the family simulation to the supplied calendar date. Every
   * in-game year that has elapsed is simulated once, in order.
   */
  advanceTime(time: GameTime): FamilyEvent[] {
    const events: FamilyEvent[] = [];
    const currentYear = time.year;
    const startYear = this.lastProcessedYear;
    if (currentYear > startYear) {
      const years = Math.min(currentYear - startYear, 200);
      for (let offset = 1; offset <= years; offset++) {
        this.simulateYear(startYear + offset, time, events);
      }
      this.lastProcessedYear = currentYear;
    }
    this.refreshAges(time);
    return events;
  }

  /** Updates ages and life stages without triggering yearly events. */
  refreshAges(time: GameTime): void {
    const date = createGameDate(time.year, time.month, time.day);
    for (const member of this.family.members) {
      if (!member.isAlive) continue;
      member.age = ageAtDate(member.birthDate, date);
      member.lifeStage = lifeStageForAge(member.age);
    }
  }

  private simulateYear(year: number, time: GameTime, events: FamilyEvent[]): void {
    const date = createGameDate(year, time.month, time.day);

    for (const member of this.family.members) {
      if (!member.isAlive) continue;
      const age = ageAtDate(member.birthDate, date);
      const stage = lifeStageForAge(age);
      member.age = age;
      if (stage !== member.lifeStage) {
        const previous = member.lifeStage;
        member.lifeStage = stage;
        if (stage === 'adult' && previous !== 'adult') {
          this.addHistory(member, year, 'coming_of_age', 'Yetişkinlik çağına erdi ve aile işlerine katıldı.');
          events.push(this.event('coming_of_age', member, year, `${member.firstName} yetişkin oldu.`));
        }
      }
    }

    this.simulateMarriages(year, time, events);
    this.simulateBirths(year, time, events);
    this.simulateRelationships(year, events);
    this.simulateDeaths(year, time, events);

    const living = this.family.members.filter((member) => member.isAlive);
    this.family.legacy.reputationAcrossGenerations = living.length > 0
      ? Math.round(living.reduce((sum, member) => sum + member.reputation, 0) / living.length)
      : 0;
    this.family.legacy.generationsSurvived = Math.max(
      this.family.legacy.generationsSurvived,
      ...living.map((member) => member.generation),
    );
  }

  private simulateMarriages(year: number, time: GameTime, events: FamilyEvent[]): void {
    const date = createGameDate(year, time.month, time.day);
    for (const member of [...this.family.members]) {
      if (!member.isAlive || member.spouseId) continue;
      if (member.age < this.config.minMarriageAge) continue;
      if (member.age > 55) continue;
      if (this.rng() > 0.18) continue;
      const spouse = this.createSpouse(member.id, { ...time, year, month: date.month, day: date.day });
      if (spouse) {
        events.push(this.event('marriage', member, year, `${member.firstName}, ${spouse.firstName} ile evlendi.`));
      }
    }
  }

  private simulateBirths(year: number, time: GameTime, events: FamilyEvent[]): void {
    if (!this.canAddFamilyMember()) return;

    const date = createGameDate(year, time.month, time.day);
    const seenCouples = new Set<string>();
    for (const member of [...this.family.members]) {
      if (!member.isAlive || !member.spouseId) continue;
      const spouse = this.getMember(member.spouseId);
      if (!spouse || !spouse.isAlive) continue;

      const key = [member.id, spouse.id].sort().join('::');
      if (seenCouples.has(key)) continue;
      seenCouples.add(key);

      const mother = member.gender === 'female' ? member : spouse.gender === 'female' ? spouse : null;
      const father = member.gender === 'male' ? member : spouse.gender === 'male' ? spouse : null;
      if (!mother || !father) continue;
      if (mother.age < this.config.minChildbearingAge || mother.age > this.config.maxChildbearingAge) continue;
      if (mother.childrenIds.length >= this.config.maxChildrenPerCouple) continue;
      if (!this.canAddFamilyMember()) return;

      if (this.rng() > this.config.birthChancePerYear) continue;

      const child = this.createChild(mother.id, father.id, { ...time, year, month: date.month, day: date.day });
      if (child) {
        events.push(this.event('birth', child, year, `${child.firstName} dünyaya geldi (${father.firstName} ve ${mother.firstName}).`));
      }
    }
  }

  private simulateRelationships(year: number, events: FamilyEvent[]): void {
    const living = this.family.members.filter((member) => member.isAlive);
    for (let i = 0; i < living.length; i++) {
      const a = living[i];
      if (!a) continue;
      for (let j = i + 1; j < living.length; j++) {
        const b = living[j];
        if (!b) continue;
        if (a.fatherId !== b.fatherId || !a.fatherId) continue;
        if (a.id === b.id) continue;
        if (a.relationships.some((rel) => rel.targetId === b.id && (rel.type === 'rival' || rel.type === 'ally'))) {
          continue;
        }
        const roll = this.rng();
        if (roll < 0.06) {
          this.addRelationship(a, b.id, 'rival', 30, year);
          this.addRelationship(b, a.id, 'rival', 30, year);
          this.family.legacy.legacy.push(`${year}: ${a.firstName} ve ${b.firstName} kardeşler arasında rekabet başladı.`);
          events.push(this.event('rivalry', a, year, `${a.firstName} ve ${b.firstName} kardeşler arasında rekabet başladı.`));
        } else if (roll < 0.14) {
          this.addRelationship(a, b.id, 'ally', 45, year);
          this.addRelationship(b, a.id, 'ally', 45, year);
          this.family.legacy.legacy.push(`${year}: ${a.firstName} ve ${b.firstName} kardeşler müttefik oldu.`);
          events.push(this.event('alliance', a, year, `${a.firstName} ve ${b.firstName} kardeşler müttefik oldu.`));
        }
      }
    }
  }

  private simulateDeaths(year: number, time: GameTime, events: FamilyEvent[]): void {
    const date = createGameDate(year, time.month, time.day);
    const doomed: Array<{ id: string; cause: CauseOfDeath }> = [];

    for (const member of this.family.members) {
      if (!member.isAlive) continue;
      const age = ageAtDate(member.birthDate, date);
      const mortality = this.mortalityForAge(age);
      if (this.rng() < mortality) {
        doomed.push({ id: member.id, cause: age >= 55 ? 'natural_age' : this.randomDeathCause() });
        continue;
      }
      if (age >= 16 && this.rng() < this.config.historicalDeathChance) {
        doomed.push({ id: member.id, cause: this.randomDeathCause(true) });
      }
    }

    for (const entry of doomed) {
      this.killCharacter(entry.id, entry.cause, { ...time, year, month: date.month, day: date.day }, events);
    }
  }

  private mortalityForAge(age: number): number {
    let chance = this.config.baseMortalityPerYear;
    if (age >= 50) chance += 0.008;
    if (age >= 60) chance += 0.025;
    if (age >= 70) chance += 0.06;
    if (age >= 80) chance += 0.14;
    if (age >= 90) chance += 0.2;
    return Math.min(0.95, chance * this.config.mortalityMultiplier);
  }

  private randomDeathCause(adultOnly = false): CauseOfDeath {
    const options: CauseOfDeath[] = adultOnly
      ? ['battle', 'illness', 'accident']
      : ['illness', 'accident', 'battle'];
    return options[Math.floor(this.rng() * options.length)] ?? 'illness';
  }

  /**
   * Ends a character's life. If they were the playable character, a pending
   * succession is opened rather than silently replacing them.
   */
  killCharacter(
    memberId: string,
    cause: CauseOfDeath,
    time: GameTime,
    eventSink?: FamilyEvent[],
  ): FamilyEvent[] {
    const events = eventSink ?? [];
    const member = this.getMember(memberId);
    if (!member || !member.isAlive) return events;

    const date = createGameDate(time.year, time.month, time.day);
    member.deathDate = date;
    member.causeOfDeath = cause;
    member.isAlive = false;
    member.isPlayable = false;
    member.age = ageAtDate(member.birthDate, date);
    this.addHistory(member, time.year, 'death', `${causeLabel(cause)} sebebiyle vefat etti (${member.age} yaşında).`);
    events.push(this.event('death', member, time.year, `${member.firstName} ${member.familyName} vefat etti — ${causeLabel(cause)}.`));

    if (this.family.currentPlayableId === member.id) {
      const pending = this.beginSuccession(member.id, time);
      if (pending.inheritance.gameOver) {
        events.push(this.event('game_over', member, time.year, 'Ailenin devam edecek bir varisi kalmadı.'));
      } else {
        events.push(this.event(
          'succession_required',
          member,
          time.year,
          `${member.firstName} öldü. ${pending.inheritance.eligibleHeirIds.length} varis arasından yeni aile reisi seçilmeli.`,
        ));
      }
    }
    return events;
  }

  /** Retires the playable head and opens the same explicit succession flow as death. */
  retireCharacter(memberId: string, time: GameTime): FamilyEvent[] {
    const member = this.getMember(memberId);
    if (!member || !member.isAlive || this.family.currentPlayableId !== memberId) return [];
    const date = createGameDate(time.year, time.month, time.day);
    member.retirementDate = date;
    member.isPlayable = false;
    member.age = ageAtDate(member.birthDate, date);
    member.lifeStage = lifeStageForAge(member.age);
    this.addHistory(member, time.year, 'retirement', `${member.firstName} aile reisliğinden emekli oldu.`);
    this.addLegacyRecord(time.year, 'succession', 'Aile reisi emekli oldu', `${member.firstName} ${member.familyName}, aile reisliğini bırakarak veraseti başlattı.`, { memberId });
    this.family.currentPlayableId = null;
    const pending = this.beginSuccession(memberId, time, 'retirement');
    const events = [this.event('retirement', member, time.year, `${member.firstName} aile reisliğinden emekli oldu.`)];
    events.push(this.event(pending.inheritance.gameOver ? 'game_over' : 'succession_required', member, time.year, pending.inheritance.gameOver ? 'Ailenin devam edecek bir varisi kalmadı.' : `${pending.inheritance.eligibleHeirIds.length} varis arasından yeni aile reisi seçilmeli.`));
    return events;
  }

  // ---------------------------------------------------------------------
  // Inheritance and succession
  // ---------------------------------------------------------------------

  /** Resolves heirs and material assets without yet choosing a successor. */
  resolveInheritance(deceasedId: string): InheritanceResult {
    const deceased = this.getMember(deceasedId);
    if (!deceased) {
      return {
        deceasedId,
        eligibleHeirIds: [],
        primaryHeirId: null,
        shares: {},
        debtShares: {},
        landShares: {},
        property: { wealth: 0, debts: 0, equipment: [], landPlots: [], familyReputation: 0 },
        consequences: [],
        disputes: ['Vefat eden aile üyesi bulunamadı.'],
        gameOver: true,
      };
    }

    let candidates = deceased.childrenIds
      .map((id) => this.getMember(id))
      .filter((member): member is FamilyMember => !!member && member.isAlive && member.isAvailableForSuccession !== false && member.age >= this.config.heirMinAge);

    if (candidates.length === 0 && this.config.considerSpouseAsHeir && deceased.spouseId) {
      const spouse = this.getMember(deceased.spouseId);
      if (spouse && spouse.isAlive && spouse.isAvailableForSuccession !== false && spouse.age >= this.config.heirMinAge) {
        candidates = [spouse];
      }
    }

    const rule = this.config.inheritanceRule;
    if (rule === 'agnatic') {
      candidates = candidates.filter((member) => member.gender === 'male');
    }

    candidates.sort((a, b) => b.age - a.age || skillTotal(b.skills) - skillTotal(a.skills));

    let eligible = [...candidates];
    if (rule === 'primogeniture' || rule === 'agnatic' || rule === 'partible') {
      // All children remain eligible; the default claim belongs to the eldest.
    } else if (rule === 'ultimogeniture') {
      eligible = candidates.slice(-1);
    } else if (rule === 'elective') {
      eligible = [...candidates].sort(
        (a, b) =>
          b.skills.leadership + b.reputation - (a.skills.leadership + a.reputation),
      );
    }

    const eligibleHeirIds = eligible.map((member) => member.id);
    const primaryHeirId = rule === 'elective'
      ? eligible[0]?.id ?? null
      : rule === 'ultimogeniture'
        ? eligible[eligible.length - 1]?.id ?? null
        : eligible[0]?.id ?? null;

    const rawProperty = this.readAssets(deceased);
    const property: InheritedProperty = {
      wealth: Math.max(0, Math.floor(rawProperty.wealth)),
      debts: Math.max(0, Math.floor(rawProperty.debts * this.config.debtInheritanceRatio)),
      equipment: [...rawProperty.equipment],
      landPlots: [...rawProperty.landPlots],
      familyReputation: Math.max(0, Math.floor(rawProperty.familyReputation * this.config.reputationInheritanceRatio)),
    };

    // Rivalries are caused by explicit acts/relationships, never rolled as an
    // invented family backstory during the read-only inheritance preview.
    const disputes: string[] = [];

    const shares: Record<string, number> = {};
    const debtShares: Record<string, number> = {};
    const landShares: Record<string, FamilyLandPlotId[]> = Object.fromEntries(eligibleHeirIds.map(id => [id, []]));
    if (eligibleHeirIds.length > 0) {
      if (rule === 'partible') {
        const base = Math.floor(property.wealth / eligibleHeirIds.length);
        const remainder = property.wealth - base * eligibleHeirIds.length;
        for (const id of eligibleHeirIds) {
          shares[id] = base;
        }
        if (primaryHeirId) {
          shares[primaryHeirId] = (shares[primaryHeirId] ?? 0) + remainder;
        }
      } else if (primaryHeirId) {
        for (const id of eligibleHeirIds) {
          shares[id] = 0;
        }
        shares[primaryHeirId] = property.wealth;
      }
      if (rule === 'partible') {
        const baseDebt = Math.floor(property.debts / eligibleHeirIds.length);
        for (const id of eligibleHeirIds) debtShares[id] = baseDebt;
        if (primaryHeirId) debtShares[primaryHeirId] = baseDebt + property.debts - baseDebt * eligibleHeirIds.length;
      } else if (primaryHeirId) debtShares[primaryHeirId] = property.debts;
      if (this.config.landInheritanceRule === 'divided') {
        property.landPlots.forEach((plotId, index) => { const target = eligibleHeirIds[index % eligibleHeirIds.length]; if (target) landShares[target]?.push(plotId); });
      } else if (this.config.landInheritanceRule === 'shared') {
        for (const id of eligibleHeirIds) landShares[id] = [...property.landPlots];
      } else if (primaryHeirId) landShares[primaryHeirId] = [...property.landPlots];
    }

    const consequences: string[] = [];
    if (eligibleHeirIds.length === 0) {
      consequences.push('Geçerli bir varis bulunamadı.');
    } else {
      consequences.push(
        rule === 'partible'
          ? `Mülk ${eligibleHeirIds.length} varis arasında paylaştırılacak.`
          : `Mülk ${eligible[0]?.firstName ?? 'varis'} üzerinde toplanacak.`,
      );
      if (property.debts > 0) {
        consequences.push(`Devralınan borç: ${property.debts} akçe.`);
      }
    }

    return {
      deceasedId,
      eligibleHeirIds,
      primaryHeirId,
      shares,
      debtShares,
      landShares,
      property,
      consequences,
      disputes,
      gameOver: eligibleHeirIds.length === 0,
    };
  }

  beginSuccession(deceasedId: string, time: GameTime, reason: 'death' | 'retirement' = 'death'): PendingSuccession {
    const inheritance = this.resolveInheritance(deceasedId);
    this.pendingSuccession = {
      deceasedId,
      inheritance,
      year: time.year,
      reason,
    };
    return this.pendingSuccession;
  }

  /** Records an actual claimant challenge; previews never create random disputes. */
  contestSuccession(challengerId: string, year: number, reason: string): boolean {
    const pending = this.pendingSuccession;
    if (!pending || !pending.inheritance.eligibleHeirIds.includes(challengerId) || !reason.trim()) return false;
    pending.contestedBy ??= [];
    if (!pending.contestedBy.includes(challengerId)) pending.contestedBy.push(challengerId);
    const challenger = this.getMember(challengerId);
    const deceased = this.getMember(pending.deceasedId);
    if (challenger && deceased) {
      this.addHistory(challenger, year, 'choice', `Verasete hak iddia etti: ${reason}`);
      this.addLegacyRecord(year, 'political', 'Veraset hakkı talep edildi', `${challenger.firstName}, ${deceased.firstName}’in mirasına itiraz etti: ${reason}`, { memberId: challenger.id });
    }
    return true;
  }

  setHeirAvailability(memberId: string, available: boolean, reason?: string): boolean {
    const member = this.getMember(memberId);
    if (!member) return false;
    member.isAvailableForSuccession = available;
    member.successionUnavailableReason = available ? null : (reason?.trim() || 'Aileden uzakta');
    return true;
  }

  /** Confirms the player's chosen heir and transfers the estate. */
  selectSuccessor(heirId: string, time: GameTime): SuccessionOutcome {
    const pending = this.pendingSuccession;
    if (!pending) {
      return { success: false, heirId: null, message: 'Bekleyen bir veraset yok.', inheritance: null };
    }
    const inheritance = pending.inheritance;
    if (!inheritance.eligibleHeirIds.includes(heirId)) {
      return { success: false, heirId: null, message: 'Bu kişi geçerli bir varis değil.', inheritance };
    }
    const heir = this.getMember(heirId);
    const deceased = this.getMember(pending.deceasedId);
    if (!heir || !heir.isAlive || !deceased) {
      return { success: false, heirId: null, message: 'Varis bulunamadı.', inheritance };
    }

    const rule = this.config.inheritanceRule;
    const heirCount = Math.max(1, inheritance.eligibleHeirIds.length);
    const debtShare = inheritance.debtShares[heirId] ?? (rule === 'partible'
      ? Math.floor(inheritance.property.debts / heirCount)
      : inheritance.property.debts);
    const wealthShare = inheritance.shares[heirId] ?? inheritance.property.wealth;
    const heirLand = inheritance.landShares[heirId] ?? inheritance.property.landPlots;
    const contesters = (pending.contestedBy ?? []).filter(id => id !== heirId);
    const contestCost = contesters.length > 0 ? Math.min(wealthShare, Math.floor(inheritance.property.wealth * 0.1)) : 0;

    for (const member of this.family.members) {
      member.isPlayable = false;
    }
    heir.isPlayable = true;
    heir.wealth += wealthShare - contestCost;
    heir.debts += debtShare;
    heir.reputation += inheritance.property.familyReputation;
    heir.equipment = [...new Set([...heir.equipment, ...inheritance.property.equipment])];
    heir.landPlots = [...new Set([...heir.landPlots, ...heirLand])];

    // Partible inheritance gives every eligible heir their recorded share.
    if (rule === 'partible') {
      for (const otherId of inheritance.eligibleHeirIds) {
        if (otherId === heirId) continue;
        const other = this.getMember(otherId);
        if (!other) continue;
        other.wealth += inheritance.shares[otherId] ?? 0;
        other.debts += inheritance.debtShares[otherId] ?? Math.floor(inheritance.property.debts / heirCount);
        other.reputation += Math.floor(inheritance.property.familyReputation * 0.25);
        other.landPlots = [...new Set([...other.landPlots, ...(inheritance.landShares[otherId] ?? [])])];
        this.addHistory(other, time.year, 'succession', `${deceased.firstName}'in mirasından payını aldı.`);
      }
    }

    if (this.config.landInheritanceRule === 'shared') {
      for (const plotId of inheritance.property.landPlots) {
        const share = this.family.legacy.sharedLand.find(entry => entry.plotId === plotId);
        if (share) share.ownerMemberIds = [...new Set([...share.ownerMemberIds.filter(id => id !== deceased.id), ...inheritance.eligibleHeirIds])];
        else this.family.legacy.sharedLand.push({ plotId, ownerMemberIds: [...inheritance.eligibleHeirIds] });
      }
    } else {
      this.family.legacy.sharedLand = this.family.legacy.sharedLand.map(entry => ({ ...entry, ownerMemberIds: entry.ownerMemberIds.map(id => id === deceased.id ? heir.id : id).filter((id, index, ids) => ids.indexOf(id) === index) }));
    }

    for (const heirloom of this.family.legacy.heirlooms) {
      if (heirloom.currentHolderId === deceased.id || (!heirloom.currentHolderId && deceased.id === this.family.currentPlayableId)) {
        heirloom.currentHolderId = heir.id;
        heirloom.transfers += 1;
        // Extend provenance chain so descendants can read full ownership history.
        const provenanceLine = `${time.year}: ${deceased.firstName}'den ${heir.firstName}'e devredildi.`;
        (heirloom as HeirloomRecord).provenanceChain ??= [];
        (heirloom as HeirloomRecord).provenanceChain.push(provenanceLine);
        // Apply gameplay effect; magnitude decays 10% per transfer so no item grows unbounded.
        if (heirloom.effect && heirloom.effect.kind !== 'social_prestige') {
          const decayFactor = Math.max(0.5, 1 - heirloom.transfers * 0.1);
          const effectiveMag = Math.round(heirloom.effect.magnitude * decayFactor);
          switch (heirloom.effect.kind) {
            case 'reputation_bonus':
              heir.reputation = Math.max(0, Math.min(100, heir.reputation + effectiveMag));
              break;
            case 'skill_bonus': {
              const sk = heirloom.effect.targetKey as keyof typeof heir.skills | undefined;
              if (sk && sk in heir.skills) {
                heir.skills[sk] = Math.max(1, heir.skills[sk] + effectiveMag);
              }
              break;
            }
            case 'settlement_standing':
              if (heirloom.effect.targetKey) {
                this.updateFamilyRelationship('settlement', heirloom.effect.targetKey, effectiveMag);
              }
              break;
            case 'military_morale':
              heir.militaryService.medals = Math.max(0, heir.militaryService.medals + (effectiveMag > 0 ? 1 : 0));
              break;
            case 'debt_ward':
              heir.debts = Math.max(0, heir.debts - Math.abs(effectiveMag));
              break;
          }
        }
        this.addLegacyRecord(time.year, 'heirloom', 'Aile yadigârı devredildi', `${heirloom.itemId}, ${deceased.firstName} tarafından ${heir.firstName}’e aktarıldı. ${heirloom.context}`, { memberId: heir.id, targetId: heirloom.itemId });
      }
    }

    deceased.wealth = 0;
    deceased.debts = 0;
    deceased.equipment = [];
    deceased.landPlots = [];

    this.family.currentPlayableId = heir.id;
    heir.politicalRelationships = this.family.legacy.relationships
      .filter(entry => entry.kind === 'faction')
      .map(entry => ({ faction: entry.targetId, standing: entry.standing }));
    if (this.politicalLegacy !== 0) {
      heir.reputation = Math.max(0, Math.min(100, heir.reputation + Math.trunc(this.politicalLegacy / 4)));
      this.family.legacy.legacy.push(`Political legacy passed to ${heir.firstName}: ${this.politicalLegacy}.`);
    }
    this.family.legacy.generationsSurvived = Math.max(
      this.family.legacy.generationsSurvived,
      heir.generation,
    );
    this.family.legacy.reputationAcrossGenerations = Math.max(
      this.family.legacy.reputationAcrossGenerations,
      heir.reputation,
    );

    const consequence = `${heir.firstName} ${heir.familyName}, ${deceased.firstName}'in yerine ailenin yeni reisi oldu.`;
    this.family.legacy.legacy.push(consequence);
    this.addHistory(heir, time.year, 'succession', consequence);
    this.addLegacyRecord(time.year, 'succession', 'Aile reisliği devredildi', consequence, { memberId: heir.id, value: inheritance.property.wealth });
    if (inheritance.property.debts > 0) this.addLegacyRecord(time.year, 'debt', 'Borç miras kaldı', `${heir.firstName}, ${debtShare} akçe borç üstlendi.`, { memberId: heir.id, value: debtShare });
    for (const line of inheritance.consequences) {
      this.addHistory(heir, time.year, 'succession', line);
    }
    for (const line of inheritance.disputes) {
      this.addHistory(heir, time.year, 'rivalry', line);
    }
    for (const challengerId of contesters) {
      const challenger = this.getMember(challengerId);
      if (!challenger) continue;
      this.addRelationship(heir, challenger.id, 'rival', -25, time.year);
      this.addRelationship(challenger, heir.id, 'rival', -25, time.year);
      this.recordRivalry(challenger.id, 15, time.year);
      this.addHistory(challenger, time.year, 'rivalry', `${heir.firstName}’in aile reisliğini kabul etmedi; veraset anlaşmazlığı sürdü.`);
      this.addLegacyRecord(time.year, 'rivalry', 'Veraset anlaşmazlığı', `${challenger.firstName}, ${heir.firstName}’in seçilmesine itiraz etti; uzlaşma ve muhafaza masrafı ${contestCost} akçe oldu.`, { memberId: challenger.id, value: contestCost });
    }

    if (this.bridge) {
      this.bridge.apply(
        {
          wealth: wealthShare - contestCost,
          debts: debtShare,
          equipment: [...inheritance.property.equipment],
          landPlots: [...heirLand],
          familyReputation: inheritance.property.familyReputation,
        },
        heir,
        this.family,
      );
    }

    // Snapshot the generation's state for descendants to read later.
    this.writeGenerationSnapshot(deceased, heir, time.year, inheritance);

    this.pendingSuccession = null;
    return { success: true, heirId, message: consequence, inheritance };
  }

  /** Explicit restart when the family has no heir left. Never invents one silently. */
  startNewFamily(time: GameTime, familyName?: string): FamilyMember {
    this.family = {
      id: `family_${this.nextMemberNumber}`,
      name: familyName ?? randomFamilyName(this.rng),
      founderId: '',
      currentPlayableId: null,
      members: [],
      worldPopulation: 40,
      foundedYear: time.year,
      legacy: emptyLegacy(),
    };
    this.pendingSuccession = null;
    this.lastProcessedYear = time.year;
    return this.createFounder(time);
  }

  // ---------------------------------------------------------------------
  // Legacy records
  // ---------------------------------------------------------------------

  recordLandChange(delta: number, description: string, year: number): void {
    if (delta > 0) {
      this.family.legacy.landAcquired += delta;
    } else if (delta < 0) {
      this.family.legacy.landLost += Math.abs(delta);
    }
    this.family.legacy.legacy.push(`${year}: ${description}`);
    if (delta !== 0) this.addLegacyRecord(year, delta > 0 ? 'land_acquired' : 'land_lost', delta > 0 ? 'Arazi hakkı kazanıldı' : 'Arazi hakkı kaybedildi', description, { memberId: this.getCurrentMember()?.id ?? null, value: Math.abs(delta) });
  }

  recordMilitaryAchievement(description: string, year: number): void {
    this.family.legacy.militaryAchievements += 1;
    this.family.legacy.legacy.push(`${year}: ${description}`);
    const current = this.getCurrentMember();
    if (current) {
      this.addHistory(current, year, 'military', description);
    }
    this.addLegacyRecord(year, 'military', 'Askerî hizmet', description, { memberId: current?.id ?? null });
  }

  recordImportantChoice(description: string, year: number): void {
    this.family.legacy.importantChoices.push(`${year}: ${description}`);
    this.family.legacy.legacy.push(`${year}: ${description}`);
    const current = this.getCurrentMember();
    if (current) {
      this.addHistory(current, year, 'choice', description);
    }
    this.addLegacyRecord(year, 'political', 'Ailenin kararı', description, { memberId: current?.id ?? null });
  }

  recordHistoricalEvent(eventName: string, year: number): void {
    this.family.legacy.historicalEventsInfluenced.push(`${year}: ${eventName}`);
    this.family.legacy.legacy.push(`${year}: ${eventName} olayında ailenin adı geçti.`);
    this.addLegacyRecord(year, 'historical', 'Tarihsel olay kaydı', `${eventName} sırasında ailenin etkisi kaydedildi.`, { memberId: this.getCurrentMember()?.id ?? null });
  }

  recordRivalry(familyId: string, intensity: number, year = this.lastProcessedYear): void {
    const existing = this.family.legacy.rivalries.find((entry) => entry.familyId === familyId);
    if (existing) {
      existing.intensity = Math.min(100, existing.intensity + intensity);
    } else {
      this.family.legacy.rivalries.push({ familyId, intensity: Math.min(100, intensity) });
    }
    this.updateFamilyRelationship('family', familyId, -Math.abs(intensity));
    this.addLegacyRecord(year, 'rivalry', 'Aileler arası husumet', `${familyId} ile husumet ${intensity} arttı.`, { targetId: familyId, value: intensity });
  }

  recordAlliance(familyId: string, strength: number, year = this.lastProcessedYear): void {
    const existing = this.family.legacy.alliances.find((entry) => entry.familyId === familyId);
    if (existing) {
      existing.strength = Math.min(100, existing.strength + strength);
    } else {
      this.family.legacy.alliances.push({ familyId, strength: Math.min(100, strength) });
    }
    this.updateFamilyRelationship('family', familyId, Math.abs(strength));
    this.addLegacyRecord(year, 'alliance', 'Aile ittifakı', `${familyId} ile ittifak ${strength} güçlendi.`, { targetId: familyId, value: strength });
  }

  recordDebtChange(delta: number, description: string, year: number, memberId = this.getCurrentMember()?.id ?? null): void {
    const member = memberId ? this.getMember(memberId) : null;
    if (member) member.debts = Math.max(0, member.debts + Math.trunc(delta));
    this.addLegacyRecord(year, 'debt', delta >= 0 ? 'Borç üstlenildi' : 'Borç ödendi', description, { memberId, value: Math.abs(delta) });
  }

  recordPoliticalCommitment(description: string, year: number, factionId?: string, standingChange = 0): void {
    this.family.legacy.politicalCommitments.push(`${year}: ${description}`);
    if (factionId) this.updateFamilyRelationship('faction', factionId, standingChange);
    this.addLegacyRecord(year, 'political', 'Siyasi taahhüt', description, { memberId: this.getCurrentMember()?.id ?? null, ...(factionId ? { targetId: factionId } : {}), value: standingChange });
  }

  updateFamilyRelationship(kind: 'settlement' | 'faction' | 'family', targetId: string, delta: number): void {
    const relationship = this.family.legacy.relationships.find(entry => entry.kind === kind && entry.targetId === targetId);
    if (relationship) relationship.standing = Math.max(-100, Math.min(100, relationship.standing + Math.trunc(delta)));
    else this.family.legacy.relationships.push({ kind, targetId, standing: Math.max(-100, Math.min(100, Math.trunc(delta))) });
  }

  designateHeirloom(itemId: string, context: string, year: number, effect?: HeirloomEffect): boolean {
    const current = this.getCurrentMember();
    if (!current || !itemId.trim() || !context.trim()) return false;
    const ownedItems = this.bridge ? this.readAssets(current).equipment : current.equipment;
    if (!ownedItems.includes(itemId)) return false;
    const existing = this.family.legacy.heirlooms.find(item => item.itemId === itemId);
    if (existing) return existing.currentHolderId === current.id;
    // Cap the effect magnitude to prevent unbounded power escalation.
    let boundedEffect: HeirloomEffect | undefined;
    if (effect) {
      const cap = HEIRLOOM_EFFECT_CAPS[effect.kind];
      boundedEffect = {
        ...effect,
        magnitude: Math.min(Math.abs(effect.magnitude), cap) * Math.sign(effect.magnitude),
      };
    }
    const item: HeirloomRecord = {
      itemId,
      originMemberId: current.id,
      originYear: year,
      context,
      currentHolderId: current.id,
      transfers: 0,
      ...(boundedEffect ? { effect: boundedEffect } : {}),
      provenanceChain: [`${year}: ${current.firstName} tarafından aile yadigârı ilan edildi.`],
    };
    this.family.legacy.heirlooms.push(item);
    this.addLegacyRecord(year, 'heirloom', 'Aile yadigârı seçildi', `${itemId}, ${current.firstName} tarafından aile yadigârı ilan edildi. ${context}`, { memberId: current.id, targetId: itemId });
    return true;
  }

  recordTradition(title: string, year: number, sourceRecordId: string): boolean {
    const source = this.family.legacy.records.find(record => record.id === sourceRecordId);
    if (!source || !title.trim() || this.family.legacy.traditions.some(tradition => tradition.title === title)) return false;
    const current = this.getCurrentMember();
    const id = `tradition_${this.family.legacy.traditions.length + 1}`;
    this.family.legacy.traditions.push({ id, title, originYear: year, originMemberId: source.memberId ?? current?.id ?? '', sourceRecordId });
    this.addLegacyRecord(year, 'tradition', 'Aile geleneği oluştu', `${title}; ${source.title} olayından doğdu.`, { memberId: current?.id ?? null, targetId: sourceRecordId });
    return true;
  }

  setInheritanceRule(rule: FamilyConfig['inheritanceRule']): void {
    this.config.inheritanceRule = rule;
  }

  setInheritancePolicy(policyId: string, context?: Partial<FamilyConfig['inheritanceContext']>): boolean {
    const policy = INHERITANCE_POLICIES[policyId];
    if (!policy) return false;
    this.config = { ...this.config, ...policy, inheritancePolicyId: policyId, inheritanceContext: { ...this.config.inheritanceContext, ...(context ?? {}) } };
    return true;
  }

  // ---------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------

  getFamily(): Family {
    return this.family;
  }

  getConfig(): FamilyConfig {
    return { ...this.config };
  }

  getMember(memberId: string): FamilyMember | null {
    return this.family.members.find((member) => member.id === memberId) ?? null;
  }

  getMembers(): FamilyMember[] {
    return [...this.family.members];
  }

  getCurrentMember(): FamilyMember | null {
    if (!this.family.currentPlayableId) return null;
    return this.getMember(this.family.currentPlayableId);
  }

  getCurrentCharacter(): FamilyMember | null {
    return this.getCurrentMember();
  }

  getLivingMembers(): FamilyMember[] {
    return this.family.members.filter((member) => member.isAlive);
  }

  getPendingSuccession(): PendingSuccession | null {
    return this.pendingSuccession;
  }

  getEligibleHeirs(): FamilyMember[] {
    const pending = this.pendingSuccession;
    if (!pending) return [];
    return pending.inheritance.eligibleHeirIds
      .map((id) => this.getMember(id))
      .filter((member): member is FamilyMember => member !== null && member.isAlive);
  }

  /** Family grouped by generation for the tree screen. */
  getFamilyTree(): FamilyMember[][] {
    const generations = new Map<number, FamilyMember[]>();
    for (const member of this.family.members) {
      const list = generations.get(member.generation) ?? [];
      list.push(member);
      generations.set(member.generation, list);
    }
    return [...generations.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([, members]) =>
        members.sort(
          (a, b) =>
            a.birthDate.year - b.birthDate.year ||
            a.firstName.localeCompare(b.firstName, 'tr'),
        ),
      );
  }

  getLegacy(): Family['legacy'] {
    return this.family.legacy;
  }

  getLegacyRecords(): Family['legacy']['records'] { return [...this.family.legacy.records]; }

  setPoliticalLegacy(value: number): void { this.politicalLegacy = Math.max(-100, Math.min(100, Math.round(value))); }
  getPoliticalLegacy(): number { return this.politicalLegacy; }

  getAliveHeirCount(): number {
    const current = this.getCurrentMember();
    if (!current) return 0;
    return current.childrenIds
      .map((id) => this.getMember(id))
      .filter((member): member is FamilyMember => !!member && member.isAlive && member.age >= this.config.heirMinAge)
      .length;
  }

  // ---------------------------------------------------------------------
  // World context and successor queries
  // ---------------------------------------------------------------------

  /** Returns the generational snapshots recorded at each succession. */
  getGenerationSnapshots(): GenerationSnapshot[] {
    return [...(this.family.legacy.generationSnapshots ?? [])];
  }

  /**
   * Builds the world context a successor inherits: reputation modifier,
   * outstanding debt, settlement standings, active heirloom effects, goals
   * and challenges derived from real legacy events. Never invents content.
   */
  getSuccessorWorldContext(heirId: string): SuccessorWorldContext {
    const legacy = this.family.legacy;
    const heir = this.getMember(heirId);

    // Reputation modifier: family standing at this moment (can be negative).
    const reputationModifier = Math.round(legacy.reputationAcrossGenerations * 0.25);

    // Active heirloom effects for this heir.
    const heirloomEffects: HeirloomEffect[] = [];
    for (const h of legacy.heirlooms) {
      if (h.currentHolderId === heirId && h.effect) {
        const decayFactor = Math.max(0.5, 1 - h.transfers * 0.1);
        const effectiveMag = Math.round(h.effect.magnitude * decayFactor);
        heirloomEffects.push({ ...h.effect, magnitude: effectiveMag });
      }
    }

    // Reduce debt by debt_ward effects.
    const debtWardTotal = heirloomEffects
      .filter(e => e.kind === 'debt_ward')
      .reduce((sum, e) => sum + Math.abs(e.magnitude), 0);
    const inheritedDebt = Math.max(0, (heir?.debts ?? 0) - debtWardTotal);

    // Inherited standings from family relationships.
    const inheritedStandings = legacy.relationships.map(r => ({ ...r }));

    // Goals from unresolved debts, traditions, and land obligations.
    const inheritedGoals: InheritedGoal[] = [];
    const debtGoalRecords = legacy.records.filter(r => r.kind === 'debt' && (r.value ?? 0) > 0);
    for (const rec of debtGoalRecords.slice(0, 3)) {
      inheritedGoals.push({
        id: `goal_debt_${rec.id}`,
        title: 'Aile Borcunu Ode',
        description: rec.description,
        sourceRecordId: rec.id,
        ...(rec.value !== undefined ? { targetValue: rec.value } : {}),
        kind: 'debt',
      });
    }
    for (const trad of legacy.traditions.slice(0, 2)) {
      const sourceRec = legacy.records.find(r => r.id === trad.sourceRecordId);
      if (sourceRec) {
        inheritedGoals.push({
          id: `goal_trad_${trad.id}`,
          title: `Gelenegi Surdu: ${trad.title}`,
          description: sourceRec.description,
          sourceRecordId: sourceRec.id,
          kind: 'tradition',
        });
      }
    }
    const landAcqRecords = legacy.records.filter(r => r.kind === 'land_acquired').slice(-2);
    for (const rec of landAcqRecords) {
      inheritedGoals.push({
        id: `goal_land_${rec.id}`,
        title: 'Arazileri Koru',
        description: rec.description,
        sourceRecordId: rec.id,
        kind: 'land',
      });
    }

    // Challenges from rivalries and contested successions.
    const inheritedChallenges: InheritedChallenge[] = [];
    for (const rivalry of legacy.rivalries.slice(0, 3)) {
      const rivalryRec = legacy.records.find(r => r.kind === 'rivalry' && r.targetId === rivalry.familyId);
      if (rivalryRec) {
        inheritedChallenges.push({
          id: `chal_rivalry_${rivalry.familyId}`,
          title: `${rivalry.familyId} Husumeti`,
          description: rivalryRec.description,
          sourceRecordId: rivalryRec.id,
          kind: 'rivalry',
          severity: rivalry.intensity >= 60 ? 'major' : rivalry.intensity >= 30 ? 'moderate' : 'minor',
        });
      }
    }
    const contestedRecs = legacy.records.filter(r => r.kind === 'rivalry' && r.title.includes('anla'));
    for (const rec of contestedRecs.slice(0, 2)) {
      inheritedChallenges.push({
        id: `chal_contest_${rec.id}`,
        title: 'Tartismali Veraset',
        description: rec.description,
        sourceRecordId: rec.id,
        kind: 'contested_succession',
        severity: 'moderate',
      });
    }

    return {
      reputationModifier,
      inheritedDebt,
      inheritedStandings,
      heirloomEffects,
      inheritedGoals,
      inheritedChallenges,
    };
  }

  /**
   * Marks a land plot as lost due to political consequences. Records this in
   * the legacy so descendants can read why the land is gone.
   */
  recordPoliticalLandLoss(plotId: FamilyLandPlotId, reason: string, year: number): void {
    const current = this.getCurrentMember();
    if (current) {
      current.landPlots = current.landPlots.filter(p => p !== plotId);
    }
    this.family.legacy.landLost += 1;
    const desc = `Arazi (${String(plotId)}) siyasi sonuc nedeniyle kaybedildi: ${reason}`;
    this.family.legacy.legacy.push(`${year}: ${desc}`);
    this.addLegacyRecord(year, 'land_lost', 'Siyasi Arazi Kaybi', desc, {
      memberId: current?.id ?? null,
      targetId: String(plotId),
    });
  }

  /**
   * Marks an heir as missing or unavailable; reason appears in the succession
   * panel and family legacy records.
   */
  markHeirMissing(memberId: string, reason: string, year: number): boolean {
    const ok = this.setHeirAvailability(memberId, false, reason);
    if (!ok) return false;
    const member = this.getMember(memberId);
    if (member) {
      this.addHistory(member, year, 'other', `Verasetten dislandir: ${reason}`);
      this.addLegacyRecord(year, 'succession', 'Varis Kullanilamiyor', `${member.firstName}: ${reason}`, { memberId });
    }
    return true;
  }

  // ---------------------------------------------------------------------
  // Persistence
  // ---------------------------------------------------------------------

  serialize(): FamilySaveState {
    return {
      version: FAMILY_SAVE_VERSION,
      family: JSON.parse(JSON.stringify(this.family)) as Family,
      config: { ...this.config },
      nextMemberNumber: this.nextMemberNumber,
      lastProcessedYear: this.lastProcessedYear,
      pendingSuccession: this.pendingSuccession
        ? (JSON.parse(JSON.stringify(this.pendingSuccession)) as PendingSuccession)
        : null,
      savedAt: Date.now(),
      politicalLegacy: this.politicalLegacy,
    };
  }

  deserialize(data: FamilySaveState | null | undefined): void {
    if (!data || !data.family || !Array.isArray(data.family.members)) return;
    this.family = JSON.parse(JSON.stringify(data.family)) as Family;
    const seenIds = new Set<string>();
    this.family.members = this.family.members.filter(member => {
      if (!member?.id || seenIds.has(member.id)) return false;
      seenIds.add(member.id);
      return true;
    });
    for (const member of this.family.members) {
      member.appearance ??= this.randomAppearance();
      member.visuals = normalizeCharacterVisuals(member.visuals ?? DEFAULT_CHARACTER_VISUALS, member.gender);
      member.retirementDate ??= null;
      member.childrenIds ??= [];
      member.relationships ??= [];
      member.personalHistory ??= [];
      member.childrenIds = [...new Set(member.childrenIds)].filter(id => seenIds.has(id));
      member.relationships = member.relationships.filter(link => seenIds.has(link.targetId));
      if (member.fatherId && !seenIds.has(member.fatherId)) member.fatherId = null;
      if (member.motherId && !seenIds.has(member.motherId)) member.motherId = null;
      if (member.spouseId && !seenIds.has(member.spouseId)) member.spouseId = null;
    }
    for (const member of this.family.members) {
      member.childrenIds = member.childrenIds.filter(childId => {
        const child = this.family.members.find(candidate => candidate.id === childId);
        return !!child && (child.fatherId === member.id || child.motherId === member.id);
      });
      const spouse = member.spouseId ? this.family.members.find(candidate => candidate.id === member.spouseId) : null;
      if (member.spouseId && spouse?.spouseId !== member.id) member.spouseId = null;
    }
    if (this.family.currentPlayableId && !seenIds.has(this.family.currentPlayableId)) this.family.currentPlayableId = null;
    this.family.members.forEach(member => { member.isPlayable = member.id === this.family.currentPlayableId && member.isAlive; });
    this.family.legacy = { ...emptyLegacy(), ...(this.family.legacy ?? {}) };
    this.family.legacy.records ??= [];
    this.family.legacy.politicalCommitments ??= [];
    this.family.legacy.traditions ??= [];
    this.family.legacy.heirlooms ??= [];
    this.family.legacy.relationships ??= [];
    this.family.legacy.sharedLand ??= [];
    this.family.legacy.generationSnapshots ??= [];
    // Hydrate provenance chains missing from v1/v2 saves.
    for (const h of this.family.legacy.heirlooms) {
      (h as HeirloomRecord).provenanceChain ??= [];
    }
    this.legacySequence = this.family.legacy.records.length;
    this.config = { ...DEFAULT_FAMILY_CONFIG, ...(data.config ?? {}), inheritanceContext: { ...DEFAULT_FAMILY_CONFIG.inheritanceContext, ...(data.config?.inheritanceContext ?? {}) } };
    this.nextMemberNumber = Math.max(1, data.nextMemberNumber ?? 1);
    this.lastProcessedYear = data.lastProcessedYear ?? this.family.foundedYear;
    this.pendingSuccession = data.pendingSuccession && seenIds.has(data.pendingSuccession.deceasedId)
      ? (() => {
          const pending = JSON.parse(JSON.stringify(data.pendingSuccession)) as PendingSuccession;
          const eligible = pending.inheritance.eligibleHeirIds.filter(id => seenIds.has(id));
          pending.inheritance.eligibleHeirIds = eligible;
          if (!eligible.includes(pending.inheritance.primaryHeirId ?? '')) pending.inheritance.primaryHeirId = eligible[0] ?? null;
          if (pending.contestedBy) pending.contestedBy = pending.contestedBy.filter(id => eligible.includes(id));
          for (const table of [pending.inheritance.shares, pending.inheritance.debtShares, pending.inheritance.landShares]) {
            for (const id of Object.keys(table)) if (!eligible.includes(id)) delete table[id];
          }
          pending.inheritance.gameOver = eligible.length === 0;
          return pending;
        })()
      : null;
    this.politicalLegacy = (data as FamilySaveState & { politicalLegacy?: number }).politicalLegacy ?? 0;
  }

  // ---------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------

  private buildMember(input: {
    firstName: string;
    familyName: string;
    gender: Gender;
    appearance: FamilyMember['appearance'];
    visuals?: CharacterVisuals;
    birthYear: number;
    birthDate?: FamilyMember['birthDate'];
    referenceDate?: FamilyMember['birthDate'];
    generation: number;
    traits: CharacterTrait[];
    stats: CharacterStats;
    reputation: number;
    wealth: number;
  }): FamilyMember {
    const id = `member_${this.nextMemberNumber}`;
    this.nextMemberNumber += 1;
    const birthDate = input.birthDate ?? createGameDate(input.birthYear, 3, 1);
    const age = input.referenceDate ? ageAtDate(birthDate, input.referenceDate) : Math.max(0, this.lastProcessedYear - input.birthYear);
    return {
      id,
      firstName: input.firstName,
      familyName: input.familyName,
      gender: input.gender,
      appearance: input.appearance,
      ...(input.visuals ? { visuals: normalizeCharacterVisuals(input.visuals, input.gender) } : {}),
      birthDate,
      deathDate: null,
      retirementDate: null,
      causeOfDeath: null,
      age,
      lifeStage: lifeStageForAge(age),
      isAlive: true,
      isPlayable: false,
      generation: input.generation,
      traits: [...input.traits],
      skills: { ...input.stats },
      reputation: input.reputation,
      militaryService: createMilitaryService(),
      landPlots: [],
      equipment: [],
      wealth: input.wealth,
      debts: 0,
      health: 100,
      maxHealth: 100,
      fatherId: null,
      motherId: null,
      spouseId: null,
      childrenIds: [],
      relationships: [],
      politicalRelationships: [],
      personalHistory: [],
    };
  }

  private randomAppearance(): FamilyMember['appearance'] {
    const choices: FamilyMember['appearance'][] = ['Çiftçi', 'Akıncı', 'Kervancı'];
    return choices[Math.floor(this.rng() * choices.length)] ?? 'Çiftçi';
  }

  private canAddFamilyMember(): boolean {
    return this.getLivingMembers().length < this.config.maxFamilyMembers;
  }

  private canGenerateOutsideCharacter(): boolean {
    return this.family.worldPopulation < this.config.maxWorldPopulation;
  }

  private averageStats(a: CharacterStats, b: CharacterStats): CharacterStats {
    return {
      farming: Math.round((a.farming + b.farming) / 2),
      combat: Math.round((a.combat + b.combat) / 2),
      trade: Math.round((a.trade + b.trade) / 2),
      leadership: Math.round((a.leadership + b.leadership) / 2),
      craftsmanship: Math.round((a.craftsmanship + b.craftsmanship) / 2),
      diplomacy: Math.round((a.diplomacy + b.diplomacy) / 2),
    };
  }

  private sameTraits(a: CharacterTrait[], b: CharacterTrait[]): boolean {
    if (a.length !== b.length) return false;
    const sortedA = [...a].sort();
    const sortedB = [...b].sort();
    return sortedA.every((trait, index) => trait === sortedB[index]);
  }

  /**
   * Records a permanent snapshot of the family's state at the moment a
   * successor is chosen. Stored in legacy.generationSnapshots so descendants
   * can browse how the world looked when their ancestor ruled.
   */
  private writeGenerationSnapshot(
    deceased: FamilyMember,
    heir: FamilyMember,
    year: number,
    inheritance: InheritanceResult,
  ): void {
    const legacy = this.family.legacy;
    const activeAlliances = [
      ...legacy.alliances.map(a => a.familyId),
      ...legacy.relationships.filter(r => r.standing > 20).map(r => r.targetId),
    ].slice(0, 5);
    const activeRivalries = [
      ...legacy.rivalries.map(r => r.familyId),
      ...legacy.relationships.filter(r => r.standing < -20).map(r => r.targetId),
    ].slice(0, 5);
    const notableEvents = legacy.legacy.slice(-6).map(line => line.replace(/^\d+: /, ''));
    const heirloomsTransferred = legacy.heirlooms
      .filter(h => h.currentHolderId === heir.id && h.transfers > 0)
      .map(h => h.itemId);
    const politicalCommitments = legacy.politicalCommitments.slice(-3);
    const snapshot: GenerationSnapshot = {
      generation: deceased.generation,
      year,
      reigningMemberId: deceased.id,
      reigningMemberName: `${deceased.firstName} ${deceased.familyName}`,
      wealthAtSuccession: inheritance.property.wealth,
      debtAtSuccession: inheritance.property.debts,
      landCount: inheritance.property.landPlots.length,
      reputation: inheritance.property.familyReputation,
      activeAlliances,
      activeRivalries,
      notableEvents,
      heirloomsTransferred,
      politicalCommitments,
      relationshipStandings: legacy.relationships.map(r => ({ ...r })),
    };
    legacy.generationSnapshots ??= [];
    legacy.generationSnapshots.push(snapshot);
  }

  private readAssets(deceased: FamilyMember): InheritedProperty {
    if (this.bridge) {
      return this.bridge.read(this.family, deceased);
    }
    return {
      wealth: deceased.wealth,
      debts: deceased.debts,
      equipment: [...deceased.equipment],
      landPlots: [...deceased.landPlots],
      familyReputation: deceased.reputation,
    };
  }

  private addRelationship(
    member: FamilyMember,
    targetId: string,
    type: FamilyRelationship['type'],
    strength: number,
    year: number,
  ): void {
    const existing = member.relationships.find((rel) => rel.targetId === targetId && rel.type === type);
    if (existing) {
      existing.strength = Math.min(100, Math.max(-100, existing.strength + strength));
      return;
    }
    member.relationships.push({ targetId, type, strength, sinceYear: year });
  }

  private addHistory(
    member: FamilyMember,
    year: number,
    kind: HistoryKind,
    text: string,
  ): void {
    member.personalHistory.push({
      year,
      age: member.age,
      kind,
      text,
    });
    // Keep personal records bounded even for long-lived dynasties.
    if (member.personalHistory.length > 40) {
      member.personalHistory.splice(0, member.personalHistory.length - 40);
    }
  }

  private addLegacyRecord(
    year: number,
    kind: Family['legacy']['records'][number]['kind'],
    title: string,
    description: string,
    details: { memberId?: string | null; targetId?: string; value?: number } = {},
  ): Family['legacy']['records'][number] {
    const member = details.memberId ? this.getMember(details.memberId) : this.getCurrentMember();
    this.legacySequence += 1;
    const record: Family['legacy']['records'][number] = {
      id: `legacy_${year}_${this.legacySequence}`,
      year,
      generation: member?.generation ?? this.family.legacy.generationsSurvived,
      memberId: details.memberId === undefined ? member?.id ?? null : details.memberId,
      kind,
      title,
      description,
      ...(details.targetId ? { targetId: details.targetId } : {}),
      ...(details.value !== undefined ? { value: details.value } : {}),
    };
    this.family.legacy.records.push(record);
    return record;
  }

  private event(
    type: FamilyEvent['type'],
    member: FamilyMember | null,
    year: number,
    message: string,
  ): FamilyEvent {
    return {
      type,
      memberId: member?.id ?? null,
      year,
      message,
    };
  }

  /** Utility for tests and scripted events: grants traits not already held. */
  grantTrait(memberId: string, trait?: CharacterTrait): CharacterTrait | null {
    const member = this.getMember(memberId);
    if (!member) return null;
    const chosen = trait ?? randomTrait(this.rng);
    if (!member.traits.includes(chosen)) {
      member.traits.push(chosen);
      member.skills = applyTraitModifiers(member.traits, member.skills);
    }
    return chosen;
  }
}
