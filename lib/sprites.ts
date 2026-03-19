// Player class sprites
export const CLASS_SPRITES: Record<string, string> = {
  explorer: '/sprites/frames/elf_f_idle_anim_f0.png',
  warrior: '/sprites/frames/knight_m_idle_anim_f0.png',
  shadow: '/sprites/frames/lizard_m_idle_anim_f0.png',
  mycologist: '/sprites/frames/wizzard_f_idle_anim_f0.png',
  warden: '/sprites/frames/dwarf_m_idle_anim_f0.png',
};

// Enemy sprites - map enemy defId to sprite path
export const ENEMY_SPRITES: Record<string, string> = {
  // Shallow Caves
  cave_rat: '/sprites/frames/tiny_zombie_idle_anim_f0.png',
  glow_beetle: '/sprites/frames/tiny_slug_anim_f0.png',
  spore_bat: '/sprites/frames/imp_idle_anim_f0.png',
  mushroom_walker: '/sprites/frames/muddy_anim_f0.png',
  acid_slug: '/sprites/frames/slug_anim_f0.png',
  cave_spider: '/sprites/frames/goblin_idle_anim_f0.png',
  // Fungal Forest
  toxic_toadstool: '/sprites/frames/swampy_anim_f0.png',
  spore_cloud: '/sprites/frames/necromancer_anim_f0.png',
  fungal_brute: '/sprites/frames/ogre_idle_anim_f0.png',
  vine_strangler: '/sprites/frames/wogol_idle_anim_f0.png',
  mycoid_shaman: '/sprites/frames/orc_shaman_idle_anim_f0.png',
  // Crystal Caverns
  crystal_golem: '/sprites/frames/masked_orc_idle_anim_f0.png',
  phantom_spore: '/sprites/frames/zombie_anim_f1.png',
  prism_spider: '/sprites/frames/ice_zombie_anim_f0.png',
  shard_elemental: '/sprites/frames/chort_idle_anim_f0.png',
  crystal_sentinel: '/sprites/frames/orc_warrior_idle_anim_f0.png',
  // Lava Depths
  magma_slug: '/sprites/frames/slug_anim_f0.png',
  fire_imp: '/sprites/frames/imp_idle_anim_f0.png',
  obsidian_golem: '/sprites/frames/big_zombie_idle_anim_f0.png',
  flame_wraith: '/sprites/frames/necromancer_anim_f0.png',
  lava_serpent: '/sprites/frames/swampy_anim_f0.png',
  // The Abyss
  shadow_stalker: '/sprites/frames/chort_idle_anim_f0.png',
  void_tendril: '/sprites/frames/muddy_anim_f0.png',
  abyssal_eye: '/sprites/frames/pumpkin_dude_idle_anim_f0.png',
  deep_crawler: '/sprites/frames/big_zombie_idle_anim_f0.png',
  eldritch_horror: '/sprites/frames/big_demon_idle_anim_f0.png',
  // Bosses
  brood_mother: '/sprites/frames/big_zombie_idle_anim_f0.png',
  mother_spore: '/sprites/frames/ogre_idle_anim_f0.png',
  crystal_king: '/sprites/frames/angel_idle_anim_f0.png',
  the_infernal: '/sprites/frames/big_demon_idle_anim_f0.png',
  abyssal_maw: '/sprites/frames/big_demon_idle_anim_f0.png',
};

// Tile sprites
export const TILE_SPRITES: Record<string, string> = {
  floor: '/sprites/frames/floor_1.png',
  stairs: '/sprites/frames/floor_stairs.png',
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
  return ENEMY_SPRITES[defId] || '/sprites/frames/zombie_anim_f1.png';
}

export function getClassSprite(classId: string): string {
  return CLASS_SPRITES[classId] || '/sprites/frames/elf_f_idle_anim_f0.png';
}

export function getItemTypeSprite(type: string): string {
  return ITEM_SPRITES[type] || '/sprites/frames/flask_red.png';
}
