// ============================================
// THE UNDERGROWTH — Biome System
// Five distinct biomes with unique visual identity and enemy pools
// ============================================

import { BiomeDefinition, BiomeType, Tile } from './types';

export const BIOMES: BiomeDefinition[] = [
  {
    id: 'shallow_caves',
    name: 'Shallow Caves',
    floorRange: [1, 6],
    description: 'The entrance to the undergrowth. Cyan-lit caverns with basic cave critters.',
    tileColors: {
      wall: '#4a7c7e',      // muted cyan-gray
      floor: '#2d5a5d',      // darker cyan
      floorChar: '·',
      accent: '#6ba3a5',     // light cyan
      water: '#5ba9b5',      // cyan water
      fog: 'rgba(91, 169, 181, 0.1)', // transparent cyan fog
    },
    ambientColor: '#5ba9b5', // cyan glow
    enemyPool: ['cave_rat', 'glow_beetle', 'spore_bat', 'mushroom_walker', 'acid_slug', 'cave_spider'],
    decorTile: Tile.Mushroom,
    decorChance: 0.08,
  },
  {
    id: 'fungal_forest',
    name: 'Fungal Forest',
    floorRange: [7, 12],
    description: 'A dense biomass of bioluminescent fungi. Twisted vines and sentient toadstools.',
    tileColors: {
      wall: '#4a5f2e',       // dark olive-green
      floor: '#5a7a3a',      // green
      floorChar: '.',
      accent: '#8fc93a',     // lime green
      water: '#6b8e3a',      // greenish water
      fog: 'rgba(143, 201, 58, 0.1)', // transparent green fog
    },
    ambientColor: '#8fc93a', // green glow
    enemyPool: ['toxic_toadstool', 'spore_cloud', 'fungal_brute', 'vine_strangler', 'mycoid_shaman'],
    decorTile: Tile.Vine,
    decorChance: 0.12,
  },
  {
    id: 'crystal_caverns',
    name: 'Crystal Caverns',
    floorRange: [13, 18],
    description: 'Towering crystalline formations refract light into kaleidoscopic patterns. Guarded by ancient golems.',
    tileColors: {
      wall: '#2d3f5a',       // dark blue-gray
      floor: '#3d5a7a',      // blue-gray
      floorChar: '✦',
      accent: '#6ba3d5',     // bright cyan-blue
      water: '#5a8ac9',      // blue water
      fog: 'rgba(107, 163, 213, 0.1)', // transparent blue fog
    },
    ambientColor: '#6ba3d5', // blue glow
    enemyPool: ['crystal_golem', 'phantom_spore', 'prism_spider', 'shard_elemental', 'crystal_sentinel'],
    decorTile: Tile.Crystal,
    decorChance: 0.15,
  },
  {
    id: 'lava_depths',
    name: 'Lava Depths',
    floorRange: [19, 24],
    description: 'Molten rivers flow through volcanic stone. Ancient fire creatures roam the superheated air.',
    tileColors: {
      wall: '#5a3a1a',       // dark brown
      floor: '#6a4a2a',      // brown
      floorChar: '~',
      accent: '#ff6b3a',     // bright orange-red
      water: '#ff8844',      // orange lava
      fog: 'rgba(255, 107, 58, 0.1)', // transparent orange fog
    },
    ambientColor: '#ff6b3a', // orange-red glow
    enemyPool: ['magma_slug', 'fire_imp', 'obsidian_golem', 'flame_wraith', 'lava_serpent'],
    decorTile: Tile.Lava,
    decorChance: 0.10,
  },
  {
    id: 'the_abyss',
    name: 'The Abyss',
    floorRange: [25, 30],
    description: 'The deepest darkness. Void-touched creatures and bones of forgotten worlds.',
    tileColors: {
      wall: '#1a1a2e',       // deep purple-black
      floor: '#2a1a3e',      // dark purple
      floorChar: '·',
      accent: '#8b5a9d',     // deep purple
      water: '#4a2a6a',      // dark purple water
      fog: 'rgba(139, 90, 157, 0.1)', // transparent purple fog
    },
    ambientColor: '#8b5a9d', // purple glow
    enemyPool: ['shadow_stalker', 'void_tendril', 'abyssal_eye', 'deep_crawler', 'eldritch_horror'],
    decorTile: Tile.BoneFloor,
    decorChance: 0.18,
  },
];

/**
 * Get the biome definition for a given floor number
 */
export function getBiomeForFloor(floor: number): BiomeDefinition {
  // For endless mode (floor > 30), cycle through biomes
  const effectiveFloor = floor > 30 ? ((floor - 1) % 30) + 1 : floor;
  const biome = BIOMES.find(b => effectiveFloor >= b.floorRange[0] && effectiveFloor <= b.floorRange[1]);
  if (!biome) {
    return BIOMES[BIOMES.length - 1]; // fallback to Abyss
  }
  return biome;
}

/**
 * Get CSS custom property overrides for a biome
 * Returns a record of CSS variable names to hex/rgb values
 */
export function getBiomeCSS(biome: BiomeType): Record<string, string> {
  const biomeDef = BIOMES.find(b => b.id === biome);
  if (!biomeDef) {
    throw new Error(`Unknown biome: ${biome}`);
  }

  return {
    '--biome-wall': biomeDef.tileColors.wall,
    '--biome-floor': biomeDef.tileColors.floor,
    '--biome-accent': biomeDef.tileColors.accent,
    '--biome-water': biomeDef.tileColors.water,
    '--biome-fog': biomeDef.tileColors.fog,
    '--biome-glow': biomeDef.ambientColor,
    '--biome-floor-char': `"${biomeDef.tileColors.floorChar}"`,
  };
}
