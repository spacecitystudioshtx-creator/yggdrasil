import Phaser from 'phaser';
import { angleBetween } from '../utils/MathUtils';

/**
 * ProjectileManager: Manages all projectiles in the game using Phaser physics groups.
 *
 * Two groups: player projectiles and enemy projectiles.
 * Uses Phaser's built-in group pooling (maxSize + createCallback).
 *
 * Player projectiles now support class-specific weapon profiles:
 *   - Multiple projectiles per shot (spread pattern)
 *   - Variable speed, lifetime, size, and tint per class
 */

const PLAYER_PROJECTILE_SPEED = 400;  // default pixels/sec (overridden by weapon profile)
const PLAYER_PROJECTILE_LIFETIME = 1200; // default ms (overridden by weapon profile)
const PLAYER_POOL_SIZE = 200;

const ENEMY_POOL_SIZE = 500;

/** Weapon profile — defines how a class's attack looks and behaves */
export interface WeaponProfile {
  projectileCount: number;
  spreadAngle: number;         // degrees
  projectileSpeed: number;
  projectileLifetime: number;  // ms
  projectileTint: number;
  fireRateMultiplier: number;
  damageMultiplier: number;
  projectileSize: number;      // body size multiplier
}

export class ProjectileManager {
  private scene: Phaser.Scene;

  playerProjectiles: Phaser.Physics.Arcade.Group;
  enemyProjectiles: Phaser.Physics.Arcade.Group;

  // Fire rate limiter for player (tracked externally via PlayerController)
  private playerShootCooldown: number = 0;
  private readonly playerFireRate: number = 3.0; // shots per sec (adjusted by dex later)

  // Active weapon profile (set by GameScene/DungeonScene based on class)
  weaponProfile: WeaponProfile | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    // Player projectile pool
    this.playerProjectiles = scene.physics.add.group({
      classType: Phaser.Physics.Arcade.Sprite,
      maxSize: PLAYER_POOL_SIZE,
      runChildUpdate: false,
      active: false,
      visible: false,
    });

    // Pre-create player projectiles
    for (let i = 0; i < 50; i++) {
      const p = scene.physics.add.sprite(-100, -100, 'projectile_player');
      p.setActive(false).setVisible(false).setDepth(8);
      p.body!.setSize(4, 4);
      this.playerProjectiles.add(p);
    }

    // Enemy projectile pool
    this.enemyProjectiles = scene.physics.add.group({
      classType: Phaser.Physics.Arcade.Sprite,
      maxSize: ENEMY_POOL_SIZE,
      runChildUpdate: false,
      active: false,
      visible: false,
    });

    // Pre-create enemy projectiles
    for (let i = 0; i < 100; i++) {
      const p = scene.physics.add.sprite(-100, -100, 'projectile_enemy');
      p.setActive(false).setVisible(false).setDepth(8);
      p.body!.setSize(4, 4);
      this.enemyProjectiles.add(p);
    }
  }

  update(dt: number): void {
    this.playerShootCooldown = Math.max(0, this.playerShootCooldown - dt);

    // Check lifetime on all active projectiles
    const now = this.scene.time.now;

    this.playerProjectiles.getChildren().forEach((child) => {
      const p = child as Phaser.Physics.Arcade.Sprite;
      if (p.active) {
        const spawnTime = p.getData('spawnTime') as number;
        const lifetime = (p.getData('lifetime') as number) || PLAYER_PROJECTILE_LIFETIME;
        if (now - spawnTime > lifetime) {
          this.deactivateProjectile(p, true);
        }
      }
    });

    this.enemyProjectiles.getChildren().forEach((child) => {
      const p = child as Phaser.Physics.Arcade.Sprite;
      if (p.active) {
        const lifetime = p.getData('lifetime') as number;
        const spawnTime = p.getData('spawnTime') as number;
        if (now - spawnTime > lifetime) {
          this.deactivateProjectile(p, false);
        }
      }
    });
  }

  /** Fire player projectile(s) toward the target world position.
   *  Uses weaponProfile if set, otherwise fires a single default projectile. */
  firePlayerProjectile(fromX: number, fromY: number, toX: number, toY: number): void {
    if (this.playerShootCooldown > 0) return;

    // Get the player controller to check/reset cooldown
    const gameScene = this.scene as any;
    if (gameScene.playerController && !gameScene.playerController.onShoot()) return;

    const baseAngle = angleBetween(fromX, fromY, toX, toY);
    const wp = this.weaponProfile;

    if (wp && wp.projectileCount > 0) {
      // Class-specific weapon profile
      const count = wp.projectileCount;
      const spreadRad = (wp.spreadAngle * Math.PI) / 180;

      for (let i = 0; i < count; i++) {
        const projectile = this.playerProjectiles.getFirstDead(false) as Phaser.Physics.Arcade.Sprite | null;
        if (!projectile) break;

        // Calculate spread angle for this projectile
        let angle = baseAngle;
        if (count > 1) {
          // Evenly distribute across spread arc, centered on aim direction
          const t = (i / (count - 1)) * 2 - 1; // -1 to 1
          angle = baseAngle + t * (spreadRad / 2);
        }

        const speed = wp.projectileSpeed;
        const vx = Math.cos(angle) * speed;
        const vy = Math.sin(angle) * speed;

        // Apply size
        const baseSize = 4;
        const size = Math.round(baseSize * wp.projectileSize);
        projectile.body!.setSize(size, size);

        projectile.setPosition(fromX, fromY);
        projectile.setActive(true).setVisible(true);
        projectile.setVelocity(vx, vy);
        projectile.setData('spawnTime', this.scene.time.now);
        projectile.setData('lifetime', wp.projectileLifetime);
        projectile.setData('isPlayer', true);
        projectile.setData('damageMultiplier', wp.damageMultiplier);

        // Apply tint
        projectile.setTint(wp.projectileTint);
      }
    } else {
      // Default single projectile (fallback)
      const projectile = this.playerProjectiles.getFirstDead(false) as Phaser.Physics.Arcade.Sprite | null;
      if (!projectile) return;

      const vx = Math.cos(baseAngle) * PLAYER_PROJECTILE_SPEED;
      const vy = Math.sin(baseAngle) * PLAYER_PROJECTILE_SPEED;

      projectile.body!.setSize(4, 4);
      projectile.setPosition(fromX, fromY);
      projectile.setActive(true).setVisible(true);
      projectile.setVelocity(vx, vy);
      projectile.setData('spawnTime', this.scene.time.now);
      projectile.setData('lifetime', PLAYER_PROJECTILE_LIFETIME);
      projectile.setData('isPlayer', true);
      projectile.setData('damageMultiplier', 1.0);
      projectile.clearTint();
    }
  }

  /** Fire an enemy projectile */
  fireEnemyProjectile(
    fromX: number, fromY: number,
    angle: number,
    speed: number,
    damage: number,
    lifetime: number,
    textureKey: string = 'projectile_enemy',
  ): void {
    const projectile = this.enemyProjectiles.getFirstDead(false) as Phaser.Physics.Arcade.Sprite | null;
    if (!projectile) return;

    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;

    projectile.setTexture(textureKey);
    projectile.setPosition(fromX, fromY);
    projectile.setActive(true).setVisible(true);
    projectile.setVelocity(vx, vy);
    projectile.setData('spawnTime', this.scene.time.now);
    projectile.setData('lifetime', lifetime);
    projectile.setData('damage', damage);
    projectile.setData('isPlayer', false);
  }

  /** Deactivate a projectile and return to pool */
  deactivateProjectile(projectile: Phaser.Physics.Arcade.Sprite, isPlayerProjectile: boolean): void {
    projectile.setActive(false).setVisible(false);
    projectile.setVelocity(0, 0);
    projectile.setPosition(-100, -100);
    if (isPlayerProjectile) {
      projectile.clearTint();
      projectile.body!.setSize(4, 4);
    }
  }
}
