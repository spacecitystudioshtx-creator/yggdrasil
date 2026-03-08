import Phaser from 'phaser';
import { TILE_SIZE, REALM_SIZE } from '@yggdrasil/shared';
import { getBiomeForDistance } from '@yggdrasil/shared';
import { angleBetween, distanceBetween, randomFloat, randomInt } from '../utils/MathUtils';

/**
 * EnemyManager: Spawns, updates, and manages all enemies in the realm.
 *
 * Chunk-based spawning: divides world into 16x16-tile chunks.
 * Enemies only spawn/update near the player (within render distance).
 * Each enemy has simple AI: wander, detect player, fire bullet patterns.
 */

const CHUNK_SIZE = 16; // tiles
const SPAWN_RADIUS_CHUNKS = 4; // spawn enemies within 4 chunks of player
const DESPAWN_DISTANCE = CHUNK_SIZE * TILE_SIZE * 6; // despawn if this far
const MAX_ENEMIES = 60;
const SPAWN_CHECK_INTERVAL = 2.0; // seconds between spawn checks

interface EnemyData {
  level: number;
  maxHp: number;
  hp: number;
  damage: number;
  speed: number;
  aggroRange: number;
  fireRate: number;
  fireCooldown: number;
  behavior: 'wander' | 'chase';
  wanderAngle: number;
  wanderTimer: number;
  textureKey: string;
  patternType: 'aimed' | 'radial' | 'shotgun';
  projectileSpeed: number;
  projectileTexture: string;
}

export class EnemyManager {
  private scene: Phaser.Scene;
  enemyGroup: Phaser.Physics.Arcade.Group;
  private spawnTimer: number = 0;
  private worldPixelSize: number;

  // Health bar graphics
  private healthBars: Map<Phaser.Physics.Arcade.Sprite, Phaser.GameObjects.Graphics> = new Map();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.worldPixelSize = REALM_SIZE * TILE_SIZE;

    this.enemyGroup = scene.physics.add.group({
      classType: Phaser.Physics.Arcade.Sprite,
      runChildUpdate: false,
    });
  }

  /** Spawn initial enemies around the player's starting position */
  spawnInitialEnemies(playerX: number, playerY: number): void {
    // Spawn fewer enemies, and further away so player has breathing room
    for (let i = 0; i < 8; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 500 + Math.random() * 600; // 500-1100px away (safe buffer)
      const x = playerX + Math.cos(angle) * dist;
      const y = playerY + Math.sin(angle) * dist;

      // Keep within world bounds
      if (x < 32 || x > this.worldPixelSize - 32 || y < 32 || y > this.worldPixelSize - 32) {
        continue;
      }
      this.spawnEnemyAt(x, y);
    }
  }

  update(dt: number, playerX: number, playerY: number): void {
    // Periodic spawn check
    this.spawnTimer += dt;
    if (this.spawnTimer >= SPAWN_CHECK_INTERVAL) {
      this.spawnTimer = 0;
      this.spawnNearPlayer(playerX, playerY);
    }

    // Update each active enemy
    this.enemyGroup.getChildren().forEach((child) => {
      const enemy = child as Phaser.Physics.Arcade.Sprite;
      if (!enemy.active) return;

      // Despawn if too far from player
      const dist = distanceBetween(enemy.x, enemy.y, playerX, playerY);
      if (dist > DESPAWN_DISTANCE) {
        this.destroyEnemy(enemy);
        return;
      }

      this.updateEnemy(enemy, dt, playerX, playerY);
    });
  }

  /** Update a single enemy's AI */
  private updateEnemy(
    enemy: Phaser.Physics.Arcade.Sprite,
    dt: number,
    playerX: number,
    playerY: number,
  ): void {
    const data = enemy.getData('enemyData') as EnemyData;
    if (!data) return;

    const dist = distanceBetween(enemy.x, enemy.y, playerX, playerY);
    const aggroRange = data.aggroRange * TILE_SIZE;

    if (dist < aggroRange) {
      // --- Chase & Attack ---
      data.behavior = 'chase';

      // Move toward player (but maintain distance for ranged enemies)
      const minDist = 80; // don't walk into the player
      if (dist > minDist) {
        const angle = angleBetween(enemy.x, enemy.y, playerX, playerY);
        enemy.setVelocity(
          Math.cos(angle) * data.speed,
          Math.sin(angle) * data.speed,
        );
      } else {
        enemy.setVelocity(0, 0);
      }

      // Fire at player
      data.fireCooldown -= dt;
      if (data.fireCooldown <= 0) {
        data.fireCooldown = 1.0 / data.fireRate;
        this.fireEnemyPattern(enemy, data, playerX, playerY);
      }
    } else {
      // --- Wander ---
      data.behavior = 'wander';
      data.wanderTimer -= dt;
      if (data.wanderTimer <= 0) {
        data.wanderAngle = Math.random() * Math.PI * 2;
        data.wanderTimer = 2 + Math.random() * 3;
      }
      enemy.setVelocity(
        Math.cos(data.wanderAngle) * data.speed * 0.3,
        Math.sin(data.wanderAngle) * data.speed * 0.3,
      );
    }

    // Update health bar
    this.updateHealthBar(enemy, data);
  }

  /** Fire bullet pattern from enemy toward player */
  private fireEnemyPattern(
    enemy: Phaser.Physics.Arcade.Sprite,
    data: EnemyData,
    playerX: number,
    playerY: number,
  ): void {
    const gameScene = this.scene as any;
    const pm = gameScene.projectileManager;
    if (!pm) return;

    const baseAngle = angleBetween(enemy.x, enemy.y, playerX, playerY);

    switch (data.patternType) {
      case 'aimed':
        // Single aimed shot
        pm.fireEnemyProjectile(
          enemy.x, enemy.y,
          baseAngle,
          data.projectileSpeed,
          data.damage,
          2000,
          data.projectileTexture,
        );
        break;

      case 'radial':
        // 8 projectiles in a circle
        for (let i = 0; i < 8; i++) {
          const angle = (Math.PI * 2 / 8) * i;
          pm.fireEnemyProjectile(
            enemy.x, enemy.y,
            angle,
            data.projectileSpeed * 0.8,
            data.damage,
            2500,
            data.projectileTexture,
          );
        }
        break;

      case 'shotgun':
        // 3-5 projectiles in a cone
        const count = 3 + Math.floor(Math.random() * 3);
        const spread = 0.6; // radians
        for (let i = 0; i < count; i++) {
          const angle = baseAngle - spread / 2 + (spread / (count - 1)) * i;
          pm.fireEnemyProjectile(
            enemy.x, enemy.y,
            angle,
            data.projectileSpeed * (0.9 + Math.random() * 0.2),
            data.damage,
            1800,
            data.projectileTexture,
          );
        }
        break;
    }
  }

  /** Spawn enemies near the player based on biome */
  private spawnNearPlayer(playerX: number, playerY: number): void {
    const activeCount = this.enemyGroup.countActive();
    if (activeCount >= MAX_ENEMIES) return;

    const toSpawn = Math.min(5, MAX_ENEMIES - activeCount);

    for (let i = 0; i < toSpawn; i++) {
      // Spawn at random position within spawn radius but not too close
      const angle = Math.random() * Math.PI * 2;
      const dist = 400 + Math.random() * 600; // 400-1000 px away
      const x = playerX + Math.cos(angle) * dist;
      const y = playerY + Math.sin(angle) * dist;

      // Keep within world bounds
      if (x < 32 || x > this.worldPixelSize - 32 || y < 32 || y > this.worldPixelSize - 32) {
        continue;
      }

      this.spawnEnemyAt(x, y);
    }
  }

  /** Spawn a single enemy at the given position */
  private spawnEnemyAt(x: number, y: number): void {
    // Determine difficulty based on distance from center
    const centerX = this.worldPixelSize / 2;
    const centerY = this.worldPixelSize / 2;
    const maxDist = this.worldPixelSize / 2;
    const dist = distanceBetween(x, y, centerX, centerY);
    const normalizedDist = Math.min(1, dist / maxDist);

    const biome = getBiomeForDistance(normalizedDist);
    const difficulty = biome.difficultyLevel;

    // ----------------------------------------------------------------
    // Outer Frozen Shores (dist > 0.75, difficulty 2):
    //   Easy, solo-able fights. Slow single aimed shots, low HP/damage.
    //   Level 1-2.
    //
    // Birch Forest (dist 0.4-0.75, difficulty 5):
    //   Moderate challenge. Faster shots, sometimes shotgun, more HP.
    //   Dodgeable but requires skill. Level 4-6.
    //
    // Volcanic Wastes (dist 0.15-0.4, difficulty 8):
    //   Hard. Radial + shotgun patterns, high damage. Level 8-10.
    //
    // Niflheim Depths (dist < 0.15, difficulty 10):
    //   Brutal. All patterns, very fast, very high HP. Level 12+.
    // ----------------------------------------------------------------
    let level: number;
    let isSmall: boolean;
    let hp: number;
    let damage: number;
    let speed: number;
    let aggroRange: number;
    let fireRate: number;
    let projectileSpeed: number;

    if (difficulty <= 2) {
      // Outer Frozen Shores — beginner friendly, 1v1 easy
      level = randomInt(1, 2);
      isSmall = true;
      hp = 20 + level * 10;         // 30-40 HP — dies in 2-3 hits
      damage = 2 + level;            // 3-4 damage per hit
      speed = 28 + level * 3;        // slow
      aggroRange = 5;                // only aggros when fairly close
      fireRate = 0.22;               // ~1 shot every 4.5s — easy to dodge
      projectileSpeed = 90;          // slow projectiles
    } else if (difficulty <= 5) {
      // Birch Forest — moderate, requires dodging
      level = randomInt(3, 6);
      isSmall = Math.random() < 0.5;
      hp = 50 + level * 18;
      damage = 5 + level * 2;        // more meaningful damage
      speed = 40 + level * 3;
      aggroRange = 7;
      fireRate = 0.38;               // ~1 shot every 2.6s — readable
      projectileSpeed = 130 + level * 8;
    } else if (difficulty <= 8) {
      // Volcanic Wastes — hard
      level = randomInt(7, 10);
      isSmall = false;
      hp = 120 + level * 25;
      damage = 10 + level * 3;
      speed = 55 + level * 4;
      aggroRange = 9;
      fireRate = 0.55;
      projectileSpeed = 160 + level * 10;
    } else {
      // Niflheim Depths — brutal
      level = randomInt(12, 18);
      isSmall = false;
      hp = 200 + level * 30;
      damage = 18 + level * 4;
      speed = 70 + level * 5;
      aggroRange = 11;
      fireRate = 0.75;
      projectileSpeed = 200 + level * 12;
    }

    const textureKey = isSmall ? 'enemy_small' : 'enemy_medium';
    const spriteSize = isSmall ? 8 : 16;

    const data: EnemyData = {
      level,
      maxHp: hp,
      hp,
      damage,
      speed,
      aggroRange,
      fireRate,
      fireCooldown: 1 + Math.random() * 2,
      behavior: 'wander',
      wanderAngle: Math.random() * Math.PI * 2,
      wanderTimer: Math.random() * 3,
      textureKey,
      patternType: this.pickPattern(difficulty),
      projectileSpeed,
      projectileTexture: this.pickProjectileTexture(difficulty),
    };

    const enemy = this.scene.physics.add.sprite(x, y, textureKey);
    enemy.setDepth(5);
    enemy.body!.setSize(spriteSize - 2, spriteSize - 2);
    enemy.setData('enemyData', data);
    enemy.setData('level', level);

    this.enemyGroup.add(enemy);
  }

  private pickPattern(difficulty: number): 'aimed' | 'radial' | 'shotgun' {
    // Outer zone — only simple aimed shots so new players can read the game
    if (difficulty <= 2) return 'aimed';
    if (difficulty <= 5) return Math.random() < 0.6 ? 'aimed' : 'shotgun';
    const r = Math.random();
    if (r < 0.33) return 'aimed';
    if (r < 0.66) return 'shotgun';
    return 'radial';
  }

  private pickProjectileTexture(difficulty: number): string {
    if (difficulty <= 2) return 'projectile_enemy';
    if (difficulty <= 5) return 'projectile_enemy_purple';
    return 'projectile_enemy_green';
  }

  /** Apply damage to an enemy. Returns true if killed. */
  /** Get all active enemies within range of a point */
  getEnemiesInRange(x: number, y: number, range: number): Phaser.Physics.Arcade.Sprite[] {
    const result: Phaser.Physics.Arcade.Sprite[] = [];
    this.enemyGroup.getChildren().forEach((child) => {
      const enemy = child as Phaser.Physics.Arcade.Sprite;
      if (!enemy.active) return;
      const dist = distanceBetween(x, y, enemy.x, enemy.y);
      if (dist <= range) {
        result.push(enemy);
      }
    });
    return result;
  }

  damageEnemy(enemy: Phaser.Physics.Arcade.Sprite, damage: number): boolean {
    const data = enemy.getData('enemyData') as EnemyData;
    if (!data) return false;

    data.hp -= damage;

    // Flash white
    enemy.setTint(0xffffff);
    this.scene.time.delayedCall(80, () => {
      if (enemy.active) enemy.clearTint();
    });

    if (data.hp <= 0) {
      this.destroyEnemy(enemy);
      return true;
    }

    return false;
  }

  private destroyEnemy(enemy: Phaser.Physics.Arcade.Sprite): void {
    // Remove health bar
    const bar = this.healthBars.get(enemy);
    if (bar) {
      bar.destroy();
      this.healthBars.delete(enemy);
    }

    enemy.destroy();
  }

  private updateHealthBar(enemy: Phaser.Physics.Arcade.Sprite, data: EnemyData): void {
    if (data.hp >= data.maxHp) {
      // Full health — don't show bar
      const existing = this.healthBars.get(enemy);
      if (existing) {
        existing.destroy();
        this.healthBars.delete(enemy);
      }
      return;
    }

    let bar = this.healthBars.get(enemy);
    if (!bar) {
      bar = this.scene.add.graphics();
      bar.setDepth(15);
      this.healthBars.set(enemy, bar);
    }

    bar.clear();

    const barWidth = 20;
    const barHeight = 3;
    const x = enemy.x - barWidth / 2;
    const y = enemy.y - (enemy.height / 2) - 6;
    const hpRatio = Math.max(0, data.hp / data.maxHp);

    // Background
    bar.fillStyle(0x222222, 0.8);
    bar.fillRect(x, y, barWidth, barHeight);

    // HP fill
    const color = hpRatio > 0.5 ? 0x44cc44 : hpRatio > 0.25 ? 0xcccc44 : 0xcc4444;
    bar.fillStyle(color, 1);
    bar.fillRect(x, y, barWidth * hpRatio, barHeight);
  }
}
