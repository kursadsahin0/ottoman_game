import { Scene } from 'phaser';
import { IsometricUtils } from '@utils/IsometricUtils';
import { WorldMap, TileType } from '@data/WorldData';
import { ISOMETRIC_CONFIG } from '@core/GameConfig';
import { makeRng, randomPointInDiamond, range } from '../art/ArtUtils';
import { DEPTH } from '@utils/Depth';
import { registerWorld } from '@utils/CameraLayers';

const CHUNK_TILES = 8;
const PAD_X = 64;
const PAD_TOP = 52;
const PAD_BOTTOM = 24;

interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Bakes the whole ground into a handful of chunk canvases: one texture upload
 * per chunk, one draw call per chunk, and no per-tile sprite overhead. Grass
 * tufts, flowers, pebbles and reeds are baked in at the same time, while water
 * glints stay as a few animated sprites so the pond never looks frozen.
 */
export class TileMap {
  private scene: Scene;
  private worldMap: WorldMap;
  private ground: Phaser.GameObjects.Image[] = [];
  private glints: Phaser.GameObjects.Image[] = [];

  constructor(scene: Scene, worldMap: WorldMap) {
    this.scene = scene;
    this.worldMap = worldMap;
  }

  public render(): void {
    this.clear();

    const chunksX = Math.ceil(this.worldMap.width / CHUNK_TILES);
    const chunksY = Math.ceil(this.worldMap.height / CHUNK_TILES);

    for (let chunkY = 0; chunkY < chunksY; chunkY++) {
      for (let chunkX = 0; chunkX < chunksX; chunkX++) {
        this.renderChunk(chunkX, chunkY);
      }
    }

    this.createWaterGlints();
  }

  private renderChunk(chunkX: number, chunkY: number): void {
    const x0 = chunkX * CHUNK_TILES;
    const y0 = chunkY * CHUNK_TILES;
    const x1 = Math.min(this.worldMap.width - 1, x0 + CHUNK_TILES - 1);
    const y1 = Math.min(this.worldMap.height - 1, y0 + CHUNK_TILES - 1);

    const bounds = this.chunkBounds(x0, y0, x1, y1);
    const key = `ground_chunk_${chunkX}_${chunkY}`;
    if (this.scene.textures.exists(key)) this.scene.textures.remove(key);

    const texture = this.scene.textures.createCanvas(key, bounds.width, bounds.height);
    if (!texture) return;
    const ctx = texture.getContext();

    ctx.clearRect(0, 0, bounds.width, bounds.height);

    // Terrain diamonds first.
    for (let gridY = y0; gridY <= y1; gridY++) {
      for (let gridX = x0; gridX <= x1; gridX++) {
        const tile = this.worldMap.tiles[gridY]?.[gridX];
        if (!tile) continue;

        const tileKey = this.tileTextureKey(tile.type, gridX, gridY);
        const source = this.getSourceImage(tileKey);
        const screen = IsometricUtils.gridToScreen(gridX, gridY);
        const dx = screen.x - bounds.left - ISOMETRIC_CONFIG.tileWidth / 2;
        const dy = screen.y - bounds.top;
        if (source) {
          ctx.drawImage(source, dx, dy);
        } else {
          // A missing optional tile variant becomes a seamless base-color
          // diamond instead of a transparent hole in the terrain chunk.
          const color = tile.type === TileType.WATER ? '#53685e'
            : tile.type === TileType.DIRT || tile.type === TileType.DIRT_ROAD || tile.type === TileType.FARM ? '#806a46'
              : '#746d42';
          ctx.beginPath();
          ctx.moveTo(dx + ISOMETRIC_CONFIG.tileWidth / 2, dy);
          ctx.lineTo(dx + ISOMETRIC_CONFIG.tileWidth, dy + ISOMETRIC_CONFIG.tileHeight / 2);
          ctx.lineTo(dx + ISOMETRIC_CONFIG.tileWidth / 2, dy + ISOMETRIC_CONFIG.tileHeight);
          ctx.lineTo(dx, dy + ISOMETRIC_CONFIG.tileHeight / 2);
          ctx.closePath();
          ctx.fillStyle = color;
          ctx.fill();
        }
      }
    }

    // Scatter is baked after all terrain so tufts overlap neighbouring tiles
    // naturally.
    for (let gridY = y0; gridY <= y1; gridY++) {
      for (let gridX = x0; gridX <= x1; gridX++) {
        const tile = this.worldMap.tiles[gridY]?.[gridX];
        if (!tile) continue;
        this.paintScatter(ctx, bounds, gridX, gridY, tile.type);
      }
    }

    texture.refresh();

    const image = this.scene.add.image(bounds.left, bounds.top, key);
    image.setOrigin(0, 0);
    image.setDepth(DEPTH.ground);
    registerWorld(this.scene, image);
    this.ground.push(image);
  }

  private paintScatter(
    ctx: CanvasRenderingContext2D,
    bounds: Rect,
    gridX: number,
    gridY: number,
    type: TileType,
  ): void {
    const rng = makeRng((gridX * 73856093) ^ (gridY * 19349663) ^ 0x9e3779b9);
    const screen = IsometricUtils.gridToScreen(gridX, gridY);
    const halfH = ISOMETRIC_CONFIG.tileHeight / 2;

    const localPoint = (inset: number): { x: number; y: number } =>
      randomPointInDiamond(
        rng,
        screen.x,
        screen.y,
        ISOMETRIC_CONFIG.tileWidth,
        ISOMETRIC_CONFIG.tileHeight,
        inset,
      );

    if (type === TileType.GRASS || type === TileType.FARM) {
      const tuftChance = type === TileType.FARM ? 0.15 : 0.42;
      if (rng() < tuftChance) {
        const point = localPoint(0.15);
        const source = this.getSourceImage(`decor_tuft_${Math.floor(rng() * 3)}`);
        if (source) {
          ctx.drawImage(
            source,
            point.x - bounds.left - source.width / 2,
            point.y - bounds.top - source.height + 4,
          );
        }
      }
      if (rng() < 0.13) {
        const point = localPoint(0.2);
        const source = this.getSourceImage(`decor_flower_${Math.floor(rng() * 2)}`);
        if (source) {
          ctx.drawImage(
            source,
            point.x - bounds.left - source.width / 2,
            point.y - bounds.top - source.height + 2,
          );
        }
      }
      if (rng() < 0.1) {
        const point = localPoint(0.22);
        const source = this.getSourceImage(`decor_pebble_${Math.floor(rng() * 2)}`);
        if (source) {
          ctx.drawImage(
            source,
            point.x - bounds.left - source.width / 2,
            point.y - bounds.top - source.height + 1,
          );
        }
      }
    }

    if (type === TileType.DIRT || type === TileType.DIRT_ROAD) {
      if (rng() < 0.1) {
        const point = localPoint(0.25);
        const source = this.getSourceImage(`decor_pebble_${Math.floor(rng() * 2)}`);
        if (source) {
          ctx.drawImage(
            source,
            point.x - bounds.left - source.width / 2,
            point.y - bounds.top - source.height + 1,
          );
        }
      }
      // Wind-blown grass at the very edge of the road.
      if (rng() < 0.08) {
        const point = localPoint(0.1);
        const source = this.getSourceImage(`decor_tuft_${Math.floor(rng() * 3)}`);
        if (source) {
          ctx.drawImage(
            source,
            point.x - bounds.left - source.width / 2,
            point.y - bounds.top - source.height + 4,
          );
        }
      }
    }

    if (type === TileType.WATER) {
      // Reeds only on the shore-facing neighbours, so the pond reads clearly.
      const isShore =
        !this.isSameTile(gridX + 1, gridY, TileType.WATER) ||
        !this.isSameTile(gridX - 1, gridY, TileType.WATER) ||
        !this.isSameTile(gridX, gridY + 1, TileType.WATER) ||
        !this.isSameTile(gridX, gridY - 1, TileType.WATER);
      if (isShore && rng() < 0.4) {
        const source = this.getSourceImage('decor_reeds');
        if (source) {
          const offsetX = range(rng, -30, 30);
          ctx.drawImage(
            source,
            screen.x - bounds.left - source.width / 2 + offsetX,
            screen.y - bounds.top + halfH - source.height + 16,
          );
        }
      }
    }
  }

  private isSameTile(gridX: number, gridY: number, type: TileType): boolean {
    return this.worldMap.tiles[gridY]?.[gridX]?.type === type;
  }

  private chunkBounds(x0: number, y0: number, x1: number, y1: number): Rect {
    const halfW = ISOMETRIC_CONFIG.tileWidth / 2;
    const halfH = ISOMETRIC_CONFIG.tileHeight / 2;
    const minX = (x0 - y1) * halfW;
    const maxX = (x1 - y0) * halfW;
    const minY = (x0 + y0) * halfH;
    const maxY = (x1 + y1) * halfH + ISOMETRIC_CONFIG.tileHeight;

    return {
      left: minX - PAD_X,
      top: minY - PAD_TOP,
      width: maxX - minX + PAD_X * 2 + ISOMETRIC_CONFIG.tileWidth,
      height: maxY - minY + PAD_TOP + PAD_BOTTOM,
    };
  }

  private tileTextureKey(type: TileType, gridX: number, gridY: number): string {
    // A spatial integer hash keeps neighboring repeats less visibly aligned
    // while remaining fully deterministic for identical world coordinates.
    let hash = (Math.imul(gridX + 1, 73856093) ^ Math.imul(gridY + 1, 19349663)) >>> 0;
    hash = Math.imul(hash ^ (hash >>> 13), 1274126177) >>> 0;
    switch (type) {
      case TileType.DIRT_ROAD:
        return `tile_road_${hash % 3}`;
      case TileType.DIRT:
        return `tile_dirt_${hash % 3}`;
      case TileType.WATER:
        return `tile_water_${hash % 3}`;
      case TileType.FARM:
        return `tile_dirt_${hash % 3}`;
      case TileType.GRASS:
      default:
        return `tile_grass_${hash % 16}`;
    }
  }

  private getSourceImage(key: string): HTMLCanvasElement | null {
    const texture = this.scene.textures.get(key);
    if (!texture || texture.key === '__MISSING') return null;
    return texture.getSourceImage() as HTMLCanvasElement;
  }

  private createWaterGlints(): void {
    const rng = makeRng(88117);
    for (let gridY = 0; gridY < this.worldMap.height; gridY++) {
      for (let gridX = 0; gridX < this.worldMap.width; gridX++) {
        if (!this.isSameTile(gridX, gridY, TileType.WATER)) continue;
        if (rng() > 0.45) continue;
        const glintKey = `water_glint_${Math.floor(rng() * 3)}`;
        if (!this.scene.textures.exists(glintKey)) continue;

        const screen = IsometricUtils.gridToScreen(gridX, gridY);
        const glint = this.scene.add.image(
          screen.x + range(rng, -26, 26),
          screen.y + ISOMETRIC_CONFIG.tileHeight / 2 + range(rng, -8, 8),
          glintKey,
        );
        glint.setDepth(DEPTH.glint);
        registerWorld(this.scene, glint);
        glint.setAlpha(0);
        glint.setScale(range(rng, 0.7, 1.3), 1);
        this.scene.tweens.add({
          targets: glint,
          alpha: { from: 0, to: range(rng, 0.4, 0.85) },
          scaleX: { from: glint.scaleX * 0.7, to: glint.scaleX * 1.25 },
          duration: range(rng, 1400, 2600),
          delay: range(rng, 0, 2200),
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
        this.glints.push(glint);
      }
    }
  }

  public isTileWalkable(gridX: number, gridY: number): boolean {
    if (!IsometricUtils.isInBounds(gridX, gridY, this.worldMap.width, this.worldMap.height)) {
      return false;
    }
    const tile = this.worldMap.tiles[Math.floor(gridY)]?.[Math.floor(gridX)];
    return tile ? tile.walkable : false;
  }

  public clear(): void {
    for (const image of this.ground) image.destroy();
    this.ground = [];
    for (const glint of this.glints) glint.destroy();
    this.glints = [];
  }

  public destroy(): void {
    this.clear();
    for (const key of this.scene.textures.getTextureKeys()) {
      if (key.startsWith('ground_chunk_')) this.scene.textures.remove(key);
    }
  }
}

/** Exposed for tests and other systems that need the baked ground depth. */
export const GROUND_DEPTH = DEPTH.ground;
