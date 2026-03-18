// ============================================
// THE UNDERGROWTH — Procedural Dungeon Generation
// ============================================

import { Tile, DungeonFloor, Room, Pos } from './types';
import { getBiomeForFloor } from './biomes';

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
  // Get the biome for this floor
  const biome = getBiomeForFloor(floorNumber);

  // For endless mode (floor > 30), keep using the actual floor number for scaling,
  // but biome cycles automatically via getBiomeForFloor
  const scalingFloor = floorNumber;

  // Aggressively scale map size to handle 30+ floors
  const width = Math.min(60, 35 + Math.floor(scalingFloor * 1.2));
  const height = Math.min(45, 25 + Math.floor(scalingFloor * 0.8));
  const numRooms = Math.min(15, 5 + Math.floor(scalingFloor * 0.5));
  const minRoomSize = 4;
  const maxRoomSize = Math.min(10, 6 + Math.floor(scalingFloor * 0.3));

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

  // Add biome-specific decorations and features
  if (biome.id === 'shallow_caves') {
    // Shallow Caves: Mushroom decorations and water pools
    addDecorations(tiles, width, height, biome.decorTile, biome.decorChance);
    addWaterPools(tiles, width, height, rooms);
  } else if (biome.id === 'fungal_forest') {
    // Fungal Forest: Vine decorations, more organic rooms
    addDecorations(tiles, width, height, biome.decorTile, biome.decorChance);
    addWaterPools(tiles, width, height, rooms, 0.4);
  } else if (biome.id === 'crystal_caverns') {
    // Crystal Caverns: Crystal decorations, larger rooms already generated
    addDecorations(tiles, width, height, biome.decorTile, biome.decorChance);
    // Larger rooms already happen naturally due to increased maxRoomSize from scaling
  } else if (biome.id === 'lava_depths') {
    // Lava Depths: Lava pools instead of water, scatter lava along corridors
    addLavaPools(tiles, width, height, rooms);
    addLavaCorridorScatter(tiles, width, height);
  } else if (biome.id === 'the_abyss') {
    // The Abyss: BoneFloor and AbyssFloor scattered among floor tiles
    addAbyssFloorVariants(tiles, width, height);
  }

  // Place locked doors in some corridor chokepoints (from floor 3+)
  if (floorNumber >= 3 && rooms.length >= 4) {
    const numDoors = Math.min(3, Math.floor(floorNumber / 5) + 1);
    let doorsPlaced = 0;
    for (let i = 1; i < rooms.length - 1 && doorsPlaced < numDoors; i++) {
      if (rng() < 0.35) {
        // Find a corridor tile between this room and the next
        const a = rooms[i];
        const b = rooms[i + 1] || rooms[i - 1];
        const midX = Math.floor((a.centerX + b.centerX) / 2);
        const midY = Math.floor((a.centerY + b.centerY) / 2);
        // Check if the mid-point is a floor tile in a narrow corridor
        if (midY > 0 && midY < height - 1 && midX > 0 && midX < width - 1 &&
            tiles[midY][midX] === Tile.Floor) {
          // Check it's a chokepoint (walls on at least 2 opposite sides)
          const horizWalls = (tiles[midY][midX - 1] === Tile.Wall ? 1 : 0) + (tiles[midY][midX + 1] === Tile.Wall ? 1 : 0);
          const vertWalls = (tiles[midY - 1][midX] === Tile.Wall ? 1 : 0) + (tiles[midY + 1][midX] === Tile.Wall ? 1 : 0);
          if (horizWalls >= 2 || vertWalls >= 2) {
            tiles[midY][midX] = Tile.Door;
            doorsPlaced++;
          }
        }
      }
    }
  }

  // Place treasure chests in some rooms (from floor 2+)
  if (floorNumber >= 2 && rooms.length >= 3) {
    const numChests = rng() < 0.5 ? 1 : (rng() < 0.3 ? 2 : 0);
    let chestsPlaced = 0;
    for (let i = 1; i < rooms.length - 1 && chestsPlaced < numChests; i++) {
      if (rng() < 0.4) {
        const room = rooms[i];
        // Place chest in a corner of the room
        const cx = room.x + (rng() < 0.5 ? 1 : room.w - 2);
        const cy = room.y + (rng() < 0.5 ? 1 : room.h - 2);
        if (cy > 0 && cy < height - 1 && cx > 0 && cx < width - 1 &&
            tiles[cy][cx] === Tile.Floor) {
          tiles[cy][cx] = Tile.Chest;
          chestsPlaced++;
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

// --- Add decorative tiles to floor tiles ---
function addDecorations(tiles: Tile[][], width: number, height: number, decorTile: Tile, decorChance: number) {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (tiles[y][x] === Tile.Floor && rng() < decorChance) {
        tiles[y][x] = decorTile;
      }
    }
  }
}

// --- Add water pools in some rooms ---
function addWaterPools(tiles: Tile[][], width: number, height: number, rooms: Room[], frequency: number = 0.5) {
  if (rooms.length > 3 && rng() < frequency) {
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
}

// --- Add lava pools in rooms (Lava Depths) ---
function addLavaPools(tiles: Tile[][], width: number, height: number, rooms: Room[]) {
  if (rooms.length > 3 && rng() < 0.6) {
    const lavaRoom = rooms[rngInt(1, rooms.length - 2)];
    const poolCX = lavaRoom.centerX;
    const poolCY = lavaRoom.centerY;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const lx = poolCX + dx;
        const ly = poolCY + dy;
        if (ly > 0 && ly < height - 1 && lx > 0 && lx < width - 1) {
          if (tiles[ly][lx] === Tile.Floor && rng() < 0.7) {
            tiles[ly][lx] = Tile.Lava;
          }
        }
      }
    }
  }
}

// --- Scatter lava along corridors (Lava Depths) ---
function addLavaCorridorScatter(tiles: Tile[][], width: number, height: number) {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (tiles[y][x] === Tile.Floor && rng() < 0.02) {
        tiles[y][x] = Tile.Lava;
      }
    }
  }
}

// --- Add BoneFloor and AbyssFloor variants (The Abyss) ---
function addAbyssFloorVariants(tiles: Tile[][], width: number, height: number) {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (tiles[y][x] === Tile.Floor) {
        const roll = rng();
        if (roll < 0.12) {
          tiles[y][x] = Tile.BoneFloor;
        } else if (roll < 0.24) {
          tiles[y][x] = Tile.AbyssFloor;
        }
      }
    }
  }
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
  // Floor variants: Mushroom, Crystal, Vine, BoneFloor, AbyssFloor are all walkable
  // StairsDown and Door are walkable
  // Water is walkable (shallow water, cosmetic slowdown message)
  // Lava is NOT walkable (impassable hazard)
  return (
    tile === Tile.Floor ||
    tile === Tile.StairsDown ||
    tile === Tile.Water ||
    tile === Tile.Mushroom ||
    tile === Tile.Crystal ||
    tile === Tile.Vine ||
    tile === Tile.BoneFloor ||
    tile === Tile.AbyssFloor
  );
  // Note: Door and Chest are NOT walkable by enemies
  // Player handles Door (with key) and Chest (opens it) in processAction
}

// --- Check if a position is in bounds ---
export function inBounds(x: number, y: number, floor: DungeonFloor): boolean {
  return x >= 0 && x < floor.width && y >= 0 && y < floor.height;
}

// Random from array (exported)
export { pick, rng, rngInt };
