import Phaser from 'phaser';
import { InputManager } from './InputManager';
import {
  calculateMoveSpeed,
  calculateDamage,
  xpForLevel,
  MAX_LEVEL,
  BASE_HP_REGEN,
  VIT_HP_REGEN_BONUS,
  BASE_MP_REGEN,
  WIS_MP_REGEN_BONUS,
  TILE_SIZE,
  REALM_SIZE,
} from '@yggdrasil/shared';
import { angleBetween } from '../utils/MathUtils';

/**
 * PlayerController: Handles player movement, stats, combat, and progression.
 *
 * RotMG-style controls:
 *   - WASD to move (8-directional)
 *   - Mouse to aim (player does NOT rotate, just shoots toward cursor)
 *   - Left click to shoot
 *   - Space for ability (future)
 *   - R for Nexus (future)
 */
export class PlayerController {
  private scene: Phaser.Scene;
  private sprite: Phaser.Physics.Arcade.Sprite;
  private input: InputManager;

  // --- Stats ---
  level: number = 1;
  xp: number = 0;
  xpToNext: number;

  maxHp: number = 200;
  hp: number = 200;
  maxMp: number = 100;
  mp: number = 100;

  attack: number = 15;
  defense: number = 5;
  speed: number = 30;
  dexterity: number = 20;
  vitality: number = 20;
  wisdom: number = 20;

  // --- Combat ---
  private shootCooldown: number = 0;
  private readonly baseFireRate: number = 2.0; // shots per second
  fireRateMultiplier: number = 1.0; // class-specific multiplier

  // --- Regen ---
  private regenTimer: number = 0;

  // --- Class-based level gains (can be overridden by class system) ---
  levelGains = {
    maxHp: 20, maxMp: 5,
    attack: 1, defense: 1,
    speed: 1, dexterity: 1,
    vitality: 1, wisdom: 1,
  };

  // --- State ---
  isDead: boolean = false;
  isInvincible: boolean = false;
  private invincibilityTimer: number = 0;

  // Spawn position (safe zone)
  private readonly spawnX: number;
  private readonly spawnY: number;

  constructor(scene: Phaser.Scene, sprite: Phaser.Physics.Arcade.Sprite, input: InputManager) {
    this.scene = scene;
    this.sprite = sprite;
    this.input = input;
    this.xpToNext = xpForLevel(2);

    // Remember spawn position for respawning
    this.spawnX = sprite.x;
    this.spawnY = sprite.y;

    // Grant 3 seconds of invincibility on initial spawn
    this.grantInvincibility(3.0);
  }

  update(dt: number, mouseWorldX: number, mouseWorldY: number): void {
    if (this.isDead) return;

    // Tick down invincibility
    if (this.isInvincible) {
      this.invincibilityTimer -= dt;
      if (this.invincibilityTimer <= 0) {
        this.isInvincible = false;
        this.sprite.setAlpha(1);
      } else {
        // Flashing effect while invincible
        const flash = Math.sin(this.invincibilityTimer * 12) > 0;
        this.sprite.setAlpha(flash ? 1 : 0.4);
      }
    }

    this.handleMovement(dt);
    this.handleRegen(dt);
    this.shootCooldown = Math.max(0, this.shootCooldown - dt);
  }

  // --- Movement ---
  private handleMovement(_dt: number): void {
    const dir = this.input.getMovementDirection();
    const moveSpeed = calculateMoveSpeed(this.speed);

    this.sprite.setVelocity(dir.x * moveSpeed, dir.y * moveSpeed);
  }

  // --- Regen ---
  private handleRegen(dt: number): void {
    this.regenTimer += dt;
    if (this.regenTimer >= 1.0) {
      this.regenTimer -= 1.0;

      // HP regen
      const hpRegen = BASE_HP_REGEN + this.vitality * VIT_HP_REGEN_BONUS;
      this.hp = Math.min(this.maxHp, this.hp + hpRegen);

      // MP regen
      const mpRegen = BASE_MP_REGEN + this.wisdom * WIS_MP_REGEN_BONUS;
      this.mp = Math.min(this.maxMp, this.mp + mpRegen);
    }
  }

  // --- Invincibility ---
  grantInvincibility(duration: number): void {
    this.isInvincible = true;
    this.invincibilityTimer = duration;
  }

  // --- Combat ---

  /** Can the player fire right now? */
  canShoot(): boolean {
    if (this.isDead) return false;
    if (this.shootCooldown > 0) return false;
    return true;
  }

  /** Called by GameScene when player fires. Returns true if shot happened. */
  onShoot(): boolean {
    if (!this.canShoot()) return false;

    // Fire rate scales with dexterity, then apply class multiplier
    const fireRate = (this.baseFireRate + this.dexterity * 0.02) * this.fireRateMultiplier;
    this.shootCooldown = 1.0 / fireRate;

    return true;
  }

  /** Get base attack damage */
  getAttackDamage(): number {
    // Base weapon damage + attack stat bonus
    const baseDamage = 20 + Math.floor(this.attack * 0.5);
    // Add small random variance (±15%)
    const variance = 0.85 + Math.random() * 0.30;
    return Math.floor(baseDamage * variance);
  }

  /** Take damage from an enemy projectile */
  takeDamage(rawDamage: number): void {
    if (this.isDead) return;
    if (this.isInvincible) return; // ignore damage while invincible

    const finalDamage = calculateDamage(rawDamage, this.defense);
    this.hp -= finalDamage;

    if (this.hp <= 0) {
      this.hp = 0;
      this.die();
    }
  }

  /** Grant XP and handle level ups */
  grantXP(amount: number): void {
    if (this.level >= MAX_LEVEL) return;

    this.xp += amount;

    while (this.xp >= this.xpToNext && this.level < MAX_LEVEL) {
      this.xp -= this.xpToNext;
      this.level++;
      this.xpToNext = xpForLevel(this.level + 1) - xpForLevel(this.level);
      this.onLevelUp();
    }

    if (this.level >= MAX_LEVEL) {
      this.xp = 0;
      this.xpToNext = 0;
    }
  }

  private onLevelUp(): void {
    // Stat gains per level (uses class-specific gains if set)
    this.maxHp += this.levelGains.maxHp;
    this.maxMp += this.levelGains.maxMp;
    this.attack += this.levelGains.attack;
    this.defense += this.levelGains.defense;
    this.speed += this.levelGains.speed;
    this.dexterity += this.levelGains.dexterity;
    this.vitality += this.levelGains.vitality;
    this.wisdom += this.levelGains.wisdom;

    // Full heal on level up
    this.hp = this.maxHp;
    this.mp = this.maxMp;

    // Visual effect
    const text = this.scene.add.text(
      this.sprite.x,
      this.sprite.y - 20,
      `LEVEL ${this.level}!`,
      {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#ffdd44',
        stroke: '#000000',
        strokeThickness: 3,
      },
    ).setOrigin(0.5).setDepth(50);

    this.scene.tweens.add({
      targets: text,
      y: this.sprite.y - 50,
      alpha: 0,
      duration: 1500,
      ease: 'Power2',
      onComplete: () => text.destroy(),
    });
  }

  // If true, death is permanent (overworld) — no auto-respawn
  permadeath: boolean = false;

  private die(): void {
    this.isDead = true;
    this.sprite.setVelocity(0, 0);
    this.sprite.setAlpha(0.3);

    // Disable physics body so no more projectile collisions while dead
    this.sprite.body!.enable = false;

    // Emit death event for UI to show death overlay
    this.scene.events.emit('playerDeath', {
      level: this.level,
      causeOfDeath: 'Enemy attack',
    });

    // In permadeath mode (overworld), the scene handles transition to DeathScene
    // In dungeon mode, respawn at dungeon start
    if (this.permadeath) {
      // GameScene will listen to 'playerDeath' and transition to DeathScene
      return;
    }

    // Non-permadeath: Respawn after 3 seconds (used in dungeons)
    this.scene.time.delayedCall(3000, () => {
      this.isDead = false;
      this.hp = this.maxHp;
      this.mp = this.maxMp;

      // Teleport to spawn position
      this.sprite.setPosition(this.spawnX, this.spawnY);
      this.sprite.setAlpha(1);

      // Re-enable physics body
      this.sprite.body!.enable = true;

      // Snap camera instantly to new position (no slow lerp across the map)
      const gameScene = this.scene as any;
      if (gameScene.cameraController?.snapToTarget) {
        gameScene.cameraController.snapToTarget();
      }

      // Grant 4 seconds of invincibility after respawn
      this.grantInvincibility(4.0);

      this.scene.events.emit('playerRespawn');
    });
  }
}
