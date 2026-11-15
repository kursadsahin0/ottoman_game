import { ISOMETRIC_CONFIG } from '@core/GameConfig';

export interface Point {
  x: number;
  y: number;
}

export interface IsoPoint {
  x: number;
  y: number;
}

export class IsometricUtils {
  private static tileWidth = ISOMETRIC_CONFIG.tileWidth;
  private static tileHeight = ISOMETRIC_CONFIG.tileHeight;
  private static originX = ISOMETRIC_CONFIG.originX;
  private static originY = ISOMETRIC_CONFIG.originY;

  /**
   * Convert grid coordinates (tile row/col) to screen coordinates (isometric)
   */
  public static gridToScreen(gridX: number, gridY: number): Point {
    const screenX = (gridX - gridY) * (this.tileWidth / 2) + this.originX;
    const screenY = (gridX + gridY) * (this.tileHeight / 2) + this.originY;
    return { x: screenX, y: screenY };
  }

  /**
   * Convert screen coordinates to grid coordinates
   */
  public static screenToGrid(screenX: number, screenY: number): IsoPoint {
    const adjustedX = screenX - this.originX;
    const adjustedY = screenY - this.originY;
    
    const gridX = (adjustedX / (this.tileWidth / 2) + adjustedY / (this.tileHeight / 2)) / 2;
    const gridY = (adjustedY / (this.tileHeight / 2) - adjustedX / (this.tileWidth / 2)) / 2;
    
    return { x: gridX, y: gridY };
  }

  /**
   * Get the floor/rounded grid coordinates
   */
  public static screenToGridFloor(screenX: number, screenY: number): IsoPoint {
    const grid = this.screenToGrid(screenX, screenY);
    return { x: Math.floor(grid.x), y: Math.floor(grid.y) };
  }

  /**
   * Get the center point of a tile in screen coordinates
   */
  public static getTileCenter(gridX: number, gridY: number): Point {
    const pos = this.gridToScreen(gridX, gridY);
    return { x: pos.x, y: pos.y - this.tileHeight / 4 };
  }

  /**
   * Check if a grid coordinate is within bounds
   */
  public static isInBounds(gridX: number, gridY: number, width: number, height: number): boolean {
    return gridX >= 0 && gridX < width && gridY >= 0 && gridY < height;
  }

  /**
   * Get distance between two grid points
   */
  public static distance(gridX1: number, gridY1: number, gridX2: number, gridY2: number): number {
    const dx = gridX2 - gridX1;
    const dy = gridY2 - gridY1;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Get Manhattan distance between two grid points
   */
  public static manhattanDistance(gridX1: number, gridY1: number, gridX2: number, gridY2: number): number {
    return Math.abs(gridX2 - gridX1) + Math.abs(gridY2 - gridY1);
  }

  /**
   * Update origin for camera/viewport offset
   */
  public static setOrigin(originX: number, originY: number): void {
    this.originX = originX;
    this.originY = originY;
  }

  /**
   * Converts a screen-space vector (pixels, or any consistent unit) into the
   * matching world grid-space vector. Screen Y grows downward, so "up" on
   * screen becomes negative movement on both grid axes.
   */
  public static screenVectorToGridVector(vectorX: number, vectorY: number): IsoPoint {
    const halfW = this.tileWidth / 2;
    const halfH = this.tileHeight / 2;
    return {
      x: (vectorX / halfW + vectorY / halfH) / 2,
      y: (vectorY / halfH - vectorX / halfW) / 2,
    };
  }

  /**
   * Get tile dimensions
   */
  public static getTileDimensions(): { width: number; height: number } {
    return { width: this.tileWidth, height: this.tileHeight };
  }
}
