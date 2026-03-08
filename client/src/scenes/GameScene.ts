import Phaser from 'phaser';
import { PlayerController } from '../systems/PlayerController';
import { ProjectileManager } from '../systems/ProjectileManager';
import { EnemyManager } from '../systems/EnemyManager';
import { WorldRenderer } from '../systems/WorldRenderer';
import { InputManager } from '../systems/InputManager';
import { CameraController } from '../systems/CameraController';
import { InventoryManager } from '../systems/InventoryManager';
import { LootManager } from '../systems/LootManager';
import { TILE_SIZE, REALM_SIZE, ItemType } from '@yggdrasil/shared';
import { getItem } from '../data/ItemDatabase';
import { getDungeon, DungeonDef } from '../data/DungeonDatabase';
import { getClass, ClassDef } from '../data/ClassDatabase';
import { FameManager } from '../systems/FameManager';
import { AbilitySystem } from '../systems/AbilitySystem';
import { ProgressManager, PlayerRunState } from '../systems/ProgressManager';
import { MusicManager } from '../systems/MusicManager';
import { distanceBetween, angleBetween } from '../utils/MathUtils';

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
  lootManager!: LootManager;

  // Player reference (Phaser sprite)
  player!: Phaser.Physics.Arcade.Sprite;

  // Crosshair
  crosshair!: Phaser.GameObjects.Image;

  private worldPixelSize: number = 0;

  // Class system
  private classId: string = 'viking';
  private classDef: ClassDef | null = null;

  // Ability system (space bar)
  abilitySystem!: AbilitySystem;

  // Fame system (permadeath)
  fameManager!: FameManager;

  // Progress system (per-class checkpoints)
  progressManager!: ProgressManager;

  // Music & SFX
  musicManager!: MusicManager;

  // Dungeon portals
  private portalGroup!: Phaser.Physics.Arcade.Group;
  private activePortals: {
    sprite: Phaser.Physics.Arcade.Sprite;
    dungeonDef: DungeonDef;
    spawnTime: number;
    label: Phaser.GameObjects.Text;
  }[] = [];
  private readonly PORTAL_LIFETIME = 30000; // 30 seconds

  // Dungeon progression — which dungeon unlocks at which level
  private readonly DUNGEON_PROGRESSION: { level: number; dungeonId: string }[] = [
    { level: 5,  dungeonId: 'frostheim_caverns' },
    { level: 6,  dungeonId: 'verdant_hollows' },
    { level: 8,  dungeonId: 'muspelheim_forge' },
    { level: 10, dungeonId: 'helheim_sanctum' },
  ];
  // Track which dungeons we have already spawned a portal for
  private spawnedDungeonPortals: Set<string> = new Set();
  // Flag set by DungeonScene return to trigger next portal spawn
  private pendingNextDungeonId: string | null = null;

  // World final boss (Fenrir — spawns at center when all dungeons cleared)
  private worldBoss: Phaser.Physics.Arcade.Sprite | null = null;
  private worldBossData: {
    hp: number; maxHp: number;
    fireCooldown: number;
    spiralAngle: number;
    phase: number;
  } | null = null;
  private worldBossHealthBar: Phaser.GameObjects.Graphics | null = null;
  private worldBossNameText: Phaser.GameObjects.Text | null = null;
  private worldBossSpawned: boolean = false;
  private worldBossAwake: boolean = false;   // dormant until all dungeons cleared
  private worldBossDormantLabel: Phaser.GameObjects.Text | null = null;
  private worldBossHomeX: number = 0;  // center of world — Fenrir's fixed lair
  private worldBossHomeY: number = 0;

  // Ice wall (flat earth) proximity joke
  private iceWallLabelShown: boolean = false;

  constructor() {
    super({ key: 'GameScene' });
  }

  // Checkpoint stage to start at (0 = default Midgard, 1-4 = later stages)
  private startStage: number = 0;

  init(data: any): void {
    if (data?.classId) {
      this.classId = data.classId;
    }
    this.startStage = data?.startStage ?? 0;
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
    // 12. Inventory and Loot systems
    // ==========================================

    // 12a. Inventory manager
    this.inventoryManager = new InventoryManager();

    // Give player starting gear based on class
    if (this.classDef) {
      const gear = this.classDef.startingGear;
      this.inventoryManager.equipStartingGear(gear.weapon, gear.ability, gear.armor, gear.ring);
    } else {
      this.inventoryManager.equipStartingGear('sword_t0', 'ability_shield_t0', 'armor_heavy_t0', 'ring_t0');
    }

    // Starting potions
    this.inventoryManager.addItem('potion_hp_small', 3);
    this.inventoryManager.addItem('potion_mp_small', 2);

    // 12b. Loot manager
    this.lootManager = new LootManager(this);

    // No loot bags spawn anymore — instant heals on kill.
    // LootManager kept for possible future use; pickup callback is no-op.
    this.lootManager.onPickup((_items) => {});

    // 12c. Spawn dormant Fenrir near player start — a warning of what's coming
    this.spawnDormantFenrir();

    // 13. Dungeon portal group
    this.portalGroup = this.physics.add.group({
      classType: Phaser.Physics.Arcade.Sprite,
      runChildUpdate: false,
    });

    // 14. Listen for return from dungeon
    this.events.on('returnFromDungeon', this.onReturnFromDungeon, this);

    // Listen for level-up events to gate dungeon portals
    this.events.on('playerLevelUp', this.onPlayerLevelUp, this);

    // 15. Fame manager (permadeath tracking)
    this.fameManager = new FameManager();

    // 15b. Progress manager (per-class checkpoints)
    this.progressManager = new ProgressManager();

    // Apply checkpoint start stage — boost player level and pre-unlock dungeon portals
    this.applyStartStage();

    // Restore mid-run state from localStorage (survives browser refresh)
    this.restoreRunState();

    // 16. Listen for permadeath
    this.events.on('playerDeath', this.onPermaDeath, this);

    // 17. Music
    this.musicManager = new MusicManager(this);
    this.musicManager.playMusic('music_overworld');
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
      const used = this.abilitySystem.useAbility(worldPoint.x, worldPoint.y);
      if (used) this.musicManager?.playSFX('sfx_ability');
    }

    // R key: return to Nexus (Asgard)
    if (this.inputManager.isNexusPressed() && !this.playerController.isDead) {
      this.goToNexus();
      return;
    }

    // Check portal proximity and lifetime
    this.updatePortals(dt);

    // Ice wall proximity joke — show once when player gets near the edge
    this.checkIceWallProximity();

    // Update world boss if alive
    if (this.worldBoss && this.worldBoss.active && this.worldBossData) {
      this.updateWorldBoss(dt);
    }

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

    // Portal positions for minimap
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
      questWaypoints: [],
      portals,
    });
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
    const killed = this.enemyManager.damageEnemy(enemy, damage);

    if (killed) {
      const level = enemy.getData('level') ?? 1;
      const xpReward = level * 15;
      this.playerController.grantXP(xpReward);
      this.fameManager.reportKill();

      // SFX: enemy death / kill
      this.musicManager?.playSFX('sfx_hit_enemy');

      // 50% chance: instant heal drop (8% max HP)
      if (Math.random() < 0.5) {
        const healAmount = Math.ceil(this.playerController.maxHp * 0.08);
        this.playerController.hp = Math.min(this.playerController.maxHp, this.playerController.hp + healAmount);
        // Green sparkle at enemy position
        this.showInstantHealEffect(enemy.x, enemy.y, healAmount);
        this.musicManager?.playSFX('sfx_heal');
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
    this.musicManager?.playSFX('sfx_player_hit');

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

  private showInstantHealEffect(x: number, y: number, healAmount: number): void {
    // Floating green +HEAL text
    const text = this.add.text(x, y - 10, `+${healAmount} HP`, {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#44ee88',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5).setDepth(50);

    this.tweens.add({
      targets: text,
      y: y - 35,
      alpha: 0,
      duration: 900,
      ease: 'Power2',
      onComplete: () => text.destroy(),
    });

    // Small green sparkle ring at heal position
    const ring = this.add.graphics().setDepth(14);
    ring.lineStyle(1, 0x44ee88, 0.9);
    ring.strokeCircle(x, y, 4);
    this.tweens.add({
      targets: { r: 4 },
      r: 22,
      duration: 400,
      onUpdate: (_tw: any, target: any) => {
        ring.clear();
        ring.lineStyle(1, 0x44ee88, 0.6);
        ring.strokeCircle(x, y, target.r);
      },
      onComplete: () => ring.destroy(),
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
    // Wipe saved run state on permadeath (fresh start required)
    this.progressManager.clearRunState();

    // Wait for the death overlay countdown, then go to DeathScene
    this.time.delayedCall(3500, () => {
      this.clearAllPortals();
      this.scene.stop('GameScene');
      this.scene.stop('UIScene');
      this.scene.start('DeathScene', {
        classId: this.classId,
        level: this.playerController.level,
        killedBy: _data.causeOfDeath ?? 'Unknown',
        maxBiome: 'Midgard',
        fameManager: this.fameManager,
      });
    });
  }

  // ========================================================================
  // DUNGEON PORTAL SYSTEM — level-gated progression
  // ========================================================================

  /** Called when player levels up — spawn the gated dungeon portal if applicable */
  private onPlayerLevelUp(newLevel: number): void {
    this.musicManager?.playSFX('sfx_level_up');

    // Save run state on every level-up so a refresh restores the new level
    this.saveRunState();

    const entry = this.DUNGEON_PROGRESSION.find(e => e.level === newLevel);
    if (!entry) return;
    if (this.spawnedDungeonPortals.has(entry.dungeonId)) return;

    // Small delay so the level-up text clears first
    this.time.delayedCall(1200, () => {
      this.spawnDungeonPortalNearPlayer(entry.dungeonId);
    });
  }

  /** Spawn a dungeon portal next to the player */
  private spawnDungeonPortalNearPlayer(dungeonId: string): void {
    const dungeonDef = getDungeon(dungeonId);
    if (!dungeonDef) return;

    this.spawnedDungeonPortals.add(dungeonId);

    const x = this.player.x + 40;
    const y = this.player.y;

    const portal = this.physics.add.sprite(x, y, 'portal');
    portal.setDepth(8);
    this.portalGroup.add(portal);

    this.tweens.add({
      targets: portal,
      scaleX: 1.3,
      scaleY: 1.3,
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    const label = this.add.text(x, y + 18, dungeonDef.name, {
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

    this.events.emit('notification', `Portal to ${dungeonDef.name} has opened!`, '#cc88ff');
    this.events.emit('notification', `Enter the dungeon to continue!`, '#ffdd44');
  }

  /** Update portals: portals never expire — they stay until entered. Re-anchor near player if too far. */
  private updatePortals(_dt: number): void {
    const now = this.time.now;

    for (let i = this.activePortals.length - 1; i >= 0; i--) {
      const p = this.activePortals[i];

      // Pulsing label opacity
      p.label.setAlpha(Math.sin(now * 0.004) * 0.3 + 0.7);

      // If player walks very far away (> 300px), teleport portal to stay nearby
      const dist = distanceBetween(this.player.x, this.player.y, p.sprite.x, p.sprite.y);
      if (dist > 300) {
        const newX = this.player.x + 60;
        const newY = this.player.y;
        p.sprite.setPosition(newX, newY);
        p.label.setPosition(newX, newY + 18);
      }

      // Enter dungeon on contact
      if (!this.playerController.isDead && dist < 20) {
        this.enterDungeon(p.dungeonDef);
        this.clearAllPortals();
        return;
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

    // SFX + stop music before switching to dungeon
    this.musicManager?.playSFX('sfx_portal');
    this.musicManager?.stopMusic();

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
    completedDungeonId?: string;
  }): void {
    // Restore player stats from dungeon
    this.playerController.hp = data.hp;
    this.playerController.mp = data.mp;
    this.playerController.level = data.level;
    this.playerController.xp = data.xp;

    // Persist run state after dungeon return
    this.saveRunState();

    // Resume overworld music
    this.musicManager?.playMusic('music_overworld');

    // Grant invincibility on return
    this.playerController.grantInvincibility(3.0);

    // Snap camera to player position
    this.cameraController.snapToTarget();

    if (data.dungeonComplete) {
      this.events.emit('notification', 'Dungeon Cleared! Welcome back to Midgard.', '#44cc44');

      // Save checkpoint progress for this class
      if (data.completedDungeonId) {
        const stageIdx = ProgressManager.dungeonToStage(data.completedDungeonId);
        this.progressManager.unlockStage(this.classId, stageIdx);
      }

      // Spawn the next dungeon portal in sequence (if any)
      if (data.completedDungeonId) {
        const currentIdx = this.DUNGEON_PROGRESSION.findIndex(e => e.dungeonId === data.completedDungeonId);
        const next = this.DUNGEON_PROGRESSION[currentIdx + 1];
        if (next && !this.spawnedDungeonPortals.has(next.dungeonId)) {
          this.time.delayedCall(2000, () => {
            this.spawnDungeonPortalNearPlayer(next.dungeonId);
          });
        } else if (!next) {
          // All dungeons done — spawn the world final boss
          this.time.delayedCall(2000, () => {
            this.events.emit('notification', 'All dungeons cleared!', '#44cc44');
            this.events.emit('notification', 'Head to the CENTER of Midgard...', '#ffdd44');
          });
          this.time.delayedCall(4000, () => {
            this.spawnWorldBoss();
          });
        }
      }
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

  // ========================================================================
  // ICE WALL — Flat Earth Joke
  // ========================================================================

  /**
   * Shows a notification once when the player wanders within ~400px of any world edge.
   * The world is bounded by solid ice wall tiles, so they can't actually cross —
   * this is just a fun flat-earther Easter egg.
   */
  private checkIceWallProximity(): void {
    if (this.iceWallLabelShown) return;
    const edgeDist = Math.min(
      this.player.x,
      this.player.y,
      this.worldPixelSize - this.player.x,
      this.worldPixelSize - this.player.y,
    );
    if (edgeDist < 400) {
      this.iceWallLabelShown = true;
      this.events.emit('notification', '❄  THE ICE WALL  ❄', '#aaddff');
      this.time.delayedCall(600, () => {
        this.events.emit('notification', 'The edge of the flat realm. NASA doesn\'t want you here.', '#88bbcc');
      });
    }
  }

  // ========================================================================
  // CHECKPOINT / START STAGE
  // ========================================================================

  /**
   * When the player selects a checkpoint stage on CharacterSelect,
   * boost their level to the checkpoint's start level and pre-mark
   * all earlier dungeons as already spawned so the right portal appears.
   *
   * Stage → dungeon portal mapping:
   *   Stage 1 → verdant_hollows portal (already cleared frostheim)
   *   Stage 2 → muspelheim_forge portal
   *   Stage 3 → helheim_sanctum portal
   *   Stage 4 → awaken Fenrir immediately
   */
  private applyStartStage(): void {
    if (this.startStage <= 0) return;

    // Stage → level lookup (matches STAGE_CHECKPOINTS)
    const stageLevels = [1, 6, 8, 10, 10];
    const targetLevel = stageLevels[Math.min(this.startStage, 4)];

    // Set player level directly (bypass XP gain animation)
    while (this.playerController.level < targetLevel) {
      this.playerController.level++;
      this.playerController.maxHp += this.playerController.vitality;
      this.playerController.maxMp += this.playerController.wisdom;
      this.playerController.hp = this.playerController.maxHp;
      this.playerController.mp = this.playerController.maxMp;
    }

    // Mark all dungeons up to the previous stage as already done
    // so the correct NEXT portal spawns
    const clearedUpTo = this.startStage - 1; // 0-indexed into DUNGEON_PROGRESSION
    for (let i = 0; i < clearedUpTo && i < this.DUNGEON_PROGRESSION.length; i++) {
      this.spawnedDungeonPortals.add(this.DUNGEON_PROGRESSION[i].dungeonId);
    }

    if (this.startStage >= 4) {
      // All dungeons cleared — awaken Fenrir right away
      this.time.delayedCall(1500, () => {
        this.events.emit('notification', 'All dungeons cleared — Fenrir awaits in the center!', '#ffdd44');
        this.spawnWorldBoss();
      });
    } else {
      // Spawn the correct next portal near the player
      const nextPortal = this.DUNGEON_PROGRESSION[clearedUpTo];
      if (nextPortal && !this.spawnedDungeonPortals.has(nextPortal.dungeonId)) {
        this.time.delayedCall(1000, () => {
          this.spawnDungeonPortalNearPlayer(nextPortal.dungeonId);
        });
      }
    }

    this.events.emit('notification', `Checkpoint restored — Level ${targetLevel}`, '#aaddff');
  }

  // ========================================================================
  // RUN STATE PERSISTENCE — survive browser refresh
  // ========================================================================

  /**
   * Save the player's current level, XP, HP, MP, and spawned portals to
   * localStorage so a browser refresh restores their mid-run progress.
   */
  private saveRunState(): void {
    const state: PlayerRunState = {
      classId: this.classId,
      level: this.playerController.level,
      xp: this.playerController.xp,
      maxHp: this.playerController.maxHp,
      hp: this.playerController.hp,
      maxMp: this.playerController.maxMp,
      mp: this.playerController.mp,
      spawnedPortals: Array.from(this.spawnedDungeonPortals).join(','),
    };
    this.progressManager.saveRunState(state);
  }

  /**
   * Restore a previously saved run state after a browser refresh.
   * Only restores if the saved state is for the same class and the player
   * is currently at a lower level than the saved state (i.e. a real refresh,
   * not a fresh start from CharacterSelect with a checkpoint).
   */
  private restoreRunState(): void {
    const state = this.progressManager.loadRunState(this.classId);
    if (!state) return;

    // Don't restore a level-1 save (nothing meaningful to restore)
    if (state.level <= 1) return;

    // If a checkpoint already boosted us to a higher level than the saved state, skip
    if (this.startStage > 0 && this.playerController.level >= state.level) return;

    // Only restore if the saved level is higher than what we have now
    // (checkpoint boost may have already set a level; respect whichever is higher)
    if (state.level > this.playerController.level) {
      // Fast-forward level (recalculate max HP/MP per level)
      while (this.playerController.level < state.level) {
        this.playerController.level++;
        this.playerController.maxHp += this.playerController.vitality;
        this.playerController.maxMp += this.playerController.wisdom;
      }
    }

    // Restore XP position within the current level
    this.playerController.xp = state.xp;

    // Restore HP/MP (clamped to new maxes)
    this.playerController.maxHp = state.maxHp;
    this.playerController.maxMp = state.maxMp;
    this.playerController.hp    = Math.min(state.hp, state.maxHp);
    this.playerController.mp    = Math.min(state.mp, state.maxMp);

    // Restore which portals were already spawned so we don't duplicate them
    if (state.spawnedPortals) {
      for (const id of state.spawnedPortals.split(',')) {
        if (id) this.spawnedDungeonPortals.add(id);
      }
    }

    // Spawn the correct next dungeon portal if not yet spawned
    // (e.g. after refresh mid-run, the portal needs to re-appear)
    for (const entry of this.DUNGEON_PROGRESSION) {
      if (!this.spawnedDungeonPortals.has(entry.dungeonId) && state.level >= entry.level) {
        this.time.delayedCall(1500, () => {
          this.spawnDungeonPortalNearPlayer(entry.dungeonId);
        });
        break; // only spawn the first eligible one
      }
    }

    this.events.emit('notification', `Run restored — Level ${state.level}`, '#aaddff');
  }

  // ========================================================================
  // WORLD FINAL BOSS — Fenrir, The World Ender
  // ========================================================================

  /**
   * Spawns a DORMANT Fenrir near the player's starting area.
   * He is huge, terrifying, fires instant-kill shots, and cannot be damaged.
   * He is a warning — not yet a fight.
   * This is called once on create().
   */
  private spawnDormantFenrir(): void {
    // Place him at the true center of the world — the dark inner sanctum.
    // The player starts at 80% from center (outer Frozen Shores) so they won't
    // encounter Fenrir unless they deliberately navigate all the way to the center.
    const spawnX = this.worldPixelSize * 0.5;
    const spawnY = this.worldPixelSize * 0.5;
    this.worldBossHomeX = spawnX;
    this.worldBossHomeY = spawnY;

    this.worldBoss = this.physics.add.sprite(spawnX, spawnY, 'enemy_medium');
    this.worldBoss.setScale(4.0);
    this.worldBoss.setTint(0x330011);
    this.worldBoss.setDepth(15);
    this.worldBoss.body!.setSize(30, 30);
    this.worldBoss.setAlpha(0.85);

    // Dormant state — idle at center, instant-kill on contact, cannot be hurt
    this.worldBossData = {
      hp: 1,        // placeholder — not used while dormant
      maxHp: 1,
      fireCooldown: 2.5,
      spiralAngle: 0,
      phase: 0,     // 0 = dormant
    };

    // Floating "???" label — hints at mystery
    this.worldBossDormantLabel = this.add.text(spawnX, spawnY - 30, '? ? ?', {
      fontFamily: 'monospace', fontSize: '11px', color: '#550022',
      stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(50);

    this.tweens.add({
      targets: this.worldBossDormantLabel,
      alpha: 0.2,
      duration: 1800,
      yoyo: true,
      repeat: -1,
    });
  }

  /**
   * Called after all 4 dungeons are cleared.
   * Fenrir fully awakens: player gets massive stat boost, HP set to real values,
   * label changes to his name, damage becomes real.
   */
  spawnWorldBoss(): void {
    if (this.worldBossSpawned || !this.worldBoss) return;
    this.worldBossSpawned = true;
    this.worldBossAwake = true;

    // Dramatic visual transformation
    this.worldBoss.setTint(0x880022);
    this.worldBoss.setAlpha(1.0);
    this.worldBoss.setScale(4.5);

    // Remove dormant label
    if (this.worldBossDormantLabel) {
      this.worldBossDormantLabel.destroy();
      this.worldBossDormantLabel = null;
    }

    // Big level-10 stat boost — the player is now worthy
    const pc = this.playerController;
    const boost = 1.8;
    pc.maxHp  = Math.floor(pc.maxHp  * boost);
    pc.hp     = pc.maxHp;
    pc.maxMp  = Math.floor(pc.maxMp  * boost);
    pc.mp     = pc.maxMp;
    pc.attack    = Math.floor(pc.attack    * boost);
    pc.defense   = Math.floor(pc.defense   * boost);
    pc.speed     = Math.floor(pc.speed     * 1.3);
    pc.dexterity = Math.floor(pc.dexterity * 1.5);
    pc.grantInvincibility(3.0);

    // Awaken Fenrir's real HP
    const bossHp = 8000;
    this.worldBossData = {
      hp: bossHp,
      maxHp: bossHp,
      fireCooldown: 0,
      spiralAngle: 0,
      phase: 1,
    };

    // Boss health bar (screen-space)
    this.worldBossHealthBar = this.add.graphics().setDepth(200).setScrollFactor(0);
    this.worldBossNameText = this.add.text(400, 12, 'FENRIR  —  THE WORLD ENDER', {
      fontFamily: 'monospace', fontSize: '13px', color: '#ff4444',
      stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(201).setScrollFactor(0);

    // Wire projectiles to damage Fenrir now that he's awake
    this.physics.add.overlap(
      this.projectileManager.playerProjectiles,
      this.worldBoss,
      (projObj: any) => {
        if (!this.worldBossAwake) return;
        const proj = projObj as Phaser.Physics.Arcade.Sprite;
        if (!proj.active) return;
        this.projectileManager.deactivateProjectile(proj, true);
        const dmg = Math.floor(pc.getAttackDamage() * (proj.getData('damageMultiplier') ?? 1));
        if (this.worldBossData) {
          this.worldBossData.hp -= dmg;
          this.worldBoss!.setTint(0xffffff);
          this.time.delayedCall(80, () => { if (this.worldBoss?.active) this.worldBoss.setTint(0x880022); });
          this.showDamageNumber(this.worldBoss!.x, this.worldBoss!.y - 24, dmg);
          if (this.worldBossData.hp <= 0) this.onWorldBossDefeated();
        }
      },
      undefined, this,
    );

    this.events.emit('notification', '⚠  FENRIR AWAKENS!', '#ff2222');
    this.events.emit('notification', 'Power surges through you. Fight him!', '#ffdd44');
  }

  private updateWorldBoss(dt: number): void {
    if (!this.worldBoss || !this.worldBossData) return;
    const bd = this.worldBossData;

    // ---- DORMANT phase (0) — constrained idle at world center, instant-kill on touch ----
    if (bd.phase === 0) {
      bd.spiralAngle += dt * 0.3;

      // Orbit slowly within 80px of home — never leaves the dark inner circle
      const orbitRadius = 60;
      const targetX = this.worldBossHomeX + Math.cos(bd.spiralAngle) * orbitRadius;
      const targetY = this.worldBossHomeY + Math.sin(bd.spiralAngle) * orbitRadius;
      const toTargetX = targetX - this.worldBoss.x;
      const toTargetY = targetY - this.worldBoss.y;
      const toTargetDist = Math.sqrt(toTargetX * toTargetX + toTargetY * toTargetY);
      if (toTargetDist > 2) {
        const speed = Math.min(toTargetDist * 2, 25);
        this.worldBoss.setVelocity(
          (toTargetX / toTargetDist) * speed,
          (toTargetY / toTargetDist) * speed,
        );
      } else {
        this.worldBoss.setVelocity(0, 0);
      }

      const dormantDist = distanceBetween(this.worldBoss.x, this.worldBoss.y, this.player.x, this.player.y);

      // Instant-kill on contact — dormant Fenrir is a death sentence
      if (dormantDist < 32 && !this.playerController.isInvincible && !this.playerController.isDead) {
        this.playerController.takeDamage(this.playerController.maxHp * 20);
      }

      // Slow warning radial — 4 shots every 3s, low speed, mostly decorative
      bd.fireCooldown -= dt;
      if (bd.fireCooldown <= 0) {
        bd.fireCooldown = 3.0;
        for (let i = 0; i < 4; i++) {
          const a = (Math.PI * 2 / 4) * i + bd.spiralAngle;
          this.projectileManager.fireEnemyProjectile(
            this.worldBoss.x, this.worldBoss.y, a, 70, 9999, 4000,
          );
        }
      }

      // Update floating label position
      if (this.worldBossDormantLabel) {
        this.worldBossDormantLabel.setPosition(this.worldBoss.x, this.worldBoss.y - 34);
      }
      return;
    }

    // ---- AWAKE phases (1-3) ----
    const hpRatio = bd.hp / bd.maxHp;

    // Phase transitions
    if (hpRatio < 0.5 && bd.phase === 1) {
      bd.phase = 2;
      this.events.emit('notification', 'FENRIR ENRAGES!', '#ff4444');
    }
    if (hpRatio < 0.2 && bd.phase === 2) {
      bd.phase = 3;
      this.events.emit('notification', 'FENRIR GOES BERSERK!', '#ff0000');
    }

    // Chase player
    const speed = 55 + bd.phase * 20;
    const angle = angleBetween(this.worldBoss.x, this.worldBoss.y, this.player.x, this.player.y);
    const dist = distanceBetween(this.worldBoss.x, this.worldBoss.y, this.player.x, this.player.y);
    if (dist > 80) {
      this.worldBoss.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
    } else {
      this.worldBoss.setVelocity(0, 0);
    }

    // Contact = instant kill even while awake (you must dodge)
    if (dist < 32 && !this.playerController.isInvincible && !this.playerController.isDead) {
      this.playerController.takeDamage(this.playerController.maxHp * 10);
    }

    // Bullet patterns — escalating
    bd.fireCooldown -= dt;
    bd.spiralAngle += dt * (1.5 + bd.phase * 0.5);

    if (bd.fireCooldown <= 0) {
      bd.fireCooldown = Math.max(0.18, 0.6 - bd.phase * 0.12);

      if (bd.phase === 1) {
        for (let i = 0; i < 12; i++) {
          const a = (Math.PI * 2 / 12) * i + bd.spiralAngle;
          this.projectileManager.fireEnemyProjectile(this.worldBoss.x, this.worldBoss.y, a, 160, 9999, 3000);
        }
      } else if (bd.phase === 2) {
        for (let i = 0; i < 8; i++) {
          const a1 = (Math.PI * 2 / 8) * i + bd.spiralAngle;
          const a2 = a1 + Math.PI / 8;
          this.projectileManager.fireEnemyProjectile(this.worldBoss.x, this.worldBoss.y, a1, 190, 9999, 3000);
          this.projectileManager.fireEnemyProjectile(this.worldBoss.x, this.worldBoss.y, a2, 140, 9999, 3000);
        }
      } else {
        for (let i = 0; i < 16; i++) {
          const a = (Math.PI * 2 / 16) * i + bd.spiralAngle;
          this.projectileManager.fireEnemyProjectile(this.worldBoss.x, this.worldBoss.y, a, 220, 9999, 3500);
        }
        this.projectileManager.fireEnemyProjectile(this.worldBoss.x, this.worldBoss.y, angle, 260, 9999, 3000);
      }
    }

    // Health bar
    if (this.worldBossHealthBar) {
      this.worldBossHealthBar.clear();
      const barW = 260, barH = 12;
      const bx = 400 - barW / 2, by = 24;
      this.worldBossHealthBar.fillStyle(0x220000, 0.9);
      this.worldBossHealthBar.fillRect(bx, by, barW, barH);
      const col = hpRatio > 0.5 ? 0xcc0000 : hpRatio > 0.2 ? 0xff4400 : 0xff0000;
      this.worldBossHealthBar.fillStyle(col, 1);
      this.worldBossHealthBar.fillRect(bx, by, barW * Math.max(0, hpRatio), barH);
      this.worldBossHealthBar.lineStyle(1, 0x880000);
      this.worldBossHealthBar.strokeRect(bx, by, barW, barH);
    }
  }

  private onWorldBossDefeated(): void {
    this.worldBossAwake = false;
    if (this.worldBossHealthBar) { this.worldBossHealthBar.destroy(); this.worldBossHealthBar = null; }
    if (this.worldBossNameText) { this.worldBossNameText.destroy(); this.worldBossNameText = null; }
    this.worldBoss?.destroy();
    this.worldBoss = null;
    this.worldBossData = null;

    // Save the final checkpoint — Fenrir defeated
    this.progressManager.unlockStage(this.classId, 4);

    this.events.emit('notification', '⚡  FENRIR HAS FALLEN!', '#ffdd44');
    this.events.emit('notification', 'YOU ARE THE CHAMPION OF MIDGARD!', '#ffaa00');

    // Victory heal — restore full HP on boss kill
    this.playerController.hp = this.playerController.maxHp;
    this.playerController.mp = this.playerController.maxMp;
    this.showInstantHealEffect(this.player.x, this.player.y - 20, this.playerController.maxHp);

    // Transition to ending after dramatic pause
    this.time.delayedCall(4500, () => {
      this.cameras.main.fadeOut(1500, 0, 0, 0);
    });
    this.time.delayedCall(6000, () => {
      this.scene.stop('UIScene');
      this.scene.stop('GameScene');
      this.scene.start('EndingScene');
    });
  }
}
