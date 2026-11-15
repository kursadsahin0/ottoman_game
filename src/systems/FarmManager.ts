import { Scene } from 'phaser';
import { CropType, FarmPlotData, FarmPlotState } from '@data/CropData';
import { IsometricUtils } from '@utils/IsometricUtils';
import { FARM_ANCHOR } from '../art/FarmArt';
import { worldDepth } from '@utils/Depth';
import { registerWorld } from '@utils/CameraLayers';
import { FarmSimulation, FarmActionResult } from './FarmSimulation';
import { Inventory } from './Inventory';
import { Economy } from './Economy';
import { TimeManager } from './TimeManager';
import { ProfessionSystem } from './ProfessionSystem';
import type { VillageNpcState } from '../village/types';

/**
 * Renders farm plots from FarmSimulation data and exposes the same actions,
 * keeping all gameplay rules inside the pure simulation.
 */
export class FarmPlotView extends Phaser.GameObjects.Container {
  private image: Phaser.GameObjects.Image;

  constructor(scene: Scene, plotData: FarmPlotData) {
    super(scene, 0, 0);

    this.image = scene.add.image(0, 0, 'farm_untouched');
    this.image.setOrigin(FARM_ANCHOR.x, FARM_ANCHOR.y);
    this.add(this.image);
    scene.add.existing(this);
    registerWorld(scene, this);

    this.applyPlot(plotData);
  }

  public applyPlot(plot: FarmPlotData): void {
    this.image.setTexture(this.resolveTexture(plot));
  }

  private resolveTexture(plot: FarmPlotData): string {
    if (!plot.unlocked) return 'farm_locked';

    const crop = plot.cropType === CropType.BARLEY ? 'barley' : 'wheat';
    switch (plot.state) {
      case FarmPlotState.PREPARED:
        return 'farm_prepared';
      case FarmPlotState.SEEDED:
        return 'farm_seeded';
      case FarmPlotState.GROWING: {
        const stage = Math.min(3, Math.max(0, Math.floor(plot.growthProgress * 4)));
        return `farm_${crop}_grow_${stage}`;
      }
      case FarmPlotState.READY_TO_HARVEST:
        return `farm_${crop}_ready`;
      case FarmPlotState.HARVESTED:
        return 'farm_harvested';
      case FarmPlotState.UNTROUCHED:
      default:
        return 'farm_untouched';
    }
  }
}

export class FarmManager {
  private scene: Scene;
  private simulation: FarmSimulation;
  private inventory: Inventory;
  private economy: Economy;
  private timeManager: TimeManager;
  private views = new Map<string, FarmPlotView>();
  private professions: ProfessionSystem | null;

  constructor(
    scene: Scene,
    simulation: FarmSimulation,
    inventory: Inventory,
    economy: Economy,
    professions?: ProfessionSystem,
  ) {
    this.scene = scene;
    this.simulation = simulation;
    this.inventory = inventory;
    this.economy = economy;
    this.professions = professions ?? null;
    this.timeManager = TimeManager.getInstance();
  }

  public createPlotSprites(): void {
    for (const plot of this.simulation.getAllPlots().filter(p=>(p.locationId??'kizilca_village')==='kizilca_village')) {
      const view = new FarmPlotView(this.scene, plot);
      const pos = IsometricUtils.gridToScreen(plot.gridX, plot.gridY);
      // gridToScreen returns the top corner of the diamond; centre the sprite.
      view.setPosition(pos.x, pos.y + IsometricUtils.getTileDimensions().height / 2);
      // Grid Y grows toward the viewer, so higher Y renders in front.
      view.setDepth(worldDepth(plot.gridX, plot.gridY));
      this.views.set(plot.id, view);
    }
  }

  /** Called every frame. Advances the calendar and refreshes changed plots. */
  public update(now: number = Date.now()): void {
    this.timeManager.update(now);
    this.syncGrowth();
  }

  /** Recomputes growth immediately (used after loading or skipping days). */
  public syncGrowth(): void {
    const changed = this.simulation.updateGrowth(this.timeManager.getTime().totalDays, this.timeManager.getCalendarConfig());
    for (const plotId of changed) {
      this.refreshPlot(plotId);
    }
  }

  /** Applies farm work only while each resident is at their outdoor field post. */
  public simulateNpcFarmWork(npcs: readonly VillageNpcState[], time: import('./TimeManager').GameTime): boolean {
    let changed = false;
    const hour = Math.floor(time.totalDays * 24);
    for (const npc of npcs) {
      if (npc.occupation !== 'farmer' || npc.activity !== 'working' || !npc.workplace) continue;
      if (Math.hypot(npc.position.x - npc.workplace.x, npc.position.y - npc.workplace.y) > 2.5) continue;
      changed = this.simulation.simulateNpcWork(npc.id, time, hour) || changed;
    }
    if (changed) this.syncGrowth();
    return changed;
  }

  public refreshAll(): void {
    for (const plotId of this.views.keys()) {
      this.refreshPlot(plotId);
    }
  }

  private refreshPlot(plotId: string): void {
    const plot = this.simulation.getPlotById(plotId);
    const view = this.views.get(plotId);
    if (plot && view) {
      view.applyPlot(plot);
    }
  }

  public preparePlot(plotId: string): FarmActionResult {
    const day = Math.floor(this.timeManager.getTime().totalDays);
    const gate = this.professions?.canWork('prepare', day);
    if (gate && !gate.ok) return { success: false, message: gate.message ?? 'Yorgunluk nedeniyle çalışılamıyor.' };
    const result = this.simulation.preparePlot(plotId, this.inventory);
    if (result.success) this.professions?.recordActivity('farming', 'prepare', plotId, day);
    this.refreshPlot(plotId);
    return result;
  }

  public plantCrop(plotId: string, cropType: CropType): FarmActionResult {
    const day = Math.floor(this.timeManager.getTime().totalDays);
    const gate = this.professions?.canWork('plant', day);
    if (gate && !gate.ok) return { success: false, message: gate.message ?? 'Yorgunluk nedeniyle çalışılamıyor.' };
    const result = this.simulation.plantCrop(
      plotId,
      cropType,
      this.timeManager.getTime(),
      this.inventory,
    );
    if (result.success) this.professions?.recordActivity('farming', 'plant', plotId, day);
    this.refreshPlot(plotId);
    return result;
  }

  public harvestCrop(plotId: string): FarmActionResult {
    const day = Math.floor(this.timeManager.getTime().totalDays);
    const gate = this.professions?.canWork('harvest', day);
    if (gate && !gate.ok) return { success: false, message: gate.message ?? 'Yorgunluk nedeniyle çalışılamıyor.' };
    const result = this.simulation.harvestCrop(plotId, this.inventory, this.professions?.getHarvestBonus() ?? 0);
    if (result.success) this.professions?.recordActivity('farming', 'harvest', plotId, day);
    this.refreshPlot(plotId);
    return result;
  }

  public purchasePlot(plotId: string): FarmActionResult {
    const result = this.simulation.purchasePlot(plotId, this.economy);
    this.refreshPlot(plotId);
    return result;
  }

  public getPlotAt(gridX: number, gridY: number): FarmPlotData | null {
    return this.simulation.getPlotAt(gridX, gridY);
  }

  public getPlotById(plotId: string): FarmPlotData | undefined {
    return this.simulation.getPlotById(plotId);
  }

  public getSimulation(): FarmSimulation {
    return this.simulation;
  }

  public destroy(): void {
    for (const view of this.views.values()) {
      view.destroy();
    }
    this.views.clear();
  }
}
