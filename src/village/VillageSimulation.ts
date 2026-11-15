import type { GameTime } from '@systems/TimeManager';
import { NavigationGrid } from './NavigationGrid';
import { Pathfinder } from './Pathfinder';
import { NpcBrain, animationFor, type NpcDecision } from './NpcBrain';
import { advanceNpc } from './NpcMovement';
import { VillageClock } from './VillageClock';
import { getOccupation, isOccupationId } from './Occupations';
import { VILLAGE_NPCS } from './VillageData';
import { resolveDestination } from './VillageLocations';
import { describeSchedule } from './ScheduleResolver';
import type {
  GridPoint, NpcAnimationState, NpcMemoryEntry, NpcMemoryKind, OccupationId,
  VillageClockState, VillageIncident, VillageIncidentType, VillageNpcSave, VillageNpcState,
  VillageSaveState, VillageSimulationOptions, VillageSimulationStats, VillageWeather,
} from './types';

const MAX_INCIDENTS = 40;
const MAX_MEMORIES = 12;
const OFFSCREEN_INTERVAL_MS = 1000;
const MAX_PATH_PLANS_PER_TICK = 3;

interface StuckTrack {
  blockedSeconds: number;
  stillSeconds: number;
  attempts: number;
}

const WEATHER_NAMES: Record<VillageWeather, string> = {
  clear: 'Açık', cloudy: 'Bulutlu', rain: 'Yağmur', fog: 'Sis', wind: 'Rüzgâr', snow: 'Kar',
};

const ACTIVITY_TEXT: Record<string, string> = {
  sleeping: 'evinde uyuyor',
  eating: 'yemek yiyor',
  working: 'işinin başında',
  market: 'pazarda',
  socializing: 'komşularıyla sohbet ediyor',
  patrolling: 'yolu gözetliyor',
  fetching_water: 'kuyudan su taşıyor',
  idle: 'bekliyor',
  fleeing: 'güvenli bir yere çekiliyor',
  investigating: 'bir olayı araştırıyor',
  mustering: 'alarm noktasında toplanıyor',
};

function clamp(value: number, min = 0, max = 100): number { return Math.max(min, Math.min(max, value)); }
function distance(a: GridPoint, b: GridPoint): number { return Math.hypot(a.x - b.x, a.y - b.y); }
function copyPoint(point: GridPoint): GridPoint { return { x: point.x, y: point.y }; }
function startingNeeds(index: number): VillageNpcState['needs'] {
  const shift = index % 5;
  return {
    rest: 84 - shift * 3,
    food: 76 - shift * 2,
    safety: 74 - shift,
    social: 52 + shift * 2,
  };
}

/**
 * The village's single simulation owner: one clock, one navigation grid, one
 * pathfinder, and one update loop for every resident. Rendering and dialogue
 * adapters read snapshots from here; nothing in this file imports Phaser.
 */
export class VillageSimulation {
  readonly nav: NavigationGrid;
  readonly pathfinder: Pathfinder;
  private readonly clock: VillageClock;
  private readonly brain = new NpcBrain();
  private readonly npcs: VillageNpcState[];
  private readonly incidents: VillageIncident[] = [];
  private readonly stats: VillageSimulationStats = {
    fullUpdates: 0, offscreenUpdates: 0, pathSearches: 0,
    pathCacheHits: 0, repaths: 0, stuckRecoveries: 0,
  };
  private readonly stuckTracks = new Map<string, StuckTrack>();
  private readonly pendingPaths = new Set<string>();
  private visibleNpcIds: ReadonlySet<string> = new Set();
  private lastAbsoluteHour: number;
  private lastOffscreenUpdateMs = 0;
  private lastFrameMs = 0;
  private incidentCounter = 0;
  private readonly nextPathAttemptHour = new Map<string, number>();

  constructor(time: GameTime, options: VillageSimulationOptions) {
    this.nav = new NavigationGrid(options.width, options.height, options.isBlocked);
    this.pathfinder = new Pathfinder(this.nav);
    this.clock = new VillageClock(time);
    this.lastAbsoluteHour = this.clock.absoluteHour;
    this.visibleNpcIds = options.visibleNpcIds ?? new Set(VILLAGE_NPCS.map(npc => npc.id));
    this.npcs = VILLAGE_NPCS.map((definition, index) => this.createNpc(definition, index));
    this.refreshDecisions(new Set(this.visibleNpcIds), 0, true);
  }

  private createNpc(definition: (typeof VILLAGE_NPCS)[number], index: number): VillageNpcState {
    const home = this.nav.nearestWalkable(definition.home, 6);
    const workplace = definition.workplace ? this.nav.nearestWalkable(definition.workplace, 6) : null;
    return {
      id: definition.id,
      name: definition.name,
      occupation: definition.occupation,
      gender: definition.gender,
      appearance: definition.appearance,
      home,
      workplace,
      position: { ...home },
      destination: { ...home },
      activity: 'sleeping',
      animation: 'sleeping',
      phase: this.clock.phase,
      motivation: definition.motivation,
      needs: startingNeeds(index),
      personality: { ...definition.personality },
      attributes: { ...definition.attributes },
      relationships: { ...definition.relationships },
      playerTrust: 0,
      conversations: 0,
      memories: [],
      occupationHistory: [{ occupation: definition.occupation, day: this.clock.day }],
      schedule: {
        base: definition.schedule.base.map(block => ({ ...block })),
        ...(definition.schedule.marketDay ? { marketDay: definition.schedule.marketDay.map(block => ({ ...block })) } : {}),
        ...(definition.schedule.badWeather ? { badWeather: definition.schedule.badWeather.map(block => ({ ...block })) } : {}),
        ...(definition.schedule.emergency ? { emergency: definition.schedule.emergency.map(block => ({ ...block })) } : {}),
      },
      decisionReason: 'başlangıç',
      reactingTo: null,
      reactionUntilHour: 0,
      lastInteractionDay: -1,
      lastStrangerHour: -999,
      path: { path: [], index: 0, target: null, requestedAtHour: 0, failures: 0 },
      distanceTravelled: 0,
    };
  }

  // ------------------------------------------------------------------ clock

  getClock(): VillageClockState { return this.clock.getState(); }
  getWeather(): VillageWeather { return this.clock.weather; }
  getWeatherIntensity(weather: VillageWeather): number { return this.clock.getWeatherIntensity(weather); }
  getWeatherName(): string { return WEATHER_NAMES[this.clock.weather]; }
  isEmergency(): boolean { return this.clock.isEmergency(); }
  isMarketDay(): boolean { return this.clock.isMarketDay; }

  /** Raises the village-wide military alarm for the given number of game hours. */
  startEmergency(hours = 8, reason = 'Sınır alarmı'): void {
    this.clock.setEmergencyUntil(this.clock.absoluteHour + Math.max(1, Math.min(48, hours)));
    for (const npc of this.npcs) {
      if (npc.occupation === 'guard') {
        this.remember(npc, 'military', `${reason}: nöbet düzeni değişti.`, 3);
      }
    }
    this.refreshDecisions(new Set(this.npcs.map(npc => npc.id)), Date.now(), true);
  }

  endEmergency(): void {
    this.clock.setEmergencyUntil(this.clock.absoluteHour);
    this.refreshDecisions(new Set(this.npcs.map(npc => npc.id)), Date.now(), true);
  }

  /** Test/scripting hook; normal weather is deterministic from the calendar. */
  setWeatherForTesting(weather: VillageWeather): void {
    this.clock.setWeather(weather);
    this.refreshDecisions(new Set(this.npcs.map(npc => npc.id)), Date.now(), true);
  }

  // --------------------------------------------------------------- lifecycle

  /**
   * Called once per rendered frame. Visible villagers run on the full frame
   * budget; everyone else advances at most once per second without animation,
   * label or per-frame pathfinding work.
   */
  update(
    now: number,
    time: GameTime,
    playerPosition: GridPoint,
    visibleNpcIds?: ReadonlySet<string>,
  ): boolean {
    if (visibleNpcIds) this.visibleNpcIds = visibleNpcIds;
    const frameDelta = this.lastFrameMs === 0 ? 1 / 60 : Math.min(0.25, Math.max(0, (now - this.lastFrameMs) / 1000));
    this.lastFrameMs = now;
    const update = this.clock.sync(time);
    const elapsedHours = Math.max(0, Math.min(24, this.clock.absoluteHour - this.lastAbsoluteHour));
    if (update.hourChanged || update.dayChanged || update.phaseChanged
      || update.weatherChanged || update.marketDayChanged) {
      this.refreshDecisions(this.visibleNpcIds, now, update.hourChanged);
      this.maybeSpawnAutoIncident();
    }
    if (elapsedHours > 0) {
      this.updateNeeds(elapsedHours, update.hourChanged);
      this.lastAbsoluteHour = this.clock.absoluteHour;
    }
    this.expireIncidents();
    this.detectApproachingStranger(playerPosition);

    const offscreenTick = now - this.lastOffscreenUpdateMs >= OFFSCREEN_INTERVAL_MS;
    const offscreenDelta = offscreenTick ? Math.min(1, (now - this.lastOffscreenUpdateMs) / 1000) : 0;
    if (offscreenTick) this.lastOffscreenUpdateMs = now;

    const awakePositions = this.npcs.map(npc => npc.position);
    for (let index = 0; index < this.npcs.length; index++) {
      const npc = this.npcs[index]!;
      const visible = this.visibleNpcIds.has(npc.id);
      if (!visible) {
        if (!offscreenTick) continue;
        this.stats.offscreenUpdates++;
        if (this.pendingPaths.has(npc.id)) {
          this.planPath(npc);
          this.pendingPaths.delete(npc.id);
        }
        this.advanceOne(npc, index, offscreenDelta, awakePositions, false);
        continue;
      }

      this.stats.fullUpdates++;
      if (this.pendingPaths.has(npc.id)) {
        this.planPath(npc);
        this.pendingPaths.delete(npc.id);
      }
      if (this.needsPath(npc)) this.planPath(npc);
      this.advanceOne(npc, index, frameDelta, awakePositions, true);
    }
    return update.dayChanged;
  }

  /** Fast-forward derived schedules/needs after a day/week jump. */
  advanceTo(time: GameTime): boolean {
    const before = this.clock.day;
    this.clock.sync(time);
    const elapsedHours = Math.max(0, Math.min(24, this.clock.absoluteHour - this.lastAbsoluteHour));
    this.updateNeeds(elapsedHours, true);
    this.lastAbsoluteHour = this.clock.absoluteHour;
    this.refreshDecisions(new Set(this.npcs.map(npc => npc.id)), Date.now(), true);
    this.expireIncidents();
    return this.clock.day !== before;
  }

  private advanceOne(
    npc: VillageNpcState,
    index: number,
    dt: number,
    awakePositions: readonly GridPoint[],
    visible: boolean,
  ): void {
    if (this.needsPath(npc)) {
      if (visible) this.planPath(npc);
      else this.pendingPaths.add(npc.id);
    }
    const before = { ...npc.position };
    const outcome = advanceNpc(npc, this.nav, dt, {
      speed: getOccupation(npc.occupation).walkSpeed * (this.clock.weather === 'snow' ? 0.78 : this.clock.weather === 'rain' ? 0.9 : this.clock.weather === 'wind' ? 0.94 : 1),
      others: awakePositions.filter((_, otherIndex) => otherIndex !== index),
      separation: visible && npc.activity !== 'sleeping',
    });
    if (outcome.arrived) {
      const finalTarget = npc.path.path[npc.path.path.length - 1];
      if (finalTarget && distance(npc.position, finalTarget) < 0.45) {
        npc.position = { ...finalTarget };
      }
      if (npc.path.target && distance(npc.position, npc.path.target) > 0.8) {
        npc.path.failures++;
        if (npc.path.failures >= 2) {
          npc.path.path = [];
          npc.path.target = null;
          npc.activity = 'idle';
          npc.destination = { ...npc.position };
          npc.decisionReason = 'Hedefe giden yol kapalı; beklemede';
          npc.path.failures = 0;
        }
      } else {
        npc.path.failures = 0;
      }
    }

    const moving = npc.path.index < npc.path.path.length;
    const arrived = !moving && distance(npc.position, npc.destination) < 0.75;
    npc.animation = animationFor(npc.activity, moving, arrived) as NpcAnimationState;
    if (npc.animation === 'idle' && npc.activity === 'market' && arrived) {
      npc.animation = npc.occupation === 'merchant' || npc.occupation === 'baker' ? 'working' : 'talking';
    }
    this.trackStuck(npc, outcome.blocked, before, dt);
    void visible;
  }

  private trackStuck(
    npc: VillageNpcState,
    blocked: boolean,
    before: GridPoint,
    dt: number,
  ): void {
    if (npc.path.index >= npc.path.path.length) {
      this.stuckTracks.delete(npc.id);
      return;
    }
    const track = this.stuckTracks.get(npc.id) ?? { blockedSeconds: 0, stillSeconds: 0, attempts: 0 };
    const moved = distance(before, npc.position);
    track.blockedSeconds = blocked ? track.blockedSeconds + dt : 0;
    track.stillSeconds = moved < 0.01 ? track.stillSeconds + dt : 0;
    this.stuckTracks.set(npc.id, track);
    if (track.blockedSeconds < 1.2 && track.stillSeconds < 3.5) return;

    this.stats.stuckRecoveries++;
    track.attempts++;
    track.blockedSeconds = 0;
    track.stillSeconds = 0;
    this.stats.repaths++;
    this.planPath(npc);
    if (track.attempts >= 3) {
      // Last resort: stand on the nearest legal tile, stop pushing at the
      // obstacle, and let the next schedule tick try a fresh route.
      npc.position = this.nav.nearestWalkable(npc.position);
      npc.path = { path: [], index: 0, target: null, requestedAtHour: this.clock.absoluteHour, failures: 0 };
      npc.activity = 'idle';
      npc.destination = { ...npc.position };
      npc.decisionReason = 'Yol tıkalı; güvenli noktaya çekildi';
      npc.animation = 'idle';
      track.attempts = 0;
    }
  }

  // ------------------------------------------------------------------- paths

  private needsPath(npc: VillageNpcState): boolean {
    if (npc.path.index < npc.path.path.length) return false;
    if (distance(npc.position, npc.destination) <= 0.45 || npc.activity === 'idle') return false;
    const retry = this.nextPathAttemptHour.get(npc.id);
    return retry === undefined || retry <= this.clock.absoluteHour;
  }

  private planPath(npc: VillageNpcState): void {
    const occupancy = (x: number, y: number): number => {
      let count = 0;
      for (const other of this.npcs) {
        if (other.id === npc.id || other.activity === 'sleeping') continue;
        if (Math.round(other.position.x) === x && Math.round(other.position.y) === y) count++;
      }
      return count;
    };
    const result = this.pathfinder.findPath(npc.position, npc.destination, occupancy);
    this.stats.pathSearches++;
    if (result.path.length === 0 && !result.found) {
      npc.path.failures++;
      npc.path.path = [];
      npc.path.target = { ...npc.destination };
      echoPathFailure(this.nextPathAttemptHour, npc.id, this.clock.absoluteHour);
      if (npc.path.failures >= 2) {
        npc.activity = 'idle';
        npc.destination = { ...this.nav.nearestWalkable(npc.position) };
        npc.decisionReason = 'Yol bulunamadı; görev ertelendi';
      }
      return;
    }
    this.nextPathAttemptHour.delete(npc.id);
    npc.path = {
      path: result.path,
      index: 0,
      target: { ...result.goal },
      requestedAtHour: this.clock.absoluteHour,
      failures: npc.path.failures,
    };
    if (result.approximate) {
      npc.decisionReason = `${npc.decisionReason} · hedefe en yakın açık nokta`;
    }
  }

  // ------------------------------------------------------------------ brains

  private refreshDecisions(
    ids: ReadonlySet<string>,
    _now: number,
    force = false,
  ): void {
    const emergency = this.clock.isEmergency();
    let planned = 0;
    for (let index = 0; index < this.npcs.length; index++) {
      const npc = this.npcs[index]!;
      if (!force && !ids.has(npc.id) && npc.reactionUntilHour > this.clock.absoluteHour) continue;
      const decision = this.brain.decide(npc, this.clock.getState(), index, emergency, this.incidents);
      this.applyDecision(npc, decision, index, planned);
      if (this.visibleNpcIds.has(npc.id)) planned++;
    }
  }

  private applyDecision(
    npc: VillageNpcState,
    decision: NpcDecision,
    rosterIndex: number,
    planned: number,
  ): void {
    const destinationChanged = npc.destination.x !== decision.destination.x
      || npc.destination.y !== decision.destination.y;
    const activityChanged = npc.activity !== decision.activity;
    npc.activity = decision.activity;
    npc.phase = this.clock.phase;
    npc.destination = { ...decision.destination };
    npc.decisionReason = decision.reason;
    npc.reactingTo = decision.reactingTo;
    if (decision.source === 'reaction') {
      const incident = this.incidents.find(item => item.id === decision.reactingTo);
      npc.reactionUntilHour = incident?.expiresHour ?? this.clock.absoluteHour + 1;
      if (incident && !incident.responders.includes(npc.id)) incident.responders.push(npc.id);
    } else if (npc.reactionUntilHour > 0 && npc.reactionUntilHour <= this.clock.absoluteHour) {
      npc.reactionUntilHour = 0;
    }

    if (!destinationChanged && !activityChanged && npc.path.path.length > 0) {
      this.stats.pathCacheHits++;
      return;
    }
    if (!destinationChanged && npc.path.target
      && npc.path.target.x === decision.destination.x && npc.path.target.y === decision.destination.y) {
      this.stats.pathCacheHits++;
      return;
    }

    npc.path = {
      path: [], index: 0, target: null,
      requestedAtHour: this.clock.absoluteHour,
      failures: 0,
    };
    this.nextPathAttemptHour.delete(npc.id);
    const visible = this.visibleNpcIds.has(npc.id);
    if (visible && planned < MAX_PATH_PLANS_PER_TICK) this.planPath(npc);
    else this.pendingPaths.add(npc.id);
    void rosterIndex;
  }

  // ------------------------------------------------------------------- needs

  private updateNeeds(hours: number, hourChanged: boolean): void {
    if (hours <= 0) return;
    for (const npc of this.npcs) {
      const sleeping = npc.activity === 'sleeping' && npc.path.index >= npc.path.path.length;
      const exertion = npc.activity === 'patrolling' ? 1.6
        : npc.activity === 'working' || npc.activity === 'fetching_water' ? 1.2
          : npc.activity === 'fleeing' || npc.activity === 'mustering' ? 1.4 : 0.8;
      npc.needs.rest = clamp(npc.needs.rest + (sleeping ? 7 : -exertion) * hours);
      npc.needs.food = clamp(npc.needs.food - (npc.activity === 'working' ? 0.85 : 0.5) * hours);
      if (npc.activity === 'eating') npc.needs.food = clamp(npc.needs.food + 14 * hours);
      npc.needs.safety = clamp(npc.needs.safety + (npc.activity === 'patrolling' ? 1.2 : sleeping ? 0.2 : -0.1) * hours);
      npc.needs.social = clamp(npc.needs.social
        + (npc.activity === 'socializing' ? 2.2 : npc.activity === 'market' ? 0.4 : -0.18) * hours);
      const hour = Math.floor(this.clock.hourOfDay);
      if (hourChanged && hour === 7 && npc.needs.food < 58 && npc.activity !== 'eating') {
        npc.needs.food = clamp(npc.needs.food + 14);
      }
    }
  }

  // ---------------------------------------------------------------- incidents

  raiseIncident(
    type: VillageIncidentType,
    position: GridPoint,
    severity = 1,
    description?: string,
  ): VillageIncident {
    const safe = this.nav.nearestWalkable({ x: Math.round(position.x), y: Math.round(position.y) });
    const duration = type === 'fire' ? 4 : type === 'theft' ? 2 : type === 'combat' ? 3 : 0.5;
    const incident: VillageIncident = {
      id: `incident_${type}_${Math.round(this.clock.absoluteHour * 100)}_${this.incidentCounter++}`,
      type,
      position: safe,
      severity: clamp(severity, 1, 5),
      startHour: this.clock.absoluteHour,
      expiresHour: this.clock.absoluteHour + duration,
      status: 'active',
      responders: [],
      description: description ?? this.incidentDescription(type, safe),
    };
    this.incidents.push(incident);
    if (this.incidents.length > MAX_INCIDENTS) this.incidents.splice(0, this.incidents.length - MAX_INCIDENTS);
    this.refreshDecisions(new Set(this.npcs.map(npc => npc.id)), Date.now(), true);
    return { ...incident, position: { ...incident.position }, responders: [...incident.responders] };
  }

  /** A conversation reassures the village that the newcomer is not a threat. */
  calmStranger(): void {
    const active = this.incidents.filter(incident => incident.type === 'stranger' && incident.status === 'active');
    for (const incident of active) this.resolveIncident(incident.id);
  }

  resolveIncident(id: string): boolean {
    const incident = this.incidents.find(item => item.id === id);
    if (!incident || incident.status !== 'active') return false;
    incident.status = 'resolved';
    for (const responderId of incident.responders) {
      const responder = this.npcs.find(npc => npc.id === responderId);
      if (responder) {
        this.remember(responder, 'incident', `${incident.description} çözüldü.`, 2);
        responder.reactionUntilHour = 0;
      }
    }
    this.refreshDecisions(new Set(this.npcs.map(npc => npc.id)), Date.now(), true);
    return true;
  }

  private expireIncidents(): void {
    let changed = false;
    for (const incident of this.incidents) {
      if (incident.status === 'active' && incident.expiresHour <= this.clock.absoluteHour) {
        incident.status = 'resolved';
        changed = true;
        for (const responderId of incident.responders) {
          const responder = this.npcs.find(npc => npc.id === responderId);
          if (responder) {
            responder.reactionUntilHour = 0;
            this.remember(responder, 'incident', `${incident.description} sona erdi.`, 1);
          }
        }
      }
    }
    if (changed) this.refreshDecisions(new Set(this.npcs.map(npc => npc.id)), Date.now(), true);
  }

  private maybeSpawnAutoIncident(): void {
    const hour = Math.floor(this.clock.hourOfDay);
    const day = this.clock.day;
    if (day <= 0) return;
    const slot = day % 4;
    let type: VillageIncidentType | null = null;
    let point: GridPoint | null = null;
    if (slot === 0 && hour === 10) { type = 'theft'; point = { x: 18, y: 16 }; }
    if (slot === 1 && hour === 15) { type = 'fire'; point = { x: 22, y: 22 }; }
    if (slot === 2 && hour === 18) { type = 'combat'; point = { x: 28, y: 14 }; }
    if (!type || !point) return;
    const already = this.incidents.some(incident =>
      incident.type === type && Math.floor(incident.startHour / 24) === day);
    if (already) return;
    this.raiseIncident(type, point, 2);
    for (const npc of this.npcs) {
      if (distance(npc.position, point) <= 10) {
        this.remember(npc, 'incident', `${this.incidentDescription(type, point)} gördü.`, 2);
      }
    }
  }

  private detectApproachingStranger(playerPosition: GridPoint): void {
    if (this.clock.phase === 'night') return;
    if (this.incidents.some(incident => incident.type === 'stranger' && incident.status === 'active')) return;
    const candidate = this.npcs.find(npc =>
      npc.activity !== 'sleeping'
      && npc.conversations === 0
      && this.clock.absoluteHour - npc.lastStrangerHour > 24
      && distance(npc.position, playerPosition) < 2.4);
    if (!candidate) return;
    candidate.lastStrangerHour = this.clock.absoluteHour;
    const incident = this.raiseIncident('stranger', playerPosition, 1, 'Köye yaklaşan yabancı');
    for (const npc of this.npcs) {
      if (distance(npc.position, playerPosition) <= 5) {
        npc.lastStrangerHour = this.clock.absoluteHour;
        this.remember(npc, 'stranger', 'Köye tanımadığı biri yaklaştı.', 1);
      }
    }
    if (incident.responders.length === 0) incident.responders.push(candidate.id);
  }

  private incidentDescription(type: VillageIncidentType, point: GridPoint): string {
    const where = `${Math.round(point.x)},${Math.round(point.y)}`;
    switch (type) {
      case 'fire': return `Depo yakınında yangın (${where})`;
      case 'theft': return `Pazarda hırsızlık (${where})`;
      case 'combat': return `Sınır yolunda çatışma (${where})`;
      case 'stranger':
      default: return `Köye yabancı yaklaştı (${where})`;
    }
  }

  // ------------------------------------------------------------------ memory

  remember(npc: VillageNpcState, kind: NpcMemoryKind, summary: string, weight = 1): void {
    const entry: NpcMemoryEntry = {
      id: `${npc.id}_${kind}_${Math.round(this.clock.absoluteHour * 100)}_${npc.memories.length}`,
      kind,
      day: this.clock.day,
      hour: Math.floor(this.clock.hourOfDay),
      summary,
      weight: clamp(weight, -10, 10),
    };
    npc.memories.push(entry);
    if (npc.memories.length > MAX_MEMORIES) npc.memories.splice(0, npc.memories.length - MAX_MEMORIES);
  }

  recordPlayerInteraction(
    npcId: string,
    kind: NpcMemoryKind,
    summary: string,
    trustDelta = 1,
    weight = 2,
  ): void {
    const npc = this.npcs.find(candidate => candidate.id === npcId);
    if (!npc) return;
    npc.conversations++;
    npc.playerTrust = clamp(npc.playerTrust + trustDelta, -100, 100);
    npc.lastInteractionDay = this.clock.day;
    this.remember(npc, kind, summary, weight);
  }

  recordMemory(npcId: string, kind: NpcMemoryKind, summary: string, weight = 2): void {
    const npc = this.npcs.find(candidate => candidate.id === npcId);
    if (npc) this.remember(npc, kind, summary, weight);
  }

  adjustTrust(
    npcId: string, delta: number, kind: NpcMemoryKind = 'conversation', summary = 'Oyuncuyla önemli bir an yaşandı.',
  ): void {
    const npc = this.npcs.find(candidate => candidate.id === npcId);
    if (!npc) return;
    npc.playerTrust = clamp(npc.playerTrust + delta, -100, 100);
    npc.lastInteractionDay = this.clock.day;
    this.remember(npc, kind, summary, clamp(delta / 3, -6, 6));
  }

  adjustRelationship(fromNpcId: string, toNpcId: string, delta: number): void {
    const from = this.npcs.find(candidate => candidate.id === fromNpcId);
    if (!from) return;
    from.relationships[toNpcId] = clamp((from.relationships[toNpcId] ?? 0) + delta, -100, 100);
  }

  recordMilitaryOutcome(victory: boolean, casualties: number): void {
    const guards = this.npcs.filter(npc => npc.occupation === 'guard');
    const change = victory ? Math.max(-2, 8 - Math.floor(casualties / 2)) : -8;
    for (const guard of guards) {
      guard.playerTrust = clamp(guard.playerTrust + change, -100, 100);
      guard.relationships.player_family = clamp((guard.relationships.player_family ?? 0) + change, -100, 100);
      this.remember(guard, 'military', victory
        ? `Sınır çatışması kazanıldı; ${casualties} kayıp.`
        : `Sınır çatışması kaybedildi; ${casualties} kayıp.`, victory ? 3 : -3);
    }
    if (!victory || casualties > 0) this.startEmergency(12, victory ? 'Kayıplı zafer' : 'Sınır yenilgisi');
  }

  changeOccupation(npcId: string, occupation: OccupationId, workplace?: GridPoint | null): boolean {
    const npc = this.npcs.find(candidate => candidate.id === npcId);
    if (!npc || !isOccupationId(occupation) || npc.occupation === occupation) return false;
    npc.occupation = occupation;
    if (workplace === null) {
      npc.workplace = null;
    } else {
      const fallbackHome = getOccupation(occupation).defaultDestination === 'home';
      npc.workplace = this.nav.nearestWalkable(workplace ?? (fallbackHome ? npc.home : npc.workplace ?? npc.home));
    }
    npc.occupationHistory.push({ occupation, day: this.clock.day });
    this.remember(npc, 'occupation', `Mesleği ${getOccupation(occupation).label} oldu.`, 2);
    npc.path = { path: [], index: 0, target: null, requestedAtHour: this.clock.absoluteHour, failures: 0 };
    this.refreshDecisions(new Set([npc.id]), Date.now(), true);
    return true;
  }

  // --------------------------------------------------------------- accessors

  getNpcs(): VillageNpcState[] {
    return this.npcs.map(npc => this.cloneNpc(npc));
  }

  /** Internal read-only roster for the renderer and debug overlay. */
  getRoster(): readonly VillageNpcState[] { return this.npcs; }

  getNpc(id: string): VillageNpcState | null {
    const npc = this.npcs.find(candidate => candidate.id === id);
    return npc ? this.cloneNpc(npc) : null;
  }

  private cloneNpc(npc: VillageNpcState): VillageNpcState {
    return {
      ...npc,
      home: copyPoint(npc.home),
      workplace: npc.workplace ? copyPoint(npc.workplace) : null,
      position: copyPoint(npc.position),
      destination: copyPoint(npc.destination),
      needs: { ...npc.needs },
      personality: { ...npc.personality },
      attributes: { ...npc.attributes },
      relationships: { ...npc.relationships },
      memories: npc.memories.map(memory => ({ ...memory })),
      occupationHistory: npc.occupationHistory.map(entry => ({ ...entry })),
      schedule: {
        base: npc.schedule.base.map(block => ({ ...block })),
        ...(npc.schedule.marketDay ? { marketDay: npc.schedule.marketDay.map(block => ({ ...block })) } : {}),
        ...(npc.schedule.badWeather ? { badWeather: npc.schedule.badWeather.map(block => ({ ...block })) } : {}),
        ...(npc.schedule.emergency ? { emergency: npc.schedule.emergency.map(block => ({ ...block })) } : {}),
      },
      path: {
        ...npc.path,
        path: npc.path.path.map(point => ({ ...point })),
        target: npc.path.target ? { ...npc.path.target } : null,
      },
    };
  }

  findNearbyNpc(position: GridPoint, range = 1.6): VillageNpcState | null {
    let closest: VillageNpcState | null = null;
    let best = range;
    for (const npc of this.npcs) {
      const d = distance(npc.position, position);
      if (d < best) { closest = npc; best = d; }
    }
    return closest ? this.cloneNpc(closest) : null;
  }

  getActivityText(npcId: string): string {
    const npc = this.npcs.find(candidate => candidate.id === npcId);
    if (!npc) return 'Burada kimse yok.';
    return `${npc.name}: ${ACTIVITY_TEXT[npc.activity] ?? 'meşgul'}. İhtiyacı: ${npc.motivation}.`;
  }

  isMarketOpen(): boolean {
    if (this.clock.isEmergency()) return false;
    const merchant = this.npcs.find(npc => npc.occupation === 'merchant');
    if (!merchant || merchant.activity !== 'market') return false;
    if (distance(merchant.position, { x: 18, y: 16 }) > 4) return false;
    const hour = this.clock.hourOfDay;
    const rainy = this.clock.weather === 'rain' || this.clock.weather === 'snow' || this.clock.weather === 'fog' || this.clock.weather === 'wind';
    const opens = this.clock.isMarketDay ? 7 : rainy ? 10 : 8;
    const closes = rainy ? 15 : this.clock.isMarketDay ? 19 : 18;
    return hour >= opens && hour < closes;
  }

  getScheduleForNpc(npcId: string): string[] {
    const npc = this.npcs.find(candidate => candidate.id === npcId);
    return npc ? describeSchedule(npc) : [];
  }

  getDebugLines(npcId: string): string[] {
    const npc = this.npcs.find(candidate => candidate.id === npcId);
    if (!npc) return ['NPC bulunamadı'];
    const clock = this.clock.getState();
    const pathRemaining = Math.max(0, npc.path.path.length - npc.path.index);
    const pathText = npc.path.path.length === 0
      ? 'yol yok'
      : `${npc.path.path.length} nokta, ${pathRemaining} kaldı`;
    return [
      `${npc.name} · ${getOccupation(npc.occupation).label} · ${clock.phase}`,
      `Aktivite: ${npc.activity} · animasyon: ${npc.animation}`,
      `Hedef: ${Math.round(npc.destination.x)},${Math.round(npc.destination.y)} · ${npc.decisionReason}`,
      `Yol: ${pathText} · ızgara ${npc.position.x.toFixed(1)},${npc.position.y.toFixed(1)}`,
      `İhtiyaç: dinlenme ${Math.round(npc.needs.rest)} · yemek ${Math.round(npc.needs.food)} · güvenlik ${Math.round(npc.needs.safety)} · sosyal ${Math.round(npc.needs.social)}`,
      `Güven: oyuncu ${npc.playerTrust} · konuşma ${npc.conversations} · ilişki ${Object.entries(npc.relationships).slice(0, 3).map(([id, value]) => `${id}:${value}`).join(' ')}`,
      `Hafıza: ${npc.memories.slice(-2).map(memory => memory.summary).join(' | ') || 'kayıt yok'}`,
      `Günlük çizelge: ${(describeSchedule(npc)[0] ?? '').replace('Günlük: ', '')}`,
      ...(this.clock.isEmergency()
        ? describeSchedule(npc)
          .filter(line => line.startsWith('Acil durum:'))
          .map(line => `Acil çizelge: ${line.replace('Acil durum: ', '')}`)
        : []),
    ];
  }

  getStats(): VillageSimulationStats { return { ...this.stats }; }

  // ------------------------------------------------------------------- saves

  getSaveState(): VillageSaveState {
    return {
      schema: 2,
      clock: this.clock.getState(),
      incidents: this.incidents.map(incident => ({
        ...incident,
        position: copyPoint(incident.position),
        responders: [...incident.responders],
      })),
      npcs: this.npcs.map(npc => this.saveNpc(npc)),
    };
  }

  private saveNpc(npc: VillageNpcState): VillageNpcSave {
    return {
      id: npc.id,
      name: npc.name,
      occupation: npc.occupation,
      home: copyPoint(npc.home),
      workplace: npc.workplace ? copyPoint(npc.workplace) : null,
      position: copyPoint(npc.position),
      destination: copyPoint(npc.destination),
      activity: npc.activity,
      animation: npc.animation,
      needs: { ...npc.needs },
      personality: { ...npc.personality },
      attributes: { ...npc.attributes },
      relationships: { ...npc.relationships },
      playerTrust: npc.playerTrust,
      conversations: npc.conversations,
      memories: npc.memories.map(memory => ({ ...memory })),
      occupationHistory: npc.occupationHistory.map(entry => ({ ...entry })),
      reactionUntilHour: npc.reactionUntilHour,
      lastInteractionDay: npc.lastInteractionDay,
      lastStrangerHour: npc.lastStrangerHour,
    };
  }

  loadSaveState(state: VillageSaveState | undefined): void {
    if (!state || state.schema !== 2 || !Array.isArray(state.npcs)) return;
    this.clock.load(state.clock);
    this.lastAbsoluteHour = this.clock.absoluteHour;
    this.incidents.length = 0;
    if (Array.isArray(state.incidents)) {
      for (const saved of state.incidents.slice(-MAX_INCIDENTS)) {
        if (!saved || typeof saved.id !== 'string' || !isPoint(saved.position)) continue;
        if (!['fire', 'theft', 'combat', 'stranger'].includes(saved.type)) continue;
        if (!['active', 'resolved'].includes(saved.status)) continue;
        this.incidents.push({
          ...saved,
          position: copyPoint(saved.position),
          responders: Array.isArray(saved.responders)
            ? saved.responders.filter(id => typeof id === 'string').slice(0, 40)
            : [],
        });
      }
    }
    for (const saved of state.npcs) {
      const npc = this.npcs.find(candidate => candidate.id === saved.id);
      if (!npc || !saved || typeof saved !== 'object') continue;
      if (isPoint(saved.position)) npc.position = this.nav.nearestWalkable(saved.position);
      if (isPoint(saved.destination)) npc.destination = this.nav.nearestWalkable(saved.destination);
      if (isPoint(saved.home)) npc.home = this.nav.nearestWalkable(saved.home);
      npc.workplace = saved.workplace && isPoint(saved.workplace) ? this.nav.nearestWalkable(saved.workplace) : null;
      if (isOccupationId(saved.occupation)) npc.occupation = saved.occupation;
      if (typeof saved.name === 'string' && saved.name.length > 0 && saved.name.length <= 80) npc.name = saved.name;
      if (['sleeping', 'eating', 'working', 'market', 'socializing', 'patrolling', 'fetching_water', 'idle', 'fleeing', 'investigating', 'mustering'].includes(saved.activity)) {
        npc.activity = saved.activity;
      }
      if (['idle', 'walking', 'working', 'talking', 'sleeping'].includes(saved.animation)) {
        npc.animation = saved.animation;
      }
      for (const need of ['rest', 'food', 'safety', 'social'] as const) {
        if (Number.isFinite(saved.needs?.[need])) npc.needs[need] = clamp(saved.needs[need]);
      }
      for (const trait of ['ambition', 'courage', 'patience', 'generosity', 'caution', 'loyalty', 'negotiation', 'sociability'] as const) {
        if (Number.isFinite(saved.personality?.[trait])) npc.personality[trait] = clamp(saved.personality[trait]);
      }
      for (const attribute of ['strength', 'agility', 'wit', 'endurance', 'craft', 'faith'] as const) {
        if (Number.isFinite(saved.attributes?.[attribute])) npc.attributes[attribute] = clamp(saved.attributes[attribute]);
      }
      if (saved.relationships && typeof saved.relationships === 'object') {
        for (const [id, value] of Object.entries(saved.relationships)) {
          if (Number.isFinite(value)) npc.relationships[id] = clamp(value, -100, 100);
        }
      }
      npc.playerTrust = Number.isFinite(saved.playerTrust) ? clamp(saved.playerTrust, -100, 100) : npc.playerTrust;
      npc.conversations = Number.isFinite(saved.conversations) ? Math.max(0, Math.floor(saved.conversations)) : npc.conversations;
      npc.memories = Array.isArray(saved.memories)
        ? saved.memories
          .filter(memory => !!memory && typeof memory.summary === 'string' && memory.summary.length <= 240)
          .slice(-MAX_MEMORIES)
          .map((memory, memoryIndex) => ({
            id: typeof memory.id === 'string' ? memory.id : `${npc.id}_loaded_${memoryIndex}`,
            kind: memory.kind,
            day: Number.isFinite(memory.day) ? memory.day : 0,
            hour: Number.isFinite(memory.hour) ? memory.hour : 0,
            summary: memory.summary,
            weight: Number.isFinite(memory.weight) ? clamp(memory.weight, -10, 10) : 1,
          }))
        : npc.memories;
      npc.occupationHistory = Array.isArray(saved.occupationHistory)
        ? saved.occupationHistory
          .filter(entry => !!entry && isOccupationId(entry.occupation) && Number.isFinite(entry.day))
          .slice(-20)
          .map(entry => ({ occupation: entry.occupation, day: Math.max(0, Math.floor(entry.day)) }))
        : npc.occupationHistory;
      npc.reactionUntilHour = Number.isFinite(saved.reactionUntilHour) ? saved.reactionUntilHour : 0;
      npc.lastInteractionDay = Number.isFinite(saved.lastInteractionDay) ? saved.lastInteractionDay : -1;
      npc.lastStrangerHour = Number.isFinite(saved.lastStrangerHour) ? saved.lastStrangerHour : -999;
      npc.path = { path: [], index: 0, target: null, requestedAtHour: this.clock.absoluteHour, failures: 0 };
    }
    this.refreshDecisions(new Set(this.npcs.map(npc => npc.id)), Date.now(), true);
  }

  private cloneDecisionPoint(point: GridPoint): GridPoint { return copyPoint(point); }
  /** Exposed for the adapter's legacy migration and tests. */
  resolveDestinationFor(npcId: string, key: string): GridPoint {
    const npc = this.npcs.find(candidate => candidate.id === npcId);
    if (!npc) return { x: 0, y: 0 };
    return this.cloneDecisionPoint(resolveDestination(npc, key, this.npcs.indexOf(npc)));
  }
}

function echoPathFailure(map: Map<string, number>, npcId: string, absoluteHour: number): void {
  map.set(npcId, absoluteHour + 1);
}

function isPoint(value: unknown): value is GridPoint {
  if (!value || typeof value !== 'object') return false;
  const point = value as { x?: unknown; y?: unknown };
  return typeof point.x === 'number' && Number.isFinite(point.x)
    && typeof point.y === 'number' && Number.isFinite(point.y);
}
