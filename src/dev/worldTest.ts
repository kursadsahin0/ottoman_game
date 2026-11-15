import { CropType, CROP_DEFINITIONS, FarmPlotState } from '@data/CropData';
import { Inventory } from '@systems/Inventory';
import { Economy } from '@systems/Economy';
import { FarmSimulation, calendarDateForDay, seasonForDay } from '@systems/FarmSimulation';
import { DEFAULT_CALENDAR, Season, TimeManager, type GameTime } from '@systems/TimeManager';
import { weatherFor, VillageClock } from '../village/VillageClock';

let passed = 0;
const check = (name: string, condition: boolean): void => {
  if (!condition) throw new Error(`Seasonal world test failed: ${name}`);
  passed++;
  console.log(`  ok ${name}`);
};

console.log('\nSeasonal world and weather');
const time = TimeManager.getInstance();
time.setCalendarConfig(DEFAULT_CALENDAR);
time.setTime({ day: 30, month: 5, year: 1299, season: Season.SPRING, totalDays: 89 });
time.advanceDay();
check('calendar crosses spring into summer at the configured month boundary', time.getTime().month === 6 && time.getTime().season === Season.SUMMER);
time.setTime({ day: 30, month: 12, year: 1299, season: Season.WINTER, totalDays: 359 });
time.advanceDay();
check('calendar carries winter into a new simulation year', time.getTime().day === 1 && time.getTime().month === 1 && time.getTime().year === 1300);

time.setCalendarConfig({ daysPerMonth: 10, monthsPerYear: 8, seasonStarts: { spring: 2, summer: 4, autumn: 6, winter: 8 } });
time.setTime({ day: 10, month: 3, year: 1299, season: Season.SPRING, totalDays: 19 });
time.advanceDay();
check('alternate calendar configuration is honored by the same simulation clock', time.getTime().month === 4 && time.getTime().season === Season.SUMMER);
time.setCalendarConfig({ daysPerMonth: 12 });
check('partial calendar changes preserve the other configured calendar rules', time.getCalendarConfig().daysPerMonth === 12 && time.getCalendarConfig().monthsPerYear === 8 && time.getCalendarConfig().seasonStarts.summer === 4);
time.setCalendarConfig(DEFAULT_CALENDAR);
time.setTime({ day: 1, month: 3, year: 1299, season: Season.SPRING, totalDays: 0 });
const seasonalEconomy = new Economy(new Inventory(), 100);
const springGrainPrice = seasonalEconomy.getSellPrice('wheat');
time.setTime({ day: 1, month: 12, year: 1299, season: Season.WINTER, totalDays: 270 });
check('winter scarcity changes food prices while keeping the economy deterministic', seasonalEconomy.getSellPrice('wheat') > springGrainPrice);
time.setTime({ day: 1, month: 3, year: 1299, season: Season.SPRING, totalDays: 0 });

const oatDefinition = CROP_DEFINITIONS[CropType.OATS];
check('wheat, barley and oats are data-driven crops with planting seasons and water needs', Object.keys(CROP_DEFINITIONS).length >= 3 && !!oatDefinition.suitableSeasons.length && oatDefinition.waterNeed > 0);
check('crop calendar maps simulation days to the correct configured seasons', seasonForDay(90) === Season.SUMMER && calendarDateForDay(0).month === 3);

const inventory = new Inventory({ hoe: 1, seed_oats: 2, oats: 0 });
const farm = new FarmSimulation();
check('prepared land can be planted with oats from real seed inventory', farm.preparePlot('plot_0', inventory).success && farm.plantCrop('plot_0', CropType.OATS, time.getTime(), inventory).success && inventory.getItemCount('seed_oats') === 1);
farm.updateGrowth(oatDefinition.growthDays + 12);
const ripeOats = farm.getPlotById('plot_0');
check('oats progress through weather and water rules to harvest', ripeOats?.state === FarmPlotState.READY_TO_HARVEST && Number.isFinite(ripeOats.moisture) && Number.isFinite(ripeOats.cropQuality));
const savedFarm = new FarmSimulation();
savedFarm.deserialize(farm.serialize());
check('crop growth, soil moisture and quality persist through save/load', savedFarm.getPlotById('plot_0')?.state === FarmPlotState.READY_TO_HARVEST && savedFarm.getPlotById('plot_0')?.cropQuality === ripeOats?.cropQuality);
check('harvesting oats adds the defined crop to the shared inventory', savedFarm.harvestCrop('plot_0', inventory).success && inventory.getItemCount('oats') === oatDefinition.harvestYield);

const villageFarm = new FarmSimulation();
const npcStart = calendarDateForDay(0);
const npcField = villageFarm.getPlotById('npc_field_hasan_farmer')!;
check('NPC farmer starts preparing a hidden household field through the shared farm action', villageFarm.simulateNpcWork('hasan_farmer', npcStart, 6) && npcField.state === FarmPlotState.PREPARED);
check('NPC farm action cannot repeat within the same in-game hour', !villageFarm.simulateNpcWork('hasan_farmer', npcStart, 6));
check('NPC farmer plants from their finite household seed reserve', villageFarm.simulateNpcWork('hasan_farmer', npcStart, 7) && npcField.cropType !== undefined);
villageFarm.updateGrowth(20);
const npcHarvestDay = calendarDateForDay(20);
const npcStore = villageFarm.getNpcFarmInventory('hasan_farmer')!;
const npcHarvested = villageFarm.simulateNpcWork('hasan_farmer', npcHarvestDay, 20 * 24 + 6);
check('NPC field matures under the same calendar weather growth rules and stores its harvest', npcHarvested && ['wheat','barley','oats'].some(id => npcStore.getItemCount(id) > 0));
const villageFarmReload = new FarmSimulation();
villageFarmReload.deserialize(villageFarm.serialize());
check('NPC field state and household inventory persist with the shared farm save', villageFarmReload.getPlotById('npc_field_hasan_farmer')?.state === FarmPlotState.HARVESTED && !!villageFarmReload.getNpcFarmInventory('hasan_farmer')?.getAllItems().some(item => item.itemId === 'wheat' || item.itemId === 'barley' || item.itemId === 'oats'));

let transitionPair: { first: GameTime; second: GameTime } | null = null;
for (let day = 1; day < 80 && !transitionPair; day++) {
  const first = calendarDateForDay(day);
  const second = calendarDateForDay(day + 1);
  if (weatherFor(first) !== weatherFor(second)) transitionPair = { first, second };
}
if (!transitionPair) throw new Error('Could not find deterministic adjacent weather transition for test');
const weatherClock = new VillageClock(transitionPair.first);
const oldWeather = weatherClock.weather;
weatherClock.sync(transitionPair.second);
const targetWeather = weatherFor(transitionPair.second);
check('weather transitions begin from the prior day instead of snapping immediately', weatherClock.weather === oldWeather && weatherClock.weatherBlend === 0);
const midway = { ...transitionPair.second, totalDays: transitionPair.second.totalDays + 0.125 };
weatherClock.sync(midway);
check('weather transition blends gradually over the six hour transition window', weatherClock.weatherBlend > 0.45 && weatherClock.weatherBlend < 0.55 && weatherClock.getWeatherIntensity(oldWeather) > 0 && weatherClock.getWeatherIntensity(targetWeather) > 0);
const ended = { ...transitionPair.second, totalDays: transitionPair.second.totalDays + 0.25 };
weatherClock.sync(ended);
check('weather reaches the deterministic daily target after transition completes', weatherClock.weather === targetWeather && weatherClock.weatherBlend === 1);
const savedClock = new VillageClock(ended);
savedClock.load(weatherClock.getState());
check('weather transition state survives save/load', savedClock.weather === weatherClock.weather && savedClock.weatherBlend === weatherClock.weatherBlend);

console.log(`\n${passed} seasonal world checks passed`);
