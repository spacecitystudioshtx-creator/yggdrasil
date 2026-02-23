import Phaser from 'phaser';
import { angleBetween } from '../utils/MathUtils';

/**
 * ProjectileManager: Manages all projectiles in the game using Phaser physics groups.
 *
 * Two groups: player projectiles and enemy projectiles.
 * Uses Phaser's built-in group pooling (maxSize + createCallback).
 */

const PLAYER_PROJECTILE_SPEED = 400;  // pixels/sec
const PLAYER_PROJECTILE_LIFETIME = 1200; // ms
const PLAYER_POOL_SIZE = 200;

const ENEMY_POOL_SIZE = 500;

export class ProjectileManager {
  private scene: Phaser.Scene;

  playerProjectiles: Phaser.Physics.Arcade.Group;
  enemyProjectiles: Phaser.Physics.Arcade.Group;

  // Fire rate limiter for player (tracked externally via PlayerController)
  private playerShootCooldown: number = 0;
  private readonly playerFireRate: number = 3.0; // shots per sec (adjusted by dex later)

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
        if (now - spawnTime > PLAYER_PROJECTILE_LIFETIME) {
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

  /** Fire a player projectile toward the target world position */
  firePlayerProjectile(fromX: number, fromY: number, toX: number, toY: number): void {
    if (this.playerShootCooldown > 0) return;

    // Get the player controller to check/reset cooldown
    const gameScene = this.scene as any;
    if (gameScene.playerController && !gameScene.playerController.onShoot()) return;

    // Get projectile from pool
    const projectile = this.playerProjectiles.getFirstDead(false) as Phaser.Physics.Arcade.Sprite | null;
    if (!projectile) return; // pool exhausted

    const angle = angleBetween(fromX, fromY, toX, toY);
    const vx = Math.cos(angle) * PLAYER_PROJECTILE_SPEED;
    const vy = Math.sin(angle) * PLAYER_PROJECTILE_SPEED;

    projectile.setPosition(fromX, fromY);
    projectile.setActive(true).setVisible(true);
    projectile.setVelocity(vx, vy);
    projectile.setData('spawnTime', this.scene.time.now);
    projectile.setData('isPlayer', true);
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
  }
}
