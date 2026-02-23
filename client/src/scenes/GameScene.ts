import Phaser from 'phaser';
import { PlayerController } from '../systems/PlayerController';
import { ProjectileManager } from '../systems/ProjectileManager';
import { EnemyManager } from '../systems/EnemyManager';
import { WorldRenderer } from '../systems/WorldRenderer';
import { InputManager } from '../systems/InputManager';
import { CameraController } from '../systems/CameraController';
import { InventoryManager } from '../systems/InventoryManager';
import { QuestManager } from '../systems/QuestManager';
import { LootManager } from '../systems/LootManager';
import { TILE_SIZE, REALM_SIZE, ItemType } from '@yggdrasil/shared';
import { getItem } from '../data/ItemDatabase';
import { getBiomeForDistance } from '@yggdrasil/shared';

/**
 * GameScene: The main gameplay scene.
 *
 * Manages the world, player, enemies, projectiles, loot, inventory, and quests.
 * UIScene runs as a parallel overlay on top.
 */
export class GameScene extends Phaser.Scene {
  // Systems
  inputManager!: InputManager;
  worldRenderer!: WorldRenderer;
  playerController!: PlayerController;
  projectileManager!: ProjectileManager;
  enemyManager!: EnemyManager;
  cameraController!: CameraController;
  inventoryManager!: InventoryManager;
  questManager!: QuestManager;
  lootManager!: LootManager;

  // Player reference (Phaser sprite)
  player!: Phaser.Physics.Arcade.Sprite;

  // Crosshair
  crosshair!: Phaser.GameObjects.Image;

  // Biome tracking for quests
  private lastBiome: string = '';
  private worldPixelSize: number = 0;

  constructor() {
    super({ key: 'GameScene' });
  }

  create(): void {
    this.worldPixelSize = REALM_SIZE * TILE_SIZE;

    // 1. Input manager
    this.inputManager = new InputManager(this);

    // 2. World
    this.worldRenderer = new WorldRenderer(this);
    this.worldRenderer.generateWorld(Date.now()); // random seed for now

    // 3. Player — spawn in Frozen Shores (outer ring, ~80% from center)
    const spawnX = this.worldPixelSize * 0.80;
    const spawnY = this.worldPixelSize * 0.50;
    this.player = this.physics.add.sprite(spawnX, spawnY, 'player');
    this.player.setDepth(10);
    this.player.setCollideWorldBounds(true);
    this.player.body!.setSize(12, 14);

    // 4. Player controller
    this.playerController = new PlayerController(this, this.player, this.inputManager);

    // 5. Projectile manager
    this.projectileManager = new ProjectileManager(this);

    // 6. Enemy manager
    this.enemyManager = new EnemyManager(this);
    this.enemyManager.spawnInitialEnemies(this.player.x, this.player.y);

    // 7. Camera
    this.cameraController = new CameraController(this, this.player);

    // 8. Crosshair (follows mouse)
    this.crosshair = this.add.image(0, 0, 'crosshair');
    this.crosshair.setDepth(100);
    this.crosshair.setScrollFactor(0); // stays in screen space

    // 9. Physics world bounds
    this.physics.world.setBounds(0, 0, this.worldPixelSize, this.worldPixelSize);

    // 9b. Collision: player vs wall tiles
    const groundLayer = this.worldRenderer.getGroundLayer();
    if (groundLayer) {
      this.physics.add.collider(this.player, groundLayer);
    }

    // 10. Collision: player projectiles vs enemies
    this.physics.add.overlap(
      this.projectileManager.playerProjectiles,
      this.enemyManager.enemyGroup,
      this.onProjectileHitEnemy as any,
      undefined,
      this,
    );

    // 11. Collision: enemy projectiles vs player
    this.physics.add.overlap(
      this.projectileManager.enemyProjectiles,
      this.player,
      this.onEnemyProjectileHitPlayer as any,
      undefined,
      this,
    );

    // Hide default cursor
    this.input.setDefaultCursor('none');

    // ==========================================
    // 12. Inventory, Quest, and Loot systems
    // ==========================================

    // 12a. Inventory manager
    this.inventoryManager = new InventoryManager();

    // Give player starting gear (Viking class defaults)
    this.inventoryManager.equipStartingGear('sword_t0', 'ability_shield_t0', 'armor_heavy_t0', 'ring_t0');

    // Give a couple of starting potions
    this.inventoryManager.addItem('potion_hp_small', 3);
    this.inventoryManager.addItem('potion_mp_small', 2);

    // 12b. Quest manager
    this.questManager = new QuestManager();

    // Auto-accept starter quests
    this.questManager.acceptQuest('main_01');
    this.questManager.acceptQuest('side_01');
    this.questManager.acceptQuest('side_05');

    // The "Well-Armed" quest should complete immediately since we already equipped gear
    this.questManager.reportEquip('weapon');

    // Quest manager event wiring
    this.questManager.onChange(() => {
      this.emitQuestUpdate();
    });
    this.questManager.onComplete((quest) => {
      // Grant quest rewards
      const rewards = quest.def.rewards;
      this.playerController.grantXP(rewards.xp);
      this.inventoryManager.gold += rewards.gold;
      for (const itemId of rewards.itemIds) {
        this.inventoryManager.addItem(itemId);
      }
      this.events.emit('notification', `Quest Complete: ${quest.def.name}!`, '#44cc44');

      // Auto-accept next available quests
      this.time.delayedCall(500, () => {
        const available = this.questManager.getAvailable(this.playerController.level);
        for (const q of available) {
          if (this.questManager.activeQuests.length < this.questManager.maxActiveQuests) {
            this.questManager.acceptQuest(q.id);
            this.events.emit('notification', `New Quest: ${q.name}`, '#ddaa44');
          }
        }
      });
    });
    this.questManager.onProgress((_quest, obj) => {
      if (obj.current >= obj.targetCount) {
        this.events.emit('notification', `Objective Complete: ${obj.description}`, '#88cc44');
      }
    });

    // 12c. Loot manager
    this.lootManager = new LootManager(this);

    // Wire loot pickup to inventory + quest tracking
    this.lootManager.onPickup((items) => {
      for (const { itemId, quantity } of items) {
        const added = this.inventoryManager.addItem(itemId, quantity);
        const item = getItem(itemId);

        if (added && item) {
          // Show pickup notification
          this.events.emit('notification', `+${quantity} ${item.name}`, '#ffffff');

          // Report collection to quest manager
          this.questManager.reportCollect(itemId);

          // Auto-use consumables: HP/MP potions if health/mana is low
          if (item.type === ItemType.Consumable) {
            // Don't auto-use, let the player manage their own potions
          }
        } else if (!added) {
          this.events.emit('notification', 'Inventory full!', '#cc4444');
        }
      }
    });

    // Inventory change listener — update quest tracker on equip/unequip
    this.inventoryManager.onChange(() => {
      // Check equipment quest objectives
      if (this.inventoryManager.equipment.weapon) {
        this.questManager.reportEquip('weapon');
      }
    });

    // Emit initial quest state
    this.emitQuestUpdate();

    // Auto-complete starter quests if conditions already met
    this.questManager.reportLevel(this.playerController.level);
  }

  update(time: number, delta: number): void {
    const dt = delta / 1000; // convert to seconds

    // Update crosshair position (screen space)
    this.crosshair.setPosition(
      this.input.activePointer.x,
      this.input.activePointer.y,
    );

    // Get mouse position in world space for aiming
    const worldPoint = this.cameras.main.getWorldPoint(
      this.input.activePointer.x,
      this.input.activePointer.y,
    );

    // Update systems
    this.inputManager.update();
    this.playerController.update(dt, worldPoint.x, worldPoint.y);
    this.projectileManager.update(dt);
    this.enemyManager.update(dt, this.player.x, this.player.y);
    this.cameraController.update(dt);
    this.lootManager.update(dt, this.player.x, this.player.y);

    // Handle shooting
    if (this.inputManager.isShootingPressed()) {
      this.projectileManager.firePlayerProjectile(
        this.player.x,
        this.player.y,
        worldPoint.x,
        worldPoint.y,
      );
    }

    // Track biome for quests
    this.checkBiomeChange();

    // Emit player state for UI scene
    this.events.emit('playerUpdate', {
      hp: this.playerController.hp,
      maxHp: this.playerController.maxHp,
      mp: this.playerController.mp,
      maxMp: this.playerController.maxMp,
      level: this.playerController.level,
      xp: this.playerController.xp,
      xpToNext: this.playerController.xpToNext,
      gold: this.inventoryManager.gold,
    });
  }

  /** Check if the player has entered a new biome and report to quest manager */
  private checkBiomeChange(): void {
    const centerX = this.worldPixelSize / 2;
    const centerY = this.worldPixelSize / 2;
    const maxDist = this.worldPixelSize / 2;
    const dist = Math.sqrt(
      (this.player.x - centerX) ** 2 + (this.player.y - centerY) ** 2,
    );
    const normalizedDist = Math.min(1, dist / maxDist);
    const biome = getBiomeForDistance(normalizedDist);

    if (biome.biomeType !== this.lastBiome) {
      const isFirst = this.lastBiome === '';
      this.lastBiome = biome.biomeType;
      this.questManager.reportBiome(biome.biomeType);
      if (!isFirst) {
        this.events.emit('notification', `Entered: ${biome.name}`, '#aaccff');
      }
    }
  }

  /** Emit quest tracker data for UIScene */
  private emitQuestUpdate(): void {
    const trackerData = this.questManager.activeQuests.map(q => ({
      name: q.def.name,
      objectives: q.objectives.map(o => ({
        desc: o.description,
        current: o.current,
        target: o.targetCount,
        done: o.current >= o.targetCount,
      })),
    }));
    this.events.emit('questUpdate', trackerData);
  }

  private onProjectileHitEnemy(
    projectile: Phaser.Physics.Arcade.Sprite,
    enemy: Phaser.Physics.Arcade.Sprite,
  ): void {
    // Deactivate projectile
    this.projectileManager.deactivateProjectile(projectile, true);

    // Damage enemy
    const damage = this.playerController.getAttackDamage();
    const enemyData = enemy.getData('enemyData');
    const killed = this.enemyManager.damageEnemy(enemy, damage);

    if (killed) {
      // Grant XP
      const level = enemy.getData('level') ?? 1;
      const xpReward = level * 15;
      this.playerController.grantXP(xpReward);

      // Report kill to quest manager
      const textureKey = enemyData?.textureKey ?? 'enemy_small';
      this.questManager.reportKill(textureKey);

      // Report level for quest tracking
      this.questManager.reportLevel(this.playerController.level);

      // Spawn loot bag at enemy's death position
      const difficulty = level;
      this.lootManager.spawnLootBag(enemy.x, enemy.y, difficulty);

      // Auto-complete any finished quests
      for (const quest of this.questManager.activeQuests) {
        if (quest.isComplete) {
          this.questManager.completeQuest(quest.def.id);
          break; // complete one at a time to avoid mutation issues
        }
      }
    }

    // Floating damage number
    this.showDamageNumber(enemy.x, enemy.y - 10, damage);
  }

  private onEnemyProjectileHitPlayer(
    projectile: Phaser.Physics.Arcade.Sprite,
    _player: Phaser.Physics.Arcade.Sprite,
  ): void {
    this.projectileManager.deactivateProjectile(projectile, false);

    const damage = projectile.getData('damage') ?? 10;
    this.playerController.takeDamage(damage);

    // Red flash on player
    this.player.setTint(0xff4444);
    this.time.delayedCall(100, () => {
      this.player.clearTint();
    });

    // Camera shake on hit
    this.cameraController.shake(0.003, 80);

    // Floating damage number
    this.showDamageNumber(this.player.x, this.player.y - 10, damage, true);
  }

  private showDamageNumber(x: number, y: number, damage: number, isPlayerDamage: boolean = false): void {
    const color = isPlayerDamage ? '#ff4444' : '#ffff44';
    const text = this.add.text(x, y, `-${damage}`, {
      fontFamily: 'monospace',
      fontSize: '10px',
      color,
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5).setDepth(50);

    this.tweens.add({
      targets: text,
      y: y - 20,
      alpha: 0,
      duration: 600,
      ease: 'Power2',
      onComplete: () => text.destroy(),
    });
  }
}
