// ============================================================================
// Yggdrasil - World Type Definitions
// ============================================================================

import { BiomeType } from './game-types';

export interface TileDefinition {
  tileId: number;
  name: string;
  walkable: boolean;
  movementModifier: number;      // 1.0 = normal, 0.5 = slow, 0 = wall
}

export interface BiomeConfig {
  biomeType: BiomeType;
  name: string;
  elevationRange: [number, number];    // noise value range [min, max]
  moistureRange: [number, number];
  difficultyLevel: number;             // 1-10
  enemyDensity: number;               // max enemies per 16x16 chunk
  groundColor: string;                 // hex
  accentColor: string;                 // hex
  wallColor: string;                   // hex
}

export interface WorldConfig {
  seed: number;
  width: number;                       // tiles (default 256)
  height: number;                      // tiles (default 256)
  tileSize: number;                    // pixels (8 or 16)
  noiseScale: number;                  // noise frequency
  noiseOctaves: number;
  noisePersistence: number;
  noiseLacunarity: number;
}

export interface ChunkCoord {
  cx: number;
  cy: number;
}

export const CHUNK_SIZE = 16;          // tiles per chunk side
