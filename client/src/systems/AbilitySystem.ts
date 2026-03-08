import Phaser from 'phaser';
import { PlayerController } from './PlayerController';
import { ProjectileManager } from './ProjectileManager';
import { angleBetween, distanceBetween } from '../utils/MathUtils';

/**
 * AbilitySystem: Manages space bar special abilities for each class.
 *
 * Each class has 3 abilities that unlock at levels 1, 5, and 10.
 * Press Space to activate the highest unlocked ability.
 * Each ability has its own MP cost, cooldown, and visual effect.
 *
 * Ability design per class:
 *   - Viking:      L1=Shield Wall (defense buff), L5=Battle Cry (stun nearby), L10=Odin's Fury (AoE slam)
 *   - Runemaster:  L1=Rune Blast (AoE burst), L5=Arcane Shield (absorb), L10=Ragnarok Beam (massive line)
 *   - Valkyrie:    L1=Heal (self), L5=Wings of Light (heal+speed), L10=Valhalla's Call (mega heal+invuln)
 *   - Berserker:   L1=Frenzy (attack speed up), L5=Blood Rage (damage+lifesteal), L10=Rampage (massive burst)
 *   - Skald:       L1=Healing Chant (heal self), L5=Courage Hymn (heal+buff), L10=Saga of Kings (full heal+invuln)
 *   - Huntsman:    L1=Arrow Volley (burst), L5=Wolf Strike (summon damage), L10=Hunter's Mark (huge crit)
 */

export interface AbilityDef {
  name: string;
  description: string;
  unlockLevel: number;
  mpCost: number;
  cooldown: number;        // seconds
  effectType: 'heal' | 'buff' | 'damage' | 'aoe' | 'projectile_burst';
  effectValue: number;     // primary effect value (heal amount, damage, buff %)
  duration?: number;       // buff duration in seconds (if applicable)
  color: string;           // visual effect color
}

export interface ClassAbilities {
  ability1: AbilityDef;
  ability2: AbilityDef;
  ability3: AbilityDef;
}

// All class abilities
export const CLASS_ABILITIES: Record<string, ClassAbilities> = {
  viking: {
    ability1: {
      name: 'Shield Wall',
      description: 'Raise your shield, reducing damage taken by 50% for 5s.',
      unlockLevel: 1, mpCost: 20, cooldown: 8,
      effectType: 'buff', effectValue: 0.5, duration: 5,
      color: '#6688bb',
    },
    ability2: {
      name: 'Battle Cry',
      description: 'Let out a mighty roar, dealing damage to all nearby enemies.',
      unlockLevel: 5, mpCost: 40, cooldown: 12,
      effectType: 'aoe', effectValue: 60,
      color: '#88aadd',
    },
    ability3: {
      name: 'Odin\'s Fury',
      description: 'Channel Odin\'s power into a devastating slam that crushes nearby foes.',
      unlockLevel: 10, mpCost: 80, cooldown: 20,
      effectType: 'aoe', effectValue: 150,
      color: '#aaccff',
    },
  },
  runemaster: {
    ability1: {
      name: 'Rune Blast',
      description: 'Release a ring of arcane energy, damaging enemies in all directions.',
      unlockLevel: 1, mpCost: 25, cooldown: 6,
      effectType: 'projectile_burst', effectValue: 12, // projectile count
      color: '#aa44ff',
    },
    ability2: {
      name: 'Arcane Shield',
      description: 'Conjure a magical barrier that absorbs damage for 4s.',
      unlockLevel: 5, mpCost: 50, cooldown: 14,
      effectType: 'buff', effectValue: 0.8, duration: 4, // 80% damage reduction
      color: '#cc66ff',
    },
    ability3: {
      name: 'Ragnarok Beam',
      description: 'Fire a devastating beam of runic energy in a line.',
      unlockLevel: 10, mpCost: 90, cooldown: 22,
      effectType: 'projectile_burst', effectValue: 20,
      color: '#ff44ff',
    },
  },
  valkyrie: {
    ability1: {
      name: 'Divine Touch',
      description: 'Channel divine energy to restore health.',
      unlockLevel: 1, mpCost: 30, cooldown: 8,
      effectType: 'heal', effectValue: 80,
      color: '#ffdd44',
    },
    ability2: {
      name: 'Wings of Light',
      description: 'Heal and gain a burst of movement speed for 4s.',
      unlockLevel: 5, mpCost: 55, cooldown: 14,
      effectType: 'heal', effectValue: 120, duration: 4,
      color: '#ffee88',
    },
    ability3: {
      name: 'Valhalla\'s Call',
      description: 'Massive heal and brief invulnerability.',
      unlockLevel: 10, mpCost: 100, cooldown: 25,
      effectType: 'heal', effectValue: 250, duration: 3,
      color: '#ffffff',
    },
  },
  berserker: {
    ability1: {
      name: 'Frenzy',
      description: 'Enter a frenzy, boosting attack speed by 50% for 5s.',
      unlockLevel: 1, mpCost: 15, cooldown: 10,
      effectType: 'buff', effectValue: 1.5, duration: 5,
      color: '#cc3333',
    },
    ability2: {
      name: 'Blood Rage',
      description: 'Double damage for 4s, heal for 25% of damage dealt.',
      unlockLevel: 5, mpCost: 40, cooldown: 15,
      effectType: 'buff', effectValue: 2.0, duration: 4,
      color: '#ff4444',
    },
    ability3: {
      name: 'Rampage',
      description: 'Unleash a devastating whirlwind of blades in all directions.',
      unlockLevel: 10, mpCost: 75, cooldown: 22,
      effectType: 'projectile_burst', effectValue: 16,
      color: '#ff6666',
    },
  },
  skald: {
    ability1: {
      name: 'Healing Chant',
      description: 'Sing a healing verse, restoring health over time.',
      unlockLevel: 1, mpCost: 25, cooldown: 8,
      effectType: 'heal', effectValue: 100,
      color: '#44ccaa',
    },
    ability2: {
      name: 'Courage Hymn',
      description: 'A powerful hymn that heals and boosts defense for 5s.',
      unlockLevel: 5, mpCost: 50, cooldown: 14,
      effectType: 'heal', effectValue: 150, duration: 5,
      color: '#66ddcc',
    },
    ability3: {
      name: 'Saga of Kings',
      description: 'Channel the ancient sagas for a massive heal and invulnerability.',
      unlockLevel: 10, mpCost: 100, cooldown: 25,
      effectType: 'heal', effectValue: 300, duration: 3,
      color: '#88ffee',
    },
  },
  huntsman: {
    ability1: {
      name: 'Arrow Volley',
      description: 'Fire a burst of arrows in a cone ahead.',
      unlockLevel: 1, mpCost: 20, cooldown: 7,
      effectType: 'projectile_burst', effectValue: 8,
      color: '#88aa44',
    },
    ability2: {
      name: 'Wolf Strike',
      description: 'Summon a spectral wolf that charges forward, dealing damage.',
      unlockLevel: 5, mpCost: 45, cooldown: 12,
      effectType: 'projectile_burst', effectValue: 5,
      color: '#aacc66',
    },
    ability3: {
      name: 'Hunter\'s Mark',
      description: 'Mark all nearby enemies, then fire piercing arrows at each.',
      unlockLevel: 10, mpCost: 80, cooldown: 20,
      effectType: 'projectile_burst', effectValue: 24,
      color: '#ccee88',
    },
  },
};

export class AbilitySystem {
  private scene: Phaser.Scene;
  private playerController: PlayerController;
  private projectileManager: ProjectileManager;
  private classId: string;
  private abilities: ClassAbilities;

  // Single cooldown — only ability1 is used
  private cooldowns: [number, number, number] = [0, 0, 0];

  // Active buffs
  private activeBuff: {
    type: 'defense_buff' | 'speed_buff' | 'attack_buff';
    multiplier: number;
    remaining: number; // seconds
  } | null = null;

  constructor(
    scene: Phaser.Scene,
    playerController: PlayerController,
    projectileManager: ProjectileManager,
    classId: string,
  ) {
    this.scene = scene;
    this.playerController = playerController;
    this.projectileManager = projectileManager;
    this.classId = classId;
    this.abilities = CLASS_ABILITIES[classId] || CLASS_ABILITIES.viking;
  }

  /** Update cooldowns and active buffs */
  update(dt: number): void {
    // Tick cooldowns
    for (let i = 0; i < 3; i++) {
      if (this.cooldowns[i] > 0) {
        this.cooldowns[i] = Math.max(0, this.cooldowns[i] - dt);
      }
    }

    // Tick active buff
    if (this.activeBuff) {
      this.activeBuff.remaining -= dt;
      if (this.activeBuff.remaining <= 0) {
        this.clearBuff();
      }
    }
  }

  /** Use the class ability (always ability1, always unlocked). */
  useAbility(mouseWorldX: number, mouseWorldY: number): boolean {
    const ability = this.abilities.ability1;

    if (this.cooldowns[0] > 0) {
      // Cooldown is visible in the ability widget — no notification spam needed
      return false;
    }
    if (this.playerController.mp < ability.mpCost) {
      this.scene.events.emit('notification', 'Not enough MP!', '#cc4444');
      return false;
    }

    this.playerController.mp -= ability.mpCost;
    this.cooldowns[0] = ability.cooldown;
    this.executeAbility(ability, mouseWorldX, mouseWorldY);
    this.scene.events.emit('notification', ability.name, ability.color);
    return true;
  }

  private executeAbility(ability: AbilityDef, mouseWorldX: number, mouseWorldY: number): void {
    const player = this.playerController;
    const scene = this.scene;
    const gameScene = scene as any;
    const playerSprite = gameScene.player as Phaser.Physics.Arcade.Sprite;

    switch (ability.effectType) {
      case 'heal': {
        // Restore HP
        const healAmount = ability.effectValue;
        player.hp = Math.min(player.maxHp, player.hp + healAmount);

        // Visual: green ring expanding outward
        this.showHealEffect(playerSprite.x, playerSprite.y, ability.color);

        // If has duration, also grant invulnerability or speed
        if (ability.duration) {
          if (ability.effectValue >= 200) {
            // High-tier heal also grants invulnerability
            player.grantInvincibility(ability.duration);
          }
          // Speed buff for movement abilities
          if (ability.name.includes('Wings') || ability.name.includes('Hymn')) {
            this.activeBuff = {
              type: 'speed_buff',
              multiplier: 1.5,
              remaining: ability.duration,
            };
          }
        }
        break;
      }

      case 'buff': {
        if (ability.name.includes('Shield') || ability.name.includes('Arcane')) {
          // Defense buff
          this.activeBuff = {
            type: 'defense_buff',
            multiplier: ability.effectValue,
            remaining: ability.duration ?? 5,
          };
        } else if (ability.name.includes('Frenzy')) {
          // Attack speed buff
          this.activeBuff = {
            type: 'attack_buff',
            multiplier: ability.effectValue,
            remaining: ability.duration ?? 5,
          };
          player.fireRateMultiplier *= ability.effectValue;
        } else if (ability.name.includes('Blood') || ability.name.includes('Rage')) {
          // Damage buff
          this.activeBuff = {
            type: 'attack_buff',
            multiplier: ability.effectValue,
            remaining: ability.duration ?? 4,
          };
        }

        // Visual: colored aura around player
        this.showBuffEffect(playerSprite.x, playerSprite.y, ability.color);
        break;
      }

      case 'aoe': {
        // Damage all enemies within range
        const range = 120;
        this.dealAoeDamage(playerSprite.x, playerSprite.y, range, ability.effectValue);
        this.showAoeEffect(playerSprite.x, playerSprite.y, range, ability.color);
        break;
      }

      case 'projectile_burst': {
        // Fire a burst of player projectiles in all directions or cone
        const count = ability.effectValue;
        const isCone = ability.name.includes('Arrow') || ability.name.includes('Wolf');
        const aimAngle = angleBetween(playerSprite.x, playerSprite.y, mouseWorldX, mouseWorldY);
        const tintColor = parseInt(ability.color.replace('#', ''), 16);

        for (let i = 0; i < count; i++) {
          let angle: number;
          if (isCone) {
            const spreadRad = Math.PI / 3; // 60-degree cone
            angle = aimAngle - spreadRad / 2 + (spreadRad / Math.max(count - 1, 1)) * i;
          } else {
            angle = (Math.PI * 2 / count) * i;
          }

          const speed = 350 + Math.random() * 50;
          const projectile = this.projectileManager.playerProjectiles.getFirstDead(false) as Phaser.Physics.Arcade.Sprite | null;
          if (projectile) {
            const vx = Math.cos(angle) * speed;
            const vy = Math.sin(angle) * speed;
            projectile.setPosition(playerSprite.x, playerSprite.y);
            projectile.setActive(true).setVisible(true);
            projectile.setVelocity(vx, vy);
            projectile.setData('spawnTime', scene.time.now);
            projectile.setData('lifetime', 1200);
            projectile.setData('isPlayer', true);
            projectile.setData('damageMultiplier', 1.2);
            projectile.setTint(tintColor);
          }
        }
        break;
      }
    }
  }

  /** Get ability info for UI display — single ability, always unlocked. */
  getAbilityInfo(): {
    name: string;
    cooldownRemaining: number;
    cooldownTotal: number;
    mpCost: number;
    unlocked: boolean;
    color: string;
  }[] {
    const ab = this.abilities.ability1;
    return [{
      name: ab.name,
      cooldownRemaining: this.cooldowns[0],
      cooldownTotal: ab.cooldown,
      mpCost: ab.mpCost,
      unlocked: true,
      color: ab.color,
    }];
  }

  /** Get the active defense multiplier (for damage reduction) */
  getDefenseMultiplier(): number {
    if (this.activeBuff?.type === 'defense_buff') {
      return this.activeBuff.multiplier;
    }
    return 1.0;
  }

  /** Get the active attack multiplier */
  getAttackMultiplier(): number {
    if (this.activeBuff?.type === 'attack_buff') {
      return this.activeBuff.multiplier;
    }
    return 1.0;
  }

  private clearBuff(): void {
    if (this.activeBuff?.type === 'attack_buff') {
      // Restore fire rate
      const classDef = CLASS_ABILITIES[this.classId];
      // Reset — will be re-applied from base
    }
    this.activeBuff = null;
  }

  // ========================================================================
  // VISUAL EFFECTS
  // ========================================================================

  private showHealEffect(x: number, y: number, color: string): void {
    const tint = parseInt(color.replace('#', ''), 16);
    const ring = this.scene.add.graphics().setDepth(15);
    ring.lineStyle(2, tint, 0.8);
    ring.strokeCircle(x, y, 5);

    this.scene.tweens.add({
      targets: ring,
      alpha: 0,
      duration: 800,
      onUpdate: () => {
        const progress = 1 - ring.alpha;
        ring.clear();
        ring.lineStyle(2, tint, ring.alpha);
        ring.strokeCircle(x, y, 5 + progress * 30);
      },
      onComplete: () => ring.destroy(),
    });

    // Floating heal text
    const text = this.scene.add.text(x, y - 15, `+HEAL`, {
      fontFamily: 'monospace', fontSize: '10px', color,
      stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(50);

    this.scene.tweens.add({
      targets: text,
      y: y - 40,
      alpha: 0,
      duration: 1000,
      onComplete: () => text.destroy(),
    });
  }

  private showBuffEffect(x: number, y: number, color: string): void {
    const tint = parseInt(color.replace('#', ''), 16);
    // Spinning particles effect
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 / 8) * i;
      const px = x + Math.cos(angle) * 15;
      const py = y + Math.sin(angle) * 15;

      const particle = this.scene.add.graphics().setDepth(15);
      particle.fillStyle(tint, 0.8);
      particle.fillRect(px - 2, py - 2, 4, 4);

      this.scene.tweens.add({
        targets: particle,
        alpha: 0,
        x: px + Math.cos(angle) * 20 - px,
        y: py + Math.sin(angle) * 20 - py,
        duration: 600,
        onComplete: () => particle.destroy(),
      });
    }
  }

  private showAoeEffect(x: number, y: number, radius: number, color: string): void {
    const tint = parseInt(color.replace('#', ''), 16);
    const ring = this.scene.add.graphics().setDepth(15);

    // Expanding ring
    let currentRadius = 10;
    this.scene.tweens.add({
      targets: { r: 10 },
      r: radius,
      duration: 300,
      onUpdate: (_tween: Phaser.Tweens.Tween, target: { r: number }) => {
        ring.clear();
        ring.lineStyle(3, tint, 0.7);
        ring.strokeCircle(x, y, target.r);
        ring.fillStyle(tint, 0.15);
        ring.fillCircle(x, y, target.r);
      },
      onComplete: () => {
        this.scene.tweens.add({
          targets: ring,
          alpha: 0,
          duration: 300,
          onComplete: () => ring.destroy(),
        });
      },
    });
  }

  private dealAoeDamage(x: number, y: number, range: number, damage: number): void {
    // Find and damage all enemies in range
    const gameScene = this.scene as any;

    // Try GameScene's enemyManager
    if (gameScene.enemyManager) {
      const enemies = gameScene.enemyManager.getEnemiesInRange(x, y, range);
      if (enemies) {
        for (const enemy of enemies) {
          gameScene.enemyManager.damageEnemy(enemy, damage);
        }
      }
    }

    // Try DungeonScene's enemyGroup
    if (gameScene.enemyGroup) {
      gameScene.enemyGroup.getChildren().forEach((child: any) => {
        const enemy = child as Phaser.Physics.Arcade.Sprite;
        if (!enemy.active) return;
        const dist = distanceBetween(x, y, enemy.x, enemy.y);
        if (dist <= range) {
          // Apply damage
          const isBoss = enemy.getData('isBoss');
          if (isBoss && gameScene.bossData) {
            gameScene.bossData.hp -= damage;
            if (gameScene.bossData.hp <= 0) {
              gameScene.onBossDefeated?.(enemy);
            }
          } else {
            const data = enemy.getData('enemyData');
            if (data) {
              data.hp -= damage;
              if (data.hp <= 0) {
                const room = enemy.getData('room');
                if (room) {
                  room.enemies = room.enemies.filter((e: any) => e !== enemy);
                }
                enemy.destroy();
              }
            }
          }

          // Show damage number
          gameScene.showDamageNumber?.(enemy.x, enemy.y - 10, damage);
        }
      });
    }
  }
}
