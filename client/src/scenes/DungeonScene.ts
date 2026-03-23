import Phaser from 'phaser';
import { PlayerController } from '../systems/PlayerController';
import { ProjectileManager } from '../systems/ProjectileManager';
import { InputManager } from '../systems/InputManager';
import { CameraController } from '../systems/CameraController';
import { LootManager } from '../systems/LootManager';
import { InventoryManager } from '../systems/InventoryManager';
import { QuestManager } from '../systems/QuestManager';
import { AbilitySystem } from '../systems/AbilitySystem';
import { MusicManager } from '../systems/MusicManager';
import { TILE_SIZE, ItemType, BulletPatternType, xpForLevel } from '@yggdrasil/shared';
import { DungeonDef, DungeonBossDef, getDungeon } from '../data/DungeonDatabase';
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
  type: 'combat' | 'treasure' | 'boss' | 'start' | 'miniboss' | 'secret' | 'trap';
  shape: 'rect' | 'L' | 'cross' | 'arena' | 'corridor'; // room shape variety
  cleared: boolean;
  enemies: Phaser.Physics.Arcade.Sprite[];
  doorOpen: boolean;
  hazards: Phaser.GameObjects.Graphics[]; // environmental hazards
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
  // Endless mode
  endless?: boolean;      // true = infinite procedural dungeon
  endlessFloor?: number;  // current floor number (1-based)
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
  private isExiting: boolean = false;       // guard to prevent double-exit
  private hasTransitioned: boolean = false; // guard to prevent double scene transition

  // Endless mode
  private endless: boolean = false;
  private endlessFloor: number = 1;
  private floorText: Phaser.GameObjects.Text | null = null;

  // Enemy health bars (world-space graphics)
  private enemyHealthBars: Map<Phaser.Physics.Arcade.Sprite, Phaser.GameObjects.Graphics> = new Map();

  // Room door graphics
  private doorGraphics: Phaser.GameObjects.Graphics[] = [];

  // Class tint (for restoring after damage flash)
  private classTint: number = 0;

  // Inventory/Quest refs passed from GameScene
  inventoryManager!: InventoryManager;

  // Music
  private musicManager!: MusicManager;
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
    this.isExiting = false;
    this.hasTransitioned = false;
    this.enemyHealthBars = new Map();
    this.doorGraphics = [];
    // Resolve class tint for damage flash restoration
    const classDef = this.config.classId ? getClass(this.config.classId) : null;
    this.classTint = classDef?.spriteTint ?? 0;

    // Endless mode
    this.endless = this.config.endless ?? false;
    this.endlessFloor = this.config.endlessFloor ?? 1;
    this.floorText = null;
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

    // 7. Camera — tight follow (lerp 1.0) to prevent aim offset in dungeon
    this.cameraController = new CameraController(this, this.player);
    this.cameraController.setTightFollow();
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

    // Wire enemy-wall collision (must happen after both enemyGroup and groundLayer exist)
    if (this.groundLayer) {
      this.physics.add.collider(this.enemyGroup, this.groundLayer);
    }

    // 10. Collision: player vs walls
    if (this.groundLayer) {
      this.physics.add.collider(this.player, this.groundLayer);
      // Enemies also collide with walls — must be set up AFTER enemyGroup is created
      // (wired below after group creation)
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

    // 11b. Collision: projectiles vs walls — stop on wall hit
    if (this.groundLayer) {
      this.physics.add.collider(
        this.projectileManager.playerProjectiles,
        this.groundLayer,
        (proj) => {
          const p = proj as Phaser.Physics.Arcade.Sprite;
          if (p.active) this.projectileManager.deactivateProjectile(p, true);
        },
        undefined,
        this,
      );
      this.physics.add.collider(
        this.projectileManager.enemyProjectiles,
        this.groundLayer,
        (proj) => {
          const p = proj as Phaser.Physics.Arcade.Sprite;
          if (p.active) this.projectileManager.deactivateProjectile(p, false);
        },
        undefined,
        this,
      );
    }

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

    // 14b. Spawn environmental hazards
    this.spawnRoomHazards();

    // 15. Hide cursor
    this.input.setDefaultCursor('none');

    // 16. Grant invincibility on enter
    this.playerController.grantInvincibility(2.0);

    // In endless mode, death means restart this floor
    if (this.endless) {
      this.events.on('playerDeath', () => {
        // After the 3-second respawn timer, restart the floor
        this.time.delayedCall(3500, () => {
          if (this.isExiting) return;
          this.events.emit('notification', 'Restarting floor...', '#ff8844');
          this.time.delayedCall(1000, () => {
            if (this.isExiting) return;
            // Restart with same config (same floor, full HP)
            const restartConfig = { ...this.config };
            restartConfig.playerHp = restartConfig.playerStats.maxHp;
            restartConfig.playerMp = restartConfig.playerStats.maxMp;
            this.musicManager?.stopMusic();
            this.scene.restart(restartConfig);
          });
        });
      });
    }

    // 17. Show dungeon name
    if (this.endless) {
      this.events.emit('notification', `DEPTH ${this.endlessFloor}`, '#cc88ff');
      // Floor indicator (screen-space)
      this.floorText = this.add.text(
        this.cameras.main.width / 2, 50,
        `DEPTH ${this.endlessFloor}`,
        { fontFamily: 'monospace', fontSize: '10px', color: '#cc88ff',
          stroke: '#000', strokeThickness: 2 },
      ).setOrigin(0.5).setScrollFactor(0).setDepth(100);
    } else {
      this.events.emit('notification', `Entering: ${def.name}`, '#cc88ff');
    }

    // 18. Launch UI scene if not already running
    if (!this.scene.isActive('UIScene')) {
      this.scene.launch('UIScene');
    }

    // 19. Music — start dungeon-specific ambient track (falls back to generic if not loaded)
    this.musicManager = new MusicManager(this);
    const dungeonMusicKey = def.musicKey ?? 'music_dungeon';
    const hasSpecificTrack = this.cache.audio.has(dungeonMusicKey);
    this.musicManager.playMusic(hasSpecificTrack ? dungeonMusicKey : 'music_dungeon');

    // 20. Notify UIScene to re-wire its event listeners (scene.start resets event emitter)
    this.game.events.emit('dungeonSceneReady');
  }

  update(time: number, delta: number): void {
    const dt = delta / 1000;

    // Once exiting, freeze all dungeon logic — only the camera fade runs
    if (this.isExiting) return;

    // Crosshair — hide on mobile
    if (InputManager.isMobile) {
      this.crosshair.setVisible(false);
    } else {
      this.crosshair.setPosition(
        this.input.activePointer.x,
        this.input.activePointer.y,
      );
    }

    // Get aim target: mouse on desktop, auto-aim on mobile
    let aimX: number;
    let aimY: number;

    if (InputManager.isMobile) {
      // Auto-aim at nearest enemy
      let nearest: Phaser.Physics.Arcade.Sprite | null = null;
      let nearestDist = Infinity;
      this.enemyGroup.getChildren().forEach((child) => {
        const e = child as Phaser.Physics.Arcade.Sprite;
        if (!e.active) return;
        const d = (e.x - this.player.x) ** 2 + (e.y - this.player.y) ** 2;
        if (d < nearestDist) { nearestDist = d; nearest = e; }
      });
      if (nearest && nearestDist < 400 * 400) {
        aimX = (nearest as Phaser.Physics.Arcade.Sprite).x;
        aimY = (nearest as Phaser.Physics.Arcade.Sprite).y;
      } else {
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
    this.cameraController.update(dt);
    this.lootManager.update(dt, this.player.x, this.player.y);
    this.abilitySystem.update(dt);

    // Space bar / ability button: use ability
    if (this.inputManager.isAbilityPressed() && !this.playerController.isDead) {
      const used = this.abilitySystem.useAbility(aimX, aimY);
      if (used) this.musicManager?.playSFX('sfx_ability');
    }

    // Shooting
    if (this.inputManager.isShootingPressed()) {
      this.projectileManager.firePlayerProjectile(
        this.player.x,
        this.player.y,
        aimX,
        aimY,
      );
    }

    // Check P to exit dungeon
    if (this.inputManager.isPortalKeyPressed() && !this.playerController.isDead && !this.isExiting) {
      this.isExiting = true;
      this.exitDungeon();
      return;
    }

    // Update enemies
    this.updateEnemies(dt);

    // Update boss
    if (this.boss && this.boss.active && this.bossData) {
      this.updateBoss(dt);
    }

    // Update environmental hazards
    this.updateHazards(dt);

    // Check room clearing
    this.checkRoomCleared();

    // Check exit portal pickup
    if (this.exitPortal && this.exitPortal.active && !this.isExiting) {
      const dist = distanceBetween(this.player.x, this.player.y, this.exitPortal.x, this.exitPortal.y);
      if (dist < 28) {
        this.isExiting = true;
        this.exitDungeon();
        return;
      }
    }

    // Emit player state for UI (include abilities so the ability widget updates color/cooldown)
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

    // Emit minimap data — include dungeon room shapes so UI can draw them
    const enemies: { x: number; y: number }[] = [];
    this.enemyGroup.getChildren().forEach((child) => {
      const e = child as Phaser.Physics.Arcade.Sprite;
      if (e.active) enemies.push({ x: e.x, y: e.y });
    });
    if (this.boss && this.boss.active) {
      enemies.push({ x: this.boss.x, y: this.boss.y });
    }
    // Pass room data for the dungeon minimap rendering
    const dungeonRooms = this.rooms.map(r => ({
      x: r.x * TILE_SIZE,
      y: r.y * TILE_SIZE,
      w: r.w * TILE_SIZE,
      h: r.h * TILE_SIZE,
      type: r.type,
      cleared: r.cleared,
    }));
    this.events.emit('minimapUpdate', {
      playerX: this.player.x,
      playerY: this.player.y,
      playerVelX: this.player.body?.velocity.x ?? 0,
      playerVelY: this.player.body?.velocity.y ?? 0,
      worldSize: Math.max(this.dungeonPixelW, this.dungeonPixelH),
      enemies,
      questWaypoints: [],
      dungeonRooms,
      isDungeon: true,
    });
  }

  // ========================================================================
  // DUNGEON GENERATION — Snake layout with varying room sizes
  // ========================================================================

  /**
   * Generates a snake-path dungeon:
   * - Rooms vary in size and alternate direction (right, down, right, up, etc.)
   * - Corridors connect room edges with 3-tile-wide passages
   * - Each combat room gets a mini-boss enemy
   * - Final room (boss) has the real boss; defeating it spawns the exit portal
   * - Total canvas is pre-calculated before carving so tilemap fits exactly
   */
  private generateDungeon(def: DungeonDef): void {
    const numRooms = randomInt(def.minRooms, def.maxRooms);
    const CORRIDOR = 5;   // tiles between rooms (corridor length)
    const PAD = 2;         // world edge padding

    // Randomized direction cycle for more varied layouts
    const allDirs: ('right' | 'down' | 'up')[] = ['right', 'down', 'right', 'up'];
    // Shuffle mid-sections for variety
    const DIRS = [...allDirs];
    if (Math.random() > 0.5) { DIRS[1] = 'up'; DIRS[3] = 'down'; }

    // Room type assignment — varied experiences
    const roomTypes: ('start' | 'combat' | 'boss' | 'treasure' | 'miniboss' | 'trap' | 'secret')[] = [];
    for (let i = 0; i < numRooms; i++) {
      if (i === 0) { roomTypes.push('start'); continue; }
      if (i === numRooms - 1) { roomTypes.push('boss'); continue; }
      // Distribute special rooms throughout
      const roll = Math.random();
      if (i === Math.floor(numRooms / 2) && numRooms >= 5) {
        roomTypes.push('miniboss'); // Mid-dungeon mini-boss
      } else if (roll < 0.15 && i > 1) {
        roomTypes.push('treasure'); // Treasure room — no enemies, just rewards
      } else if (roll < 0.25 && def.difficulty >= 5) {
        roomTypes.push('trap'); // Trap room — hazard gauntlet
      } else if (roll < 0.30 && i >= 2) {
        roomTypes.push('secret'); // Secret room — hidden bonus
      } else {
        roomTypes.push('combat');
      }
    }

    // Room shapes for visual variety
    const shapes: ('rect' | 'L' | 'cross' | 'arena' | 'corridor')[] = [];
    for (let i = 0; i < numRooms; i++) {
      const type = roomTypes[i];
      if (type === 'boss') { shapes.push('arena'); continue; }
      if (type === 'trap') { shapes.push('corridor'); continue; }
      if (type === 'secret') { shapes.push('rect'); continue; }
      // Combat/miniboss rooms get varied shapes
      const shapeRoll = Math.random();
      if (shapeRoll < 0.3) shapes.push('L');
      else if (shapeRoll < 0.5) shapes.push('cross');
      else if (shapeRoll < 0.65) shapes.push('arena');
      else shapes.push('rect');
    }

    // First pass: calculate room grid positions (in tile units) and world size
    type RoomPlacement = {
      rx: number; ry: number; rw: number; rh: number;
      type: typeof roomTypes[number];
      shape: typeof shapes[number];
    };
    const placements: RoomPlacement[] = [];

    let cx = PAD, cy = PAD;

    for (let i = 0; i < numRooms; i++) {
      const isLast = i === numRooms - 1;
      const type = roomTypes[i];
      const shape = shapes[i];

      // Size varies by room type
      let rw: number, rh: number;
      if (isLast) {
        // Boss room — largest, circular arena feel
        rw = def.roomWidth + 8;
        rh = def.roomHeight + 8;
      } else if (type === 'treasure' || type === 'secret') {
        // Small compact rooms
        rw = Math.max(10, def.roomWidth - 4);
        rh = Math.max(8, def.roomHeight - 4);
      } else if (type === 'trap') {
        // Long corridor
        rw = def.roomWidth + randomInt(4, 10);
        rh = Math.max(8, def.roomHeight - 6);
      } else if (type === 'miniboss') {
        // Slightly larger than combat
        rw = def.roomWidth + 4;
        rh = def.roomHeight + 4;
      } else {
        // Standard combat — varying sizes
        rw = Math.max(12, def.roomWidth + randomInt(-4, 6));
        rh = Math.max(10, def.roomHeight + randomInt(-4, 6));
      }

      placements.push({ rx: cx, ry: cy, rw, rh, type, shape });

      if (i < numRooms - 1) {
        const dir = DIRS[i % DIRS.length];
        if (dir === 'right')      { cx = cx + rw + CORRIDOR; }
        else if (dir === 'down')  { cy = cy + rh + CORRIDOR; }
        else if (dir === 'up')    { cy = cy - (def.roomHeight + CORRIDOR); if (cy < PAD) cy = PAD; }
      }
    }

    // World bounds = bounding box of all rooms + padding
    let maxX = 0, maxY = 0;
    for (const p of placements) {
      maxX = Math.max(maxX, p.rx + p.rw + PAD);
      maxY = Math.max(maxY, p.ry + p.rh + PAD);
    }
    const minX = Math.min(0, ...placements.map(p => p.rx));
    const minY = Math.min(0, ...placements.map(p => p.ry));
    const shiftX = minX < 0 ? -minX + PAD : 0;
    const shiftY = minY < 0 ? -minY + PAD : 0;

    this.dungeonWidth  = maxX + shiftX + PAD;
    this.dungeonHeight = maxY + shiftY + PAD;
    this.dungeonPixelW = this.dungeonWidth  * TILE_SIZE;
    this.dungeonPixelH = this.dungeonHeight * TILE_SIZE;

    // Build DungeonRoom objects (shifted into positive space)
    for (const p of placements) {
      const rx = p.rx + shiftX;
      const ry = p.ry + shiftY;
      this.rooms.push({
        x:       rx,
        y:       ry,
        w:       p.rw,
        h:       p.rh,
        centerX: (rx + p.rw / 2) * TILE_SIZE,
        centerY: (ry + p.rh / 2) * TILE_SIZE,
        type:    p.type,
        shape:   p.shape,
        cleared: p.type === 'start' || p.type === 'treasure',
        enemies: [],
        doorOpen: p.type === 'start' || p.type === 'treasure',
        hazards: [],
      });
    }
  }

  private createTilemap(def: DungeonDef): void {
    // Build tile data — all walls by default
    const data: number[][] = [];
    for (let y = 0; y < this.dungeonHeight; y++) {
      data[y] = new Array(this.dungeonWidth).fill(def.tileWall);
    }

    const carve = (tx: number, ty: number): void => {
      if (tx >= 0 && tx < this.dungeonWidth && ty >= 0 && ty < this.dungeonHeight) {
        data[ty][tx] = def.tileGround;
      }
    };

    // Carve rooms based on their shape
    for (const room of this.rooms) {
      this.carveRoomShape(room, carve);
    }

    // Carve corridors between consecutive rooms using center-to-center L-shaped paths
    for (let i = 0; i < this.rooms.length - 1; i++) {
      const a = this.rooms[i];
      const b = this.rooms[i + 1];

      const ax = Math.floor(a.x + a.w / 2);
      const ay = Math.floor(a.y + a.h / 2);
      const bx = Math.floor(b.x + b.w / 2);
      const by = Math.floor(b.y + b.h / 2);

      // Horizontal leg
      const hMinX = Math.min(ax, bx), hMaxX = Math.max(ax, bx);
      for (let tx = hMinX; tx <= hMaxX; tx++) {
        for (let dy = -1; dy <= 1; dy++) carve(tx, ay + dy);
      }
      // Vertical leg
      const vMinY = Math.min(ay, by), vMaxY = Math.max(ay, by);
      for (let ty = vMinY; ty <= vMaxY; ty++) {
        for (let dx = -1; dx <= 1; dx++) carve(bx + dx, ty);
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

    // Set collision on wall tiles for BOTH player and enemies
    this.groundLayer.setCollision(def.tileWall);
  }

  /** Carve a room according to its shape */
  private carveRoomShape(room: DungeonRoom, carve: (tx: number, ty: number) => void): void {
    const { x, y, w, h, shape } = room;

    switch (shape) {
      case 'L': {
        // L-shaped: full top half + left half of bottom
        const midY = Math.floor(y + h / 2);
        const midX = Math.floor(x + w * 0.6);
        // Top portion (full width)
        for (let ty = y + 1; ty < midY; ty++) {
          for (let tx = x + 1; tx < x + w - 1; tx++) carve(tx, ty);
        }
        // Bottom-left portion
        for (let ty = midY; ty < y + h - 1; ty++) {
          for (let tx = x + 1; tx < midX; tx++) carve(tx, ty);
        }
        break;
      }
      case 'cross': {
        // Cross/plus shape: horizontal and vertical strips
        const armW = Math.max(4, Math.floor(w * 0.4));
        const armH = Math.max(4, Math.floor(h * 0.4));
        const cx = Math.floor(x + w / 2);
        const cy = Math.floor(y + h / 2);
        // Horizontal arm
        for (let ty = cy - Math.floor(armH / 2); ty <= cy + Math.floor(armH / 2); ty++) {
          for (let tx = x + 1; tx < x + w - 1; tx++) carve(tx, ty);
        }
        // Vertical arm
        for (let ty = y + 1; ty < y + h - 1; ty++) {
          for (let tx = cx - Math.floor(armW / 2); tx <= cx + Math.floor(armW / 2); tx++) carve(tx, ty);
        }
        break;
      }
      case 'arena': {
        // Circular arena (ellipse carved from rectangle)
        const cx = x + w / 2;
        const cy = y + h / 2;
        const rx = (w - 2) / 2;
        const ry = (h - 2) / 2;
        for (let ty = y + 1; ty < y + h - 1; ty++) {
          for (let tx = x + 1; tx < x + w - 1; tx++) {
            const dx = (tx - cx) / rx;
            const dy = (ty - cy) / ry;
            if (dx * dx + dy * dy <= 1.0) carve(tx, ty);
          }
        }
        // Also carve small entry points at cardinal directions
        const entries = [
          { tx: Math.floor(cx), ty: y },         // top
          { tx: Math.floor(cx), ty: y + h - 1 }, // bottom
          { tx: x, ty: Math.floor(cy) },          // left
          { tx: x + w - 1, ty: Math.floor(cy) }, // right
        ];
        for (const e of entries) {
          for (let d = -1; d <= 1; d++) {
            carve(e.tx + d, e.ty);
            carve(e.tx, e.ty + d);
          }
        }
        break;
      }
      case 'corridor': {
        // Long narrow corridor with small alcoves
        const midH = Math.max(4, Math.floor(h * 0.5));
        const topY = Math.floor(y + (h - midH) / 2);
        // Main corridor
        for (let ty = topY; ty < topY + midH; ty++) {
          for (let tx = x + 1; tx < x + w - 1; tx++) carve(tx, ty);
        }
        // Random alcoves along the sides
        const alcoveCount = Math.floor(w / 8);
        for (let a = 0; a < alcoveCount; a++) {
          const alcoveX = x + 3 + Math.floor(Math.random() * (w - 6));
          const side = Math.random() > 0.5 ? topY - 2 : topY + midH;
          for (let dy = 0; dy < 3; dy++) {
            for (let dx = -1; dx <= 1; dx++) carve(alcoveX + dx, side + dy);
          }
        }
        break;
      }
      case 'rect':
      default: {
        // Standard rectangular room (original behavior)
        for (let ty = y + 1; ty < y + h - 1; ty++) {
          for (let tx = x + 1; tx < x + w - 1; tx++) carve(tx, ty);
        }
        break;
      }
    }
  }

  /** Spawn environmental hazards based on dungeon theme */
  private spawnRoomHazards(): void {
    const def = this.config.dungeonDef;

    for (const room of this.rooms) {
      if (room.type === 'start' || room.type === 'treasure') continue;

      // Only some rooms get hazards
      if (room.type !== 'trap' && Math.random() > 0.4) continue;

      const hazardCount = room.type === 'trap'
        ? randomInt(3, 6) // Trap rooms are packed with hazards
        : randomInt(1, 3);

      for (let i = 0; i < hazardCount; i++) {
        const hx = (room.x + 2 + Math.random() * (room.w - 4)) * TILE_SIZE;
        const hy = (room.y + 2 + Math.random() * (room.h - 4)) * TILE_SIZE;
        const hazardR = 12 + Math.random() * 10;

        const g = this.add.graphics().setDepth(1);

        // Dungeon-themed hazards
        if (def.id === 'frostheim_caverns') {
          // Ice patches — blue semi-transparent circles
          g.fillStyle(0x88ccff, 0.3);
          g.fillCircle(hx, hy, hazardR);
          g.lineStyle(1, 0xaaddff, 0.4);
          g.strokeCircle(hx, hy, hazardR);
        } else if (def.id === 'verdant_hollows') {
          // Poison pools — green bubbling
          g.fillStyle(0x22aa22, 0.35);
          g.fillCircle(hx, hy, hazardR);
          g.fillStyle(0x44ff44, 0.2);
          g.fillCircle(hx - 3, hy - 2, hazardR * 0.4);
        } else if (def.id === 'muspelheim_forge') {
          // Lava pools — red/orange glow
          g.fillStyle(0xff3300, 0.4);
          g.fillCircle(hx, hy, hazardR);
          g.fillStyle(0xffaa00, 0.3);
          g.fillCircle(hx, hy, hazardR * 0.5);
          g.lineStyle(1, 0xff6600, 0.5);
          g.strokeCircle(hx, hy, hazardR);
        } else {
          // Dark void patches — purple/black
          g.fillStyle(0x330055, 0.4);
          g.fillCircle(hx, hy, hazardR);
          g.fillStyle(0x6600aa, 0.2);
          g.fillCircle(hx, hy, hazardR * 0.6);
        }

        room.hazards.push(g);

        // Hazard damage zone — damage player if they stand in it
        // Store hazard data for checking in update loop
        g.setData('hazardX', hx);
        g.setData('hazardY', hy);
        g.setData('hazardR', hazardR);
        g.setData('hazardDamage', 3 + def.difficulty);
        g.setData('hazardCooldown', 0);
      }
    }
  }

  /** Check hazard zones and damage player (called from update) */
  private updateHazards(dt: number): void {
    if (this.playerController.isDead || this.playerController.isInvincible) return;

    for (const room of this.rooms) {
      for (const g of room.hazards) {
        const hx = g.getData('hazardX') as number;
        const hy = g.getData('hazardY') as number;
        const hr = g.getData('hazardR') as number;
        let cd = g.getData('hazardCooldown') as number;

        cd -= dt;
        if (cd > 0) { g.setData('hazardCooldown', cd); continue; }

        const dx = this.player.x - hx;
        const dy = this.player.y - hy;
        if (dx * dx + dy * dy < hr * hr) {
          const dmg = g.getData('hazardDamage') as number;
          this.playerController.takeDamage(dmg);
          g.setData('hazardCooldown', 0.8); // damage tick rate
          // Brief visual pulse
          g.setAlpha(0.8);
          this.time.delayedCall(200, () => g.setAlpha(1));
        }
      }
    }
  }

  // ========================================================================
  // ENEMY SPAWNING
  // ========================================================================

  private spawnRoomEnemies(): void {
    const def = this.config.dungeonDef;
    const runeLevel = this.config.runeKeyLevel;

    for (const room of this.rooms) {
      if (room.type === 'start' || room.type === 'treasure') continue;

      if (room.type === 'boss') {
        this.spawnBoss(room);
        continue;
      }

      // Enemy count varies by room type
      let count: number;
      if (room.type === 'miniboss') {
        count = 2; // Mini-boss + a couple guards
      } else if (room.type === 'trap') {
        count = randomInt(1, 3); // Trap rooms have fewer enemies but hazards
      } else if (room.type === 'secret') {
        count = randomInt(2, 3); // Secret rooms: small but tough
      } else {
        const baseCount = 3 + Math.floor(def.difficulty / 3);
        count = Math.min(6, Math.floor(baseCount * (1 + runeLevel * 0.1)));
      }

      const roomAggroW = room.w * TILE_SIZE * 0.6;
      const roomAggroH = room.h * TILE_SIZE * 0.6;

      for (let i = 0; i < count; i++) {
        // Find a valid floor tile position (non-rectangular rooms have walls inside bounding box)
        let ex = 0, ey = 0;
        let validPos = false;
        for (let attempt = 0; attempt < 20; attempt++) {
          const tx = Math.floor(room.x + 2 + Math.random() * (room.w - 4));
          const ty = Math.floor(room.y + 2 + Math.random() * (room.h - 4));
          const tile = this.groundLayer?.getTileAt(tx, ty);
          if (tile && tile.index !== this.config.dungeonDef.tileWall) {
            ex = tx * TILE_SIZE + TILE_SIZE / 2;
            ey = ty * TILE_SIZE + TILE_SIZE / 2;
            validPos = true;
            break;
          }
        }
        if (!validPos) {
          // Fallback: spawn at room center (always carved)
          ex = (room.x + Math.floor(room.w / 2)) * TILE_SIZE + TILE_SIZE / 2;
          ey = (room.y + Math.floor(room.h / 2)) * TILE_SIZE + TILE_SIZE / 2;
        }

        const level = Math.min(20, def.difficulty * 3 + Math.floor(runeLevel * 0.5));
        let hpMult  = (0.6 + def.difficulty * 0.1)  * (1 + runeLevel * 0.1);
        let dmgMult = (0.5 + def.difficulty * 0.09) * (1 + runeLevel * 0.08);

        // Enemy archetype — varies by dungeon and role
        let textureKey = 'enemy_medium';
        let enemyScale = 0.7 + def.difficulty * 0.04 + Math.random() * 0.35;
        let speed = 45 + level * 3;

        // Mini-boss enemies are tougher (first enemy in miniboss room is the elite)
        const isMiniBoss = room.type === 'miniboss' && i === 0;
        if (isMiniBoss) {
          hpMult *= 3.0;
          dmgMult *= 1.5;
          enemyScale *= 1.6;
          speed *= 0.8; // Slower but tankier
          textureKey = 'enemy_boss';
        }

        // Secret room enemies are elites
        if (room.type === 'secret') {
          hpMult *= 1.5;
          dmgMult *= 1.2;
        }

        // Vary enemy textures by dungeon — use different sprite sizes
        if (!isMiniBoss) {
          const textures = def.enemyTextures;
          textureKey = textures[Math.floor(Math.random() * textures.length)];
        }

        const enemy = this.physics.add.sprite(ex, ey, textureKey);
        enemy.setDepth(5);
        enemy.setScale(enemyScale);
        enemy.body!.setSize(20, 20);

        // Apply dungeon theme tint with variation
        if (def.enemyTint) {
          const r = ((def.enemyTint >> 16) & 0xff) + Math.floor((Math.random() - 0.5) * 0x33);
          const g = ((def.enemyTint >> 8)  & 0xff) + Math.floor((Math.random() - 0.5) * 0x33);
          const b = ((def.enemyTint)        & 0xff) + Math.floor((Math.random() - 0.5) * 0x33);
          const variedTint = (Math.max(0, Math.min(0xff, r)) << 16) |
                             (Math.max(0, Math.min(0xff, g)) << 8)  |
                              Math.max(0, Math.min(0xff, b));
          enemy.setTint(isMiniBoss ? 0xffffff : variedTint);
        }

        // More varied attack patterns
        const patterns: ('aimed' | 'radial' | 'shotgun')[] = ['aimed'];
        if (def.difficulty >= 3) patterns.push('shotgun');
        if (def.difficulty >= 6) patterns.push('radial');
        if (isMiniBoss) patterns.push('radial', 'shotgun'); // Mini-bosses use all patterns

        enemy.setData('enemyData', {
          level,
          maxHp: Math.floor((40 + level * 20) * hpMult),
          hp: Math.floor((40 + level * 20) * hpMult),
          damage: Math.floor((3 + level * 2) * dmgMult),
          speed,
          aggroRange: Math.max(roomAggroW, roomAggroH),
          fireRate: 0.35 + level * 0.04,
          fireCooldown: 0.8 + Math.random() * 1.5,
          behavior: 'idle',
          wanderAngle: Math.random() * Math.PI * 2,
          wanderTimer: 0,
          textureKey,
          patternType: patterns[Math.floor(Math.random() * patterns.length)],
          projectileSpeed: 110 + level * 10,
          projectileTexture: 'projectile_enemy',
          isMiniBoss,
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
    this.boss.body!.setSize(28, 28); // hitbox matches scaled visual size
    if (this.config.dungeonDef.bossTint) {
      this.boss.setTint(this.config.dungeonDef.bossTint);
    }
    // Dormant state — ghost-like until player enters the boss room
    this.boss.setAlpha(0.35);
    this.tweens.add({
      targets: this.boss,
      alpha: { from: 0.25, to: 0.45 },
      duration: 1400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

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

    // Boss music + health bar are deferred until player enters the boss room
    // (spawnBoss is called at scene create, before player walks there)
    // They are initialized in updateBoss on the first frame the boss is in range
  }

  private updateBoss(dt: number): void {
    if (!this.boss || !this.boss.active || !this.bossData) return;

    const bossDef = this.bossData.def;
    const hpRatio = this.bossData.hp / this.bossData.maxHp;

    // Lazy-init health bar + music when player gets close to the boss.
    // Uses distance from boss sprite (more reliable than room-bounds check).
    if (!this.bossHealthBar) {
      const dx = this.player.x - this.boss.x;
      const dy = this.player.y - this.boss.y;
      const distSq = dx * dx + dy * dy;
      const AWAKEN_DIST = 300; // pixels — generous so player definitely sees awakening
      if (distSq > AWAKEN_DIST * AWAKEN_DIST) return; // boss dormant until player is close

      // ---- BOSS AWAKENING ----
      this.musicManager?.playMusic('music_boss');
      this.bossHealthBar = this.add.graphics().setDepth(30); // world-space, floats above boss
      const screenCX = this.cameras.main.width / 2;
      this.bossNameText = this.add.text(screenCX, 12, bossDef.name, {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#ff8888',
        stroke: '#000',
        strokeThickness: 3,
      }).setOrigin(0.5).setScrollFactor(0).setDepth(201);
      this.events.emit('notification', bossDef.name + ' awakens!', '#ff4444');

      // Kill dormant pulsing tween and animate boss to full presence
      this.tweens.killTweensOf(this.boss!);
      this.tweens.add({
        targets: this.boss,
        alpha: 1.0,
        scaleX: 1.8,
        scaleY: 1.8,
        duration: 400,
        ease: 'Back.easeOut',
        onComplete: () => {
          // Snap back to normal scale after the entrance pop
          if (this.boss?.active) {
            this.tweens.add({ targets: this.boss, scaleX: 1.5, scaleY: 1.5, duration: 200, ease: 'Power2' });
          }
        },
      });
      // Brief white flash for dramatic entrance
      this.boss!.setTint(0xffffff);
      this.time.delayedCall(300, () => {
        if (this.boss?.active && this.config.dungeonDef.bossTint) {
          this.boss.setTint(this.config.dungeonDef.bossTint);
        } else if (this.boss?.active) {
          this.boss.clearTint();
        }
      });
    }

    // Determine current phase — iterate forward so the last (most advanced) matching
    // phase wins. e.g. thresholds [1.0, 0.6, 0.25]: at 20% hp all three match but
    // the final value is phase 2 (correct). The old backward loop always ended with
    // phase 0 (threshold 1.0 is always true), preventing any phase transitions.
    let phaseIndex = 0;
    for (let i = 0; i < bossDef.phases.length; i++) {
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

    // Update boss health bar (world-space: floats above the boss sprite like enemy bars)
    if (this.bossHealthBar && this.boss) {
      this.bossHealthBar.clear();
      const barW = 44, barH = 5;
      const bx = this.boss.x - barW / 2;
      const by = this.boss.y - 22;

      // Background
      this.bossHealthBar.fillStyle(0x111111, 0.9);
      this.bossHealthBar.fillRect(bx - 1, by - 1, barW + 2, barH + 2);

      // HP fill
      const color = hpRatio > 0.5 ? 0xcc3333 : hpRatio > 0.25 ? 0xcc6633 : 0xff2222;
      this.bossHealthBar.fillStyle(color, 1);
      this.bossHealthBar.fillRect(bx, by, Math.max(0, barW * hpRatio), barH);

      // Border
      this.bossHealthBar.lineStyle(1, 0x888888, 0.8);
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
      const aggroRange = data.aggroRange as number;

      // Once aggro'd, stay aggro'd until player is very far (>aggroRange * 2)
      if (!data.aggro && dist < aggroRange) {
        data.aggro = true;
      } else if (data.aggro && dist > aggroRange * 2.5) {
        data.aggro = false;
      }

      if (data.aggro) {
        // Chase — maintain a minimum shooting distance but always pursue
        if (dist > 70) {
          const angle = angleBetween(enemy.x, enemy.y, this.player.x, this.player.y);
          enemy.setVelocity(Math.cos(angle) * data.speed, Math.sin(angle) * data.speed);
        } else {
          // Too close — strafe/circle
          const angle = angleBetween(enemy.x, enemy.y, this.player.x, this.player.y) + Math.PI * 0.5;
          enemy.setVelocity(Math.cos(angle) * data.speed * 0.5, Math.sin(angle) * data.speed * 0.5);
        }

        // Fire
        data.fireCooldown -= dt;
        if (data.fireCooldown <= 0) {
          data.fireCooldown = 1.0 / data.fireRate;
          this.fireEnemyPattern(enemy, data);
        }
      } else {
        // Idle wander until player enters the room
        data.wanderTimer -= dt;
        if (data.wanderTimer <= 0) {
          data.wanderAngle = Math.random() * Math.PI * 2;
          data.wanderTimer = 2 + Math.random() * 3;
        }
        enemy.setVelocity(
          Math.cos(data.wanderAngle) * data.speed * 0.15,
          Math.sin(data.wanderAngle) * data.speed * 0.15,
        );
      }

      // Update health bar
      this.updateEnemyHealthBar(enemy, data);
    });
  }

  private updateEnemyHealthBar(enemy: Phaser.Physics.Arcade.Sprite, data: any): void {
    // Only show bar when damaged
    if (data.hp >= data.maxHp) {
      const existing = this.enemyHealthBars.get(enemy);
      if (existing) { existing.destroy(); this.enemyHealthBars.delete(enemy); }
      return;
    }

    let bar = this.enemyHealthBars.get(enemy);
    if (!bar) {
      bar = this.add.graphics().setDepth(20);
      this.enemyHealthBars.set(enemy, bar);
    }

    bar.clear();
    const bw = 22, bh = 3;
    const bx = enemy.x - bw / 2;
    const by = enemy.y - 14;
    const ratio = Math.max(0, data.hp / data.maxHp);

    bar.fillStyle(0x222222, 0.9);
    bar.fillRect(bx, by, bw, bh);
    const col = ratio > 0.5 ? 0x44cc44 : ratio > 0.25 ? 0xcccc44 : 0xcc4444;
    bar.fillStyle(col, 1);
    bar.fillRect(bx, by, bw * ratio, bh);
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
      this.musicManager?.playSFX('sfx_hit_enemy');

      // White flash then restore boss tint
      const bossTint = this.config.dungeonDef.bossTint;
      enemy.setTint(0xffffff);
      this.time.delayedCall(80, () => {
        if (enemy.active) {
          if (bossTint) enemy.setTint(bossTint); else enemy.clearTint();
        }
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
    this.musicManager?.playSFX('sfx_hit_enemy');

    // White flash then restore dungeon tint
    const enemyTint = this.config.dungeonDef.enemyTint;
    enemy.setTint(0xffffff);
    this.time.delayedCall(80, () => {
      if (enemy.active) {
        if (enemyTint) enemy.setTint(enemyTint); else enemy.clearTint();
      }
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

      // 50/50: instant heal instead of a loot bag
      if (Math.random() < 0.5) {
        const healAmt = Math.floor(this.playerController.maxHp * 0.08); // heal 8% max HP
        this.playerController.hp = Math.min(this.playerController.maxHp, this.playerController.hp + healAmt);
        this.showDamageNumber(enemy.x, enemy.y - 10, healAmt, false); // reuse as green number
        this.events.emit('notification', `+${healAmt} HP`, '#44cc44');
        this.musicManager?.playSFX('sfx_heal');
      }

      // Clean up health bar
      const bar = this.enemyHealthBars.get(enemy);
      if (bar) { bar.destroy(); this.enemyHealthBars.delete(enemy); }

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
    this.musicManager?.playSFX('sfx_player_hit');

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

    // Boss defeated — switch back to dungeon music (or fade to silence)
    this.musicManager?.stopMusic();

    // Grant big XP
    const bossLevel = this.config.dungeonDef.difficulty * 2;
    this.playerController.grantXP(bossLevel * 50);

    const bossDef = this.config.dungeonDef.boss;

    // No loot bags — instant full heal on boss kill
    this.playerController.hp = this.playerController.maxHp;
    this.playerController.mp = this.playerController.maxMp;
    this.musicManager?.playSFX('sfx_heal');

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

    // Victory notification
    this.events.emit('notification', `${bossDef.name} DEFEATED!`, '#ffdd44');

    if (this.endless) {
      // Endless mode: advance to next floor
      this.events.emit('notification', `Depth ${this.endlessFloor} cleared!`, '#cc88ff');
      this.events.emit('notification', 'Descending deeper...', '#9966cc');

      // Brief pause then advance to next floor
      this.time.delayedCall(2000, () => {
        this.advanceEndlessFloor();
      });
    } else {
      // Spawn exit portal
      this.spawnExitPortal(bossRoom);
      this.events.emit('notification', 'Portal to Midgard has opened!', '#cc88ff');
    }
  }

  /** Advance to the next endless floor by restarting this scene with higher difficulty */
  private advanceEndlessFloor(): void {
    const nextFloor = this.endlessFloor + 1;

    // Scale difficulty with floor
    const baseDiff = this.config.dungeonDef.difficulty;
    const scaledDef = { ...this.config.dungeonDef };
    // Every 5 floors, difficulty increases significantly
    scaledDef.difficulty = baseDiff + Math.floor(nextFloor / 2);
    // More rooms as floors increase
    scaledDef.minRooms = Math.min(9, scaledDef.minRooms + Math.floor(nextFloor / 3));
    scaledDef.maxRooms = Math.min(12, scaledDef.maxRooms + Math.floor(nextFloor / 3));
    // Boss HP scales with floor
    const bossHpScale = 1 + nextFloor * 0.3;
    scaledDef.boss = { ...scaledDef.boss, maxHp: Math.floor(scaledDef.boss.maxHp * bossHpScale) };
    // Randomize dungeon theme every few floors
    const themes = ['frostheim_caverns', 'verdant_hollows', 'muspelheim_forge', 'helheim_sanctum'];
    const themeIdx = (nextFloor - 1) % themes.length;
    const themeDef = getDungeon(themes[themeIdx]);
    if (themeDef) {
      scaledDef.enemyTint = themeDef.enemyTint;
      scaledDef.bossTint = themeDef.bossTint;
      scaledDef.tileGround = themeDef.tileGround;
      scaledDef.tileWall = themeDef.tileWall;
      scaledDef.musicKey = themeDef.musicKey;
      scaledDef.name = `Depth ${nextFloor} — ${themeDef.name}`;
    }

    // Carry over current player stats
    const newConfig: DungeonConfig = {
      dungeonDef: scaledDef,
      runeKeyLevel: this.config.runeKeyLevel,
      classId: this.config.classId,
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
      endlessFloor: nextFloor,
    };

    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.time.delayedCall(600, () => {
      this.musicManager?.stopMusic();
      this.scene.restart(newConfig);
    });
  }

  private checkRoomCleared(): void {
    for (const room of this.rooms) {
      if (room.cleared) continue;
      if (room.type === 'start' || room.type === 'treasure') { room.cleared = true; continue; }

      // Check if all enemies in this room are dead
      room.enemies = room.enemies.filter(e => e.active);
      if (room.enemies.length === 0) {
        room.cleared = true;
        room.doorOpen = true;

        if (room.type === 'miniboss') {
          this.events.emit('notification', 'Elite defeated!', '#ffaa44');
          // Bonus XP for mini-boss room
          this.playerController.grantXP(this.config.dungeonDef.difficulty * 25);
          // Heal 25% on mini-boss clear
          const healAmt = Math.floor(this.playerController.maxHp * 0.25);
          this.playerController.hp = Math.min(this.playerController.maxHp, this.playerController.hp + healAmt);
          this.musicManager?.playSFX('sfx_heal');
        } else if (room.type === 'secret') {
          this.events.emit('notification', 'Secret found! Bonus XP!', '#ffdd44');
          this.playerController.grantXP(this.config.dungeonDef.difficulty * 20);
        } else if (room.type === 'trap') {
          this.events.emit('notification', 'Trap room survived!', '#ff8844');
        } else if (room.type !== 'boss') {
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
    // Stop dungeon music
    this.musicManager?.stopMusic();

    // Capture return data immediately (before any scene transitions)
    const returnData = {
      hp: this.playerController.hp,
      mp: this.playerController.mp,
      level: this.playerController.level,
      xp: this.playerController.xp,
      maxHp: this.playerController.maxHp,
      maxMp: this.playerController.maxMp,
      xpToNext: this.playerController.xpToNext,
      attack: this.playerController.attack,
      defense: this.playerController.defense,
      speed: this.playerController.speed,
      dexterity: this.playerController.dexterity,
      vitality: this.playerController.vitality,
      wisdom: this.playerController.wisdom,
      dungeonComplete: this.dungeonComplete,
      completedDungeonId: this.dungeonComplete ? this.config.dungeonDef.id : undefined,
    };

    // Disable player movement
    this.playerController.isDead = true;
    if (this.player.body) {
      (this.player.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
    }

    // Global failsafe (window.setTimeout, NOT scene-scoped) — survives DungeonScene shutdown.
    // If camerafadeoutcomplete never fires, this forces the transition after 1.5s.
    // Uses hasTransitioned guard so it's a no-op when the normal path already ran.
    window.setTimeout(() => {
      console.warn('[DungeonScene] Global failsafe triggered');
      this.doSceneTransition(returnData);
    }, 1500);

    // Fade camera to black, then transition
    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.doSceneTransition(returnData);
    });
  }

  // ========================================================================
  // HELPERS
  // ========================================================================

  /** Scene transition — guarded so it only ever runs ONCE per dungeon exit. */
  private doSceneTransition(returnData: object): void {
    // Guard: if already transitioned (e.g. failsafe fires after normal path), do nothing.
    if (this.hasTransitioned) return;
    this.hasTransitioned = true;

    try {
      const gs = this.scene.get('GameScene');
      if (this.scene.isSleeping('GameScene')) {
        this.scene.wake('GameScene', returnData);
      } else if (!this.scene.isActive('GameScene')) {
        this.scene.start('GameScene', { classId: this.config.classId, startStage: 0 });
        if (gs) gs.events.emit('returnFromDungeon', returnData);
      } else {
        if (gs) gs.events.emit('returnFromDungeon', returnData);
      }
    } catch (err) {
      console.error('[DungeonScene] Error waking GameScene:', err);
    }

    // Stop DungeonScene using window.setTimeout (global timer, not scene-scoped).
    // This is critical: this.time.delayedCall would be cancelled if DungeonScene's
    // time plugin shuts down for any reason, leaving the black camera up permanently.
    window.setTimeout(() => {
      try {
        if (this.scene?.isActive('DungeonScene')) {
          this.scene.stop('DungeonScene');
        }
      } catch (e) { /* scene already gone */ }
    }, 100);
  }

  private restorePlayerStats(): void {
    const s = this.config.playerStats;
    const pc = this.playerController;
    pc.level = this.config.playerLevel;
    pc.xp = this.config.playerXp;
    // Set xpToNext correctly for the entry level (not the default level-1 value)
    pc.xpToNext = xpForLevel(pc.level + 1) - xpForLevel(pc.level);
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
