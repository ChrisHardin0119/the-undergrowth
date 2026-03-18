// ============================================
// THE UNDERGROWTH — Core Game Engine (Updated)
// Handles state transitions, combat, AI, items
// Integrated: Biomes, Classes, Meta System
// ============================================

import {
  GameState, PlayerState, EnemyInstance, ItemInstance,
  Direction, DIR_OFFSETS, Tile, LogEntry, StatusEffect, Pos, BiomeType,
} from './types';
import { generateFloor, findSpawnPos, findRandomWalkable, isWalkable, inBounds, rng, rngInt, pick } from './dungeon';
import { getEnemyDef, getItemDef, getEnemiesForFloor, getBossForFloor, getItemsForFloor, scaleEnemyStats, ITEMS } from './entities';
import { computeFOV, revealMap, hasLOS, distance } from './fov';
import { getBiomeForFloor } from './biomes';
import { PLAYER_CLASSES, applyMetaBonuses, loadMeta, META_UPGRADES } from './meta';

// --- XP curve ---
function xpForLevel(level: number): number {
  return Math.floor(20 * Math.pow(level, 1.8));
}

// --- Boss floors: 6, 12, 18, 24, 30 (and repeats every 6 in endless) ---
function isBossFloor(floorNum: number): boolean {
  if (floorNum <= 30) {
    return [6, 12, 18, 24, 30].includes(floorNum);
  }
  // Endless: bosses repeat every 6 floors
  const offset = floorNum - 30;
  return (offset % 6) === 0;
}

// --- Create initial game state ---
export function createNewGame(classId: string = 'explorer'): GameState {
  // Load class definition
  const playerClass = PLAYER_CLASSES.find(c => c.id === classId) || PLAYER_CLASSES[0];

  // Initialize floor and player position
  const floor = generateFloor(1);
  const startRoom = floor.rooms[0];
  const playerPos = { x: startRoom.centerX, y: startRoom.centerY };

  // Create base player from class
  const player: PlayerState = {
    pos: playerPos,
    hp: playerClass.baseStats.hp,
    maxHp: playerClass.baseStats.hp,
    mp: playerClass.baseStats.mp,
    maxMp: playerClass.baseStats.mp,
    atk: playerClass.baseStats.atk,
    def: playerClass.baseStats.def,
    level: 1,
    xp: 0,
    xpToNext: xpForLevel(2),
    inventory: [],
    maxInventory: 12,
    equipment: { weapon: null, armor: null, accessory: null },
    statusEffects: [],
    keys: 0,
  };

  // Load meta and apply bonuses
  const meta = loadMeta();
  const playerWithMetaBonuses = applyMetaBonuses(player, meta, classId);

  // Add starting item from class
  let startingItems: ItemInstance[] = [];
  if (playerClass.startingItem) {
    startingItems.push({ defId: playerClass.startingItem });
  }

  // Add starting items from meta 'starting_kit' upgrade
  const startingKitLevel = meta.upgrades['starting_kit'] || 0;
  if (startingKitLevel >= 1) {
    startingItems.push({ defId: 'healing_moss' });
  }
  if (startingKitLevel >= 2) {
    startingItems.push({ defId: 'strength_lichen' });
  }
  if (startingKitLevel >= 3) {
    startingItems.push({ defId: 'stone_knife' });
  }

  const playerWithStartingItems = {
    ...playerWithMetaBonuses,
    inventory: startingItems,
  };

  // Compute initial FOV
  computeFOV(floor, playerPos.x, playerPos.y);

  // Place enemies and items
  const enemies = spawnEnemies(floor, 1, [playerPos]);
  const items = spawnItems(floor, 1, [playerPos, ...enemies.map(e => e.pos)]);

  // Get biome for floor 1
  const biome = getBiomeForFloor(1);

  const state: GameState = {
    player: playerWithStartingItems,
    floor,
    floorNumber: 1,
    enemies,
    items,
    turnCount: 0,
    gameLog: [
      { text: `You descend into the Undergrowth as a ${playerClass.name}...`, type: 'system', turn: 0 },
      { text: 'The bioluminescent glow reveals a network of caves ahead.', type: 'system', turn: 0 },
      { text: 'Use WASD or arrow keys to move. Bump into enemies to attack.', type: 'info', turn: 0 },
    ],
    gameOver: false,
    victory: false,
    score: 0,
    killCount: 0,
    deepestFloor: 1,
    startTime: Date.now(),
    biome: biome.id,
    classId,
    soulsEarned: 0,
    isEndless: false,
  };

  return state;
}

// --- Spawn enemies on a floor ---
function spawnEnemies(floor: ReturnType<typeof generateFloor>, floorNum: number, occupied: Pos[]): EnemyInstance[] {
  const enemies: EnemyInstance[] = [];
  const available = getEnemiesForFloor(floorNum);
  if (available.length === 0) return enemies;

  const numEnemies = Math.min(floor.rooms.length * 2, 4 + Math.floor(floorNum * 1.2));

  // Place regular enemies (skip first room — that's the player's start)
  for (let i = 0; i < numEnemies; i++) {
    const roomIdx = rngInt(1, floor.rooms.length - 1);
    const room = floor.rooms[roomIdx];
    const pos = findSpawnPos(floor, room, [...occupied, ...enemies.map(e => e.pos)]);
    if (!pos) continue;

    const def = pick(available);
    const stats = scaleEnemyStats(def, floorNum);
    enemies.push({
      defId: def.id,
      pos,
      hp: stats.hp,
      maxHp: stats.hp,
      atk: stats.atk,
      def: stats.def,
      statusEffects: [],
      abilityCooldowns: {},
      stunned: false,
    });
  }

  // Place boss if it's a boss floor
  const boss = getBossForFloor(floorNum);
  if (boss) {
    const lastRoom = floor.rooms[floor.rooms.length - 1];
    // Place boss near stairs
    const bossPos = findSpawnPos(floor, lastRoom, [...occupied, ...enemies.map(e => e.pos)]);
    if (bossPos) {
      const stats = scaleEnemyStats(boss, floorNum);
      enemies.push({
        defId: boss.id,
        pos: bossPos,
        hp: stats.hp,
        maxHp: stats.hp,
        atk: stats.atk,
        def: stats.def,
        statusEffects: [],
        abilityCooldowns: {},
        stunned: false,
      });
    }
  }

  return enemies;
}

// --- Spawn items on a floor ---
function spawnItems(floor: ReturnType<typeof generateFloor>, floorNum: number, occupied: Pos[]): ItemInstance[] {
  const items: ItemInstance[] = [];
  const available = getItemsForFloor(floorNum);
  if (available.length === 0) return items;

  const numItems = 3 + Math.floor(floorNum * 0.5);

  for (let i = 0; i < numItems; i++) {
    const roomIdx = rngInt(0, floor.rooms.length - 1);
    const room = floor.rooms[roomIdx];
    const pos = findSpawnPos(floor, room, [...occupied, ...items.filter(it => it.pos).map(it => it.pos!)]);
    if (!pos) continue;

    // Weight by rarity
    const weights = available.map(it => {
      switch (it.rarity) {
        case 'common': return 10;
        case 'uncommon': return 5;
        case 'rare': return 2;
        case 'legendary': return 0.5;
      }
    });
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    let roll = rng() * totalWeight;
    let chosen = available[0];
    for (let j = 0; j < available.length; j++) {
      roll -= weights[j];
      if (roll <= 0) { chosen = available[j]; break; }
    }

    items.push({ defId: chosen.id, pos });
  }

  // Always place at least one healing item on floor 1
  if (floorNum === 1 && !items.some(i => i.defId === 'health_moss')) {
    const room = floor.rooms[rngInt(0, Math.min(2, floor.rooms.length - 1))];
    const pos = findSpawnPos(floor, room, [...occupied, ...items.filter(it => it.pos).map(it => it.pos!)]);
    if (pos) items.push({ defId: 'health_moss', pos });
  }

  return items;
}

// --- Get effective player stats (base + equipment + class passive) ---
export function getEffectiveStats(player: PlayerState): { atk: number; def: number; maxHp: number } {
  let atk = player.atk;
  let def = player.def;
  let maxHp = player.maxHp;

  // Equipment bonuses
  for (const slot of ['weapon', 'armor', 'accessory'] as const) {
    const equip = player.equipment[slot];
    if (equip) {
      const itemDef = getItemDef(equip.defId);
      if (itemDef) {
        atk += itemDef.atkBonus || 0;
        def += itemDef.defBonus || 0;
        maxHp += itemDef.hpBonus || 0;
      }
    }
  }

  // Status effect bonuses
  for (const effect of player.statusEffects) {
    if (effect.type === 'strength') atk += effect.value;
    if (effect.type === 'shield') def += effect.value;
  }

  return { atk, def, maxHp };
}

// --- Process a player action ---
export function processAction(state: GameState, direction: Direction): GameState {
  if (state.gameOver) return state;

  // Handle descending to next floor
  if (direction === 'descend') {
    const tile = state.floor.tiles[state.player.pos.y][state.player.pos.x];
    if (tile === Tile.StairsDown) {
      return descendFloor(state);
    }
    return state;
  }

  const newState = { ...state };
  const offset = DIR_OFFSETS[direction];
  const newX = state.player.pos.x + offset.x;
  const newY = state.player.pos.y + offset.y;
  const log: LogEntry[] = [];
  const turn = state.turnCount + 1;

  // Waiting in place
  if (direction === 'wait') {
    log.push({ text: 'You wait...', type: 'info', turn });
    return finalizeTurn({ ...newState, turnCount: turn, gameLog: [...state.gameLog, ...log] }, log);
  }

  // Bounds check
  if (!inBounds(newX, newY, state.floor)) return state;

  const tile = state.floor.tiles[newY][newX];

  // Wall — can't move
  if (tile === Tile.Wall) return state;

  // Water — walkable but slow (skip enemy turn? or just flavor)
  if (tile === Tile.Water) {
    log.push({ text: 'You wade through shallow water.', type: 'info', turn });
  }

  // Check for enemy at destination
  const enemyIdx = state.enemies.findIndex(e => e.pos.x === newX && e.pos.y === newY && e.hp > 0);
  if (enemyIdx >= 0) {
    // COMBAT — bump attack
    return processCombat(newState, enemyIdx, turn, log);
  }

  // Move player
  const newPlayer = { ...state.player, pos: { x: newX, y: newY } };
  newState.player = newPlayer;

  // Check for items at new position
  const itemIdx = state.items.findIndex(i => i.pos && i.pos.x === newX && i.pos.y === newY);
  if (itemIdx >= 0) {
    const item = state.items[itemIdx];
    const def = getItemDef(item.defId);
    if (def) {
      if (def.type === 'key') {
        newState.player = { ...newPlayer, keys: newPlayer.keys + 1 };
        newState.items = state.items.filter((_, idx) => idx !== itemIdx);
        log.push({ text: `Picked up ${def.icon} ${def.name}!`, type: 'pickup', turn });
      } else if (def.type === 'consumable' || def.type === 'scroll') {
        // Check if same defId exists in inventory (stacking)
        const existingIdx = newPlayer.inventory.findIndex(invItem => invItem.defId === item.defId);
        if (existingIdx >= 0) {
          // Stack: just remove from ground, inventory stays as-is (UI groups by defId)
          newState.items = state.items.filter((_, idx) => idx !== itemIdx);
          log.push({ text: `Picked up ${def.icon} ${def.name}`, type: 'pickup', turn });
          newState.player = newPlayer;
        } else if (newPlayer.inventory.length < newPlayer.maxInventory) {
          // Add new stack
          newState.player = {
            ...newPlayer,
            inventory: [...newPlayer.inventory, { defId: item.defId }],
          };
          newState.items = state.items.filter((_, idx) => idx !== itemIdx);
          log.push({ text: `Picked up ${def.icon} ${def.name}`, type: 'pickup', turn });
        } else {
          log.push({ text: `Inventory full! Can't pick up ${def.name}.`, type: 'info', turn });
        }
      } else if (newPlayer.inventory.length < newPlayer.maxInventory) {
        newState.player = {
          ...newPlayer,
          inventory: [...newPlayer.inventory, { defId: item.defId }],
        };
        newState.items = state.items.filter((_, idx) => idx !== itemIdx);
        log.push({ text: `Picked up ${def.icon} ${def.name}`, type: 'pickup', turn });
      } else {
        log.push({ text: `Inventory full! Can't pick up ${def.name}.`, type: 'info', turn });
      }
    }
  }

  // Check for stairs
  if (tile === Tile.StairsDown) {
    log.push({ text: 'You see stairs leading deeper...', type: 'info', turn });
  }

  // Recompute FOV
  computeFOV(newState.floor, newX, newY);

  return finalizeTurn({
    ...newState,
    turnCount: turn,
    gameLog: [...state.gameLog, ...log],
  }, log);
}

// --- Process combat (player attacks enemy) ---
function processCombat(state: GameState, enemyIdx: number, turn: number, log: LogEntry[]): GameState {
  const newState = { ...state };
  const enemy = { ...state.enemies[enemyIdx] };
  const enemyDef = getEnemyDef(enemy.defId);
  const playerStats = getEffectiveStats(state.player);
  const playerClass = PLAYER_CLASSES.find(c => c.id === state.classId);

  // Player attacks with crit chance
  let rawDmg = Math.max(1, playerStats.atk - enemy.def + rngInt(-1, 2));

  // Apply crit chance from class passive
  if (playerClass && playerClass.passiveEffect.type === 'crit_chance') {
    if (rng() < (playerClass.passiveEffect.value / 100)) {
      rawDmg *= 2;
      log.push({ text: '⚡ CRITICAL HIT!', type: 'combat', turn });
    }
  }

  enemy.hp -= rawDmg;
  log.push({
    text: `You hit ${enemyDef?.icon || '?'} ${enemyDef?.name || 'enemy'} for ${rawDmg} damage!`,
    type: 'combat',
    turn,
  });

  if (enemy.hp <= 0) {
    // Enemy defeated
    const xpGain = enemyDef?.xpReward || 10;

    // Apply xp_bonus from class passive
    let actualXpGain = xpGain;
    if (playerClass && playerClass.passiveEffect.type === 'xp_bonus') {
      const bonusMultiplier = 1 + (playerClass.passiveEffect.value / 100);
      actualXpGain = Math.floor(xpGain * bonusMultiplier);
    }

    log.push({
      text: `${enemyDef?.icon || '?'} ${enemyDef?.name || 'enemy'} defeated! (+${actualXpGain} XP)`,
      type: 'combat',
      turn,
    });

    // Calculate souls earned: 1 soul per 10 XP
    let soulsEarned = Math.floor(xpGain / 10);

    // Apply soul_magnet meta upgrade bonus
    const meta = loadMeta();
    const soulMagnetLevel = meta.upgrades['soul_magnet'] || 0;
    if (soulMagnetLevel > 0) {
      const soulBonus = 1 + (soulMagnetLevel * 0.1);
      soulsEarned = Math.floor(soulsEarned * soulBonus);
    }

    // Drop items
    if (enemyDef?.drops) {
      for (const drop of enemyDef.drops) {
        if (rng() < drop.chance) {
          const dropDef = getItemDef(drop.itemId);
          if (dropDef) {
            newState.items = [...state.items, { defId: drop.itemId, pos: { ...enemy.pos } }];
            log.push({ text: `${enemyDef.icon} dropped ${dropDef.icon} ${dropDef.name}!`, type: 'pickup', turn });
          }
        }
      }
    }

    // Remove dead enemy
    const newEnemies = [...state.enemies];
    newEnemies.splice(enemyIdx, 1);
    newState.enemies = newEnemies;
    newState.killCount = state.killCount + 1;
    newState.score = state.score + (enemyDef?.xpReward || 10) * 10;
    newState.soulsEarned = state.soulsEarned + soulsEarned;

    // Grant XP and check for level up
    newState.player = grantXP(state.player, actualXpGain, log, turn);

    // Boss kill — special message
    if (enemyDef?.isBoss) {
      log.push({ text: `⚔️ BOSS DEFEATED: ${enemyDef.bossTitle}! ⚔️`, type: 'boss', turn });
      newState.score += 500;
      newState.soulsEarned = state.soulsEarned + soulsEarned + 50; // bonus souls for boss

      // Final boss at floor 30: check if player wants to continue or victory
      if (state.floorNumber === 30 && enemyDef.id === 'boss_abyssal_maw') {
        log.push({ text: '🏆 YOU HAVE CONQUERED THE UNDERGROWTH! 🏆', type: 'boss', turn });
        log.push({ text: 'Continue descending into the endless depths?', type: 'system', turn });
        newState.victory = true;
        newState.score += 5000;
      } else if (enemyDef.id === 'boss_abyssal_maw' && newState.isEndless) {
        // Endless mode: defeated abyssal maw again
        log.push({ text: `⚔️ ${enemyDef.bossTitle} falls once more! ⚔️`, type: 'boss', turn });
      }
    }
  } else {
    // Enemy survives — update in array
    const newEnemies = [...state.enemies];
    newEnemies[enemyIdx] = enemy;
    newState.enemies = newEnemies;
  }

  return finalizeTurn({
    ...newState,
    turnCount: turn,
    gameLog: [...state.gameLog, ...log],
  }, log);
}


// --- Grant XP and handle level ups ---
function grantXP(player: PlayerState, xp: number, log: LogEntry[], turn: number): PlayerState {
  let p = { ...player, xp: player.xp + xp };

  while (p.xp >= p.xpToNext) {
    p.xp -= p.xpToNext;
    p.level += 1;
    p.xpToNext = xpForLevel(p.level + 1);

    // Stat gains per level
    const hpGain = 5 + Math.floor(p.level * 0.5);
    const atkGain = p.level % 2 === 0 ? 1 : 0;
    const defGain = p.level % 3 === 0 ? 1 : 0;

    p.maxHp += hpGain;
    p.hp = p.maxHp; // Full heal on level up
    p.atk += atkGain;
    p.def += defGain;
    p.maxMp += 2;
    p.mp = p.maxMp;

    log.push({
      text: `🎉 LEVEL UP! You are now level ${p.level}! (+${hpGain} HP${atkGain ? `, +${atkGain} ATK` : ''}${defGain ? `, +${defGain} DEF` : ''})`,
      type: 'levelup',
      turn,
    });
  }

  return p;
}

// --- Finalize turn: enemy AI + status effects ---
function finalizeTurn(state: GameState, log: LogEntry[]): GameState {
  if (state.gameOver || state.victory) return state;

  let newState = { ...state };
  const turn = state.turnCount;
  const newLog: LogEntry[] = [];

  // Process enemy turns
  newState = processEnemyTurns(newState, newLog, turn);

  // Process status effects
  newState = processStatusEffects(newState, newLog, turn);

  // Check player death
  if (newState.player.hp <= 0) {
    newState.gameOver = true;
    newLog.push({ text: '💀 You have perished in the Undergrowth...', type: 'death', turn });
  }

  return {
    ...newState,
    gameLog: [...newState.gameLog, ...newLog],
  };
}

// --- Enemy AI ---
function processEnemyTurns(state: GameState, log: LogEntry[], turn: number): GameState {
  let newState = { ...state };
  const newEnemies = [...state.enemies];
  const playerClass = PLAYER_CLASSES.find(c => c.id === state.classId);

  for (let i = 0; i < newEnemies.length; i++) {
    const enemy = { ...newEnemies[i] };
    if (enemy.hp <= 0 || enemy.stunned) {
      enemy.stunned = false;
      newEnemies[i] = enemy;
      continue;
    }

    const def = getEnemyDef(enemy.defId);
    if (!def) continue;

    // Speed check (slow enemies skip turns)
    if (def.speed > 1 && turn % def.speed !== 0) continue;

    const playerPos = newState.player.pos;
    const dist = distance(enemy.pos.x, enemy.pos.y, playerPos.x, playerPos.y);
    const canSeePlayer = hasLOS(state.floor, enemy.pos.x, enemy.pos.y, playerPos.x, playerPos.y) && dist <= 8;

    if (canSeePlayer) {
      enemy.lastSeenPlayer = { ...playerPos };
    }

    // Boss abilities
    if (def.behavior === 'boss' && def.abilities && canSeePlayer) {
      for (const ability of def.abilities) {
        const cd = enemy.abilityCooldowns[ability.name] || 0;
        if (cd <= 0 && dist <= (ability.range || 1)) {
          // Use ability
          const result = useEnemyAbility(newState, enemy, ability, log, turn);
          newState = result.state;
          enemy.abilityCooldowns[ability.name] = ability.cooldown;
          newEnemies[i] = enemy;
          continue;
        }
      }
    }

    // Reduce cooldowns
    for (const key of Object.keys(enemy.abilityCooldowns)) {
      if (enemy.abilityCooldowns[key] > 0) enemy.abilityCooldowns[key]--;
    }

    // Movement / attack AI
    if (dist === 1 && canSeePlayer) {
      // Adjacent to player — attack!
      const playerStats = getEffectiveStats(newState.player);
      let rawDmg = Math.max(1, enemy.atk - playerStats.def + rngInt(-1, 1));

      // Apply player dodge from class passive
      if (playerClass && playerClass.passiveEffect.type === 'dodge') {
        if (rng() < (playerClass.passiveEffect.value / 100)) {
          rawDmg = 0;
          log.push({ text: `${def.icon} ${def.name} attacks but you dodge!`, type: 'combat', turn });
        }
      }

      // Apply thorns reflection from class passive
      if (playerClass && playerClass.passiveEffect.type === 'thorns' && rawDmg > 0) {
        const thornDmg = playerClass.passiveEffect.value;
        enemy.hp -= thornDmg;
        log.push({ text: `${def.icon} ${def.name} is hurt by your thorns! (${thornDmg} dmg)`, type: 'combat', turn });
      }

      newState.player = { ...newState.player, hp: newState.player.hp - rawDmg };
      if (rawDmg > 0) {
        log.push({
          text: `${def.icon} ${def.name} hits you for ${rawDmg} damage!`,
          type: 'combat',
          turn,
        });
      }
    } else if (canSeePlayer && (def.behavior === 'chase' || def.behavior === 'boss')) {
      // Move toward player
      const moved = moveToward(enemy, playerPos, state.floor, newEnemies, newState.player.pos);
      if (moved) enemy.pos = moved;
    } else if (enemy.lastSeenPlayer && (def.behavior === 'chase' || def.behavior === 'boss')) {
      // Move toward last known position
      const moved = moveToward(enemy, enemy.lastSeenPlayer, state.floor, newEnemies, newState.player.pos);
      if (moved) {
        enemy.pos = moved;
        if (enemy.pos.x === enemy.lastSeenPlayer.x && enemy.pos.y === enemy.lastSeenPlayer.y) {
          enemy.lastSeenPlayer = undefined;
        }
      }
    } else if (def.behavior === 'wander' || def.behavior === 'patrol') {
      // Random movement
      const dirs = [{ x: 0, y: -1 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 1, y: 0 }];
      const shuffled = dirs.sort(() => rng() - 0.5);
      for (const d of shuffled) {
        const nx = enemy.pos.x + d.x;
        const ny = enemy.pos.y + d.y;
        if (inBounds(nx, ny, state.floor) && isWalkable(state.floor.tiles[ny][nx])) {
          if (!newEnemies.some((e, idx) => idx !== i && e.pos.x === nx && e.pos.y === ny && e.hp > 0)) {
            if (nx !== newState.player.pos.x || ny !== newState.player.pos.y) {
              enemy.pos = { x: nx, y: ny };
              break;
            }
          }
        }
      }
    } else if (def.behavior === 'ambush' && canSeePlayer && dist <= 3) {
      // Ambush: only chase when very close
      const moved = moveToward(enemy, playerPos, state.floor, newEnemies, newState.player.pos);
      if (moved) enemy.pos = moved;
    }

    newEnemies[i] = enemy;
  }

  return { ...newState, enemies: newEnemies };
}

// --- Move enemy toward a target ---
function moveToward(
  enemy: EnemyInstance,
  target: Pos,
  floor: ReturnType<typeof generateFloor>,
  allEnemies: EnemyInstance[],
  playerPos: Pos
): Pos | null {
  const dx = target.x - enemy.pos.x;
  const dy = target.y - enemy.pos.y;

  // Try to move in the direction of the target
  const candidates: Pos[] = [];
  if (dx !== 0) candidates.push({ x: enemy.pos.x + Math.sign(dx), y: enemy.pos.y });
  if (dy !== 0) candidates.push({ x: enemy.pos.x, y: enemy.pos.y + Math.sign(dy) });
  // Also try diagonal
  if (dx !== 0 && dy !== 0) {
    candidates.push({ x: enemy.pos.x + Math.sign(dx), y: enemy.pos.y + Math.sign(dy) });
  }

  for (const c of candidates) {
    if (!inBounds(c.x, c.y, floor)) continue;
    if (!isWalkable(floor.tiles[c.y][c.x])) continue;
    if (c.x === playerPos.x && c.y === playerPos.y) continue; // Don't walk onto player (attack handled separately)
    if (allEnemies.some(e => e.pos.x === c.x && e.pos.y === c.y && e.hp > 0 && e !== enemy)) continue;
    return c;
  }
  return null;
}

// --- Enemy ability usage ---
function useEnemyAbility(
  state: GameState,
  enemy: EnemyInstance,
  ability: { name: string; type: string; value: number; range?: number },
  log: LogEntry[],
  turn: number
): { state: GameState } {
  const def = getEnemyDef(enemy.defId);
  const eName = def?.icon + ' ' + def?.name || 'Enemy';

  switch (ability.type) {
    case 'ranged_attack': {
      const dmg = Math.max(1, ability.value + rngInt(-2, 2));
      const newPlayer = { ...state.player, hp: state.player.hp - dmg };
      log.push({ text: `${eName} uses ${ability.name}! ${dmg} damage!`, type: 'combat', turn });
      return { state: { ...state, player: newPlayer } };
    }
    case 'aoe': {
      const dist = distance(enemy.pos.x, enemy.pos.y, state.player.pos.x, state.player.pos.y);
      if (dist <= (ability.range || 2)) {
        const dmg = Math.max(1, ability.value + rngInt(-2, 2));
        const newPlayer = { ...state.player, hp: state.player.hp - dmg };
        log.push({ text: `${eName} uses ${ability.name}! AOE blast for ${dmg} damage!`, type: 'combat', turn });
        return { state: { ...state, player: newPlayer } };
      }
      return { state };
    }
    case 'heal': {
      const healAmt = ability.value;
      enemy.hp = Math.min(enemy.maxHp, enemy.hp + healAmt);
      log.push({ text: `${eName} regenerates ${healAmt} HP!`, type: 'combat', turn });
      return { state };
    }
    case 'summon': {
      log.push({ text: `${eName} summons minions!`, type: 'boss', turn });
      const newEnemies = [...state.enemies];
      for (let i = 0; i < ability.value; i++) {
        const pos = findRandomWalkable(state.floor, [
          state.player.pos,
          ...newEnemies.map(e => e.pos),
        ]);
        if (pos) {
          const minionDef = getEnemyDef('cave_rat') || getEnemyDef('glow_beetle');
          if (minionDef) {
            const stats = scaleEnemyStats(minionDef, state.floorNumber);
            newEnemies.push({
              defId: minionDef.id,
              pos,
              hp: stats.hp,
              maxHp: stats.hp,
              atk: stats.atk,
              def: stats.def,
              statusEffects: [],
              abilityCooldowns: {},
              stunned: false,
            });
          }
        }
      }
      return { state: { ...state, enemies: newEnemies } };
    }
    case 'teleport': {
      const pos = findRandomWalkable(state.floor, [state.player.pos, ...state.enemies.map(e => e.pos)]);
      if (pos) {
        enemy.pos = pos;
        log.push({ text: `${eName} vanishes and reappears elsewhere!`, type: 'combat', turn });
      }
      return { state };
    }
    default:
      return { state };
  }
}

// --- Process status effects ---
function processStatusEffects(state: GameState, log: LogEntry[], turn: number): GameState {
  let player = { ...state.player };
  const newEffects: StatusEffect[] = [];
  const playerClass = PLAYER_CLASSES.find(c => c.id === state.classId);

  for (const effect of player.statusEffects) {
    const remaining = { ...effect, turnsLeft: effect.turnsLeft - 1 };

    switch (effect.type) {
      case 'poison':
        player.hp -= effect.value;
        log.push({ text: `☠️ Poison deals ${effect.value} damage!`, type: 'combat', turn });
        break;
      case 'regen': {
        const playerStats = getEffectiveStats(player);
        let heal = Math.min(effect.value, playerStats.maxHp - player.hp);

        // Apply heal_bonus from class passive
        if (playerClass && playerClass.passiveEffect.type === 'heal_bonus') {
          const bonusMultiplier = 1 + (playerClass.passiveEffect.value / 100);
          heal = Math.floor(heal * bonusMultiplier);
        }

        if (heal > 0) {
          player.hp += heal;
          log.push({ text: `💚 Regeneration heals ${heal} HP.`, type: 'info', turn });
        }
        break;
      }
      case 'fire_aura': {
        // Deal damage to adjacent enemies
        const playerPos = player.pos;
        const damageDone: string[] = [];
        for (const enemy of state.enemies) {
          const dist = distance(playerPos.x, playerPos.y, enemy.pos.x, enemy.pos.y);
          if (dist === 1 && enemy.hp > 0) {
            const dmg = effect.value;
            enemy.hp -= dmg;
            const enemyDef = getEnemyDef(enemy.defId);
            damageDone.push(`${enemyDef?.name || 'enemy'}`);
          }
        }
        if (damageDone.length > 0) {
          log.push({ text: `🔥 Fire aura burns ${damageDone.join(', ')} for ${effect.value} damage!`, type: 'combat', turn });
        }
        break;
      }
      case 'cure_poison':
        // Remove poison effects
        player.statusEffects = player.statusEffects.filter(e => e.type !== 'poison');
        log.push({ text: `💊 Poison cured!`, type: 'info', turn });
        break;
      case 'invulnerable':
        // Handled in enemy attack logic
        break;
    }

    if (remaining.turnsLeft > 0) {
      newEffects.push(remaining);
    }
  }

  player.statusEffects = newEffects;
  return { ...state, player };
}

// --- Use an item from inventory ---
export function useItem(state: GameState, inventoryIdx: number): GameState {
  if (state.gameOver) return state;

  const item = state.player.inventory[inventoryIdx];
  if (!item) return state;

  const def = getItemDef(item.defId);
  if (!def) return state;

  const log: LogEntry[] = [];
  const turn = state.turnCount;
  let newState = { ...state };
  let player = { ...state.player };
  const playerClass = PLAYER_CLASSES.find(c => c.id === state.classId);

  switch (def.type) {
    case 'consumable': {
      // Heal
      if (def.healAmount) {
        let actualHeal = Math.min(def.healAmount, getEffectiveStats(player).maxHp - player.hp);

        // Apply heal_bonus from class passive
        if (playerClass && playerClass.passiveEffect.type === 'heal_bonus') {
          const bonusMultiplier = 1 + (playerClass.passiveEffect.value / 100);
          actualHeal = Math.floor(actualHeal * bonusMultiplier);
        }

        player.hp += actualHeal;
        log.push({ text: `Used ${def.icon} ${def.name}. Healed ${actualHeal} HP!`, type: 'pickup', turn });
      }
      // Apply status effect
      if (def.statusEffect) {
        player.statusEffects = [...player.statusEffects, { ...def.statusEffect }];
        log.push({ text: `${def.icon} ${def.statusEffect.type} effect applied for ${def.statusEffect.turnsLeft} turns.`, type: 'pickup', turn });
      }
      // Remove from inventory
      player.inventory = player.inventory.filter((_, idx) => idx !== inventoryIdx);
      break;
    }
    case 'scroll': {
      switch (def.scrollEffect) {
        case 'reveal_map':
          revealMap(newState.floor);
          log.push({ text: `Used ${def.icon} ${def.name}. The entire floor is revealed!`, type: 'pickup', turn });
          break;
        case 'teleport': {
          const pos = findRandomWalkable(newState.floor, [
            ...newState.enemies.map(e => e.pos),
          ]);
          if (pos) {
            player.pos = pos;
            computeFOV(newState.floor, pos.x, pos.y);
            log.push({ text: `Used ${def.icon} ${def.name}. Teleported!`, type: 'pickup', turn });
          }
          break;
        }
        case 'fireball': {
          // Damage all enemies within 2 tiles
          const newEnemies = newState.enemies.map(e => {
            const dist = distance(player.pos.x, player.pos.y, e.pos.x, e.pos.y);
            if (dist <= 2) {
              const dmg = 15 + rngInt(0, 10);
              log.push({ text: `💥 Spore bomb hits ${getEnemyDef(e.defId)?.name || 'enemy'} for ${dmg}!`, type: 'combat', turn });
              return { ...e, hp: e.hp - dmg };
            }
            return e;
          }).filter(e => {
            if (e.hp <= 0) {
              const eDef = getEnemyDef(e.defId);
              log.push({ text: `${eDef?.icon} ${eDef?.name} destroyed by the blast!`, type: 'combat', turn });
              newState.killCount++;
              newState.score += (eDef?.xpReward || 10) * 10;
              player = grantXP(player, eDef?.xpReward || 10, log, turn);
              return false;
            }
            return true;
          });
          newState.enemies = newEnemies;
          break;
        }
        case 'freeze_all': {
          newState.enemies = newState.enemies.map(e => ({
            ...e,
            stunned: true,
            statusEffects: [...e.statusEffects, { type: 'slow' as const, turnsLeft: 3, value: 0 }],
          }));
          log.push({ text: `Used ${def.icon} ${def.name}. All enemies frozen!`, type: 'pickup', turn });
          break;
        }
      }
      // Remove scroll from inventory
      player.inventory = player.inventory.filter((_, idx) => idx !== inventoryIdx);
      break;
    }
    case 'equipment': {
      // Equip item — swap with current
      const slot = def.equipSlot;
      if (!slot) break;
      const current = player.equipment[slot];
      player.equipment = { ...player.equipment, [slot]: item };
      // Put old equipment back in inventory
      if (current) {
        player.inventory = [...player.inventory.filter((_, idx) => idx !== inventoryIdx), current];
      } else {
        player.inventory = player.inventory.filter((_, idx) => idx !== inventoryIdx);
      }

      // Recalculate max HP (may have changed from equipment)
      const newStats = getEffectiveStats(player);
      if (player.hp > newStats.maxHp) player.hp = newStats.maxHp;

      const oldDef = current ? getItemDef(current.defId) : null;
      log.push({
        text: `Equipped ${def.icon} ${def.name}${oldDef ? ` (unequipped ${oldDef.icon} ${oldDef.name})` : ''}.`,
        type: 'pickup',
        turn,
      });
      break;
    }
    default:
      return state;
  }

  newState.player = player;
  return {
    ...newState,
    gameLog: [...state.gameLog, ...log],
  };
}

// --- Drop an item from inventory ---
export function dropItem(state: GameState, inventoryIdx: number): GameState {
  if (state.gameOver) return state;
  const item = state.player.inventory[inventoryIdx];
  if (!item) return state;
  const def = getItemDef(item.defId);

  const newItems = [...state.items, { defId: item.defId, pos: { ...state.player.pos } }];
  const newInventory = state.player.inventory.filter((_, idx) => idx !== inventoryIdx);

  return {
    ...state,
    player: { ...state.player, inventory: newInventory },
    items: newItems,
    gameLog: [
      ...state.gameLog,
      { text: `Dropped ${def?.icon || ''} ${def?.name || 'item'}.`, type: 'info', turn: state.turnCount },
    ],
  };
}

// --- Descend to next floor ---
export function descendFloor(state: GameState): GameState {
  const tile = state.floor.tiles[state.player.pos.y][state.player.pos.x];
  if (tile !== Tile.StairsDown) return state;

  const nextFloorNum = state.floorNumber + 1;

  // Check if this is the final boss and player wants to continue
  if (nextFloorNum === 31 && !state.isEndless) {
    // This is the transition: player has just beaten floor 30 boss
    // Set isEndless flag and continue
  }

  const newFloor = generateFloor(nextFloorNum);
  const startRoom = newFloor.rooms[0];
  const playerPos = { x: startRoom.centerX, y: startRoom.centerY };

  computeFOV(newFloor, playerPos.x, playerPos.y);

  const enemies = spawnEnemies(newFloor, nextFloorNum, [playerPos]);
  const items = spawnItems(newFloor, nextFloorNum, [playerPos, ...enemies.map(e => e.pos)]);

  // Determine if this is a boss floor
  const isBoss = isBossFloor(nextFloorNum);
  const boss = isBoss ? getBossForFloor(nextFloorNum) : null;

  const bossLog: LogEntry[] = [];
  if (boss) {
    bossLog.push({
      text: `⚠️ You sense a powerful presence on this floor... ${boss.bossTitle}`,
      type: 'boss',
      turn: state.turnCount,
    });
  }

  // Update biome based on new floor
  const newBiome = getBiomeForFloor(nextFloorNum);

  // Determine if entering endless mode
  const isNowEndless = nextFloorNum > 30 ? true : state.isEndless;

  // Add floor cleared soul bonus
  const soulsFromFloor = 10 + nextFloorNum;

  return {
    ...state,
    player: { ...state.player, pos: playerPos },
    floor: newFloor,
    floorNumber: nextFloorNum,
    enemies,
    items,
    deepestFloor: Math.max(state.deepestFloor, nextFloorNum),
    score: state.score + nextFloorNum * 50,
    soulsEarned: state.soulsEarned + soulsFromFloor,
    biome: newBiome.id,
    isEndless: isNowEndless,
    gameLog: [
      ...state.gameLog,
      { text: `You descend to floor ${nextFloorNum}${isNowEndless ? ' (Endless Mode!)' : ''}...`, type: 'system', turn: state.turnCount },
      ...bossLog,
    ],
  };
}

// --- Calculate final score ---
export function calculateScore(state: GameState): number {
  const endlessBonus = state.isEndless ? (state.deepestFloor - 30) * 500 : 0;
  return (
    state.score
    + state.killCount * 15
    + state.player.level * 100
    + state.deepestFloor * 200
    + (state.victory ? 10000 : 0)
    + endlessBonus
  );
}
