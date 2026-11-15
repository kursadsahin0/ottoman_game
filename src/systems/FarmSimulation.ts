import {
  CROP_DEFINITIONS,
  CropType,
  FarmPlotData,
  FarmPlotState,
} from '@data/CropData';
import { FARM_ECONOMY_CONFIG } from '@data/EconomyData';
import { DEFAULT_CALENDAR, GameTime, Season, type CalendarConfig } from './TimeManager';
import { Inventory } from './Inventory';
import { Economy } from './Economy';
import { weatherFor } from '../village/VillageClock';

export interface FarmActionResult {
  success: boolean;
  message: string;
  itemId?: string;
  quantity?: number;
}

/** Map of the farm plots in the family holding, in world grid coordinates. */
const DEFAULT_PLOT_LAYOUT: ReadonlyArray<{ x: number; y: number }> = [
  { x: 10, y: 12 }, { x: 11, y: 12 }, { x: 12, y: 12 },
  { x: 10, y: 13 }, { x: 11, y: 13 }, { x: 12, y: 13 },
  { x: 10, y: 14 }, { x: 11, y: 14 }, { x: 12, y: 14 },
];

/** Plots the family already holds at the start of the game. */
const INITIALLY_OWNED_PLOTS = 3;

/** The calendar starts on the first day of March 1299 (totalDays = 0). */
const GAME_START_MONTH = 3;

export function calendarDateForDay(totalDays: number, calendar: CalendarConfig = DEFAULT_CALENDAR): GameTime {
  const startOffset = (GAME_START_MONTH - 1) * calendar.daysPerMonth;
  const absoluteDay = startOffset + Math.floor(totalDays);
  const monthIndex = Math.floor(absoluteDay / calendar.daysPerMonth);
  const month = monthIndex % calendar.monthsPerYear + 1;
  const year = 1299 + Math.floor(monthIndex / calendar.monthsPerYear);
  const season = seasonForMonth(month, calendar);
  return { day: absoluteDay % calendar.daysPerMonth + 1, month, year, season, totalDays };
}

export function calendarMonthForDay(totalDays: number, calendar: CalendarConfig = DEFAULT_CALENDAR): number {
  return calendarDateForDay(totalDays, calendar).month;
}

export function seasonForMonth(month: number, calendar: CalendarConfig = DEFAULT_CALENDAR): Season {
  const { spring, summer, autumn, winter } = calendar.seasonStarts;
  const ranges = [
    { season: Season.SPRING, start: spring, end: summer },
    { season: Season.SUMMER, start: summer, end: autumn },
    { season: Season.AUTUMN, start: autumn, end: winter },
  ];
  return ranges.find(r => r.start <= r.end ? month >= r.start && month < r.end : month >= r.start || month < r.end)?.season ?? Season.WINTER;
}

export function seasonForDay(totalDays: number, calendar: CalendarConfig = DEFAULT_CALENDAR): Season {
  return seasonForMonth(calendarMonthForDay(totalDays, calendar), calendar);
}

/**
 * Pure farming simulation. Contains no Phaser imports so the full gameplay
 * loop can be exercised headlessly in tests and reused by any renderer.
 */
export class FarmSimulation {
  private plots = new Map<string, FarmPlotData>();
  private npcInventories = new Map<string, Inventory>();

  constructor() {
    this.createDefaultPlots();
  }

  private createDefaultPlots(): void {
    DEFAULT_PLOT_LAYOUT.forEach((pos, index) => {
      const plot: FarmPlotData = {
        id: `plot_${index}`,
        gridX: pos.x,
        gridY: pos.y,
        state: FarmPlotState.UNTROUCHED,
        growthProgress: 0,
        unlocked: index < INITIALLY_OWNED_PLOTS,
        locationId: 'kizilca_village',
        soilQuality: 60,
        moisture: 55,
      };
      this.plots.set(plot.id, plot);
    });
    for (const [index, npcId] of ['hasan_farmer', 'rukiye_farmer'].entries()) {
      const id = `npc_field_${npcId}`;
      this.plots.set(id, { id, gridX: 40 + index, gridY: 40, state: FarmPlotState.UNTROUCHED,
        growthProgress: 0, unlocked: true, locationId: 'npc_fields', soilQuality: 58, moisture: 54 });
      this.npcInventories.set(npcId, new Inventory({ hoe: 1, seed_wheat: 3, seed_barley: 3, seed_oats: 2 }));
    }
  }

  /** Farm workers call the same preparation, planting, weather growth and harvest rules as the player. */
  public simulateNpcWork(npcId: string, time: GameTime, absoluteHour: number): boolean {
    const plot = this.plots.get(`npc_field_${npcId}`);
    const inventory = this.npcInventories.get(npcId);
    if (!plot || !inventory || plot.npcLastWorkHour === absoluteHour) return false;
    plot.npcLastWorkHour = absoluteHour;
    if (plot.state === FarmPlotState.READY_TO_HARVEST) return this.harvestCrop(plot.id, inventory).success;
    if (plot.state === FarmPlotState.UNTROUCHED || plot.state === FarmPlotState.HARVESTED) return this.preparePlot(plot.id, inventory).success;
    if (plot.state !== FarmPlotState.PREPARED) return false;
    const crops = Object.values(CROP_DEFINITIONS);
    const start = (Math.floor(time.totalDays / 7) + npcId.length) % crops.length;
    for (let offset = 0; offset < crops.length; offset++) {
      const crop = crops[(start + offset) % crops.length]!;
      if (!crop.suitableSeasons.includes(time.season) || inventory.getItemCount(crop.seedItemId) <= 0) continue;
      if (this.plantCrop(plot.id, crop.id, time, inventory).success) return true;
    }
    return false;
  }

  public getNpcFarmInventory(npcId: string): Inventory | undefined { return this.npcInventories.get(npcId); }

  public getPlotById(plotId: string): FarmPlotData | undefined {
    return this.plots.get(plotId);
  }

  public getPlotAt(gridX: number, gridY: number): FarmPlotData | null {
    for (const plot of this.plots.values()) {
      if ((plot.locationId ?? 'kizilca_village') === 'kizilca_village' && Math.floor(plot.gridX) === Math.floor(gridX) && Math.floor(plot.gridY) === Math.floor(gridY)) {
        return plot;
      }
    }
    return null;
  }

  public getAllPlots(): FarmPlotData[] {
    return Array.from(this.plots.values());
  }

  public addRegionalProperty(propertyId:string,locationId:string,count:number):void {
    for(let i=0;i<count;i++){const id=`${propertyId}_plot_${i+1}`;if(this.plots.has(id))continue;this.plots.set(id,{id,gridX:40+i,gridY:40,state:FarmPlotState.UNTROUCHED,growthProgress:0,unlocked:true,locationId,propertyId});}
  }

  public purchasePlot(plotId: string, economy: Economy): FarmActionResult {
    const plot = this.plots.get(plotId);
    if (!plot) return { success: false, message: 'Arazi bulunamadı (Plot not found)' };
    if (plot.unlocked) {
      return { success: false, message: 'Bu arazi zaten sizin (Already owned)' };
    }

    const cost = FARM_ECONOMY_CONFIG.landCost;
    if (!economy.removeCurrency(cost)) {
      return { success: false, message: `Yetersiz para: ${cost} akçe gerekli` };
    }

    plot.unlocked = true;
    return { success: true, message: `Arazi kiralandı (${cost} akçe)` };
  }

  public preparePlot(plotId: string, inventory: Inventory): FarmActionResult {
    const plot = this.plots.get(plotId);
    if (!plot) return { success: false, message: 'Arazi bulunamadı (Plot not found)' };
    if (!plot.unlocked) {
      return { success: false, message: 'Bu arazi sizin değil (Plot not owned)' };
    }
    if (plot.state !== FarmPlotState.UNTROUCHED && plot.state !== FarmPlotState.HARVESTED) {
      return { success: false, message: 'Toprak şu anda hazırlanamaz (Cannot prepare now)' };
    }
    if (!inventory.hasItem('hoe')) {
      return { success: false, message: 'Çapa gerekli (Hoe required)' };
    }

    plot.state = FarmPlotState.PREPARED;
    plot.growthProgress = 0;
    plot.moisture = Math.max(35, plot.moisture ?? 55);
    delete plot.cropType;
    delete plot.plantedDay;
    return { success: true, message: 'Toprak hazırlandı (Soil prepared)' };
  }

  public plantCrop(
    plotId: string,
    cropType: CropType,
    time: GameTime,
    inventory: Inventory,
  ): FarmActionResult {
    const plot = this.plots.get(plotId);
    if (!plot) return { success: false, message: 'Arazi bulunamadı (Plot not found)' };
    if (!plot.unlocked) {
      return { success: false, message: 'Bu arazi sizin değil (Plot not owned)' };
    }
    if (plot.state !== FarmPlotState.PREPARED) {
      return { success: false, message: 'Önce toprağı hazırlayın (Prepare soil first)' };
    }

    const crop = CROP_DEFINITIONS[cropType];
    if (!crop.suitableSeasons.includes(time.season)) {
      return {
        success: false,
        message: `${crop.name} bu mevsimde ekilemez (Not suitable for ${time.season})`,
      };
    }
    if (!inventory.hasItem(crop.seedItemId)) {
      return { success: false, message: `${crop.name} tohumu yok (No seeds)` };
    }
    if (!inventory.removeItem(crop.seedItemId, 1)) {
      return { success: false, message: 'Tohum kullanılamadı (Seed unavailable)' };
    }

    plot.state = FarmPlotState.SEEDED;
    plot.cropType = cropType;
    plot.plantedDay = time.totalDays;
    plot.growthProgress = 0;
    plot.cropQuality = 60;
    return { success: true, message: `${crop.name} ekildi (Planted)` };
  }

  /**
   * Recomputes crop progress from the calendar. Growth only counts days whose
   * season is suitable for the crop, so winter pauses development.
   * Returns the ids of plots whose visual state changed.
   */
  public updateGrowth(currentTotalDays: number, calendar: CalendarConfig = DEFAULT_CALENDAR): string[] {
    const changed: string[] = [];

    for (const plot of this.plots.values()) {
      if (plot.state !== FarmPlotState.SEEDED && plot.state !== FarmPlotState.GROWING) continue;
      if (plot.cropType === undefined || plot.plantedDay === undefined) continue;

      const crop = CROP_DEFINITIONS[plot.cropType];
      const plantedDay = plot.plantedDay;
      let growthUnits = 0;
      let moisture = Math.max(0, Math.min(100, plot.moisture ?? 55));
      let conditionSum = 0;
      let conditionDays = 0;
      const lastDay = Math.floor(currentTotalDays);

      for (let day = Math.floor(plantedDay) + 1; day <= lastDay; day++) {
        const date = calendarDateForDay(day, calendar);
        if (!crop.suitableSeasons.includes(date.season)) continue;
        const weather = weatherFor(date);
        moisture = Math.min(100, Math.max(0, moisture + (weather === 'rain' ? 24 : weather === 'snow' ? 10 : weather === 'clear' ? -7 : weather === 'wind' ? -11 : weather === 'fog' ? 2 : -3)));
        const waterFactor = moisture >= crop.waterNeed ? 1.05 : moisture >= crop.waterNeed * 0.45 ? 0.85 : 0.55;
        growthUnits += waterFactor;
        conditionSum += moisture;
        conditionDays++;
        if (growthUnits >= crop.growthDays) break;
      }

      const progress = Math.min(growthUnits / crop.growthDays, 1);
      plot.moisture = moisture;
      if (conditionDays > 0) plot.cropQuality = Math.max(0, Math.min(100, Math.round((conditionSum / conditionDays) * 0.7 + (plot.soilQuality ?? 60) * 0.3)));
      const nextState = progress >= 1
        ? FarmPlotState.READY_TO_HARVEST
        : (progress > 0 ? FarmPlotState.GROWING : FarmPlotState.SEEDED);

      if (progress !== plot.growthProgress || nextState !== plot.state) {
        plot.growthProgress = progress;
        plot.state = nextState;
        changed.push(plot.id);
      }
    }

    return changed;
  }

  public harvestCrop(plotId: string, inventory: Inventory, yieldBonus = 0): FarmActionResult {
    const plot = this.plots.get(plotId);
    if (!plot) return { success: false, message: 'Arazi bulunamadı (Plot not found)' };
    if (plot.state !== FarmPlotState.READY_TO_HARVEST || plot.cropType === undefined) {
      return { success: false, message: 'Hasat için hazır değil (Not ready for harvest)' };
    }

    const crop = CROP_DEFINITIONS[plot.cropType];
    const qualityAdjustment = (plot.cropQuality ?? 60) >= 88 ? 1 : (plot.cropQuality ?? 60) <= 18 ? -1 : 0;
    const harvestYield = Math.max(1, crop.harvestYield + qualityAdjustment + Math.max(0, Math.min(1, Math.floor(yieldBonus))));
    if (!inventory.addItem(crop.harvestItemId, harvestYield)) {
      return { success: false, message: 'Envanter dolu (Inventory full)' };
    }

    plot.state = FarmPlotState.HARVESTED;
    plot.growthProgress = 0;
    plot.soilQuality = Math.max(0, (plot.soilQuality ?? 60) - 7);
    plot.moisture = Math.max(0, (plot.moisture ?? 55) - 5);
    plot.cropQuality = 0;
    delete plot.cropType;
    delete plot.plantedDay;

    return {
      success: true,
      message: `${crop.name} hasat edildi (+${harvestYield})`,
      itemId: crop.harvestItemId,
      quantity: harvestYield,
    };
  }

  public serialize(): { plots: FarmPlotData[]; npcInventories: Record<string, { items: Array<[string, number]>; maxSlots: number }> } {
    return { plots: Array.from(this.plots.values()).map(plot => ({ ...plot })), npcInventories: Object.fromEntries([...this.npcInventories].map(([id, inventory]) => [id, inventory.serialize()])) };
  }

  public deserialize(data: { plots?: Partial<FarmPlotData>[]; npcInventories?: Record<string, { items?: Array<[string, number]>; maxSlots?: number }> } | null | undefined): void {
    if (!data || !Array.isArray(data.plots)) return;

    for (const saved of data.plots) {
      if (!saved.id) continue;
      let existing = this.plots.get(saved.id);
      if (!existing) { if(typeof saved.locationId!=='string')continue;existing={id:saved.id,gridX:saved.gridX??40,gridY:saved.gridY??40,state:saved.state??FarmPlotState.UNTROUCHED,growthProgress:saved.growthProgress??0,unlocked:saved.unlocked??false,locationId:saved.locationId,...(saved.propertyId?{propertyId:saved.propertyId}:{})};this.plots.set(saved.id,existing); }
      if (!existing) continue;

      existing.state = saved.state ?? FarmPlotState.UNTROUCHED;
      existing.growthProgress = saved.growthProgress ?? 0;
      existing.unlocked = saved.unlocked ?? false;
      existing.soilQuality = typeof saved.soilQuality === 'number' ? Math.max(0, Math.min(100, saved.soilQuality)) : existing.soilQuality ?? 60;
      existing.moisture = typeof saved.moisture === 'number' ? Math.max(0, Math.min(100, saved.moisture)) : existing.moisture ?? 55;
      existing.cropQuality = typeof saved.cropQuality === 'number' ? Math.max(0, Math.min(100, saved.cropQuality)) : 60;
      if (typeof saved.npcLastWorkHour === 'number' && Number.isFinite(saved.npcLastWorkHour)) existing.npcLastWorkHour = Math.max(0, Math.floor(saved.npcLastWorkHour));
      else delete existing.npcLastWorkHour;
      existing.locationId = saved.locationId ?? existing.locationId ?? 'kizilca_village';
      if(saved.propertyId)existing.propertyId=saved.propertyId;

      if (saved.cropType !== undefined) {
        existing.cropType = saved.cropType;
      } else {
        delete existing.cropType;
      }
      if (saved.plantedDay !== undefined) {
        existing.plantedDay = saved.plantedDay;
      } else {
        delete existing.plantedDay;
      }
    }
    if (data.npcInventories && typeof data.npcInventories === 'object') {
      for (const [npcId, saved] of Object.entries(data.npcInventories)) {
        const inventory = this.npcInventories.get(npcId);
        if (inventory) inventory.deserialize(saved);
      }
    } else {
      for (const npcId of ['hasan_farmer', 'rukiye_farmer']) {
        this.npcInventories.get(npcId)?.deserialize(new Inventory({ hoe: 1, seed_wheat: 3, seed_barley: 3, seed_oats: 2 }).serialize());
        const plot = this.plots.get(`npc_field_${npcId}`);
        if (plot) {
          plot.state = FarmPlotState.UNTROUCHED; plot.growthProgress = 0; plot.soilQuality = 58; plot.moisture = 54; plot.cropQuality = 60;
          delete plot.cropType; delete plot.plantedDay; delete plot.npcLastWorkHour;
        }
      }
    }
  }
}
