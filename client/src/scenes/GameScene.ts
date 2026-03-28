import Phaser from 'phaser';
import { PlayerController } from '../systems/PlayerController';
import { ProjectileManager } from '../systems/ProjectileManager';
import { EnemyManager } from '../systems/EnemyManager';
import { WorldRenderer } from '../systems/WorldRenderer';
import { InputManager } from '../systems/InputManager';
import { CameraController } from '../systems/CameraController';
import { TILE_SIZE, REALM_SIZE, BulletPatternType } from '@yggdrasil/shared';
import type { ProjectilePattern } from '@yggdrasil/shared';
import { getDungeon, DungeonDef, DungeonBossDef, FENRIR_BOSS_DEF } from '../data/DungeonDatabase';
import { getClass, ClassDef } from '../data/ClassDatabase';
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
  // Index into DUNGEON_PROGRESSION of the last completed dungeon (-1 = none)
  private lastCompletedDungeonIdx: number = -1;
  // Flag set by DungeonScene return to trigger next portal spawn
  private pendingNextDungeonId: string | null = null;

  // World final boss (Fenrir — spawns at center when all dungeons cleared)
  private worldBoss: Phaser.Physics.Arcade.Sprite | null = null;
  private worldBossDef: DungeonBossDef = FENRIR_BOSS_DEF;
  private worldBossData: {
    hp: number; maxHp: number;
    currentPhaseIndex: number;
    patternTimers: Map<string, number>;
    spiralAngle: number;
    dormant: boolean; // true while waiting for all dungeons to be cleared
  } | null = null;
  private worldBossHealthBar: Phaser.GameObjects.Graphics | null = null;
  private worldBossNameText: Phaser.GameObjects.Text | null = null;
  private worldBossDialogueText: Phaser.GameObjects.Text | null = null;
  private worldBossSpawned: boolean = false;
  private worldBossAwake: boolean = false;   // dormant until all dungeons cleared
  private worldBossDormantLabel: Phaser.GameObjects.Text | null = null;
  private worldBossHomeX: number = 0;  // center of world — Fenrir's fixed lair
  private worldBossHomeY: number = 0;
  // Progressive reveal: opacity increases as dungeons are cleared (0.15 → 0.35 → 0.55 → 0.75 → 1.0)
  private worldBossRevealLevel: number = 0; // 0-4 based on dungeons cleared
  private _bossAwakeRetryScheduled: boolean = false;
  private _bossBoostApplied: boolean = false; // prevents compounding stat boosts on reload
  private _bossHitCooldown: number = 0; // prevents multi-projectile classes from melting boss
  private _bossDefeated: boolean = false; // prevents double-death
  // Tracks dungeons completed in THIS session (never lost to save issues)
  private _sessionCompletedDungeons: Set<string> = new Set();

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
    // Signal gameplay start to CrazyGames SDK
    const crazySdk = (window as any).CrazyGames?.SDK;
    if (crazySdk?.game) {
      try { crazySdk.game.gameplayStart(); } catch (_e) { /* ignore */ }
    }

    this.worldPixelSize = REALM_SIZE * TILE_SIZE;

    // 1. Input manager
    this.inputManager = new InputManager(this);

    // 2. World
    this.worldRenderer = new WorldRenderer(this);
    this.worldRenderer.generateWorld(Date.now()); // random seed for now

    // 3. Player — spawn in Frozen Shores (corner diagonal puts them in the ice biome, dist > 0.75)
    const spawnX = this.worldPixelSize * 0.88;
    const spawnY = this.worldPixelSize * 0.88;
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

    // Respawn on death (no permadeath — progress persists)
    this.playerController.permadeath = false;

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

    // 12. Spawn dormant Fenrir near player start — a warning of what's coming
    this.spawnDormantFenrir();

    // 13. Dungeon portal group
    this.portalGroup = this.physics.add.group({
      classType: Phaser.Physics.Arcade.Sprite,
      runChildUpdate: false,
    });

    // 14. Listen for return from dungeon.
    // Primary path: DungeonScene passes return data via scene.wake(key, data),
    // which fires the built-in Phaser 'wake' event with the data attached.
    this.events.on('wake', (_sys: any, data: any) => {
      // Fade in so the scene appears smoothly after the dungeon's black fade-out
      this.cameras.main.fadeIn(400, 0, 0, 0);
      if (data && data.level !== undefined) {
        this.onReturnFromDungeon(data);
      }
    }, this);
    // Fallback: keep the custom event for any edge case where GameScene is restarted.
    this.events.on('returnFromDungeon', this.onReturnFromDungeon, this);

    // Listen for level-up events to gate dungeon portals
    this.events.on('playerLevelUp', this.onPlayerLevelUp, this);

    // 15. Progress manager (per-class checkpoints)
    this.progressManager = new ProgressManager();

    // Apply checkpoint start stage — boost player level and pre-unlock dungeon portals
    this.applyStartStage();

    // Restore mid-run state from localStorage (survives browser refresh)
    this.restoreRunState();

    // Emit initial objective so top-right box appears from the start
    this.time.delayedCall(500, () => this.emitObjectiveUpdate());

    // 16. Listen for death (respawn, not permadeath)
    this.events.on('playerDeath', this.onPermaDeath, this);

    // 17. Music
    this.musicManager = new MusicManager(this);
    this.musicManager.playMusic('music_overworld');
  }

  update(time: number, delta: number): void {
    const dt = delta / 1000; // convert to seconds

    // Update crosshair position (screen space) — hide on mobile
    if (InputManager.isMobile) {
      this.crosshair.setVisible(false);
    } else {
      this.crosshair.setPosition(
        this.input.activePointer.x,
        this.input.activePointer.y,
      );
    }

    // Get aim target: mouse on desktop, nearest enemy on mobile
    let aimX: number;
    let aimY: number;

    if (InputManager.isMobile) {
      // Auto-aim at nearest enemy within range (including world boss)
      const nearby = this.enemyManager.getEnemiesInRange(this.player.x, this.player.y, 400);
      // Also consider world boss as a target
      if (this.worldBoss && this.worldBoss.active && this.worldBossAwake) {
        const bDist = (this.worldBoss.x - this.player.x) ** 2 + (this.worldBoss.y - this.player.y) ** 2;
        if (bDist < 400 * 400) {
          nearby.push(this.worldBoss);
        }
      }
      if (nearby.length > 0) {
        let nearest = nearby[0];
        let nearestDist = Infinity;
        for (const e of nearby) {
          const d = (e.x - this.player.x) ** 2 + (e.y - this.player.y) ** 2;
          if (d < nearestDist) { nearestDist = d; nearest = e; }
        }
        aimX = nearest.x;
        aimY = nearest.y;
      } else {
        // No enemies nearby: aim in movement direction or straight ahead
        const dir = this.inputManager.getMovementDirection();
        if (dir.x !== 0 || dir.y !== 0) {
          aimX = this.player.x + dir.x * 200;
          aimY = this.player.y + dir.y * 200;
        } else {
          aimX = this.player.x + 200;
          aimY = this.player.y;
        }
      }
    } else {
      const worldPoint = this.cameras.main.getWorldPoint(
        this.input.activePointer.x,
        this.input.activePointer.y,
      );
      aimX = worldPoint.x;
      aimY = worldPoint.y;
    }

    // Update systems
    this.inputManager.update();
    this.playerController.update(dt, aimX, aimY);
    this.projectileManager.update(dt);
    this.enemyManager.update(dt, this.player.x, this.player.y);
    this.cameraController.update(dt);
    this.abilitySystem.update(dt);

    // Handle shooting
    if (this.inputManager.isShootingPressed()) {
      this.projectileManager.firePlayerProjectile(
        this.player.x,
        this.player.y,
        aimX,
        aimY,
      );
    }

    // Space bar / ability button: use ability
    if (this.inputManager.isAbilityPressed() && !this.playerController.isDead) {
      const used = this.abilitySystem.useAbility(aimX, aimY);
      if (used) this.musicManager?.playSFX('sfx_ability');
    }

    // P key: pull current portal to player (or show status)
    if (this.inputManager.isPortalKeyPressed() && !this.playerController.isDead) {
      this.onPortalKeyPressed();
    }

    // Check portal proximity and lifetime
    this.updatePortals(dt);

    // Ice wall proximity joke — show once when player gets near the edge
    this.checkIceWallProximity();

    // Safety net: if all dungeons cleared but boss still dormant, awaken it
    // Check multiple sources: lastCompletedDungeonIdx, spawnedDungeonPortals, AND ProgressManager
    if (this.worldBoss && this.worldBoss.active && !this.worldBossAwake && !this._bossAwakeRetryScheduled) {
      const allDungeonsCleared = this.lastCompletedDungeonIdx >= 3
        || this.DUNGEON_PROGRESSION.every(e => this.spawnedDungeonPortals.has(e.dungeonId))
        || this.progressManager.getHighestStage(this.classId) >= 4
        || this._sessionCompletedDungeons.size >= this.DUNGEON_PROGRESSION.length;
      if (allDungeonsCleared) {
        this._bossAwakeRetryScheduled = true;
        this.spawnWorldBoss();
      }
    }

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

    let damage = projectile.getData('damage') ?? 10;
    // Boss projectiles use sentinel -1: deal 10% of player max HP
    if (damage < 0) {
      damage = Math.floor(this.playerController.maxHp * 0.10);
    }
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
  // PORTAL KEY (P) — pull current dungeon portal to player
  // ========================================================================

  private onPortalKeyPressed(): void {
    const level = this.playerController.level;
    if (level < 5) {
      this.events.emit('notification', 'Reach Level 5 to unlock dungeons!', '#ff8800');
      return;
    }
    if (this.activePortals.length === 0) {
      this.events.emit('notification', 'No portal available. Level up to unlock the next dungeon!', '#ff8800');
      return;
    }
    // Teleport the portal right next to the player
    const p = this.activePortals[0];
    const newX = this.player.x + 50;
    const newY = this.player.y;
    p.sprite.setPosition(newX, newY);
    p.label.setPosition(newX, newY + 18);
    this.events.emit('notification', `Portal summoned! → ${p.dungeonDef.name}`, '#cc88ff');
  }

  // ========================================================================
  // PERMADEATH
  // ========================================================================

  /** Handle player death — respawn in place (progress is preserved) */
  private onPermaDeath(_data: { level: number; causeOfDeath: string }): void {
    // Save run state so progress persists through death
    // PlayerController.permadeath = false, so it auto-respawns after 3s
    // UIScene shows the "YOU DIED / Respawning in 3..." countdown overlay
    this.saveRunState();
  }

  // ========================================================================
  // DUNGEON PORTAL SYSTEM — level-gated progression
  // ========================================================================

  /** Called when player levels up — spawn the gated dungeon portal if applicable */
  private onPlayerLevelUp(newLevel: number): void {
    this.musicManager?.playSFX('sfx_level_up');

    // Save run state on every level-up so a refresh restores the new level
    this.saveRunState();

    // Update objective box whenever player levels
    this.emitObjectiveUpdate();

    const entry = this.DUNGEON_PROGRESSION.find(e => e.level === newLevel);
    if (!entry) return;
    if (this.spawnedDungeonPortals.has(entry.dungeonId)) return;

    // Small delay so the level-up text clears first
    this.time.delayedCall(1200, () => {
      this.spawnDungeonPortalNearPlayer(entry.dungeonId);
      this.emitObjectiveUpdate(); // refresh after portal appears
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

    // Save run state before sleeping so a browser refresh while in dungeon restores correctly
    this.saveRunState();

    // Sleep GameScene (preserves all state) and start DungeonScene
    this.scene.sleep('GameScene');
    this.scene.start('DungeonScene', config);
  }

  /** Handle returning from a dungeon */
  private onReturnFromDungeon(data: {
    hp: number; mp: number; level: number; xp: number;
    maxHp?: number; maxMp?: number; xpToNext?: number;
    attack?: number; defense?: number; speed?: number;
    dexterity?: number; vitality?: number; wisdom?: number;
    dungeonComplete: boolean; completedDungeonId?: string;
  }): void {
    // Restore ALL player stats from dungeon so levels gained inside fully carry back
    this.playerController.level = data.level;
    this.playerController.xp = data.xp;
    if (data.maxHp    !== undefined) this.playerController.maxHp    = data.maxHp;
    if (data.maxMp    !== undefined) this.playerController.maxMp    = data.maxMp;
    if (data.xpToNext !== undefined) this.playerController.xpToNext = data.xpToNext;
    if (data.attack   !== undefined) this.playerController.attack   = data.attack;
    if (data.defense  !== undefined) this.playerController.defense  = data.defense;
    if (data.speed    !== undefined) this.playerController.speed    = data.speed;
    if (data.dexterity !== undefined) this.playerController.dexterity = data.dexterity;
    if (data.vitality  !== undefined) this.playerController.vitality  = data.vitality;
    if (data.wisdom    !== undefined) this.playerController.wisdom    = data.wisdom;
    this.playerController.hp = data.hp;
    this.playerController.mp = data.mp;

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
      // Always force-spawn on dungeon completion — remove stale tracking so portal re-appears
      if (data.completedDungeonId) {
        // Track in session-level set (immune to save/data module issues)
        this._sessionCompletedDungeons.add(data.completedDungeonId);

        const currentIdx = this.DUNGEON_PROGRESSION.findIndex(e => e.dungeonId === data.completedDungeonId);
        this.lastCompletedDungeonIdx = Math.max(this.lastCompletedDungeonIdx, currentIdx);

        // Progressive reveal of Fenrir — each dungeon cleared makes him more visible
        this.updateFenrirReveal(this.lastCompletedDungeonIdx + 1);
        const next = this.DUNGEON_PROGRESSION[currentIdx + 1];
        if (next) {
          // Remove stale tracking — portal might have been spawned then cleared when entering dungeon
          this.spawnedDungeonPortals.delete(next.dungeonId);
          // Spawn immediately so the next dungeon is always available on return
          this.spawnDungeonPortalNearPlayer(next.dungeonId);
          this.saveRunState();
          this.emitObjectiveUpdate();
        } else {
          // All dungeons cleared — apply massive stat boost for the world boss fight
          this.events.emit('notification', 'All dungeons cleared!', '#44cc44');
          this.events.emit('notification', '⚡ Power of Yggdrasil granted!', '#ffdd44');
          this.events.emit('notification', 'Head to the CENTER of Midgard...', '#ff8800');

          // Progressive reveal reaches max before awakening
          this.updateFenrirReveal(4);

          this.saveRunState();
          this.emitObjectiveUpdate();
          this.time.delayedCall(2000, () => {
            this.spawnWorldBoss();
          });
        }
      }
    } else {
      this.events.emit('notification', 'Returned to Midgard.', '#aaccff');
    }

    // Update objective box after returning from dungeon
    this.emitObjectiveUpdate();
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
   * Stage → dungeon mapping (stageIndex = number of dungeons already cleared):
   *   Stage 1 → cleared frostheim → spawn verdant portal
   *   Stage 2 → cleared frostheim+verdant → spawn muspelheim portal
   *   Stage 3 → cleared frostheim+verdant+muspelheim → spawn helheim portal
   *   Stage 4 → all cleared → awaken Fenrir
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

    // stageIndex = number of dungeons already cleared
    // Mark exactly those dungeons as done so the next one spawns a portal
    const numCleared = this.startStage; // e.g. stage 1 = cleared 1 dungeon (frostheim)
    for (let i = 0; i < numCleared && i < this.DUNGEON_PROGRESSION.length; i++) {
      this.spawnedDungeonPortals.add(this.DUNGEON_PROGRESSION[i].dungeonId);
    }
    this.lastCompletedDungeonIdx = numCleared - 1;

    if (this.startStage >= 4) {
      // All dungeons cleared — populate session tracking so safety net works
      for (const entry of this.DUNGEON_PROGRESSION) {
        this._sessionCompletedDungeons.add(entry.dungeonId);
      }
      // Awaken Fenrir right away
      this.updateFenrirReveal(4);
      this.time.delayedCall(1500, () => {
        this.events.emit('notification', 'All dungeons cleared — Fenrir awaits in the center!', '#ffdd44');
        this.spawnWorldBoss();
      });
    } else {
      // Apply progressive reveal based on how many dungeons were cleared at checkpoint
      if (this.startStage > 0) {
        this.time.delayedCall(500, () => this.updateFenrirReveal(this.startStage));
      }
      // Spawn the correct next portal (index = numCleared)
      const nextPortal = this.DUNGEON_PROGRESSION[numCleared];
      if (nextPortal && !this.spawnedDungeonPortals.has(nextPortal.dungeonId)) {
        this.time.delayedCall(1000, () => {
          this.spawnDungeonPortalNearPlayer(nextPortal.dungeonId);
          this.emitObjectiveUpdate();
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
      lastCompletedDungeonIdx: this.lastCompletedDungeonIdx,
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

    // If a named checkpoint was selected (startStage > 0), clearRunState() was already
    // called in CharacterSelectScene — no run state should exist.  Skip anyway to be safe.
    if (this.startStage > 0) return;

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

    // Restore last completed dungeon index
    if (state.lastCompletedDungeonIdx !== undefined) {
      this.lastCompletedDungeonIdx = state.lastCompletedDungeonIdx;
    }

    // Fallback: derive lastCompletedDungeonIdx from spawnedDungeonPortals for older saves
    if (this.lastCompletedDungeonIdx < 0) {
      for (let i = this.DUNGEON_PROGRESSION.length - 1; i >= 0; i--) {
        if (this.spawnedDungeonPortals.has(this.DUNGEON_PROGRESSION[i].dungeonId)) {
          this.lastCompletedDungeonIdx = i;
          break;
        }
      }
    }

    // Spawn the correct next dungeon portal if not yet spawned
    // Priority: use lastCompletedDungeonIdx (exact, even if level < next dungeon requirement)
    // Fallback: level-based check (for saves from older sessions)
    let portalSpawned = false;
    if (this.lastCompletedDungeonIdx >= 0) {
      const nextIdx = this.lastCompletedDungeonIdx + 1;
      const nextEntry = this.DUNGEON_PROGRESSION[nextIdx];
      if (nextEntry && !this.spawnedDungeonPortals.has(nextEntry.dungeonId)) {
        this.time.delayedCall(1500, () => {
          this.spawnDungeonPortalNearPlayer(nextEntry.dungeonId);
          this.emitObjectiveUpdate();
        });
        portalSpawned = true;
      }
    }
    if (!portalSpawned) {
      // Fallback: level-based portal re-spawn for existing saves
      for (const entry of this.DUNGEON_PROGRESSION) {
        if (!this.spawnedDungeonPortals.has(entry.dungeonId) && state.level >= entry.level) {
          this.time.delayedCall(1500, () => {
            this.spawnDungeonPortalNearPlayer(entry.dungeonId);
            this.emitObjectiveUpdate();
          });
          break; // only spawn the first eligible one
        }
      }
    }

    // Apply progressive reveal based on restored dungeon progress
    if (this.lastCompletedDungeonIdx >= 0) {
      const dungeonsCleared = this.lastCompletedDungeonIdx + 1;
      this.time.delayedCall(500, () => this.updateFenrirReveal(dungeonsCleared));

      // All 4 dungeons cleared — awaken Fenrir so projectiles and auto-aim work
      // Mark boost as already applied since saved stats include the boost
      if (dungeonsCleared >= 4) {
        this._bossBoostApplied = true;
        this.time.delayedCall(1500, () => {
          this.spawnWorldBoss();
        });
      }
    }

    this.events.emit('notification', `Run restored — Level ${state.level}`, '#aaddff');
    // Update objective box after state restore
    this.emitObjectiveUpdate();
  }

  // ========================================================================
  // OBJECTIVE BOX — top-right HUD panel showing current goal
  // ========================================================================

  /** Emit current dungeon progression objective to UIScene quest tracker */
  private emitObjectiveUpdate(): void {
    const level = this.playerController?.level ?? 1;
    const objectives: { desc: string; current: number; target: number; done: boolean }[] = [];

    // Priority 1: a portal is currently visible — tell player to enter it
    if (this.activePortals.length > 0) {
      const p = this.activePortals[0];
      objectives.push({
        desc: `Enter portal → ${p.dungeonDef.name}  [Press P]`,
        current: 1, target: 1, done: false,
      });
    } else {
      // Priority 2: find the next dungeon the player hasn't cleared yet
      const nextEntry = this.DUNGEON_PROGRESSION.find(e => !this.spawnedDungeonPortals.has(e.dungeonId));
      if (nextEntry) {
        const d = getDungeon(nextEntry.dungeonId);
        if (d) {
          objectives.push({
            desc: `Reach Lv.${nextEntry.level} → ${d.name}`,
            current: level,
            target: nextEntry.level,
            done: level >= nextEntry.level,
          });
        }
      } else {
        // All dungeons cleared
        objectives.push({
          desc: 'Seek the World Boss at the center!',
          current: 1, target: 1, done: false,
        });
      }
    }

    this.events.emit('questUpdate', [{ name: 'Objectives', objectives }]);
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
    const spawnX = this.worldPixelSize * 0.5;
    const spawnY = this.worldPixelSize * 0.5;
    this.worldBossHomeX = spawnX;
    this.worldBossHomeY = spawnY;

    this.worldBoss = this.physics.add.sprite(spawnX, spawnY, this.worldBossDef.textureKey);
    this.worldBoss.setScale(3.5);
    this.worldBoss.setTint(0x220011);
    this.worldBoss.setDepth(15);
    this.worldBoss.body!.setSize(30, 30);
    this.worldBoss.setCollideWorldBounds(true);

    // Progressive reveal: starts as a faint shadow, becomes more visible with each dungeon cleared
    this.worldBossRevealLevel = 0;
    this.worldBoss.setAlpha(0.15); // barely visible silhouette

    // Dormant state — idle at center, instant-kill on contact, cannot be hurt
    this.worldBossData = {
      hp: 1,        // placeholder — not used while dormant
      maxHp: 1,
      currentPhaseIndex: 0,
      patternTimers: new Map(),
      spiralAngle: 0,
      dormant: true,
    };

    // Floating "???" label — hints at mystery
    this.worldBossDormantLabel = this.add.text(spawnX, spawnY - 30, '? ? ?', {
      fontFamily: 'monospace', fontSize: '11px', color: '#550022',
      stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(50);
    this.worldBossDormantLabel.setAlpha(0.15);

    this.tweens.add({
      targets: this.worldBossDormantLabel,
      alpha: { from: 0.1, to: 0.25 },
      duration: 1800,
      yoyo: true,
      repeat: -1,
    });

    // Slow, eerie pulsing animation for the dormant boss
    this.tweens.add({
      targets: this.worldBoss,
      scaleX: { from: 3.5, to: 3.8 },
      scaleY: { from: 3.5, to: 3.8 },
      duration: 2500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Register projectile overlap EARLY — callback guards on worldBossAwake
    // so it only processes hits when the boss is in the awake fighting phase.
    this.physics.add.overlap(
      this.projectileManager.playerProjectiles,
      this.worldBoss,
      (objA: any, objB: any) => {
        if (!this.worldBossAwake || !this.worldBossData || this._bossDefeated) return;
        // Phaser may swap parameter order — identify which is the projectile
        const proj = (objA === this.worldBoss ? objB : objA) as Phaser.Physics.Arcade.Sprite;
        if (!proj.active || proj === this.worldBoss) return; // never deactivate the boss
        this.projectileManager.deactivateProjectile(proj, true);
        // Damage cooldown: max 5 effective hits per second regardless of projectile count
        if (this._bossHitCooldown > 0) return;
        this._bossHitCooldown = 0.2;
        this.applyBossDamage();
      },
      undefined, this,
    );
  }

  /** Progressive reveal: increase Fenrir's visibility as dungeons are cleared */
  private updateFenrirReveal(dungeonsCleared: number): void {
    if (!this.worldBoss || this.worldBossAwake) return;

    this.worldBossRevealLevel = Math.min(4, dungeonsCleared);
    // Opacity: 0.15 → 0.35 → 0.55 → 0.75 → 1.0
    const alphaSteps = [0.15, 0.35, 0.55, 0.75, 1.0];
    const targetAlpha = alphaSteps[this.worldBossRevealLevel];
    // Scale grows slightly: 3.5 → 3.7 → 3.9 → 4.1 → 4.5
    const scaleSteps = [3.5, 3.7, 3.9, 4.1, 4.5];
    const targetScale = scaleSteps[this.worldBossRevealLevel];
    // Tint becomes more vivid: dark shadow → dark red → crimson
    const tintSteps = [0x220011, 0x440022, 0x660022, 0x880022, 0xaa0033];
    const targetTint = tintSteps[this.worldBossRevealLevel];

    // Kill existing scale tweens and animate to new state
    this.tweens.killTweensOf(this.worldBoss);
    this.tweens.add({
      targets: this.worldBoss,
      alpha: targetAlpha,
      duration: 1500,
      ease: 'Power2',
      onComplete: () => {
        if (this.worldBoss && !this.worldBossAwake) {
          // Resume subtle pulsing at new scale
          this.tweens.add({
            targets: this.worldBoss,
            scaleX: { from: targetScale, to: targetScale + 0.3 },
            scaleY: { from: targetScale, to: targetScale + 0.3 },
            duration: 2500,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
          });
        }
      },
    });
    this.worldBoss.setScale(targetScale);
    this.worldBoss.setTint(targetTint);

    // Update label too
    if (this.worldBossDormantLabel) {
      const labels = ['? ? ?', '? ? ?', 'F E N R I R', 'F E N R I R', 'FENRIR AWAITS'];
      const colors = ['#550022', '#770033', '#990033', '#cc0044', '#ff2244'];
      this.worldBossDormantLabel.setText(labels[this.worldBossRevealLevel]);
      this.worldBossDormantLabel.setColor(colors[this.worldBossRevealLevel]);
      this.tweens.killTweensOf(this.worldBossDormantLabel);
      this.tweens.add({
        targets: this.worldBossDormantLabel,
        alpha: { from: targetAlpha * 0.5, to: targetAlpha },
        duration: 1800,
        yoyo: true,
        repeat: -1,
      });
    }

    // Increase dormant firing intensity as reveal progresses
    if (this.worldBossData && this.worldBossData.phase === 0) {
      // More warning shots as Fenrir becomes more visible
      this.worldBossData.fireCooldown = Math.max(0.5, 3.0 - dungeonsCleared * 0.5);
    }
  }

  /**
   * Called after all 4 dungeons are cleared.
   * Fenrir fully awakens: player gets massive stat boost, HP set to real values,
   * label changes to his name, damage becomes real.
   */
  spawnWorldBoss(): void {
    if (this.worldBossSpawned) return;
    if (!this.worldBoss || !this.worldBoss.active) {
      // Boss sprite not ready — reset retry flag so safety net can try again
      this._bossAwakeRetryScheduled = false;
      return;
    }
    this.worldBossSpawned = true;
    this.worldBossAwake = true;

    // Kill dormant tweens
    this.tweens.killTweensOf(this.worldBoss);

    // Dramatic visual transformation — entrance pop like dungeon bosses
    this.worldBoss.setTint(0xffffff); // white flash
    this.worldBoss.setAlpha(1.0);
    this.tweens.add({
      targets: this.worldBoss,
      scaleX: 5.0, scaleY: 5.0,
      duration: 400,
      ease: 'Back.easeOut',
      onComplete: () => {
        if (this.worldBoss?.active) {
          this.tweens.add({ targets: this.worldBoss, scaleX: 4.5, scaleY: 4.5, duration: 200, ease: 'Power2' });
        }
      },
    });
    this.time.delayedCall(300, () => {
      if (this.worldBoss?.active) this.worldBoss.setTint(0xcc0033);
    });

    // Remove dormant label
    if (this.worldBossDormantLabel) {
      this.worldBossDormantLabel.destroy();
      this.worldBossDormantLabel = null;
    }

    // Massive stat boost for the Fenrir fight — the player is now worthy
    // Guard: only apply boost ONCE to prevent compounding on reload
    const pc = this.playerController;
    if (!this._bossBoostApplied) {
      this._bossBoostApplied = true;
      const boost = 1.8;
      pc.maxHp  = Math.floor(pc.maxHp  * boost);
      pc.maxMp  = Math.floor(pc.maxMp  * boost);
      pc.attack    = Math.floor(pc.attack    * boost);
      pc.defense   = Math.floor(pc.defense   * boost);
      pc.speed     = Math.floor(pc.speed     * 1.3);
      pc.dexterity = Math.floor(pc.dexterity * 1.5);
    }
    pc.hp     = pc.maxHp;
    pc.mp     = pc.maxMp;
    pc.grantInvincibility(5.0);

    // Awaken Fenrir — use data-driven definition
    const bossHp = this.worldBossDef.maxHp;
    this.worldBossData = {
      hp: bossHp,
      maxHp: bossHp,
      currentPhaseIndex: 0,
      patternTimers: new Map(),
      spiralAngle: 0,
      dormant: false,
    };

    // Boss health bar (screen-space)
    this.worldBossHealthBar = this.add.graphics().setDepth(200).setScrollFactor(0);
    this.worldBossNameText = this.add.text(400, 12, this.worldBossDef.name, {
      fontFamily: 'monospace', fontSize: '13px', color: '#ff4444',
      stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(201).setScrollFactor(0);

    // Show phase 1 dialogue
    const firstPhase = this.worldBossDef.phases[0];
    if (firstPhase?.dialogue) {
      this.showWorldBossDialogue(firstPhase.dialogue);
    }

    // Boss music
    this.musicManager?.playMusic('music_boss');

    // Enlarge physics body to match the awake visual scale (4.5x)
    if (this.worldBoss.body) {
      (this.worldBoss.body as Phaser.Physics.Arcade.Body).setSize(64, 64, true);
    }

    this.events.emit('notification', '⚠  FENRIR AWAKENS!', '#ff2222');
    this.events.emit('notification', 'Power surges through you. Fight him!', '#ffdd44');
  }

  private showWorldBossDialogue(text: string): void {
    if (!this.worldBoss) return;
    if (this.worldBossDialogueText) this.worldBossDialogueText.destroy();
    this.worldBossDialogueText = this.add.text(
      this.worldBoss.x, this.worldBoss.y - 40, text,
      { fontFamily: 'monospace', fontSize: '9px', color: '#ff8888', stroke: '#000', strokeThickness: 3 },
    ).setOrigin(0.5).setDepth(50);
    this.tweens.add({
      targets: this.worldBossDialogueText,
      y: this.worldBoss.y - 80,
      alpha: 0,
      duration: 3500,
      onComplete: () => this.worldBossDialogueText?.destroy(),
    });
  }

  private updateWorldBoss(dt: number): void {
    if (!this.worldBoss || !this.worldBossData || this._bossDefeated) return;
    const bd = this.worldBossData;

    // ---- DORMANT phase — constrained idle at world center, instant-kill on touch ----
    if (bd.dormant) {
      // Direct awakening: if all dungeons cleared, awaken immediately from dormant
      // This is the most reliable path — checked every frame, no flags or delays
      const shouldAwaken = !this.worldBossSpawned && (
        this.lastCompletedDungeonIdx >= 3
        || this._sessionCompletedDungeons.size >= this.DUNGEON_PROGRESSION.length
        || this.DUNGEON_PROGRESSION.every(e => this.spawnedDungeonPortals.has(e.dungeonId))
        || this.progressManager.getHighestStage(this.classId) >= 4
      );
      if (shouldAwaken) {
        console.log('[Fenrir] Dormant phase detected all dungeons cleared — awakening now');
        this.spawnWorldBoss();
        return;
      }

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

      // Dormant contact damage — if dungeons are cleared, use 10% HP (boss is about to awaken)
      // Otherwise instant-kill (player shouldn't be here before clearing dungeons)
      if (dormantDist < 32 && !this.playerController.isInvincible && !this.playerController.isDead) {
        const allCleared = this.lastCompletedDungeonIdx >= 3
          || this._sessionCompletedDungeons.size >= this.DUNGEON_PROGRESSION.length
          || this.progressManager.getHighestStage(this.classId) >= 4;
        const dmg = allCleared
          ? Math.floor(this.playerController.maxHp * 0.10)
          : this.playerController.maxHp * 20;
        this.playerController.takeDamage(dmg);
      }

      // Slow warning radial — 4 shots every 3s, low speed
      const dormantTimer = bd.patternTimers.get('dormant_fire') ?? 2.5;
      const newDormantTimer = dormantTimer - dt;
      if (newDormantTimer <= 0) {
        bd.patternTimers.set('dormant_fire', Math.max(0.5, 3.0 - this.worldBossRevealLevel * 0.5));
        const allCleared = this.lastCompletedDungeonIdx >= 3
          || this._sessionCompletedDungeons.size >= this.DUNGEON_PROGRESSION.length
          || this.progressManager.getHighestStage(this.classId) >= 4;
        const projDmg = allCleared ? -1 : 9999; // -1 sentinel = 10% HP when dungeons cleared
        for (let i = 0; i < 4; i++) {
          const a = (Math.PI * 2 / 4) * i + bd.spiralAngle;
          this.projectileManager.fireEnemyProjectile(
            this.worldBoss.x, this.worldBoss.y, a, 70, projDmg, 4000,
          );
        }
      } else {
        bd.patternTimers.set('dormant_fire', newDormantTimer);
      }

      // Update floating label position
      if (this.worldBossDormantLabel) {
        this.worldBossDormantLabel.setPosition(this.worldBoss.x, this.worldBoss.y - 34);
      }
      return;
    }

    // ---- AWAKE — data-driven phase/pattern system (mirrors DungeonScene boss logic) ----
    // Tick damage cooldown
    if (this._bossHitCooldown > 0) this._bossHitCooldown -= dt;

    // Force visibility — boss must NEVER become invisible while awake
    if (this.worldBoss.alpha < 0.9) this.worldBoss.setAlpha(1.0);

    const hpRatio = bd.hp / bd.maxHp;
    const bossDef = this.worldBossDef;

    // Phase transitions — forward iteration, last matching phase wins (same as DungeonScene)
    let phaseIndex = 0;
    for (let i = 0; i < bossDef.phases.length; i++) {
      if (hpRatio <= bossDef.phases[i].healthThreshold) {
        phaseIndex = i;
      }
    }

    if (phaseIndex !== bd.currentPhaseIndex) {
      bd.currentPhaseIndex = phaseIndex;
      const phase = bossDef.phases[phaseIndex];

      // Phase transition dialogue + notification
      this.showWorldBossDialogue(phase.dialogue);
      this.events.emit('notification', phase.phaseName.toUpperCase() + '!', '#ff4444');

      // Flash boss white for phase transition
      this.worldBoss.setTint(0xffffff);
      this.time.delayedCall(200, () => {
        if (this.worldBoss?.active) this.worldBoss.setTint(0xcc0033);
      });
    }

    const phase = bossDef.phases[phaseIndex];
    const speed = bossDef.speed * phase.speedMultiplier;

    // Chase player if in range, otherwise return to center
    const chaseRange = 450;
    const angle = angleBetween(this.worldBoss.x, this.worldBoss.y, this.player.x, this.player.y);
    const dist = distanceBetween(this.worldBoss.x, this.worldBoss.y, this.player.x, this.player.y);
    const homeDist = distanceBetween(this.worldBoss.x, this.worldBoss.y, this.worldBossHomeX, this.worldBossHomeY);

    if (this.playerController.isDead || dist > chaseRange) {
      // Return to center when player is dead or out of range
      if (homeDist > 10) {
        const homeAngle = angleBetween(this.worldBoss.x, this.worldBoss.y, this.worldBossHomeX, this.worldBossHomeY);
        const returnSpeed = Math.min(homeDist * 2, speed);
        this.worldBoss.setVelocity(Math.cos(homeAngle) * returnSpeed, Math.sin(homeAngle) * returnSpeed);
      } else {
        this.worldBoss.setVelocity(0, 0);
      }
    } else if (dist > 80) {
      this.worldBoss.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
    } else {
      this.worldBoss.setVelocity(0, 0);
    }

    // Contact damage — 15% of player max HP (punishing for getting too close)
    if (dist < 32 && !this.playerController.isInvincible && !this.playerController.isDead) {
      this.playerController.takeDamage(Math.floor(this.playerController.maxHp * 0.15));
    }

    // Fire patterns — data-driven, same approach as DungeonScene.updateBoss
    bd.spiralAngle += dt * 2;

    for (const patternId of phase.patternIds) {
      const pattern = bossDef.patterns[patternId];
      if (!pattern) continue;

      const timer = bd.patternTimers.get(patternId) ?? 0;
      const newTimer = timer - dt;

      if (newTimer <= 0) {
        this.fireWorldBossPattern(pattern);
        bd.patternTimers.set(patternId, 1.0 / pattern.fireRate);
      } else {
        bd.patternTimers.set(patternId, newTimer);
      }
    }

    // Manual hit detection fallback — catches projectiles that physics overlap misses
    if (!this._bossDefeated) {
      const bossX = this.worldBoss.x;
      const bossY = this.worldBoss.y;
      const hitRadius = 48;
      this.projectileManager.playerProjectiles.getChildren().forEach((child: any) => {
        const p = child as Phaser.Physics.Arcade.Sprite;
        if (!p.active || this._bossDefeated) return;
        const dx = p.x - bossX;
        const dy = p.y - bossY;
        if (dx * dx + dy * dy < hitRadius * hitRadius) {
          this.projectileManager.deactivateProjectile(p, true);
          if (this._bossHitCooldown > 0) return;
          this._bossHitCooldown = 0.2;
          this.applyBossDamage();
        }
      });
    }

    // Health bar — recalculate ratio after possible damage
    const updatedHpRatio = bd.hp / bd.maxHp;
    if (this.worldBossHealthBar) {
      this.worldBossHealthBar.clear();
      const barW = 260, barH = 12;
      const hbX = 400 - barW / 2, hbY = 24;
      this.worldBossHealthBar.fillStyle(0x220000, 0.9);
      this.worldBossHealthBar.fillRect(hbX, hbY, barW, barH);
      const col = updatedHpRatio > 0.5 ? 0xcc0000 : updatedHpRatio > 0.2 ? 0xff4400 : 0xff0000;
      this.worldBossHealthBar.fillStyle(col, 1);
      this.worldBossHealthBar.fillRect(hbX, hbY, barW * Math.max(0, updatedHpRatio), barH);
      this.worldBossHealthBar.lineStyle(1, 0x880000);
      this.worldBossHealthBar.strokeRect(hbX, hbY, barW, barH);
    }
  }

  /** Fire a boss projectile pattern — mirrors DungeonScene.fireBossPattern exactly */
  private fireWorldBossPattern(pattern: ProjectilePattern): void {
    if (!this.worldBoss || !this.worldBoss.active) return;

    const baseAngle = angleBetween(this.worldBoss.x, this.worldBoss.y, this.player.x, this.player.y);
    const pm = this.projectileManager;

    switch (pattern.type) {
      case BulletPatternType.Radial: {
        for (let i = 0; i < pattern.projectileCount; i++) {
          const a = (Math.PI * 2 / pattern.projectileCount) * i + (this.worldBossData?.spiralAngle ?? 0) * 0.1;
          pm.fireEnemyProjectile(
            this.worldBoss.x, this.worldBoss.y, a,
            pattern.projectileSpeed, pattern.projectileDamage, pattern.projectileLifetime * 1000,
          );
        }
        break;
      }

      case BulletPatternType.Aimed: {
        if (pattern.burstCount > 0) {
          for (let b = 0; b < pattern.burstCount; b++) {
            this.time.delayedCall(b * (pattern.burstDelay * 1000), () => {
              if (!this.worldBoss?.active) return;
              const a = angleBetween(this.worldBoss!.x, this.worldBoss!.y, this.player.x, this.player.y);
              pm.fireEnemyProjectile(
                this.worldBoss!.x, this.worldBoss!.y, a,
                pattern.projectileSpeed, pattern.projectileDamage, pattern.projectileLifetime * 1000,
              );
            });
          }
        } else {
          pm.fireEnemyProjectile(
            this.worldBoss.x, this.worldBoss.y, baseAngle,
            pattern.projectileSpeed, pattern.projectileDamage, pattern.projectileLifetime * 1000,
          );
        }
        break;
      }

      case BulletPatternType.Shotgun: {
        const halfSpread = (pattern.spreadAngle * Math.PI / 180) / 2;
        for (let i = 0; i < pattern.projectileCount; i++) {
          const t = pattern.projectileCount > 1
            ? (i / (pattern.projectileCount - 1)) * 2 - 1
            : 0;
          const a = baseAngle + t * halfSpread;
          pm.fireEnemyProjectile(
            this.worldBoss.x, this.worldBoss.y, a,
            pattern.projectileSpeed * (0.9 + Math.random() * 0.2),
            pattern.projectileDamage, pattern.projectileLifetime * 1000,
          );
        }
        break;
      }

      case BulletPatternType.Spiral: {
        const spiralBase = this.worldBossData?.spiralAngle ?? 0;
        for (let i = 0; i < pattern.projectileCount; i++) {
          const a = spiralBase * (pattern.rotationSpeed * Math.PI / 180) +
            (Math.PI * 2 / pattern.projectileCount) * i;
          pm.fireEnemyProjectile(
            this.worldBoss.x, this.worldBoss.y, a,
            pattern.projectileSpeed, pattern.projectileDamage, pattern.projectileLifetime * 1000,
          );
        }
        break;
      }

      case BulletPatternType.Wall: {
        const wallAngle = baseAngle + Math.PI / 2;
        const wallWidth = (pattern.projectileCount - 1) * 12;
        for (let i = 0; i < pattern.projectileCount; i++) {
          const offset = (i / (pattern.projectileCount - 1)) * wallWidth - wallWidth / 2;
          const startX = this.worldBoss.x + Math.cos(wallAngle) * offset;
          const startY = this.worldBoss.y + Math.sin(wallAngle) * offset;
          pm.fireEnemyProjectile(
            startX, startY, baseAngle,
            pattern.projectileSpeed, pattern.projectileDamage, pattern.projectileLifetime * 1000,
          );
        }
        break;
      }

      case BulletPatternType.Star: {
        const points = pattern.projectileCount;
        const starAngle = this.worldBossData?.spiralAngle ?? 0;
        for (let i = 0; i < points * 2; i++) {
          const a = (Math.PI * 2 / (points * 2)) * i + starAngle * (pattern.rotationSpeed * Math.PI / 180);
          const isOuter = i % 2 === 0;
          const spd = isOuter ? pattern.projectileSpeed : pattern.projectileSpeed * 0.6;
          pm.fireEnemyProjectile(
            this.worldBoss.x, this.worldBoss.y, a,
            spd, pattern.projectileDamage, pattern.projectileLifetime * 1000,
          );
        }
        break;
      }

      case BulletPatternType.Burst: {
        for (let i = 0; i < pattern.burstCount; i++) {
          this.time.delayedCall(i * (pattern.burstDelay * 1000), () => {
            if (!this.worldBoss?.active) return;
            const a = Math.random() * Math.PI * 2;
            pm.fireEnemyProjectile(
              this.worldBoss!.x, this.worldBoss!.y, a,
              pattern.projectileSpeed * (0.7 + Math.random() * 0.6),
              pattern.projectileDamage, pattern.projectileLifetime * 1000,
            );
          });
        }
        break;
      }
    }
  }

  /** Centralized boss damage — called from both physics overlap and manual check */
  private applyBossDamage(): void {
    if (!this.worldBossData || !this.worldBoss || this._bossDefeated) return;
    const dmg = Math.floor(this.worldBossData.maxHp * 0.015);
    this.worldBossData.hp -= dmg;
    // Hit flash — white then back to Fenrir crimson
    this.worldBoss.setTint(0xffffff);
    this.time.delayedCall(80, () => { if (this.worldBoss?.active) this.worldBoss.setTint(0xcc0033); });
    this.musicManager?.playSFX('sfx_enemy_hit');
    this.showDamageNumber(this.worldBoss.x, this.worldBoss.y - 24, dmg);
    if (this.worldBossData.hp <= 0) {
      this.worldBossData.hp = 0;
      this.onWorldBossDefeated();
    }
  }

  private onWorldBossDefeated(): void {
    if (this._bossDefeated) return; // prevent double-death
    this._bossDefeated = true;
    this.worldBossAwake = false;

    // Stop boss from doing anything
    if (this.worldBoss) {
      this.worldBoss.setVelocity(0, 0);
      this.worldBossData = null;
    }

    // Signal CrazyGames SDK — happyTime for the big win + gameplayStop
    const crazySdk = (window as any).CrazyGames?.SDK;
    if (crazySdk) {
      try { crazySdk.game.happyTime(); } catch (_e) { /* ignore */ }
      try { crazySdk.game.gameplayStop(); } catch (_e) { /* ignore */ }
    }

    // Save the final checkpoint — Fenrir defeated
    this.progressManager.unlockStage(this.classId, 4);
    this.progressManager.clearRunState();

    // Victory heal + invincibility so player can't die during ending transition
    this.playerController.hp = this.playerController.maxHp;
    this.playerController.mp = this.playerController.maxMp;
    this.playerController.grantInvincibility(60);
    this.showInstantHealEffect(this.player.x, this.player.y - 20, this.playerController.maxHp);

    // Dramatic death animation — boss flashes and fades out over 2 seconds
    if (this.worldBoss) {
      this.tweens.killTweensOf(this.worldBoss);
      // Flash white rapidly
      this.tweens.add({
        targets: this.worldBoss,
        alpha: { from: 1.0, to: 0.3 },
        duration: 150,
        yoyo: true,
        repeat: 6,
        onComplete: () => {
          // Expand and fade out
          if (this.worldBoss) {
            this.tweens.add({
              targets: this.worldBoss,
              alpha: 0,
              scaleX: 8,
              scaleY: 8,
              duration: 1000,
              ease: 'Power2',
              onComplete: () => {
                this.worldBoss?.destroy();
                this.worldBoss = null;
              },
            });
          }
        },
      });
    }

    // Clean up dialogue text if any
    if (this.worldBossDialogueText) {
      this.worldBossDialogueText.destroy();
      this.worldBossDialogueText = null;
    }

    // Remove health bar and name after a brief moment
    this.time.delayedCall(500, () => {
      if (this.worldBossHealthBar) { this.worldBossHealthBar.destroy(); this.worldBossHealthBar = null; }
      if (this.worldBossNameText) { this.worldBossNameText.destroy(); this.worldBossNameText = null; }
    });

    // Large centered victory text
    const cx = this.cameras.main.width / 2;
    const cy = this.cameras.main.height / 2;
    const victoryText = this.add.text(cx, cy - 60, 'FENRIR HAS FALLEN', {
      fontFamily: 'monospace', fontSize: '28px', color: '#ffdd44',
      stroke: '#000000', strokeThickness: 6,
    }).setOrigin(0.5).setDepth(300).setScrollFactor(0);
    const subText = this.add.text(cx, cy - 20, 'You are the Champion of Midgard', {
      fontFamily: 'monospace', fontSize: '14px', color: '#ffaa44',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(300).setScrollFactor(0);

    this.tweens.add({ targets: victoryText, alpha: { from: 0, to: 1 }, duration: 800, ease: 'Power2' });
    this.tweens.add({ targets: subText, alpha: { from: 0, to: 1 }, duration: 800, delay: 400 });

    this.events.emit('notification', '⚡  FENRIR HAS FALLEN!', '#ffdd44');

    // Transition to ending scene — short delay then fade
    this.time.delayedCall(4000, () => {
      this.cameras.main.fadeOut(1500, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.stop('UIScene');
        this.scene.start('EndingScene');
      });
      // Failsafe: if camera fade event doesn't fire, force transition after 2s
      window.setTimeout(() => {
        if (!this._bossDefeated) return; // safety check
        try {
          this.scene.stop('UIScene');
          this.scene.start('EndingScene');
        } catch (_e) { /* scene may already be transitioning */ }
      }, 2000);
    });
  }

  /** Launch endless dungeon mode (called from EndingScene or checkpoint) */
  launchEndlessDungeon(): void {
    const config = {
      dungeonDef: getDungeon('helheim_sanctum')!, // Start with Helheim theme
      runeKeyLevel: 0,
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
      endless: true,
      endlessFloor: 1,
    };

    this.musicManager?.playSFX('sfx_portal');
    this.musicManager?.stopMusic();
    this.scene.sleep('GameScene');
    this.scene.start('DungeonScene', config);
  }
}
