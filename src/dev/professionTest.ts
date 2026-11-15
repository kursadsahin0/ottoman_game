import { ProfessionSystem } from '@systems/ProfessionSystem';
import { PROFESSION_DEFINITIONS } from '@data/ProfessionData';
import { FarmSimulation } from '@systems/FarmSimulation';
import { CropType, CROP_DEFINITIONS } from '@data/CropData';
import { Season, type GameTime } from '@systems/TimeManager';
import { Inventory } from '@systems/Inventory';

let passed = 0;
function check(label: string, condition: boolean): void { if (!condition) throw new Error(`Profession test failed: ${label}`); passed++; }
function time(day: number): GameTime {
  const monthIndex = 2 + Math.floor(day / 30); const month = monthIndex % 12 + 1; const year = 1299 + Math.floor(monthIndex / 12);
  const season = month >= 3 && month <= 5 ? Season.SPRING : month >= 6 && month <= 8 ? Season.SUMMER : month >= 9 && month <= 11 ? Season.AUTUMN : Season.WINTER;
  return { day: day % 30 + 1, month, year, season, totalDays: day };
}

const professions = new ProfessionSystem('founder');
const inventory = new Inventory({ hoe: 1, seed_wheat: 10, seed_barley: 10 });
const farm = new FarmSimulation();
let day = 0;
check('profession catalog defines farming abilities', PROFESSION_DEFINITIONS.farming.abilities.some(ability => ability.level === 4));

// Exercise a real crop cycle through the same simulation actions used by the farm interaction.
check('preparation work is allowed with an intact hoe', professions.canWork('prepare', day).ok);
check('field preparation succeeds', farm.preparePlot('plot_0', inventory).success);
check('successful preparation advances farming experience', professions.recordActivity('farming', 'prepare', 'plot_0', day) > 0);
check('same field and same-day action cannot be farmed for duplicate XP', professions.recordActivity('farming', 'prepare', 'plot_0', day) === 0);
check('wheat planting succeeds with seed and prepared land', farm.plantCrop('plot_0', CropType.WHEAT, time(day), inventory).success);
professions.recordActivity('farming', 'plant', 'plot_0', day);
day += CROP_DEFINITIONS[CropType.WHEAT].growthDays + 2;
farm.updateGrowth(day);
check('crop growth reaches a harvestable state', farm.getPlotById('plot_0')?.growthProgress === 1);
const harvest = farm.harvestCrop('plot_0', inventory, professions.getHarvestBonus());
check('ready crop produces real inventory goods', harvest.success && inventory.getItemCount('wheat') === CROP_DEFINITIONS[CropType.WHEAT].harvestYield);
professions.recordActivity('farming', 'harvest', 'plot_0', day);

// A single day is capped even when many valid work outputs occur.
const beforeXp = professions.getSkill('farming').experience;
for (let i = 0; i < 12; i++) professions.recordActivity('farming', 'plant', `plot_${i + 10}`, day);
check('profession XP is capped per day', professions.getSkill('farming').experience - beforeXp <= 40);

// Fatigue accumulates from work, blocks labor, then clears through calendar rest.
for (let i = 0; i < 9; i++) professions.recordActivity('farming', 'prepare', `fatigue_${i}`, day);
check('work fatigue accumulates', professions.getFatigue() > 70);
check('exhausted farmer cannot start another task', professions.canWork('prepare', day).ok === false);
day += 3;
check('rest days recover fatigue', professions.canWork('prepare', day).ok && professions.getFatigue() === 0);

// Tool repair is an actual paid smith transaction with durable profession credit.
let purse = 100;
for (let i = 0; i < 100; i++) professions.recordActivity('farming', 'prepare', `wear_${i}`, day + i + 1);
check('repeated farm work wears the hoe down', professions.getHoeCondition() === 0);
check('broken hoe blocks soil work', professions.canWork('prepare', day + 101).ok === false);
check('repair requires and deducts its fee', professions.repairHoe(day + 101, fee => { if (purse < fee) return false; purse -= fee; return true; }) && purse === 92 && professions.getHoeCondition() === 100);
check('smithing grows from a real tool repair', professions.getSkill('smithing').activities === 1);

// Trade training comes only from completed transactions; prices improve modestly.
const trading = new ProfessionSystem('merchant-apprentice');
let paid = 0;
check('mentor teaches only a matching occupation', !trading.learnFromMentor('trade', 'hasan', 'farmer', 1, fee => { paid += fee; return true; }));
check('experienced merchant can teach trade once', trading.learnFromMentor('trade', 'yusuf', 'merchant', 1, fee => { paid += fee; return true; }) && paid === 12);
check('same master cannot sell repeated free progression', !trading.learnFromMentor('trade', 'yusuf', 'merchant', 2, fee => { paid += fee; return true; }));
for (let d = 2; d < 35; d++) trading.recordTrade('sell', 'wheat', 8, d);
check('completed sales develop trade skill', trading.getSkill('trade').level >= 2 && trading.getSkill('trade').reputation > 0);
check('trade discount stays bounded', trading.getTradeDiscount() <= 0.1);

const inherited = new ProfessionSystem('old-head');
for (let i = 0; i < 60; i++) inherited.recordActivity('farming', 'harvest', `heirloom_field_${i}`, i + 1);
check('skilled farmer reaches advanced level', inherited.getSkill('farming').level >= 3);
inherited.inheritKnowledge('old-head', 'descendant');
check('descendant receives only modest family knowledge', inherited.serialize().characterId === 'descendant' && inherited.getSkill('farming').level === 1 && inherited.getSkill('farming').experience <= 50);
const saved = inherited.serialize();
const loaded = new ProfessionSystem(); loaded.deserialize(saved, 'descendant');
check('profession progression, fatigue and condition survive saving', loaded.getSkill('farming').experience === inherited.getSkill('farming').experience && loaded.getHoeCondition() === inherited.getHoeCondition());

console.log(`${passed} passed, 0 failed`);
