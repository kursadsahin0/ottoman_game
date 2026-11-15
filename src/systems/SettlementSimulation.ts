import Phaser from 'phaser';
import type { WorldMap } from '@data/WorldData';
import { TimeManager, Season, type GameTime } from './TimeManager';
import { Inventory } from './Inventory';
import { Economy } from './Economy';
import { HistoricalEventSystem } from './HistoricalEventSystem';
import {
  DialogueSystem, type DialogueEffect, type DialoguePersistentState,
  type DialogueView, type PersonalityTraits, type RelationshipDomain,
} from './DialogueSystem';
import { VillageSimulation } from '@/village/VillageSimulation';
import { VillageRenderer } from '@/village/VillageRenderer';
import type {
  NpcActivity, NpcMemoryKind, OccupationId, VillageClockState, VillageIncident,
  VillageNpcSave, VillageNpcState, VillageSaveState, VillageWeather,
} from '@/village/types';
import { VillageDebugPanel } from '@/ui/VillageDebugPanel';

export type SettlementWeather = VillageWeather;
export type SettlementOccupation = OccupationId;
export type SettlementActivity = NpcActivity;
export type SettlementNpcState = VillageNpcState;

export interface SettlementEvent {
  id: string;
  type: 'help_request' | 'market_delay' | 'local_dispute';
  title: string;
  targetNpcId: string;
  startDay: number;
  expiresDay: number;
  status: 'active' | 'completed' | 'expired';
}

/**
 * Save schema 2 keeps the village's 19 identities, occupations, relationships,
 * memories, incidents and clock. The old schema 1 fields remain accepted so
 * existing slots migrate in place instead of being discarded.
 */
export interface SettlementSaveState extends VillageSaveState {
  timeScale: number;
  lastProcessedHour: number;
  lastDay: number;
  weather: VillageWeather;
  weatherDay: number;
  lastEventDay: number;
  events: SettlementEvent[];
  dialogue?: DialoguePersistentState;
}

interface LegacySettlementState {
  schema?: number;
  timeScale?: number;
  lastProcessedHour?: number;
  lastDay?: number;
  weather?: VillageWeather;
  weatherFrom?: VillageWeather;
  weatherTarget?: VillageWeather;
  weatherTransitionStartHour?: number;
  weatherDay?: number;
  lastEventDay?: number;
  npcs?: Array<Partial<VillageNpcSave>>;
  events?: SettlementEvent[];
  dialogue?: DialoguePersistentState;
}

const MAX_SETTLEMENT_EVENTS = 100;
const ACTIVITY_MIGRATION: Record<string, NpcActivity> = {
  sleeping: 'sleeping',
  working: 'working',
  market: 'market',
  resting: 'idle',
  patrolling: 'patrolling',
  fetching_water: 'fetching_water',
  meeting: 'socializing',
};

function clamp(value: number, min = 0, max = 100): number { return Math.max(min, Math.min(max, value)); }
function validPosition(value: unknown): value is { x: number; y: number } {
  if (!value || typeof value !== 'object') return false;
  const point = value as { x?: unknown; y?: unknown };
  return typeof point.x === 'number' && Number.isFinite(point.x) && point.x >= 0 && point.x < 32
    && typeof point.y === 'number' && Number.isFinite(point.y) && point.y >= 0 && point.y < 32;
}

/**
 * Phaser adapter for the pure village simulation. Dialogue, story events and
 * rendering live here; schedules, needs, pathfinding, reactions, memory and
 * persistence live in `src/village/`.
 */
export class SettlementSimulation {
  private readonly timeManager = TimeManager.getInstance();
  private readonly village: VillageSimulation;
  /** Live roster kept for the existing debug/perf probes and scene tooling. */
  public readonly states: SettlementNpcState[];
  private readonly renderer: VillageRenderer;
  private readonly debugPanel: VillageDebugPanel;
  private readonly dialogue: DialogueSystem;
  private dialogueInventory: Inventory | null = null;
  private dialogueEconomy: Economy | null = null;
  private events: SettlementEvent[] = [];
  private lastDay: number;
  private lastEventDay = -3;
  private storyDayHandled = -1;
  private overlayEnabled = false;
  private playerPosition: { x: number; y: number } = { x: 16, y: 17 };

  constructor(
    private readonly scene: Phaser.Scene,
    worldMap: WorldMap,
    isBlocked: (x: number, y: number) => boolean,
  ) {
    this.village = new VillageSimulation(this.timeManager.getTime(), {
      width: worldMap.width,
      height: worldMap.height,
      isBlocked,
    });
    this.states = this.village.getRoster() as SettlementNpcState[];
    this.lastDay = this.village.getClock().day;
    this.renderer = new VillageRenderer(scene, this.village, () => this.getPlayerPosition());
    this.debugPanel = new VillageDebugPanel(scene, this.village);
    this.dialogue = new DialogueSystem('tr', (npcId, effect) => this.applyDialogueEffect(npcId, effect));
    this.village.advanceTo(this.timeManager.getTime());
  }

  private getPlayerPosition(): { x: number; y: number } {
    return this.playerPosition;
  }

  /** Called each game frame. One clock drives every NPC. */
  public update(now: number, playerPosition: { x: number; y: number }): boolean {
    this.playerPosition = playerPosition;
    const selected = this.debugPanel.getSelectedId();
    const visible = this.renderer.getVisibleNpcIds(now, selected);
    const dayChanged = this.village.update(now, this.timeManager.getTime(), playerPosition, visible);
    this.renderer.update(now, selected, this.overlayEnabled);
    this.debugPanel.update(now);
    const clock = this.village.getClock();
    if (clock.day !== this.lastDay || dayChanged) {
      this.handleNewDay(clock.day, this.timeManager.getTime());
      this.lastDay = clock.day;
    }
    return dayChanged;
  }

  /** Advances routine and event state after day/week jumps or a save load. */
  public advanceSimulationToNow(): boolean {
    const dayChanged = this.village.advanceTo(this.timeManager.getTime());
    const day = this.village.getClock().day;
    if (day !== this.lastDay) {
      this.handleNewDay(day, this.timeManager.getTime());
      this.lastDay = day;
    }
    this.renderer.update(this.scene.time.now, this.debugPanel.getSelectedId(), this.overlayEnabled);
    return dayChanged;
  }

  private handleNewDay(day: number, time: GameTime): void {
    if (this.storyDayHandled === day) return;
    this.storyDayHandled = day;
    this.dialogue.advanceDay(day);
    this.updateWorldEvents(day, time);
  }

  private updateWorldEvents(day: number, time: GameTime): void {
    this.events = this.events.map(event =>
      event.status === 'active' && day > event.expiresDay ? { ...event, status: 'expired' } : event);
    if (day <= 0 || day - this.lastEventDay < 3) return;
    if (this.events.some(event => event.status === 'active')) return;
    const eventIndex = Math.floor(day / 3) % 3;
    const event: SettlementEvent = eventIndex === 0 ? {
      id: `frontier_seed_request_${day}`, type: 'help_request', title: 'Tohum isteyen çiftçi',
      targetNpcId: 'hasan_farmer', startDay: day, expiresDay: day + 2, status: 'active',
    } : eventIndex === 1 ? {
      id: `frontier_market_delay_${day}`, type: 'market_delay', title: 'Kervan gecikti',
      targetNpcId: 'yusuf_merchant', startDay: day, expiresDay: day, status: 'active',
    } : {
      id: `frontier_boundary_dispute_${day}`, type: 'local_dispute', title: 'Tarla sınırı anlaşmazlığı',
      targetNpcId: 'ilyas_official', startDay: day, expiresDay: day + 1, status: 'active',
    };
    this.events.push(event);
    if (this.events.length > MAX_SETTLEMENT_EVENTS) {
      this.events.splice(0, this.events.length - MAX_SETTLEMENT_EVENTS);
    }
    this.lastEventDay = day;
    this.recordTimelineEvent(event, time, 'emerged', ['Yerleşimde kurmaca bir günlük olay başladı.']);
  }

  private recordTimelineEvent(
    event: SettlementEvent, time: GameTime, choice: string, consequences: string[],
  ): void {
    this.scene.events.emit('settlement-timeline-event', {
      ...event, description: event.title, choice, year: time.year, consequences,
    });
  }

  public findNearbyNpc(position: { x: number; y: number }, range = 1.6): SettlementNpcState | null {
    let closest: SettlementNpcState | null = null;
    let best = range;
    for (const state of this.states) {
      const d = Math.hypot(state.position.x - position.x, state.position.y - position.y);
      if (d < best) { closest = state; best = d; }
    }
    if (!closest) return null;
    return this.village.getNpc(closest.id) ?? closest;
  }

  /** Compatibility hook used by the settlement profiler and debug prose. */
  public findPath(from: { x: number; y: number }, to: { x: number; y: number }): Array<{ x: number; y: number }> {
    return this.village.pathfinder.findPath(from, to).path;
  }

  public interact(
    npcId: string,
    inventory: Inventory,
    economy: Economy,
    history: HistoricalEventSystem,
  ): { message: string; success: boolean } {
    const npc = this.village.getNpc(npcId);
    if (!npc) return { message: 'Burada kimse yok.', success: false };
    this.village.calmStranger();
    this.village.recordPlayerInteraction(npcId, 'conversation', `${npc.name} ile konuşuldu.`, 1, 1);
    const event = this.events.find(item => item.status === 'active' && item.targetNpcId === npcId);
    if (event?.type === 'help_request') {
      if (!inventory.removeItem('seed_wheat', 1)) {
        return { message: `${npc.name}: Bir avuç buğday tohumu bulabilir misin?`, success: false };
      }
      economy.addCurrency(12);
      event.status = 'completed';
      this.village.adjustTrust(npcId, 12, 'help', `${npc.name} bir tohum isteğini karşıladı.`);
      this.recordTimelineEvent(event, this.timeManager.getTime(), 'tohum_paylaşıldı', [
        'Oyuncu Hasan ile tohumu paylaştı.', 'Hasan ile güven arttı.', 'Oyuncu 12 akçe aldı.',
      ]);
      history.updateTime(this.timeManager.getTime().year);
      return { message: `${npc.name} teşekkür edip 12 akçe verdi.`, success: true };
    }
    if (event?.type === 'local_dispute') {
      if (!economy.removeCurrency(8)) {
        return { message: `${npc.name}: Tarla sınırını uzlaştırmak için 8 akçe masraf gerekiyor.`, success: false };
      }
      event.status = 'completed';
      this.village.adjustTrust(npcId, 8, 'help', `${npc.name} sınır anlaşmazlığında arabuluculuk gördü.`);
      this.village.adjustRelationship('hasan_farmer', 'yusuf_merchant', 8);
      this.village.adjustRelationship('yusuf_merchant', 'hasan_farmer', 8);
      this.recordTimelineEvent(event, this.timeManager.getTime(), 'uzlaşma_sağlandı', [
        'Oyuncu sınır anlaşmazlığında arabuluculuk yaptı.',
        'Hasan ve Yusuf arasındaki ilişki düzeldi.', '8 akçe harcandı.',
      ]);
      return { message: 'Anlaşmazlık yatıştı; Hasan ile Yusuf uzlaştı.', success: true };
    }
    if (event?.type === 'market_delay') {
      return { message: `${npc.name}: Kervan gecikti; tezgâhı öğlene doğru açacağım.`, success: true };
    }
    return { message: this.village.getActivityText(npcId), success: true };
  }

  public openDialogue(npcId: string, inventory: Inventory, economy: Economy): DialogueView | null {
    const npc = this.village.getNpc(npcId);
    if (!npc) return null;
    this.dialogueInventory = inventory;
    this.dialogueEconomy = economy;
    const view = this.dialogue.open(
      { id: npc.id, name: npc.name, personality: npc.personality as PersonalityTraits },
      effect => this.canPayDialogueCost(effect),
    );
    if (view) {
      this.village.calmStranger();
      this.village.recordPlayerInteraction(npcId, 'conversation', `${npc.name} ile konuşuldu.`, 1, 1);
    }
    return view;
  }

  public setDialogueReputation(value: number): void { this.dialogue.setReputation(value); }

  public recordMilitaryOutcome(victory: boolean, casualties: number): void {
    this.village.recordMilitaryOutcome(victory, casualties);
    // Carry the battle's consequences back to the village so nearby residents
    // react through the same incident and memory systems as other dangers.
    this.village.raiseIncident(
      'combat',
      { x: 28, y: 14 },
      victory ? Math.max(1, Math.min(3, casualties + 1)) : 3,
      victory ? 'Sınır yolunda çatışma sona erdi; nöbetçiler kayıpları topluyor.'
        : 'Sınır yolunda çatışma kaybedildi; köy alarmda.',
    );
  }

  /** Changes a resident's occupation and stores the change in their history. */
  public changeOccupation(npcId: string, occupation: OccupationId, workplace?: { x: number; y: number } | null): boolean {
    return this.village.changeOccupation(npcId, occupation, workplace);
  }

  public chooseDialogue(
    npcId: string, choiceId: string, inventory: Inventory, economy: Economy,
  ): DialogueView | null {
    const npc = this.village.getNpc(npcId);
    if (!npc) return null;
    this.dialogueInventory = inventory;
    this.dialogueEconomy = economy;
    return this.dialogue.choose(
      choiceId,
      { id: npc.id, name: npc.name, personality: npc.personality as PersonalityTraits },
      effect => this.canPayDialogueCost(effect),
    );
  }

  private canPayDialogueCost(effect: DialogueEffect): boolean {
    const cost = effect.cost;
    if (!cost) return true;
    if (cost.itemId && (this.dialogueInventory?.getItemCount(cost.itemId) ?? 0) < (cost.quantity ?? 1)) return false;
    if ((cost.currency ?? 0) > (this.dialogueEconomy?.getCurrency() ?? 0)) return false;
    return true;
  }

  public getDialogueState(): DialoguePersistentState { return this.dialogue.getState(); }

  public adjustQuestRelationship(npcId: string, amount: number): void {
    const domain: RelationshipDomain = npcId === 'ilyas_official' ? 'authorities'
      : npcId === 'kara_guard' || npcId === 'balaban_guard' ? 'military'
        : npcId === 'yusuf_merchant' ? 'merchants'
          : npcId === 'hasan_farmer' || npcId === 'rukiye_farmer' || npcId === 'fatma_villager' ? 'family' : 'friends';
    this.dialogue.adjustRelationship(npcId, domain, amount);
  }

  public closeDialogue(): void { this.dialogue.close(); }
  public hasPendingInteraction(npcId: string): boolean {
    return this.events.some(event => event.status === 'active' && event.targetNpcId === npcId);
  }

  private applyDialogueEffect(npcId: string, effect: DialogueEffect): void {
    const npc = this.village.getNpc(npcId);
    if (!npc) return;
    if (effect.cost?.itemId) this.dialogueInventory?.removeItem(effect.cost.itemId, effect.cost.quantity ?? 1);
    if (effect.cost?.currency) this.dialogueEconomy?.removeCurrency(effect.cost.currency);
    if (effect.trust) this.village.adjustTrust(npcId, effect.trust, 'conversation', `${npc.name} oyuncuya güvendi.`);
    if (effect.domain && effect.relationship) {
      const key = `social:${effect.domain}`;
      this.village.adjustRelationship(npcId, key, effect.relationship);
    }
    if (effect.quest) this.scene.events.emit('dialogue-quest-unlocked', { npcId, questId: effect.quest });
    if (effect.event) this.scene.events.emit('settlement-timeline-event', {
      ...effect.event, year: this.timeManager.getTime().year,
      consequences: [...effect.event.consequences], isFictional: true,
    });
  }

  public isMarketOpen(): boolean { return this.village.isMarketOpen(); }
  public getWeather(): SettlementWeather { return this.village.getWeather(); }
  public getWeatherIntensity(weather: VillageWeather): number { return this.village.getWeatherIntensity(weather); }
  public getWeatherName(): string { return this.village.getWeatherName(); }
  public getNpcs(): SettlementNpcState[] { return this.village.getNpcs(); }

  public getClockLabel(time: GameTime): string {
    const hour = this.timeManager.getHourOfDay();
    const hh = String(Math.floor(hour)).padStart(2, '0');
    const mm = String(Math.floor((hour % 1) * 60)).padStart(2, '0');
    return `${time.day}/${time.month}/${time.year} · ${hh}:${mm} · ${this.getWeatherName()}`;
  }

  public getSaveState(): SettlementSaveState {
    const clock = this.village.getClock();
    return {
      ...this.village.getSaveState(),
      timeScale: this.timeManager.getTimeScale(),
      lastProcessedHour: Math.floor(clock.absoluteHour),
      lastDay: clock.day,
      weather: clock.weather,
      weatherDay: clock.weatherDay,
      lastEventDay: this.lastEventDay,
      events: this.events.map(event => ({ ...event })),
      dialogue: this.dialogue.getState(),
    };
  }

  public loadSaveState(state: SettlementSaveState | LegacySettlementState | undefined): void {
    if (!state || typeof state !== 'object') return;
    if (state.schema === 2 && Array.isArray(state.npcs)) {
      this.village.loadSaveState(state as VillageSaveState);
      this.loadStoryState(state as SettlementSaveState);
      return;
    }
    this.loadLegacyState(state);
  }

  private loadStoryState(state: SettlementSaveState): void {
    if (typeof state.timeScale === 'number' && Number.isFinite(state.timeScale) && state.timeScale >= 0.5 && state.timeScale <= 4) {
      this.timeManager.setTimeScale(state.timeScale);
    }
    this.lastEventDay = typeof state.lastEventDay === 'number' && Number.isFinite(state.lastEventDay) ? state.lastEventDay : this.lastEventDay;
    this.events = Array.isArray(state.events) ? state.events.filter(validStoryEvent).slice(-MAX_SETTLEMENT_EVENTS).map(event => ({ ...event })) : [];
    this.dialogue.loadState(state.dialogue);
    this.storyDayHandled = this.village.getClock().day;
  }

  private loadLegacyState(state: LegacySettlementState): void {
    const lastProcessedHour = typeof state.lastProcessedHour === 'number' && Number.isFinite(state.lastProcessedHour)
      ? state.lastProcessedHour : 0;
    const day = typeof state.lastDay === 'number' && Number.isFinite(state.lastDay)
      ? Math.max(0, state.lastDay) : Math.floor(lastProcessedHour / 24);
    const hourOfDay = ((lastProcessedHour % 24) + 24) % 24;
    const clock: VillageClockState = {
      absoluteHour: lastProcessedHour,
      day,
      hourOfDay,
      phase: hourOfDay >= 5 && hourOfDay < 12 ? 'morning'
        : hourOfDay >= 12 && hourOfDay < 17 ? 'afternoon'
          : hourOfDay >= 17 && hourOfDay < 21 ? 'evening' : 'night',
      isMarketDay: day % 5 === 0,
      weather: state.weather && ['clear', 'cloudy', 'rain', 'fog', 'wind', 'snow'].includes(state.weather) ? state.weather : 'clear',
      ...(state.weatherFrom ? { weatherFrom: state.weatherFrom } : {}),
      ...(state.weatherTarget ? { weatherTarget: state.weatherTarget } : {}),
      ...(typeof state.weatherTransitionStartHour === 'number' ? { weatherTransitionStartHour: state.weatherTransitionStartHour } : {}),
      weatherDay: typeof state.weatherDay === 'number' && Number.isFinite(state.weatherDay) ? state.weatherDay : day,
      emergencyUntilHour: 0,
    };
    const npcs: VillageNpcSave[] = Array.isArray(state.npcs) ? state.npcs.flatMap(saved => {
      if (!saved || typeof saved.id !== 'string') return [];
      const candidate = this.village.getNpc(saved.id);
      if (!candidate) return [];
      const activity = ACTIVITY_MIGRATION[String(saved.activity)] ?? candidate.activity;
      return [{
        id: saved.id,
        name: typeof saved.name === 'string' ? saved.name : candidate.name,
        occupation: candidate.occupation,
        home: validPosition(saved.home) ? saved.home : candidate.home,
        workplace: saved.workplace && validPosition(saved.workplace) ? saved.workplace : candidate.workplace,
        position: validPosition(saved.position) ? saved.position : candidate.position,
        destination: validPosition(saved.destination) ? saved.destination : candidate.destination,
        activity,
        animation: activity === 'sleeping' ? 'sleeping' : 'idle',
        needs: {
          rest: clamp(Number(saved.needs?.rest ?? candidate.needs.rest)),
          food: clamp(Number(saved.needs?.food ?? candidate.needs.food)),
          safety: clamp(Number(saved.needs?.safety ?? candidate.needs.safety)),
          social: clamp(Number(saved.needs?.social ?? candidate.needs.social)),
        },
        personality: { ...candidate.personality, ...(saved.personality ?? {}) },
        attributes: { ...candidate.attributes, ...(saved.attributes ?? {}) },
        relationships: { ...candidate.relationships, ...(saved.relationships ?? {}) },
        playerTrust: typeof saved.playerTrust === 'number' && Number.isFinite(saved.playerTrust) ? clamp(saved.playerTrust, -100, 100) : 0,
        conversations: typeof saved.conversations === 'number' && Number.isFinite(saved.conversations) ? Math.max(0, Math.floor(saved.conversations)) : 0,
        memories: [],
        occupationHistory: [{ occupation: candidate.occupation, day }],
        reactionUntilHour: 0,
        lastInteractionDay: -1,
        lastStrangerHour: -999,
      }];
    }) : [];
    this.village.loadSaveState({ schema: 2, clock, incidents: [], npcs });
    this.lastEventDay = typeof state.lastEventDay === 'number' && Number.isFinite(state.lastEventDay) ? state.lastEventDay : -3;
    this.events = Array.isArray(state.events) ? state.events.filter(validStoryEvent).slice(-MAX_SETTLEMENT_EVENTS).map(event => ({ ...event })) : [];
    this.dialogue.loadState(state.dialogue);
    if (typeof state.timeScale === 'number' && Number.isFinite(state.timeScale) && state.timeScale >= 0.5 && state.timeScale <= 4) {
      this.timeManager.setTimeScale(state.timeScale);
    }
    this.storyDayHandled = day;
  }

  /** Re-align derived routines, weather and market hours after the calendar is restored. */
  public syncClock(): void {
    this.village.advanceTo(this.timeManager.getTime());
    this.lastDay = this.village.getClock().day;
    this.renderer.update(this.scene.time.now, this.debugPanel.getSelectedId(), this.overlayEnabled);
  }

  // ---------------------------------------------------------------- debug UI

  public toggleVillageDebug(): void {
    this.debugPanel.toggle();
    if (this.debugPanel.isOpen()) this.overlayEnabled = true;
  }

  public cycleVillageDebug(delta = 1): void {
    this.debugPanel.cycle(delta);
    if (!this.debugPanel.isOpen()) this.debugPanel.show();
  }

  public toggleVillageOverlay(): boolean {
    this.overlayEnabled = !this.overlayEnabled;
    return this.overlayEnabled;
  }

  public isVillageOverlayEnabled(): boolean { return this.overlayEnabled; }
  public getInspectedNpcId(): string | null { return this.debugPanel.getSelectedId(); }
  public getVillageDebugLines(npcId: string): string[] { return this.village.getDebugLines(npcId); }
  public getVillageStats(): ReturnType<VillageSimulation['getStats']> { return this.village.getStats(); }
  public raiseVillageIncident(type: VillageIncident['type'], x: number, y: number): void {
    this.village.raiseIncident(type, { x, y });
  }
  public startMilitaryEmergency(hours = 8): void { this.village.startEmergency(hours); }
  public rememberNpcInteraction(npcId: string, kind: NpcMemoryKind, summary: string, weight = 2): void {
    this.village.recordMemory(npcId, kind, summary, weight);
  }

  public destroy(): void {
    this.debugPanel.hide();
    this.renderer.destroy();
  }
}

function validStoryEvent(event: unknown): event is SettlementEvent {
  if (!event || typeof event !== 'object') return false;
  const candidate = event as Partial<SettlementEvent>;
  return typeof candidate.id === 'string'
    && typeof candidate.targetNpcId === 'string'
    && ['help_request', 'market_delay', 'local_dispute'].includes(String(candidate.type))
    && ['active', 'completed', 'expired'].includes(String(candidate.status))
    && typeof candidate.startDay === 'number' && Number.isFinite(candidate.startDay)
    && typeof candidate.expiresDay === 'number' && Number.isFinite(candidate.expiresDay);
}

export { Season };
export type { GameTime };
