// Player class sprites
export const CLASS_SPRITES: Record<string, string> = {
  explorer: '/sprites/frames/elf_f_idle_anim_f0.png',     // Elf - nimble explorer
  warrior: '/sprites/frames/knight_m_idle_anim_f0.png',    // Knight - tanky warrior
  shadow: '/sprites/frames/lizard_m_idle_anim_f0.png',     // Lizard - stealthy shadow
  mycologist: '/sprites/frames/wizzard_f_idle_anim_f0.png', // Wizard - magic mycologist
  warden: '/sprites/frames/dwarf_m_idle_anim_f0.png',      // Dwarf - sturdy warden
};

// Enemy sprites - map enemy defId to sprite path
// Using only 16x16 sprites to avoid clipping in square tiles
export const ENEMY_SPRITES: Record<string, string> = {
  // Shallow Caves (weak enemies - small sprites)
  cave_rat: '/sprites/frames/tiny_zombie_idle_anim_f0.png',     // tiny creature = rat
  glow_beetle: '/sprites/frames/tiny_slug_anim_f0.png',         // tiny slug = beetle
  spore_bat: '/sprites/frames/imp_idle_anim_f0.png',            // imp = flying bat
  mushroom_walker: '/sprites/frames/muddy_anim_f0.png',         // muddy blob = mushroom
  acid_slug: '/sprites/frames/slug_anim_f0.png',                // slug = slug (perfect)
  cave_spider: '/sprites/frames/goblin_idle_anim_f0.png',       // goblin = spider

  // Fungal Forest (mid-tier)
  toxic_toadstool: '/sprites/frames/swampy_anim_f0.png',        // swampy = toadstool
  spore_cloud: '/sprites/frames/necromancer_anim_f0.png',       // necromancer = spore cloud
  fungal_brute: '/sprites/frames/masked_orc_idle_anim_f0.png',  // masked orc = brute (16x20)
  vine_strangler: '/sprites/frames/wogol_idle_anim_f0.png',     // wogol = vine creature (16x20)
  mycoid_shaman: '/sprites/frames/orc_shaman_idle_anim_f0.png', // orc shaman = shaman (16x20)

  // Crystal Caverns (stronger)
  crystal_golem: '/sprites/frames/ice_zombie_anim_f0.png',      // ice zombie = crystal golem
  phantom_spore: '/sprites/frames/necromancer_anim_f0.png',     // necromancer = phantom
  prism_spider: '/sprites/frames/goblin_idle_anim_f0.png',      // goblin = spider variant
  shard_elemental: '/sprites/frames/chort_idle_anim_f0.png',    // chort = elemental (16x24)
  crystal_sentinel: '/sprites/frames/orc_warrior_idle_anim_f0.png', // orc warrior = sentinel (16x20)

  // Lava Depths (fire themed)
  magma_slug: '/sprites/frames/slug_anim_f0.png',               // slug = magma slug
  fire_imp: '/sprites/frames/imp_idle_anim_f0.png',             // imp = fire imp (perfect)
  obsidian_golem: '/sprites/frames/skelet_idle_anim_f0.png',    // skeleton = golem
  flame_wraith: '/sprites/frames/pumpkin_dude_idle_anim_f0.png', // pumpkin = wraith
  lava_serpent: '/sprites/frames/swampy_anim_f0.png',           // swampy = serpent

  // The Abyss (dark/void themed)
  shadow_stalker: '/sprites/frames/chort_idle_anim_f0.png',     // chort = shadow demon (16x24)
  void_tendril: '/sprites/frames/muddy_anim_f0.png',            // muddy = tendril
  abyssal_eye: '/sprites/frames/pumpkin_dude_idle_anim_f0.png', // pumpkin = eye
  deep_crawler: '/sprites/frames/skelet_idle_anim_f0.png',      // skeleton = crawler
  eldritch_horror: '/sprites/frames/big_demon_idle_anim_f0.png', // big demon = horror (32x36)

  // Bosses (big sprites are OK for bosses - they should look imposing)
  brood_mother: '/sprites/frames/big_zombie_idle_anim_f0.png',  // big zombie = brood mother
  mother_spore: '/sprites/frames/ogre_idle_anim_f0.png',        // ogre = mother spore (32x36)
  crystal_king: '/sprites/frames/angel_idle_anim_f0.png',       // angel = crystal king (32x36)
  the_infernal: '/sprites/frames/big_demon_idle_anim_f0.png',   // big demon = infernal (32x36)
  abyssal_maw: '/sprites/frames/big_demon_idle_anim_f0.png',    // big demon = maw (32x36)
};

// Tile sprites
export const TILE_SPRITES: Record<string, string> = {
  floor: '/sprites/frames/floor_1.png',
  stairs: '/sprites/frames/floor_ladder.png',
  door: '/sprites/frames/doors_leaf_closed.png',
  chest: '/sprites/frames/chest_full_open_anim_f0.png',
  wall: '/sprites/frames/wall_mid.png',
};

// Item sprites (for items on the ground)
export const ITEM_SPRITES: Record<string, string> = {
  consumable: '/sprites/frames/flask_red.png',
  equipment: '/sprites/frames/weapon_regular_sword.png',
  scroll: '/sprites/frames/flask_blue.png',
  key: '/sprites/frames/coin_anim_f0.png',
};

export function getEnemySprite(defId: string): string {
  return ENEMY_SPRITES[defId] || '/sprites/frames/skelet_idle_anim_f0.png';
}

export function getClassSprite(classId: string): string {
  return CLASS_SPRITES[classId] || '/sprites/frames/elf_f_idle_anim_f0.png';
}

export function getItemTypeSprite(type: string): string {
  return ITEM_SPRITES[type] || '/sprites/frames/flask_red.png';
}
