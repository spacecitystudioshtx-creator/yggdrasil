import { BiomeType, BulletPatternType, DamageType } from '@yggdrasil/shared';
import { ProjectilePattern, BossPhase, LootDrop } from '@yggdrasil/shared';

// ============================================================================
// Dungeon Definitions — Norse realm-themed instanced content
// ============================================================================

export interface DungeonRoomDef {
  type: 'combat' | 'treasure' | 'trap' | 'boss';
  enemyCount: number;        // base enemies for combat rooms
  hasTreasure: boolean;
}

export interface DungeonBossDef {
  name: string;
  textureKey: string;
  maxHp: number;
  defense: number;
  speed: number;
  phases: BossPhase[];
  patterns: Record<string, ProjectilePattern>;
  loot: LootDrop[];
}

export interface DungeonDef {
  id: string;
  name: string;
  description: string;
  biomeType: BiomeType;
  difficulty: number;         // 1-10 base difficulty
  minRooms: number;
  maxRooms: number;
  roomWidth: number;          // tiles
  roomHeight: number;
  tileGround: number;         // tile index for ground
  tileWall: number;            // tile index for walls
  groundColor: string;
  wallColor: string;
  accentColor: string;
  enemyTextures: string[];
  portalDropChance: number;    // 0-1 chance of portal from biome enemy kill
  boss: DungeonBossDef;
  lootTable: string;           // key into LOOT_TABLES
}

// ============================================================================
// Boss Projectile Patterns
// ============================================================================

const BOSS_PATTERNS: Record<string, ProjectilePattern> = {
  // --- Frostheim Caverns boss patterns ---
  frost_radial: {
    patternId: 'frost_radial',
    type: BulletPatternType.Radial,
    projectileCount: 12,
    projectileSpeed: 150,
    projectileDamage: 15,
    projectileLifetime: 3,
    projectileSize: 3,
    spreadAngle: 360,
    rotationSpeed: 0,
    fireRate: 0.8,
    burstCount: 0,
    burstDelay: 0,
    damageType: DamageType.Ice,
    piercing: false,
    boomerang: false,
    amplitude: 0,
    frequency: 0,
    color: '#88ccff',
  },
  frost_spiral: {
    patternId: 'frost_spiral',
    type: BulletPatternType.Spiral,
    projectileCount: 3,
    projectileSpeed: 130,
    projectileDamage: 12,
    projectileLifetime: 3.5,
    projectileSize: 3,
    spreadAngle: 120,
    rotationSpeed: 90,
    fireRate: 3,
    burstCount: 0,
    burstDelay: 0,
    damageType: DamageType.Ice,
    piercing: false,
    boomerang: false,
    amplitude: 0,
    frequency: 0,
    color: '#aaddff',
  },
  frost_aimed: {
    patternId: 'frost_aimed',
    type: BulletPatternType.Aimed,
    projectileCount: 1,
    projectileSpeed: 200,
    projectileDamage: 25,
    projectileLifetime: 2,
    projectileSize: 4,
    spreadAngle: 0,
    rotationSpeed: 0,
    fireRate: 1.5,
    burstCount: 3,
    burstDelay: 0.2,
    damageType: DamageType.Ice,
    piercing: false,
    boomerang: false,
    amplitude: 0,
    frequency: 0,
    color: '#ffffff',
  },

  // --- Verdant Hollows boss patterns ---
  poison_shotgun: {
    patternId: 'poison_shotgun',
    type: BulletPatternType.Shotgun,
    projectileCount: 7,
    projectileSpeed: 160,
    projectileDamage: 14,
    projectileLifetime: 2.5,
    projectileSize: 3,
    spreadAngle: 60,
    rotationSpeed: 0,
    fireRate: 1.0,
    burstCount: 0,
    burstDelay: 0,
    damageType: DamageType.Poison,
    piercing: false,
    boomerang: false,
    amplitude: 0,
    frequency: 0,
    color: '#44ff44',
  },
  poison_wall: {
    patternId: 'poison_wall',
    type: BulletPatternType.Wall,
    projectileCount: 15,
    projectileSpeed: 100,
    projectileDamage: 10,
    projectileLifetime: 4,
    projectileSize: 3,
    spreadAngle: 180,
    rotationSpeed: 0,
    fireRate: 0.5,
    burstCount: 0,
    burstDelay: 0,
    damageType: DamageType.Poison,
    piercing: true,
    boomerang: false,
    amplitude: 0,
    frequency: 0,
    color: '#88ff88',
  },
  root_star: {
    patternId: 'root_star',
    type: BulletPatternType.Star,
    projectileCount: 5,
    projectileSpeed: 120,
    projectileDamage: 18,
    projectileLifetime: 3,
    projectileSize: 3,
    spreadAngle: 72,
    rotationSpeed: 30,
    fireRate: 0.6,
    burstCount: 0,
    burstDelay: 0,
    damageType: DamageType.Poison,
    piercing: false,
    boomerang: false,
    amplitude: 0,
    frequency: 0,
    color: '#66aa44',
  },

  // --- Muspelheim Forge boss patterns ---
  fire_burst: {
    patternId: 'fire_burst',
    type: BulletPatternType.Burst,
    projectileCount: 20,
    projectileSpeed: 180,
    projectileDamage: 20,
    projectileLifetime: 2.5,
    projectileSize: 4,
    spreadAngle: 360,
    rotationSpeed: 0,
    fireRate: 0.4,
    burstCount: 20,
    burstDelay: 0.05,
    damageType: DamageType.Fire,
    piercing: false,
    boomerang: false,
    amplitude: 0,
    frequency: 0,
    color: '#ff4400',
  },
  fire_spiral: {
    patternId: 'fire_spiral',
    type: BulletPatternType.Spiral,
    projectileCount: 4,
    projectileSpeed: 140,
    projectileDamage: 18,
    projectileLifetime: 3,
    projectileSize: 3,
    spreadAngle: 90,
    rotationSpeed: 120,
    fireRate: 4,
    burstCount: 0,
    burstDelay: 0,
    damageType: DamageType.Fire,
    piercing: false,
    boomerang: false,
    amplitude: 0,
    frequency: 0,
    color: '#ffaa00',
  },
  fire_aimed: {
    patternId: 'fire_aimed',
    type: BulletPatternType.Aimed,
    projectileCount: 1,
    projectileSpeed: 250,
    projectileDamage: 35,
    projectileLifetime: 2,
    projectileSize: 5,
    spreadAngle: 0,
    rotationSpeed: 0,
    fireRate: 0.8,
    burstCount: 5,
    burstDelay: 0.15,
    damageType: DamageType.Fire,
    piercing: true,
    boomerang: false,
    amplitude: 0,
    frequency: 0,
    color: '#ff6600',
  },

  // --- Helheim Sanctum boss patterns ---
  dark_radial: {
    patternId: 'dark_radial',
    type: BulletPatternType.Radial,
    projectileCount: 16,
    projectileSpeed: 120,
    projectileDamage: 22,
    projectileLifetime: 4,
    projectileSize: 4,
    spreadAngle: 360,
    rotationSpeed: 0,
    fireRate: 0.6,
    burstCount: 0,
    burstDelay: 0,
    damageType: DamageType.Dark,
    piercing: false,
    boomerang: false,
    amplitude: 0,
    frequency: 0,
    color: '#8844dd',
  },
  dark_wall: {
    patternId: 'dark_wall',
    type: BulletPatternType.Wall,
    projectileCount: 20,
    projectileSpeed: 90,
    projectileDamage: 18,
    projectileLifetime: 5,
    projectileSize: 4,
    spreadAngle: 180,
    rotationSpeed: 0,
    fireRate: 0.3,
    burstCount: 0,
    burstDelay: 0,
    damageType: DamageType.Dark,
    piercing: true,
    boomerang: false,
    amplitude: 0,
    frequency: 0,
    color: '#aa66ff',
  },
  soul_burst: {
    patternId: 'soul_burst',
    type: BulletPatternType.Burst,
    projectileCount: 30,
    projectileSpeed: 160,
    projectileDamage: 25,
    projectileLifetime: 3,
    projectileSize: 3,
    spreadAngle: 360,
    rotationSpeed: 0,
    fireRate: 0.3,
    burstCount: 30,
    burstDelay: 0.03,
    damageType: DamageType.Dark,
    piercing: false,
    boomerang: false,
    amplitude: 0,
    frequency: 0,
    color: '#cc88ff',
  },
};

// ============================================================================
// Dungeon Definitions
// ============================================================================

export const DUNGEON_DEFS: Record<string, DungeonDef> = {
  frostheim_caverns: {
    id: 'frostheim_caverns',
    name: 'Frostheim Caverns',
    description: 'An icy cave system prowled by frost giants and their kin.',
    biomeType: BiomeType.FrozenShores,
    difficulty: 3,
    minRooms: 4,
    maxRooms: 6,
    roomWidth: 18,
    roomHeight: 14,
    tileGround: 1,
    tileWall: 2,
    groundColor: '#c8dbe5',
    wallColor: '#6a8fa3',
    accentColor: '#9ab8c9',
    enemyTextures: ['enemy_small'],
    portalDropChance: 0.06,
    lootTable: 'mid',
    boss: {
      name: 'Hrimthursar',
      textureKey: 'enemy_boss',
      maxHp: 800,
      defense: 5,
      speed: 40,
      phases: [
        {
          healthThreshold: 1.0,
          phaseName: 'Awakening',
          dialogue: 'You dare enter my frozen domain!',
          patternIds: ['frost_radial'],
          spawnEnemyIds: [],
          speedMultiplier: 1.0,
          defenseMultiplier: 1.0,
        },
        {
          healthThreshold: 0.6,
          phaseName: 'Frost Storm',
          dialogue: 'Feel the bite of Fimbulwinter!',
          patternIds: ['frost_radial', 'frost_spiral'],
          spawnEnemyIds: [],
          speedMultiplier: 1.3,
          defenseMultiplier: 1.0,
        },
        {
          healthThreshold: 0.25,
          phaseName: 'Blizzard',
          dialogue: 'I AM THE COLD ITSELF!',
          patternIds: ['frost_spiral', 'frost_aimed'],
          spawnEnemyIds: [],
          speedMultiplier: 1.6,
          defenseMultiplier: 0.8,
        },
      ],
      patterns: {
        frost_radial: BOSS_PATTERNS.frost_radial,
        frost_spiral: BOSS_PATTERNS.frost_spiral,
        frost_aimed: BOSS_PATTERNS.frost_aimed,
      },
      loot: [
        { itemId: 'potion_hp_large', dropChance: 0.8, minAmount: 1, maxAmount: 2, soulbound: false },
        { itemId: 'rune_defense', dropChance: 0.3, minAmount: 1, maxAmount: 1, soulbound: false },
        { itemId: 'rune_vitality', dropChance: 0.2, minAmount: 1, maxAmount: 1, soulbound: false },
        { itemId: 'sword_t3', dropChance: 0.15, minAmount: 1, maxAmount: 1, soulbound: false },
        { itemId: 'armor_heavy_t0', dropChance: 0.1, minAmount: 1, maxAmount: 1, soulbound: false },
      ],
    },
  },

  verdant_hollows: {
    id: 'verdant_hollows',
    name: 'Verdant Hollows',
    description: 'Twisted roots of Yggdrasil corrupted by Nidhogg\'s poison.',
    biomeType: BiomeType.BirchForest,
    difficulty: 5,
    minRooms: 5,
    maxRooms: 7,
    roomWidth: 20,
    roomHeight: 16,
    tileGround: 3,
    tileWall: 4,
    groundColor: '#7a9b5a',
    wallColor: '#3d5228',
    accentColor: '#5c7a3e',
    enemyTextures: ['enemy_small', 'enemy_medium'],
    portalDropChance: 0.05,
    lootTable: 'mid',
    boss: {
      name: 'Nidhogg\'s Spawn',
      textureKey: 'enemy_boss',
      maxHp: 1500,
      defense: 8,
      speed: 50,
      phases: [
        {
          healthThreshold: 1.0,
          phaseName: 'Emergence',
          dialogue: 'The roots... they hunger...',
          patternIds: ['poison_shotgun'],
          spawnEnemyIds: [],
          speedMultiplier: 1.0,
          defenseMultiplier: 1.0,
        },
        {
          healthThreshold: 0.65,
          phaseName: 'Toxic Bloom',
          dialogue: 'My venom seeps through all!',
          patternIds: ['poison_shotgun', 'root_star'],
          spawnEnemyIds: [],
          speedMultiplier: 1.2,
          defenseMultiplier: 1.0,
        },
        {
          healthThreshold: 0.3,
          phaseName: 'Root Storm',
          dialogue: 'THE WORLD TREE SCREAMS!',
          patternIds: ['poison_wall', 'root_star', 'poison_shotgun'],
          spawnEnemyIds: [],
          speedMultiplier: 1.5,
          defenseMultiplier: 0.7,
        },
      ],
      patterns: {
        poison_shotgun: BOSS_PATTERNS.poison_shotgun,
        poison_wall: BOSS_PATTERNS.poison_wall,
        root_star: BOSS_PATTERNS.root_star,
      },
      loot: [
        { itemId: 'potion_hp_large', dropChance: 0.9, minAmount: 1, maxAmount: 3, soulbound: false },
        { itemId: 'rune_attack', dropChance: 0.25, minAmount: 1, maxAmount: 1, soulbound: false },
        { itemId: 'rune_speed', dropChance: 0.2, minAmount: 1, maxAmount: 1, soulbound: false },
        { itemId: 'staff_t5', dropChance: 0.08, minAmount: 1, maxAmount: 1, soulbound: false },
        { itemId: 'bow_t5', dropChance: 0.08, minAmount: 1, maxAmount: 1, soulbound: false },
      ],
    },
  },

  muspelheim_forge: {
    id: 'muspelheim_forge',
    name: 'Muspelheim Forge',
    description: 'The volcanic forge of Surtr\'s lieutenant. Flames dance eternally.',
    biomeType: BiomeType.VolcanicWastes,
    difficulty: 8,
    minRooms: 5,
    maxRooms: 8,
    roomWidth: 22,
    roomHeight: 18,
    tileGround: 5,
    tileWall: 6,
    groundColor: '#5c3a2e',
    wallColor: '#8b2500',
    accentColor: '#8b4513',
    enemyTextures: ['enemy_medium'],
    portalDropChance: 0.04,
    lootTable: 'high',
    boss: {
      name: 'Surtr\'s Lieutenant',
      textureKey: 'enemy_boss',
      maxHp: 3000,
      defense: 12,
      speed: 55,
      phases: [
        {
          healthThreshold: 1.0,
          phaseName: 'Ignition',
          dialogue: 'The forge awakens for you, mortal!',
          patternIds: ['fire_aimed'],
          spawnEnemyIds: [],
          speedMultiplier: 1.0,
          defenseMultiplier: 1.0,
        },
        {
          healthThreshold: 0.7,
          phaseName: 'Inferno',
          dialogue: 'Burn in the fires of Muspelheim!',
          patternIds: ['fire_spiral', 'fire_aimed'],
          spawnEnemyIds: [],
          speedMultiplier: 1.3,
          defenseMultiplier: 1.0,
        },
        {
          healthThreshold: 0.35,
          phaseName: 'Ragnarok\'s Herald',
          dialogue: 'I CARRY SURTR\'S FLAME!',
          patternIds: ['fire_burst', 'fire_spiral', 'fire_aimed'],
          spawnEnemyIds: [],
          speedMultiplier: 1.8,
          defenseMultiplier: 0.6,
        },
      ],
      patterns: {
        fire_burst: BOSS_PATTERNS.fire_burst,
        fire_spiral: BOSS_PATTERNS.fire_spiral,
        fire_aimed: BOSS_PATTERNS.fire_aimed,
      },
      loot: [
        { itemId: 'potion_hp_large', dropChance: 1.0, minAmount: 2, maxAmount: 4, soulbound: false },
        { itemId: 'rune_attack', dropChance: 0.4, minAmount: 1, maxAmount: 1, soulbound: false },
        { itemId: 'rune_life', dropChance: 0.3, minAmount: 1, maxAmount: 1, soulbound: false },
        { itemId: 'sword_t6', dropChance: 0.1, minAmount: 1, maxAmount: 1, soulbound: false },
        { itemId: 'armor_heavy_t5', dropChance: 0.08, minAmount: 1, maxAmount: 1, soulbound: false },
        { itemId: 'sword_t10', dropChance: 0.02, minAmount: 1, maxAmount: 1, soulbound: true },
      ],
    },
  },

  helheim_sanctum: {
    id: 'helheim_sanctum',
    name: 'Helheim Sanctum',
    description: 'The domain of Hel herself. The dead do not rest here.',
    biomeType: BiomeType.NiflheimDepths,
    difficulty: 10,
    minRooms: 6,
    maxRooms: 9,
    roomWidth: 24,
    roomHeight: 20,
    tileGround: 7,
    tileWall: 8,
    groundColor: '#1a1a2e',
    wallColor: '#0d0d15',
    accentColor: '#3d1f5c',
    enemyTextures: ['enemy_medium'],
    portalDropChance: 0.03,
    lootTable: 'godlands',
    boss: {
      name: 'Hel, Daughter of Loki',
      textureKey: 'enemy_boss',
      maxHp: 5000,
      defense: 15,
      speed: 60,
      phases: [
        {
          healthThreshold: 1.0,
          phaseName: 'Sovereign of Death',
          dialogue: 'All who enter my realm... stay.',
          patternIds: ['dark_radial'],
          spawnEnemyIds: [],
          speedMultiplier: 1.0,
          defenseMultiplier: 1.0,
        },
        {
          healthThreshold: 0.7,
          phaseName: 'Soul Harvest',
          dialogue: 'Your soul is already mine!',
          patternIds: ['dark_radial', 'dark_wall'],
          spawnEnemyIds: [],
          speedMultiplier: 1.2,
          defenseMultiplier: 1.0,
        },
        {
          healthThreshold: 0.4,
          phaseName: 'Death Incarnate',
          dialogue: 'I command the legions of the dead!',
          patternIds: ['dark_wall', 'soul_burst'],
          spawnEnemyIds: [],
          speedMultiplier: 1.5,
          defenseMultiplier: 1.0,
        },
        {
          healthThreshold: 0.15,
          phaseName: 'Hel Unleashed',
          dialogue: 'DEATH... IS... EVERYTHING!',
          patternIds: ['dark_radial', 'dark_wall', 'soul_burst'],
          spawnEnemyIds: [],
          speedMultiplier: 2.0,
          defenseMultiplier: 0.5,
        },
      ],
      patterns: {
        dark_radial: BOSS_PATTERNS.dark_radial,
        dark_wall: BOSS_PATTERNS.dark_wall,
        soul_burst: BOSS_PATTERNS.soul_burst,
      },
      loot: [
        { itemId: 'potion_hp_large', dropChance: 1.0, minAmount: 3, maxAmount: 5, soulbound: false },
        { itemId: 'rune_life', dropChance: 0.5, minAmount: 1, maxAmount: 2, soulbound: false },
        { itemId: 'rune_mana', dropChance: 0.4, minAmount: 1, maxAmount: 1, soulbound: false },
        { itemId: 'rune_attack', dropChance: 0.4, minAmount: 1, maxAmount: 1, soulbound: false },
        { itemId: 'rune_defense', dropChance: 0.4, minAmount: 1, maxAmount: 1, soulbound: false },
        { itemId: 'sword_t10', dropChance: 0.05, minAmount: 1, maxAmount: 1, soulbound: true },
        { itemId: 'ring_t4', dropChance: 0.1, minAmount: 1, maxAmount: 1, soulbound: false },
      ],
    },
  },
};

/** Get dungeon definition by ID */
export function getDungeon(id: string): DungeonDef | undefined {
  return DUNGEON_DEFS[id];
}

/** Get the dungeon that drops from a given biome */
export function getDungeonForBiome(biomeType: BiomeType): DungeonDef | undefined {
  return Object.values(DUNGEON_DEFS).find(d => d.biomeType === biomeType);
}

/** Get all dungeon definitions */
export function getAllDungeons(): DungeonDef[] {
  return Object.values(DUNGEON_DEFS);
}
