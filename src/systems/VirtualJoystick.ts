import { Scene } from 'phaser';
import { registerUi } from '@utils/CameraLayers';

/**
 * Touch joystick that reports an analog vector in screen space (-1..1).
 * The scene forwards those values to InputManager, so touch and keyboard share
 * exactly the same movement pipeline.
 */
export class VirtualJoystick {
  private scene: Scene;
  private base: Phaser.GameObjects.Graphics;
  private thumb: Phaser.GameObjects.Graphics;
  private baseRadius = 60;
  private thumbRadius = 24;
  private isActive = false;
  private pointerId = -1;
  private centerX = 0;
  private centerY = 0;
  private visible = false;

  public onMove?: (forceX: number, forceY: number) => void;
  public onUp?: () => void;

  constructor(scene: Scene) {
    this.scene = scene;
    this.base = scene.add.graphics();
    this.base.setScrollFactor(0);
    this.base.setDepth(300);

    this.thumb = scene.add.graphics();
    this.thumb.setScrollFactor(0);
    this.thumb.setDepth(301);
    registerUi(scene, this.base, this.thumb);

    this.layout();
    this.setupInput();
    this.hide();
  }

  /** Repositions the control after a viewport resize. */
  public layout(): void {
    const { height } = this.scene.scale;
    this.centerX = 105;
    this.centerY = height - 110;
    this.drawBase();
    this.drawThumb(this.centerX, this.centerY);
  }

  private drawBase(): void {
    this.base.clear();
    this.base.fillStyle(0x1a120b, 0.35);
    this.base.fillCircle(this.centerX, this.centerY, this.baseRadius);
    this.base.lineStyle(2, 0xd9c27a, 0.45);
    this.base.strokeCircle(this.centerX, this.centerY, this.baseRadius);
    this.base.lineStyle(1, 0xd9c27a, 0.22);
    this.base.strokeCircle(this.centerX, this.centerY, this.baseRadius * 0.55);
  }

  private drawThumb(x: number, y: number): void {
    this.thumb.clear();
    this.thumb.fillStyle(0xe8dcc0, 0.55);
    this.thumb.fillCircle(x, y, this.thumbRadius);
    this.thumb.lineStyle(2, 0xf3e3c0, 0.7);
    this.thumb.strokeCircle(x, y, this.thumbRadius);
  }

  private setupInput(): void {
    this.scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (!this.visible || this.isActive) return;
      const dist = Math.sqrt(
        Math.pow(pointer.x - this.centerX, 2) + Math.pow(pointer.y - this.centerY, 2),
      );
      const inActivationZone =
        dist <= this.baseRadius * 1.5 &&
        pointer.x < this.scene.scale.width * 0.5 &&
        pointer.y > this.scene.scale.height * 0.35;

      if (inActivationZone) {
        this.isActive = true;
        this.pointerId = pointer.id;
        this.updateThumb(pointer.x, pointer.y);
      }
    });

    this.scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.isActive && pointer.id === this.pointerId) {
        this.updateThumb(pointer.x, pointer.y);
      }
    });

    const release = (pointer: Phaser.Input.Pointer): void => {
      if (!this.isActive || pointer.id !== this.pointerId) return;
      this.isActive = false;
      this.pointerId = -1;
      this.drawThumb(this.centerX, this.centerY);
      if (this.onUp) this.onUp();
    };

    this.scene.input.on('pointerup', release);
    this.scene.input.on('pointerupoutside', release);
  }

  private updateThumb(pointerX: number, pointerY: number): void {
    let dx = pointerX - this.centerX;
    let dy = pointerY - this.centerY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const maxOffset = this.baseRadius - this.thumbRadius;

    if (dist > maxOffset) {
      const angle = Math.atan2(dy, dx);
      dx = Math.cos(angle) * maxOffset;
      dy = Math.sin(angle) * maxOffset;
    }

    this.drawThumb(this.centerX + dx, this.centerY + dy);

    let forceX = dx / maxOffset;
    let forceY = dy / maxOffset;

    // Dead zone so resting a thumb does not drift the character.
    if (Math.abs(forceX) < 0.15) forceX = 0;
    if (Math.abs(forceY) < 0.15) forceY = 0;

    if (this.onMove) this.onMove(forceX, forceY);
  }

  public show(): void {
    this.visible = true;
    this.base.setVisible(true);
    this.thumb.setVisible(true);
    this.layout();
  }

  public hide(): void {
    this.visible = false;
    this.base.setVisible(false);
    this.thumb.setVisible(false);
    this.isActive = false;
    this.pointerId = -1;
    if (this.onUp) this.onUp();
  }

  public get isVisible(): boolean {
    return this.visible;
  }

  public isTouchDevice(): boolean {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }

  public destroy(): void {
    this.base.destroy();
    this.thumb.destroy();
  }
}

/** Large on-screen action button for touch layouts. */
export class InteractionButton {
  private scene: Scene;
  private button: Phaser.GameObjects.Container;
  private label: Phaser.GameObjects.Text;
  private onPress?: () => void;

  constructor(scene: Scene) {
    this.scene = scene;

    this.button = scene.add.container(0, 0);
    const bg = scene.add.graphics();
    bg.fillStyle(0x1a120b, 0.55);
    bg.fillCircle(0, 0, 42);
    bg.lineStyle(2, 0xd9c27a, 0.8);
    bg.strokeCircle(0, 0, 42);

    this.label = scene.add.text(0, 0, 'E', {
      fontFamily: 'Arial',
      fontSize: '22px',
      color: '#f3e3c0',
      fontStyle: 'bold',
    });
    this.label.setOrigin(0.5, 0.5);

    this.button.add([bg, this.label]);
    this.button.setScrollFactor(0);
    registerUi(scene, this.button);
    this.button.setDepth(300);
    this.button.setSize(84, 84);
    this.button.setInteractive({ useHandCursor: true });
    this.button.on('pointerdown', () => {
      if (this.onPress) this.onPress();
    });

    this.layout();
    this.hide();
  }

  public layout(): void {
    const { width, height } = this.scene.scale;
    this.button.setPosition(width - 90, height - 105);
  }

  public show(): void {
    this.button.setVisible(true);
  }

  public hide(): void {
    this.button.setVisible(false);
  }

  public get isVisible(): boolean {
    return this.button.visible;
  }

  public setCallback(callback: () => void): void {
    this.onPress = callback;
  }

  public destroy(): void {
    this.button.destroy();
  }
}
