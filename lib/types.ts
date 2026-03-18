// ============================================
// THE UNDERGROWTH — Core Type Definitions
// A roguelike dungeon crawler in bioluminescent caves
// ============================================

// --- Position ---
export interface Pos {
  x: number;
  y: number;
}

// --- Tile Types ---
export enum Tile {
  Wall = 0,
  Floor = 1,
  StairsDown = 2,
  Door = 3,
  Water = 4,
  Mushroom = 5, // decorative glowing mushroom
  Chest = 6,
  Lava = 7,
  Crystal = 8,
  Vine = 9,
  BoneFloor = 10,
  AbyssFloor = 11,
}

// --- Entity Types ---
export type EntityType = 'player' | 'enemy' | 'item';

// --- Status Effects ---
export interface StatusEffect {
  type: 'poison' | 'regen' | 'strength' | 'shield' | 'slow' | 'blind' | 'haste' | 'cure_poison' | 'fire_aura' | 'invulnerable';
  turnsLeft: number;
  value: number; // damage per turn, bonus amount, etc.
}

// --- Equipment Slots ---
export type EquipSlot = 'weapon' | 'armor' | 'accessory';

// --- Item Definition ---
export interface ItemDef {
  id: string;
  name: string;
  icon: string;
  description: string;
  type: 'consumable' | 'equipment' | 'scroll' | 'key';
  equipSlot?: EquipSlot;
  // Stats for equipment
  atkBonus?: number;
  defBonus?: number;
  hpBonus?: number;
  // Effects for consumables
  healAmount?: number;
  manaAmount?: number;
  statusEffect?: StatusEffect;
  // Scroll effects
  scrollEffect?: 'reveal_map' | 'teleport' | 'fireball' | 'freeze_all' | 'summon_ally' | 'piercing_strike' | 'earthquake' | 'fire_wave' | 'backstab' | 'banish';
  // Rarity affects glow color
  rarity: 'common' | 'uncommon' | 'rare' | 'legendary';
  floorMin: number; // earliest floor this can appear
}

// --- Item Instance (on the map or in inventory) ---
export interface ItemInstance {
  defId: string;
  pos?: Pos; // if on the ground
}

// --- Enemy Definition ---
export interface EnemyDef {
  id: string;
  name: string;
  icon: string;
  description: string;
  baseHp: number;
  baseAtk: number;
  baseDef: number;
  xpReward: number;
  speed: number; // 1 = normal, 2 = moves every other turn, 0.5 = moves twice per turn
  behavior: 'wander' | 'chase' | 'patrol' | 'ambush' | 'ranged' | 'boss';
  abilities?: EnemyAbility[];
  drops?: { itemId: string; chance: number }[];
  floorMin: number;
  floorMax: number;
  isBoss?: boolean;
  bossTitle?: string;
}

export interface EnemyAbility {
  name: string;
  type: 'heal' | 'summon' | 'ranged_attack' | 'aoe' | 'buff' | 'teleport';
  value: number;
  cooldown: number;
  range?: number;
}

// --- Enemy Instance (alive on the map) ---
export interface EnemyInstance {
  defId: string;
  pos: Pos;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  statusEffects: StatusEffect[];
  lastSeenPlayer?: Pos;
  abilityCooldowns: Record<string, number>;
  stunned: boolean;
}

// --- Player State ---
export interface PlayerState {
  pos: Pos;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  atk: number;
  def: number;
  level: number;
  xp: number;
  xpToNext: number;
  inventory: ItemInstance[];
  maxInventory: number;
  equipment: {
    weapon: ItemInstance | null;
    armor: ItemInstance | null;
    accessory: ItemInstance | null;
  };
  statusEffects: StatusEffect[];
  keys: number;
}

// --- Dungeon Floor ---
export interface DungeonFloor {
  width: number;
  height: number;
  tiles: Tile[][];
  rooms: Room[];
  explored: boolean[][]; // tiles the player has seen
  visible: boolean[][]; // tiles currently in FOV
}

export interface Room {
  x: number;
  y: number;
  w: number;
  h: number;
  centerX: number;
  centerY: number;
}

// --- Game Log Entry ---
export interface LogEntry {
  text: string;
  type: 'info' | 'combat' | 'pickup' | 'levelup' | 'death' | 'boss' | 'system';
  turn: number;
}

// --- Biome System ---
export type BiomeType = 'shallow_caves' | 'fungal_forest' | 'crystal_caverns' | 'lava_depths' | 'the_abyss';

export interface BiomeDefinition {
  id: BiomeType;
  name: string;
  floorRange: [number, number]; // e.g. [1, 6]
  description: string;
  tileColors: {
    wall: string;
    floor: string;
    floorChar: string;
    accent: string; // for mushrooms, crystals, etc.
    water: string;
    fog: string;
  };
  ambientColor: string; // glow color
  enemyPool: string[]; // enemy def IDs
  decorTile: Tile; // biome-specific decoration tile
  decorChance: number;
}

// --- Meta-progression ---
export interface MetaProgression {
  souls: number;
  totalSoulsEarned: number;
  upgrades: Record<string, number>; // upgradeId -> level
  unlockedClasses: string[];
  achievements: Record<string, boolean>; // achievementId -> unlocked
  achievementProgress: Record<string, number>; // for progressive achievements
  totalRuns: number;
  bestScore: number;
  bestFloor: number;
  totalKills: number;
}

export interface MetaUpgrade {
  id: string;
  name: string;
  icon: string;
  description: string;
  maxLevel: number;
  baseCost: number;
  costScaling: number; // multiplier per level
  effect: { stat: 'maxHp' | 'atk' | 'def' | 'maxInventory' | 'viewRadius' | 'soulBonus' | 'startingItem'; value: number };
}

export interface Achievement {
  id: string;
  name: string;
  icon: string;
  description: string;
  requirement: { type: 'kills' | 'floor' | 'score' | 'boss_kills' | 'items_used' | 'runs' | 'souls_earned' | 'class_unlock' | 'special'; value: number; enemyId?: string };
  reward: { type: 'souls' | 'unlock_class' | 'unlock_item' | 'title'; value: number | string };
  hidden?: boolean;
}

export interface PlayerClass {
  id: string;
  name: string;
  icon: string;
  description: string;
  baseStats: { hp: number; mp: number; atk: number; def: number };
  startingItem?: string;
  passive: string; // description of passive ability
  passiveEffect: { type: 'crit_chance' | 'heal_bonus' | 'xp_bonus' | 'vision' | 'dodge' | 'thorns'; value: number };
}

// --- Full Game State ---
export interface GameState {
  player: PlayerState;
  floor: DungeonFloor;
  floorNumber: number;
  enemies: EnemyInstance[];
  items: ItemInstance[];
  turnCount: number;
  gameLog: LogEntry[];
  gameOver: boolean;
  victory: boolean;
  score: number;
  killCount: number;
  deepestFloor: number;
  startTime: number;
  biome: BiomeType;
  classId: string;
  soulsEarned: number; // for this run
  isEndless: boolean;
}

// --- High Score ---
export interface HighScore {
  score: number;
  floor: number;
  level: number;
  kills: number;
  turns: number;
  causeOfDeath: string;
  date: number;
  className: string;
}

// --- Direction ---
export type Direction = 'up' | 'down' | 'left' | 'right' | 'upleft' | 'upright' | 'downleft' | 'downright' | 'wait' | 'descend';

export const DIR_OFFSETS: Record<Direction, Pos> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  upleft: { x: -1, y: -1 },
  upright: { x: 1, y: -1 },
  downleft: { x: -1, y: 1 },
  downright: { x: 1, y: 1 },
  wait: { x: 0, y: 0 },
  descend: { x: 0, y: 0 },
};
