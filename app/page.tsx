'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { GameState, Tile, Direction, MetaProgression, BiomeType, Achievement } from '@/lib/types';
import { createNewGame, processAction, useItem, dropItem, getEffectiveStats, calculateScore, consumeDamageEvents } from '@/lib/gameEngine';
import { DamageEvent } from '@/lib/types';
import { getEnemyDef, getItemDef } from '@/lib/entities';
import { getBiomeForFloor, getBiomeCSS } from '@/lib/biomes';
import { loadMeta, saveMeta, checkAchievements, calculateSoulsEarned, META_UPGRADES, PLAYER_CLASSES, ACHIEVEMENTS, getUpgradeCost, unlockClass } from '@/lib/meta';
import { initAudio, sfxStep, sfxHit, sfxPlayerHurt, sfxPickup, sfxLevelUp, sfxDeath, sfxDescend, sfxBoss, sfxVictory, sfxUseItem, startAmbient, stopAmbient } from '@/lib/audio';

type ScreenType = 'menu' | 'class_select' | 'game' | 'inventory' | 'soul_shop' | 'achievements' | 'help' | 'gameover';

interface HighScoreEntry {
  score: number;
  floor: number;
  level: number;
  className: string;
  turns: number;
}

const VIEWPORT_W = 21;
const VIEWPORT_H = 15;
const MAX_HIGH_SCORES = 10;

function getTileChar(tile: Tile): string {
  switch (tile) {
    case Tile.Wall: return ' ';
    case Tile.Floor: return '·';
    case Tile.StairsDown: return '▼';
    case Tile.Door: return '🚪';
    case Tile.Water: return '~';
    case Tile.Mushroom: return '🍄';
    case Tile.Chest: return '📦';
    case Tile.Lava: return '🔥';
    case Tile.Crystal: return '💎';
    case Tile.Vine: return '🌿';
    case Tile.BoneFloor: return '·';
    case Tile.AbyssFloor: return '·';
    default: return ' ';
  }
}

function getTileClass(tile: Tile): string {
  switch (tile) {
    case Tile.Wall: return 'tile-wall';
    case Tile.Floor: return 'tile-floor';
    case Tile.StairsDown: return 'tile-stairs';
    case Tile.Door: return 'tile-door';
    case Tile.Water: return 'tile-water';
    case Tile.Mushroom: return 'tile-mushroom';
    case Tile.Chest: return 'tile-chest';
    case Tile.Lava: return 'tile-lava';
    case Tile.Crystal: return 'tile-crystal';
    case Tile.Vine: return 'tile-vine';
    case Tile.BoneFloor: return 'tile-bone';
    case Tile.AbyssFloor: return 'tile-abyss';
    default: return 'tile-wall';
  }
}

export default function GamePage() {
  const [screen, setScreen] = useState<ScreenType>('menu');
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [meta, setMeta] = useState<MetaProgression | null>(null);
  const [selectedClass, setSelectedClass] = useState<string>('warrior');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [highScores, setHighScores] = useState<HighScoreEntry[]>([]);
  const [newlyUnlockedAchievements, setNewlyUnlockedAchievements] = useState<Achievement[]>([]);
  const [showMinimap, setShowMinimap] = useState(false);
  const [damageEvents, setDamageEvents] = useState<DamageEvent[]>([]);
  const damageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Helper to collect damage events after a game action
  const collectDamageEvents = () => {
    const events = consumeDamageEvents();
    if (events.length > 0) {
      setDamageEvents(prev => [...prev, ...events]);
      // Clear events after animation duration
      if (damageTimerRef.current) clearTimeout(damageTimerRef.current);
      damageTimerRef.current = setTimeout(() => {
        setDamageEvents([]);
      }, 800);
    }
  };

  // Load meta and high scores on mount
  useEffect(() => {
    initAudio();
    const loadedMeta = loadMeta();
    setMeta(loadedMeta);

    const scores = localStorage.getItem('undergrowth_scores');
    if (scores) {
      setHighScores(JSON.parse(scores));
    }
  }, []);

  // Keyboard handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();

      // Inventory toggle (I key) - works on game and inventory screens
      if (key === 'i' && (screen === 'game' || screen === 'inventory')) {
        e.preventDefault();
        setScreen(screen === 'inventory' ? 'game' : 'inventory');
        return;
      }

      // Escape - back from inventory or help to game
      if (key === 'escape' && (screen === 'inventory' || screen === 'help')) {
        e.preventDefault();
        setScreen('game');
        return;
      }

      // Only process game keys if on game screen
      if (screen !== 'game' || !gameState) return;

      const { player, floor } = gameState;

      let direction: Direction | null = null;

      // Cardinal directions
      if (key === 'w' || key === 'arrowup') {
        e.preventDefault();
        direction = 'up';
      } else if (key === 's' || key === 'arrowdown') {
        e.preventDefault();
        direction = 'down';
      } else if (key === 'a' || key === 'arrowleft') {
        e.preventDefault();
        direction = 'left';
      } else if (key === 'd' || key === 'arrowright') {
        e.preventDefault();
        direction = 'right';
      }
      // Diagonals
      else if (key === 'q') {
        e.preventDefault();
        direction = 'upleft';
      } else if (key === 'e') {
        e.preventDefault();
        direction = 'upright';
      } else if (key === 'z') {
        e.preventDefault();
        direction = 'downleft';
      } else if (key === 'c') {
        e.preventDefault();
        direction = 'downright';
      }
      // Wait
      else if (key === ' ' || key === '.') {
        e.preventDefault();
        direction = 'wait';
      }
      // Descend (Enter or >)
      else if (key === 'enter' || key === '>') {
        e.preventDefault();
        direction = 'descend';
      }
      // Minimap (M)
      else if (key === 'm') {
        e.preventDefault();
        setShowMinimap(!showMinimap);
        return;
      }
      // Help (H or ?)
      else if (key === 'h' || key === '?') {
        e.preventDefault();
        setScreen('help');
        return;
      }

      if (direction) {
        const newState = processAction(gameState, direction);
        setGameState(newState);
        collectDamageEvents();

        // Sound effects and game over check
        if (soundEnabled) {
          // Check for kills
          const killedEnemies = gameState.enemies.filter((e, i) => e.hp > 0 && (newState.enemies[i]?.hp ?? 0) <= 0);
          if (killedEnemies.length > 0) {
            sfxHit();
            killedEnemies.forEach(e => {
              const eDef = getEnemyDef(e.defId);
              if (eDef?.isBoss) sfxBoss();
            });
          }

          // Check for damage taken
          if (newState.player.hp < gameState.player.hp) {
            sfxPlayerHurt();
          }

          // Check for items picked up
          if (newState.player.inventory.length > gameState.player.inventory.length) {
            sfxPickup();
          }

          // Check for level up
          if (newState.player.level > gameState.player.level) {
            sfxLevelUp();
          }

          // Check for movement
          if ((newState.player.pos.x !== gameState.player.pos.x || newState.player.pos.y !== gameState.player.pos.y) && direction !== 'wait') {
            sfxStep();
          }
        }

        if (newState.gameOver) {
          if (soundEnabled) {
            sfxDeath();
            stopAmbient();
          }
          handleGameEnd(newState);
        } else if (newState.victory && !gameState.victory) {
          // First time achieving victory — play fanfare but don't end
          if (soundEnabled) sfxVictory();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [screen, gameState, soundEnabled]);

  const handleGameEnd = (finalState: GameState) => {
    const souls = calculateSoulsEarned(finalState);
    const currentMeta = meta || loadMeta();

    // Track boss kills in achievement progress (check game log for boss defeats)
    const bossIds = ['boss_brood_mother', 'boss_mother_spore', 'boss_crystal_king', 'boss_infernal', 'boss_abyssal_maw'];
    const updatedProgress = { ...currentMeta.achievementProgress };
    for (const entry of finalState.gameLog) {
      if (entry.type === 'boss' && entry.text.includes('BOSS DEFEATED')) {
        for (const bossId of bossIds) {
          const bossDef = getEnemyDef(bossId);
          if (bossDef && entry.text.includes(bossDef.bossTitle || '')) {
            updatedProgress[`boss_kills_${bossId}`] = (updatedProgress[`boss_kills_${bossId}`] || 0) + 1;
          }
        }
      }
    }
    currentMeta.achievementProgress = updatedProgress;

    const { meta: updatedMeta, newAchievements } = checkAchievements(currentMeta, finalState);

    updatedMeta.totalRuns++;
    updatedMeta.totalKills += finalState.killCount;
    updatedMeta.souls += souls;
    updatedMeta.totalSoulsEarned += souls;

    const finalScore = calculateScore(finalState);
    updatedMeta.bestScore = Math.max(updatedMeta.bestScore, finalScore);
    updatedMeta.bestFloor = Math.max(updatedMeta.bestFloor, finalState.deepestFloor);

    saveMeta(updatedMeta);
    setMeta(updatedMeta);
    setNewlyUnlockedAchievements(newAchievements);

    // Save high score
    const classObj = PLAYER_CLASSES.find(c => c.id === finalState.classId);
    const newScore: HighScoreEntry = {
      score: finalScore,
      floor: finalState.deepestFloor,
      level: finalState.player.level,
      className: classObj?.name || 'Unknown',
      turns: finalState.turnCount,
    };

    const updated = [newScore, ...highScores].sort((a, b) => b.score - a.score).slice(0, MAX_HIGH_SCORES);
    setHighScores(updated);
    localStorage.setItem('undergrowth_scores', JSON.stringify(updated));

    setScreen('gameover');
  };

  const handleMobileInput = useCallback((dir: Direction) => {
    if (!gameState || screen !== 'game') return;
    const newState = processAction(gameState, dir);
    setGameState(newState);
    collectDamageEvents();

    if (soundEnabled) {
      if (newState.player.hp < gameState.player.hp) sfxPlayerHurt();
      if (newState.player.inventory.length > gameState.player.inventory.length) sfxPickup();
      if (newState.player.level > gameState.player.level) sfxLevelUp();
      if ((newState.player.pos.x !== gameState.player.pos.x || newState.player.pos.y !== gameState.player.pos.y) && dir !== 'wait') sfxStep();
    }

    if (newState.gameOver) {
      if (soundEnabled) { sfxDeath(); stopAmbient(); }
      handleGameEnd(newState);
    } else if (newState.victory && !gameState.victory) {
      if (soundEnabled) sfxVictory();
    }
  }, [gameState, screen, soundEnabled]);

  const startNewGame = (classId: string) => {
    if (soundEnabled) startAmbient();
    const newGame = createNewGame(classId);
    setGameState(newGame);
    setSelectedClass(classId);
    setShowMinimap(false);
    setScreen('game');
  };

  // === RENDER FUNCTIONS ===

  const renderMenu = () => {
    return (
      <div className="screen screen-menu">
        <div className="menu-header">
          <div className="menu-title">🍄 THE UNDERGROWTH 🍄</div>
          <div className="menu-subtitle">A Roguelike Dungeon Crawler</div>
        </div>

        <div className="menu-buttons">
          <button className="btn btn-primary" onClick={() => setScreen('class_select')}>
            NEW GAME
          </button>
          <button className="btn btn-secondary" onClick={() => setScreen('soul_shop')}>
            SOUL SHOP
          </button>
          <button className="btn btn-secondary" onClick={() => setScreen('achievements')}>
            ACHIEVEMENTS
          </button>
          <button className="btn btn-secondary" onClick={() => setScreen('help')}>
            HOW TO PLAY
          </button>
          <button className="btn btn-secondary" onClick={() => setSoundEnabled(!soundEnabled)}>
            {soundEnabled ? '🔊 SOUND ON' : '🔇 SOUND OFF'}
          </button>
        </div>

        <div className="menu-stats">
          <div className="stat-line">Souls: {meta?.souls || 0}</div>
          <div className="stat-line">Total Runs: {meta?.totalRuns || 0}</div>
          <div className="stat-line">Best Floor: {meta?.bestFloor || 0}</div>
          <div className="stat-line">Best Score: {meta?.bestScore || 0}</div>
        </div>

        {highScores.length > 0 && (
          <div className="high-scores">
            <h3>High Scores</h3>
            {highScores.map((score, i) => (
              <div key={i} className="score-line">
                {i + 1}. {score.className} - {score.score} pts (Floor {score.floor}, Lv{score.level})
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderClassSelect = () => {
    return (
      <div className="screen screen-class-select">
        <h1>SELECT YOUR CLASS</h1>
        <div className="class-grid">
          {PLAYER_CLASSES.map(cls => {
            const isLocked = !meta?.unlockedClasses.includes(cls.id);
            const isSelected = selectedClass === cls.id;

            return (
              <div key={cls.id} className={`class-card ${isSelected ? 'selected' : ''} ${isLocked ? 'locked' : ''}`}>
                <div className="class-icon">{cls.icon}</div>
                <div className="class-name">{cls.name}</div>
                <div className="class-desc">{cls.description}</div>
                <div className="class-stats">
                  <div>HP: {cls.baseStats.hp}</div>
                  <div>MP: {cls.baseStats.mp}</div>
                  <div>ATK: {cls.baseStats.atk}</div>
                  <div>DEF: {cls.baseStats.def}</div>
                </div>
                <div className="class-passive">{cls.passive}</div>

                {isLocked ? (
                  <div className="lock-info">🔒 Locked (Cost: {cls.baseStats.hp * 100} souls)</div>
                ) : (
                  <button
                    className={`btn btn-small ${isSelected ? 'btn-selected' : ''}`}
                    onClick={() => setSelectedClass(cls.id)}
                  >
                    SELECT
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div className="class-buttons">
          <button
            className={`btn btn-primary ${!meta?.unlockedClasses.includes(selectedClass) ? 'btn-disabled' : ''}`}
            disabled={!meta?.unlockedClasses.includes(selectedClass)}
            onClick={() => {
              if (meta?.unlockedClasses.includes(selectedClass)) {
                startNewGame(selectedClass);
              }
            }}
          >
            START GAME
          </button>
          <button className="btn btn-secondary" onClick={() => setScreen('menu')}>
            BACK
          </button>
        </div>
      </div>
    );
  };

  const renderGame = () => {
    if (!gameState) return null;

    const { player, floor, enemies, items, floorNumber, biome, turnCount, gameLog } = gameState;
    const biomeDef = getBiomeForFloor(floorNumber);

    // Calculate viewport
    const halfW = Math.floor(VIEWPORT_W / 2);
    const halfH = Math.floor(VIEWPORT_H / 2);
    const camX = Math.max(0, Math.min(floor.width - VIEWPORT_W, player.pos.x - halfW));
    const camY = Math.max(0, Math.min(floor.height - VIEWPORT_H, player.pos.y - halfH));

    // Build tile grid
    const tileGrid: React.ReactElement[] = [];
    for (let vy = 0; vy < VIEWPORT_H; vy++) {
      for (let vx = 0; vx < VIEWPORT_W; vx++) {
        const wx = camX + vx;
        const wy = camY + vy;

        if (wx < 0 || wx >= floor.width || wy < 0 || wy >= floor.height) {
          tileGrid.push(<div key={`${vx}-${vy}`} className="tile tile-void" />);
          continue;
        }

        const isVisible = floor.visible[wy][wx];
        const isExplored = floor.explored[wy][wx];
        const tile = floor.tiles[wy][wx];
        const isPlayer = wx === player.pos.x && wy === player.pos.y;
        const enemy = isVisible ? enemies.find(e => e.pos.x === wx && e.pos.y === wy && e.hp > 0) : null;
        const item = isVisible ? items.find(i => i.pos && i.pos.x === wx && i.pos.y === wy) : null;

        let content = '';
        let tileClass = 'tile';

        if (!isExplored) {
          tileClass += ' tile-void';
        } else if (!isVisible) {
          tileClass += ` tile-fog ${getTileClass(tile)}`;
          content = getTileChar(tile);
        } else if (isPlayer) {
          tileClass += ' tile-player';
          const classObj = PLAYER_CLASSES.find(c => c.id === gameState.classId);
          content = classObj?.icon || '🧙';
        } else if (enemy) {
          const eDef = getEnemyDef(enemy.defId);
          tileClass += ' tile-enemy';
          content = eDef?.icon || '?';
          if (eDef?.isBoss) tileClass += ' tile-boss';
        } else if (item) {
          const iDef = getItemDef(item.defId);
          tileClass += ' tile-item';
          content = iDef?.icon || '?';
        } else {
          tileClass += ` ${getTileClass(tile)}`;
          content = getTileChar(tile);
        }

        tileGrid.push(
          <div key={`${vx}-${vy}`} className={tileClass}>
            {content}
          </div>
        );
      }
    }

    // Check if on stairs
    const onStairs = floor.tiles[player.pos.y][player.pos.x] === Tile.StairsDown;

    // Adjacent enemies for info bar
    const adjacentEnemies = [
      { pos: { x: player.pos.x, y: player.pos.y - 1 }, dir: 'N' },
      { pos: { x: player.pos.x, y: player.pos.y + 1 }, dir: 'S' },
      { pos: { x: player.pos.x - 1, y: player.pos.y }, dir: 'W' },
      { pos: { x: player.pos.x + 1, y: player.pos.y }, dir: 'E' },
    ]
      .map(({ pos, dir }) => {
        const enemy = enemies.find(e => e.pos.x === pos.x && e.pos.y === pos.y && e.hp > 0);
        return enemy ? { enemy, dir } : null;
      })
      .filter(Boolean) as { enemy: typeof enemies[0]; dir: string }[];

    const xpPercent = (player.xp / player.xpToNext) * 100;
    const hpPercent = (player.hp / getEffectiveStats(player).maxHp) * 100;
    const mpPercent = (player.mp / player.maxMp) * 100;
    const hpColor = hpPercent > 60 ? '#22c55e' : hpPercent > 30 ? '#eab308' : '#ef4444';
    const effectiveStats = getEffectiveStats(player);

    return (
      <div className="screen screen-game" style={getBiomeCSS(biome)}>
        <div className="game-header">
          <div className="floor-info">
            Floor {floorNumber} - {biomeDef.name}
          </div>
          <div className="game-title">THE UNDERGROWTH</div>
          <div className="turn-info">Turn {turnCount}</div>
        </div>

        <div className="game-hud">
          <div className="bars">
            <div className="bar-group">
              <div className="bar-label">HP</div>
              <div className="bar-bg">
                <div className="bar-fill" style={{ width: `${hpPercent}%`, backgroundColor: hpColor }} />
              </div>
              <div className="bar-text">
                {player.hp}/{effectiveStats.maxHp}
              </div>
            </div>

            <div className="bar-group">
              <div className="bar-label">XP</div>
              <div className="bar-bg">
                <div className="bar-fill" style={{ width: `${xpPercent}%` }} />
              </div>
              <div className="bar-text">
                {player.xp}/{player.xpToNext}
              </div>
            </div>

            <div className="bar-group">
              <div className="bar-label">MP</div>
              <div className="bar-bg">
                <div className="bar-fill" style={{ width: `${mpPercent}%` }} />
              </div>
              <div className="bar-text">
                {player.mp}/{player.maxMp}
              </div>
            </div>
          </div>

          <div className="stats-bar">
            <span>LV {player.level}</span>
            <span>ATK {effectiveStats.atk}{effectiveStats.atk > player.atk ? ` (+${effectiveStats.atk - player.atk})` : ''}</span>
            <span>DEF {effectiveStats.def}{effectiveStats.def > player.def ? ` (+${effectiveStats.def - player.def})` : ''}</span>
            {player.statusEffects.length > 0 && (
              <span>{player.statusEffects.map(e => {
                switch(e.type) {
                  case 'poison': return '☠️';
                  case 'regen': return '💚';
                  case 'strength': return '💪';
                  case 'shield': return '🛡️';
                  case 'haste': return '⚡';
                  case 'fire_aura': return '🔥';
                  case 'invulnerable': return '✨';
                  default: return '⚡';
                }
              }).join(' ')}</span>
            )}
            {player.keys > 0 && <span>🔑 {player.keys}</span>}
            <span>Souls: {gameState.soulsEarned}</span>
          </div>
        </div>

        <div className="game-main">
          <div className="viewport-wrapper">
            <div className="viewport" style={{ gridTemplateColumns: `repeat(${VIEWPORT_W}, 1fr)` }}>{tileGrid}</div>
            {/* Floating damage numbers */}
            {damageEvents.map(evt => {
              const screenX = evt.x - camX;
              const screenY = evt.y - camY;
              if (screenX < 0 || screenX >= VIEWPORT_W || screenY < 0 || screenY >= VIEWPORT_H) return null;
              return (
                <div
                  key={evt.id}
                  className="damage-float"
                  style={{
                    left: `${(screenX / VIEWPORT_W) * 100}%`,
                    top: `${(screenY / VIEWPORT_H) * 100}%`,
                    color: evt.color,
                  }}
                >
                  {evt.value}
                </div>
              );
            })}
          </div>

          <div className="game-sidebar">
            {onStairs && <div className="stairs-prompt">Press ENTER to descend</div>}

            {adjacentEnemies.length > 0 && (
              <div className="enemy-info">
                <div className="enemy-title">Adjacent Enemies:</div>
                {adjacentEnemies.map(({ enemy, dir }) => {
                  const eDef = getEnemyDef(enemy.defId);
                  return (
                    <div key={`${enemy.defId}-${dir}`} className="enemy-line">
                      {dir}: {eDef?.name || 'Unknown'} ({enemy.hp}/{enemy.maxHp})
                    </div>
                  );
                })}
              </div>
            )}

            <div className="game-log">
              {gameLog.slice(-5).map((entry, i) => (
                <div key={i} className={`log-entry log-${entry.type}`}>
                  {entry.text}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="action-bar">
          <button className="action-btn" onClick={() => setScreen('inventory')} title="Inventory (I)">
            📦 INV
          </button>
          <button className="action-btn" onClick={() => setShowMinimap(!showMinimap)} title="Minimap (M)">
            🗺️ MAP
          </button>
          <button className="action-btn" onClick={() => {
            const newDirection: Direction = 'wait';
            const newState = processAction(gameState, newDirection);
            setGameState(newState);
            collectDamageEvents();
          }} title="Wait (Space)">
            ⏳ WAIT
          </button>
          <button className="action-btn" onClick={() => setScreen('help')} title="Help (H)">
            ❓ HELP
          </button>
          <button className="action-btn" onClick={() => setSoundEnabled(!soundEnabled)} title="Toggle Sound">
            {soundEnabled ? '🔊' : '🔇'}
          </button>
        </div>

        {showMinimap && (
          <div className="minimap-overlay" onClick={() => setShowMinimap(false)}>
            <div className="minimap-content">
              <div className="minimap-title">Map (tap or press M to close)</div>
              <div className="minimap-grid" style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${floor.width}, 3px)`,
                gap: 0,
              }}>
                {Array.from({ length: floor.height }).map((_, my) =>
                  Array.from({ length: floor.width }).map((_, mx) => {
                    const explored = floor.explored[my]?.[mx];
                    const isP = mx === player.pos.x && my === player.pos.y;
                    const isEnemy = explored && enemies.some(e => e.pos.x === mx && e.pos.y === my && e.hp > 0 && floor.visible[my]?.[mx]);
                    const isStairs = explored && floor.tiles[my][mx] === Tile.StairsDown;
                    const isItem = explored && items.some(i => i.pos && i.pos.x === mx && i.pos.y === my) && floor.visible[my]?.[mx];
                    const tile = floor.tiles[my][mx];
                    let color = 'transparent';
                    if (isP) color = '#00ff88';
                    else if (isEnemy) color = '#ff4444';
                    else if (isStairs) color = '#ffff00';
                    else if (isItem) color = '#44aaff';
                    else if (explored && tile === Tile.Wall) color = '#333';
                    else if (explored && tile !== Tile.Wall) color = '#666';
                    return <div key={`${mx}-${my}`} style={{ width: 3, height: 3, backgroundColor: color }} />;
                  })
                )}
              </div>
              <div className="minimap-legend">
                <span style={{ color: '#00ff88' }}>● You</span>
                <span style={{ color: '#ff4444' }}>● Enemy</span>
                <span style={{ color: '#ffff00' }}>● Stairs</span>
                <span style={{ color: '#44aaff' }}>● Item</span>
              </div>
            </div>
          </div>
        )}

        {/* Mobile touch controls */}
        <div className="mobile-controls">
          <div className="dpad">
            <button className="dpad-btn dpad-up" onClick={() => handleMobileInput('up')}>▲</button>
            <button className="dpad-btn dpad-left" onClick={() => handleMobileInput('left')}>◄</button>
            <button className="dpad-btn dpad-center" onClick={() => handleMobileInput('wait')}>●</button>
            <button className="dpad-btn dpad-right" onClick={() => handleMobileInput('right')}>►</button>
            <button className="dpad-btn dpad-down" onClick={() => handleMobileInput('down')}>▼</button>
          </div>
          <div className="mobile-actions">
            {onStairs && (
              <button className="mobile-action-btn stairs-btn" onClick={() => handleMobileInput('descend')}>
                DESCEND
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderInventory = () => {
    if (!gameState) return null;

    const { player } = gameState;

    // Group items by defId
    const grouped = new Map<string, number>();
    player.inventory.forEach(item => {
      grouped.set(item.defId, (grouped.get(item.defId) || 0) + 1);
    });

    return (
      <div className="screen screen-inventory">
        <h1>INVENTORY</h1>

        <div className="inventory-content">
          <div className="inv-section">
            <h3>Equipment</h3>
            <div className="equipment-grid">
              {(['weapon', 'armor', 'accessory'] as const).map(slot => {
                const equip = player.equipment[slot];
                const equipDef = equip ? getItemDef(equip.defId) : null;
                const bonuses: string[] = [];
                if (equipDef?.atkBonus) bonuses.push(`ATK +${equipDef.atkBonus}`);
                if (equipDef?.defBonus) bonuses.push(`DEF +${equipDef.defBonus}`);
                if (equipDef?.hpBonus) bonuses.push(`HP +${equipDef.hpBonus}`);

                return (
                  <div key={slot} className={`equipment-slot ${equip ? 'equipped' : ''}`}>
                    <div className="slot-name">{slot.charAt(0).toUpperCase() + slot.slice(1)}</div>
                    {equip && equipDef ? (
                      <>
                        <div>{equipDef.icon}</div>
                        <div className="slot-item">{equipDef.name}</div>
                        {bonuses.length > 0 && <div className="slot-bonus">{bonuses.join(', ')}</div>}
                        <button className="btn btn-small" onClick={() => {
                          // Unequip: move back to inventory
                          const newPlayer = { ...player };
                          newPlayer.equipment = { ...player.equipment, [slot]: null };
                          newPlayer.inventory = [...player.inventory, equip];
                          setGameState({ ...gameState, player: newPlayer });
                        }}>REMOVE</button>
                      </>
                    ) : (
                      <div className="slot-empty">Empty</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="inv-section">
            <h3>Stats</h3>
            <div className="stats-grid">
              <div>HP: {player.hp}/{player.maxHp}</div>
              <div>MP: {player.mp}/{player.maxMp}</div>
              <div>ATK: {player.atk}</div>
              <div>DEF: {player.def}</div>
              <div>Level: {player.level}</div>
              <div>Inventory: {player.inventory.length}/{player.maxInventory}</div>
            </div>
          </div>

          <div className="inv-section">
            <h3>Items ({player.inventory.length}/{player.maxInventory})</h3>
            <div className="items-grid">
              {Array.from(grouped.entries()).map(([defId, count]) => {
                const itemDef = getItemDef(defId);
                const firstIndex = player.inventory.findIndex(i => i.defId === defId);
                if (!itemDef) return null;

                // Build stat line
                const stats: string[] = [];
                if (itemDef.atkBonus) stats.push(`ATK +${itemDef.atkBonus}`);
                if (itemDef.defBonus) stats.push(`DEF +${itemDef.defBonus}`);
                if (itemDef.hpBonus) stats.push(`HP +${itemDef.hpBonus}`);
                if (itemDef.healAmount) stats.push(`Heal ${itemDef.healAmount}`);
                if (itemDef.statusEffect) stats.push(`${itemDef.statusEffect.type} (${itemDef.statusEffect.turnsLeft}t)`);
                if (itemDef.scrollEffect) stats.push(`${itemDef.scrollEffect.replace(/_/g, ' ')}`);

                const rarityColor = itemDef.rarity === 'legendary' ? '#fbbf24' :
                  itemDef.rarity === 'rare' ? '#a78bfa' :
                  itemDef.rarity === 'uncommon' ? '#34d399' : '#9ca3af';

                return (
                  <div key={defId} className="item-stack" style={{ borderLeft: `3px solid ${rarityColor}` }}>
                    <div className="item-icon">{itemDef.icon}</div>
                    <div className="item-details">
                      <div className="item-name" style={{ color: rarityColor }}>{itemDef.name}</div>
                      <div className="item-desc">{itemDef.description}</div>
                      {stats.length > 0 && <div className="item-stats">{stats.join(' | ')}</div>}
                    </div>
                    {count > 1 && <div className="item-count">x{count}</div>}
                    <div className="item-buttons">
                      <button
                        className="btn btn-small"
                        onClick={() => {
                          const newState = useItem(gameState, firstIndex);
                          setGameState(newState);
                          if (soundEnabled) sfxUseItem();
                        }}
                      >
                        {itemDef.type === 'equipment' ? 'EQUIP' : 'USE'}
                      </button>
                      <button
                        className="btn btn-small"
                        onClick={() => {
                          const newState = dropItem(gameState, firstIndex);
                          setGameState(newState);
                        }}
                      >
                        DROP
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <button className="btn btn-secondary" onClick={() => setScreen('game')}>
          CLOSE (I)
        </button>
      </div>
    );
  };

  const renderSoulShop = () => {
    return (
      <div className="screen screen-soul-shop">
        <h1>SOUL SHOP</h1>
        <div className="souls-display">Current Souls: {meta?.souls || 0}</div>

        <div className="shop-content">
          <div className="shop-section">
            <h2>Upgrades</h2>
            <div className="upgrades-grid">
              {META_UPGRADES.map(upgrade => {
                const currentLevel = meta?.upgrades[upgrade.id] || 0;
                const isMaxed = currentLevel >= upgrade.maxLevel;
                const cost = isMaxed ? 0 : getUpgradeCost(upgrade, currentLevel);
                const canAfford = !isMaxed && (meta?.souls || 0) >= cost;

                return (
                  <div key={upgrade.id} className="upgrade-card">
                    <div className="upgrade-icon">{upgrade.icon}</div>
                    <div className="upgrade-name">{upgrade.name}</div>
                    <div className="upgrade-desc">{upgrade.description}</div>
                    <div className="upgrade-level">
                      {Array.from({ length: upgrade.maxLevel }).map((_, i) => (
                        <span key={i} className={i < currentLevel ? 'pip-filled' : 'pip-empty'}>
                          ●
                        </span>
                      ))}
                    </div>
                    <button
                      className={`btn btn-small ${!canAfford ? 'btn-disabled' : ''}`}
                      disabled={!canAfford}
                      onClick={() => {
                        if (meta && canAfford) {
                          const updatedMeta = { ...meta };
                          updatedMeta.upgrades[upgrade.id] = currentLevel + 1;
                          updatedMeta.souls -= cost;
                          saveMeta(updatedMeta);
                          setMeta(updatedMeta);
                        }
                      }}
                    >
                      {isMaxed ? 'MAXED' : `BUY (${cost})`}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="shop-section">
            <h2>Classes</h2>
            <div className="classes-grid">
              {PLAYER_CLASSES.filter(cls => cls.id !== 'explorer').map(cls => {
                const isUnlocked = meta?.unlockedClasses.includes(cls.id);
                const classCosts: Record<string, number> = { warrior: 100, shadow: 200, mycologist: 300, warden: 500 };
                const cost = classCosts[cls.id] ?? 500;

                return (
                  <div key={cls.id} className="class-shop-card">
                    <div className="class-icon">{cls.icon}</div>
                    <div className="class-name">{cls.name}</div>
                    <div className="class-desc">{cls.passive}</div>
                    <button
                      className={`btn btn-small ${isUnlocked ? 'btn-disabled' : ''}`}
                      disabled={isUnlocked || (meta?.souls || 0) < cost}
                      onClick={() => {
                        if (meta && !isUnlocked) {
                          const result = unlockClass(meta, cls.id);
                          if (result) {
                            saveMeta(result);
                            setMeta(result);
                          }
                        }
                      }}
                    >
                      {isUnlocked ? 'UNLOCKED' : `UNLOCK (${cost} souls)`}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <button className="btn btn-secondary" onClick={() => setScreen(gameState ? 'game' : 'menu')}>
          BACK
        </button>
      </div>
    );
  };

  const renderAchievements = () => {
    const unlockedCount = Object.values(meta?.achievements || {}).filter(Boolean).length;

    return (
      <div className="screen screen-achievements">
        <h1>ACHIEVEMENTS</h1>
        <div className="achievements-count">
          {unlockedCount} / {ACHIEVEMENTS.length} Unlocked
        </div>

        <div className="achievements-grid">
          {ACHIEVEMENTS.map(ach => {
            const isUnlocked = meta?.achievements[ach.id] || false;

            return (
              <div key={ach.id} className={`achievement-card ${isUnlocked ? 'unlocked' : 'locked'}`}>
                <div className="ach-icon">{ach.icon}</div>
                <div className="ach-name">{ach.name}</div>
                <div className="ach-desc">{isUnlocked ? ach.description : '???'}</div>
                {isUnlocked && (
                  <div className="ach-reward">
                    Reward: {ach.reward.type === 'souls' ? `${ach.reward.value} souls` : String(ach.reward.value)}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <button className="btn btn-secondary" onClick={() => setScreen(gameState ? 'game' : 'menu')}>
          BACK
        </button>
      </div>
    );
  };

  const renderHelp = () => {
    return (
      <div className="screen screen-help">
        <h1>HOW TO PLAY</h1>

        <div className="help-content">
          <section>
            <h2>Movement</h2>
            <p>Use WASD or Arrow Keys for cardinal movement</p>
            <p>Use Q, E, Z, C for diagonal movement</p>
            <p>Press Space or . to wait a turn</p>
          </section>

          <section>
            <h2>Actions</h2>
            <p>Press ENTER to descend stairs to the next floor</p>
            <p>Press I to open/close inventory</p>
            <p>Press M to toggle minimap</p>
          </section>

          <section>
            <h2>Dungeon</h2>
            <p>Descend 30 floors through 5 different biomes</p>
            <p>Explore, collect loot, defeat enemies, and grow stronger</p>
            <p>Reach the deepest floor to achieve victory</p>
          </section>

          <section>
            <h2>Biomes</h2>
            <ul>
              <li>Shallow Caves (Floors 1-6)</li>
              <li>Fungal Forest (Floors 7-12)</li>
              <li>Crystal Caverns (Floors 13-18)</li>
              <li>Lava Depths (Floors 19-24)</li>
              <li>The Abyss (Floors 25-30)</li>
            </ul>
          </section>

          <section>
            <h2>Meta Progression</h2>
            <p>Collect souls to unlock upgrades and new classes</p>
            <p>Visit the Soul Shop from the main menu</p>
            <p>Track your achievements for extra rewards</p>
          </section>
        </div>

        <button className="btn btn-secondary" onClick={() => setScreen(gameState ? 'game' : 'menu')}>
          BACK (ESC)
        </button>
      </div>
    );
  };

  const renderGameOver = () => {
    if (!gameState) return null;

    const finalScore = calculateScore(gameState);
    const classObj = PLAYER_CLASSES.find(c => c.id === gameState.classId);
    const souls = calculateSoulsEarned(gameState);

    return (
      <div className="screen screen-gameover">
        <div className="gameover-header">
          {gameState.victory ? <div className="gameover-icon">🏆</div> : <div className="gameover-icon">💀</div>}
          <h1>{gameState.victory ? 'VICTORY!' : 'GAME OVER'}</h1>
        </div>

        <div className="gameover-stats">
          <div className="stat-line">Score: {finalScore}</div>
          <div className="stat-line">Floor: {gameState.deepestFloor}/30</div>
          <div className="stat-line">Level: {gameState.player.level}</div>
          <div className="stat-line">Kills: {gameState.killCount}</div>
          <div className="stat-line">Turns: {gameState.turnCount}</div>
          <div className="stat-line">Class: {classObj?.name || 'Unknown'}</div>
          <div className="stat-line highlight">Souls Earned: +{souls}</div>
        </div>

        {newlyUnlockedAchievements.length > 0 && (
          <div className="new-achievements">
            <h3>New Achievements Unlocked!</h3>
            {newlyUnlockedAchievements.map(ach => (
              <div key={ach.id} className="new-ach">
                {ach.icon} {ach.name}
              </div>
            ))}
          </div>
        )}

        <div className="gameover-buttons">
          <button className="btn btn-primary" onClick={() => startNewGame(gameState.classId)}>
            TRY AGAIN
          </button>
          {gameState.victory && (
            <button className="btn btn-secondary" onClick={() => {
              // Continue the game into endless mode instead of starting over
              const continued = { ...gameState, gameOver: false, isEndless: true };
              setGameState(continued);
              if (soundEnabled) startAmbient();
              setScreen('game');
            }}>
              CONTINUE DESCENT
            </button>
          )}
          <button className="btn btn-secondary" onClick={() => setScreen('soul_shop')}>
            SOUL SHOP
          </button>
          <button className="btn btn-secondary" onClick={() => setScreen('menu')}>
            MAIN MENU
          </button>
        </div>
      </div>
    );
  };

  // === MAIN RENDER ===

  return (
    <div className="game-container">
      {screen === 'menu' && renderMenu()}
      {screen === 'class_select' && renderClassSelect()}
      {screen === 'game' && renderGame()}
      {screen === 'inventory' && renderInventory()}
      {screen === 'soul_shop' && renderSoulShop()}
      {screen === 'achievements' && renderAchievements()}
      {screen === 'help' && renderHelp()}
      {screen === 'gameover' && renderGameOver()}
    </div>
  );
}
