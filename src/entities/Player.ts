import { Scene } from 'phaser';
import { IsometricUtils } from '@utils/IsometricUtils';
import { InputManager } from '@systems/InputManager';
import { ISOMETRIC_CONFIG, PLAYER_CONFIG } from '@core/GameConfig';
import type { CharacterDirection } from '../art/CharacterArt';
import { generateCustomizedCharacterArt } from '../art/CharacterArt';
import type { CharacterVisuals } from '@data/CharacterCustomization';
import { resolveEquipmentAppearance } from '@data/CharacterCustomization';
import { worldDepth } from '@utils/Depth';
import { registerWorld, UI_CAMERA_NAME } from '@utils/CameraLayers';
import { CombatSystem, CombatantStats } from '@systems/CombatSystem';
import { EquipmentSystem, type Equipment } from '@systems/EquipmentSystem';

export type PlayerState = 'idle' | 'walking' | 'attacking' | 'dead';

const FRAME_H = 176;
const FEET_Y = 158;
const CHARACTER_SCALE = 0.62;

/**
 * The frontier warrior. Movement is expressed in world grid units and is
 * converted to screen space only for rendering, so the simulation never
 * depends on camera zoom or viewport size.
 *
 * Rendering uses hand-painted directional frames (front/back/side) with an
 * idle pose and a six-frame walk cycle.
 */
export class Player extends Phaser.GameObjects.Container {
  private sprite: Phaser.GameObjects.Image;
  private selectionIndicator: Phaser.GameObjects.Image;
  private gridX: number;
  private gridY: number;
  private inputManager: InputManager;
  private mapWidth: number;
  private mapHeight: number;
  private collisionChecker: ((gridX: number, gridY: number) => boolean) | null = null;
  private interactionRange = 1.5;
  private movementState: PlayerState = 'idle';
  private weatherSpeedMultiplier = 1;
  private walkClock = 0;
  private footstepClock = 0;
  private onFootstep?: (surface: 'earth'|'grass'|'wood') => void;
  private direction: CharacterDirection = 'front';
  private flip = false;
  private frame = 0;
  private appearance: string | undefined;
  private gender: 'male' | 'female';
  private visuals: CharacterVisuals | undefined;
  private customPrefix: string | undefined;
  
  // Combat
  private combatSystem: CombatSystem;
  private equipmentSystem: EquipmentSystem;
  private combatStats: CombatantStats;
  private lastAttackTime = 0;
  private onAttackCallback?: (target: any) => void;
  private onDamageCallback?: (damage: number) => void;

  constructor(scene: Scene, gridX: number, gridY: number, inputManager: InputManager, startingEquipment?: Partial<Equipment>, appearance?: string, gender: 'male'|'female'='male', visuals?: CharacterVisuals) {
    super(scene, 0, 0);
    this.gridX = gridX;
    this.gridY = gridY;
    this.inputManager = inputManager;
    this.appearance = appearance && ['Çiftçi', 'Akıncı', 'Kervancı'].includes(appearance) ? appearance : undefined;
    this.gender = gender;
    this.visuals = visuals;
    this.mapWidth = 32;
    this.mapHeight = 32;
    
    this.combatSystem = new CombatSystem();
    this.equipmentSystem = new EquipmentSystem(undefined, startingEquipment);
    this.combatStats = this.combatSystem.createPlayerCombatant(
      this.equipmentSystem.getEquipment().weapon,
      this.equipmentSystem.getEquipment().armor,
    );
    this.refreshCustomArt();

    this.selectionIndicator = scene.add.image(0, -2, 'player_ring');
    this.selectionIndicator.setOrigin(0.5, 0.5);
    this.selectionIndicator.setAlpha(0.85);
    this.add(this.selectionIndicator);

    this.sprite = scene.add.image(0, 0, this.textureKey('front', 'idle'));
    this.sprite.setOrigin(0.5, FEET_Y / FRAME_H);
    this.sprite.setScale(CHARACTER_SCALE);
    this.sprite.setVisible(true);
    this.add(this.sprite);
    this.bringToTop(this.sprite);

    scene.add.existing(this);
    registerWorld(scene, this);
    // Ensure player is only drawn by main camera
    const uiCam = scene.cameras.getCamera('ui-camera') || scene.cameras.getCamera(UI_CAMERA_NAME);
    if (uiCam) {
      uiCam.ignore([this, this.sprite, this.selectionIndicator]);
    }
    scene.cameras.main.ignore([]);
    this.updateScreenPosition();
    this.setDepth(worldDepth(this.gridX, this.gridY, 10));
    this.setVisible(true);
    this.sprite.setVisible(true);
    this.sprite.setDepth(10);
    this.setAlpha(1);
  }

  public setMapBounds(width: number, height: number): void {
    this.mapWidth = width;
    this.mapHeight = height;
  }

  public setCollisionChecker(checker: (gridX: number, gridY: number) => boolean): void {
    this.collisionChecker = checker;
  }

  public setFootstepCallback(callback:(surface:'earth'|'grass'|'wood')=>void):void{this.onFootstep=callback;}

  public update(_time: number, delta: number): void {
    if (!this.combatStats.alive) {
      this.movementState = 'dead';
      return;
    }

    // Regenerate stamina
    this.combatSystem.regenerateStamina(this.combatStats, delta / 1000);

    const move = this.inputManager.getMoveVector();
    const dt = Math.min(delta, 50) / 1000;

    if (Math.abs(move.x) < 0.001 && Math.abs(move.y) < 0.001) {
      this.movementState = 'idle';
      this.walkClock = 0;
      this.footstepClock = 0;
      this.facingFromScreenVector(0, 0);
      this.applyTexture();
    } else {
      this.movementState = 'walking';
      this.walkClock += delta;
      this.footstepClock += delta;
      if(this.footstepClock>=430){this.footstepClock%=430;this.onFootstep?.('earth');}
      this.facingFromScreenVector(move.x, move.y);

      // Convert desired screen velocity into grid velocity so movement feels
      // identical regardless of isometric projection.
      const gridVelocity = IsometricUtils.screenVectorToGridVector(
        move.x * this.getSpeed(),
        move.y * this.getSpeed(),
      );

      this.moveBy(gridVelocity.x * dt, gridVelocity.y * dt);
      this.applyTexture();
    }

    this.updateScreenPosition();
    this.setDepth(worldDepth(this.gridX, this.gridY, 0.05));
  }

  /**
   * Chooses the painted direction. Screen Y grows downward, so positive Y is
   * "towards the viewer" (front) and negative Y is "away" (back).
   */
  private facingFromScreenVector(x: number, y: number): void {
    if (Math.abs(x) < 0.001 && Math.abs(y) < 0.001) {
      if (this.direction === 'side') this.direction = 'front';
      return;
    }

    if (Math.abs(x) > Math.abs(y) * 1.15) {
      this.direction = 'side';
      this.flip = x < 0;
      return;
    }

    if (y > 0) {
      this.direction = 'front';
      this.flip = false;
    } else {
      this.direction = 'back';
      this.flip = false;
    }
  }

  private applyTexture(): void {
    const prefix = this.texturePrefix();
    if (this.movementState === 'walking') {
      const frame = Math.floor(this.walkClock / 110) % 6;
      if (frame !== this.frame) {
        this.frame = frame;
        this.setTextureWithFallback(`${prefix}${this.direction}_walk_${frame}`, `${prefix}${this.direction}_idle`);
      } else if (!this.sprite.texture.key.startsWith(`${prefix}${this.direction}_walk_`)) {
        this.setTextureWithFallback(`${prefix}${this.direction}_walk_${frame}`, `${prefix}${this.direction}_idle`);
      }
    } else if (this.sprite.texture.key !== this.textureKey(this.direction, 'idle')) {
      this.setTextureWithFallback(this.textureKey(this.direction, 'idle'), `player_${this.direction}_idle`);
    }

    this.sprite.setFlipX(this.direction === 'side' && this.flip);
  }

  /** Missing optional art resolves to a generated base pose instead of a blank sprite. */
  private setTextureWithFallback(preferred: string, fallback: string): void {
    const genderFallback=`player_${this.gender==='female'?'female_':''}${this.direction}_idle`;
    const key = this.scene.textures.exists(preferred)
      ? preferred
      : this.scene.textures.exists(fallback)
        ? fallback
        : this.scene.textures.exists(genderFallback)
          ? genderFallback
          : this.scene.textures.exists(`player_${this.direction}_idle`)
            ? `player_${this.direction}_idle`
            : this.sprite.texture.key;
    if (this.sprite.texture.key !== key) this.sprite.setTexture(key);
  }

  private textureKey(direction: CharacterDirection, pose: string): string {
    if (this.customPrefix) return `${this.customPrefix}${direction}_${pose}`;
    return `${this.texturePrefix()}${direction}_${pose}`;
  }

  private texturePrefix():string {
    return `player_${this.gender==='female'?'female_':''}${this.appearance?`${this.appearance}_`:''}`;
  }

  public setAppearance(appearance?: string): void {
    this.appearance = appearance && ['Çiftçi', 'Akıncı', 'Kervancı'].includes(appearance) ? appearance : undefined;
    this.refreshCustomArt();
    const preferred = this.textureKey(this.direction, this.movementState === 'walking' ? `walk_${this.frame}` : 'idle');
    this.setTextureWithFallback(preferred, this.textureKey(this.direction, 'idle'));
  }

  public setVisuals(visuals?: CharacterVisuals): void { if(JSON.stringify(this.visuals)===JSON.stringify(visuals))return;this.visuals = visuals; this.refreshCustomArt(); this.setTextureWithFallback(this.textureKey(this.direction,this.movementState==='walking'?`walk_${this.frame}`:'idle'),this.textureKey(this.direction,'idle')); }
  public refreshAppearanceArt(): void { this.refreshCustomArt(); this.setTextureWithFallback(this.textureKey(this.direction,this.movementState==='walking'?`walk_${this.frame}`:'idle'),this.textureKey(this.direction,'idle')); }
  private refreshCustomArt(): void {
    const equipment=this.equipmentSystem?.getEquipment();
    const artEquipment=resolveEquipmentAppearance(equipment?.armor??'none',equipment?.weapon??'melee_dagger');
    this.customPrefix = this.visuals ? generateCustomizedCharacterArt(this.scene,`playable_${this.gender}_${this.appearance??'base'}`,this.appearance??'',this.gender,this.visuals,artEquipment.armor,artEquipment.weapon) : undefined;
  }

  public setGender(gender:'male'|'female'):void {
    this.gender=gender;
    this.refreshCustomArt();
    const preferred=this.textureKey(this.direction,this.movementState==='walking'?`walk_${this.frame}`:'idle');
    this.setTextureWithFallback(preferred,`player_${this.direction}_idle`);
  }

  /** Moves in grid units, sub-stepping to avoid tunnelling through obstacles. */
  private moveBy(dx: number, dy: number): void {
    const distance = Math.max(Math.abs(dx), Math.abs(dy));
    const steps = Math.max(1, Math.ceil(distance / 0.1));
    const stepX = dx / steps;
    const stepY = dy / steps;

    for (let i = 0; i < steps; i++) {
      this.tryStep(stepX, stepY);
    }
  }

  private tryStep(dx: number, dy: number): void {
    const targetX = this.gridX + dx;
    const targetY = this.gridY + dy;

    if (this.canStandAt(targetX, targetY)) {
      this.gridX = targetX;
      this.gridY = targetY;
      return;
    }

    // Slide along a single axis when the diagonal target is blocked.
    if (this.canStandAt(targetX, this.gridY)) {
      this.gridX = targetX;
      return;
    }
    if (this.canStandAt(this.gridX, targetY)) {
      this.gridY = targetY;
    }
  }

  private canStandAt(gridX: number, gridY: number): boolean {
    if (!IsometricUtils.isInBounds(gridX, gridY, this.mapWidth, this.mapHeight)) {
      return false;
    }
    return !(this.collisionChecker && this.collisionChecker(gridX, gridY));
  }

  private updateScreenPosition(): void {
    const screenPos = IsometricUtils.gridToScreen(this.gridX, this.gridY);
    this.x = screenPos.x;
    // Feet stand on the centre of the tile, not its top corner.
    this.y = screenPos.y + ISOMETRIC_CONFIG.tileHeight / 2;
  }

  public getGridPosition(): { x: number; y: number } {
    return { x: this.gridX, y: this.gridY };
  }

  public setGridPosition(gridX: number, gridY: number): void {
    if (!IsometricUtils.isInBounds(gridX, gridY, this.mapWidth, this.mapHeight)) return;
    if (this.collisionChecker && this.collisionChecker(gridX, gridY)) return;
    this.gridX = gridX;
    this.gridY = gridY;
    this.updateScreenPosition();
    this.setDepth(worldDepth(this.gridX, this.gridY, 0.05));
  }

  public getSpeed(): number {
    return PLAYER_CONFIG.speed * this.weatherSpeedMultiplier;
  }

  public setWeatherMovement(weather: 'clear'|'cloudy'|'rain'|'fog'|'wind'|'snow'): void {
    this.weatherSpeedMultiplier = weather === 'snow' ? 0.78 : weather === 'rain' ? 0.9 : weather === 'wind' ? 0.94 : 1;
  }

  public getInteractionRange(): number {
    return this.interactionRange;
  }

  public getState(): PlayerState {
    return this.movementState;
  }

  public showSelectionIndicator(show: boolean): void {
    this.selectionIndicator.setVisible(show);
  }

  // Combat methods
  public attack(target: any): boolean {
    if (!this.combatStats.alive) return false;
    
    const now = Date.now();
    const result = this.combatSystem.performAttack(
      this.combatStats,
      target.getCombatStats(),
      this.equipmentSystem.getEquipment().weapon,
      now,
      this.lastAttackTime,
    );

    if (result.staminaConsumed) {
      this.lastAttackTime = result.newLastAttackTime;
    }

    if (result.result.hit && this.onAttackCallback) {
      this.onAttackCallback(target);
    }

    if (result.result.hit && this.onDamageCallback) {
      this.onDamageCallback(result.result.damage);
    }

    return result.result.hit;
  }

  public getCombatStats(): CombatantStats {
    return this.combatStats;
  }

  public takeDamage(damage: number): boolean {
    const result = this.combatSystem.applyDamage(this.combatStats, damage);
    if (this.onDamageCallback) {
      this.onDamageCallback(damage);
    }
    return result.killed;
  }

  public recoverFromInjury(amount: number): number {
    return this.combatSystem.recoverHealth(this.combatStats, amount);
  }

  public restoreCondition(health: number, stamina: number): void {
    this.combatStats.health=Math.max(0,Math.min(this.combatStats.maxHealth,health));
    this.combatStats.stamina=Math.max(0,Math.min(this.combatStats.maxStamina,stamina));
    this.combatStats.alive=this.combatStats.health>0;
  }

  public getEquipmentSystem(): EquipmentSystem {
    return this.equipmentSystem;
  }

  public setAttackCallback(callback: (target: any) => void): void {
    this.onAttackCallback = callback;
  }

  public setDamageCallback(callback: (damage: number) => void): void {
    this.onDamageCallback = callback;
  }

  public isAlive(): boolean {
    return this.combatStats.alive;
  }

  public getHealthPercent(): number {
    return this.combatStats.health / this.combatStats.maxHealth;
  }

  public getStaminaPercent(): number {
    return this.combatStats.stamina / this.combatStats.maxStamina;
  }
}
