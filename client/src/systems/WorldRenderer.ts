import Phaser from 'phaser';
import { TILE_SIZE, REALM_SIZE, BiomeType } from '@yggdrasil/shared';
import { getBiomeForDistance } from '@yggdrasil/shared';

/**
 * WorldRenderer: Generates and renders the procedural tilemap world.
 *
 * Uses simplex-style noise (implemented inline to avoid dependencies)
 * to create a 256x256 tile world with concentric biome zones.
 *
 * Biome layout (distance from center):
 *   Center → Niflheim Depths (hardest)
 *   Inner  → Volcanic Wastes
 *   Mid    → Birch Forest
 *   Edge   → Frozen Shores (starter)
 */

// Tile indices in our tileset (matches SpriteGenerator.generateTileSprites)
const TILES = {
  VOID: 0,
  FROZEN_GROUND: 1,
  FROZEN_WALL: 2,
  FOREST_GROUND: 3,
  FOREST_WALL: 4,
  VOLCANIC_GROUND: 5,
  VOLCANIC_WALL: 6,
  NIFLHEIM_GROUND: 7,
  NIFLHEIM_WALL: 8,
  ASGARD_GROUND: 9,
  ASGARD_WALL: 10,
  WATER: 11,
  SNOW: 12,
  PATH: 13,
  BRIDGE: 14,
  RUNE_MARKER: 15,
};

export class WorldRenderer {
  private scene: Phaser.Scene;
  private tilemap!: Phaser.Tilemaps.Tilemap;
  private groundLayer!: Phaser.Tilemaps.TilemapLayer;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /** Generate the world tilemap from a seed */
  generateWorld(seed: number): void {
    const width = REALM_SIZE;
    const height = REALM_SIZE;

    // Initialize noise with seed
    const noise = new SimpleNoise(seed);

    // Create tile data
    const groundData: number[][] = [];

    const centerX = width / 2;
    const centerY = height / 2;
    const maxDist = Math.sqrt(centerX * centerX + centerY * centerY);

    for (let y = 0; y < height; y++) {
      groundData[y] = [];
      for (let x = 0; x < width; x++) {
        // Distance from center (0 = center, 1 = corner)
        const dx = x - centerX;
        const dy = y - centerY;
        const dist = Math.sqrt(dx * dx + dy * dy) / maxDist;

        // Outermost 5 tiles on every edge = solid ice wall (the "flat earth" barrier)
        const edgeDist = Math.min(x, y, width - 1 - x, height - 1 - y);
        if (edgeDist < 5) {
          groundData[y][x] = TILES.FROZEN_WALL;
          continue;
        }

        // Noise for terrain variation
        const noiseVal = noise.noise2D(x * 0.04, y * 0.04);
        const noiseDetail = noise.noise2D(x * 0.12, y * 0.12) * 0.3;

        // Combined elevation
        const elevation = noiseVal + noiseDetail;

        // Get biome based on distance from center
        const biome = getBiomeForDistance(dist);

        // Assign tile based on biome + noise
        groundData[y][x] = this.getTileForBiome(biome.biomeType, elevation, x, y, noise);
      }
    }

    // Create Phaser tilemap from data
    this.tilemap = this.scene.make.tilemap({
      data: groundData,
      tileWidth: TILE_SIZE,
      tileHeight: TILE_SIZE,
    });

    const tileset = this.tilemap.addTilesetImage(
      'tileset',      // tileset name
      'tileset',      // texture key
      TILE_SIZE,
      TILE_SIZE,
      0,             // margin
      0,             // spacing
    )!;

    this.groundLayer = this.tilemap.createLayer(0, tileset, 0, 0)!;
    this.groundLayer.setDepth(0);

    // Set collision on wall tiles
    this.groundLayer.setCollisionBetween(TILES.FROZEN_WALL, TILES.FROZEN_WALL);
    this.groundLayer.setCollision(TILES.FOREST_WALL);
    this.groundLayer.setCollision(TILES.VOLCANIC_WALL);
    this.groundLayer.setCollision(TILES.NIFLHEIM_WALL);
    this.groundLayer.setCollision(TILES.WATER);

    // Note: Collider with player is set up in GameScene.create() after player is created
  }

  /** Get the appropriate tile index for a biome at given noise values */
  private getTileForBiome(
    biome: BiomeType,
    elevation: number,
    x: number, y: number,
    noise: SimpleNoise,
  ): number {
    // Use a second noise layer for wall placement
    const wallNoise = noise.noise2D(x * 0.08 + 100, y * 0.08 + 100);
    const isWall = wallNoise > 0.55; // ~20% walls
    const isWater = elevation < -0.5 && wallNoise < -0.3;

    if (isWater) return TILES.WATER;

    switch (biome) {
      case BiomeType.FrozenShores:
        return isWall ? TILES.FROZEN_WALL : TILES.FROZEN_GROUND;
      case BiomeType.BirchForest:
        return isWall ? TILES.FOREST_WALL : TILES.FOREST_GROUND;
      case BiomeType.VolcanicWastes:
        return isWall ? TILES.VOLCANIC_WALL : TILES.VOLCANIC_GROUND;
      case BiomeType.NiflheimDepths:
        return isWall ? TILES.NIFLHEIM_WALL : TILES.NIFLHEIM_GROUND;
      default:
        return TILES.FROZEN_GROUND;
    }
  }

  /** Get the tilemap for external use (collision setup) */
  getTilemap(): Phaser.Tilemaps.Tilemap {
    return this.tilemap;
  }

  getGroundLayer(): Phaser.Tilemaps.TilemapLayer {
    return this.groundLayer;
  }
}

// ============================================================================
// Simple 2D Noise Implementation (no external dependencies)
// Based on Open Simplex Noise adapted for browser
// ============================================================================

class SimpleNoise {
  private perm: number[];
  private gradients: [number, number][];

  constructor(seed: number) {
    // Create permutation table from seed
    this.perm = new Array(512);
    const base = new Array(256);
    for (let i = 0; i < 256; i++) base[i] = i;

    // Fisher-Yates shuffle with seed
    let s = seed;
    for (let i = 255; i > 0; i--) {
      s = (s * 1664525 + 1013904223) & 0xffffffff;
      const j = ((s >>> 0) % (i + 1));
      [base[i], base[j]] = [base[j], base[i]];
    }

    for (let i = 0; i < 512; i++) {
      this.perm[i] = base[i & 255];
    }

    // 2D gradient vectors
    this.gradients = [
      [1, 0], [-1, 0], [0, 1], [0, -1],
      [1, 1], [-1, 1], [1, -1], [-1, -1],
    ];
  }

  /** 2D noise value at (x, y), returns -1 to 1 */
  noise2D(x: number, y: number): number {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);

    // Fade curves
    const u = this.fade(xf);
    const v = this.fade(yf);

    // Hash corners
    const aa = this.perm[this.perm[X] + Y];
    const ab = this.perm[this.perm[X] + Y + 1];
    const ba = this.perm[this.perm[X + 1] + Y];
    const bb = this.perm[this.perm[X + 1] + Y + 1];

    // Gradient dot products
    const g1 = this.grad(aa, xf, yf);
    const g2 = this.grad(ba, xf - 1, yf);
    const g3 = this.grad(ab, xf, yf - 1);
    const g4 = this.grad(bb, xf - 1, yf - 1);

    // Bilinear interpolation
    const x1 = this.lerp(g1, g2, u);
    const x2 = this.lerp(g3, g4, u);
    return this.lerp(x1, x2, v);
  }

  private fade(t: number): number {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  private lerp(a: number, b: number, t: number): number {
    return a + t * (b - a);
  }

  private grad(hash: number, x: number, y: number): number {
    const g = this.gradients[hash & 7];
    return g[0] * x + g[1] * y;
  }
}
