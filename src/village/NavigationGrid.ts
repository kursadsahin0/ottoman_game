import type { GridPoint } from './types';

/**
 * Cached walkability for the existing world. The predicate is evaluated once
 * per tile at construction, so A* never calls into Phaser, Phaser game objects
 * or the renderer.
 */
export class NavigationGrid {
  private readonly blocked: Uint8Array;
  private readonly width: number;
  private readonly height: number;

  constructor(width: number, height: number, isBlocked: (x: number, y: number) => boolean) {
    this.width = Math.max(1, Math.floor(width));
    this.height = Math.max(1, Math.floor(height));
    this.blocked = new Uint8Array(this.width * this.height);
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        this.blocked[y * this.width + x] = isBlocked(x, y) ? 1 : 0;
      }
    }
  }

  getWidth(): number { return this.width; }
  getHeight(): number { return this.height; }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  isWalkable(x: number, y: number): boolean {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
    const tileX = Math.round(x);
    const tileY = Math.round(y);
    if (!this.inBounds(tileX, tileY)) return false;
    return this.blocked[tileY * this.width + tileX] === 0;
  }

  /** Returns the closest walkable tile in expanding deterministic rings. */
  nearestWalkable(point: GridPoint, maxRadius = 8): GridPoint {
    const originX = Math.round(point.x);
    const originY = Math.round(point.y);
    if (this.isWalkable(originX, originY)) return { x: originX, y: originY };
    for (let radius = 1; radius <= maxRadius; radius++) {
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
          const x = originX + dx;
          const y = originY + dy;
          if (this.isWalkable(x, y)) return { x, y };
        }
      }
    }
    return { x: originX, y: originY };
  }

  /** Diagonal moves require both side tiles clear so villagers cannot clip corners. */
  canStep(fromX: number, fromY: number, toX: number, toY: number): boolean {
    if (!this.isWalkable(toX, toY)) return false;
    const dx = toX - fromX;
    const dy = toY - fromY;
    if (dx !== 0 && dy !== 0) {
      if (!this.isWalkable(fromX + dx, fromY) || !this.isWalkable(fromX, fromY + dy)) return false;
    }
    return true;
  }

  /** Sampling-based line check used for path smoothing. */
  isSegmentWalkable(from: GridPoint, to: GridPoint): boolean {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 0.001) return this.isWalkable(to.x, to.y);
    const steps = Math.ceil(distance / 0.2);
    let previousX = Math.round(from.x);
    let previousY = Math.round(from.y);
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const x = Math.round(from.x + dx * t);
      const y = Math.round(from.y + dy * t);
      if (!this.canStep(previousX, previousY, x, y)) return false;
      previousX = x;
      previousY = y;
    }
    return true;
  }
}
