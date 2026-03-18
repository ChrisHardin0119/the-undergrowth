// ============================================
// THE UNDERGROWTH — Meta-Progression System
// Souls, upgrades, achievements, and unlockable classes
// ============================================

import { MetaProgression, MetaUpgrade, Achievement, PlayerClass, GameState, PlayerState } from './types';

const STORAGE_KEY = 'undergrowth_meta';

// ============================================
// PERMANENT UPGRADES
// ============================================

export const META_UPGRADES: MetaUpgrade[] = [
  {
    id: 'vitality',
    name: 'Vitality',
    icon: '❤️',
    description: 'Increases max HP',
    maxLevel: 10,
    baseCost: 50,
    costScaling: 1.5,
    effect: { stat: 'maxHp', value: 5 },
  },
  {
    id: 'might',
    name: 'Might',
    icon: '⚔️',
    description: 'Increases base attack power',
    maxLevel: 8,
    baseCost: 60,
    costScaling: 1.6,
    effect: { stat: 'atk', value: 1 },
  },
  {
    id: 'fortitude',
    name: 'Fortitude',
    icon: '🛡️',
    description: 'Increases base defense',
    maxLevel: 8,
    baseCost: 60,
    costScaling: 1.6,
    effect: { stat: 'def', value: 1 },
  },
  {
    id: 'deep_pockets',
    name: 'Deep Pockets',
    icon: '👜',
    description: 'Increases inventory capacity',
    maxLevel: 5,
    baseCost: 40,
    costScaling: 1.8,
    effect: { stat: 'maxInventory', value: 1 },
  },
  {
    id: 'eagle_eyes',
    name: 'Eagle Eyes',
    icon: '👁️',
    description: 'Increases vision radius',
    maxLevel: 3,
    baseCost: 70,
    costScaling: 1.7,
    effect: { stat: 'viewRadius', value: 1 },
  },
  {
    id: 'soul_magnet',
    name: 'Soul Magnet',
    icon: '✨',
    description: 'Increases soul collection rate',
    maxLevel: 5,
    baseCost: 80,
    costScaling: 1.5,
    effect: { stat: 'soulBonus', value: 10 }, // 10% per level
  },
  {
    id: 'starting_kit',
    name: 'Starting Kit',
    icon: '📦',
    description: 'Start with a helpful item',
    maxLevel: 3,
    baseCost: 50,
    costScaling: 2.0,
    effect: { stat: 'startingItem', value: 1 },
  },
  {
    id: 'second_wind',
    name: 'Second Wind',
    icon: '💨',
    description: 'Chance to survive a killing blow',
    maxLevel: 3,
    baseCost: 100,
    costScaling: 1.5,
    effect: { stat: 'maxHp', value: 10 }, // represents 10% per level towards 30%
  },
  {
    id: 'lucky_find',
    name: 'Lucky Find',
    icon: '🍀',
    description: 'Increases item drop rate',
    maxLevel: 5,
    baseCost: 60,
    costScaling: 1.5,
    effect: { stat: 'maxHp', value: 5 }, // placeholder
  },
  {
    id: 'quick_learner',
    name: 'Quick Learner',
    icon: '📚',
    description: 'Increases experience gain',
    maxLevel: 5,
    baseCost: 70,
    costScaling: 1.6,
    effect: { stat: 'maxHp', value: 5 }, // represents 10% per level
  },
];

// ============================================
// UNLOCKABLE PLAYER CLASSES
// ============================================

export const PLAYER_CLASSES: PlayerClass[] = [
  {
    id: 'explorer',
    name: 'Explorer',
    icon: '🧗',
    description: 'A balanced wanderer of the undergrowth. Well-rounded in all aspects.',
    baseStats: { hp: 20, mp: 10, atk: 4, def: 2 },
    startingItem: 'healing_moss',
    passive: 'Deep Learning: Gain 10% bonus experience',
    passiveEffect: { type: 'xp_bonus', value: 10 },
  },
  {
    id: 'warrior',
    name: 'Warrior',
    icon: '⚔️',
    description: 'A mighty fighter who excels in combat. High HP and attack, lower defense.',
    baseStats: { hp: 28, mp: 5, atk: 6, def: 1 },
    startingItem: 'stone_knife',
    passive: 'Battle Hardened: 10% chance to critical strike',
    passiveEffect: { type: 'crit_chance', value: 10 },
  },
  {
    id: 'shadow',
    name: 'Shadow',
    icon: '👤',
    description: 'A nimble assassin. Low HP but high damage and evasion.',
    baseStats: { hp: 14, mp: 8, atk: 7, def: 1 },
    startingItem: 'bone_club',
    passive: 'Evasion: 15% chance to dodge incoming damage',
    passiveEffect: { type: 'dodge', value: 15 },
  },
  {
    id: 'mycologist',
    name: 'Mycologist',
    icon: '🍄',
    description: 'A fungal scholar. Balanced stats with high mana and enhanced healing.',
    baseStats: { hp: 18, mp: 16, atk: 3, def: 3 },
    startingItem: 'healing_moss',
    passive: 'Regeneration: Heal 50% more from items',
    passiveEffect: { type: 'heal_bonus', value: 50 },
  },
  {
    id: 'warden',
    name: 'Warden',
    icon: '🛡️',
    description: 'A stalwart protector. High HP and defense, but lower damage.',
    baseStats: { hp: 30, mp: 8, atk: 2, def: 4 },
    startingItem: 'bark_vest',
    passive: 'Thorns: Reflect 3 damage when struck',
    passiveEffect: { type: 'thorns', value: 3 },
  },
];

// ============================================
// ACHIEVEMENTS
// ============================================

export const ACHIEVEMENTS: Achievement[] = [
  // Combat milestones
  {
    id: 'first_blood',
    name: 'First Blood',
    icon: '🩸',
    description: 'Kill your first enemy',
    requirement: { type: 'kills', value: 1 },
    reward: { type: 'souls', value: 25 },
  },
  {
    id: 'rat_king',
    name: 'Rat King',
    icon: '🐀',
    description: 'Kill 50 cave rats',
    requirement: { type: 'kills', value: 50, enemyId: 'cave_rat' },
    reward: { type: 'souls', value: 100 },
  },
  {
    id: 'mass_slayer',
    name: 'Mass Slayer',
    icon: '⚔️',
    description: 'Kill 500 enemies',
    requirement: { type: 'kills', value: 500 },
    reward: { type: 'souls', value: 300 },
  },

  // Floor progression
  {
    id: 'deep_diver_1',
    name: 'Deep Diver I',
    icon: '⬇️',
    description: 'Reach floor 10',
    requirement: { type: 'floor', value: 10 },
    reward: { type: 'souls', value: 150 },
  },
  {
    id: 'deep_diver_2',
    name: 'Deep Diver II',
    icon: '⬇️',
    description: 'Reach floor 20',
    requirement: { type: 'floor', value: 20 },
    reward: { type: 'souls', value: 300 },
  },
  {
    id: 'deep_diver_3',
    name: 'Deep Diver III',
    icon: '⬇️',
    description: 'Reach floor 30 and complete the game',
    requirement: { type: 'floor', value: 30 },
    reward: { type: 'souls', value: 500 },
  },

  // Boss encounters
  {
    id: 'boss_slayer_shallow',
    name: 'Slayer of the Shallow Depths',
    icon: '👑',
    description: 'Defeat the boss of Shallow Caves',
    requirement: { type: 'boss_kills', value: 1, enemyId: 'boss_brood_mother' },
    reward: { type: 'souls', value: 200 },
  },
  {
    id: 'boss_slayer_fungal',
    name: 'Mycelium Slayer',
    icon: '👑',
    description: 'Defeat the boss of Fungal Forest',
    requirement: { type: 'boss_kills', value: 1, enemyId: 'boss_mother_spore' },
    reward: { type: 'souls', value: 250 },
  },
  {
    id: 'boss_slayer_crystal',
    name: 'Gem Breaker',
    icon: '👑',
    description: 'Defeat the boss of Crystal Caverns',
    requirement: { type: 'boss_kills', value: 1, enemyId: 'boss_crystal_king' },
    reward: { type: 'souls', value: 300 },
  },
  {
    id: 'boss_slayer_lava',
    name: 'Magma Master',
    icon: '👑',
    description: 'Defeat the boss of Lava Depths',
    requirement: { type: 'boss_kills', value: 1, enemyId: 'boss_infernal' },
    reward: { type: 'souls', value: 350 },
  },
  {
    id: 'boss_slayer_abyss',
    name: 'Void Conqueror',
    icon: '👑',
    description: 'Defeat the final boss of The Abyss',
    requirement: { type: 'boss_kills', value: 1, enemyId: 'boss_abyssal_maw' },
    reward: { type: 'souls', value: 500 },
  },

  // Inventory management
  {
    id: 'hoarder',
    name: 'Hoarder',
    icon: '💰',
    description: 'Fill your inventory to maximum capacity',
    requirement: { type: 'special', value: 1 },
    reward: { type: 'souls', value: 50 },
  },

  // Speed challenges
  {
    id: 'speed_runner',
    name: 'Speed Runner',
    icon: '⚡',
    description: 'Complete the game in under 500 turns',
    requirement: { type: 'runs', value: 500 },
    reward: { type: 'souls', value: 200 },
    hidden: true,
  },

  // Score milestones
  {
    id: 'score_1k',
    name: 'Millstone',
    icon: '1️⃣',
    description: 'Reach a score of 1,000',
    requirement: { type: 'score', value: 1000 },
    reward: { type: 'souls', value: 75 },
  },
  {
    id: 'score_5k',
    name: 'Five-fold Victory',
    icon: '5️⃣',
    description: 'Reach a score of 5,000',
    requirement: { type: 'score', value: 5000 },
    reward: { type: 'souls', value: 200 },
  },
  {
    id: 'score_10k',
    name: 'Ten-fold Mastery',
    icon: '🔟',
    description: 'Reach a score of 10,000',
    requirement: { type: 'score', value: 10000 },
    reward: { type: 'souls', value: 300 },
  },
  {
    id: 'score_50k',
    name: 'Legendary Adventurer',
    icon: '✨',
    description: 'Reach a score of 50,000',
    requirement: { type: 'score', value: 50000 },
    reward: { type: 'souls', value: 500 },
    hidden: true,
  },

  // Soul milestones
  {
    id: 'soul_millionaire',
    name: 'Soul Collector',
    icon: '🔮',
    description: 'Earn 1,000 total souls across all runs',
    requirement: { type: 'souls_earned', value: 1000 },
    reward: { type: 'souls', value: 100 },
  },

  // Class unlocks
  {
    id: 'class_warrior',
    name: 'Warrior Unlocked',
    icon: '⚔️',
    description: 'Unlock the Warrior class',
    requirement: { type: 'class_unlock', value: 1 },
    reward: { type: 'unlock_class', value: 'warrior' },
  },
  {
    id: 'class_shadow',
    name: 'Shadow Unlocked',
    icon: '👤',
    description: 'Unlock the Shadow class',
    requirement: { type: 'class_unlock', value: 1 },
    reward: { type: 'unlock_class', value: 'shadow' },
  },
  {
    id: 'class_mycologist',
    name: 'Mycologist Unlocked',
    icon: '🍄',
    description: 'Unlock the Mycologist class',
    requirement: { type: 'class_unlock', value: 1 },
    reward: { type: 'unlock_class', value: 'mycologist' },
  },
  {
    id: 'class_warden',
    name: 'Warden Unlocked',
    icon: '🛡️',
    description: 'Unlock the Warden class',
    requirement: { type: 'class_unlock', value: 1 },
    reward: { type: 'unlock_class', value: 'warden' },
  },
  {
    id: 'all_classes_unlocked',
    name: 'Master of Many',
    icon: '🌟',
    description: 'Unlock all player classes',
    requirement: { type: 'special', value: 5 },
    reward: { type: 'souls', value: 200 },
  },

  // Special challenges
  {
    id: 'pacifist_floor',
    name: 'Peaceful Passage',
    icon: '☮️',
    description: 'Clear an entire floor without killing any enemies',
    requirement: { type: 'special', value: 1 },
    reward: { type: 'souls', value: 150 },
    hidden: true,
  },
];

// ============================================
// META-PROGRESSION FUNCTIONS
// ============================================

/**
 * Load meta-progression from localStorage
 */
export function loadMeta(): MetaProgression {
  if (typeof window === 'undefined') {
    return getDefaultMeta();
  }

  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    return getDefaultMeta();
  }

  try {
    const parsed = JSON.parse(stored);
    // Backward-compatible merging with new fields
    return {
      souls: parsed.souls ?? 0,
      totalSoulsEarned: parsed.totalSoulsEarned ?? 0,
      upgrades: parsed.upgrades ?? {},
      unlockedClasses: parsed.unlockedClasses ?? ['explorer'],
      achievements: parsed.achievements ?? {},
      achievementProgress: parsed.achievementProgress ?? {},
      totalRuns: parsed.totalRuns ?? 0,
      bestScore: parsed.bestScore ?? 0,
      bestFloor: parsed.bestFloor ?? 0,
      totalKills: parsed.totalKills ?? 0,
    };
  } catch {
    return getDefaultMeta();
  }
}

/**
 * Get default meta-progression state
 */
function getDefaultMeta(): MetaProgression {
  return {
    souls: 0,
    totalSoulsEarned: 0,
    upgrades: {},
    unlockedClasses: ['explorer'],
    achievements: {},
    achievementProgress: {},
    totalRuns: 0,
    bestScore: 0,
    bestFloor: 0,
    totalKills: 0,
  };
}

/**
 * Save meta-progression to localStorage
 */
export function saveMeta(meta: MetaProgression): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(meta));
}

/**
 * Get the cost to purchase/upgrade an upgrade
 */
export function getUpgradeCost(upgrade: MetaUpgrade, currentLevel: number): number {
  if (currentLevel >= upgrade.maxLevel) return 0;
  return Math.floor(upgrade.baseCost * Math.pow(upgrade.costScaling, currentLevel));
}

/**
 * Purchase an upgrade, returns updated meta or null if not affordable
 */
export function purchaseUpgrade(meta: MetaProgression, upgradeId: string): MetaProgression | null {
  const upgrade = META_UPGRADES.find(u => u.id === upgradeId);
  if (!upgrade) return null;

  const currentLevel = meta.upgrades[upgradeId] ?? 0;
  if (currentLevel >= upgrade.maxLevel) return null;

  const cost = getUpgradeCost(upgrade, currentLevel);
  if (meta.souls < cost) return null;

  return {
    ...meta,
    souls: meta.souls - cost,
    upgrades: {
      ...meta.upgrades,
      [upgradeId]: currentLevel + 1,
    },
  };
}

/**
 * Unlock a class, returns updated meta or null if not affordable
 */
export function unlockClass(meta: MetaProgression, classId: string): MetaProgression | null {
  const playerClass = PLAYER_CLASSES.find(c => c.id === classId);
  if (!playerClass || meta.unlockedClasses.includes(classId)) return null;

  // Determine cost based on class
  const classCosts: Record<string, number> = {
    warrior: 100,
    shadow: 200,
    mycologist: 300,
    warden: 500,
  };

  const cost = classCosts[classId] ?? 500;
  if (meta.souls < cost) return null;

  return {
    ...meta,
    souls: meta.souls - cost,
    unlockedClasses: [...meta.unlockedClasses, classId],
  };
}

/**
 * Apply meta bonuses to player stats
 */
export function applyMetaBonuses(baseStats: PlayerState, meta: MetaProgression, classId: string): PlayerState {
  const playerClass = PLAYER_CLASSES.find(c => c.id === classId);
  if (!playerClass) return baseStats;

  let stats = { ...baseStats };

  // Apply upgrade bonuses
  for (const [upgradeId, level] of Object.entries(meta.upgrades)) {
    const upgrade = META_UPGRADES.find(u => u.id === upgradeId);
    if (!upgrade || !level) continue;

    const bonusPerLevel = upgrade.effect.value * level;

    switch (upgrade.effect.stat) {
      case 'maxHp':
        stats.maxHp += bonusPerLevel;
        stats.hp = Math.min(stats.hp + bonusPerLevel, stats.maxHp);
        break;
      case 'atk':
        stats.atk += bonusPerLevel;
        break;
      case 'def':
        stats.def += bonusPerLevel;
        break;
      case 'maxInventory':
        stats.maxInventory += bonusPerLevel;
        break;
      case 'viewRadius':
        // Handled separately in vision code
        break;
      case 'soulBonus':
        // Applied during soul calculation
        break;
      case 'startingItem':
        // Handled during item spawn
        break;
    }
  }

  return stats;
}

/**
 * Check and unlock achievements based on current game state
 */
export function checkAchievements(
  meta: MetaProgression,
  state: GameState
): { meta: MetaProgression; newAchievements: Achievement[] } {
  const newAchievements: Achievement[] = [];
  let updatedMeta = { ...meta };
  updatedMeta.achievementProgress = { ...meta.achievementProgress };
  updatedMeta.achievements = { ...meta.achievements };

  for (const achievement of ACHIEVEMENTS) {
    if (updatedMeta.achievements[achievement.id]) continue; // Already unlocked

    let isUnlocked = false;

    const { type, value, enemyId } = achievement.requirement;

    switch (type) {
      case 'kills':
        const enemyKills = enemyId
          ? updatedMeta.achievementProgress[`kills_${enemyId}`] ?? 0
          : state.killCount;
        isUnlocked = enemyKills >= value;
        break;

      case 'floor':
        isUnlocked = state.deepestFloor >= value;
        break;

      case 'score':
        isUnlocked = state.score >= value;
        break;

      case 'boss_kills':
        const bossKills = updatedMeta.achievementProgress[`boss_kills_${enemyId}`] ?? 0;
        isUnlocked = bossKills >= value;
        break;

      case 'runs':
        isUnlocked = updatedMeta.totalRuns >= value;
        break;

      case 'souls_earned':
        isUnlocked = updatedMeta.totalSoulsEarned >= value;
        break;

      case 'class_unlock':
        isUnlocked = updatedMeta.unlockedClasses.length >= value;
        break;

      case 'special':
        // Special achievements need manual triggering
        // They're checked elsewhere in game code
        break;
    }

    if (isUnlocked) {
      updatedMeta.achievements[achievement.id] = true;
      newAchievements.push(achievement);

      // Award souls
      if (achievement.reward.type === 'souls') {
        updatedMeta.souls += achievement.reward.value as number;
      }

      // Auto-unlock classes
      if (achievement.reward.type === 'unlock_class') {
        const classToUnlock = achievement.reward.value as string;
        if (!updatedMeta.unlockedClasses.includes(classToUnlock)) {
          updatedMeta.unlockedClasses.push(classToUnlock);
        }
      }
    }
  }

  return { meta: updatedMeta, newAchievements };
}

/**
 * Calculate souls earned from a completed run
 */
export function calculateSoulsEarned(state: GameState): number {
  let souls = 0;

  // Base score contribution (every 100 points = 1 soul, capped at 100 souls from score)
  souls += Math.min(Math.floor(state.score / 100), 100);

  // Floor bonus (1 soul per floor)
  souls += state.deepestFloor;

  // Kill bonus (1 soul per 5 kills)
  souls += Math.floor(state.killCount / 5);

  // Victory bonus
  if (state.victory) {
    souls += 50;
  }

  return Math.max(1, souls); // At least 1 soul
}
