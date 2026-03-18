// ============================================
// THE UNDERGROWTH — Field of View (Shadowcasting)
// Recursive shadowcasting for fog of war
// ============================================

import { DungeonFloor, Tile } from './types';

const VIEW_RADIUS = 7;

// Compute field of view using recursive shadowcasting
export function computeFOV(floor: DungeonFloor, px: number, py: number, radius: number = VIEW_RADIUS): void {
  // Clear current visibility
  for (let y = 0; y < floor.height; y++) {
    for (let x = 0; x < floor.width; x++) {
      floor.visible[y][x] = false;
    }
  }

  // Player's tile is always visible
  if (py >= 0 && py < floor.height && px >= 0 && px < floor.width) {
    floor.visible[py][px] = true;
    floor.explored[py][px] = true;
  }

  // Cast in all 8 octants
  for (let octant = 0; octant < 8; octant++) {
    castLight(floor, px, py, radius, 1, 1.0, 0.0, octant);
  }
}

function castLight(
  floor: DungeonFloor,
  cx: number, cy: number,
  radius: number,
  row: number,
  startSlope: number,
  endSlope: number,
  octant: number
): void {
  if (startSlope < endSlope) return;

  let nextStartSlope = startSlope;

  for (let i = row; i <= radius; i++) {
    let blocked = false;

    for (let dx = -i; dx <= 0; dx++) {
      const dy = -i;

      // Map octant coordinates to real coordinates
      const [mx, my] = transformOctant(dx, dy, octant);
      const mapX = cx + mx;
      const mapY = cy + my;

      const leftSlope = (dx - 0.5) / (dy + 0.5);
      const rightSlope = (dx + 0.5) / (dy - 0.5);

      if (nextStartSlope < rightSlope) continue;
      if (endSlope > leftSlope) break;

      // Check if in range
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= radius) {
        if (mapX >= 0 && mapX < floor.width && mapY >= 0 && mapY < floor.height) {
          floor.visible[mapY][mapX] = true;
          floor.explored[mapY][mapX] = true;
        }
      }

      // Check for walls
      if (blocked) {
        if (isOpaque(floor, mapX, mapY)) {
          nextStartSlope = rightSlope;
          continue;
        } else {
          blocked = false;
          nextStartSlope = nextStartSlope; // keep current start
        }
      } else if (isOpaque(floor, mapX, mapY) && i < radius) {
        blocked = true;
        castLight(floor, cx, cy, radius, i + 1, nextStartSlope, leftSlope, octant);
        nextStartSlope = rightSlope;
      }
    }

    if (blocked) break;
  }
}

function transformOctant(col: number, row: number, octant: number): [number, number] {
  switch (octant) {
    case 0: return [col, row];
    case 1: return [row, col];
    case 2: return [-row, col];
    case 3: return [-col, row];
    case 4: return [-col, -row];
    case 5: return [-row, -col];
    case 6: return [row, -col];
    case 7: return [col, -row];
    default: return [col, row];
  }
}

function isOpaque(floor: DungeonFloor, x: number, y: number): boolean {
  if (x < 0 || x >= floor.width || y < 0 || y >= floor.height) return true;
  return floor.tiles[y][x] === Tile.Wall;
}

// Reveal entire map (for scroll effect)
export function revealMap(floor: DungeonFloor): void {
  for (let y = 0; y < floor.height; y++) {
    for (let x = 0; x < floor.width; x++) {
      floor.explored[y][x] = true;
    }
  }
}

// Check if a position has line of sight to another
export function hasLOS(floor: DungeonFloor, x1: number, y1: number, x2: number, y2: number): boolean {
  const dx = Math.abs(x2 - x1);
  const dy = Math.abs(y2 - y1);
  const sx = x1 < x2 ? 1 : -1;
  const sy = y1 < y2 ? 1 : -1;
  let err = dx - dy;
  let cx = x1;
  let cy = y1;

  while (cx !== x2 || cy !== y2) {
    if (isOpaque(floor, cx, cy) && (cx !== x1 || cy !== y1)) return false;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; cx += sx; }
    if (e2 < dx) { err += dx; cy += sy; }
  }
  return true;
}

// Manhattan distance
export function distance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.abs(x2 - x1) + Math.abs(y2 - y1);
}

// Euclidean distance
export function eucDist(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}
