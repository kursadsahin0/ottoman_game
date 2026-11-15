import { TUTORIAL_STEPS, TutorialSystem } from '@systems/TutorialSystem';
import { registerUi } from '@utils/CameraLayers';

/** Compact non-modal guide; world input remains available while the player acts. */
export class TutorialGuide {
  private readonly scene: Phaser.Scene;
  private readonly tutorial: TutorialSystem;
  private container: Phaser.GameObjects.Container | null = null;
  private readonly resizeHandler: () => void;

  constructor(scene: Phaser.Scene, tutorial: TutorialSystem, private readonly onHide: () => void, private readonly onSkip: () => void) {
    this.scene = scene;
    this.tutorial = tutorial;
    this.resizeHandler = () => { if (this.container) this.show(); };
    scene.scale.on('resize', this.resizeHandler);
    scene.events.once('shutdown', () => { this.hide(); scene.scale.off('resize', this.resizeHandler); });
  }

  show(): void {
    this.hide();
    const step = this.tutorial.getCurrentStep();
    if (!step || !this.tutorial.isActive()) return;
    const { width, height } = this.scene.scale;
    const boxW = Math.min(width - 24, 480);
    const boxH = step.historicalContext ? 220 : 186;
    const x = Math.max(12, (width - boxW) / 2);
    const y = Math.max(252, Math.min(height - boxH - 120, 270));
    const c = this.container = this.scene.add.container(0, 0).setDepth(920).setScrollFactor(0);
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x1b1510, 0.97); bg.fillRoundedRect(x, y, boxW, boxH, 10);
    bg.lineStyle(2, 0xb58d4e, 1); bg.strokeRoundedRect(x, y, boxW, boxH, 10);
    c.add(bg);
    const stepIndex = TUTORIAL_STEPS.findIndex(item => item.id === step.id) + 1;
    c.add(this.scene.add.text(x + 16, y + 12, `FIELD GUIDE · ${stepIndex}/${TUTORIAL_STEPS.length} · ${step.title}`, {
      fontFamily: 'Georgia,serif', fontSize: width < 540 ? '13px' : '16px', color: '#f0d28b', fontStyle: 'bold',
      wordWrap: { width: boxW - 32 },
    }));
    c.add(this.scene.add.text(x + 16, y + 38, step.story, {
      fontFamily: 'Arial', fontSize: width < 540 ? '12px' : '13px', color: '#eadcc0',
      wordWrap: { width: boxW - 32 }, lineSpacing: 2,
    }));
    const objectiveY = y + 82;
    c.add(this.scene.add.text(x + 16, objectiveY, `TRY THIS  ·  ${step.objective}`, {
      fontFamily: 'Arial', fontSize: width < 540 ? '12px' : '13px', color: '#f1c96e',
      wordWrap: { width: boxW - 32 }, lineSpacing: 2,
    }));
    if (step.historicalContext) {
      c.add(this.scene.add.text(x + 16, y + 132, `HISTORICAL CONTEXT  ·  ${step.historicalContext}`, {
        fontFamily: 'Arial', fontSize: '11px', color: '#c9d4cb',
        wordWrap: { width: boxW - 32 }, lineSpacing: 2,
      }));
    }
    const bottom = y + boxH - 34;
    this.addButton(c, x + boxW - (this.tutorial.isSkipped() ? 118 : 190), bottom, 'Hide for now', this.onHide, 102);
    if (!this.tutorial.isSkipped() && !this.tutorial.isReplaying()) this.addButton(c, x + boxW - 78, bottom, 'Skip', this.onSkip, 62);
    registerUi(this.scene, c);
  }

  hide(): void { this.container?.destroy(true); this.container = null; }
  isVisible(): boolean { return this.container !== null; }

  private addButton(container: Phaser.GameObjects.Container, x: number, y: number, label: string, action: () => void, width: number): void {
    const button = this.scene.add.text(x, y, label, {
      fontFamily: 'Arial', fontSize: '11px', color: '#f3e3c0', backgroundColor: '#493528',
      padding: { x: 8, y: 6 },
    }).setFixedSize(width, 24).setInteractive({ useHandCursor: true });
    button.on('pointerdown', action);
    container.add(button);
  }
}
