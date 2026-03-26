import Phaser from 'phaser';
import { InputManager } from '../systems/InputManager';
import { CameraController } from '../systems/CameraController';
import { InventoryManager } from '../systems/InventoryManager';
import { TILE_SIZE } from '@yggdrasil/shared';
import { getItem } from '../data/ItemDatabase';

/**
 * NexusScene: Asgard Hub — the safe zone.
 *
 * Features:
 *   - Handcrafted golden-themed map (Asgard tiles)
 *   - Vault NPC: store items between characters (death-safe)
 *   - Shop NPC: buy basic gear with gold
 *   - Realm Portal: enter Midgard overworld
 *   - Dungeon Portals: quick-entry to unlocked dungeons
 *   - No enemies, no damage — safe zone
 *
 * Layout (30x24 tile map):
 *   - Central plaza with Bifrost portal to Midgard
 *   - Left wing: Vault keeper
 *   - Right wing: Shop keeper
 *   - Top: Dungeon portal area
 */

interface NPC {
  sprite: Phaser.Physics.Arcade.Sprite;
  name: string;
  type: 'vault' | 'shop' | 'quest' | 'realm';
  label: Phaser.GameObjects.Text;
  interactionRadius: number;
}

// Vault storage (persisted in localStorage, survives death)
interface VaultData {
  items: { itemId: string; quantity: number }[];
  gold: number;
}

const NEXUS_WIDTH = 30;
const NEXUS_HEIGHT = 24;

export class NexusScene extends Phaser.Scene {
  // Systems
  inputManager!: InputManager;
  cameraController!: CameraController;

  // Player
  player!: Phaser.Physics.Arcade.Sprite;
  crosshair!: Phaser.GameObjects.Image;

  // Map
  private tilemap!: Phaser.Tilemaps.Tilemap;
  private groundLayer!: Phaser.Tilemaps.TilemapLayer;

  // NPCs
  private npcs: NPC[] = [];

  // Vault state
  private vault: VaultData = { items: [], gold: 0 };
  private readonly maxVaultSlots = 16;

  // UI state
  private interactPrompt: Phaser.GameObjects.Text | null = null;
  private activePanel: Phaser.GameObjects.Container | null = null;
  private panelOpen = false;

  // Player stats (passed from game scene — preserved across transitions)
  private playerLevel: number = 1;
  private classId: string = 'viking';
  private playerHp: number = 200;
  private playerMaxHp: number = 200;
  private playerMp: number = 100;
  private playerMaxMp: number = 100;
  private playerXp: number = 0;
  private playerXpToNext: number = 100;
  private playerGold: number = 0;

  constructor() {
    super({ key: 'NexusScene' });
  }

  init(data: any): void {
    if (data?.playerLevel) this.playerLevel = data.playerLevel;
    if (data?.classId) this.classId = data.classId;
    if (data?.hp !== undefined) this.playerHp = data.hp;
    if (data?.maxHp !== undefined) this.playerMaxHp = data.maxHp;
    if (data?.mp !== undefined) this.playerMp = data.mp;
    if (data?.maxMp !== undefined) this.playerMaxMp = data.maxMp;
    if (data?.xp !== undefined) this.playerXp = data.xp;
    if (data?.xpToNext !== undefined) this.playerXpToNext = data.xpToNext;
    if (data?.gold !== undefined) this.playerGold = data.gold;
  }

  create(): void {
    // Load vault from localStorage
    this.loadVault();

    // 1. Input
    this.inputManager = new InputManager(this);

    // 2. Build the Asgard map
    this.buildNexusMap();

    // 3. Player — spawn in center plaza
    const spawnX = (NEXUS_WIDTH / 2) * TILE_SIZE;
    const spawnY = (NEXUS_HEIGHT / 2 + 2) * TILE_SIZE;
    this.player = this.physics.add.sprite(spawnX, spawnY, 'player');
    this.player.setDepth(10);
    this.player.setCollideWorldBounds(true);
    this.player.body!.setSize(12, 14);

    // 4. Camera
    this.cameraController = new CameraController(this, this.player);
    const pixelW = NEXUS_WIDTH * TILE_SIZE;
    const pixelH = NEXUS_HEIGHT * TILE_SIZE;
    this.cameras.main.setBounds(0, 0, pixelW, pixelH);
    this.physics.world.setBounds(0, 0, pixelW, pixelH);

    // 5. Crosshair
    this.crosshair = this.add.image(0, 0, 'crosshair');
    this.crosshair.setDepth(100);
    this.crosshair.setScrollFactor(0);

    // 6. Collision with walls
    if (this.groundLayer) {
      this.physics.add.collider(this.player, this.groundLayer);
    }

    // 7. Place NPCs
    this.placeNPCs();

    // 8. Hide cursor
    this.input.setDefaultCursor('none');

    // 9. Interact key (E)
    this.input.keyboard?.on('keydown-E', () => {
      if (this.panelOpen) {
        this.closePanel();
      } else {
        this.tryInteract();
      }
    });

    // 10. Escape to close panels
    this.input.keyboard?.on('keydown-ESC', () => {
      if (this.panelOpen) this.closePanel();
    });

    // 11. Show welcome
    this.events.emit('notification', 'Welcome to Asgard!', '#ddaa44');
    this.events.emit('notification', 'Press E near NPCs to interact', '#aaccff');

    // 12. Launch UI scene if not active
    if (!this.scene.isActive('UIScene')) {
      this.scene.launch('UIScene');
    }

    // 13. Emit player data for UI
    this.emitPlayerData();

    // 14. Interaction prompt
    this.interactPrompt = this.add.text(0, 0, '', {
      fontFamily: 'monospace',
      fontSize: '8px',
      color: '#ddaa44',
      stroke: '#000',
      strokeThickness: 2,
    }).setOrigin(0.5).setDepth(50).setVisible(false);
  }

  update(time: number, delta: number): void {
    const dt = delta / 1000;

    // Crosshair — hide on mobile
    if (InputManager.isMobile) {
      this.crosshair.setVisible(false);
    } else {
      this.crosshair.setPosition(
        this.input.activePointer.x,
        this.input.activePointer.y,
      );
    }

    // Movement
    this.inputManager.update();
    const dir = this.inputManager.getMovementDirection();
    const speed = 120;
    this.player.setVelocity(dir.x * speed, dir.y * speed);

    this.cameraController.update(dt);

    // Check NPC proximity
    this.checkNPCProximity();

    // Emit minimap data
    this.events.emit('minimapUpdate', {
      playerX: this.player.x,
      playerY: this.player.y,
      playerVelX: this.player.body?.velocity.x ?? 0,
      playerVelY: this.player.body?.velocity.y ?? 0,
      worldSize: NEXUS_WIDTH * TILE_SIZE,
      enemies: [],
      questWaypoints: [],
    });

    // Emit player data for UI
    this.emitPlayerData();
  }

  // ========================================================================
  // MAP BUILDING
  // ========================================================================

  private buildNexusMap(): void {
    // Build tile data — Asgard themed (tile 9 = gold ground, tile 10 = gold wall)
    const GROUND = 9;
    const WALL = 10;

    const data: number[][] = [];
    for (let y = 0; y < NEXUS_HEIGHT; y++) {
      data[y] = [];
      for (let x = 0; x < NEXUS_WIDTH; x++) {
        // Border walls
        if (x === 0 || x === NEXUS_WIDTH - 1 || y === 0 || y === NEXUS_HEIGHT - 1) {
          data[y][x] = WALL;
        } else {
          data[y][x] = GROUND;
        }
      }
    }

    // Inner wall structures to create rooms/areas
    // Left wing walls (vault area)
    for (let y = 5; y <= 18; y++) {
      data[y][10] = WALL;
    }
    // Door opening in left wing wall
    for (let y = 10; y <= 13; y++) {
      data[y][10] = GROUND;
    }

    // Right wing walls (shop area)
    for (let y = 5; y <= 18; y++) {
      data[y][19] = WALL;
    }
    // Door opening in right wing wall
    for (let y = 10; y <= 13; y++) {
      data[y][19] = GROUND;
    }

    // Top wall (dungeon portal area)
    for (let x = 10; x <= 19; x++) {
      data[5][x] = WALL;
    }
    // Door opening in top wall
    for (let x = 13; x <= 16; x++) {
      data[5][x] = GROUND;
    }

    // Decorative pillars in central plaza
    const pillarPositions = [
      [12, 8], [17, 8], [12, 15], [17, 15],
    ];
    for (const [px, py] of pillarPositions) {
      data[py][px] = WALL;
    }

    // Create tilemap
    this.tilemap = this.make.tilemap({
      data,
      tileWidth: TILE_SIZE,
      tileHeight: TILE_SIZE,
    });

    const tileset = this.tilemap.addTilesetImage('tileset', 'tileset', TILE_SIZE, TILE_SIZE, 0, 0)!;
    this.groundLayer = this.tilemap.createLayer(0, tileset, 0, 0)!;
    this.groundLayer.setDepth(0);
    this.groundLayer.setCollision(WALL);

    // Add decorative text labels on the ground
    const labelStyle = {
      fontFamily: 'monospace',
      fontSize: '7px',
      color: '#aa8844',
      stroke: '#5c3a1e',
      strokeThickness: 1,
    };

    this.add.text(5 * TILE_SIZE, 3 * TILE_SIZE, 'VAULT', labelStyle).setDepth(1);
    this.add.text(22 * TILE_SIZE, 3 * TILE_SIZE, 'SHOP', labelStyle).setDepth(1);
    this.add.text(13 * TILE_SIZE, 2 * TILE_SIZE, 'REALM PORTALS', labelStyle).setDepth(1);
    this.add.text(11.5 * TILE_SIZE, NEXUS_HEIGHT * TILE_SIZE - 24, 'ASGARD — Realm of the Gods', {
      ...labelStyle,
      fontSize: '9px',
      color: '#ddaa44',
    }).setDepth(1);
  }

  // ========================================================================
  // NPCs
  // ========================================================================

  private placeNPCs(): void {
    // Vault Keeper (left wing)
    this.createNPC(5 * TILE_SIZE, 12 * TILE_SIZE, 'Bragi the Keeper', 'vault', 0x44aaff);

    // Shop Keeper (right wing)
    this.createNPC(24 * TILE_SIZE, 12 * TILE_SIZE, 'Idunn the Merchant', 'shop', 0x44ff44);

    // Realm Portal (center, slightly up from spawn)
    this.createRealmPortal(15 * TILE_SIZE, 7 * TILE_SIZE);
  }

  private createNPC(x: number, y: number, name: string, type: NPC['type'], tint: number): void {
    // NPC sprite — use player sprite with different tint
    const sprite = this.physics.add.sprite(x, y, 'player');
    sprite.setDepth(5);
    sprite.setTint(tint);
    sprite.setImmovable(true);
    sprite.body!.setSize(14, 14);

    const label = this.add.text(x, y - 14, name, {
      fontFamily: 'monospace',
      fontSize: '7px',
      color: '#ddaa44',
      stroke: '#000',
      strokeThickness: 2,
    }).setOrigin(0.5).setDepth(50);

    this.npcs.push({
      sprite,
      name,
      type,
      label,
      interactionRadius: 40,
    });

    // Collision with player
    this.physics.add.collider(this.player, sprite);
  }

  private createRealmPortal(x: number, y: number): void {
    const portal = this.physics.add.sprite(x, y, 'portal');
    portal.setDepth(8);
    portal.setScale(1.5);
    portal.setImmovable(true);

    // Pulsing
    this.tweens.add({
      targets: portal,
      scaleX: 1.8,
      scaleY: 1.8,
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    const label = this.add.text(x, y + 18, 'Enter Midgard', {
      fontFamily: 'monospace',
      fontSize: '8px',
      color: '#cc88ff',
      stroke: '#000',
      strokeThickness: 2,
    }).setOrigin(0.5).setDepth(50);

    this.npcs.push({
      sprite: portal,
      name: 'Bifrost Portal',
      type: 'realm',
      label,
      interactionRadius: 30,
    });
  }

  // ========================================================================
  // INTERACTION
  // ========================================================================

  private checkNPCProximity(): void {
    let nearestNPC: NPC | null = null;
    let nearestDist = Infinity;

    for (const npc of this.npcs) {
      const dx = this.player.x - npc.sprite.x;
      const dy = this.player.y - npc.sprite.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < npc.interactionRadius && dist < nearestDist) {
        nearestNPC = npc;
        nearestDist = dist;
      }
    }

    if (nearestNPC && !this.panelOpen) {
      const prompt = nearestNPC.type === 'realm' ? 'Press E to enter' : `Press E to talk to ${nearestNPC.name}`;
      this.interactPrompt!.setText(prompt);
      this.interactPrompt!.setPosition(nearestNPC.sprite.x, nearestNPC.sprite.y - 24);
      this.interactPrompt!.setVisible(true);
    } else {
      this.interactPrompt!.setVisible(false);
    }
  }

  private tryInteract(): void {
    for (const npc of this.npcs) {
      const dx = this.player.x - npc.sprite.x;
      const dy = this.player.y - npc.sprite.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < npc.interactionRadius) {
        switch (npc.type) {
          case 'vault':
            this.openVaultPanel();
            break;
          case 'shop':
            this.openShopPanel();
            break;
          case 'realm':
            this.enterMidgard();
            break;
        }
        return;
      }
    }
  }

  // ========================================================================
  // VAULT
  // ========================================================================

  private openVaultPanel(): void {
    this.panelOpen = true;
    this.activePanel = this.add.container(0, 0).setDepth(200).setScrollFactor(0);

    const pw = 300, ph = 240;
    const px = (this.cameras.main.width - pw) / 2;
    const py = (this.cameras.main.height - ph) / 2;

    // Background
    const bg = this.add.graphics().setScrollFactor(0);
    bg.fillStyle(0x3d2410); bg.fillRect(px, py, pw, ph);
    bg.fillStyle(0x5c3a1e); bg.fillRect(px + 2, py + 2, pw - 4, ph - 4);
    bg.fillStyle(0xdec9a0, 0.9); bg.fillRect(px + 4, py + 4, pw - 8, ph - 8);
    this.activePanel.add(bg);

    this.activePanel.add(this.add.text(px + pw / 2, py + 12, 'Bragi\'s Vault', {
      fontFamily: 'monospace', fontSize: '12px', color: '#ddaa44',
    }).setOrigin(0.5).setScrollFactor(0));

    this.activePanel.add(this.add.text(px + pw / 2, py + 26, `Stored Gold: ${this.vault.gold}`, {
      fontFamily: 'monospace', fontSize: '9px', color: '#aa8844',
    }).setOrigin(0.5).setScrollFactor(0));

    // Vault slots (4x4 grid)
    const ss = 32, sg = 4;
    const startX = px + 12, startY = py + 42;

    for (let i = 0; i < this.maxVaultSlots; i++) {
      const col = i % 4, row = Math.floor(i / 4);
      const sx = startX + col * (ss + sg);
      const sy = startY + row * (ss + sg);

      bg.fillStyle(0x8b6b3d); bg.fillRect(sx, sy, ss, ss);
      bg.fillStyle(0xc4a87a); bg.fillRect(sx + 1, sy + 1, ss - 2, ss - 2);

      const vaultItem = this.vault.items[i];
      if (vaultItem && vaultItem.itemId) {
        const item = getItem(vaultItem.itemId);
        if (item) {
          const ig = this.add.graphics().setScrollFactor(0);
          ig.fillStyle(item.spriteColor); ig.fillRect(sx + 4, sy + 4, ss - 8, ss - 8);
          ig.fillStyle(item.spriteAccent); ig.fillRect(sx + 8, sy + 8, ss - 16, ss - 16);
          this.activePanel.add(ig);

          if (vaultItem.quantity > 1) {
            this.activePanel.add(this.add.text(sx + ss - 3, sy + ss - 3, `${vaultItem.quantity}`, {
              fontFamily: 'monospace', fontSize: '8px', color: '#f0e4cc',
              stroke: '#000', strokeThickness: 2,
            }).setOrigin(1, 1).setScrollFactor(0));
          }
        }
      }
    }

    this.activePanel.add(this.add.text(px + pw / 2, py + ph - 20, 'Items here survive death!', {
      fontFamily: 'monospace', fontSize: '8px', color: '#44aa44',
    }).setOrigin(0.5).setScrollFactor(0));

    this.activePanel.add(this.add.text(px + pw / 2, py + ph - 8, 'Press E or ESC to close', {
      fontFamily: 'monospace', fontSize: '7px', color: '#8b6b3d',
    }).setOrigin(0.5).setScrollFactor(0));
  }

  // ========================================================================
  // SHOP
  // ========================================================================

  private openShopPanel(): void {
    this.panelOpen = true;
    this.activePanel = this.add.container(0, 0).setDepth(200).setScrollFactor(0);

    const pw = 280, ph = 220;
    const px = (this.cameras.main.width - pw) / 2;
    const py = (this.cameras.main.height - ph) / 2;

    const bg = this.add.graphics().setScrollFactor(0);
    bg.fillStyle(0x3d2410); bg.fillRect(px, py, pw, ph);
    bg.fillStyle(0x5c3a1e); bg.fillRect(px + 2, py + 2, pw - 4, ph - 4);
    bg.fillStyle(0xdec9a0, 0.9); bg.fillRect(px + 4, py + 4, pw - 8, ph - 8);
    this.activePanel.add(bg);

    this.activePanel.add(this.add.text(px + pw / 2, py + 12, 'Idunn\'s Shop', {
      fontFamily: 'monospace', fontSize: '12px', color: '#ddaa44',
    }).setOrigin(0.5).setScrollFactor(0));

    // Shop items
    const shopItems = [
      { itemId: 'potion_hp_small', price: 10, name: 'Mead Flask' },
      { itemId: 'potion_mp_small', price: 10, name: 'Seidr Tonic' },
      { itemId: 'potion_hp_large', price: 50, name: 'Greater Mead' },
      { itemId: 'sword_t3', price: 200, name: 'Bronze Blade' },
      { itemId: 'armor_heavy_t0', price: 100, name: 'Chainmail' },
      { itemId: 'ring_t0', price: 75, name: 'Iron Band' },
    ];

    let y = py + 32;
    for (const shopItem of shopItems) {
      const item = getItem(shopItem.itemId);
      if (!item) continue;

      // Item icon
      const ig = this.add.graphics().setScrollFactor(0);
      ig.fillStyle(item.spriteColor); ig.fillRect(px + 12, y, 20, 20);
      ig.fillStyle(item.spriteAccent); ig.fillRect(px + 16, y + 4, 12, 12);
      this.activePanel.add(ig);

      // Item name
      this.activePanel.add(this.add.text(px + 38, y + 2, shopItem.name, {
        fontFamily: 'monospace', fontSize: '9px', color: '#3d2410',
      }).setScrollFactor(0));

      // Price
      this.activePanel.add(this.add.text(px + 38, y + 12, `${shopItem.price} gold`, {
        fontFamily: 'monospace', fontSize: '8px', color: '#aa8844',
      }).setScrollFactor(0));

      // Buy button (TODO: make interactive in future — for now just display)
      this.activePanel.add(this.add.text(px + pw - 50, y + 5, '[BUY]', {
        fontFamily: 'monospace', fontSize: '9px', color: '#44aa44',
        stroke: '#000', strokeThickness: 1,
      }).setScrollFactor(0));

      y += 28;
    }

    this.activePanel.add(this.add.text(px + pw / 2, py + ph - 8, 'Press E or ESC to close', {
      fontFamily: 'monospace', fontSize: '7px', color: '#8b6b3d',
    }).setOrigin(0.5).setScrollFactor(0));
  }

  // ========================================================================
  // REALM ENTRY
  // ========================================================================

  private enterMidgard(): void {
    this.events.emit('notification', 'Traveling to Midgard...', '#cc88ff');

    // Fade out and start GameScene — pass classId so class is preserved
    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.time.delayedCall(500, () => {
      this.scene.stop('NexusScene');
      this.scene.start('GameScene', { classId: this.classId });
      if (!this.scene.isActive('UIScene')) {
        this.scene.launch('UIScene');
      }
    });
  }

  // ========================================================================
  // PANEL MANAGEMENT
  // ========================================================================

  private closePanel(): void {
    if (this.activePanel) {
      this.activePanel.destroy(true);
      this.activePanel = null;
    }
    this.panelOpen = false;
  }

  // ========================================================================
  // VAULT PERSISTENCE
  // ========================================================================

  private loadVault(): void {
    try {
      const saved = localStorage.getItem('yggdrasil_vault');
      if (saved) {
        this.vault = JSON.parse(saved);
      } else {
        this.vault = { items: [], gold: 0 };
        // Initialize empty slots
        for (let i = 0; i < this.maxVaultSlots; i++) {
          this.vault.items.push({ itemId: '', quantity: 0 });
        }
      }
    } catch {
      this.vault = { items: [], gold: 0 };
      for (let i = 0; i < this.maxVaultSlots; i++) {
        this.vault.items.push({ itemId: '', quantity: 0 });
      }
    }
  }

  private saveVault(): void {
    try {
      localStorage.setItem('yggdrasil_vault', JSON.stringify(this.vault));
    } catch {
      // localStorage might be full
    }
  }

  /** Deposit an item into the vault */
  depositItem(itemId: string, quantity: number = 1): boolean {
    for (const slot of this.vault.items) {
      if (!slot.itemId || slot.itemId === '') {
        slot.itemId = itemId;
        slot.quantity = quantity;
        this.saveVault();
        return true;
      }
    }
    return false; // vault full
  }

  /** Withdraw an item from the vault */
  withdrawItem(slotIndex: number): { itemId: string; quantity: number } | null {
    const slot = this.vault.items[slotIndex];
    if (!slot || !slot.itemId || slot.itemId === '') return null;

    const result = { itemId: slot.itemId, quantity: slot.quantity };
    slot.itemId = '';
    slot.quantity = 0;
    this.saveVault();
    return result;
  }

  /** Deposit gold */
  depositGold(amount: number): void {
    this.vault.gold += amount;
    this.saveVault();
  }

  // ========================================================================
  // HELPERS
  // ========================================================================

  private emitPlayerData(): void {
    // Emit actual player data for the UI bars (preserved from GameScene)
    this.events.emit('playerUpdate', {
      hp: this.playerHp,
      maxHp: this.playerMaxHp,
      mp: this.playerMp,
      maxMp: this.playerMaxMp,
      level: this.playerLevel,
      xp: this.playerXp,
      xpToNext: this.playerXpToNext,
      gold: this.playerGold,
    });
  }
}
