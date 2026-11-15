import type { CalendarConfig, GameTime } from './TimeManager';
import type { MarketSerializedState } from './MarketSystem';
import type { FamilySaveState } from './FamilySystem';
import type { FarmPlotData } from '@data/CropData';
import type { PoliticalState } from './PoliticalSystem';
import type { HistoricalTimelineState } from './HistoricalEventSystem';
import type { MilitaryState } from './MilitarySystem';
import type { Equipment } from './EquipmentSystem';
import type { SettlementSaveState } from './SettlementSimulation';
import type { RegionalWorldState } from './RegionalWorldSystem';
import type { QuestSystemSaveState } from './QuestSystem';
import type { TutorialSaveState } from './TutorialSystem';
import type { ProfessionSaveState } from './ProfessionSystem';

/** Bump for every persisted shape change; each older supported schema passes through migrate(). */
export const SAVE_VERSION = '1.11.0';
const DB_NAME = 'OttomanGameDB';
const STORE_NAME = 'saves';
const DB_VERSION = 3;
const BACKUP_SUFFIX = ':backup';
export const SAVE_LIMITS = { inventoryEntries: 5000, farmPlots: 10000, transferBytes: 10 * 1024 * 1024 } as const;

export interface SaveData {
  version: string; timestamp: number; time: GameTime;
  calendar?: CalendarConfig;
  inventory: { items: Array<[string, number]>; maxSlots: number };
  economy: { currency: number }; farm: { plots: FarmPlotData[]; npcInventories?: Record<string, { items: Array<[string, number]>; maxSlots: number }> };
  market: MarketSerializedState; playerPosition: { x: number; y: number };
  playerCondition?: { health: number; stamina: number };
  family?: FamilySaveState; political?: PoliticalState;
  timeline?: HistoricalTimelineState; military?: MilitaryState; equipment?: Equipment;
  professions?: ProfessionSaveState;
  world?: { mapSeed: number; npcStates: Record<string, unknown>; characterAppearance?: string; settlement?: SettlementSaveState; regional?: RegionalWorldState };
  quests?: { active: string[]; completed: string[]; achievements: string[]; system?: QuestSystemSaveState };
  tutorial?: TutorialSaveState;
}
export type SavePayload = Omit<SaveData, 'version' | 'timestamp'>;
export type LoadResult =
  | { status: 'ok'; data: SaveData; migrated: boolean; recoveredFromBackup?: true; warning?: string }
  | { status: 'empty' }
  | { status: 'invalid'; message: string; recoverable: boolean };

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
function finite(value: unknown): value is number { return typeof value === 'number' && Number.isFinite(value); }
function validPairList(value: unknown, maxLength = 5000): value is Array<[string, number]> {
  return Array.isArray(value) && value.length <= maxLength && value.every(entry =>
    Array.isArray(entry) && entry.length === 2 && typeof entry[0] === 'string' && entry[0].length > 0 && entry[0].length <= 128 && finite(entry[1]) && entry[1] >= 0 && entry[1] <= 1_000_000_000,
  );
}

/** Versioned IndexedDB saves. Writes and their previous valid backup commit in one transaction. */
export class SaveManager {
  private static instance: SaveManager | null = null;
  private memoryFallback = new Map<string, unknown>();
  private useMemoryFallback = typeof indexedDB === 'undefined';
  private persistenceRequested = false;
  private lastErrorMessage: string | null = null;
  private constructor() {}
  public static getInstance(): SaveManager { return this.instance ??= new SaveManager(); }

  getLastError(): string | null { return this.lastErrorMessage; }
  private setError(message: string | null): void { this.lastErrorMessage = message; }
  private validSlot(slot: string): boolean { return /^slot[1-9]\d*$/.test(slot); }
  private backupKey(slot: string): string { return `${slot}${BACKUP_SUFFIX}`; }

  private openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'));
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => db.close();
        resolve(db);
      };
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
      };
    });
  }

  private async readRaw(slot: string): Promise<unknown> {
    if (this.useMemoryFallback) return this.memoryFallback.get(slot);
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(slot);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('Could not read save'));
    });
  }

  async saveGame(slotId: string, payload: SavePayload): Promise<boolean> {
    this.setError(null);
    if (!this.validSlot(slotId)) { this.setError('Invalid save slot.'); return false; }
    if (!this.isValidPayload(payload)) { this.setError('Save data failed validation; the existing save was left unchanged.'); return false; }
    if (!this.persistenceRequested && typeof navigator !== 'undefined' && navigator.storage?.persist) {
      this.persistenceRequested = true;
      void navigator.storage.persist().catch(() => false);
    }
    let current: unknown;
    try { current = await this.readRaw(slotId); }
    catch (error) { this.setError(`Could not read the existing save; it was left unchanged. ${String(error)}`); return false; }
    if (current !== undefined && current !== null && this.validateRawRecord(current).status !== 'ok') {
      this.setError('The current save is damaged or incompatible. It was left unchanged; load a valid backup or export the original before replacing it.');
      return false;
    }
    const data: SaveData = { ...payload, version: SAVE_VERSION, timestamp: Date.now() };
    return this.writeRaw(slotId, data, true);
  }

  async exportGame(slotId: string): Promise<string | null> {
    this.setError(null);
    const result = await this.loadSlot(slotId);
    if (result.status !== 'ok') { this.setError(result.status === 'invalid' ? result.message : 'No save exists in this slot.'); return null; }
    try { return JSON.stringify(result.data, null, 2); }
    catch (error) { this.setError(`Could not export save data. ${String(error)}`); return null; }
  }

  async importGame(slotId: string, contents: string): Promise<boolean> {
    this.setError(null);
    if (!this.validSlot(slotId)) { this.setError('Invalid destination slot.'); return false; }
    if (contents.length > SAVE_LIMITS.transferBytes) { this.setError('Import file exceeds the 10 MB size limit.'); return false; }
    let existing: unknown;
    try { existing = await this.readRaw(slotId); }
    catch (error) { this.setError(`Could not inspect the destination slot. ${String(error)}`); return false; }
    if (existing !== undefined && existing !== null) { this.setError('Import requires an empty slot; the existing save was left unchanged.'); return false; }
    let parsed: unknown;
    try { parsed = JSON.parse(contents); }
    catch { this.setError('The import is not valid JSON.'); return false; }
    const result = this.validateRawRecord(parsed);
    if (result.status !== 'ok') { this.setError(result.status === 'invalid' ? result.message : 'The import does not contain a save.'); return false; }
    return this.writeRaw(slotId, result.data, false);
  }

  /** Current and backup are read/written inside one transaction; concurrent saves cannot back up stale data. */
  private async writeRaw(slotId: string, data: SaveData, allowReplace: boolean): Promise<boolean> {
    if (this.useMemoryFallback) {
      const current = this.memoryFallback.get(slotId);
      if (current !== undefined && current !== null && !allowReplace) { this.setError('Import requires an empty slot; the existing save was left unchanged.'); return false; }
      if (current !== undefined && current !== null) {
        if (this.validateRawRecord(current).status !== 'ok') { this.setError('The current save is damaged; it was left unchanged.'); return false; }
        this.memoryFallback.set(this.backupKey(slotId), current);
      }
      this.memoryFallback.set(slotId, data);
      return true;
    }
    try {
      const db = await this.openDB();
      return await new Promise(resolve => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const currentRequest = store.get(slotId);
        currentRequest.onerror = () => { this.setError('Could not inspect the save slot; the previous save and backup were preserved.'); try { tx.abort(); } catch { /* already inactive */ } };
        currentRequest.onsuccess = () => {
          const current = currentRequest.result;
          if (current !== undefined && current !== null && !allowReplace) {
            this.setError('Import requires an empty slot; the existing save was left unchanged.');
            try { tx.abort(); } catch { /* already inactive */ }
            return;
          }
          if (current !== undefined && current !== null && this.validateRawRecord(current).status !== 'ok') {
            this.setError('The current save is damaged; it was left unchanged.');
            try { tx.abort(); } catch { /* already inactive */ }
            return;
          }
          try {
            if (current !== undefined && current !== null) store.put(current, this.backupKey(slotId));
            store.put(data, slotId);
          } catch (error) {
            this.setError(`Save transaction could not be written; the previous save and backup were preserved. ${String(error)}`);
            try { tx.abort(); } catch { /* already inactive */ }
          }
        };
        tx.oncomplete = () => { this.setError(null); resolve(true); };
        tx.onerror = () => { this.setError(`Save transaction failed; the previous save and backup were preserved. ${tx.error?.message ?? ''}`.trim()); resolve(false); };
        tx.onabort = () => { this.setError(`Save transaction was interrupted; the previous save and backup were preserved. ${tx.error?.message ?? ''}`.trim()); resolve(false); };
      });
    } catch (error) {
      this.setError(`Could not write save data; the previous save and backup were preserved. ${String(error)}`);
      return false;
    }
  }

  async loadGame(slotId: string): Promise<SaveData | null> { const result = await this.loadSlot(slotId); return result.status === 'ok' ? result.data : null; }
  async getSaveStatus(slotId: string): Promise<LoadResult> { return this.loadSlot(slotId); }
  async loadSlot(slotId: string): Promise<LoadResult> {
    this.setError(null);
    if (!this.validSlot(slotId)) return { status: 'invalid', message: 'Invalid save slot.', recoverable: false };
    let raw: unknown;
    try { raw = await this.readRaw(slotId); }
    catch (error) { return { status: 'invalid', message: `Could not read save: ${String(error)}`, recoverable: true }; }
    const primary = this.validateRawRecord(raw);
    if (primary.status === 'ok') return primary;
    let backup: unknown;
    try { backup = await this.readRaw(this.backupKey(slotId)); } catch { /* keep primary diagnostic */ }
    const recovered = this.validateRawRecord(backup);
    if (recovered.status === 'ok') {
      const primaryMessage = primary.status === 'invalid' ? primary.message : 'The main save is missing.';
      return { ...recovered, recoveredFromBackup: true, warning: `${primaryMessage} Loaded the previous valid backup; the original remains unchanged.` };
    }
    return primary;
  }

  validateRawRecord(raw: unknown): LoadResult {
    if (raw === undefined || raw === null) return { status: 'empty' };
    if (!isRecord(raw)) return { status: 'invalid', message: 'Save data is damaged. The original slot was kept unchanged.', recoverable: true };
    const version = typeof raw.version === 'string' ? raw.version : '0.1.0';
    if (!this.isCompatibleVersion(version)) return { status: 'invalid', message: `Save version ${version} is newer or incompatible. The original slot was kept unchanged.`, recoverable: false };
    const migrated = version !== SAVE_VERSION;
    const data = this.migrate(raw, version);
    if (!data || !this.isValidPayload(data) || !finite(data.timestamp) || data.timestamp < 0) {
      return { status: 'invalid', message: 'Save contents failed validation. The original slot was kept unchanged.', recoverable: true };
    }
    return { status: 'ok', data, migrated };
  }

  private isCompatibleVersion(version: string): boolean {
    const parts = version.split('.').map(Number), current = SAVE_VERSION.split('.').map(Number);
    if (parts.length !== 3 || parts.some(n => !Number.isInteger(n) || n < 0)) return false;
    for (let i = 0; i < 3; i++) { const a = parts[i] ?? Infinity, b = current[i] ?? 0; if (a < b) return true; if (a > b) return false; }
    return true;
  }

  /** Earlier saves gain safe optional-system defaults; old saves do not auto-start tutorials. */
  private migrate(raw: Record<string, unknown>, fromVersion: string): SaveData | null {
    const required = ['time', 'inventory', 'economy', 'farm', 'market', 'playerPosition'];
    if (required.some(key => !(key in raw))) return null;
    const migrated: Record<string, unknown> = { ...raw };
    const oldParts = fromVersion.split('.').map(Number);
    if ((oldParts[0] ?? 0) < 1 || fromVersion !== SAVE_VERSION) {
      migrated.world ??= { mapSeed: 1337, npcStates: {} };
      migrated.quests ??= { active: [], completed: [], achievements: [] };
    }
    migrated.version = SAVE_VERSION;
    migrated.timestamp = finite(raw.timestamp) && raw.timestamp >= 0 ? raw.timestamp : Date.now();
    return migrated as unknown as SaveData;
  }

  private isValidPayload(data: Partial<SavePayload>): boolean {
    const time = data.time as unknown, pos = data.playerPosition as unknown;
    const c = data.calendar as unknown as Record<string, unknown> | undefined;
    const daysPerMonth = Number.isInteger(c?.daysPerMonth) ? c!.daysPerMonth as number : 30;
    const monthsPerYear = Number.isInteger(c?.monthsPerYear) ? c!.monthsPerYear as number : 12;
    if (!isRecord(time) || !Number.isInteger(time.year) || (time.year as number) < 1299 || !Number.isInteger(time.day) || (time.day as number) < 1 || (time.day as number) > daysPerMonth || !Number.isInteger(time.month) || (time.month as number) < 1 || (time.month as number) > monthsPerYear || !['spring','summer','autumn','winter'].includes(String(time.season)) || !finite(time.totalDays) || time.totalDays < 0) return false;
    if (data.calendar !== undefined) {
      const c = data.calendar as unknown as Record<string, unknown>;
      if (!isRecord(c) || !Number.isInteger(c.daysPerMonth) || (c.daysPerMonth as number) < 1 || (c.daysPerMonth as number) > 60 || !Number.isInteger(c.monthsPerYear) || (c.monthsPerYear as number) < 4 || (c.monthsPerYear as number) > 24 || !isRecord(c.seasonStarts)) return false;
      const starts = c.seasonStarts;
      if (['spring','summer','autumn','winter'].some(key => !Number.isInteger(starts[key]) || (starts[key] as number) < 1 || (starts[key] as number) > (c.monthsPerYear as number))) return false;
    }
    if (!isRecord(data.inventory) || !validPairList(data.inventory.items, SAVE_LIMITS.inventoryEntries) || !Number.isInteger(data.inventory.maxSlots) || data.inventory.maxSlots < 1 || data.inventory.maxSlots > 10_000 || data.inventory.items.length > data.inventory.maxSlots) return false;
    if (!isRecord(data.economy) || !finite(data.economy.currency) || data.economy.currency < 0 || data.economy.currency > 1_000_000_000_000) return false;
    if (!isRecord(data.farm) || !Array.isArray(data.farm.plots) || data.farm.plots.length > SAVE_LIMITS.farmPlots || !data.farm.plots.every((plot: unknown) => isRecord(plot) && typeof plot.id === 'string' && plot.id.length <= 128 && finite(plot.gridX) && finite(plot.gridY) && typeof plot.state === 'number' && Number.isInteger(plot.state) && plot.state >= 0 && plot.state <= 5 && finite(plot.growthProgress) && plot.growthProgress >= 0 && plot.growthProgress <= 1 && typeof plot.unlocked === 'boolean' && (plot.cropType === undefined || ['wheat','barley','oats'].includes(String(plot.cropType))) && (plot.plantedDay === undefined || finite(plot.plantedDay)) && (plot.soilQuality === undefined || finite(plot.soilQuality) && plot.soilQuality >= 0 && plot.soilQuality <= 100) && (plot.moisture === undefined || finite(plot.moisture) && plot.moisture >= 0 && plot.moisture <= 100) && (plot.cropQuality === undefined || finite(plot.cropQuality) && plot.cropQuality >= 0 && plot.cropQuality <= 100) && (plot.npcLastWorkHour === undefined || finite(plot.npcLastWorkHour) && plot.npcLastWorkHour >= 0))) return false;
    if (data.farm.npcInventories !== undefined && (!isRecord(data.farm.npcInventories) || Object.entries(data.farm.npcInventories).length > 100 || Object.values(data.farm.npcInventories).some(state => !isRecord(state) || !Number.isInteger(state.maxSlots) || (state.maxSlots as number) < 1 || (state.maxSlots as number) > 100 || !validPairList(state.items, 100)))) return false;
    if (!isRecord(data.market) || !validPairList(data.market.stock, 1000) || !finite(data.market.lastRestockDay)) return false;
    if (data.market.demand !== undefined && (!isRecord(data.market.demand) || Object.values(data.market.demand).some(value => !finite(value) || value < 0))) return false;
    if (data.market.merchantCapital !== undefined && (!finite(data.market.merchantCapital) || data.market.merchantCapital < 0 || data.market.merchantCapital > 300)) return false;
    if (data.market.routeDisruption !== undefined && (!finite(data.market.routeDisruption) || data.market.routeDisruption < 0 || data.market.routeDisruption > 1)) return false;
    if (data.playerCondition !== undefined && (!isRecord(data.playerCondition) || !finite(data.playerCondition.health) || data.playerCondition.health < 0 || data.playerCondition.health > 100 || !finite(data.playerCondition.stamina) || data.playerCondition.stamina < 0 || data.playerCondition.stamina > 100)) return false;
    if (!isRecord(pos) || !finite(pos.x) || !finite(pos.y) || pos.x < 0 || pos.y < 0 || pos.x >= 32 || pos.y >= 32) return false;
    if (data.world !== undefined && (!isRecord(data.world) || !finite(data.world.mapSeed) || !isRecord(data.world.npcStates))) return false;
    if (data.quests !== undefined && (!isRecord(data.quests) || !['active','completed','achievements'].every(key => Array.isArray(data.quests?.[key as keyof typeof data.quests]) && (data.quests?.[key as keyof typeof data.quests] as unknown[]).every(item => typeof item === 'string')))) return false;
    if (data.professions !== undefined) {
      const state = data.professions as unknown as Record<string, unknown>;
      if (state.version !== 1 || !(state.characterId === null || typeof state.characterId === 'string') || !isRecord(state.skills) || !finite(state.fatigue) || state.fatigue < 0 || state.fatigue > 100 || !finite(state.hoeCondition) || state.hoeCondition < 0 || state.hoeCondition > 100 || !finite(state.lastDay) || !finite(state.lastMentorDay) || !isRecord(state.dailyXp) || Object.values(state.dailyXp).some(xp => !finite(xp) || xp < 0 || xp > 40) || !Array.isArray(state.rewardedActions) || state.rewardedActions.length > 512 || !state.rewardedActions.every(id => typeof id === 'string') || !Array.isArray(state.mentors) || !state.mentors.every(id => typeof id === 'string')) return false;
      for (const skill of Object.values(state.skills)) if (!isRecord(skill) || !finite(skill.level) || skill.level < 1 || skill.level > 10 || !finite(skill.experience) || skill.experience < 0 || !finite(skill.reputation) || skill.reputation < 0 || skill.reputation > 100 || !finite(skill.activities) || skill.activities < 0) return false;
    }
    if (data.world?.settlement !== undefined) {
      const settlement = data.world.settlement as unknown as Record<string, unknown>;
      if (!isRecord(settlement) || (settlement.schema !== 1 && settlement.schema !== 2)) return false;
      if (!Array.isArray(settlement.npcs) || settlement.npcs.length > 200) return false;
      if (!Array.isArray(settlement.events) || settlement.events.length > 200) return false;
      if (settlement.schema === 2) {
        if (!isRecord(settlement.clock)) return false;
        if (!Array.isArray(settlement.incidents) || settlement.incidents.length > 200) return false;
        const clock = settlement.clock as Record<string, unknown>;
        if (!finite(clock.absoluteHour) || !finite(clock.day) || !finite(clock.hourOfDay)) return false;
        if (clock.weather !== undefined && !['clear','cloudy','rain','fog','wind','snow'].includes(String(clock.weather))) return false;
        for (const key of ['weatherFrom','weatherTarget']) if (clock[key] !== undefined && !['clear','cloudy','rain','fog','wind','snow'].includes(String(clock[key]))) return false;
        if (clock.weatherTransitionStartHour !== undefined && !finite(clock.weatherTransitionStartHour)) return false;
      }
    }
    if (data.world?.regional !== undefined && !isRecord(data.world.regional)) return false;
    if (data.family !== undefined) {
      const state = data.family as unknown as Record<string, unknown>;
      const family = state.family;
      if (!isRecord(family) || !Array.isArray(family.members) || family.members.length > 10_000 || !family.members.every(member => isRecord(member) && typeof member.id === 'string' && typeof member.firstName === 'string' && Number.isInteger(member.generation) && finite(member.age) && isRecord(member.skills) && Array.isArray(member.traits) && Array.isArray(member.childrenIds))) return false;
    }
    if (data.timeline !== undefined) {
      const state = data.timeline as unknown as Record<string, unknown>;
      if (!isRecord(state.canonicalTimeline) || !Array.isArray(state.canonicalTimeline.knownEvents) || !isRecord(state.simulationTimeline) || !Array.isArray(state.simulationTimeline.triggeredEvents) || !isRecord(state.simulationTimeline.eventOutcomes) || !Array.isArray(state.simulationTimeline.divergences) || !isRecord(state.simulationTimeline.flags)) return false;
      const timeline=state.simulationTimeline as Record<string,unknown>;
      if(timeline.pendingConsequences!==undefined&&(!Array.isArray(timeline.pendingConsequences)||timeline.pendingConsequences.length>10_000||!(timeline.pendingConsequences as unknown[]).every(item=>isRecord(item)&&typeof item.id==='string'&&typeof item.eventId==='string'&&finite(item.dueDay)&&isRecord(item.consequence)&&typeof item.consequence.type==='string'&&typeof item.consequence.description==='string')))return false;
      if((state.simulationTimeline.divergences as unknown[]).length>10_000||(state.simulationTimeline.triggeredEvents as unknown[]).length>10_000)return false;
    }
    if (data.military !== undefined) {
      const state = data.military as unknown as Record<string, unknown>;
      if (!Array.isArray(state.completedMissions) || !Array.isArray(state.serviceRecord) || !isRecord(state.relationships)) return false;
    }
    if (data.political !== undefined) {
      const state=data.political as unknown as Record<string,unknown>;
      for(const key of ['factionStanding','factionInfluence','factionResources','factionLeaders','individualTrust','individualReputation'])if(state[key]!==undefined&&(!isRecord(state[key])||Object.values(state[key] as Record<string,unknown>).some(value=>typeof value==='number'?!finite(value)||value < (key==='factionResources'?0:0)||value>100:typeof value!=='string')))return false;
      for(const key of ['alliances','rivalries'])if(state[key]!==undefined&&(!Array.isArray(state[key])||state[key].length>100||!(state[key] as unknown[]).every(id=>typeof id==='string')))return false;
      if(state.disputes!==undefined&&(!Array.isArray(state.disputes)||state.disputes.length>100||!(state.disputes as unknown[]).every(d=>isRecord(d)&&typeof d.id==='string'&&typeof d.title==='string'&&Array.isArray(d.parties)&&['active','settled','withdrawn','contested'].includes(String(d.status)))))return false;
      if(state.memories!==undefined&&(!Array.isArray(state.memories)||state.memories.length>100||!(state.memories as unknown[]).every(m=>isRecord(m)&&typeof m.actorId==='string'&&typeof m.description==='string'&&finite(m.day)&&finite(m.trustChange))))return false;
      if(state.tradeContract!==undefined&&state.tradeContract!==null&&(!isRecord(state.tradeContract)||typeof state.tradeContract.id!=='string'||typeof state.tradeContract.factionId!=='string'||state.tradeContract.itemId!=='wheat'||!Number.isInteger(state.tradeContract.amount)||!finite(state.tradeContract.dueDay)||!['active','fulfilled','defaulted','cancelled'].includes(String(state.tradeContract.status))))return false;
    }
    if (data.tutorial !== undefined && (!isRecord(data.tutorial) || !Array.isArray(data.tutorial.completedSteps) || data.tutorial.completedSteps.length > 100 || !data.tutorial.completedSteps.every(id => typeof id === 'string' && id.length <= 64) || typeof data.tutorial.skipped !== 'boolean' || typeof data.tutorial.active !== 'boolean')) return false;
    return true;
  }

  async deleteSave(slotId: string): Promise<boolean> {
    if (!this.validSlot(slotId)) return false;
    if (this.useMemoryFallback) { this.memoryFallback.delete(slotId); this.memoryFallback.delete(this.backupKey(slotId)); return true; }
    try {
      const db = await this.openDB();
      return await new Promise(resolve => {
        const tx = db.transaction(STORE_NAME, 'readwrite'); const store = tx.objectStore(STORE_NAME);
        store.delete(slotId); store.delete(this.backupKey(slotId));
        tx.oncomplete = () => resolve(true); tx.onerror = () => resolve(false); tx.onabort = () => resolve(false);
      });
    } catch { return false; }
  }
  async getSaveSlots(): Promise<string[]> {
    if (this.useMemoryFallback) return [...this.memoryFallback.keys()].filter(slot => this.validSlot(slot)).sort();
    try {
      const db = await this.openDB();
      return await new Promise((resolve, reject) => {
        const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAllKeys();
        request.onsuccess = () => resolve(request.result.map(String).filter(slot => this.validSlot(slot)).sort());
        request.onerror = () => reject(request.error);
      });
    } catch { return []; }
  }
}
