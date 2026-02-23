// ============================================================================
// Yggdrasil - Combat Type Definitions
// ============================================================================

import { BulletPatternType, DamageType } from './game-types';

export interface ProjectilePattern {
  patternId: string;
  type: BulletPatternType;
  projectileCount: number;
  projectileSpeed: number;       // pixels per second
  projectileDamage: number;
  projectileLifetime: number;    // seconds
  projectileSize: number;        // radius in pixels
  spreadAngle: number;           // degrees (for shotgun: 30-90)
  rotationSpeed: number;         // degrees/sec (for spiral)
  fireRate: number;              // shots per second
  burstCount: number;            // shots per burst (0 = continuous)
  burstDelay: number;            // seconds between bursts
  damageType: DamageType;
  piercing: boolean;
  boomerang: boolean;
  amplitude: number;             // wavy projectile amplitude
  frequency: number;             // wavy projectile frequency
  color: string;                 // hex color for the projectile
}

export interface LootDrop {
  itemId: string;
  dropChance: number;            // 0.0 - 1.0
  minAmount: number;
  maxAmount: number;
  soulbound: boolean;
}

export interface BossPhase {
  healthThreshold: number;       // 0.0-1.0, triggers at this % remaining
  phaseName: string;
  dialogue: string;
  patternIds: string[];          // active patterns during this phase
  spawnEnemyIds: string[];       // minions to summon
  speedMultiplier: number;
  defenseMultiplier: number;
}

export interface DamageInfo {
  sourceId: string;
  targetId: string;
  baseDamage: number;
  finalDamage: number;
  damageType: DamageType;
  isCritical: boolean;
  isPlayerSource: boolean;
}
