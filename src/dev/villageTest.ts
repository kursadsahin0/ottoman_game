/**
 * Living village verification.
 * Run with: npm run test:village
 *
 * The harness exercises the pure simulation with the real generated map, so it
 * checks the same collision footprints, schedules and save payload the game
 * uses, without a browser or Phaser renderer.
 */
import { WorldGenerator, ObjectType } from '@data/WorldData';
import { isInsideHouseFootprint } from '@utils/CollisionGeometry';
import { Season, type GameTime } from '@systems/TimeManager';
import { SaveManager, SAVE_VERSION } from '@systems/SaveManager';
import { NavigationGrid } from '@/village/NavigationGrid';
import { Pathfinder } from '@/village/Pathfinder';
import { VillageSimulation } from '@/village/VillageSimulation';
import { phaseForHour, isMarketDayFor } from '@/village/VillageClock';
import { VILLAGE_NPCS } from '@/village/VillageData';
import { VILLAGE_HOME_COUNT } from '@/village/VillageData';

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

const map = WorldGenerator.generateFrontierSettlement();

function isBlocked(x: number, y: number): boolean {
  if (!map.tiles[y]?.[x]?.walkable) return true;
  for (const object of map.objects) {
    if (!object.collision) continue;
    if ([ObjectType.HOUSE, ObjectType.WORKSHOP, ObjectType.GRANARY, ObjectType.ZAVIYE].includes(object.type)) {
      const dx = x - object.gridX;
      const dy = y - object.gridY;
      if (isInsideHouseFootprint((dx - dy) * 64, (dx + dy) * 32)) return true;
    }
    if (Math.floor(object.gridX) === x && Math.floor(object.gridY) === y) return true;
  }
  return false;
}

function timeAt(hour: number, day = 1): GameTime {
  return {
    day: (day % 30) + 1,
    month: 3,
    year: 1299,
    season: Season.SPRING,
    totalDays: day + hour / 24,
  };
}

function createSimulation(hour: number, day = 1): VillageSimulation {
  const simulation = new VillageSimulation(timeAt(hour, day), {
    width: map.width,
    height: map.height,
    isBlocked,
  });
  simulation.setWeatherForTesting('clear');
  return simulation;
}

function run(
  simulation: VillageSimulation,
  day: number,
  endHour: number,
  seconds = 20,
  visible?: ReadonlySet<string>,
): void {
  let now = 0;
  const frames = Math.round(seconds * 60);
  for (let frame = 0; frame < frames; frame++) {
    now += 1000 / 60;
    simulation.update(now, timeAt(endHour, day), { x: 0, y: 0 }, visible);
  }
}

function npc(simulation: VillageSimulation, id: string) {
  const found = simulation.getNpcs().find(candidate => candidate.id === id);
  if (!found) throw new Error(`Missing NPC ${id}`);
  return found;
}

function gridDistance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// ---------------------------------------------------------------------------
section('Village roster and homes');

const baseline = createSimulation(7, 1);
const roster = baseline.getNpcs();
check('the village has at least eighteen distinct residents', roster.length >= 18);
check('the example village assigns at least fifteen distinct homes', VILLAGE_HOME_COUNT >= 15);
check('every resident id is unique', new Set(roster.map(entry => entry.id)).size === roster.length);
check('every resident name is unique', new Set(roster.map(entry => entry.name)).size === roster.length);
check('every resident has a home on a walkable tile',
  roster.every(entry => baseline.nav.isWalkable(entry.home.x, entry.home.y)));
check('every resident with a workplace has a walkable workplace',
  roster.every(entry => !entry.workplace || baseline.nav.isWalkable(entry.workplace.x, entry.workplace.y)));
check('every resident has persistent attributes', roster.every(entry =>
  Object.values(entry.attributes).every(value => value >= 0 && value <= 100)));
check('every resident has a personality', roster.every(entry =>
  Object.values(entry.personality).every(value => value >= 0 && value <= 100)));
check('residents have a deterministic base schedule', roster.every(entry => entry.schedule.base.length >= 4));
check('farmers and herders are in the roster', VILLAGE_NPCS.some(entry => entry.occupation === 'farmer')
  && VILLAGE_NPCS.some(entry => entry.occupation === 'herder'));
check('merchants, blacksmiths and guards are in the roster',
  ['merchant', 'blacksmith', 'guard'].every(occupation => VILLAGE_NPCS.some(entry => entry.occupation === occupation)));

// ---------------------------------------------------------------------------
section('Central clock and phases');

check('06:00 is morning', phaseForHour(6) === 'morning');
check('13:00 is afternoon', phaseForHour(13) === 'afternoon');
check('18:00 is evening', phaseForHour(18) === 'evening');
check('23:30 is night', phaseForHour(23.5) === 'night');
check('market days are every fifth day', isMarketDayFor(0) && isMarketDayFor(5) && !isMarketDayFor(4));
check('clock reports a phase and market state', (() => {
  const clock = createSimulation(8, 1).getClock();
  return clock.phase === 'morning' && typeof clock.isMarketDay === 'boolean';
})());

// ---------------------------------------------------------------------------
section('Ordinary-day schedules');

const workday = createSimulation(7, 1);
run(workday, 1, 9);
check('Hasan works the fields', npc(workday, 'hasan_farmer').activity === 'working');
check('Rukiye works the fields', npc(workday, 'rukiye_farmer').activity === 'working');
check('Demir works the smithy', npc(workday, 'demir_blacksmith').activity === 'working');
check('Yusuf operates his stall', npc(workday, 'yusuf_merchant').activity === 'market');
check('Ayşe sells at the market', npc(workday, 'ayse_baker').activity === 'market');
check('Kara patrols the north road', npc(workday, 'kara_guard').activity === 'patrolling');
check('Balaban patrols the south road', npc(workday, 'balaban_guard').activity === 'patrolling');
check('Fatma shops in the morning', npc(workday, 'fatma_villager').activity === 'market');
check('at least fifteen residents reached their destination',
  workday.getNpcs().filter(entry => gridDistance(entry.position, entry.destination) < 0.9).length >= 15);
check('every walking resident stands on a walkable tile',
  workday.getNpcs().every(entry => workday.nav.isWalkable(entry.position.x, entry.position.y)));
check('ordinary commute required no stuck recovery', workday.getStats().stuckRecoveries === 0);
check('animation state follows the activity', npc(workday, 'demir_blacksmith').animation === 'working'
  && npc(workday, 'yusuf_merchant').animation === 'working');

const night = createSimulation(22.5, 2);
run(night, 2, 23, 20);
check('Hasan sleeps at night', npc(night, 'hasan_farmer').activity === 'sleeping');
check('Yusuf sleeps at night', npc(night, 'yusuf_merchant').activity === 'sleeping');
check('Kara sleeps after his watch', npc(night, 'kara_guard').activity === 'sleeping');
check('Balaban keeps the night watch', npc(night, 'balaban_guard').activity === 'patrolling');
check('night animation state is sleeping at home', npc(night, 'hasan_farmer').animation === 'sleeping'
  && gridDistance(npc(night, 'hasan_farmer').position, npc(night, 'hasan_farmer').home) < 0.8);

// ---------------------------------------------------------------------------
section('Market day, weather and military emergency');

const marketDay = createSimulation(9.5, 5);
run(marketDay, 5, 10, 18);
check('market day moves Hasan to the market', npc(marketDay, 'hasan_farmer').activity === 'market');
check('market day moves Rukiye to the market', npc(marketDay, 'rukiye_farmer').activity === 'market');
check('market day keeps the guard on the market route', npc(marketDay, 'kara_guard').activity === 'patrolling');
check('market is open for trade', marketDay.isMarketOpen());
check('market day is reported at the clock', marketDay.isMarketDay());

const rainy = createSimulation(8.5, 3);
rainy.setWeatherForTesting('rain');
run(rainy, 3, 9);
const rainyFarmer = npc(rainy, 'hasan_farmer');
check('rain sends the farmer to indoor work', rainyFarmer.activity === 'working'
  && gridDistance(rainyFarmer.destination, rainyFarmer.home) < 0.01);
check('rain keeps the guard patrolling', npc(rainy, 'kara_guard').activity === 'patrolling');
check('rain keeps the market closed before its shortened hours', !rainy.isMarketOpen());
check('weather is surfaced to the renderer', rainy.getWeather() === 'rain');

const emergency = createSimulation(9, 3);
emergency.startEmergency(8, 'Test alarm');
check('emergency makes civilians seek home', npc(emergency, 'hasan_farmer').activity === 'fleeing');
check('emergency musters the guards', npc(emergency, 'kara_guard').activity === 'mustering');
check('emergency keeps the official at the lodge', npc(emergency, 'ilyas_official').activity === 'working');
check('emergency closes the market', !emergency.isMarketOpen());
emergency.endEmergency();
check('ending the alarm restores ordinary work', npc(emergency, 'hasan_farmer').activity === 'working');

// ---------------------------------------------------------------------------
section('Pathfinding and obstacle avoidance');

const navigation = new NavigationGrid(map.width, map.height, isBlocked);
const pathfinder = new Pathfinder(navigation);
const route = pathfinder.findPath({ x: 16, y: 17 }, { x: 5, y: 16 });
check('A* finds a route across the village', route.found && route.path.length > 0);
check('every path waypoint is walkable', route.path.every(point => navigation.isWalkable(point.x, point.y)));
check('every segment avoids buildings and props', (() => {
  let previous = { x: 16, y: 17 };
  for (const point of route.path) {
    if (!navigation.isSegmentWalkable(previous, point)) return false;
    previous = point;
  }
  return true;
})());
check('path planning is deterministic', JSON.stringify(route.path)
  === JSON.stringify(new Pathfinder(navigation).findPath({ x: 16, y: 17 }, { x: 5, y: 16 }).path));

const blockedGoal = pathfinder.findPath({ x: 16, y: 17 }, { x: 6, y: 12 });
check('a destination inside a house is marked approximate', blockedGoal.approximate);
check('blocked destination resolves to a walkable approach',
  blockedGoal.path.length > 0 && navigation.isWalkable(blockedGoal.goal.x, blockedGoal.goal.y)
  && navEndpointWalkable(blockedGoal.path, navigation));

const occupancy = new Map<string, number>([
  ['16,16', 1], ['17,16', 1], ['18,16', 1],
]);
const occupiedRoute = pathfinder.findPath({ x: 14, y: 17 }, { x: 20, y: 17 },
  (x, y) => occupancy.get(`${x},${y}`) ?? 0);
check('A* routes around occupied tiles when a detour exists',
  occupiedRoute.found && occupiedRoute.path.every(point => occupancy.get(`${point.x},${point.y}`) !== 1));
const blockedWall = new NavigationGrid(8, 8, (x) => x === 4);
const unreachable = new Pathfinder(blockedWall).findPath({ x: 1, y: 1 }, { x: 6, y: 6 });
check('an unreachable goal returns no path instead of walking into a wall',
  !unreachable.found && unreachable.path.length === 0);
check('nearest walkable recovery always returns a legal tile',
  blockedWall.isWalkable(blockedWall.nearestWalkable({ x: 4, y: 4 }).x, blockedWall.nearestWalkable({ x: 4, y: 4 }).y));

// ---------------------------------------------------------------------------
section('Reactions, memory and off-screen updates');

const reaction = createSimulation(9, 1);
run(reaction, 1, 9);
const target = npc(reaction, 'fatma_villager');
const fire = reaction.raiseIncident('fire', target.position, 2);
check('a nearby fire triggers a fleeing reaction', npc(reaction, 'fatma_villager').activity === 'fleeing');
check('the reaction remembers its incident', npc(reaction, 'fatma_villager').reactingTo === fire.id);
check('a guard responds to the fire', npc(reaction, 'kara_guard').activity === 'investigating');
reaction.resolveIncident(fire.id);
check('resolving an incident restores the schedule', npc(reaction, 'fatma_villager').reactingTo === null);

const theft = createSimulation(10, 1);
const theftIncident = theft.raiseIncident('theft', npc(theft, 'yusuf_merchant').position, 2);
check('a market theft makes a cautious merchant flee and remember the incident',
  npc(theft, 'yusuf_merchant').activity === 'fleeing'
  && npc(theft, 'yusuf_merchant').reactingTo === theftIncident.id);

const combat = createSimulation(18, 2);
const guard = npc(combat, 'kara_guard');
const combatIncident = combat.raiseIncident('combat', guard.position, 3);
check('a nearby guard investigates a combat incident',
  npc(combat, 'kara_guard').activity === 'investigating'
  && npc(combat, 'kara_guard').reactingTo === combatIncident.id);

const stranger = createSimulation(8, 1);
const hasan = npc(stranger, 'hasan_farmer');
let now = 0;
for (let frame = 0; frame < 30; frame++) {
  now += 16;
  stranger.update(now, timeAt(8, 1), hasan.position);
}
check('an approaching unknown player raises a stranger reaction',
  stranger.getNpcs().some(entry => entry.reactingTo !== null));
stranger.calmStranger();
check('talking calms the stranger reaction',
  !stranger.getNpcs().some(entry => entry.reactingTo !== null && entry.activity === 'investigating'));

const memory = createSimulation(9, 1);
memory.recordPlayerInteraction('hasan_farmer', 'help', 'Oyuncu hasada yardım etti.', 5, 4);
check('conversation memory is recorded', npc(memory, 'hasan_farmer').memories[0]?.summary === 'Oyuncu hasada yardım etti.');
check('trust is persistent state', npc(memory, 'hasan_farmer').playerTrust === 5);
memory.recordPlayerInteraction('hasan_farmer', 'conversation', 'İkinci konuşma.', 1, 1);
check('memory is capped to important recent entries', npc(memory, 'hasan_farmer').memories.length <= 12);
memory.adjustRelationship('hasan_farmer', 'yusuf_merchant', 10);
check('NPC-to-NPC relationships can change', (npc(memory, 'hasan_farmer').relationships.yusuf_merchant ?? 0) >= 15);

const offscreen = createSimulation(7, 1);
const visible = new Set(['hasan_farmer', 'yusuf_merchant', 'kara_guard']);
run(offscreen, 1, 9, 20, visible);
const offscreenStats = offscreen.getStats();
check('off-screen residents update far less often than visible ones',
  offscreenStats.offscreenUpdates * 3 < offscreenStats.fullUpdates);
check('off-screen residents still reach their jobs',
  offscreen.getNpcs().every(entry => gridDistance(entry.position, entry.destination) < 1.2));
check('off-screen movement never leaves the walkable grid',
  offscreen.getNpcs().every(entry => offscreen.nav.isWalkable(entry.position.x, entry.position.y)));

// ---------------------------------------------------------------------------
section('Deterministic replay');

const replayA = createSimulation(7, 4);
const replayB = createSimulation(7, 4);
run(replayA, 4, 9);
run(replayB, 4, 9);
check('identical clock, map and frame steps produce identical activity',
  replayA.getNpcs().every((entry, index) => entry.activity === replayB.getNpcs()[index]?.activity));
check('identical clock, map and frame steps produce identical destinations',
  replayA.getNpcs().every((entry, index) => entry.destination.x === replayB.getNpcs()[index]?.destination.x
    && entry.destination.y === replayB.getNpcs()[index]?.destination.y));
check('identical paths are produced', replayA.getNpcs().every((entry, index) =>
  JSON.stringify(entry.path.path) === JSON.stringify(replayB.getNpcs()[index]?.path.path)));

// ---------------------------------------------------------------------------
section('Occupation changes and save round-trip');

const savedSimulation = createSimulation(10, 6);
savedSimulation.changeOccupation('zeynep_healer', 'weaver', { x: 7, y: 13 });
savedSimulation.recordPlayerInteraction('zeynep_healer', 'help', 'Oyuncu yaralı bir çocuğu taşıdı.', 6, 5);
savedSimulation.adjustRelationship('zeynep_healer', 'fatma_villager', 7);
savedSimulation.startEmergency(4, 'Kayıt testi');
const incident = savedSimulation.raiseIncident('theft', { x: 18, y: 16 }, 2);
const savedClock = savedSimulation.getClock();
const saveState = JSON.parse(JSON.stringify(savedSimulation.getSaveState())) as ReturnType<VillageSimulation['getSaveState']>;
check('save state uses schema 2', saveState.schema === 2);
check('save state contains every resident identity', saveState.npcs.length === savedSimulation.getNpcs().length);
check('save state records the occupation change',
  saveState.npcs.find(entry => entry.id === 'zeynep_healer')?.occupation === 'weaver'
  && (saveState.npcs.find(entry => entry.id === 'zeynep_healer')?.occupationHistory.length ?? 0) >= 2);
check('save state records memory, trust and relationships',
  (saveState.npcs.find(entry => entry.id === 'zeynep_healer')?.memories.length ?? 0) >= 2
  && saveState.npcs.find(entry => entry.id === 'zeynep_healer')?.playerTrust === 6);
check('save state records active incidents', saveState.incidents.some(entry => entry.id === incident.id));
check('save state records the emergency clock', saveState.clock.emergencyUntilHour > savedClock.absoluteHour);

const loadedSimulation = createSimulation(10, 6);
loadedSimulation.loadSaveState(saveState);
const loadedZeynep = npc(loadedSimulation, 'zeynep_healer');
check('identities survive the round trip', loadedSimulation.getNpcs().length === saveState.npcs.length);
check('position and destination survive the round trip', loadedZeynep.position.x === saveState.npcs.find(entry => entry.id === 'zeynep_healer')?.position.x);
check('trust and memory survive the round trip',
  loadedZeynep.playerTrust === 6 && loadedZeynep.memories.some(entry => entry.summary.includes('yaralı')));
check('occupation and its history survive the round trip',
  loadedZeynep.occupation === 'weaver' && loadedZeynep.occupationHistory.length >= 2);
check('relationships survive the round trip', (loadedZeynep.relationships.fatma_villager ?? 0) >= 7);
check('active incidents survive the round trip',
  loadedSimulation.getSaveState().incidents.some(entry => entry.id === incident.id && entry.status === 'active'));
check('emergency state survives the round trip',
  loadedSimulation.isEmergency() && loadedSimulation.getClock().emergencyUntilHour === savedClock.emergencyUntilHour);

const manager = SaveManager.getInstance();
const baseSave = {
  time: timeAt(10, 6), inventory: { items: [['hoe', 1] as [string, number]], maxSlots: 20 },
  economy: { currency: 50 }, farm: { plots: [] }, market: { stock: [], lastRestockDay: 0 },
  playerPosition: { x: 16, y: 17 },
};
const settlementSave = {
  ...saveState,
  timeScale: 1,
  lastProcessedHour: Math.floor(savedClock.absoluteHour),
  lastDay: savedClock.day,
  weather: savedClock.weather,
  weatherDay: savedClock.weatherDay,
  lastEventDay: -3,
  events: [],
};
const validPayload = manager.validateRawRecord({
  ...baseSave, version: SAVE_VERSION, timestamp: 1,
  world: { mapSeed: 1337, npcStates: {}, settlement: settlementSave },
});
check('full game save validation accepts village schema 2', validPayload.status === 'ok');
const invalidPayload = manager.validateRawRecord({
  ...baseSave, version: SAVE_VERSION, timestamp: 1,
  world: { mapSeed: 1337, npcStates: {}, settlement: { ...settlementSave, schema: 3 } },
});
check('unknown settlement schema is rejected', invalidPayload.status === 'invalid');

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

function navEndpointWalkable(path: Array<{ x: number; y: number }>, grid: NavigationGrid): boolean {
  const endpoint = path[path.length - 1];
  return !!endpoint && grid.isWalkable(endpoint.x, endpoint.y);
}
