/**
 * Headless verification of the farming/economy loop.
 * Run with: npm run test:logic
 */
import { TimeManager, Season } from '@systems/TimeManager';
import { Inventory } from '@systems/Inventory';
import { Economy } from '@systems/Economy';
import { getMarketPriceFactor } from '@systems/MarketPricing';
import { FarmSimulation, seasonForDay } from '@systems/FarmSimulation';
import { FarmPlotState, CropType, CROP_DEFINITIONS } from '@data/CropData';
import { FARM_ECONOMY_CONFIG } from '@data/EconomyData';
import { isInsideHouseFootprint } from '@utils/CollisionGeometry';

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

const time = TimeManager.getInstance();
time.setTime({
  day: 1,
  month: 3,
  year: 1299,
  season: Season.SPRING,
  totalDays: 0,
});
time.pause();

const inventory = new Inventory();
const economy = new Economy(inventory);
const farm = new FarmSimulation();

section('Initial state');
check('starts with a hoe', inventory.hasItem('hoe'));
check('starts with wheat seed', inventory.getItemCount('seed_wheat') === 1);
check('starts with barley seed', inventory.getItemCount('seed_barley') === 1);
check(`starts with ${FARM_ECONOMY_CONFIG.startingCurrency} akçe`, economy.getCurrency() === FARM_ECONOMY_CONFIG.startingCurrency);
check('first plot is owned', farm.getPlotById('plot_0')?.unlocked === true);
check('ninth plot is locked', farm.getPlotById('plot_8')?.unlocked === false);
check('plots are in world grid coords', farm.getPlotAt(10.4, 12.7)?.id === 'plot_0');

section('Land acquisition');
const lockedPlot = farm.getPlotById('plot_8');
check('locked plot cannot be tilled', !farm.preparePlot('plot_8', inventory).success);
const currencyBeforeLand = economy.getCurrency();
const landResult = farm.purchasePlot('plot_8', economy);
check('locked plot can be purchased', landResult.success && lockedPlot?.unlocked === true);
check(
  `purchase costs ${FARM_ECONOMY_CONFIG.landCost} akçe`,
  economy.getCurrency() === currencyBeforeLand - FARM_ECONOMY_CONFIG.landCost,
);

section('Farming loop');
check('untouched plot cannot be planted', !farm.plantCrop('plot_0', CropType.WHEAT, time.getTime(), inventory).success);
check('soil can be prepared', farm.preparePlot('plot_0', inventory).success);
check('plot is prepared', farm.getPlotById('plot_0')?.state === FarmPlotState.PREPARED);
check('wheat can be planted in spring', farm.plantCrop('plot_0', CropType.WHEAT, time.getTime(), inventory).success);
check('seed was consumed', inventory.getItemCount('seed_wheat') === 0);
check('plot is seeded', farm.getPlotById('plot_0')?.state === FarmPlotState.SEEDED);

time.advanceDays(2);
farm.updateGrowth(time.getTime().totalDays);
const growing = farm.getPlotById('plot_0');
check('crop is growing after 2 days', growing?.state === FarmPlotState.GROWING);
check('growth progress is partial', (growing?.growthProgress ?? 0) > 0 && (growing?.growthProgress ?? 0) < 1);
check('crop is not harvestable early', !farm.harvestCrop('plot_0', inventory).success);

time.advanceDays(CROP_DEFINITIONS[CropType.WHEAT].growthDays);
farm.updateGrowth(time.getTime().totalDays);
check('crop is ready after growth period', farm.getPlotById('plot_0')?.state === FarmPlotState.READY_TO_HARVEST);

const wheatBefore = inventory.getItemCount('wheat');
const harvest = farm.harvestCrop('plot_0', inventory);
check('harvest succeeds', harvest.success);
check(
  `yield matches data table (+${CROP_DEFINITIONS[CropType.WHEAT].harvestYield})`,
  inventory.getItemCount('wheat') === wheatBefore + CROP_DEFINITIONS[CropType.WHEAT].harvestYield,
);
check('plot becomes harvested', farm.getPlotById('plot_0')?.state === FarmPlotState.HARVESTED);
check('harvested plot can be prepared again', farm.preparePlot('plot_0', inventory).success);

section('Seasons gate planting');
const summerTime = { ...time.getTime(), month: 7, season: Season.SUMMER, totalDays: 130 };
check('wheat is refused in summer', !farm.plantCrop('plot_0', CropType.WHEAT, summerTime, inventory).success);
check('spring day is spring', seasonForDay(10) === Season.SPRING);
check('winter day is winter', seasonForDay(300) === Season.WINTER);

section('Selling and re-investing');
const sellPrice = economy.getSellPrice('wheat');
check('market buys wheat at a positive price', sellPrice > 0);
check('scarce stock raises the deterministic price factor', getMarketPriceFactor(0, 10, 0, 0) > getMarketPriceFactor(10, 10, 0, 0));
check('demand and route disruption raise prices within a fixed bound', getMarketPriceFactor(0, 10, 100, 1) === 1.35);
const currencyBeforeSale = economy.getCurrency();
const sale = economy.sellItem('wheat', 3);
check('surplus wheat can be sold', sale.success);
check(
  'akçe increases by price x quantity',
  economy.getCurrency() === currencyBeforeSale + sellPrice * 3,
);
check('wheat removed from inventory', inventory.getItemCount('wheat') === 0);

const currencyBeforeBuy = economy.getCurrency();
const seedPrice = economy.getBuyPrice('seed_wheat');
const purchase = economy.buyItem('seed_wheat', 2);
check('proceeds buy new seeds', purchase.success && inventory.getItemCount('seed_wheat') === 2);
check('seed purchase deducts akçe', economy.getCurrency() === currencyBeforeBuy - seedPrice * 2);
const adjustedEconomy = new Economy(new Inventory(), 100);
const adjustedCost = Math.floor(adjustedEconomy.getBuyPrice('seed_wheat') * 1.4);
adjustedEconomy.buyItem('seed_wheat', 1, 0, 2);
check('market transaction price factor is bounded', adjustedEconomy.getCurrency() === 100 - adjustedCost);

section('Insufficient funds validation');
const broke = new Economy(new Inventory());
broke.removeCurrency(broke.getCurrency());
const denied = broke.buyItem('seed_wheat', 1);
check('purchase is denied without funds', !denied.success);
check('denial explains insufficient funds', /Yetersiz|Insufficient/.test(denied.message));

section('Atomic market inventory transfers');
const tightInventory = new Inventory();
tightInventory.deserialize({ items: [['seed_wheat', 98]], maxSlots: 1 });
const tightEconomy = new Economy(tightInventory, 100);
const beforeRejectedBuy = tightEconomy.getCurrency();
const rejectedBuy = tightEconomy.buyItem('seed_wheat', 2);
check('inventory overflow rejects a purchase without partial items', !rejectedBuy.success && tightInventory.getItemCount('seed_wheat') === 98);
check('rejected inventory transfer keeps player currency', tightEconomy.getCurrency() === beforeRejectedBuy);
check('nonstackable goods reject multi-unit addition', !tightInventory.addItem('hoe', 2) && !tightInventory.hasItem('hoe'));

section('Save / load round trip');
time.advanceDays(1);
farm.updateGrowth(time.getTime().totalDays);
const savedFarm = farm.serialize();
const savedInventory = inventory.serialize();
const savedEconomy = economy.serialize();
const savedTime = time.getTime();

const loadedFarm = new FarmSimulation();
const loadedInventory = new Inventory();
const loadedEconomy = new Economy(loadedInventory);
loadedInventory.deserialize(savedInventory);
loadedEconomy.deserialize(savedEconomy);
loadedFarm.deserialize(JSON.parse(JSON.stringify(savedFarm)));
loadedFarm.updateGrowth(savedTime.totalDays);

check('inventory survives round trip', loadedInventory.getItemCount('seed_wheat') === inventory.getItemCount('seed_wheat'));
check('currency survives round trip', loadedEconomy.getCurrency() === economy.getCurrency());
check('land ownership survives round trip', loadedFarm.getPlotById('plot_8')?.unlocked === true);
check(
  'plot state survives round trip',
  loadedFarm.getPlotById('plot_0')?.state === farm.getPlotById('plot_0')?.state,
);
check('hoe survives round trip', loadedInventory.hasItem('hoe'));

section('Time pause and offline rules');
check('house foundation blocks its interior', isInsideHouseFootprint(0, -16));
check('house collision leaves the front approach clear', !isInsideHouseFootprint(0, 12));
check('house collision leaves the rear approach clear', !isInsideHouseFootprint(0, -40));
check('house collision leaves side clearance clear', !isInsideHouseFootprint(70, -16));
const beforePause = time.getTime();
time.pause();
time.update(Date.now() + 1_000_000);
check('paused time does not advance', time.getTime().totalDays === beforePause.totalDays);
time.resume(Date.now());
check('resumed time is unpaused', !time.isPaused());
check('offline progress is capped at 7 days', time.calculateOfflineDays(Date.now() - 1_000_000_000) === 7);

const historyTime = TimeManager.getInstance();
historyTime.advanceDays(31);
check('calendar rolls into the next month', historyTime.getTime().month === 4);
check('total days accumulate', historyTime.getTime().totalDays > 30);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
