import { Scene } from 'phaser';
import { IsometricUtils } from '@utils/IsometricUtils';
import { WorldMap, WorldObject, ObjectType } from '@data/WorldData';
import { ISOMETRIC_CONFIG } from '@core/GameConfig';
import { makeRng, range } from '../art/ArtUtils';
import { worldDepth } from '@utils/Depth';
import { registerWorld } from '@utils/CameraLayers';
import { isInsideHouseFootprint } from '@utils/CollisionGeometry';
import { localLightIntensity } from '@data/AtmosphereData';

export interface Interactable {
  id: string;
  getInteractionText(): string;
  interact(player: unknown): void;
  getGridPosition(): { x: number; y: number };
  getInteractionRange(): number;
}

interface PropVisual {
  key: string;
  /** Vertical normalised anchor that should sit on the tile centre. */
  anchorY: number;
  scale: number;
  /** Footprint of the contact shadow, in world pixels. */
  shadowWidth: number;
  shadowHeight: number;
  shadowAlpha: number;
}

const VISUALS: Record<ObjectType, PropVisual> = {
  [ObjectType.NONE]: {
    key: 'prop_crate',
    anchorY: 37 / 40,
    scale: 1,
    shadowWidth: 60,
    shadowHeight: 24,
    shadowAlpha: 0.4,
  },
  [ObjectType.HOUSE]: {
    key: 'prop_house_0',
    anchorY: 230 / 260,
    scale: 0.88,
    shadowWidth: 200,
    shadowHeight: 70,
    shadowAlpha: 0.48,
  },
  [ObjectType.TREE]: {
    key: 'prop_tree_0',
    anchorY: 282 / 300,
    scale: 0.94,
    shadowWidth: 190,
    shadowHeight: 62,
    shadowAlpha: 0.44,
  },
  [ObjectType.ROCK]: {
    key: 'prop_rock_0',
    anchorY: 98 / 110,
    scale: 0.92,
    shadowWidth: 112,
    shadowHeight: 42,
    shadowAlpha: 0.42,
  },
  [ObjectType.MARKET_STALL]: {
    key: 'prop_market_0',
    anchorY: 166 / 190,
    scale: 0.9,
    shadowWidth: 208,
    shadowHeight: 70,
    shadowAlpha: 0.48,
  },
  [ObjectType.WELL]: {
    key: 'prop_well',
    anchorY: 160 / 180,
    scale: 0.88,
    shadowWidth: 130,
    shadowHeight: 48,
    shadowAlpha: 0.46,
  },
  [ObjectType.FENCE]: {
    key: 'prop_fence',
    anchorY: 73 / 78,
    scale: 1,
    shadowWidth: 120,
    shadowHeight: 26,
    shadowAlpha: 0.32,
  },
  [ObjectType.WORKSHOP]: {
    key: 'prop_workshop', anchorY: 220 / 250, scale: 0.92,
    shadowWidth: 174, shadowHeight: 58, shadowAlpha: 0.5,
  },
  [ObjectType.GRANARY]: {
    key: 'prop_granary', anchorY: 242 / 260, scale: 0.92,
    shadowWidth: 164, shadowHeight: 56, shadowAlpha: 0.46,
  },
  [ObjectType.ZAVIYE]: {
    key: 'prop_zaviye', anchorY: 218 / 250, scale: 0.84,
    shadowWidth: 164, shadowHeight: 58, shadowAlpha: 0.46,
  },
};

const SMALL_PROPS: Record<string, { key: string; anchorY: number }> = {
  barrel: { key: 'prop_barrel', anchorY: 46 / 48 },
  crate: { key: 'prop_crate', anchorY: 37 / 40 },
  sack: { key: 'prop_sack', anchorY: 54 / 60 },
  pot: { key: 'prop_pot', anchorY: 40 / 44 },
  hay: { key: 'prop_hay', anchorY: 60 / 70 },
  sign: { key: 'prop_sign', anchorY: 92 / 96 },
};

export class WorldObjectSprite extends Phaser.GameObjects.Container implements Interactable {
  private objectData: WorldObject;
  public id: string;
  private mainImage: Phaser.GameObjects.Image;
  private ambientEffects:Phaser.GameObjects.Image[]=[];
  private ambientTweens:Phaser.Tweens.Tween[]=[];
  private localGlow:Phaser.GameObjects.Image|null=null;
  private ambientEffectsEnabled=true;
  private localLightAlpha=0;

  constructor(scene: Scene, objectData: WorldObject) {
    super(scene, 0, 0);
    this.objectData = objectData;
    this.id = objectData.id;

    const hash = WorldObjectSprite.hashId(objectData.id);
    const visual = VISUALS[objectData.type];
    const variantCount = objectData.type === ObjectType.HOUSE
      || objectData.type === ObjectType.ROCK
      || objectData.type === ObjectType.MARKET_STALL ? 2
      : objectData.type === ObjectType.TREE ? 3 : 1;
    const variant = hash % variantCount;
    const key = WorldObjectSprite.resolveKey(visual.key, variant);

    const anchorY = visual.anchorY;

    // Contact shadow, scaled to the footprint of the prop.
    const shadow = scene.add.image(0, 0, 'prop_shadow');
    shadow.setOrigin(0.5, 0.5);
    shadow.setDisplaySize(visual.shadowWidth, visual.shadowHeight);
    shadow.setAlpha(visual.shadowAlpha);
    this.add(shadow);

    if (objectData.type === ObjectType.HOUSE || objectData.type === ObjectType.WORKSHOP || objectData.type === ObjectType.ZAVIYE) {
      const workshop = objectData.type === ObjectType.WORKSHOP;
      const zaviye = objectData.type === ObjectType.ZAVIYE;
      this.addSmoke(scene, visual.scale, workshop ? 52 : zaviye ? 48 : 34, workshop ? -162 : zaviye ? -148 : -196);
    }

    this.mainImage = scene.add.image(0, 0, key);
    this.mainImage.setOrigin(0.5, anchorY);
    this.mainImage.setScale(visual.scale);
    this.add(this.mainImage);

    if([ObjectType.HOUSE,ObjectType.WORKSHOP,ObjectType.ZAVIYE,ObjectType.MARKET_STALL].includes(objectData.type)){
      this.localGlow=scene.add.image(objectData.type===ObjectType.MARKET_STALL?48:-22,objectData.type===ObjectType.MARKET_STALL?-52:-68,'fx_torch_glow');
      this.localGlow.setScale(objectData.type===ObjectType.MARKET_STALL?0.72:0.58).setAlpha(0);
      this.add(this.localGlow);this.ambientEffects.push(this.localGlow);
    }
    if(objectData.type===ObjectType.TREE){
      this.ambientTweens.push(scene.tweens.add({targets:this.mainImage,angle:{from:-0.65,to:0.65},duration:2600+hash%900,yoyo:true,repeat:-1,ease:'Sine.easeInOut',delay:hash%700}));
    }

    this.decorate(scene, objectData.type, hash, visual.scale);

    scene.add.existing(this);
    registerWorld(scene, this);
    this.updateScreenPosition();

    // Depth sorting follows grid rows; the small offset keeps props stable.
    this.setDepth(worldDepth(this.objectData.gridX, this.objectData.gridY));
  }

  private static hashId(id: string): number {
    let hash = 2166136261;
    for (let i = 0; i < id.length; i++) {
      hash ^= id.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  private static resolveKey(base: string, variant: number): string {
    if (base === 'prop_house_0') return `prop_house_${variant}`;
    if (base === 'prop_tree_0') return `prop_tree_${variant}`;
    if (base === 'prop_rock_0') return `prop_rock_${variant}`;
    if (base === 'prop_market_0') return `prop_market_${variant}`;
    return base;
  }

  private addSmoke(scene: Scene, scale: number, chimneyX = 34, chimneyY = -196): void {
    // The chimney is at (34, -196) inside the 260x280 house texture.
    for (let i = 0; i < 3; i++) {
      const puff = scene.add.image(chimneyX * scale, chimneyY * scale, 'prop_smoke');
      this.ambientEffects.push(puff);
      puff.setOrigin(0.5, 0.5);
      puff.setScale(range(makeRng(i + 7), 0.32, 0.5));
      puff.setAlpha(0.24);
      this.add(puff);

      this.ambientTweens.push(scene.tweens.add({
        targets: puff,
        y: { from: chimneyY * scale, to: (chimneyY - 74) * scale },
        x: { from: chimneyX * scale, to: (chimneyX + 28) * scale },
        alpha: { from: 0.24, to: 0 },
        scale: { from: 0.3, to: 0.95 },
        duration: 5600,
        delay: i * 1800,
        repeat: -1,
        ease: 'Sine.easeOut',
        onRepeat: () => {
          puff.setAlpha(0.24);
        },
      }));
    }
  }

  private decorate(scene: Scene, type: ObjectType, hash: number, scale: number): void {
    const rng = makeRng(hash);
    const add = (name: keyof typeof SMALL_PROPS, x: number, y: number, scaleMultiplier = 1): void => {
      const spec = SMALL_PROPS[name];
      if (!spec) return;
      const image = scene.add.image(x, y, spec.key);
      image.setOrigin(0.5, spec.anchorY);
      image.setScale(scaleMultiplier);
      this.add(image);
    };

    if (type === ObjectType.HOUSE) {
      add('pot', -70 * scale, 4, 0.9);
      add('pot', -54 * scale, 2, 0.72);
      add('sack', 54 * scale, 2, 0.8);
      if (rng() > 0.45) add('hay', 74 * scale, 0, 0.85);
    }

    if (type === ObjectType.WORKSHOP) {
      add('barrel', -62 * scale, 4, 0.78);
      add('crate', 65 * scale, 2, 0.76);
    }

    if (type === ObjectType.GRANARY) {
      add('sack', -54 * scale, 5, 0.78);
      add('hay', 62 * scale, 2, 0.72);
    }

    if (type === ObjectType.ZAVIYE) {
      add('pot', -64 * scale, 4, 0.8);
      add('sack', 62 * scale, 3, 0.72);
    }

    if (type === ObjectType.MARKET_STALL) {
      add('crate', -58 * scale, 2, 0.85);
      add('barrel', 54 * scale, 3, 0.85);
      add('sack', 28 * scale, 2, 0.8);
      add('sack', 38 * scale, 0, 0.72);
    }

    if (type === ObjectType.WELL) {
      add('pot', -38, 3, 0.8);
      add('barrel', 36, 2, 0.75);
    }

    if (type === ObjectType.TREE) {
      if (rng() > 0.45) add('pot', range(rng, -20, 20), 2, 0.6);
    }
  }

  private updateScreenPosition(): void {
    const screenPos = IsometricUtils.gridToScreen(this.objectData.gridX, this.objectData.gridY);
    this.x = screenPos.x;
    this.y = screenPos.y + ISOMETRIC_CONFIG.tileHeight / 2;
  }

  public getInteractionText(): string {
    return this.objectData.interactionText || 'Interact';
  }

  public interact(_player: unknown): void {
    console.log(`Interacting with ${this.objectData.id}: ${this.objectData.interactionText}`);
  }

  public getGridPosition(): { x: number; y: number } {
    return { x: this.objectData.gridX, y: this.objectData.gridY };
  }

  public getInteractionRange(): number {
    return 1.5;
  }

  public isCollidable(): boolean {
    return this.objectData.collision;
  }

  public getObjectData(): WorldObject {
    return this.objectData;
  }

  public setAmbientEffectsEnabled(enabled:boolean):void{
    this.ambientEffectsEnabled=enabled;
    for(const image of this.ambientEffects)image.setVisible(enabled);
    for(const tween of this.ambientTweens){if(enabled)tween.resume();else tween.pause();}
    if(!enabled)this.mainImage.setAngle(0);
    this.refreshLocalGlow();
  }

  public setLightingHour(hour:number):void{this.localLightAlpha=localLightIntensity(hour);this.refreshLocalGlow();}
  private refreshLocalGlow():void{if(!this.localGlow)return;this.localGlow.setVisible(this.ambientEffectsEnabled&&this.localLightAlpha>0);this.localGlow.setAlpha(this.ambientEffectsEnabled?this.localLightAlpha:0);}

  public getDisplayImage(): Phaser.GameObjects.Image {
    return this.mainImage;
  }
}

export class WorldObjectManager {
  private scene: Scene;
  private worldMap: WorldMap;
  private objects: WorldObjectSprite[] = [];
  private lightingBucket=-1;

  constructor(scene: Scene, worldMap: WorldMap) {
    this.scene = scene;
    this.worldMap = worldMap;
  }

  public createObjects(): void {
    for (const objData of this.worldMap.objects) {
      const obj = new WorldObjectSprite(this.scene, objData);
      this.objects.push(obj);
    }
  }

  public setAmbientEffectsEnabled(enabled:boolean):void{for(const object of this.objects)object.setAmbientEffectsEnabled(enabled);}
  public setLightingHour(hour:number):void{const bucket=Math.floor(hour*2);if(bucket===this.lightingBucket)return;this.lightingBucket=bucket;for(const object of this.objects)object.setLightingHour(hour);}

  public getCollidableObjects(): WorldObjectSprite[] {
    return this.objects.filter(obj => obj.isCollidable());
  }

  public getInteractableObjects(): WorldObjectSprite[] {
    return this.objects.filter(obj => obj.getObjectData().interactable);
  }

  public checkCollision(gridX: number, gridY: number): boolean {
    for (const obj of this.objects) {
      if (obj.isCollidable()) {
        const pos = obj.getGridPosition();
        const objectType = obj.getObjectData().type;
        if (objectType === ObjectType.HOUSE || objectType === ObjectType.WORKSHOP || objectType === ObjectType.GRANARY || objectType === ObjectType.ZAVIYE) {
          const dx = gridX - pos.x;
          const dy = gridY - pos.y;
          const localScreenX = (dx - dy) * (ISOMETRIC_CONFIG.tileWidth / 2);
          const localScreenY = (dx + dy) * (ISOMETRIC_CONFIG.tileHeight / 2);
          if (isInsideHouseFootprint(localScreenX, localScreenY)) return true;
        }
        if (Math.floor(pos.x) === Math.floor(gridX) && Math.floor(pos.y) === Math.floor(gridY)) {
          return true;
        }
      }
    }
    return false;
  }

  public findNearbyInteractable(gridX: number, gridY: number): WorldObjectSprite | null {
    let closest: WorldObjectSprite | null = null;
    let closestDist = Infinity;

    for (const obj of this.objects) {
      if (obj.getObjectData().interactable) {
        const pos = obj.getGridPosition();
        const dist = Math.sqrt(Math.pow(pos.x - gridX, 2) + Math.pow(pos.y - gridY, 2));
        if (dist <= obj.getInteractionRange() && dist < closestDist) {
          closestDist = dist;
          closest = obj;
        }
      }
    }

    return closest;
  }

  public destroy(): void {
    for (const obj of this.objects) {
      obj.destroy();
    }
    this.objects = [];
  }
}
