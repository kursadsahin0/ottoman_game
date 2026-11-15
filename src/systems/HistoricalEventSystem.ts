import {
  HistoricalEvent,
  HISTORICAL_EVENTS,
  RULERS,
  EventChoice,
  EventConsequence,
} from '@data/HistoricalData';
import { HISTORICAL_BASELINE } from '@data/HistoricalContent';

export interface HistoricalTimelineState {
  canonicalTimeline: {
    currentYear: number;
    currentRuler: string;
    knownEvents: string[];
  };
  simulationTimeline: {
    currentYear: number;
    currentRuler: string;
    triggeredEvents: string[];
    eventOutcomes: Record<string, EventOutcome>;
    divergences: TimelineDivergence[];
    flags: Record<string, any>;
    pendingConsequences?: PendingHistoricalConsequence[];
  };
}

export interface PendingHistoricalConsequence { id:string; eventId:string; dueDay:number; consequence:EventConsequence }

export interface EventOutcome {
  eventId: string;
  chosenChoiceId: string;
  timestamp: number;
  gameYear: number;
  consequences: EventConsequence[];
  isDivergent: boolean;
  historicalBaseline: string;
  classification?:'historical_path'|'fictional'|'alternate_history';
  baselineEventId?:string;
  divergenceExplanation?:string;
}

export interface TimelineDivergence {
  eventId: string;
  historicalBaseline: string;
  playerAction: string;
  simulatedOutcome: string;
  consequences: string[];
  isMajorDivergence: boolean;
  timestamp: number;
  baselineEventId?:string;
  explanation?:string;
}

export interface EventTriggerResult {
  triggered: boolean;
  event?: HistoricalEvent;
  reason?: string;
}

export class HistoricalEventSystem {
  /** Keeps duplicate checks constant-time as the authored simulation history grows. */
  private triggeredEventIds = new Set<string>();
  private state: HistoricalTimelineState = {
    canonicalTimeline: {
      currentYear: 1299,
      currentRuler: 'osman_gazi',
      knownEvents: HISTORICAL_BASELINE.map(event=>event.id),
    },
    simulationTimeline: {
      currentYear: 1299,
      currentRuler: 'osman_gazi',
      triggeredEvents: [],
      eventOutcomes: {},
      divergences: [],
      flags: {},
      pendingConsequences:[],
    },
  };

  private context: {
    reputation: number;
    rank: string;
    relationships: Record<string, number>;
    completedEvents: string[];
    completedMissions: string[];
    currency:number;
    militaryStrength:number;
    factionStanding:Record<string,number>;
    familyGeneration:number;
    totalDays:number;
  } = {
    reputation: 0,
    rank: 'recruit',
    relationships: {},
    completedEvents: [],
    completedMissions: [],
    currency:0, militaryStrength:0, factionStanding:{}, familyGeneration:1, totalDays:0,
  };

  getState(): HistoricalTimelineState {
    return JSON.parse(JSON.stringify(this.state));
  }

  /** Records player-authored political events on the simulation timeline. */
  recordSimulationEvent(event: { id: string; title: string; description: string; year: number; choice: string; consequences: string[]; isFictional: boolean; divergesFromBaseline?:boolean; baselineEventId?:string; divergenceExplanation?:string }): void {
    const timeline = this.state.simulationTimeline;
    if (this.triggeredEventIds.has(event.id)) return;
    timeline.triggeredEvents.push(event.id);
    this.triggeredEventIds.add(event.id);
    const baseline = event.isFictional ? 'Fictional scenario - no historical baseline' : 'Documented historical baseline';
    const timestamp=this.context.totalDays;
    timeline.eventOutcomes[event.id] = {
      eventId: event.id, chosenChoiceId: event.choice, timestamp, gameYear: event.year,
      consequences: event.consequences.map(description => ({ type: 'set_flag', value: description, description })),
      isDivergent: event.divergesFromBaseline===true, historicalBaseline: baseline,
      classification:event.divergesFromBaseline?'alternate_history':event.isFictional?'fictional':'historical_path',
      ...(event.baselineEventId?{baselineEventId:event.baselineEventId}:{}),
      ...(event.divergenceExplanation?{divergenceExplanation:event.divergenceExplanation}:{}),
    };
    if(event.divergesFromBaseline)timeline.divergences.push({ eventId:event.id, historicalBaseline:baseline, playerAction:event.choice,
      simulatedOutcome:event.description, consequences:event.consequences, isMajorDivergence:true, timestamp,
      ...(event.baselineEventId?{baselineEventId:event.baselineEventId}:{}),...(event.divergenceExplanation?{explanation:event.divergenceExplanation}:{}) });
    timeline.flags[event.id] = { title:event.title, description:event.description, year:event.year };
  }

  setContext(context: Partial<typeof this.context>): void {
    this.context = { ...this.context, ...context };
  }

  updateTime(year: number, rulerId?: string): void {
    this.state.simulationTimeline.currentYear = year;
    if (rulerId) {
      this.state.simulationTimeline.currentRuler = rulerId;
    }
    // Canonical timeline remains unchanged
  }

  checkForTriggeredEvents(): EventTriggerResult[] {
    const results: EventTriggerResult[] = [];
    
    for (const event of HISTORICAL_EVENTS) {
      // Skip if already triggered
      if (this.triggeredEventIds.has(event.id)) {
        continue;
      }
      
      // Check if prerequisites met
      if (!this.checkPrerequisites(event)) {
        continue;
      }
      
      // Check trigger conditions
      if (this.checkTriggerConditions(event)) {
        results.push({
          triggered: true,
          event,
        });
      }
    }
    
    return results;
  }

  private checkPrerequisites(event: HistoricalEvent): boolean {
    for (const prereq of event.prerequisites) {
      if (!this.context.completedEvents.includes(prereq) && 
          !this.triggeredEventIds.has(prereq)) {
        return false;
      }
    }
    return true;
  }

  private checkTriggerConditions(event: HistoricalEvent): boolean {
    // An event's stated year window is authoritative: even if its explicit
    // conditions only assert a lower bound, it must not fire after the latest
    // year the history allows (or before the earliest).
    const year = this.state.simulationTimeline.currentYear;
    if (year < event.earliestYear) return false;
    if (event.latestYear !== undefined && year > event.latestYear) return false;

    for (const condition of event.triggerConditions) {
      if (!this.evaluateCondition(condition)) {
        return false;
      }
    }
    return true;
  }

  private evaluateCondition(condition: any): boolean {
    switch (condition.type) {
      case 'year_range':
        if (condition.operator === 'gte') {
          return this.state.simulationTimeline.currentYear >= condition.value;
        }
        if (condition.operator === 'lte') {
          return this.state.simulationTimeline.currentYear <= condition.value;
        }
        break;
      case 'ruler':
        return this.state.simulationTimeline.currentRuler === condition.value;
      case 'reputation':
        if (condition.operator === 'gte') {
          return this.context.reputation >= condition.value;
        }
        break;
      case 'rank':
        return this.context.rank === condition.value;
      case 'has_completed_event':
        return this.context.completedEvents.includes(condition.value);
      case 'has_completed_mission': return this.context.completedMissions.includes(condition.value);
      case 'relationship':
        const rel = this.context.relationships[condition.target] || 0;
        if (condition.operator === 'gte') {
          return rel >= condition.value;
        }
        break;
      case 'currency': return this.compareNumber(this.context.currency,condition.operator,condition.value);
      case 'military_strength': return this.compareNumber(this.context.militaryStrength,condition.operator,condition.value);
      case 'faction_standing': return this.compareNumber(this.context.factionStanding[condition.target??'']??0,condition.operator,condition.value);
      case 'family_generation': return this.compareNumber(this.context.familyGeneration,condition.operator,condition.value);
      case 'flag': return this.state.simulationTimeline.flags[condition.target??'']===condition.value;
      case 'military_outcome': return this.state.simulationTimeline.flags.last_battle_outcome===condition.value;
    }
    return true;
  }

  private compareNumber(actual:number,operator:string|undefined,value:number):boolean{
    if(operator==='lte')return actual<=value;if(operator==='eq')return actual===value;if(operator==='neq')return actual!==value;return actual>=value;
  }

  triggerEvent(eventId: string): { success: boolean; event?: HistoricalEvent } {
    const event = HISTORICAL_EVENTS.find(e => e.id === eventId);
    if (!event) return { success: false };
    
    if (this.triggeredEventIds.has(eventId)) {
      return { success: false };
    }
    if (!this.isEventEligible(eventId)) return { success: false };
    
    this.state.simulationTimeline.triggeredEvents.push(eventId);
    this.triggeredEventIds.add(eventId);
    return { success: true, event };
  }

  getPendingChoiceEvents():HistoricalEvent[]{return HISTORICAL_EVENTS.filter(event=>this.triggeredEventIds.has(event.id)&&!this.state.simulationTimeline.eventOutcomes[event.id]);}
  getAvailableEvents():HistoricalEvent[]{return HISTORICAL_EVENTS.filter(event=>this.isEventEligible(event.id));}
  getAvailableChoices(eventId:string):EventChoice[]{if(!this.triggeredEventIds.has(eventId)||this.state.simulationTimeline.eventOutcomes[eventId])return [];const event=HISTORICAL_EVENTS.find(e=>e.id===eventId);return event?.choices.filter(choice=>(choice.requirements??[]).every(req=>this.evaluateCondition(req)))??[];}

  makeChoice(eventId: string, choiceId: string, simulationDay=this.context.totalDays): {
    success: boolean;
    consequences: EventConsequence[];
    isDivergent: boolean;
    message: string;
  } {
    const event = HISTORICAL_EVENTS.find(e => e.id === eventId);
    if (!event) return { success: false, consequences: [], isDivergent: false, message: 'Event not found' };
    if (!this.triggeredEventIds.has(eventId)) return { success: false, consequences: [], isDivergent: false, message: 'Event has not been triggered' };
    if(this.state.simulationTimeline.eventOutcomes[eventId])return {success:false,consequences:[],isDivergent:false,message:'This event already has a recorded outcome'};
    
    const choice = event.choices.find(c => c.id === choiceId);
    if (!choice) return { success: false, consequences: [], isDivergent: false, message: 'Choice not found' };
    if(!(choice.requirements??[]).every(requirement=>this.evaluateCondition(requirement)))return {success:false,consequences:[],isDivergent:false,message:'Choice requirements are not met'};
    
    const allConsequences = [...choice.immediateConsequences, ...choice.delayedConsequences];
    const pending=this.state.simulationTimeline.pendingConsequences??=[];
    for(const [index,consequence] of choice.delayedConsequences.entries())pending.push({id:`${eventId}:${choiceId}:${index}`,eventId,dueDay:simulationDay+Math.max(0,consequence.delayDays??0),consequence:structuredClone(consequence)});
    
    // Determine if this creates divergence from historical baseline
    const isDivergent = choice.divergesFromBaseline===true;
    const historicalBaseline = event.baselineEventId ? `Historical anchor preserved separately: ${event.baselineEventId}` : event.isFictional ? 'Fictional scenario - no historical baseline' : 'Followed documented historical course';
    
    const outcome: EventOutcome = {
      eventId,
      chosenChoiceId: choiceId,
      timestamp: simulationDay,
      gameYear: this.state.simulationTimeline.currentYear,
      consequences: allConsequences,
      isDivergent,
      historicalBaseline,
      classification:isDivergent?'alternate_history':event.isFictional?'fictional':'historical_path',
      ...(event.baselineEventId?{baselineEventId:event.baselineEventId}:{}),
      ...(choice.divergenceExplanation?{divergenceExplanation:choice.divergenceExplanation}:{}),
    };
    
    this.state.simulationTimeline.eventOutcomes[eventId] = outcome;
    this.context.completedEvents.push(eventId);
    
    // Record divergence if applicable
    if (isDivergent) {
      const divergence: TimelineDivergence = {
        eventId,
        historicalBaseline,
        playerAction: choice.text,
        simulatedOutcome: this.generateSimulatedOutcome(event, choice),
        consequences: allConsequences.map(c => c.description),
        isMajorDivergence: true,
        timestamp: simulationDay,
        ...(event.baselineEventId?{baselineEventId:event.baselineEventId}:{}),
        ...(choice.divergenceExplanation?{explanation:choice.divergenceExplanation}:{}),
      };
      this.state.simulationTimeline.divergences.push(divergence);
    }
    
    return {
      success: true,
      consequences: choice.immediateConsequences,
      isDivergent: outcome.isDivergent,
      message: `Chose: ${choice.text}${isDivergent&&choice.divergenceExplanation?` — ${choice.divergenceExplanation}`:''}`,
    };
  }

  setFlag(key:string,value:unknown):void{this.state.simulationTimeline.flags[key]=value;}
  advanceConsequencesToDay(day:number):Array<{eventId:string;consequence:EventConsequence}>{
    const pending=this.state.simulationTimeline.pendingConsequences??[];
    const due=pending.filter(item=>item.dueDay<=day);
    this.state.simulationTimeline.pendingConsequences=pending.filter(item=>item.dueDay>day);
    return due.map(({eventId,consequence})=>({eventId,consequence:structuredClone(consequence)}));
  }

  private generateSimulatedOutcome(event: HistoricalEvent, choice: EventChoice): string {
    return event.baselineEventId?`${choice.text}: ${choice.description}`:`Alternative path taken: ${choice.description}`;
  }

  getEventHistory(): EventOutcome[] {
    return Object.values(this.state.simulationTimeline.eventOutcomes);
  }

  getDivergences(): TimelineDivergence[] {
    return this.state.simulationTimeline.divergences;
  }

  isEventEligible(eventId: string): boolean {
    const event = HISTORICAL_EVENTS.find(e => e.id === eventId);
    if (!event) return false;
    if (this.triggeredEventIds.has(eventId)) return false;
    return this.checkPrerequisites(event) && this.checkTriggerConditions(event);
  }

  serialize(): HistoricalTimelineState {
    return JSON.parse(JSON.stringify(this.state));
  }

  deserialize(data: Partial<HistoricalTimelineState> | null | undefined): void {
    if (!data) return;
    if (data.simulationTimeline) {
      this.state.simulationTimeline = {
        ...this.state.simulationTimeline,
        ...data.simulationTimeline,
        pendingConsequences:[...(data.simulationTimeline.pendingConsequences??[])],
      };
      this.triggeredEventIds = new Set(this.state.simulationTimeline.triggeredEvents ?? []);
    }
    if (data.canonicalTimeline) {
      this.state.canonicalTimeline = {
        ...this.state.canonicalTimeline,
        ...data.canonicalTimeline,
      };
    }
  }

  getRulers(): typeof RULERS {
    return RULERS;
  }

  getEventsByPeriod(period: string): HistoricalEvent[] {
    return HISTORICAL_EVENTS.filter(e => e.period === period);
  }

  getEventsByRuler(rulerId: string): HistoricalEvent[] {
    return HISTORICAL_EVENTS.filter(e => e.rulerId === rulerId);
  }

  /** Static scholarly baseline is deliberately separate from the mutable game timeline. */
  getBaselineEvents() { return HISTORICAL_BASELINE.map(event => ({ ...event })); }

  /** Exact in-game reign windows remain useful simulation values, not settled historical claims. */
  getUnverifiedHistoricalClaims(): string[] {
    return [
      'Osman Gazi için oyundaki 1299–1326 saltanat aralığı kesinleşmiş değildir; doğum yılı bilinmez ve ölümünün 1324’e kadar gerçekleşmiş olması muhtemeldir.',
      'Orhan Gazi için oyundaki 1326 başlangıç yılı, 1324 tarihli vakıf belgesine ilişkin kaynak kaydıyla aynı kesinlikte değildir.',
      'Bapheus’un kesin günü/yılı ve Koyunhisar ile özdeşliği burada kesinleştirilmemiştir.',
    ];
  }
}
