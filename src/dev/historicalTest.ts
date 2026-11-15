/**
 * Headless verification of the historical event / alternate-timeline system.
 * Run with: npm run test:historical
 */
import { HistoricalEventSystem } from '@systems/HistoricalEventSystem';
import {
  HISTORICAL_EVENTS,
  EventCategory,
  HistoricalCertainty,
} from '@data/HistoricalData';
import { HISTORICAL_BASELINE } from '@data/HistoricalContent';
import { validateEventDefinitions } from '@systems/ChronologyValidator';

let passed = 0;
let failed = 0;

function check(label: string, condition: boolean): void {
  if (condition) {
    passed++;
    console.log(`  ok  ${label}`);
  } else {
    failed++;
    console.error(`FAIL  ${label}`);
  }
}

function section(title: string): void {
  console.log(`\n${title}`);
}

const EVENT_ID = 'frontier_local_military_request';

section('Initial timeline');
const history = new HistoricalEventSystem();
history.setContext({currency:50});
let state = history.getState();
check('starts in 1299', state.simulationTimeline.currentYear === 1299);
check('starts under Osman Gazi', state.simulationTimeline.currentRuler === 'osman_gazi');
check('canonical year mirrors the start', state.canonicalTimeline.currentYear === 1299);
check('no events triggered at start', state.simulationTimeline.triggeredEvents.length === 0);
check('time does not mutate the canonical timeline', (() => {
  history.updateTime(1304);
  return history.getState().canonicalTimeline.currentYear === 1299;
})());
check('simulation timeline advances independently', history.getState().simulationTimeline.currentYear === 1304);

section('Historical data');
const frontier = HISTORICAL_EVENTS.find((event) => event.id === EVENT_ID);
check('frontier event is defined', frontier !== undefined);
check('frontier event is fictional', frontier?.isFictional === true);
check('frontier event is military', frontier?.category === EventCategory.MILITARY);
check('frontier event is marked fictional', frontier?.certainty === HistoricalCertainty.FICTIONAL);
check('frontier event has three choices', (frontier?.choices.length ?? 0) === 3);
check('rulers include Osman Gazi', history.getRulers().some((ruler) => ruler.id === 'osman_gazi'));
check('events can be filtered by ruler', history.getEventsByRuler('osman_gazi').length > 0);
check('events can be filtered by period', history.getEventsByPeriod('Early Ottoman Frontier').length > 0);
check('at least five authored branches cover the opening period',HISTORICAL_EVENTS.filter(e=>e.earliestYear<=1326&&e.choices.length>=2).length>=5);
check('scenario events are fictional and historical anchors stay separate',HISTORICAL_EVENTS.filter(e=>e.baselineEventId).every(e=>e.isFictional&&HISTORICAL_BASELINE.some(record=>record.id===e.baselineEventId)));
check('event definitions pass dependency, cost and divergence checks',validateEventDefinitions().every(issue=>issue.severity!=='error'));

section('Triggering');
check('event is eligible at the start date', history.isEventEligible(EVENT_ID));
const eligible = history.checkForTriggeredEvents();
check('trigger check returns the frontier event', eligible.some((entry) => entry.event?.id === EVENT_ID));
const trigger = history.triggerEvent(EVENT_ID);
check('event can be triggered', trigger.success && trigger.event?.id === EVENT_ID);
check('selected event data is returned', trigger.event?.title.includes('Frontier') === true);
check('duplicate triggers are rejected', history.triggerEvent(EVENT_ID).success === false);
check('triggered event is no longer eligible', history.isEventEligible(EVENT_ID) === false);
check('unknown events cannot be triggered', history.triggerEvent('missing_event').success === false);

section('Choices and divergence');
const choice = history.makeChoice(EVENT_ID, 'negotiate');
check('choice succeeds', choice.success);
check('choice returns immediate consequences and queues delayed results', choice.consequences.length === 3 && history.getState().simulationTimeline.pendingConsequences?.length === 1);
check('fictional choices remain distinct from alternate history', choice.isDivergent === false);
check('choice text is reported', choice.message.includes('Negotiate'));
check('a completed event cannot accept a second choice', history.makeChoice(EVENT_ID, 'refuse').success === false);
check('unknown choice is rejected', history.makeChoice(EVENT_ID, 'not_a_choice').success === false);
check('unknown event choice is rejected', history.makeChoice('missing_event', 'negotiate').success === false);

const outcomes = history.getEventHistory();
check('outcome is recorded', outcomes.length === 1 && outcomes[0]?.eventId === EVENT_ID);
check('outcome stores the chosen choice', outcomes[0]?.chosenChoiceId === 'negotiate');
check('outcome stores the game year', outcomes[0]?.gameYear === 1304);
check('outcome stores all consequences', outcomes[0]?.consequences.length === 4);
check('fictional event is not mislabeled as a historical divergence', history.getDivergences().length === 0);

section('Persistence');
const saved = history.serialize();
const restored = new HistoricalEventSystem();
restored.deserialize(saved);
const restoredState = restored.getState();
check('timeline year survives save/load', restoredState.simulationTimeline.currentYear === 1304);
check('triggered events survive save/load', restoredState.simulationTimeline.triggeredEvents.includes(EVENT_ID));
check('outcomes survive save/load', restored.getEventHistory().length === 1);
check('fictional events do not create false divergences after save/load', restored.getDivergences().length === 0);
check('serialized state is a deep copy', (() => {
  restored.updateTime(1310);
  return saved.simulationTimeline.currentYear === 1304;
})());
check('empty deserialize is safe', (() => {
  const fresh = new HistoricalEventSystem();
  fresh.deserialize(null);
  return fresh.getState().simulationTimeline.currentYear === 1299;
})());

section('Context');
const contextual = new HistoricalEventSystem();
contextual.setContext({ reputation: 50, rank: 'sipahi', currency:50 });
check('context does not mark events complete', contextual.isEventEligible(EVENT_ID) === true);
contextual.updateTime(1299, 'osman_gazi');
check('event remains eligible with a later ruler assignment', contextual.isEventEligible(EVENT_ID) === true);
contextual.updateTime(1299, 'orhan_gazi');
check('ruler condition blocks the event', contextual.isEventEligible(EVENT_ID) === false);
contextual.updateTime(1400, 'osman_gazi');
check('year condition blocks the event', contextual.isEventEligible(EVENT_ID) === false);

section('Playable historical branches and delayed consequences');
const branch=new HistoricalEventSystem();
branch.setContext({currency:50,totalDays:0,familyGeneration:2,factionStanding:{market_merchants:15}});
branch.triggerEvent(EVENT_ID);branch.makeChoice(EVENT_ID,'negotiate',0);
branch.advanceConsequencesToDay(5);
branch.updateTime(1300,'osman_gazi');
const grain=branch.triggerEvent('frontier_grain_reserve_decision');
branch.makeChoice('frontier_grain_reserve_decision','store_grain',1);
const branchSave=branch.serialize(),branchLoad=new HistoricalEventSystem();branchLoad.deserialize(branchSave);
check('scheduled consequences persist across save and load',branchLoad.getState().simulationTimeline.pendingConsequences?.some(p=>p.eventId==='frontier_grain_reserve_decision')===true);
check('delayed consequences do not resolve early',branchLoad.advanceConsequencesToDay(29).length===0);
check('delayed consequences resolve once at their due day',branchLoad.advanceConsequencesToDay(31).length===1&&branchLoad.advanceConsequencesToDay(31).length===0);
branchLoad.updateTime(1302,'osman_gazi');
branchLoad.setContext({currency:50,totalDays:100,familyGeneration:2});
const battleEvent=branchLoad.triggerEvent('bapheus_supply_decision');
const canDivert=branchLoad.getAvailableChoices('bapheus_supply_decision').some(choice=>choice.id==='divert_supply');
const alternate=branchLoad.makeChoice('bapheus_supply_decision','divert_supply',100);
check('Bapheus branch is gated by its historical date and predecessor',!!grain&&battleEvent.success);
check('economic choice prerequisites are evaluated before branching',canDivert);
check('explicit campaign change records its baseline anchor and explanation',alternate.success&&alternate.isDivergent&&branchLoad.getDivergences()[0]?.baselineEventId==='bapheus-1302'&&!!branchLoad.getDivergences()[0]?.explanation);
check('canonical historical baseline remains unchanged by alternate outcomes',branchLoad.getState().canonicalTimeline.knownEvents.includes('bapheus-1302')&&branchLoad.getState().canonicalTimeline.currentYear===1299);
branchLoad.updateTime(1310,'osman_gazi');
check('later political branch appears only after its prerequisite resolves',branchLoad.getAvailableEvents().some(event=>event.id==='grazing_compromise'));
branchLoad.triggerEvent('grazing_compromise');
check('later choices react to the earlier campaign branch',!branchLoad.getAvailableChoices('grazing_compromise').some(choice=>choice.id==='favor_frontier'));
const victoriousPath=new HistoricalEventSystem();victoriousPath.setContext({currency:50,totalDays:0});victoriousPath.triggerEvent(EVENT_ID);victoriousPath.makeChoice(EVENT_ID,'negotiate',0);victoriousPath.updateTime(1300,'osman_gazi');victoriousPath.triggerEvent('frontier_grain_reserve_decision');victoriousPath.makeChoice('frontier_grain_reserve_decision','store_grain',1);victoriousPath.updateTime(1302,'osman_gazi');victoriousPath.triggerEvent('bapheus_supply_decision');victoriousPath.makeChoice('bapheus_supply_decision','historical_path',2);victoriousPath.setFlag('bapheus_local_support','sent');victoriousPath.setFlag('last_battle_outcome','victory');victoriousPath.updateTime(1310,'osman_gazi');victoriousPath.triggerEvent('grazing_compromise');
check('event choices can depend on recorded military outcomes',victoriousPath.getAvailableChoices('grazing_compromise').some(choice=>choice.id==='favor_frontier'));

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
