import { Scene } from 'phaser';
import { Player } from '@entities/Player';
import { FarmManager } from './FarmManager';
import { FarmPlotState, CropType, CROP_DEFINITIONS, FarmPlotData } from '@data/CropData';
import { Economy } from './Economy';
import { Inventory } from './Inventory';
import { FARM_ECONOMY_CONFIG } from '@data/EconomyData';
import { registerUi } from '@utils/CameraLayers';
import { AudioManager } from './AudioManager';

export class FarmInteractionSystem {
  private scene: Scene;
  private player: Player;
  private farmManager: FarmManager;
  private economy: Economy;
  private inventory: Inventory;
  private promptText: Phaser.GameObjects.Text | null = null;
  private menu: Phaser.GameObjects.Container | null = null;
  private currentPlotId: string | null = null;
  private currentPrompt = '';
  private touchLayout: boolean;
  private onQuestEvent: ((event:string)=>void)|undefined;

  constructor(
    scene: Scene,
    player: Player,
    farmManager: FarmManager,
    economy: Economy,
    inventory: Inventory,
    touchLayout = false,
    onQuestEvent?: (event:string)=>void,
  ) {
    this.scene = scene;
    this.player = player;
    this.farmManager = farmManager;
    this.economy = economy;
    this.inventory = inventory;
    this.touchLayout = touchLayout;
    this.onQuestEvent = onQuestEvent;

    // Remove any open UI when the scene shuts down or restarts.
    this.scene.events.once('shutdown', () => this.destroy());
  }

  public update(): void {
    const playerPos = this.player.getGridPosition();
    const plot = this.farmManager.getPlotAt(playerPos.x, playerPos.y);

    if (plot) {
      const prompt = this.buildPrompt(plot);
      if (plot.id !== this.currentPlotId || prompt !== this.currentPrompt) {
        this.currentPlotId = plot.id;
        this.currentPrompt = prompt;
        this.showPrompt(prompt);
      }
    } else if (this.currentPlotId) {
      this.currentPlotId = null;
      this.currentPrompt = '';
      this.hidePrompt();
    }
  }

  private buildPrompt(plot: FarmPlotData): string {
    const key = this.touchLayout ? '' : 'F: ';

    if (!plot.unlocked) {
      return `${key}Arazi kirala — ${FARM_ECONOMY_CONFIG.landCost} akçe`;
    }

    switch (plot.state) {
      case FarmPlotState.UNTROUCHED:
        return `${key}Toprağı hazırla (çapa)`;
      case FarmPlotState.PREPARED:
        return `${key}Tohum ek / satın al`;
      case FarmPlotState.SEEDED:
      case FarmPlotState.GROWING:
        return `Büyüyor… %${Math.round(plot.growthProgress * 100)}`;
      case FarmPlotState.READY_TO_HARVEST:
        return `${key}Hasat et`;
      case FarmPlotState.HARVESTED:
        return `${key}Toprağı yeniden hazırla`;
      default:
        return '';
    }
  }

  private showPrompt(text: string): void {
    this.hidePrompt();
    if (!text) return;

    const { width, height } = this.scene.scale;
    this.promptText = this.scene.add.text(width / 2, height - 96, text, {
      fontFamily: 'Arial',
      fontSize: '14px',
      color: '#f3e3c0',
      backgroundColor: '#1a120bcc',
      padding: { x: 12, y: 7 },
    });
    this.promptText.setOrigin(0.5, 0.5);
    this.promptText.setScrollFactor(0);
    this.promptText.setDepth(250);
    registerUi(this.scene, this.promptText);
  }

  private hidePrompt(): void {
    if (this.promptText) {
      this.promptText.destroy();
      this.promptText = null;
    }
  }

  public interact(): void {
    if (!this.currentPlotId) return;

    const plot = this.farmManager.getPlotById(this.currentPlotId);
    if (!plot) return;

    if (!plot.unlocked) {
      const result = this.farmManager.purchasePlot(this.currentPlotId);
      this.showFeedback(result.message, result.success);
      if (result.success) this.refreshPrompt();
      return;
    }

    switch (plot.state) {
      case FarmPlotState.UNTROUCHED:
      case FarmPlotState.HARVESTED: {
        const result = this.farmManager.preparePlot(this.currentPlotId);
        this.showFeedback(result.message, result.success);
        if(result.success)AudioManager.getInstance().playFarming('prepare');
        this.refreshPrompt();
        break;
      }

      case FarmPlotState.PREPARED:
        this.showPlantMenu();
        break;

      case FarmPlotState.READY_TO_HARVEST: {
        const crop=plot.cropType;
        const result = this.farmManager.harvestCrop(this.currentPlotId);
        this.showFeedback(result.message, result.success);
        if(result.success)AudioManager.getInstance().playFarming('harvest');
        if(result.success){this.onQuestEvent?.('farm.harvest');if(crop===CropType.BARLEY)this.onQuestEvent?.('farm.harvest.barley');if(crop===CropType.WHEAT)this.onQuestEvent?.('farm.harvest.wheat');if(crop===CropType.OATS)this.onQuestEvent?.('farm.harvest.oats');}
        this.refreshPrompt();
        break;
      }

      default:
        break;
    }
  }

  private refreshPrompt(): void {
    if (!this.currentPlotId) return;
    const plot = this.farmManager.getPlotById(this.currentPlotId);
    if (plot) {
      const prompt = this.buildPrompt(plot);
      this.currentPrompt = prompt;
      this.showPrompt(prompt);
    }
  }

  private showPlantMenu(): void {
    if (!this.currentPlotId) return;
    this.closeMenu();

    const { width, height } = this.scene.scale;
    this.menu = this.scene.add.container(width / 2, height / 2);

    const bg = this.scene.add.graphics();
    bg.fillStyle(0x241a10, 0.96);
    bg.fillRoundedRect(-170, -130, 340, 260, 10);
    bg.lineStyle(2, 0x8b7355, 1);
    bg.strokeRoundedRect(-170, -130, 340, 260, 10);

    const title = this.scene.add.text(0, -108, 'Tohum Seç / Select Seed', {
      fontFamily: 'Arial',
      fontSize: '15px',
      color: '#d4af37',
    });
    title.setOrigin(0.5, 0.5);

    const buttons: Phaser.GameObjects.GameObject[] = [bg, title];
    const crops = Object.values(CROP_DEFINITIONS);
    crops.forEach((crop, index) => {
      const seeds = this.inventory.getItemCount(crop.seedItemId);
      buttons.push(this.createMenuButton(0, -62 + index * 34,
        `${crop.name} ek (tohum: ${seeds})`, seeds > 0, () => this.plant(crop.id)));
      buttons.push(this.createMenuButton(0, 40 + index * 29,
        `${crop.name} tohumu al — ${this.economy.getBuyPrice(crop.seedItemId)} akçe`, true, () => {
          const result = this.economy.buyItem(crop.seedItemId, 1);
          this.showFeedback(result.message, result.success);
          if (result.success) this.showPlantMenu();
        }));
    });

    const money = this.scene.add.text(0, 116, `Akçe: ${this.economy.getCurrency()}`, {
      fontFamily: 'Arial',
      fontSize: '12px',
      color: '#c8b48a',
    });
    money.setOrigin(0.5, 0.5);
    buttons.push(money);

    const closeBtn = this.scene.add.text(150, -108, 'X', {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: '#ff7b6b',
    });
    closeBtn.setOrigin(0.5, 0.5);
    closeBtn.setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => this.closeMenu());
    buttons.push(closeBtn);

    this.menu.add(buttons);
    this.menu.setScrollFactor(0);
    this.menu.setDepth(500);
    registerUi(this.scene, this.menu);
  }

  private plant(cropType: CropType): void {
    if (!this.currentPlotId) return;
    const result = this.farmManager.plantCrop(this.currentPlotId, cropType);
    this.showFeedback(result.message, result.success);
    if (result.success) {
      AudioManager.getInstance().playFarming('plant');
      this.closeMenu();
      this.refreshPrompt();
      this.onQuestEvent?.('tutorial:plant');
    }
  }

  private createMenuButton(
    x: number,
    y: number,
    text: string,
    enabled: boolean,
    callback: () => void,
  ): Phaser.GameObjects.Container {
    const container = this.scene.add.container(x, y);
    const btnBg = this.scene.add.graphics();
    const draw = (hover: boolean): void => {
      const fill = !enabled ? 0x2f2a22 : hover ? 0x5a4738 : 0x453526;
      btnBg.clear();
      btnBg.fillStyle(fill, 1);
      btnBg.fillRoundedRect(-145, -14, 290, 28, 5);
      btnBg.lineStyle(1, enabled ? 0x8b7355 : 0x554a3c, 1);
      btnBg.strokeRoundedRect(-145, -14, 290, 28, 5);
    };
    draw(false);

    const btnText = this.scene.add.text(0, 0, text, {
      fontFamily: 'Arial',
      fontSize: '12px',
      color: enabled ? '#ffffff' : '#7a6f60',
    });
    btnText.setOrigin(0.5, 0.5);

    container.add([btnBg, btnText]);
    container.setSize(290, 28);
    if (enabled) {
      container.setInteractive({ useHandCursor: true });
      container.on('pointerdown', callback);
      container.on('pointerover', () => draw(true));
      container.on('pointerout', () => draw(false));
    }

    return container;
  }

  private showFeedback(message: string, success: boolean): void {
    const { width, height } = this.scene.scale;
    const feedback = this.scene.add.text(width / 2, height - 130, message, {
      fontFamily: 'Arial',
      fontSize: '13px',
      color: success ? '#b7e4a0' : '#ff9b8d',
      backgroundColor: '#1a120bcc',
      padding: { x: 10, y: 6 },
    });
    feedback.setOrigin(0.5, 0.5);
    feedback.setScrollFactor(0);
    feedback.setDepth(510);
    registerUi(this.scene, feedback);

    this.scene.tweens.add({
      targets: feedback,
      alpha: 0,
      y: feedback.y - 20,
      delay: 1200,
      duration: 500,
      onComplete: () => feedback.destroy(),
    });
  }

  private closeMenu(): void {
    if (this.menu) {
      this.menu.destroy();
      this.menu = null;
    }
  }

  /** Re-anchors any open prompt after a viewport resize. */
  public handleResize(): void {
    this.closeMenu();
    if (this.currentPrompt) {
      this.showPrompt(this.currentPrompt);
    }
  }

  public destroy(): void {
    this.hidePrompt();
    this.closeMenu();
  }
}
