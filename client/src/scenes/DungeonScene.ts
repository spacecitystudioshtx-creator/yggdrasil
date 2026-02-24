import Phaser from 'phaser';
import { PlayerController } from '../systems/PlayerController';
import { ProjectileManager } from '../systems/ProjectileManager';
import { InputManager } from '../systems/InputManager';
import { CameraController } from '../systems/CameraController';
import { LootManager } from '../systems/LootManager';
import { InventoryManager } from '../systems/InventoryManager';
import { QuestManager } from '../systems/QuestManager';
import { AbilitySystem } from '../systems/AbilitySystem';
import { TILE_SIZE, ItemType, BulletPatternType } from '@yggdrasil/shared';
import { DungeonDef, DungeonBossDef } from '../data/DungeonDatabase';
import { getItem } from '../data/ItemDatabase';
import { getClass } from '../data/ClassDatabase';
import { angleBetween, distanceBetween, randomInt } from '../utils/MathUtils';
import { ProjectilePattern } from '@yggdrasil/shared';

/**
 * DungeonScene: Self-contained instanced dungeon gameplay.
 *
 * Procedurally generates a series of connected rooms using BSP-style layout.
 * Player fights through rooms of enemies, ending with a multi-phase boss.
 * On boss death, loot spawns and a portal home appears.
 */

interface DungeonRoom {
  x: number;       // top-left tile X
  y: number;       // top-left tile Y
  w: number;       // width in tiles
  h: number;       // height in tiles
  centerX: number; // pixel center
  centerY: number; // pixel center
  type: 'combat' | 'treasure' | 'boss' | 'start';
  cleared: boolean;
  enemies: Phaser.Physics.Arcade.Sprite[];
  doorOpen: boolean;
}

interface DungeonConfig {
  dungeonDef: DungeonDef;
  runeKeyLevel: number;   // 0 = base, 1-20 = scaled
  classId?: string;       // player class for tint restoration
  // These are passed from the overworld so we can restore state on return
  playerHp: number;
  playerMp: number;
  playerLevel: number;
  playerXp: number;
  playerStats: {
    attack: number;
    defense: number;
    speed: number;
    dexterity: number;
    vitality: number;
    wisdom: number;
    maxHp: number;
    maxMp: number;
  };
}

export class DungeonScene extends Phaser.Scene {
  // Systems
  inputManager!: InputManager;
  playerController!: PlayerController;
  projectileManager!: ProjectileManager;
  cameraController!: CameraController;
  lootManager!: LootManager;
  abilitySystem!: AbilitySystem;

  // Player
  player!: Phaser.Physics.Arcade.Sprite;
  crosshair!: Phaser.GameObjects.Image;

  // Dungeon state
  private config!: DungeonConfig;
  private rooms: DungeonRoom[] = [];
  private currentRoomIndex: number = 0;
  private dungeonWidth: number = 0;   // total tiles wide
  private dungeonHeight: number = 0;  // total tiles tall
  private dungeonPixelW: number = 0;
  private dungeonPixelH: number = 0;
  private tilemap!: Phaser.Tilemaps.Tilemap;
  private groundLayer!: Phaser.Tilemaps.TilemapLayer;
  private enemyGroup!: Phaser.Physics.Arcade.Group;

  // Boss
  private boss: Phaser.Physics.Arcade.Sprite | null = null;
  private bossData: {
    def: DungeonBossDef;
    hp: number;
    maxHp: number;
    currentPhaseIndex: number;
    patternTimers: Map<string, number>;
    spiralAngle: number;
  } | null = null;
  private bossHealthBar: Phaser.GameObjects.Graphics | null = null;
  private bossNameText: Phaser.GameObjects.Text | null = null;
  private bossDialogueText: Phaser.GameObjects.Text | null = null;

  // Exit portal
  private exitPortal: Phaser.Physics.Arcade.Sprite | null = null;
  private dungeonComplete: boolean = false;

  // Room door graphics
  private doorGraphics: Phaser.GameObjects.Graphics[] = [];

  // Class tint (for restoring after damage flash)
  private classTint: number = 0;

  // Inventory/Quest refs passed from GameScene
  inventoryManager!: InventoryManager;
  questManager!: QuestManager;

  constructor() {
    super({ key: 'DungeonScene' });
  }

  init(data: any): void {
    this.config = data as DungeonConfig;
    // Reset all instance state from previous dungeon runs
    this.rooms = [];
    this.currentRoomIndex = 0;
    this.dungeonWidth = 0;
    this.dungeonHeight = 0;
    this.dungeonPixelW = 0;
    this.dungeonPixelH = 0;
    this.boss = null;
    this.bossData = null;
    this.bossHealthBar = null;
    this.bossNameText = null;
    this.bossDialogueText = null;
    this.exitPortal = null;
    this.dungeonComplete = false;
    this.doorGraphics = [];
    // Resolve class tint for damage flash restoration
    const classDef = this.config.classId ? getClass(this.config.classId) : null;
    this.classTint = classDef?.spriteTint ?? 0;
  }

  create(): void {
    const def = this.config.dungeonDef;

    // 1. Input
    this.inputManager = new InputManager(this);

    // 2. Generate dungeon layout
    this.generateDungeon(def);

    // 3. Create tilemap
    this.createTilemap(def);

    // 4. Player — spawn in the first room
    const startRoom = this.rooms[0];
    this.player = this.physics.add.sprite(startRoom.centerX, startRoom.centerY, 'player');
    this.player.setDepth(10);
    this.player.setCollideWorldBounds(true);
    this.player.body!.setSize(12, 14);

    // Apply class tint to player
    if (this.classTint) {
      this.player.setTint(this.classTint);
    }

    // 5. Player controller — restore stats from overworld
    this.playerController = new PlayerController(this, this.player, this.inputManager);
    this.restorePlayerStats();

    // 6. Projectile manager
    this.projectileManager = new ProjectileManager(this);

    // Set class-specific weapon profile
    const classDefLocal = this.config.classId ? getClass(this.config.classId) : null;
    if (classDefLocal) {
      this.projectileManager.weaponProfile = { ...classDefLocal.weaponProfile };
      this.playerController.fireRateMultiplier = classDefLocal.weaponProfile.fireRateMultiplier;
    }

    // 6b. Ability system (space bar)
    this.abilitySystem = new AbilitySystem(this, this.playerController, this.projectileManager, this.config.classId ?? 'viking');

    // 7. Camera
    this.cameraController = new CameraController(this, this.player);
    // Override camera bounds for dungeon size
    this.cameras.main.setBounds(0, 0, this.dungeonPixelW, this.dungeonPixelH);
    this.physics.world.setBounds(0, 0, this.dungeonPixelW, this.dungeonPixelH);

    // 8. Crosshair
    this.crosshair = this.add.image(0, 0, 'crosshair');
    this.crosshair.setDepth(100);
    this.crosshair.setScrollFactor(0);

    // 9. Enemy group
    this.enemyGroup = this.physics.add.group({
      classType: Phaser.Physics.Arcade.Sprite,
      runChildUpdate: false,
    });

    // 10. Collision: player vs walls
    if (this.groundLayer) {
      this.physics.add.collider(this.player, this.groundLayer);
    }

    // 11. Collision: player projectiles vs enemies
    this.physics.add.overlap(
      this.projectileManager.playerProjectiles,
      this.enemyGroup,
      this.onProjectileHitEnemy as any,
      undefined,
      this,
    );

    // 12. Collision: enemy projectiles vs player
    this.physics.add.overlap(
      this.projectileManager.enemyProjectiles,
      this.player,
      this.onEnemyProjectileHitPlayer as any,
      (projectile: any, _player: any) => {
        return projectile.active && !this.playerController.isDead && !this.playerController.isInvincible;
      },
      this,
    );

    // 13. Loot manager
    this.lootManager = new LootManager(this);
    this.lootManager.onPickup((items) => {
      for (const { itemId, quantity } of items) {
        const inv = this.getInventoryManager();
        if (inv) {
          const added = inv.addItem(itemId, quantity);
          const item = getItem(itemId);
          if (added && item) {
            this.events.emit('notification', `+${quantity} ${item.name}`, '#ffffff');
          } else if (!added) {
            this.events.emit('notification', 'Inventory full!', '#cc4444');
          }
        }
      }
    });

    // 14. Spawn enemies in all combat rooms
    this.spawnRoomEnemies();

    // 15. Hide cursor
    this.input.setDefaultCursor('none');

    // 16. Grant invincibility on enter
    this.playerController.grantInvincibility(2.0);

    // 17. Show dungeon name
    this.events.emit('notification', `Entering: ${def.name}`, '#cc88ff');

    // 18. Launch UI scene if not already running
    if (!this.scene.isActive('UIScene')) {
      this.scene.launch('UIScene');
    }
  }

  update(time: number, delta: number): void {
    const dt = delta / 1000;

    // Crosshair
    this.crosshair.setPosition(
      this.input.activePointer.x,
      this.input.activePointer.y,
    );

    const worldPoint = this.cameras.main.getWorldPoint(
      this.input.activePointer.x,
      this.input.activePointer.y,
    );

    // Update systems
    this.inputManager.update();
    this.playerController.update(dt, worldPoint.x, worldPoint.y);
    this.projectileManager.update(dt);
    this.cameraController.update(dt);
    this.lootManager.update(dt, this.player.x, this.player.y);
    this.abilitySystem.update(dt);

    // Space bar: use ability
    if (this.inputManager.isAbilityPressed() && !this.playerController.isDead) {
      this.abilitySystem.useAbility(worldPoint.x, worldPoint.y);
    }

    // Shooting
    if (this.inputManager.isShootingPressed()) {
      this.projectileManager.firePlayerProjectile(
        this.player.x,
        this.player.y,
        worldPoint.x,
        worldPoint.y,
      );
    }

    // Check R to nexus (exit dungeon)
    if (this.inputManager.isNexusPressed() && !this.playerController.isDead) {
      this.exitDungeon();
      return;
    }

    // Update enemies
    this.updateEnemies(dt);

    // Update boss
    if (this.boss && this.boss.active && this.bossData) {
      this.updateBoss(dt);
    }

    // Check room clearing
    this.checkRoomCleared();

    // Check exit portal pickup
    if (this.exitPortal && this.exitPortal.active) {
      const dist = distanceBetween(this.player.x, this.player.y, this.exitPortal.x, this.exitPortal.y);
      if (dist < 24) {
        this.exitDungeon();
        return;
      }
    }

    // Emit player state for UI
    this.events.emit('playerUpdate', {
      hp: this.playerController.hp,
      maxHp: this.playerController.maxHp,
      mp: this.playerController.mp,
      maxMp: this.playerController.maxMp,
      level: this.playerController.level,
      xp: this.playerController.xp,
      xpToNext: this.playerController.xpToNext,
    });

    // Emit minimap data (simplified for dungeon — just enemies)
    const enemies: { x: number; y: number }[] = [];
    this.enemyGroup.getChildren().forEach((child) => {
      const e = child as Phaser.Physics.Arcade.Sprite;
      if (e.active) enemies.push({ x: e.x, y: e.y });
    });
    if (this.boss && this.boss.active) {
      enemies.push({ x: this.boss.x, y: this.boss.y });
    }
    this.events.emit('minimapUpdate', {
      playerX: this.player.x,
      playerY: this.player.y,
      playerVelX: this.player.body?.velocity.x ?? 0,
      playerVelY: this.player.body?.velocity.y ?? 0,
      worldSize: Math.max(this.dungeonPixelW, this.dungeonPixelH),
      enemies,
      questWaypoints: [],
    });
  }

  // ========================================================================
  // DUNGEON GENERATION — BSP-style connected rooms
  // ========================================================================

  private generateDungeon(def: DungeonDef): void {
    const numRooms = randomInt(def.minRooms, def.maxRooms);
    const padding = 4; // tiles between rooms

    // Linear room layout: rooms placed left to right with corridors
    let cursorX = 2; // starting tile X

    // Dungeon height: tallest room + padding
    const maxRoomH = def.roomHeight + 6;
    this.dungeonHeight = maxRoomH + 4;

    for (let i = 0; i < numRooms; i++) {
      const isLast = (i === numRooms - 1);
      const isFirst = (i === 0);

      // Room dimensions with some variance
      const rw = def.roomWidth + randomInt(-2, 2);
      const rh = def.roomHeight + randomInt(-2, 2);

      // Center vertically
      const ry = Math.floor((this.dungeonHeight - rh) / 2);
      const rx = cursorX;

      let roomType: 'start' | 'combat' | 'treasure' | 'boss' = 'combat';
      if (isFirst) roomType = 'start';
      else if (isLast) roomType = 'boss';
      else if (i === Math.floor(numRooms / 2) && numRooms > 3) roomType = 'treasure';

      this.rooms.push({
        x: rx,
        y: ry,
        w: rw,
        h: rh,
        centerX: (rx + rw / 2) * TILE_SIZE,
        centerY: (ry + rh / 2) * TILE_SIZE,
        type: roomType,
        cleared: roomType === 'start', // start room is already clear
        enemies: [],
        doorOpen: roomType === 'start',
      });

      cursorX += rw + padding;
    }

    this.dungeonWidth = cursorX + 2;
    this.dungeonPixelW = this.dungeonWidth * TILE_SIZE;
    this.dungeonPixelH = this.dungeonHeight * TILE_SIZE;
  }

  private createTilemap(def: DungeonDef): void {
    // Build tile data
    const data: number[][] = [];
    for (let y = 0; y < this.dungeonHeight; y++) {
      data[y] = [];
      for (let x = 0; x < this.dungeonWidth; x++) {
        data[y][x] = def.tileWall; // default = wall
      }
    }

    // Carve rooms
    for (const room of this.rooms) {
      for (let y = room.y; y < room.y + room.h; y++) {
        for (let x = room.x; x < room.x + room.w; x++) {
          if (y >= 0 && y < this.dungeonHeight && x >= 0 && x < this.dungeonWidth) {
            // Border = wall, interior = ground
            if (x === room.x || x === room.x + room.w - 1 ||
                y === room.y || y === room.y + room.h - 1) {
              data[y][x] = def.tileWall;
            } else {
              data[y][x] = def.tileGround;
            }
          }
        }
      }
    }

    // Carve corridors between adjacent rooms
    for (let i = 0; i < this.rooms.length - 1; i++) {
      const a = this.rooms[i];
      const b = this.rooms[i + 1];

      // Horizontal corridor from right edge of room A to left edge of room B
      const corridorY = Math.floor(this.dungeonHeight / 2);
      const startX = a.x + a.w - 1;
      const endX = b.x;

      for (let x = startX; x <= endX; x++) {
        // 3-tile wide corridor
        for (let dy = -1; dy <= 1; dy++) {
          const ty = corridorY + dy;
          if (ty >= 0 && ty < this.dungeonHeight && x >= 0 && x < this.dungeonWidth) {
            data[ty][x] = def.tileGround;
          }
        }
      }

      // Also carve doorways in the room walls at corridor height
      for (let dy = -1; dy <= 1; dy++) {
        const ty = corridorY + dy;
        if (ty >= 0 && ty < this.dungeonHeight) {
          // Right wall of room A
          if (a.x + a.w - 1 < this.dungeonWidth) {
            data[ty][a.x + a.w - 1] = def.tileGround;
          }
          // Left wall of room B
          if (b.x >= 0) {
            data[ty][b.x] = def.tileGround;
          }
        }
      }
    }

    // Create Phaser tilemap
    this.tilemap = this.make.tilemap({
      data,
      tileWidth: TILE_SIZE,
      tileHeight: TILE_SIZE,
    });

    const tileset = this.tilemap.addTilesetImage('tileset', 'tileset', TILE_SIZE, TILE_SIZE, 0, 0)!;
    this.groundLayer = this.tilemap.createLayer(0, tileset, 0, 0)!;
    this.groundLayer.setDepth(0);

    // Set collision on wall tiles
    this.groundLayer.setCollision(def.tileWall);
  }

  // ========================================================================
  // ENEMY SPAWNING
  // ========================================================================

  private spawnRoomEnemies(): void {
    const def = this.config.dungeonDef;
    const runeLevel = this.config.runeKeyLevel;

    for (const room of this.rooms) {
      if (room.type === 'start') continue;

      if (room.type === 'boss') {
        this.spawnBoss(room);
        continue;
      }

      // Combat / treasure rooms get enemies
      const baseCount = room.type === 'treasure' ? 3 : 5 + def.difficulty;
      const count = Math.floor(baseCount * (1 + runeLevel * 0.1));

      for (let i = 0; i < count; i++) {
        // Random position inside room (avoid walls)
        const ex = (room.x + 2 + Math.random() * (room.w - 4)) * TILE_SIZE;
        const ey = (room.y + 2 + Math.random() * (room.h - 4)) * TILE_SIZE;

        const level = Math.min(20, def.difficulty * 2 + Math.floor(runeLevel * 0.5));
        const hpMult = 1 + runeLevel * 0.1;
        const dmgMult = 1 + runeLevel * 0.08;

        const textureKey = def.enemyTextures[Math.floor(Math.random() * def.enemyTextures.length)];
        const isSmall = textureKey === 'enemy_small';

        const enemy = this.physics.add.sprite(ex, ey, textureKey);
        enemy.setDepth(5);
        enemy.body!.setSize(isSmall ? 6 : 14, isSmall ? 6 : 14);

        const patterns: ('aimed' | 'radial' | 'shotgun')[] = ['aimed'];
        if (def.difficulty >= 4) patterns.push('shotgun');
        if (def.difficulty >= 7) patterns.push('radial');

        enemy.setData('enemyData', {
          level,
          maxHp: Math.floor((30 + level * 20) * hpMult),
          hp: Math.floor((30 + level * 20) * hpMult),
          damage: Math.floor((3 + level * 2) * dmgMult),
          speed: 35 + level * 4,
          aggroRange: 10,
          fireRate: 0.3 + level * 0.06,
          fireCooldown: 1 + Math.random() * 2,
          behavior: 'wander',
          wanderAngle: Math.random() * Math.PI * 2,
          wanderTimer: Math.random() * 2,
          textureKey,
          patternType: patterns[Math.floor(Math.random() * patterns.length)],
          projectileSpeed: 120 + level * 15,
          projectileTexture: 'projectile_enemy',
        });
        enemy.setData('level', level);
        enemy.setData('room', room);

        this.enemyGroup.add(enemy);
        room.enemies.push(enemy);
      }
    }
  }

  // ========================================================================
  // BOSS SYSTEM
  // ========================================================================

  private spawnBoss(room: DungeonRoom): void {
    const bossDef = this.config.dungeonDef.boss;
    const runeLevel = this.config.runeKeyLevel;
    const hpMult = 1 + runeLevel * 0.12;

    this.boss = this.physics.add.sprite(room.centerX, room.centerY, bossDef.textureKey);
    this.boss.setDepth(10);
    this.boss.setScale(1.5);
    this.boss.body!.setSize(20, 20);

    const scaledHp = Math.floor(bossDef.maxHp * hpMult);

    this.bossData = {
      def: bossDef,
      hp: scaledHp,
      maxHp: scaledHp,
      currentPhaseIndex: 0,
      patternTimers: new Map(),
      spiralAngle: 0,
    };

    this.boss.setData('isBoss', true);
    this.boss.setData('level', this.config.dungeonDef.difficulty * 2);
    this.boss.setData('room', room);

    this.enemyGroup.add(this.boss);
    room.enemies.push(this.boss);

    // Boss health bar (UI overlay — screen space)
    this.bossHealthBar = this.add.graphics().setDepth(200).setScrollFactor(0);
    this.bossNameText = this.add.text(400, 12, bossDef.name, {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#ff8888',
      stroke: '#000',
      strokeThickness: 2,
    }).setOrigin(0.5).setDepth(201).setScrollFactor(0);
  }

  private updateBoss(dt: number): void {
    if (!this.boss || !this.boss.active || !this.bossData) return;

    const bossDef = this.bossData.def;
    const hpRatio = this.bossData.hp / this.bossData.maxHp;

    // Determine current phase
    let phaseIndex = 0;
    for (let i = bossDef.phases.length - 1; i >= 0; i--) {
      if (hpRatio <= bossDef.phases[i].healthThreshold) {
        phaseIndex = i;
      }
    }

    // Phase transition
    if (phaseIndex !== this.bossData.currentPhaseIndex) {
      this.bossData.currentPhaseIndex = phaseIndex;
      const phase = bossDef.phases[phaseIndex];

      // Show dialogue
      if (this.bossDialogueText) this.bossDialogueText.destroy();
      this.bossDialogueText = this.add.text(
        this.boss.x, this.boss.y - 30, phase.dialogue,
        { fontFamily: 'monospace', fontSize: '8px', color: '#ff8888', stroke: '#000', strokeThickness: 2 },
      ).setOrigin(0.5).setDepth(50);
      this.tweens.add({
        targets: this.bossDialogueText,
        y: this.boss.y - 60,
        alpha: 0,
        duration: 3000,
        onComplete: () => this.bossDialogueText?.destroy(),
      });

      // Flash boss for phase transition
      this.boss.setTint(0xffffff);
      this.time.delayedCall(200, () => {
        if (this.boss?.active) this.boss.clearTint();
      });
    }

    const phase = bossDef.phases[phaseIndex];
    const speed = bossDef.speed * phase.speedMultiplier;

    // Boss movement — orbit around center of room, chasing player slightly
    const dist = distanceBetween(this.boss.x, this.boss.y, this.player.x, this.player.y);
    if (dist > 60) {
      const angle = angleBetween(this.boss.x, this.boss.y, this.player.x, this.player.y);
      this.boss.setVelocity(
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
      );
    } else {
      this.boss.setVelocity(0, 0);
    }

    // Fire patterns
    for (const patternId of phase.patternIds) {
      const pattern = bossDef.patterns[patternId];
      if (!pattern) continue;

      const timer = this.bossData.patternTimers.get(patternId) ?? 0;
      const newTimer = timer - dt;

      if (newTimer <= 0) {
        this.fireBossPattern(pattern);
        this.bossData.patternTimers.set(patternId, 1.0 / pattern.fireRate);
      } else {
        this.bossData.patternTimers.set(patternId, newTimer);
      }
    }

    // Update spiral angle for spiral patterns
    this.bossData.spiralAngle += dt * 2;

    // Update boss health bar
    if (this.bossHealthBar) {
      this.bossHealthBar.clear();
      const barW = 200, barH = 10;
      const bx = 400 - barW / 2, by = 24;

      this.bossHealthBar.fillStyle(0x222222, 0.8);
      this.bossHealthBar.fillRect(bx, by, barW, barH);

      const color = hpRatio > 0.5 ? 0xcc3333 : hpRatio > 0.25 ? 0xcc6633 : 0xcc0000;
      this.bossHealthBar.fillStyle(color, 1);
      this.bossHealthBar.fillRect(bx, by, barW * Math.max(0, hpRatio), barH);

      // Border
      this.bossHealthBar.lineStyle(1, 0x888888);
      this.bossHealthBar.strokeRect(bx, by, barW, barH);
    }
  }

  private fireBossPattern(pattern: ProjectilePattern): void {
    if (!this.boss || !this.boss.active) return;

    const baseAngle = angleBetween(this.boss.x, this.boss.y, this.player.x, this.player.y);
    const pm = this.projectileManager;

    switch (pattern.type) {
      case BulletPatternType.Radial: {
        for (let i = 0; i < pattern.projectileCount; i++) {
          const angle = (Math.PI * 2 / pattern.projectileCount) * i + (this.bossData?.spiralAngle ?? 0) * 0.1;
          pm.fireEnemyProjectile(
            this.boss.x, this.boss.y,
            angle,
            pattern.projectileSpeed,
            pattern.projectileDamage,
            pattern.projectileLifetime * 1000,
          );
        }
        break;
      }

      case BulletPatternType.Aimed: {
        if (pattern.burstCount > 0) {
          for (let b = 0; b < pattern.burstCount; b++) {
            this.time.delayedCall(b * (pattern.burstDelay * 1000), () => {
              if (!this.boss?.active) return;
              const angle = angleBetween(this.boss!.x, this.boss!.y, this.player.x, this.player.y);
              pm.fireEnemyProjectile(
                this.boss!.x, this.boss!.y,
                angle,
                pattern.projectileSpeed,
                pattern.projectileDamage,
                pattern.projectileLifetime * 1000,
              );
            });
          }
        } else {
          pm.fireEnemyProjectile(
            this.boss.x, this.boss.y,
            baseAngle,
            pattern.projectileSpeed,
            pattern.projectileDamage,
            pattern.projectileLifetime * 1000,
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
          const angle = baseAngle + t * halfSpread;
          pm.fireEnemyProjectile(
            this.boss.x, this.boss.y,
            angle,
            pattern.projectileSpeed * (0.9 + Math.random() * 0.2),
            pattern.projectileDamage,
            pattern.projectileLifetime * 1000,
          );
        }
        break;
      }

      case BulletPatternType.Spiral: {
        const spiralBase = this.bossData?.spiralAngle ?? 0;
        for (let i = 0; i < pattern.projectileCount; i++) {
          const angle = spiralBase * (pattern.rotationSpeed * Math.PI / 180) +
            (Math.PI * 2 / pattern.projectileCount) * i;
          pm.fireEnemyProjectile(
            this.boss.x, this.boss.y,
            angle,
            pattern.projectileSpeed,
            pattern.projectileDamage,
            pattern.projectileLifetime * 1000,
          );
        }
        break;
      }

      case BulletPatternType.Wall: {
        const wallAngle = baseAngle + Math.PI / 2; // perpendicular to player direction
        const wallWidth = (pattern.projectileCount - 1) * 12;
        for (let i = 0; i < pattern.projectileCount; i++) {
          const offset = (i / (pattern.projectileCount - 1)) * wallWidth - wallWidth / 2;
          const startX = this.boss.x + Math.cos(wallAngle) * offset;
          const startY = this.boss.y + Math.sin(wallAngle) * offset;
          pm.fireEnemyProjectile(
            startX, startY,
            baseAngle,
            pattern.projectileSpeed,
            pattern.projectileDamage,
            pattern.projectileLifetime * 1000,
          );
        }
        break;
      }

      case BulletPatternType.Star: {
        const points = pattern.projectileCount;
        const innerR = 15;
        const starAngle = this.bossData?.spiralAngle ?? 0;
        for (let i = 0; i < points * 2; i++) {
          const angle = (Math.PI * 2 / (points * 2)) * i + starAngle * (pattern.rotationSpeed * Math.PI / 180);
          const isOuter = i % 2 === 0;
          const spd = isOuter ? pattern.projectileSpeed : pattern.projectileSpeed * 0.6;
          pm.fireEnemyProjectile(
            this.boss.x, this.boss.y,
            angle,
            spd,
            pattern.projectileDamage,
            pattern.projectileLifetime * 1000,
          );
        }
        break;
      }

      case BulletPatternType.Burst: {
        for (let i = 0; i < pattern.burstCount; i++) {
          this.time.delayedCall(i * (pattern.burstDelay * 1000), () => {
            if (!this.boss?.active) return;
            const angle = Math.random() * Math.PI * 2;
            pm.fireEnemyProjectile(
              this.boss!.x, this.boss!.y,
              angle,
              pattern.projectileSpeed * (0.7 + Math.random() * 0.6),
              pattern.projectileDamage,
              pattern.projectileLifetime * 1000,
            );
          });
        }
        break;
      }
    }
  }

  // ========================================================================
  // ENEMY UPDATE
  // ========================================================================

  private updateEnemies(dt: number): void {
    this.enemyGroup.getChildren().forEach((child) => {
      const enemy = child as Phaser.Physics.Arcade.Sprite;
      if (!enemy.active || enemy.getData('isBoss')) return;

      const data = enemy.getData('enemyData');
      if (!data) return;

      const dist = distanceBetween(enemy.x, enemy.y, this.player.x, this.player.y);
      const aggroRange = data.aggroRange * TILE_SIZE;

      if (dist < aggroRange) {
        // Chase
        if (dist > 80) {
          const angle = angleBetween(enemy.x, enemy.y, this.player.x, this.player.y);
          enemy.setVelocity(Math.cos(angle) * data.speed, Math.sin(angle) * data.speed);
        } else {
          enemy.setVelocity(0, 0);
        }

        // Fire
        data.fireCooldown -= dt;
        if (data.fireCooldown <= 0) {
          data.fireCooldown = 1.0 / data.fireRate;
          this.fireEnemyPattern(enemy, data);
        }
      } else {
        // Wander
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
    });
  }

  private fireEnemyPattern(enemy: Phaser.Physics.Arcade.Sprite, data: any): void {
    const angle = angleBetween(enemy.x, enemy.y, this.player.x, this.player.y);
    const pm = this.projectileManager;

    switch (data.patternType) {
      case 'aimed':
        pm.fireEnemyProjectile(enemy.x, enemy.y, angle, data.projectileSpeed, data.damage, 2000);
        break;
      case 'radial':
        for (let i = 0; i < 8; i++) {
          const a = (Math.PI * 2 / 8) * i;
          pm.fireEnemyProjectile(enemy.x, enemy.y, a, data.projectileSpeed * 0.8, data.damage, 2500);
        }
        break;
      case 'shotgun': {
        const count = 3 + Math.floor(Math.random() * 3);
        const spread = 0.6;
        for (let i = 0; i < count; i++) {
          const a = angle - spread / 2 + (spread / (count - 1)) * i;
          pm.fireEnemyProjectile(enemy.x, enemy.y, a, data.projectileSpeed * (0.9 + Math.random() * 0.2), data.damage, 1800);
        }
        break;
      }
    }
  }

  // ========================================================================
  // HIT HANDLERS
  // ========================================================================

  private onProjectileHitEnemy(
    objA: Phaser.Physics.Arcade.Sprite,
    objB: Phaser.Physics.Arcade.Sprite,
  ): void {
    let projectile: Phaser.Physics.Arcade.Sprite;
    let enemy: Phaser.Physics.Arcade.Sprite;
    if (objA.getData('isPlayer') === true) {
      projectile = objA;
      enemy = objB;
    } else if (objB.getData('isPlayer') === true) {
      projectile = objB;
      enemy = objA;
    } else {
      return;
    }

    this.projectileManager.deactivateProjectile(projectile, true);

    // Apply weapon profile damage multiplier
    const baseDamage = this.playerController.getAttackDamage();
    const damageMultiplier = projectile.getData('damageMultiplier') ?? 1.0;
    const damage = Math.floor(baseDamage * damageMultiplier);

    // Is this the boss?
    if (enemy.getData('isBoss') && this.bossData) {
      this.bossData.hp -= damage;

      // Flash
      enemy.setTint(0xffffff);
      this.time.delayedCall(80, () => {
        if (enemy.active) enemy.clearTint();
      });

      if (this.bossData.hp <= 0) {
        this.onBossDefeated(enemy);
      }

      this.showDamageNumber(enemy.x, enemy.y - 15, damage);
      return;
    }

    // Regular enemy
    const data = enemy.getData('enemyData');
    if (!data) return;

    data.hp -= damage;

    enemy.setTint(0xffffff);
    this.time.delayedCall(80, () => {
      if (enemy.active) enemy.clearTint();
    });

    if (data.hp <= 0) {
      // Remove from room's enemy list
      const room = enemy.getData('room') as DungeonRoom;
      if (room) {
        room.enemies = room.enemies.filter(e => e !== enemy);
      }

      // Grant XP
      const level = enemy.getData('level') ?? 1;
      this.playerController.grantXP(level * 15);

      // Spawn loot
      this.lootManager.spawnLootBag(enemy.x, enemy.y, this.config.dungeonDef.difficulty);

      enemy.destroy();
    }

    this.showDamageNumber(enemy.x, enemy.y - 10, damage);
  }

  private onEnemyProjectileHitPlayer(
    objA: Phaser.Physics.Arcade.Sprite,
    objB: Phaser.Physics.Arcade.Sprite,
  ): void {
    let projectile: Phaser.Physics.Arcade.Sprite;
    if (objA.getData('damage') !== null && objA.getData('damage') !== undefined) {
      projectile = objA;
    } else if (objB.getData('damage') !== null && objB.getData('damage') !== undefined) {
      projectile = objB;
    } else {
      return;
    }

    this.projectileManager.deactivateProjectile(projectile, false);
    const damage = projectile.getData('damage') ?? 10;
    this.playerController.takeDamage(damage);

    // Red flash — restore class tint afterwards
    this.player.setTint(0xff4444);
    this.time.delayedCall(100, () => {
      if (this.player.active) {
        if (this.classTint) {
          this.player.setTint(this.classTint);
        } else {
          this.player.clearTint();
        }
      }
    });

    this.showDamageNumber(this.player.x, this.player.y - 10, damage, true);
  }

  // ========================================================================
  // BOSS DEFEAT + ROOM CLEARING
  // ========================================================================

  private onBossDefeated(bossSprite: Phaser.Physics.Arcade.Sprite): void {
    this.dungeonComplete = true;

    // Grant big XP
    const bossLevel = this.config.dungeonDef.difficulty * 2;
    this.playerController.grantXP(bossLevel * 50);

    // Spawn boss-specific loot using the boss's actual loot table
    const bossDef = this.config.dungeonDef.boss;
    const bossLootItems: { itemId: string; quantity: number }[] = [];
    for (const drop of bossDef.loot) {
      if (Math.random() < drop.dropChance) {
        const qty = randomInt(drop.minAmount, drop.maxAmount);
        bossLootItems.push({ itemId: drop.itemId, quantity: qty });
      }
    }
    // Spawn boss-specific items as a dedicated bag
    if (bossLootItems.length > 0) {
      this.lootManager.spawnLootBagWithItems(bossSprite.x, bossSprite.y, bossLootItems);
    }
    // Also spawn a regular high-tier loot bag
    this.lootManager.spawnLootBag(bossSprite.x + 16, bossSprite.y, this.config.dungeonDef.difficulty + 5);
    const bossRoom = this.rooms[this.rooms.length - 1];

    // Remove boss
    const room = bossSprite.getData('room') as DungeonRoom;
    if (room) {
      room.enemies = room.enemies.filter(e => e !== bossSprite);
      room.cleared = true;
    }

    // Clean up boss UI
    if (this.bossHealthBar) { this.bossHealthBar.destroy(); this.bossHealthBar = null; }
    if (this.bossNameText) { this.bossNameText.destroy(); this.bossNameText = null; }

    bossSprite.destroy();
    this.boss = null;
    this.bossData = null;

    // Spawn exit portal
    this.spawnExitPortal(bossRoom);

    // Victory notification
    this.events.emit('notification', `${bossDef.name} DEFEATED!`, '#ffdd44');
    this.events.emit('notification', 'Portal to Midgard has opened!', '#cc88ff');
  }

  private checkRoomCleared(): void {
    for (const room of this.rooms) {
      if (room.cleared) continue;
      if (room.type === 'start') { room.cleared = true; continue; }

      // Check if all enemies in this room are dead
      room.enemies = room.enemies.filter(e => e.active);
      if (room.enemies.length === 0) {
        room.cleared = true;
        room.doorOpen = true;

        if (room.type !== 'boss') {
          this.events.emit('notification', 'Room cleared!', '#44cc44');
        }
      }
    }
  }

  private spawnExitPortal(room: DungeonRoom): void {
    this.exitPortal = this.physics.add.sprite(room.centerX, room.centerY + 30, 'portal');
    this.exitPortal.setDepth(9);

    // Pulsing animation
    this.tweens.add({
      targets: this.exitPortal,
      scaleX: 1.3,
      scaleY: 1.3,
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Label
    this.add.text(room.centerX, room.centerY + 50, 'Exit Portal', {
      fontFamily: 'monospace',
      fontSize: '8px',
      color: '#cc88ff',
      stroke: '#000',
      strokeThickness: 2,
    }).setOrigin(0.5).setDepth(50);
  }

  // ========================================================================
  // EXIT / RETURN TO OVERWORLD
  // ========================================================================

  private exitDungeon(): void {
    // Capture state BEFORE stopping scene (stopping destroys game objects)
    const returnData = {
      hp: this.playerController.hp,
      mp: this.playerController.mp,
      level: this.playerController.level,
      xp: this.playerController.xp,
      dungeonComplete: this.dungeonComplete,
    };

    // If GameScene is sleeping, wake it. If stopped, start it.
    if (this.scene.isSleeping('GameScene')) {
      this.scene.wake('GameScene');
    } else if (!this.scene.isActive('GameScene')) {
      this.scene.start('GameScene');
    }

    // Emit return event with player state BEFORE stopping this scene
    const gs = this.scene.get('GameScene');
    if (gs) {
      gs.events.emit('returnFromDungeon', returnData);
    }

    // Now stop this scene (after event has been emitted and received)
    this.scene.stop('DungeonScene');
  }

  // ========================================================================
  // HELPERS
  // ========================================================================

  private restorePlayerStats(): void {
    const s = this.config.playerStats;
    const pc = this.playerController;
    pc.level = this.config.playerLevel;
    pc.xp = this.config.playerXp;
    pc.hp = this.config.playerHp;
    pc.mp = this.config.playerMp;
    pc.maxHp = s.maxHp;
    pc.maxMp = s.maxMp;
    pc.attack = s.attack;
    pc.defense = s.defense;
    pc.speed = s.speed;
    pc.dexterity = s.dexterity;
    pc.vitality = s.vitality;
    pc.wisdom = s.wisdom;
  }

  private getInventoryManager(): InventoryManager | null {
    const gs = this.scene.get('GameScene') as any;
    return gs?.inventoryManager ?? null;
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
