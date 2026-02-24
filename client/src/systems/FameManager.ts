/**
 * FameManager: Handles character death, fame calculation, and the graveyard.
 *
 * Fame is the permanent currency of Yggdrasil. When a character dies:
 *   1. Calculate fame based on level, kills, dungeons cleared, etc.
 *   2. Record the character in the Graveyard (localStorage)
 *   3. Fame accumulates across all dead characters
 *   4. Total fame unlocks cosmetics and titles (future)
 *
 * The graveyard stores the last 50 characters.
 */

export interface GraveyardEntry {
  id: string;           // unique ID
  classId: string;
  className: string;
  level: number;
  baseFame: number;
  bonusFame: number;
  totalFame: number;
  killedBy: string;
  dungeonsCleared: number;
  enemiesKilled: number;
  maxBiome: string;
  timestamp: number;
}

export interface FameData {
  totalFame: number;
  graveyard: GraveyardEntry[];
}

// Fame calculation bonuses
const FAME_BONUSES = {
  levelBase: 20,          // fame per level
  levelMax: 200,          // bonus for reaching level 20
  dungeonsCleared: 50,    // fame per dungeon completed
  biomeExplorer: 25,      // bonus per biome visited
  killingSpree: 0.5,      // fame per enemy killed (capped)
  maxKillBonus: 500,      // cap on kill-based fame
};

export class FameManager {
  private data: FameData;

  // Character tracking (reset per life)
  enemiesKilled: number = 0;
  dungeonsCleared: number = 0;
  biomesVisited: Set<string> = new Set();

  constructor() {
    this.data = this.load();
  }

  /** Calculate fame for a dead character */
  calculateFame(level: number, classId: string): {
    baseFame: number;
    bonusFame: number;
    totalFame: number;
    breakdown: { label: string; value: number }[];
  } {
    const breakdown: { label: string; value: number }[] = [];

    // Base fame from level
    const levelFame = level * FAME_BONUSES.levelBase;
    breakdown.push({ label: `Level ${level}`, value: levelFame });

    // Bonus for max level
    let bonusFame = 0;
    if (level >= 20) {
      bonusFame += FAME_BONUSES.levelMax;
      breakdown.push({ label: 'Max Level Bonus', value: FAME_BONUSES.levelMax });
    }

    // Dungeon completions
    const dungeonFame = this.dungeonsCleared * FAME_BONUSES.dungeonsCleared;
    if (dungeonFame > 0) {
      bonusFame += dungeonFame;
      breakdown.push({ label: `${this.dungeonsCleared} Dungeons Cleared`, value: dungeonFame });
    }

    // Biome explorer
    const biomeFame = this.biomesVisited.size * FAME_BONUSES.biomeExplorer;
    if (biomeFame > 0) {
      bonusFame += biomeFame;
      breakdown.push({ label: `${this.biomesVisited.size} Biomes Explored`, value: biomeFame });
    }

    // Kill fame (capped)
    const killFame = Math.min(
      Math.floor(this.enemiesKilled * FAME_BONUSES.killingSpree),
      FAME_BONUSES.maxKillBonus,
    );
    if (killFame > 0) {
      bonusFame += killFame;
      breakdown.push({ label: `${this.enemiesKilled} Enemies Slain`, value: killFame });
    }

    const totalFame = levelFame + bonusFame;

    return { baseFame: levelFame, bonusFame, totalFame, breakdown };
  }

  /** Record a dead character and add fame to total */
  recordDeath(
    classId: string,
    className: string,
    level: number,
    killedBy: string,
    maxBiome: string,
  ): GraveyardEntry {
    const fameResult = this.calculateFame(level, classId);

    const entry: GraveyardEntry = {
      id: `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      classId,
      className,
      level,
      baseFame: fameResult.baseFame,
      bonusFame: fameResult.bonusFame,
      totalFame: fameResult.totalFame,
      killedBy,
      dungeonsCleared: this.dungeonsCleared,
      enemiesKilled: this.enemiesKilled,
      maxBiome,
      timestamp: Date.now(),
    };

    this.data.totalFame += entry.totalFame;
    this.data.graveyard.unshift(entry); // newest first

    // Keep only last 50 entries
    if (this.data.graveyard.length > 50) {
      this.data.graveyard = this.data.graveyard.slice(0, 50);
    }

    this.save();
    this.resetCharacterStats();

    return entry;
  }

  /** Reset per-character tracking for a new life */
  resetCharacterStats(): void {
    this.enemiesKilled = 0;
    this.dungeonsCleared = 0;
    this.biomesVisited = new Set();
  }

  /** Report an enemy kill */
  reportKill(): void {
    this.enemiesKilled++;
  }

  /** Report a dungeon completion */
  reportDungeonClear(): void {
    this.dungeonsCleared++;
  }

  /** Report entering a new biome */
  reportBiome(biome: string): void {
    this.biomesVisited.add(biome);
  }

  /** Get total accumulated fame */
  getTotalFame(): number {
    return this.data.totalFame;
  }

  /** Get graveyard entries */
  getGraveyard(): GraveyardEntry[] {
    return this.data.graveyard;
  }

  // --- Persistence ---

  private load(): FameData {
    try {
      const saved = localStorage.getItem('yggdrasil_fame');
      if (saved) return JSON.parse(saved);
    } catch { /* ignore */ }
    return { totalFame: 0, graveyard: [] };
  }

  private save(): void {
    try {
      localStorage.setItem('yggdrasil_fame', JSON.stringify(this.data));
    } catch { /* localStorage might be full */ }
  }
}
