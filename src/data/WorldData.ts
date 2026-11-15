export enum TileType {
  GRASS = 0,
  DIRT_ROAD = 1,
  DIRT = 2,
  WATER = 3,
  FARM = 4,
}

export enum ObjectType {
  NONE = 0,
  TREE = 1,
  ROCK = 2,
  HOUSE = 3,
  MARKET_STALL = 4,
  WELL = 5,
  FENCE = 6,
  WORKSHOP = 7,
  GRANARY = 8,
  ZAVIYE = 9,
}

export interface TileData {
  type: TileType;
  walkable: boolean;
  height: number;
}

export interface WorldObject {
  id: string;
  type: ObjectType;
  gridX: number;
  gridY: number;
  interactable: boolean;
  collision: boolean;
  interactionText?: string;
}

export interface WorldMap {
  width: number;
  height: number;
  tiles: TileData[][];
  objects: WorldObject[];
}

export class WorldGenerator {
  public static generateFrontierSettlement(): WorldMap {
    const width = 32;
    const height = 32;
    const tiles: TileData[][] = [];
    
    // Initialize with grass
    for (let y = 0; y < height; y++) {
      tiles[y] = [];
      for (let x = 0; x < width; x++) {
        tiles[y]![x] = {
          type: TileType.GRASS,
          walkable: true,
          height: 0,
        };
      }
    }
    
    // Create dirt road
    const roadY = Math.floor(height / 2);
    for (let x = 5; x < width - 5; x++) {
      const row = tiles[roadY];
      if (row) {
        row[x] = {
          type: TileType.DIRT_ROAD,
          walkable: true,
          height: 0,
        };
      }
      // Add road edges
      if (roadY + 1 < height) {
        const row2 = tiles[roadY + 1];
        if (row2) {
          row2[x] = {
            type: TileType.DIRT,
            walkable: true,
            height: 0,
          };
        }
      }
      if (roadY - 1 >= 0) {
        const row3 = tiles[roadY - 1];
        if (row3) {
          row3[x] = {
            type: TileType.DIRT,
            walkable: true,
            height: 0,
          };
        }
      }
    }

    // A narrow branch lane leads from the village road to its rural lodge.
    for (let y = roadY + 1; y <= roadY + 5; y++) {
      const laneRow = tiles[y];
      if (laneRow?.[9]) laneRow[9] = { type: TileType.DIRT, walkable: true, height: 0 };
    }
    
    // Create small water feature near corner
    const waterX = 4;
    const waterY = 4;
    for (let dy = 0; dy < 3; dy++) {
      for (let dx = 0; dx < 3; dx++) {
        const wy = waterY + dy;
        const wx = waterX + dx;
        if (wy < height && wx < width) {
          const wrow = tiles[wy];
          if (wrow) {
            wrow[wx] = {
              type: TileType.WATER,
              walkable: false,
              height: -1,
            };
          }
        }
      }
    }
    
    // Create farm plot near road (3x3, matching the farm simulation layout)
    const farmX = 10;
    const farmY = roadY - 4;
    for (let dy = 0; dy < 3; dy++) {
      for (let dx = 0; dx < 3; dx++) {
        const fy = farmY + dy;
        const fx = farmX + dx;
        if (fy >= 0 && fx < width) {
          const frow = tiles[fy];
          if (frow) {
            frow[fx] = {
              type: TileType.FARM,
              walkable: true,
              height: 0,
            };
          }
        }
      }
    }
    
    const objects: WorldObject[] = [];
    
    // A compact residential quarter sits back from the road and its branch.
    // Small staggered house groups leave clear walking space between plots.
    objects.push({
      id: 'house_1',
      type: ObjectType.HOUSE,
      gridX: 6,
      gridY: 12,
      interactable: true,
      collision: true,
      interactionText: 'Enter House',
    });
    
    objects.push({
      id: 'house_2',
      type: ObjectType.HOUSE,
      gridX: 12,
      gridY: 8,
      interactable: true,
      collision: true,
      interactionText: 'Enter House',
    });
    
    objects.push({
      id: 'house_3',
      type: ObjectType.HOUSE,
      gridX: 18,
      gridY: 12,
      interactable: true,
      collision: true,
      interactionText: 'Enter House',
    });

    // The second, looser group frames the lodge and shared village space.
    for (const [id, gridX, gridY] of [
      ['house_4', 5, 24],
      ['house_5', 13, 25],
      ['house_6', 20, 23],
    ] as const) {
      objects.push({ id, type: ObjectType.HOUSE, gridX, gridY, interactable: true, collision: true, interactionText: 'Enter House' });
    }

    // Shared work places sit at the settlement edge, away from house fronts.
    objects.push({
      id: 'workshop_smithy', type: ObjectType.WORKSHOP, gridX: 4, gridY: 17,
      interactable: true, collision: true, interactionText: 'Visit Smith’s Workshop',
    });
    objects.push({
      id: 'granary_1', type: ObjectType.GRANARY, gridX: 23, gridY: 23,
      interactable: true, collision: true, interactionText: 'Visit the Granary',
    });
    objects.push({
      id: 'zaviye_1', type: ObjectType.ZAVIYE, gridX: 9, gridY: roadY + 5,
      interactable: true, collision: true, interactionText: 'Visit the Village Lodge',
    });
    
    // Small traders use separate road-side pitches rather than one formal bazaar.
    objects.push({
      id: 'market_1',
      type: ObjectType.MARKET_STALL,
      gridX: 8,
      gridY: roadY,
      interactable: true,
      collision: true,
      interactionText: 'Browse Market',
    });
    
    objects.push({
      id: 'market_2',
      type: ObjectType.MARKET_STALL,
      gridX: 21,
      gridY: roadY - 3,
      interactable: true,
      collision: true,
      interactionText: 'Browse Market',
    });

    // Other stalls are spaced along the eastern road and the well-side path.
    for (const [id, gridX, gridY] of [
      ['market_3', 27, roadY + 3],
      ['market_4', 16, roadY + 2],
    ] as const) {
      objects.push({ id, type: ObjectType.MARKET_STALL, gridX, gridY, interactable: true, collision: true, interactionText: 'Browse Market' });
    }
    
    // Shared well beside the main lane, with room for people to gather.
    objects.push({
      id: 'well_1',
      type: ObjectType.WELL,
      gridX: 12,
      gridY: 18,
      interactable: true,
      collision: true,
      interactionText: 'Draw Water',
    });
    
    // Trees
    const treePositions = [
      { x: 3, y: 6 }, { x: 6, y: 3 }, { x: 25, y: 5 }, { x: 28, y: 8 },
      { x: 2, y: 10 }, { x: 2, y: 26 }, { x: 29, y: 28 }, { x: 4, y: 26 },
      { x: 3, y: 22 }, { x: 2, y: 29 },
    ];
    treePositions.forEach((pos, idx) => {
      objects.push({
        id: `tree_${idx}`,
        type: ObjectType.TREE,
        gridX: pos.x,
        gridY: pos.y,
        interactable: false,
        collision: true,
      });
    });
    
    // Rocks
    const rockPositions = [
      { x: 7, y: 6 }, { x: 23, y: 6 }, { x: 2, y: 24 }, { x: 29, y: 20 },
    ];
    rockPositions.forEach((pos, idx) => {
      objects.push({
        id: `rock_${idx}`,
        type: ObjectType.ROCK,
        gridX: pos.x,
        gridY: pos.y,
        interactable: false,
        collision: true,
      });
    });
    
    return { width, height, tiles, objects };
  }
}
