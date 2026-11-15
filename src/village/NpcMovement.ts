import type { NavigationGrid } from './NavigationGrid';
import type { GridPoint, VillageNpcState } from './types';

export interface MovementOutcome {
  moved: boolean;
  arrived: boolean;
  blocked: boolean;
  distance: number;
}

export interface MovementOptions {
  speed: number;
  /** Positions of other awake villagers, used for gentle separation. */
  others: readonly GridPoint[];
  separation?: boolean;
}

/**
 * Movement only. The mover consumes the path chosen by the AI layer, keeps the
 * villager on walkable tiles, and applies local separation so two characters
 * do not merge into one. It never recalculates a route and never renders.
 */
export function advanceNpc(
  npc: VillageNpcState,
  grid: NavigationGrid,
  dt: number,
  options: MovementOptions,
): MovementOutcome {
  const path = npc.path.path;
  if (npc.path.index >= path.length) {
    return { moved: false, arrived: true, blocked: false, distance: 0 };
  }

  let remaining = Math.max(0, dt) * Math.max(0.4, options.speed);
  let moved = false;
  let blocked = false;
  let travelled = 0;

  while (remaining > 0.0001 && npc.path.index < path.length) {
    const waypoint = path[npc.path.index]!;
    const dx = waypoint.x - npc.position.x;
    const dy = waypoint.y - npc.position.y;
    const length = Math.hypot(dx, dy);
    if (length < 0.001) {
      npc.path.index++;
      continue;
    }
    const step = Math.min(remaining, 0.12);
    let moveX = dx / length * step;
    let moveY = dy / length * step;

    if (options.separation !== false) {
      const separation = separationVector(npc, options.others);
      moveX += separation.x * step;
      moveY += separation.y * step;
    }

    const result = tryStep(npc, grid, moveX, moveY);
    if (!result.moved) {
      blocked = true;
      break;
    }
    moved = true;
    travelled += result.distance;
    remaining -= step;
    if (length <= step + 0.06) npc.path.index++;
  }

  npc.distanceTravelled += travelled;
  return {
    moved,
    arrived: npc.path.index >= path.length,
    blocked,
    distance: travelled,
  };
}

function separationVector(npc: VillageNpcState, others: readonly GridPoint[]): { x: number; y: number } {
  let x = 0;
  let y = 0;
  for (const other of others) {
    const dx = npc.position.x - other.x;
    const dy = npc.position.y - other.y;
    const distance = Math.hypot(dx, dy);
    if (distance > 0.72 || distance < 0.0001) continue;
    const strength = (0.72 - distance) / 0.72 * 0.65;
    x += dx / distance * strength;
    y += dy / distance * strength;
  }
  const length = Math.hypot(x, y);
  if (length > 1) return { x: x / length, y: y / length };
  return { x, y };
}

function tryStep(
  npc: VillageNpcState,
  grid: NavigationGrid,
  dx: number,
  dy: number,
): { moved: boolean; distance: number } {
  const targetX = npc.position.x + dx;
  const targetY = npc.position.y + dy;
  const fromX = Math.round(npc.position.x);
  const fromY = Math.round(npc.position.y);
  const toX = Math.round(targetX);
  const toY = Math.round(targetY);
  if (grid.canStep(fromX, fromY, toX, toY)) {
    npc.position.x = targetX;
    npc.position.y = targetY;
    return { moved: true, distance: Math.hypot(dx, dy) };
  }
  // Slide along one axis rather than walking repeatedly into the same obstacle.
  if (Math.abs(dx) > 0.0001 && grid.isWalkable(Math.round(targetX), fromY) && grid.isWalkable(fromX, fromY)) {
    npc.position.x = targetX;
    return { moved: true, distance: Math.abs(dx) };
  }
  if (Math.abs(dy) > 0.0001 && grid.isWalkable(fromX, Math.round(targetY)) && grid.isWalkable(fromX, fromY)) {
    npc.position.y = targetY;
    return { moved: true, distance: Math.abs(dy) };
  }
  return { moved: false, distance: 0 };
}
