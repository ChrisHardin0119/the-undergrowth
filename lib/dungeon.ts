// ============================================
// THE UNDERGROWTH — Procedural Dungeon Generation
// ============================================

import { Tile, DungeonFloor, Room, Pos } from './types';

// --- Seeded RNG (simple LCG) ---
let seed = Date.now();
export function setSeed(s: number) { seed = s; }
function rng(): number {
  seed = (seed * 1664525 + 1013904223) & 0xFFFFFFFF;
  return (seed >>> 0) / 0xFFFFFFFF;
}
function rngInt(min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

// --- Generate a dungeon floor ---
export function generateFloor(floorNumber: number): DungeonFloor {
  // Floors get larger as you go deeper
  const width = Math.min(50, 35 + Math.floor(floorNumber * 1.5));
  const height = Math.min(35, 25 + Math.floor(floorNumber));
  const numRooms = Math.min(12, 5 + Math.floor(floorNumber * 0.7));
  const minRoomSize = 4;
  const maxRoomSize = Math.min(10, 6 + Math.floor(floorNumber * 0.3));

  // Initialize all walls
  const tiles: Tile[][] = [];
  for (let y = 0; y < height; y++) {
    tiles[y] = [];
    for (let x = 0; x < width; x++) {
      tiles[y][x] = Tile.Wall;
    }
  }

  // Generate rooms
  const rooms: Room[] = [];
  let attempts = 0;
  while (rooms.length < numRooms && attempts < 200) {
    attempts++;
    const w = rngInt(minRoomSize, maxRoomSize);
    const h = rngInt(minRoomSize, maxRoomSize);
    const x = rngInt(1, width - w - 2);
    const y = rngInt(1, height - h - 2);

    // Check for overlap (with 1-tile padding)
    let overlaps = false;
    for (const room of rooms) {
      if (
        x - 1 < room.x + room.w &&
        x + w + 1 > room.x &&
        y - 1 < room.y + room.h &&
        y + h + 1 > room.y
      ) {
        overlaps = true;
        break;
      }
    }

    if (!overlaps) {
      rooms.push({
        x, y, w, h,
        centerX: Math.floor(x + w / 2),
        centerY: Math.floor(y + h / 2),
      });
    }
  }

  // Carve rooms
  for (const room of rooms) {
    for (let ry = room.y; ry < room.y + room.h; ry++) {
      for (let rx = room.x; rx < room.x + room.w; rx++) {
        tiles[ry][rx] = Tile.Floor;
      }
    }
  }

  // Connect rooms with corridors
  for (let i = 1; i < rooms.length; i++) {
    const a = rooms[i - 1];
    const b = rooms[i];
    carveCorridor(tiles, a.centerX, a.centerY, b.centerX, b.centerY, width, height);
  }

  // Sometimes add extra connections for loops
  for (let i = 0; i < rooms.length - 2; i++) {
    if (rng() < 0.3) {
      const a = rooms[i];
      const b = rooms[rngInt(i + 2, rooms.length - 1)];
      carveCorridor(tiles, a.centerX, a.centerY, b.centerX, b.centerY, width, height);
    }
  }

  // Add decorative mushrooms on floors
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (tiles[y][x] === Tile.Floor && rng() < 0.04) {
        tiles[y][x] = Tile.Mushroom;
      }
    }
  }

  // Add water pools in some rooms
  if (rooms.length > 3 && rng() < 0.5) {
    const waterRoom = rooms[rngInt(1, rooms.length - 2)];
    const poolCX = waterRoom.centerX;
    const poolCY = waterRoom.centerY;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const wx = poolCX + dx;
        const wy = poolCY + dy;
        if (wy > 0 && wy < height - 1 && wx > 0 && wx < width - 1) {
          if (tiles[wy][wx] === Tile.Floor && rng() < 0.7) {
            tiles[wy][wx] = Tile.Water;
          }
        }
      }
    }
  }

  // Place stairs down in the last room
  const lastRoom = rooms[rooms.length - 1];
  tiles[lastRoom.centerY][lastRoom.centerX] = Tile.StairsDown;

  // Initialize exploration arrays
  const explored: boolean[][] = [];
  const visible: boolean[][] = [];
  for (let y = 0; y < height; y++) {
    explored[y] = new Array(width).fill(false);
    visible[y] = new Array(width).fill(false);
  }

  return { width, height, tiles, rooms, explored, visible };
}

// --- Carve an L-shaped corridor ---
function carveCorridor(
  tiles: Tile[][],
  x1: number, y1: number,
  x2: number, y2: number,
  width: number, height: number
) {
  // Randomly choose to go horizontal-first or vertical-first
  if (rng() < 0.5) {
    carveHorizontal(tiles, x1, x2, y1, width, height);
    carveVertical(tiles, y1, y2, x2, width, height);
  } else {
    carveVertical(tiles, y1, y2, x1, width, height);
    carveHorizontal(tiles, x1, x2, y2, width, height);
  }
}

function carveHorizontal(tiles: Tile[][], x1: number, x2: number, y: number, w: number, h: number) {
  const minX = Math.min(x1, x2);
  const maxX = Math.max(x1, x2);
  for (let x = minX; x <= maxX; x++) {
    if (y > 0 && y < h - 1 && x > 0 && x < w - 1) {
      if (tiles[y][x] === Tile.Wall) {
        tiles[y][x] = Tile.Floor;
      }
    }
  }
}

function carveVertical(tiles: Tile[][], y1: number, y2: number, x: number, w: number, h: number) {
  const minY = Math.min(y1, y2);
  const maxY = Math.max(y1, y2);
  for (let y = minY; y <= maxY; y++) {
    if (y > 0 && y < h - 1 && x > 0 && x < w - 1) {
      if (tiles[y][x] === Tile.Wall) {
        tiles[y][x] = Tile.Floor;
      }
    }
  }
}

// --- Find a walkable position in a room ---
export function findSpawnPos(floor: DungeonFloor, room: Room, occupied: Pos[]): Pos | null {
  for (let attempts = 0; attempts < 50; attempts++) {
    const x = rngInt(room.x, room.x + room.w - 1);
    const y = rngInt(room.y, room.y + room.h - 1);
    if (isWalkable(floor.tiles[y][x]) && !occupied.some(p => p.x === x && p.y === y)) {
      return { x, y };
    }
  }
  return null;
}

// --- Find any walkable position on the floor ---
export function findRandomWalkable(floor: DungeonFloor, occupied: Pos[]): Pos | null {
  for (let attempts = 0; attempts < 200; attempts++) {
    const x = rngInt(1, floor.width - 2);
    const y = rngInt(1, floor.height - 2);
    if (isWalkable(floor.tiles[y][x]) && !occupied.some(p => p.x === x && p.y === y)) {
      return { x, y };
    }
  }
  return null;
}

// --- Check if a tile is walkable ---
export function isWalkable(tile: Tile): boolean {
  return tile === Tile.Floor || tile === Tile.StairsDown || tile === Tile.Mushroom || tile === Tile.Door;
}

// --- Check if a position is in bounds ---
export function inBounds(x: number, y: number, floor: DungeonFloor): boolean {
  return x >= 0 && x < floor.width && y >= 0 && y < floor.height;
}

// Random from array (exported)
export { pick, rng, rngInt };
