// ============================================================================
// Yggdrasil - Game Balance Constants
// ============================================================================

// --- XP Curve ---
// Level 1-20, RotMG style: fast early leveling, ~30 min to cap
export const MAX_LEVEL = 20;

// XP required to reach level N (cumulative)
export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  // Quadratic curve: feels fast early, slows mid, manageable at high
  return Math.floor(50 * (level - 1) * (level - 1));
}

// Total XP to reach max level
export const XP_TO_MAX = xpForLevel(MAX_LEVEL); // 18,050

// --- Stat Potion Values ---
export const STAT_POTION_INCREMENT = 1;  // Each rune stone adds 1 to a stat

// --- Loot ---
export const LOOT_BAG_LIFETIME = 30;     // seconds before bag despawns
export const SOULBOUND_THRESHOLD = 0.15; // deal 15% of enemy max HP to qualify

// --- Combat ---
export const BASE_FIRE_RATE = 1.5;       // attacks per second at 0 dex
export const DEX_FIRE_RATE_BONUS = 0.02; // +0.02 aps per dex point
export const DEFENSE_REDUCTION_CAP = 0.85; // max 85% damage reduction from defense

// Defense formula: damage_taken = max(damage - defense, damage * 0.15)
// This means defense can never reduce damage below 15% of base
export function calculateDamage(baseDamage: number, defense: number): number {
  const reduced = baseDamage - defense;
  const minimum = Math.floor(baseDamage * (1 - DEFENSE_REDUCTION_CAP));
  return Math.max(reduced, minimum, 0);
}

// --- Movement ---
export const BASE_MOVE_SPEED = 80;       // pixels/sec at 0 speed stat
export const SPEED_BONUS = 1.5;          // +1.5 px/s per speed point

export function calculateMoveSpeed(speedStat: number): number {
  return BASE_MOVE_SPEED + speedStat * SPEED_BONUS;
}

// --- Regen ---
export const BASE_HP_REGEN = 1;          // HP per second at 0 vit
export const VIT_HP_REGEN_BONUS = 0.12;  // +0.12 hp/s per vit

export const BASE_MP_REGEN = 0.5;        // MP per second at 0 wis
export const WIS_MP_REGEN_BONUS = 0.12;  // +0.12 mp/s per wis

// --- World ---
export const REALM_SIZE = 256;           // tiles per side
export const TILE_SIZE = 16;             // pixels per tile
export const REALM_PIXEL_SIZE = REALM_SIZE * TILE_SIZE; // 4096 px
