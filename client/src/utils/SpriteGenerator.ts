import Phaser from 'phaser';

/**
 * Generates all placeholder pixel art textures programmatically.
 * No external art files needed — everything is drawn to Canvas textures.
 *
 * Sprite sizes follow RotMG conventions:
 *   - Player: 16x16
 *   - Enemies: 8x8 (small), 16x16 (normal), 24x24 (boss)
 *   - Projectiles: 4x4 to 8x8
 *   - Tiles: 16x16
 *   - Loot bags: 8x8
 */
export class SpriteGenerator {

  static generateAll(scene: Phaser.Scene): void {
    this.generatePlayerSprite(scene);
    this.generateProjectileSprites(scene);
    this.generateEnemySprites(scene);
    this.generateTileSprites(scene);
    this.generateLootBagSprites(scene);
    this.generatePortalSprite(scene);
    this.generateCrosshairSprite(scene);
  }

  // --- Player: 16x16 Viking warrior ---
  static generatePlayerSprite(scene: Phaser.Scene): void {
    const g = scene.add.graphics();
    const s = 16;

    // Body (blue tunic)
    g.fillStyle(0x4466aa);
    g.fillRect(4, 5, 8, 7);

    // Head (skin)
    g.fillStyle(0xddaa77);
    g.fillRect(5, 1, 6, 5);

    // Helmet (grey)
    g.fillStyle(0x888899);
    g.fillRect(4, 0, 8, 3);

    // Helmet horns
    g.fillStyle(0xccccaa);
    g.fillRect(3, 0, 1, 2);
    g.fillRect(12, 0, 1, 2);

    // Eyes
    g.fillStyle(0x222222);
    g.fillRect(6, 3, 1, 1);
    g.fillRect(9, 3, 1, 1);

    // Legs (brown)
    g.fillStyle(0x664422);
    g.fillRect(5, 12, 3, 4);
    g.fillRect(8, 12, 3, 4);

    // Arms
    g.fillStyle(0xddaa77);
    g.fillRect(2, 6, 2, 4);
    g.fillRect(12, 6, 2, 4);

    g.generateTexture('player', s, s);
    g.destroy();
  }

  // --- Projectiles ---
  static generateProjectileSprites(scene: Phaser.Scene): void {
    // Player projectile (bright yellow-white bolt)
    const pg = scene.add.graphics();
    pg.fillStyle(0xffffaa);
    pg.fillRect(1, 1, 4, 4);
    pg.fillStyle(0xffffff);
    pg.fillRect(2, 2, 2, 2);
    pg.generateTexture('projectile_player', 6, 6);
    pg.destroy();

    // Enemy projectile (red)
    const eg = scene.add.graphics();
    eg.fillStyle(0xff4444);
    eg.fillRect(1, 1, 4, 4);
    eg.fillStyle(0xff8888);
    eg.fillRect(2, 2, 2, 2);
    eg.generateTexture('projectile_enemy', 6, 6);
    eg.destroy();

    // Enemy projectile (purple)
    const eg2 = scene.add.graphics();
    eg2.fillStyle(0xaa44ff);
    eg2.fillRect(1, 1, 4, 4);
    eg2.fillStyle(0xcc88ff);
    eg2.fillRect(2, 2, 2, 2);
    eg2.generateTexture('projectile_enemy_purple', 6, 6);
    eg2.destroy();

    // Enemy projectile (green / poison)
    const eg3 = scene.add.graphics();
    eg3.fillStyle(0x44ff44);
    eg3.fillRect(1, 1, 4, 4);
    eg3.fillStyle(0x88ff88);
    eg3.fillRect(2, 2, 2, 2);
    eg3.generateTexture('projectile_enemy_green', 6, 6);
    eg3.destroy();
  }

  // --- Enemies ---
  static generateEnemySprites(scene: Phaser.Scene): void {
    // Small enemy 8x8 (Draugr — undead warrior, grey/green)
    const e1 = scene.add.graphics();
    e1.fillStyle(0x556655);
    e1.fillRect(1, 0, 6, 4); // body
    e1.fillStyle(0x88aa88);
    e1.fillRect(2, 0, 4, 3); // head
    e1.fillStyle(0xff2222);
    e1.fillRect(3, 1, 1, 1); // eye
    e1.fillRect(5, 1, 1, 1); // eye
    e1.fillStyle(0x445544);
    e1.fillRect(2, 4, 2, 4); // legs
    e1.fillRect(5, 4, 2, 4);
    e1.generateTexture('enemy_small', 8, 8);
    e1.destroy();

    // Medium enemy 16x16 (Frost Troll — blue/white)
    const e2 = scene.add.graphics();
    e2.fillStyle(0x6688bb);
    e2.fillRect(3, 3, 10, 8); // body
    e2.fillStyle(0x88aadd);
    e2.fillRect(4, 0, 8, 5);  // head
    e2.fillStyle(0xff3333);
    e2.fillRect(6, 2, 1, 1);  // eye
    e2.fillRect(9, 2, 1, 1);  // eye
    e2.fillStyle(0x5577aa);
    e2.fillRect(0, 5, 3, 5);  // left arm
    e2.fillRect(13, 5, 3, 5); // right arm
    e2.fillStyle(0x4466aa);
    e2.fillRect(4, 11, 4, 5); // legs
    e2.fillRect(8, 11, 4, 5);
    e2.generateTexture('enemy_medium', 16, 16);
    e2.destroy();

    // Boss enemy 24x24 (Fire Giant — red/orange)
    const e3 = scene.add.graphics();
    e3.fillStyle(0xcc4411);
    e3.fillRect(4, 5, 16, 12); // body
    e3.fillStyle(0xdd6633);
    e3.fillRect(6, 0, 12, 7);  // head
    e3.fillStyle(0xffff00);
    e3.fillRect(9, 3, 2, 2);   // eye
    e3.fillRect(14, 3, 2, 2);  // eye
    e3.fillStyle(0xaa3300);
    e3.fillRect(0, 7, 4, 8);   // left arm
    e3.fillRect(20, 7, 4, 8);  // right arm
    e3.fillStyle(0x882200);
    e3.fillRect(6, 17, 5, 7);  // legs
    e3.fillRect(13, 17, 5, 7);
    // Crown/horns
    e3.fillStyle(0xffaa00);
    e3.fillRect(6, 0, 2, 2);
    e3.fillRect(16, 0, 2, 2);
    e3.generateTexture('enemy_boss', 24, 24);
    e3.destroy();
  }

  // --- Tileset: 16x16 tiles ---
  static generateTileSprites(scene: Phaser.Scene): void {
    const TILE_SIZE = 16;
    const TILES_PER_ROW = 8;
    const TOTAL_TILES = 16;
    const width = TILES_PER_ROW * TILE_SIZE;
    const height = Math.ceil(TOTAL_TILES / TILES_PER_ROW) * TILE_SIZE;

    const g = scene.add.graphics();

    // Helper to draw a tile at grid position
    const drawTile = (index: number, baseColor: number, detailColor: number, hasDetail: boolean) => {
      const tx = (index % TILES_PER_ROW) * TILE_SIZE;
      const ty = Math.floor(index / TILES_PER_ROW) * TILE_SIZE;

      g.fillStyle(baseColor);
      g.fillRect(tx, ty, TILE_SIZE, TILE_SIZE);

      if (hasDetail) {
        g.fillStyle(detailColor);
        // Scatter some detail pixels
        for (let i = 0; i < 6; i++) {
          const dx = ((index * 7 + i * 13) % 14) + 1;
          const dy = ((index * 11 + i * 7) % 14) + 1;
          g.fillRect(tx + dx, ty + dy, 1, 1);
        }
      }
    };

    // Tile 0: Void/empty (black)
    drawTile(0, 0x000000, 0x000000, false);

    // Tile 1: Frozen Shore ground (icy blue-grey)
    drawTile(1, 0xc8dbe5, 0xb0c8d5, true);

    // Tile 2: Frozen Shore ice wall
    drawTile(2, 0x6a8fa3, 0x5a7f93, true);

    // Tile 3: Birch Forest ground (green)
    drawTile(3, 0x7a9b5a, 0x6a8b4a, true);

    // Tile 4: Birch Forest tree/wall (dark green)
    drawTile(4, 0x3d5228, 0x2d4218, true);

    // Tile 5: Volcanic Wastes ground (dark brown)
    drawTile(5, 0x5c3a2e, 0x4c2a1e, true);

    // Tile 6: Volcanic Wastes lava wall (red-orange)
    drawTile(6, 0x8b2500, 0xbb4500, true);

    // Tile 7: Niflheim ground (dark purple)
    drawTile(7, 0x1a1a2e, 0x2a2a3e, true);

    // Tile 8: Niflheim wall (black)
    drawTile(8, 0x0d0d15, 0x1d1d25, true);

    // Tile 9: Asgard ground (gold/white)
    drawTile(9, 0xddc088, 0xcdb078, true);

    // Tile 10: Asgard wall (golden)
    drawTile(10, 0xaa8844, 0x997733, true);

    // Tile 11: Water (blue)
    drawTile(11, 0x3355aa, 0x4466bb, true);

    // Tile 12: Snow (white)
    drawTile(12, 0xeeeeff, 0xddddee, true);

    // Tile 13: Path/road (light brown)
    drawTile(13, 0xaa9977, 0x998866, true);

    // Tile 14: Bridge (wood)
    drawTile(14, 0x886633, 0x775522, true);

    // Tile 15: Decoration (rune stone marker)
    drawTile(15, 0x555566, 0x8888ff, true);

    g.generateTexture('tileset', width, height);
    g.destroy();
  }

  // --- Loot bags ---
  static generateLootBagSprites(scene: Phaser.Scene): void {
    const bags: [string, number, number][] = [
      ['lootbag_brown',  0x885533, 0xaa7744],
      ['lootbag_purple', 0x8844aa, 0xaa66cc],
      ['lootbag_cyan',   0x44aacc, 0x66ccee],
      ['lootbag_white',  0xcccccc, 0xffffff],
      ['lootbag_orange', 0xdd8800, 0xffaa22],
    ];

    for (const [key, bodyColor, topColor] of bags) {
      const g = scene.add.graphics();
      // Bag body
      g.fillStyle(bodyColor);
      g.fillRect(1, 3, 6, 5);
      // Bag top (tied)
      g.fillStyle(topColor);
      g.fillRect(2, 1, 4, 3);
      // Tie
      g.fillStyle(0x000000);
      g.fillRect(3, 2, 2, 1);
      g.generateTexture(key, 8, 8);
      g.destroy();
    }
  }

  // --- Dungeon portal ---
  static generatePortalSprite(scene: Phaser.Scene): void {
    const g = scene.add.graphics();
    // Outer ring (purple)
    g.fillStyle(0x6622aa);
    g.fillRect(2, 0, 12, 16);
    g.fillRect(0, 2, 16, 12);
    // Inner void (dark)
    g.fillStyle(0x110033);
    g.fillRect(4, 2, 8, 12);
    g.fillRect(2, 4, 12, 8);
    // Sparkle
    g.fillStyle(0xcc88ff);
    g.fillRect(7, 5, 2, 2);
    g.fillRect(5, 8, 2, 2);
    g.fillRect(9, 9, 2, 2);
    g.generateTexture('portal', 16, 16);
    g.destroy();
  }

  // --- Crosshair ---
  static generateCrosshairSprite(scene: Phaser.Scene): void {
    const g = scene.add.graphics();
    g.fillStyle(0xffffff, 0.7);
    // Horizontal line
    g.fillRect(0, 5, 4, 2);
    g.fillRect(8, 5, 4, 2);
    // Vertical line
    g.fillRect(5, 0, 2, 4);
    g.fillRect(5, 8, 2, 4);
    // Center dot
    g.fillStyle(0xff4444, 0.9);
    g.fillRect(5, 5, 2, 2);
    g.generateTexture('crosshair', 12, 12);
    g.destroy();
  }
}
