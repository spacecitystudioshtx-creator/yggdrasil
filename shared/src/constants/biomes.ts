// ============================================================================
// Yggdrasil - Biome Configurations
// ============================================================================

import { BiomeType } from '../types/game-types';
import { BiomeConfig } from '../types/world-types';

/**
 * Biome assignments based on distance from center + noise values.
 *
 * Midgard layout (concentric, like RotMG):
 *   Edge (dist > 0.75)   → Frozen Shores (difficulty 1-3)
 *   Mid  (dist 0.4-0.75) → Birch Forest (difficulty 4-6)
 *   Inner(dist 0.15-0.4) → Volcanic Wastes (difficulty 7-9)
 *   Core (dist < 0.15)   → Niflheim Depths (difficulty 10)
 */
export const BIOME_CONFIGS: BiomeConfig[] = [
  {
    biomeType: BiomeType.FrozenShores,
    name: 'Frozen Shores',
    elevationRange: [0.0, 0.3],
    moistureRange: [0.0, 1.0],
    difficultyLevel: 2,
    enemyDensity: 3,
    groundColor: '#c8dbe5',   // icy blue-grey
    accentColor: '#9ab8c9',
    wallColor: '#6a8fa3',
  },
  {
    biomeType: BiomeType.BirchForest,
    name: 'Birch Forest',
    elevationRange: [0.3, 0.55],
    moistureRange: [0.0, 1.0],
    difficultyLevel: 5,
    enemyDensity: 5,
    groundColor: '#7a9b5a',   // mossy green
    accentColor: '#5c7a3e',
    wallColor: '#3d5228',
  },
  {
    biomeType: BiomeType.VolcanicWastes,
    name: 'Volcanic Wastes',
    elevationRange: [0.55, 0.8],
    moistureRange: [0.0, 1.0],
    difficultyLevel: 8,
    enemyDensity: 7,
    groundColor: '#5c3a2e',   // charred brown
    accentColor: '#8b4513',
    wallColor: '#2d1810',
  },
  {
    biomeType: BiomeType.NiflheimDepths,
    name: 'Niflheim Depths',
    elevationRange: [0.8, 1.0],
    moistureRange: [0.0, 1.0],
    difficultyLevel: 10,
    enemyDensity: 10,
    groundColor: '#1a1a2e',   // dark purple-black
    accentColor: '#3d1f5c',
    wallColor: '#0d0d15',
  },
];

/**
 * Get biome for a given normalized distance from center (0=center, 1=edge)
 * Note: inverted from elevation — edge = easy, center = hard
 */
export function getBiomeForDistance(distFromCenter: number): BiomeConfig {
  if (distFromCenter > 0.75) return BIOME_CONFIGS[0]; // Frozen Shores
  if (distFromCenter > 0.40) return BIOME_CONFIGS[1]; // Birch Forest
  if (distFromCenter > 0.15) return BIOME_CONFIGS[2]; // Volcanic Wastes
  return BIOME_CONFIGS[3];                              // Niflheim Depths
}
