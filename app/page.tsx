'use client';
// ============================================
// THE UNDERGROWTH — Main Game Page
// Full roguelike dungeon crawler
// ============================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { GameState, Tile, Direction, EnemyInstance, ItemInstance, Pos, HighScore } from '@/lib/types';
import { createNewGame, processAction, useItem, dropItem, descendFloor, getEffectiveStats, calculateScore } from '@/lib/gameEngine';
import { getEnemyDef, getItemDef } from '@/lib/entities';
import { computeFOV } from '@/lib/fov';
import { initAudio, sfxStep, sfxHit, sfxPlayerHurt, sfxPickup, sfxLevelUp, sfxDeath, sfxDescend, sfxBoss, sfxVictory, sfxUseItem, startAmbient, stopAmbient } from '@/lib/audio';

// --- Viewport config ---
const VIEWPORT_W = 21;
const VIEWPORT_H = 15;

// --- Tile rendering ---
function getTileChar(tile: Tile): string {
  switch (tile) {
    case Tile.Wall: return ' ';
    case Tile.Floor: return '·';
    case Tile.StairsDown: return '▼';
    case Tile.Door: return '🚪';
    case Tile.Water: return '~';
    case Tile.Mushroom: return '🍄';
    case Tile.Chest: return '📦';
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
    default: return 'tile-wall';
  }
}

function getRarityColor(rarity: string): string {
  switch (rarity) {
    case 'common': return '#94a3b8';
    case 'uncommon': return '#22c55e';
    case 'rare': return '#3b82f6';
    case 'legendary': return '#f59e0b';
    default: return '#94a3b8';
  }
}

// --- High Scores ---
function loadHighScores(): HighScore[] {
  try {
    const raw = localStorage.getItem('undergrowth_scores');
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveHighScore(score: HighScore) {
  try {
    const scores = loadHighScores();
    scores.push(score);
    scores.sort((a, b) => b.score - a.score);
    localStorage.setItem('undergrowth_scores', JSON.stringify(scores.slice(0, 10)));
  } catch { /* ignore */ }
}

// --- Main Game Component ---
export default function GamePage() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [screen, setScreen] = useState<'menu' | 'game' | 'gameover' | 'inventory' | 'help'>('menu');
  const [highScores, setHighScores] = useState<HighScore[]>([]);
  const [sfxEnabled, setSfxEnabled] = useState(true);
  const [showMinimap, setShowMinimap] = useState(false);
  const [selectedInventoryIdx, setSelectedInventoryIdx] = useState<number | null>(null);
  const [mobileDir, setMobileDir] = useState<Direction | null>(null);
  const gameRef = useRef<HTMLDivElement>(null);
  const prevHpRef = useRef<number>(0);
  const scoreSavedRef = useRef(false);

  // Load high scores on mount
  useEffect(() => {
    setHighScores(loadHighScores());
    initAudio();
  }, []);

  // Focus game div for keyboard input
  useEffect(() => {
    if (screen === 'game' && gameRef.current) {
      gameRef.current.focus();
    }
  }, [screen]);

  // Start new game
  const startGame = useCallback(() => {
    const state = createNewGame();
    setGameState(state);
    setScreen('game');
    scoreSavedRef.current = false;
    prevHpRef.current = state.player.hp;
    if (sfxEnabled) startAmbient();
  }, [sfxEnabled]);

  // Handle keyboard input
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!gameState || screen !== 'game') return;
    if (gameState.gameOver || gameState.victory) return;

    let dir: Direction | null = null;

    switch (e.key) {
      case 'ArrowUp': case 'w': case 'W': dir = 'up'; break;
      case 'ArrowDown': case 's': case 'S': dir = 'down'; break;
      case 'ArrowLeft': case 'a': case 'A': dir = 'left'; break;
      case 'ArrowRight': case 'd': case 'D': dir = 'right'; break;
      case 'q': case 'Q': dir = 'upleft'; break;
      case 'e': case 'E': dir = 'upright'; break;
      case 'z': case 'Z': dir = 'downleft'; break;
      case 'c': case 'C': dir = 'downright'; break;
      case ' ': case '.': dir = 'wait'; break;
      case 'i': case 'I':
        setScreen('inventory');
        e.preventDefault();
        return;
      case 'm': case 'M':
        setShowMinimap(prev => !prev);
        e.preventDefault();
        return;
      case '>': case 'Enter':
        // Descend stairs
        if (gameState.floor.tiles[gameState.player.pos.y][gameState.player.pos.x] === Tile.StairsDown) {
          const newState = descendFloor(gameState);
          setGameState(newState);
          if (sfxEnabled) sfxDescend();
          e.preventDefault();
          return;
        }
        break;
      case '?': case 'h': case 'H':
        setScreen('help');
        e.preventDefault();
        return;
      default: return;
    }

    if (dir) {
      e.preventDefault();
      const newState = processAction(gameState, dir);
      setGameState(newState);

      // Sound effects
      if (sfxEnabled) {
        const wasHit = newState.player.hp < prevHpRef.current;
        const killed = newState.killCount > gameState.killCount;
        const leveled = newState.player.level > gameState.player.level;
        const pickedUp = newState.player.inventory.length > gameState.player.inventory.length;

        if (killed) sfxHit();
        else if (wasHit) sfxPlayerHurt();
        else if (dir !== 'wait') sfxStep();

        if (leveled) setTimeout(sfxLevelUp, 100);
        if (pickedUp) sfxPickup();

        if (newState.gameOver) {
          sfxDeath();
          stopAmbient();
        }
        if (newState.victory) {
          sfxVictory();
          stopAmbient();
        }

        // Boss encounter sound
        const hasBossLog = newState.gameLog.some(
          l => l.type === 'boss' && l.turn === newState.turnCount && l.text.includes('sense a powerful')
        );
        if (hasBossLog) sfxBoss();
      }

      prevHpRef.current = newState.player.hp;

      // Handle game over
      if ((newState.gameOver || newState.victory) && !scoreSavedRef.current) {
        scoreSavedRef.current = true;
        const finalScore = calculateScore(newState);
        const hs: HighScore = {
          score: finalScore,
          floor: newState.deepestFloor,
          level: newState.player.level,
          kills: newState.killCount,
          turns: newState.turnCount,
          causeOfDeath: newState.victory ? 'VICTORY' : 'Defeated',
          date: Date.now(),
        };
        saveHighScore(hs);
        setHighScores(loadHighScores());
        setTimeout(() => setScreen('gameover'), 1500);
      }
    }
  }, [gameState, screen, sfxEnabled]);

  // Mobile direction tap
  const handleMobileDir = useCallback((dir: Direction) => {
    if (!gameState || gameState.gameOver || gameState.victory) return;

    if (dir === 'wait' && gameState.floor.tiles[gameState.player.pos.y][gameState.player.pos.x] === Tile.StairsDown) {
      const newState = descendFloor(gameState);
      setGameState(newState);
      if (sfxEnabled) sfxDescend();
      return;
    }

    const newState = processAction(gameState, dir);
    setGameState(newState);
    prevHpRef.current = newState.player.hp;

    if (sfxEnabled) {
      if (newState.killCount > gameState.killCount) sfxHit();
      else if (newState.player.hp < gameState.player.hp) sfxPlayerHurt();
      else sfxStep();
    }

    if ((newState.gameOver || newState.victory) && !scoreSavedRef.current) {
      scoreSavedRef.current = true;
      const finalScore = calculateScore(newState);
      saveHighScore({
        score: finalScore,
        floor: newState.deepestFloor,
        level: newState.player.level,
        kills: newState.killCount,
        turns: newState.turnCount,
        causeOfDeath: newState.victory ? 'VICTORY' : 'Defeated',
        date: Date.now(),
      });
      setHighScores(loadHighScores());
      setTimeout(() => setScreen('gameover'), 1500);
    }
  }, [gameState, sfxEnabled]);

  // Use item from inventory screen
  const handleUseItem = useCallback((idx: number) => {
    if (!gameState) return;
    const newState = useItem(gameState, idx);
    setGameState(newState);
    if (sfxEnabled) sfxUseItem();
    setSelectedInventoryIdx(null);
  }, [gameState, sfxEnabled]);

  const handleDropItem = useCallback((idx: number) => {
    if (!gameState) return;
    const newState = dropItem(gameState, idx);
    setGameState(newState);
    setSelectedInventoryIdx(null);
  }, [gameState]);

  // --- RENDER ---

  // Title screen
  if (screen === 'menu') {
    return (
      <div className="game-container menu-screen">
        <div className="scanline-overlay" />
        <div className="menu-content">
          <div className="menu-title-area">
            <div className="menu-mushroom">🍄</div>
            <h1 className="menu-title">THE UNDERGROWTH</h1>
            <p className="menu-subtitle">A Roguelike Dungeon Crawler</p>
          </div>
          <div className="menu-tagline">
            Descend into bioluminescent caves.<br />
            Fight. Loot. Survive.
          </div>
          <button className="menu-btn primary" onClick={startGame}>NEW GAME</button>
          <button className="menu-btn" onClick={() => setScreen('help')}>HOW TO PLAY</button>
          <button className="menu-btn" onClick={() => setSfxEnabled(p => !p)}>
            SOUND: {sfxEnabled ? 'ON' : 'OFF'}
          </button>
          {highScores.length > 0 && (
            <div className="menu-scores">
              <h3>HIGH SCORES</h3>
              {highScores.slice(0, 5).map((hs, i) => (
                <div key={i} className="score-row">
                  <span className="score-rank">#{i + 1}</span>
                  <span className="score-val">{hs.score.toLocaleString()}</span>
                  <span className="score-detail">Lv{hs.level} · F{hs.floor} · {hs.kills}K</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Help screen
  if (screen === 'help') {
    return (
      <div className="game-container help-screen">
        <div className="scanline-overlay" />
        <div className="help-content">
          <h2>HOW TO PLAY</h2>
          <div className="help-section">
            <h3>MOVEMENT</h3>
            <p>WASD or Arrow Keys to move in 4 directions</p>
            <p>Q/E/Z/C for diagonal movement</p>
            <p>SPACE or . to wait a turn</p>
          </div>
          <div className="help-section">
            <h3>COMBAT</h3>
            <p>Walk into enemies to attack (bump combat)</p>
            <p>Enemies move after you each turn</p>
            <p>Defeat enemies to gain XP and level up</p>
          </div>
          <div className="help-section">
            <h3>ITEMS</h3>
            <p>Walk over items to pick them up</p>
            <p>Press I to open inventory</p>
            <p>Equip weapons and armor for stat bonuses</p>
            <p>Use potions and scrolls for powerful effects</p>
          </div>
          <div className="help-section">
            <h3>EXPLORATION</h3>
            <p>Find the stairs (▼) to descend deeper</p>
            <p>Press ENTER or &gt; on stairs to descend</p>
            <p>Press M to toggle the minimap</p>
            <p>Boss fights every 5 floors!</p>
          </div>
          <div className="help-section">
            <h3>GOAL</h3>
            <p>Reach floor 15 and defeat the Abyssal Maw to win!</p>
            <p>Death is permanent. How deep can you go?</p>
          </div>
          <button className="menu-btn primary" onClick={() => setScreen(gameState ? 'game' : 'menu')}>
            {gameState ? 'BACK TO GAME' : 'BACK TO MENU'}
          </button>
        </div>
      </div>
    );
  }

  // Game over screen
  if (screen === 'gameover' && gameState) {
    const finalScore = calculateScore(gameState);
    return (
      <div className="game-container gameover-screen">
        <div className="scanline-overlay" />
        <div className="gameover-content">
          {gameState.victory ? (
            <>
              <div className="gameover-icon">🏆</div>
              <h1 className="gameover-title victory">VICTORY!</h1>
              <p className="gameover-subtitle">You conquered the Undergrowth!</p>
            </>
          ) : (
            <>
              <div className="gameover-icon">💀</div>
              <h1 className="gameover-title">YOU DIED</h1>
              <p className="gameover-subtitle">The Undergrowth claims another soul...</p>
            </>
          )}
          <div className="gameover-stats">
            <div className="go-stat"><span>Score</span><span>{finalScore.toLocaleString()}</span></div>
            <div className="go-stat"><span>Floor</span><span>{gameState.deepestFloor}</span></div>
            <div className="go-stat"><span>Level</span><span>{gameState.player.level}</span></div>
            <div className="go-stat"><span>Kills</span><span>{gameState.killCount}</span></div>
            <div className="go-stat"><span>Turns</span><span>{gameState.turnCount}</span></div>
          </div>
          <button className="menu-btn primary" onClick={startGame}>TRY AGAIN</button>
          <button className="menu-btn" onClick={() => { stopAmbient(); setScreen('menu'); }}>MAIN MENU</button>
        </div>
      </div>
    );
  }

  // Inventory screen
  if (screen === 'inventory' && gameState) {
    const stats = getEffectiveStats(gameState.player);
    return (
      <div className="game-container inventory-screen">
        <div className="scanline-overlay" />
        <div className="inv-content">
          <div className="inv-header">
            <h2>INVENTORY</h2>
            <span className="inv-count">{gameState.player.inventory.length}/{gameState.player.maxInventory}</span>
          </div>

          {/* Equipment */}
          <div className="inv-section">
            <h3>EQUIPPED</h3>
            {(['weapon', 'armor', 'accessory'] as const).map(slot => {
              const equip = gameState.player.equipment[slot];
              const def = equip ? getItemDef(equip.defId) : null;
              return (
                <div key={slot} className="inv-equip-slot">
                  <span className="equip-label">{slot.toUpperCase()}</span>
                  {def ? (
                    <span className="equip-item" style={{ color: getRarityColor(def.rarity) }}>
                      {def.icon} {def.name}
                      {def.atkBonus ? ` +${def.atkBonus} ATK` : ''}
                      {def.defBonus ? ` +${def.defBonus} DEF` : ''}
                      {def.hpBonus ? ` +${def.hpBonus} HP` : ''}
                    </span>
                  ) : (
                    <span className="equip-empty">— empty —</span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Stats */}
          <div className="inv-section">
            <h3>STATS</h3>
            <div className="inv-stats">
              <span>ATK: {stats.atk}</span>
              <span>DEF: {stats.def}</span>
              <span>HP: {gameState.player.hp}/{stats.maxHp}</span>
              <span>LV: {gameState.player.level}</span>
            </div>
          </div>

          {/* Inventory items */}
          <div className="inv-section">
            <h3>ITEMS</h3>
            {gameState.player.inventory.length === 0 ? (
              <p className="inv-empty">No items. Explore the dungeon!</p>
            ) : (
              <div className="inv-grid">
                {gameState.player.inventory.map((item, idx) => {
                  const def = getItemDef(item.defId);
                  if (!def) return null;
                  const isSelected = selectedInventoryIdx === idx;
                  return (
                    <div key={idx}>
                      <div
                        className={`inv-item ${isSelected ? 'selected' : ''}`}
                        style={{ borderColor: getRarityColor(def.rarity) + '60' }}
                        onClick={() => setSelectedInventoryIdx(isSelected ? null : idx)}
                      >
                        <span className="inv-item-icon">{def.icon}</span>
                        <div className="inv-item-info">
                          <span className="inv-item-name" style={{ color: getRarityColor(def.rarity) }}>{def.name}</span>
                          <span className="inv-item-desc">{def.description}</span>
                        </div>
                      </div>
                      {isSelected && (
                        <div className="inv-actions">
                          <button className="inv-btn use" onClick={() => handleUseItem(idx)}>
                            {def.type === 'equipment' ? 'EQUIP' : 'USE'}
                          </button>
                          <button className="inv-btn drop" onClick={() => handleDropItem(idx)}>DROP</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {gameState.player.keys > 0 && (
            <div className="inv-keys">🗝️ Keys: {gameState.player.keys}</div>
          )}

          <button className="menu-btn primary" onClick={() => { setScreen('game'); setSelectedInventoryIdx(null); }}>
            CLOSE (I)
          </button>
        </div>
      </div>
    );
  }

  // Main game screen
  if (screen === 'game' && gameState) {
    const { player, floor, enemies, items, floorNumber, turnCount, gameLog } = gameState;
    const stats = getEffectiveStats(player);

    // Calculate viewport bounds (centered on player)
    const halfW = Math.floor(VIEWPORT_W / 2);
    const halfH = Math.floor(VIEWPORT_H / 2);
    const camX = Math.max(0, Math.min(floor.width - VIEWPORT_W, player.pos.x - halfW));
    const camY = Math.max(0, Math.min(floor.height - VIEWPORT_H, player.pos.y - halfH));

    // Build visible tile grid
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
        let extraStyle: React.CSSProperties = {};

        if (!isExplored) {
          tileClass += ' tile-void';
        } else if (!isVisible) {
          tileClass += ` tile-fog ${getTileClass(tile)}`;
          content = getTileChar(tile);
        } else if (isPlayer) {
          tileClass += ' tile-player';
          content = '🧙';
        } else if (enemy) {
          const eDef = getEnemyDef(enemy.defId);
          tileClass += ' tile-enemy';
          content = eDef?.icon || '?';
          if (eDef?.isBoss) tileClass += ' tile-boss';
        } else if (item) {
          const iDef = getItemDef(item.defId);
          tileClass += ' tile-item';
          content = iDef?.icon || '?';
          extraStyle = { color: getRarityColor(iDef?.rarity || 'common') };
        } else {
          tileClass += ` ${getTileClass(tile)}`;
          content = getTileChar(tile);
        }

        tileGrid.push(
          <div key={`${vx}-${vy}`} className={tileClass} style={extraStyle}>
            {content}
          </div>
        );
      }
    }

    // Recent log entries
    const recentLog = gameLog.slice(-5).reverse();

    // HP bar percentage
    const hpPct = Math.max(0, (player.hp / stats.maxHp) * 100);
    const xpPct = (player.xp / player.xpToNext) * 100;

    // Check if on stairs
    const onStairs = floor.tiles[player.pos.y][player.pos.x] === Tile.StairsDown;

    return (
      <div className="game-container game-screen" ref={gameRef} tabIndex={0} onKeyDown={handleKeyDown}>
        <div className="scanline-overlay" />

        {/* Top HUD */}
        <div className="hud-top">
          <div className="hud-floor">F{floorNumber}</div>
          <div className="hud-title">THE UNDERGROWTH</div>
          <div className="hud-turn">T{turnCount}</div>
        </div>

        {/* HP/XP bars */}
        <div className="hud-bars">
          <div className="bar-container">
            <div className="bar-label">HP {player.hp}/{stats.maxHp}</div>
            <div className="bar-track hp-track">
              <div className="bar-fill hp-fill" style={{ width: `${hpPct}%` }} />
            </div>
          </div>
          <div className="bar-container">
            <div className="bar-label">XP {player.xp}/{player.xpToNext}</div>
            <div className="bar-track xp-track">
              <div className="bar-fill xp-fill" style={{ width: `${xpPct}%` }} />
            </div>
          </div>
        </div>

        {/* Stats bar */}
        <div className="hud-stats">
          <span>LV {player.level}</span>
          <span>⚔️ {stats.atk}</span>
          <span>🛡️ {stats.def}</span>
          {player.statusEffects.length > 0 && (
            <span className="status-icons">
              {player.statusEffects.map((e, i) => (
                <span key={i} className={`status-${e.type}`} title={`${e.type} (${e.turnsLeft}t)`}>
                  {e.type === 'poison' ? '☠️' : e.type === 'regen' ? '💚' : e.type === 'strength' ? '💪' : e.type === 'shield' ? '🛡️' : e.type === 'haste' ? '⚡' : '❓'}
                </span>
              ))}
            </span>
          )}
          {player.keys > 0 && <span>🗝️ {player.keys}</span>}
        </div>

        {/* Game viewport */}
        <div className="viewport-container">
          <div
            className="viewport"
            style={{
              gridTemplateColumns: `repeat(${VIEWPORT_W}, 1fr)`,
              gridTemplateRows: `repeat(${VIEWPORT_H}, 1fr)`,
            }}
          >
            {tileGrid}
          </div>

          {/* Stairs prompt */}
          {onStairs && !gameState.gameOver && (
            <div className="stairs-prompt">
              Press ENTER or ▼ to descend
            </div>
          )}

          {/* Game over overlay */}
          {gameState.gameOver && (
            <div className="game-overlay death-overlay">
              <div className="overlay-text">💀 YOU DIED</div>
            </div>
          )}
          {gameState.victory && (
            <div className="game-overlay victory-overlay">
              <div className="overlay-text">🏆 VICTORY!</div>
            </div>
          )}
        </div>

        {/* Minimap */}
        {showMinimap && (
          <div className="minimap-overlay">
            <div className="minimap" style={{
              gridTemplateColumns: `repeat(${floor.width}, 3px)`,
              gridTemplateRows: `repeat(${floor.height}, 3px)`,
            }}>
              {Array.from({ length: floor.height }).map((_, my) =>
                Array.from({ length: floor.width }).map((_, mx) => {
                  const isPlayerMM = mx === player.pos.x && my === player.pos.y;
                  const isExploredMM = floor.explored[my][mx];
                  const tileMM = floor.tiles[my][mx];
                  let mmClass = 'mm-tile';
                  if (isPlayerMM) mmClass += ' mm-player';
                  else if (!isExploredMM) mmClass += ' mm-void';
                  else if (tileMM === Tile.Wall) mmClass += ' mm-wall';
                  else if (tileMM === Tile.StairsDown) mmClass += ' mm-stairs';
                  else mmClass += ' mm-floor';
                  return <div key={`mm-${mx}-${my}`} className={mmClass} />;
                })
              )}
            </div>
          </div>
        )}

        {/* Game log */}
        <div className="game-log">
          {recentLog.map((entry, i) => (
            <div key={gameLog.length - i} className={`log-entry log-${entry.type}`} style={{ opacity: 1 - i * 0.15 }}>
              {entry.text}
            </div>
          ))}
        </div>

        {/* Enemy info (if visible enemy nearby) */}
        {(() => {
          const nearbyEnemy = enemies.find(e =>
            e.hp > 0 &&
            floor.visible[e.pos.y]?.[e.pos.x] &&
            Math.abs(e.pos.x - player.pos.x) <= 1 &&
            Math.abs(e.pos.y - player.pos.y) <= 1
          );
          if (!nearbyEnemy) return null;
          const eDef = getEnemyDef(nearbyEnemy.defId);
          if (!eDef) return null;
          const eHpPct = (nearbyEnemy.hp / nearbyEnemy.maxHp) * 100;
          return (
            <div className={`enemy-info ${eDef.isBoss ? 'boss-info' : ''}`}>
              <span className="ei-name">{eDef.icon} {eDef.name}</span>
              <div className="ei-hp-bar">
                <div className="ei-hp-fill" style={{ width: `${eHpPct}%` }} />
              </div>
              <span className="ei-hp">{nearbyEnemy.hp}/{nearbyEnemy.maxHp}</span>
            </div>
          );
        })()}

        {/* Mobile controls */}
        <div className="mobile-controls">
          <div className="dpad">
            <button className="dpad-btn dpad-up" onClick={() => handleMobileDir('up')}>▲</button>
            <button className="dpad-btn dpad-left" onClick={() => handleMobileDir('left')}>◄</button>
            <button className="dpad-btn dpad-center" onClick={() => handleMobileDir('wait')}>
              {onStairs ? '▼' : '·'}
            </button>
            <button className="dpad-btn dpad-right" onClick={() => handleMobileDir('right')}>►</button>
            <button className="dpad-btn dpad-down" onClick={() => handleMobileDir('down')}>▼</button>
          </div>
          <div className="mobile-actions">
            <button className="mob-btn" onClick={() => setScreen('inventory')}>📦</button>
            <button className="mob-btn" onClick={() => setShowMinimap(p => !p)}>🗺️</button>
            <button className="mob-btn" onClick={() => setScreen('help')}>❓</button>
          </div>
        </div>
      </div>
    );
  }

  // Fallback
  return (
    <div className="game-container">
      <div className="scanline-overlay" />
      <div className="menu-content">
        <div className="menu-title-area">
          <div className="menu-mushroom">🍄</div>
          <h1 className="menu-title">THE UNDERGROWTH</h1>
        </div>
        <button className="menu-btn primary" onClick={startGame}>START</button>
      </div>
    </div>
  );
}
