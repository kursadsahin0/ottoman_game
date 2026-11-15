import { PROFESSION_DEFINITIONS, PROFESSION_XP_PER_LEVEL, type ProfessionActivity, type ProfessionId } from '@data/ProfessionData';

export interface ProfessionSkillState { level: number; experience: number; reputation: number; activities: number }
export interface ProfessionSaveState { version: 1; characterId: string | null; skills: Partial<Record<ProfessionId, ProfessionSkillState>>; fatigue: number; hoeCondition: number; lastDay: number; lastMentorDay: number; dailyXp: Partial<Record<ProfessionId, number>>; rewardedActions: string[]; mentors: string[] }

/** Progression is earned from successful simulation outcomes, never UI clicks. */
export class ProfessionSystem {
  private state: ProfessionSaveState = { version: 1, characterId: null, skills: {}, fatigue: 0, hoeCondition: 100, lastDay: 0, lastMentorDay: -30, dailyXp: {}, rewardedActions: [], mentors: [] };
  private changed: ((profession: ProfessionId, level: number) => void) | undefined;
  constructor(characterId: string | null = null, changed?: (profession: ProfessionId, level: number) => void) { this.state.characterId = characterId; this.changed = changed; }

  getSkill(id: ProfessionId): ProfessionSkillState { return { ...(this.state.skills[id] ?? { level: 1, experience: 0, reputation: 0, activities: 0 }) }; }
  getFatigue(): number { return this.state.fatigue; }
  getHoeCondition(): number { return this.state.hoeCondition; }
  getKnownProfessions(): ProfessionId[] { return Object.keys(this.state.skills) as ProfessionId[]; }

  canWork(activity: ProfessionActivity, day: number): { ok: boolean; message?: string } {
    this.advanceDay(day);
    if (this.state.fatigue >= 90) return { ok: false, message: 'Çok yoruldunuz; dinlenmeden çalışamazsınız.' };
    const definition = PROFESSION_DEFINITIONS.farming.activities[activity];
    if (activity === 'prepare' && this.state.hoeCondition <= 0) return { ok: false, message: 'Çapanız kırık; demircide onarın.' };
    if (!definition) return { ok: false, message: 'Bu etkinlik tanımlı değil.' };
    return { ok: true };
  }

  recordActivity(profession: ProfessionId, activity: ProfessionActivity, sourceId: string, day: number): number {
    this.advanceDay(day);
    const def = PROFESSION_DEFINITIONS[profession].activities[activity];
    if (!def || this.state.fatigue >= 90) return 0;
    const key = `${day}:${profession}:${activity}:${sourceId}`;
    if (this.state.rewardedActions.includes(key)) return 0;
    this.state.rewardedActions.push(key);
    if (this.state.rewardedActions.length > 128) this.state.rewardedActions.splice(0, this.state.rewardedActions.length - 128);
    const before = this.getSkill(profession);
    const daily = this.state.dailyXp[profession] ?? 0;
    const amount = Math.min(def.xp, Math.max(0, 40 - daily));
    const skill = this.state.skills[profession] ??= { level: 1, experience: 0, reputation: 0, activities: 0 };
    skill.activities += 1;
    skill.experience += amount;
    this.state.dailyXp[profession] = daily + amount;
    this.state.fatigue = Math.min(100, this.state.fatigue + def.fatigue);
    if (profession === 'farming' && activity === 'prepare') this.state.hoeCondition = Math.max(0, this.state.hoeCondition - 1);
    while (skill.level < 10 && skill.experience >= PROFESSION_XP_PER_LEVEL(skill.level)) {
      skill.experience -= PROFESSION_XP_PER_LEVEL(skill.level);
      skill.level += 1;
    }
    if (skill.level > before.level) this.changed?.(profession, skill.level);
    return amount;
  }

  /** Pay a real tuition fee once per character and profession to learn from an available master. */
  learnFromMentor(profession: ProfessionId, mentorId: string, mentorOccupation: string, day: number, pay: (amount: number) => boolean): boolean {
    this.advanceDay(day);
    const def = PROFESSION_DEFINITIONS[profession];
    const key = `${this.state.characterId ?? 'unknown'}:${profession}:${mentorId}`;
    if (!def.occupationIds.includes(mentorOccupation) || this.getSkill(profession).level >= 3 || this.state.mentors.includes(key) || day - this.state.lastMentorDay < 30 || (this.state.dailyXp[profession] ?? 0) >= 40 || !pay(12)) return false;
    this.state.mentors.push(key);
    this.state.lastMentorDay = day;
    const skill = this.state.skills[profession] ??= { level: 1, experience: 0, reputation: 0, activities: 0 };
    const xp = Math.min(45, 40 - (this.state.dailyXp[profession] ?? 0));
    skill.experience += xp;
    this.state.dailyXp[profession] = (this.state.dailyXp[profession] ?? 0) + xp;
    skill.activities += 1;
    this.promote(profession);
    return true;
  }

  /** A completed sale/purchase earns capped trade practice and modest trust. */
  recordTrade(kind: 'buy' | 'sell', itemId: string, quantity: number, day: number): void {
    const xp = Math.min(8, Math.max(1, Math.floor(quantity / 2) + (kind === 'sell' ? 2 : 0)));
    this.recordExternalXp('trade', `trade_${kind}`, `${itemId}:${day}:${this.getSkill('trade').activities}`, day, xp);
    const trade = this.state.skills.trade;
    if (trade && kind === 'sell' && quantity >= 3) trade.reputation = Math.min(100, trade.reputation + 1);
  }

  getTradeDiscount(): number { const skill=this.getSkill('trade'); return Math.min(0.1, Math.max(0, skill.level - 1) * 0.0125 + skill.reputation * 0.00025); }
  getHarvestBonus(): number { return this.getSkill('farming').level >= 4 ? 1 : 0; }
  getFatigueCost(activity: ProfessionActivity): number { const base = PROFESSION_DEFINITIONS.farming.activities[activity]?.fatigue ?? 0; return this.getSkill('farming').level >= 7 ? Math.max(1, base - 2) : base; }
  repairHoe(day: number, pay: (amount: number) => boolean): boolean {
    this.advanceDay(day);
    if (this.state.hoeCondition >= 100 || !pay(8)) return false;
    this.state.hoeCondition = 100;
    this.recordExternalXp('smithing', 'smith', `hoe:${day}`, day, 12);
    this.state.fatigue = Math.min(100, this.state.fatigue + 4);
    return true;
  }
  resetForCharacter(characterId: string): void { this.state = { version: 1, characterId, skills: {}, fatigue: 0, hoeCondition: 100, lastDay: this.state.lastDay, lastMentorDay: this.state.lastDay - 30, dailyXp: {}, rewardedActions: [], mentors: [] }; }

  inheritKnowledge(previousCharacterId: string, nextCharacterId: string): void {
    const old = this.state.skills;
    const inherited: ProfessionSaveState['skills'] = {};
    for (const [id, skill] of Object.entries(old) as Array<[ProfessionId, ProfessionSkillState]>) {
      if (skill.level < 3) continue;
      inherited[id] = { level: 1, experience: Math.min(50, Math.floor(skill.experience * 0.2) + 20), reputation: Math.floor(skill.reputation * 0.25), activities: 0 };
    }
    this.state = { version: 1, characterId: nextCharacterId, skills: inherited, fatigue: 0, hoeCondition: this.state.hoeCondition, lastDay: this.state.lastDay, lastMentorDay: this.state.lastDay - 30, dailyXp: {}, rewardedActions: [], mentors: [] };
    void previousCharacterId;
  }

  serialize(): ProfessionSaveState { return JSON.parse(JSON.stringify(this.state)) as ProfessionSaveState; }
  deserialize(saved: ProfessionSaveState | null | undefined, characterId?: string | null): void {
    if (!saved || saved.version !== 1) { if (characterId !== undefined) this.state.characterId = characterId; return; }
    this.state = { ...saved, lastMentorDay: saved.lastMentorDay ?? -30, skills: { ...saved.skills }, dailyXp: { ...saved.dailyXp }, rewardedActions: [...saved.rewardedActions], mentors: [...saved.mentors], fatigue: Math.max(0, Math.min(100, saved.fatigue)), hoeCondition: Math.max(0, Math.min(100, saved.hoeCondition)) };
    if (characterId !== undefined) this.state.characterId = characterId;
  }

  private advanceDay(day: number): void {
    if (!Number.isFinite(day) || day <= this.state.lastDay) return;
    const days = Math.min(14, day - this.state.lastDay);
    this.state.fatigue = Math.max(0, this.state.fatigue - days * 35);
    this.state.dailyXp = {};
    this.state.rewardedActions = this.state.rewardedActions.filter(key => Number(key.split(':', 1)[0]) >= day - 1);
    this.state.lastDay = day;
  }
  private recordExternalXp(profession: ProfessionId, activity: ProfessionActivity, sourceId: string, day: number, amount: number): void {
    this.advanceDay(day);
    const key = `${day}:${profession}:${activity}:${sourceId}`;
    if (this.state.rewardedActions.includes(key)) return;
    this.state.rewardedActions.push(key);
    const daily = this.state.dailyXp[profession] ?? 0;
    const skill = this.state.skills[profession] ??= { level: 1, experience: 0, reputation: 0, activities: 0 };
    skill.activities += 1;
    skill.experience += Math.min(amount, Math.max(0, 40 - daily));
    this.state.dailyXp[profession] = daily + Math.min(amount, Math.max(0, 40 - daily));
    this.promote(profession);
  }
  private promote(id: ProfessionId): void {
    const skill = this.state.skills[id]; if (!skill) return;
    const previousLevel = skill.level;
    while (skill.level < 10 && skill.experience >= PROFESSION_XP_PER_LEVEL(skill.level)) { skill.experience -= PROFESSION_XP_PER_LEVEL(skill.level); skill.level++; }
    if (skill.level > previousLevel) this.changed?.(id, skill.level);
  }
}
