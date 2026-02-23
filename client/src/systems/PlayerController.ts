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

  // --- Regen ---
  private regenTimer: number = 0;

  // --- State ---
  isDead: boolean = false;

  constructor(scene: Phaser.Scene, sprite: Phaser.Physics.Arcade.Sprite, input: InputManager) {
    this.scene = scene;
    this.sprite = sprite;
    this.input = input;
    this.xpToNext = xpForLevel(2);
  }

  update(dt: number, mouseWorldX: number, mouseWorldY: number): void {
    if (this.isDead) return;

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

    // Fire rate scales with dexterity
    const fireRate = this.baseFireRate + this.dexterity * 0.02;
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
    // Stat gains per level (base, before stat potions)
    this.maxHp += 20;
    this.maxMp += 5;
    this.attack += 1;
    this.defense += 1;
    this.speed += 1;
    this.dexterity += 1;
    this.vitality += 1;
    this.wisdom += 1;

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

  private die(): void {
    this.isDead = true;
    this.sprite.setVelocity(0, 0);
    this.sprite.setAlpha(0.5);

    // Emit death event for UI to show death overlay
    this.scene.events.emit('playerDeath', {
      level: this.level,
      causeOfDeath: 'Enemy attack',
    });

    // Respawn after 3 seconds
    this.scene.time.delayedCall(3000, () => {
      this.isDead = false;
      this.hp = this.maxHp;
      this.mp = this.maxMp;
      this.sprite.setAlpha(1);
      this.scene.events.emit('playerRespawn');
    });
  }
}
