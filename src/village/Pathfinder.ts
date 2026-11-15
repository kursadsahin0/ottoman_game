import type { NavigationGrid } from './NavigationGrid';
import type { GridPoint } from './types';

export interface PathResult {
  path: GridPoint[];
  found: boolean;
  expanded: number;
  /** True when the requested goal itself was blocked or unreachable. */
  approximate: boolean;
  goal: GridPoint;
}

interface HeapNode {
  index: number;
  f: number;
  h: number;
}

const DIRS: ReadonlyArray<readonly [number, number, number]> = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2],
];

class MinHeap {
  private readonly items: HeapNode[] = [];

  get size(): number { return this.items.length; }

  push(node: HeapNode): void {
    this.items.push(node);
    let index = this.items.length - 1;
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if (!this.less(this.items[index]!, this.items[parent]!)) break;
      [this.items[index], this.items[parent]] = [this.items[parent]!, this.items[index]!];
      index = parent;
    }
  }

  pop(): HeapNode | undefined {
    const top = this.items[0];
    const last = this.items.pop();
    if (!top || !last || this.items.length === 0) return top;
    this.items[0] = last;
    let index = 0;
    for (;;) {
      const left = index * 2 + 1;
      const right = left + 1;
      let smallest = index;
      if (left < this.items.length && this.less(this.items[left]!, this.items[smallest]!)) smallest = left;
      if (right < this.items.length && this.less(this.items[right]!, this.items[smallest]!)) smallest = right;
      if (smallest === index) break;
      [this.items[index], this.items[smallest]] = [this.items[smallest]!, this.items[index]!];
      index = smallest;
    }
    return top;
  }

  private less(a: HeapNode, b: HeapNode): boolean {
    if (a.f !== b.f) return a.f < b.f;
    if (a.h !== b.h) return a.h < b.h;
    const ay = Math.floor(a.index / 4096), by = Math.floor(b.index / 4096);
    if (ay !== by) return ay < by;
    return a.index % 4096 < b.index % 4096;
  }
}

function octile(dx: number, dy: number): number {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  return ax > ay ? ax + (Math.SQRT2 - 1) * ay : ay + (Math.SQRT2 - 1) * ax;
}

/**
 * Deterministic A* over the village grid. Ties are broken by grid position,
 * never by insertion or frame order, so a schedule produces the same route on
 * every run and in headless tests.
 */
export class Pathfinder {
  constructor(private readonly grid: NavigationGrid) {}

  findPath(
    from: GridPoint,
    requestedGoal: GridPoint,
    occupancy?: (x: number, y: number) => number,
    maxNodes = 2500,
  ): PathResult {
    const width = this.grid.getWidth();
    const height = this.grid.getHeight();
    const start = this.grid.nearestWalkable({ x: Math.round(from.x), y: Math.round(from.y) });
    const exactGoalWalkable = this.grid.isWalkable(requestedGoal.x, requestedGoal.y);
    const goal = exactGoalWalkable
      ? { x: Math.round(requestedGoal.x), y: Math.round(requestedGoal.y) }
      : this.grid.nearestWalkable(requestedGoal, 6);

    const startIndex = start.y * width + start.x;
    const goalIndex = goal.y * width + goal.x;
    if (!this.grid.isWalkable(start.x, start.y)) {
      return { path: [], found: false, expanded: 0, approximate: true, goal };
    }
    if (startIndex === goalIndex) {
      return { path: [], found: true, expanded: 0, approximate: !exactGoalWalkable, goal };
    }

    const size = width * height;
    const gScore = new Float64Array(size);
    gScore.fill(Number.POSITIVE_INFINITY);
    const cameFrom = new Int32Array(size);
    cameFrom.fill(-1);
    const closed = new Uint8Array(size);
    const open = new MinHeap();
    const firstH = octile(goal.x - start.x, goal.y - start.y);
    gScore[startIndex] = 0;
    open.push({ index: startIndex, f: firstH, h: firstH });
    let expanded = 0;
    let found = false;

    while (open.size > 0 && expanded < maxNodes) {
      const current = open.pop()!;
      if (closed[current.index]) continue;
      closed[current.index] = 1;
      expanded++;
      if (current.index === goalIndex) { found = true; break; }

      const cx = current.index % width;
      const cy = Math.floor(current.index / width);
      for (const [dx, dy, cost] of DIRS) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (!this.grid.canStep(cx, cy, nx, ny)) continue;
        const neighbour = ny * width + nx;
        if (closed[neighbour]) continue;
        const extra = occupancy ? Math.max(0, occupancy(nx, ny)) * 1.7 : 0;
        const tentative = gScore[current.index]! + cost + extra;
        if (tentative >= gScore[neighbour]!) continue;
        gScore[neighbour] = tentative;
        cameFrom[neighbour] = current.index;
        const h = octile(goal.x - nx, goal.y - ny);
        open.push({ index: neighbour, f: tentative + h, h });
      }
    }

    if (!found) {
      return {
        path: [], found: false, expanded, approximate: true, goal,
      };
    }

    const raw: GridPoint[] = [];
    let cursor = goalIndex;
    while (cursor !== startIndex && cursor >= 0) {
      raw.push({ x: cursor % width, y: Math.floor(cursor / width) });
      cursor = cameFrom[cursor]!;
    }
    raw.reverse();
    const path = this.smooth(start, raw, occupancy);
    return {
      path,
      found: path.length > 0 || startIndex === goalIndex,
      expanded,
      approximate: !exactGoalWalkable || goal.x !== Math.round(requestedGoal.x) || goal.y !== Math.round(requestedGoal.y),
      goal,
    };
  }

  /** String-pulling removes redundant waypoints without cutting corners or occupied tiles. */
  private smooth(
    start: GridPoint,
    raw: GridPoint[],
    occupancy?: (x: number, y: number) => number,
  ): GridPoint[] {
    if (raw.length <= 1) return raw;
    const result: GridPoint[] = [];
    let anchor = start;
    let index = 0;
    while (index < raw.length) {
      let chosen = index;
      for (let candidate = raw.length - 1; candidate > index; candidate--) {
        const point = raw[candidate]!;
        if (!this.grid.isSegmentWalkable(anchor, point)) continue;
        if (occupancy && !this.segmentClear(anchor, point, occupancy, candidate === raw.length - 1)) continue;
        chosen = candidate;
        break;
      }
      const point = raw[chosen]!;
      result.push(point);
      anchor = point;
      index = chosen + 1;
    }
    return result;
  }

  private segmentClear(
    from: GridPoint,
    to: GridPoint,
    occupancy: (x: number, y: number) => number,
    allowEnd: boolean,
  ): boolean {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 0.25));
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const x = Math.round(from.x + dx * t);
      const y = Math.round(from.y + dy * t);
      if (allowEnd && i === steps) continue;
      if (occupancy(x, y) > 0) return false;
    }
    return true;
  }
}
