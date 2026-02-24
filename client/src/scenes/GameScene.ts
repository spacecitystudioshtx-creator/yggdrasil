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
import { TILE_SIZE, REALM_SIZE, ItemType, BiomeType } from '@yggdrasil/shared';
import { getItem } from '../data/ItemDatabase';
import { getBiomeForDistance } from '@yggdrasil/shared';
import { getDungeonForBiome, DungeonDef } from '../data/DungeonDatabase';
import { getClass, ClassDef } from '../data/ClassDatabase';
import { FameManager } from '../systems/FameManager';
import { AbilitySystem } from '../systems/AbilitySystem';
import { distanceBetween } from '../utils/MathUtils';

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

  // Class system
  private classId: string = 'viking';
  private classDef: ClassDef | null = null;

  // Ability system (space bar)
  abilitySystem!: AbilitySystem;

  // Fame system (permadeath)
  fameManager!: FameManager;

  // Dungeon portals
  private portalGroup!: Phaser.Physics.Arcade.Group;
  private activePortals: {
    sprite: Phaser.Physics.Arcade.Sprite;
    dungeonDef: DungeonDef;
    spawnTime: number;
    label: Phaser.GameObjects.Text;
  }[] = [];
  private readonly PORTAL_LIFETIME = 30000; // 30 seconds

  constructor() {
    super({ key: 'GameScene' });
  }

  init(data: any): void {
    if (data?.classId) {
      this.classId = data.classId;
    }
    this.classDef = getClass(this.classId) ?? null;
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

    // Apply class tint to player
    if (this.classDef) {
      this.player.setTint(this.classDef.spriteTint);
    }

    // 4. Player controller
    this.playerController = new PlayerController(this, this.player, this.inputManager);

    // Apply class base stats
    if (this.classDef) {
      const s = this.classDef.baseStats;
      this.playerController.maxHp = s.maxHp;
      this.playerController.hp = s.maxHp;
      this.playerController.maxMp = s.maxMp;
      this.playerController.mp = s.maxMp;
      this.playerController.attack = s.attack;
      this.playerController.defense = s.defense;
      this.playerController.speed = s.speed;
      this.playerController.dexterity = s.dexterity;
      this.playerController.vitality = s.vitality;
      this.playerController.wisdom = s.wisdom;

      // Set class-specific level gains
      this.playerController.levelGains = { ...this.classDef.levelGains };
    }

    // Enable permadeath in the overworld
    this.playerController.permadeath = true;

    // 5. Projectile manager
    this.projectileManager = new ProjectileManager(this);

    // Set class-specific weapon profile
    if (this.classDef) {
      this.projectileManager.weaponProfile = { ...this.classDef.weaponProfile };
      // Apply fire rate multiplier to player controller
      this.playerController.fireRateMultiplier = this.classDef.weaponProfile.fireRateMultiplier;
    }

    // 5b. Ability system (space bar)
    this.abilitySystem = new AbilitySystem(this, this.playerController, this.projectileManager, this.classId);

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
    //     Process callback rejects overlap if projectile is already deactivated
    //     or player is dead/invincible (prevents multi-hit in same frame)
    this.physics.add.overlap(
      this.projectileManager.enemyProjectiles,
      this.player,
      this.onEnemyProjectileHitPlayer as any,
      (projectile: any, _player: any) => {
        return projectile.active && !this.playerController.isDead && !this.playerController.isInvincible;
      },
      this,
    );

    // Hide default cursor
    this.input.setDefaultCursor('none');

    // ==========================================
    // 12. Inventory, Quest, and Loot systems
    // ==========================================

    // 12a. Inventory manager
    this.inventoryManager = new InventoryManager();

    // Give player starting gear based on class
    if (this.classDef) {
      const gear = this.classDef.startingGear;
      this.inventoryManager.equipStartingGear(gear.weapon, gear.ability, gear.armor, gear.ring);
    } else {
      // Fallback: Viking defaults
      this.inventoryManager.equipStartingGear('sword_t0', 'ability_shield_t0', 'armor_heavy_t0', 'ring_t0');
    }

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

    // 13. Dungeon portal group
    this.portalGroup = this.physics.add.group({
      classType: Phaser.Physics.Arcade.Sprite,
      runChildUpdate: false,
    });

    // 14. Listen for return from dungeon
    this.events.on('returnFromDungeon', this.onReturnFromDungeon, this);

    // 15. Fame manager (permadeath tracking)
    this.fameManager = new FameManager();

    // 16. Listen for permadeath
    this.events.on('playerDeath', this.onPermaDeath, this);
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
    this.abilitySystem.update(dt);

    // Handle shooting
    if (this.inputManager.isShootingPressed()) {
      this.projectileManager.firePlayerProjectile(
        this.player.x,
        this.player.y,
        worldPoint.x,
        worldPoint.y,
      );
    }

    // Space bar: use ability
    if (this.inputManager.isAbilityPressed() && !this.playerController.isDead) {
      this.abilitySystem.useAbility(worldPoint.x, worldPoint.y);
    }

    // R key: return to Nexus (Asgard)
    if (this.inputManager.isNexusPressed() && !this.playerController.isDead) {
      this.goToNexus();
      return;
    }

    // Track biome for quests
    this.checkBiomeChange();

    // Check portal proximity and lifetime
    this.updatePortals(dt);

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
      abilities: this.abilitySystem.getAbilityInfo(),
    });

    // Emit minimap data
    const enemies: { x: number; y: number }[] = [];
    this.enemyManager.enemyGroup.getChildren().forEach((child) => {
      const e = child as Phaser.Physics.Arcade.Sprite;
      if (e.active) enemies.push({ x: e.x, y: e.y });
    });

    // Compute quest waypoints for minimap
    const questWaypoints: { x: number; y: number; index: number }[] = [];
    const center = this.worldPixelSize / 2;
    this.questManager.activeQuests.forEach((quest, idx) => {
      if (quest.isComplete) return;
      for (const obj of quest.objectives) {
        if (obj.current >= obj.targetCount) continue;
        // Biome quests: point toward that biome ring
        if (obj.type === 'reach_biome') {
          let targetDist = 0.5; // default mid
          if (obj.targetId === 'frozen_shores') targetDist = 0.85;
          else if (obj.targetId === 'birch_forest') targetDist = 0.55;
          else if (obj.targetId === 'volcanic_wastes') targetDist = 0.25;
          else if (obj.targetId === 'niflheim_depths') targetDist = 0.05;
          // Point from player toward that ring (toward center for inner, away for outer)
          const dx = center - this.player.x;
          const dy = center - this.player.y;
          const len = Math.sqrt(dx * dx + dy * dy) || 1;
          const targetR = targetDist * (this.worldPixelSize / 2);
          questWaypoints.push({
            x: center - (dx / len) * targetR,
            y: center - (dy / len) * targetR,
            index: idx + 1,
          });
          break; // one waypoint per quest
        }
        // Kill/collect quests: point toward nearest enemy
        if (obj.type === 'kill') {
          let nearestDist = Infinity;
          let nearestPos = { x: center, y: center };
          this.enemyManager.enemyGroup.getChildren().forEach((child) => {
            const e = child as Phaser.Physics.Arcade.Sprite;
            if (!e.active) return;
            const d = Math.sqrt((e.x - this.player.x) ** 2 + (e.y - this.player.y) ** 2);
            if (d < nearestDist) {
              nearestDist = d;
              nearestPos = { x: e.x, y: e.y };
            }
          });
          questWaypoints.push({ x: nearestPos.x, y: nearestPos.y, index: idx + 1 });
          break;
        }
      }
    });

    // Collect portal positions for minimap
    const portals: { x: number; y: number }[] = [];
    for (const p of this.activePortals) {
      if (p.sprite.active) portals.push({ x: p.sprite.x, y: p.sprite.y });
    }

    this.events.emit('minimapUpdate', {
      playerX: this.player.x,
      playerY: this.player.y,
      playerVelX: this.player.body?.velocity.x ?? 0,
      playerVelY: this.player.body?.velocity.y ?? 0,
      worldSize: this.worldPixelSize,
      enemies,
      questWaypoints,
      portals,
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
      this.fameManager.reportBiome(biome.biomeType);
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
    objA: Phaser.Physics.Arcade.Sprite,
    objB: Phaser.Physics.Arcade.Sprite,
  ): void {
    // Phaser may swap parameter order — figure out which is projectile vs enemy
    let projectile: Phaser.Physics.Arcade.Sprite;
    let enemy: Phaser.Physics.Arcade.Sprite;
    if (objA.getData('isPlayer') === true) {
      projectile = objA;
      enemy = objB;
    } else if (objB.getData('isPlayer') === true) {
      projectile = objB;
      enemy = objA;
    } else {
      return; // can't identify — bail
    }

    // Deactivate projectile
    this.projectileManager.deactivateProjectile(projectile, true);

    // Damage enemy — apply weapon profile damage multiplier
    const baseDamage = this.playerController.getAttackDamage();
    const damageMultiplier = projectile.getData('damageMultiplier') ?? 1.0;
    const damage = Math.floor(baseDamage * damageMultiplier);
    const enemyData = enemy.getData('enemyData');
    const killed = this.enemyManager.damageEnemy(enemy, damage);

    if (killed) {
      // Grant XP
      const level = enemy.getData('level') ?? 1;
      const xpReward = level * 15;
      this.playerController.grantXP(xpReward);

      // Report kill to quest manager and fame
      const textureKey = enemyData?.textureKey ?? 'enemy_small';
      this.questManager.reportKill(textureKey);
      this.fameManager.reportKill();

      // Report level for quest tracking
      this.questManager.reportLevel(this.playerController.level);

      // Spawn loot bag at enemy's death position
      const difficulty = level;
      this.lootManager.spawnLootBag(enemy.x, enemy.y, difficulty);

      // Chance to spawn dungeon portal based on biome
      this.trySpawnDungeonPortal(enemy.x, enemy.y);

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
    objA: Phaser.Physics.Arcade.Sprite,
    objB: Phaser.Physics.Arcade.Sprite,
  ): void {
    // Phaser may swap parameter order — figure out which is the projectile
    // The projectile has 'damage' data, the player does not
    let projectile: Phaser.Physics.Arcade.Sprite;
    if (objA.getData('damage') !== null && objA.getData('damage') !== undefined) {
      projectile = objA;
    } else if (objB.getData('damage') !== null && objB.getData('damage') !== undefined) {
      projectile = objB;
    } else {
      // Neither has damage data — bail
      return;
    }

    this.projectileManager.deactivateProjectile(projectile, false);

    const damage = projectile.getData('damage') ?? 10;
    this.playerController.takeDamage(damage);

    // Red flash on player — restore class tint afterwards (not clearTint!)
    this.player.setTint(0xff4444);
    this.time.delayedCall(100, () => {
      if (this.player.active) {
        if (this.classDef) {
          this.player.setTint(this.classDef.spriteTint);
        } else {
          this.player.clearTint();
        }
      }
    });

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

  // ========================================================================
  // NEXUS (ASGARD HUB) — R KEY
  // ========================================================================

  /** Return to Asgard hub — pass full player state to preserve it */
  private goToNexus(): void {
    this.events.emit('notification', 'Returning to Asgard...', '#ddaa44');
    this.clearAllPortals();

    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.time.delayedCall(300, () => {
      this.scene.stop('GameScene');
      this.scene.start('NexusScene', {
        classId: this.classId,
        playerLevel: this.playerController.level,
        hp: this.playerController.hp,
        maxHp: this.playerController.maxHp,
        mp: this.playerController.mp,
        maxMp: this.playerController.maxMp,
        xp: this.playerController.xp,
        xpToNext: this.playerController.xpToNext,
        gold: this.inventoryManager.gold,
      });
    });
  }

  // ========================================================================
  // PERMADEATH
  // ========================================================================

  /** Handle permanent death — transition to DeathScene */
  private onPermaDeath(_data: { level: number; causeOfDeath: string }): void {
    // Wait for the death overlay countdown, then go to DeathScene
    this.time.delayedCall(3500, () => {
      this.clearAllPortals();
      this.scene.stop('GameScene');
      this.scene.stop('UIScene');
      this.scene.start('DeathScene', {
        classId: this.classId,
        level: this.playerController.level,
        killedBy: _data.causeOfDeath ?? 'Unknown',
        maxBiome: this.lastBiome || 'Frozen Shores',
        fameManager: this.fameManager,
      });
    });
  }

  // ========================================================================
  // DUNGEON PORTAL SYSTEM
  // ========================================================================

  /** Try to spawn a dungeon portal when an enemy dies */
  private trySpawnDungeonPortal(x: number, y: number): void {
    // Determine which biome this position is in
    const centerX = this.worldPixelSize / 2;
    const centerY = this.worldPixelSize / 2;
    const maxDist = this.worldPixelSize / 2;
    const dist = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
    const normalizedDist = Math.min(1, dist / maxDist);
    const biome = getBiomeForDistance(normalizedDist);

    // Look up the dungeon that spawns from this biome
    const dungeonDef = getDungeonForBiome(biome.biomeType as BiomeType);
    if (!dungeonDef) return;

    // Roll the drop chance
    if (Math.random() > dungeonDef.portalDropChance) return;

    // Limit to 3 active portals at once
    if (this.activePortals.length >= 3) return;

    // Spawn portal sprite
    const portal = this.physics.add.sprite(x, y - 10, 'portal');
    portal.setDepth(8);
    this.portalGroup.add(portal);

    // Pulsing animation
    this.tweens.add({
      targets: portal,
      scaleX: 1.3,
      scaleY: 1.3,
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Label
    const label = this.add.text(x, y + 8, dungeonDef.name, {
      fontFamily: 'monospace',
      fontSize: '7px',
      color: '#cc88ff',
      stroke: '#000',
      strokeThickness: 2,
    }).setOrigin(0.5).setDepth(50);

    this.activePortals.push({
      sprite: portal,
      dungeonDef,
      spawnTime: this.time.now,
      label,
    });

    this.events.emit('notification', `A portal to ${dungeonDef.name} has appeared!`, '#cc88ff');
  }

  /** Update portals: check lifetime, check player proximity for entry */
  private updatePortals(_dt: number): void {
    const now = this.time.now;

    for (let i = this.activePortals.length - 1; i >= 0; i--) {
      const p = this.activePortals[i];

      // Despawn expired portals
      if (now - p.spawnTime > this.PORTAL_LIFETIME) {
        p.sprite.destroy();
        p.label.destroy();
        this.activePortals.splice(i, 1);
        continue;
      }

      // Flash portal label as it approaches despawn (last 10 seconds)
      const timeLeft = this.PORTAL_LIFETIME - (now - p.spawnTime);
      if (timeLeft < 10000) {
        p.label.setAlpha(Math.sin(now * 0.01) * 0.5 + 0.5);
      }

      // Check if player is close enough to enter
      if (!this.playerController.isDead) {
        const dist = distanceBetween(this.player.x, this.player.y, p.sprite.x, p.sprite.y);
        if (dist < 20) {
          this.enterDungeon(p.dungeonDef);
          // Clean up all portals before entering
          this.clearAllPortals();
          return;
        }
      }
    }
  }

  /** Enter a dungeon — sleep this scene, start DungeonScene */
  private enterDungeon(dungeonDef: DungeonDef): void {
    // Pack up player state to pass to the dungeon
    const config = {
      dungeonDef,
      runeKeyLevel: 0, // base difficulty (Rune Key system added later)
      classId: this.classId,
      playerHp: this.playerController.hp,
      playerMp: this.playerController.mp,
      playerLevel: this.playerController.level,
      playerXp: this.playerController.xp,
      playerStats: {
        attack: this.playerController.attack,
        defense: this.playerController.defense,
        speed: this.playerController.speed,
        dexterity: this.playerController.dexterity,
        vitality: this.playerController.vitality,
        wisdom: this.playerController.wisdom,
        maxHp: this.playerController.maxHp,
        maxMp: this.playerController.maxMp,
      },
    };

    // Sleep GameScene (preserves all state) and start DungeonScene
    this.scene.sleep('GameScene');
    this.scene.start('DungeonScene', config);
  }

  /** Handle returning from a dungeon */
  private onReturnFromDungeon(data: {
    hp: number;
    mp: number;
    level: number;
    xp: number;
    dungeonComplete: boolean;
  }): void {
    // Restore player stats from dungeon
    this.playerController.hp = data.hp;
    this.playerController.mp = data.mp;
    this.playerController.level = data.level;
    this.playerController.xp = data.xp;

    // Grant invincibility on return
    this.playerController.grantInvincibility(3.0);

    // Snap camera to player position
    this.cameraController.snapToTarget();

    if (data.dungeonComplete) {
      this.events.emit('notification', 'Dungeon Cleared! Welcome back to Midgard.', '#44cc44');
    } else {
      this.events.emit('notification', 'Returned to Midgard.', '#aaccff');
    }
  }

  /** Remove all active portals */
  private clearAllPortals(): void {
    for (const p of this.activePortals) {
      p.sprite.destroy();
      p.label.destroy();
    }
    this.activePortals = [];
  }
}
