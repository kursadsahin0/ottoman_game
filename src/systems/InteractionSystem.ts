import { Scene } from 'phaser';
import { Player } from '@entities/Player';
import { WorldObjectManager, WorldObjectSprite } from '@systems/WorldObjectManager';
import { ObjectType } from '@data/WorldData';
import { registerUi, registerWorld } from '@utils/CameraLayers';

export interface InteractionHandlers {
  openMarket?: () => void;
}

/**
 * Finds the nearest interactable object and presents a contextual prompt.
 * The interaction indicator is created once and only redrawn when the
 * selected object changes, avoiding per-frame allocations.
 */
export class InteractionSystem {
  private scene: Scene;
  private player: Player;
  private objectManager: WorldObjectManager;
  private handlers: InteractionHandlers;
  private promptText: Phaser.GameObjects.Text | null = null;
  private dialogText: Phaser.GameObjects.Text | null = null;
  private indicator: Phaser.GameObjects.Graphics;
  private currentInteractable: WorldObjectSprite | null = null;
  private currentPrompt = '';
  private touchLayout: boolean;

  constructor(
    scene: Scene,
    player: Player,
    objectManager: WorldObjectManager,
    handlers: InteractionHandlers = {},
    touchLayout = false,
  ) {
    this.scene = scene;
    this.player = player;
    this.objectManager = objectManager;
    this.handlers = handlers;
    this.touchLayout = touchLayout;

    this.indicator = scene.add.graphics();
    this.indicator.setDepth(180);
    this.indicator.setVisible(false);
    registerWorld(scene, this.indicator);

    this.scene.events.once('shutdown', () => this.destroy());
  }

  public update(): void {
    const playerPos = this.player.getGridPosition();
    const nearby = this.objectManager.findNearbyInteractable(playerPos.x, playerPos.y);

    if (nearby !== this.currentInteractable) {
      this.currentInteractable = nearby;
      this.updatePrompt();
      this.redrawIndicator();
    } else if (nearby) {
      // Objects can momentarily be static; keep the ring aligned with them.
      this.redrawIndicator();
    }
  }

  private updatePrompt(): void {
    this.hidePrompt();
    if (!this.currentInteractable) return;

    const prompt = `${this.currentInteractable.getObjectData().type === ObjectType.MARKET_STALL ? 'Pazar' : this.currentInteractable.getInteractionText()}`;
    this.currentPrompt = prompt;

    const { width, height } = this.scene.scale;
    const label = this.touchLayout ? prompt : `E: ${prompt}`;
    this.promptText = this.scene.add.text(width / 2, height - 72, label, {
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

  private redrawIndicator(): void {
    this.indicator.clear();
    if (!this.currentInteractable) {
      this.indicator.setVisible(false);
      return;
    }

    const target = this.currentInteractable;
    const pulse = 1.5 + Math.sin(this.scene.time.now * 0.005) * 1.2;
    const y = target.y + 8;

    this.indicator.setVisible(true);
    this.indicator.lineStyle(2, 0xf0cf8a, 0.9);
    this.indicator.strokeEllipse(target.x, y, 34 + pulse, 16 + pulse * 0.5);
  }

  /** Returns true when an interaction was handled. */
  public tryInteract(): boolean {
    const target = this.currentInteractable;
    if (!target) return false;

    const data = target.getObjectData();
    switch (data.type) {
      case ObjectType.MARKET_STALL:
        if (this.handlers.openMarket) this.handlers.openMarket();
        else this.showDialog('Pazarcı bugün tezgâhını kurmamış.');
        return true;

      case ObjectType.HOUSE:
        this.showDialog('Ev sahibi başını sallıyor: "Bereketli hasatlar, yiğidim."');
        return true;

      case ObjectType.WELL:
        this.showDialog('Kuyudan soğuk, berrak su çektin. Tarla sulamak için iyi bir gün.');
        return true;

      case ObjectType.ZAVIYE:
        this.showDialog('Bu küçük zaviye yolculara barınak, çevre halkına da ortak bir buluşma yeri sunuyor.');
        return true;

      case ObjectType.TREE:
        this.showDialog('Rüzgâr meşe dallarını hışırdatıyor.');
        return true;

      default:
        this.showDialog(data.interactionText ?? 'Burada yapılacak bir şey yok.');
        return true;
    }
  }

  public getCurrentPrompt(): string {
    return this.currentPrompt;
  }

  public handleResize(): void {
    this.updatePrompt();
    this.redrawIndicator();
  }

  public hasTarget(): boolean {
    return this.currentInteractable !== null;
  }

  private showDialog(text: string): void {
    if (this.dialogText) this.dialogText.destroy();

    const { width, height } = this.scene.scale;
    this.dialogText = this.scene.add.text(width / 2, height - 140, text, {
      fontFamily: 'Arial',
      fontSize: '13px',
      color: '#f3e3c0',
      backgroundColor: '#1a120bdd',
      padding: { x: 14, y: 10 },
      wordWrap: { width: Math.min(460, width - 60) },
      align: 'center',
    });
    this.dialogText.setOrigin(0.5, 0.5);
    this.dialogText.setScrollFactor(0);
    this.dialogText.setDepth(510);
    registerUi(this.scene, this.dialogText);

    const dialog = this.dialogText;
    this.scene.time.delayedCall(2600, () => {
      if (dialog.active) dialog.destroy();
    });
  }

  public destroy(): void {
    this.hidePrompt();
    if (this.dialogText) {
      this.dialogText.destroy();
      this.dialogText = null;
    }
    this.indicator.destroy();
  }
}
