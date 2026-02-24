import Phaser from 'phaser';
import { ItemRarity, LootBagTier } from '@yggdrasil/shared';
import { GameItem, getItem, ITEM_DATABASE } from '../data/ItemDatabase';
import { randomFloat, randomInt } from '../utils/MathUtils';

/**
 * LootManager: Handles loot bag spawning, display, and pickup.
 *
 * When enemies die, a loot bag is spawned containing rolled items.
 * Bag color matches the best item rarity inside (RotMG style).
 * Bags despawn after 30 seconds. Walk over to pick up.
 */

export interface LootBag {
  sprite: Phaser.Physics.Arcade.Sprite;
  items: { itemId: string; quantity: number }[];
  spawnTime: number;
  tier: LootBagTier;
}

// Loot tables by enemy difficulty
const LOOT_TABLES: Record<string, { itemId: string; chance: number; min: number; max: number }[]> = {
  low: [
    { itemId: 'potion_hp_small', chance: 0.3, min: 1, max: 2 },
    { itemId: 'potion_mp_small', chance: 0.15, min: 1, max: 1 },
  ],
  mid: [
    { itemId: 'potion_hp_small', chance: 0.4, min: 1, max: 3 },
    { itemId: 'potion_mp_small', chance: 0.2, min: 1, max: 2 },
    { itemId: 'potion_hp_large', chance: 0.1, min: 1, max: 1 },
    { itemId: 'sword_t3', chance: 0.05, min: 1, max: 1 },
    { itemId: 'armor_heavy_t0', chance: 0.05, min: 1, max: 1 },
    { itemId: 'ring_t0', chance: 0.03, min: 1, max: 1 },
    { itemId: 'rune_speed', chance: 0.02, min: 1, max: 1 },
    { itemId: 'rune_dexterity', chance: 0.02, min: 1, max: 1 },
  ],
  high: [
    { itemId: 'potion_hp_large', chance: 0.3, min: 1, max: 2 },
    { itemId: 'potion_mp_small', chance: 0.2, min: 1, max: 2 },
    { itemId: 'sword_t6', chance: 0.04, min: 1, max: 1 },
    { itemId: 'staff_t5', chance: 0.04, min: 1, max: 1 },
    { itemId: 'bow_t5', chance: 0.04, min: 1, max: 1 },
    { itemId: 'armor_heavy_t5', chance: 0.03, min: 1, max: 1 },
    { itemId: 'ring_t4', chance: 0.02, min: 1, max: 1 },
    { itemId: 'rune_attack', chance: 0.05, min: 1, max: 1 },
    { itemId: 'rune_defense', chance: 0.05, min: 1, max: 1 },
    { itemId: 'rune_life', chance: 0.04, min: 1, max: 1 },
    { itemId: 'rune_mana', chance: 0.04, min: 1, max: 1 },
    { itemId: 'rune_vitality', chance: 0.04, min: 1, max: 1 },
    { itemId: 'rune_wisdom', chance: 0.04, min: 1, max: 1 },
  ],
  godlands: [
    { itemId: 'potion_hp_large', chance: 0.4, min: 1, max: 3 },
    { itemId: 'sword_t10', chance: 0.01, min: 1, max: 1 },
    { itemId: 'rune_attack', chance: 0.1, min: 1, max: 1 },
    { itemId: 'rune_defense', chance: 0.1, min: 1, max: 1 },
    { itemId: 'rune_life', chance: 0.08, min: 1, max: 1 },
    { itemId: 'rune_mana', chance: 0.08, min: 1, max: 1 },
    { itemId: 'rune_speed', chance: 0.08, min: 1, max: 1 },
    { itemId: 'rune_dexterity', chance: 0.08, min: 1, max: 1 },
    { itemId: 'rune_vitality', chance: 0.08, min: 1, max: 1 },
    { itemId: 'rune_wisdom', chance: 0.08, min: 1, max: 1 },
  ],
};

const BAG_LIFETIME = 30000; // 30 seconds

export class LootManager {
  private scene: Phaser.Scene;
  private bags: LootBag[] = [];
  private bagGroup: Phaser.Physics.Arcade.Group;

  // Callbacks
  private onBagPickedUp: ((items: { itemId: string; quantity: number }[]) => void)[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.bagGroup = scene.physics.add.group();
  }

  onPickup(callback: (items: { itemId: string; quantity: number }[]) => void): void {
    this.onBagPickedUp.push(callback);
  }

  /** Roll loot and spawn a bag at position */
  spawnLootBag(x: number, y: number, difficulty: number): void {
    // Select loot table based on difficulty
    let tableKey = 'low';
    if (difficulty >= 8) tableKey = 'godlands';
    else if (difficulty >= 5) tableKey = 'high';
    else if (difficulty >= 3) tableKey = 'mid';

    const table = LOOT_TABLES[tableKey];
    const items: { itemId: string; quantity: number }[] = [];

    for (const entry of table) {
      if (Math.random() < entry.chance) {
        items.push({
          itemId: entry.itemId,
          quantity: randomInt(entry.min, entry.max),
        });
      }
    }

    if (items.length === 0) return; // no loot rolled

    // Determine bag tier based on best item
    const tier = this.getBagTier(items);
    const textureKey = this.getBagTexture(tier);

    const sprite = this.scene.physics.add.sprite(x, y, textureKey);
    sprite.setDepth(3);
    sprite.body!.setSize(8, 8);
    this.bagGroup.add(sprite);

    // Floating animation
    this.scene.tweens.add({
      targets: sprite,
      y: y - 3,
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.bags.push({
      sprite,
      items,
      spawnTime: this.scene.time.now,
      tier,
    });
  }

  /** Spawn a loot bag with specific items (used for boss drops) */
  spawnLootBagWithItems(x: number, y: number, items: { itemId: string; quantity: number }[]): void {
    if (items.length === 0) return;

    const tier = this.getBagTier(items);
    const textureKey = this.getBagTexture(tier);

    const sprite = this.scene.physics.add.sprite(x, y, textureKey);
    sprite.setDepth(3);
    sprite.body!.setSize(8, 8);
    this.bagGroup.add(sprite);

    this.scene.tweens.add({
      targets: sprite,
      y: y - 3,
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.bags.push({
      sprite,
      items,
      spawnTime: this.scene.time.now,
      tier,
    });
  }

  update(dt: number, playerX: number, playerY: number): void {
    const now = this.scene.time.now;

    for (let i = this.bags.length - 1; i >= 0; i--) {
      const bag = this.bags[i];

      // Despawn expired bags
      if (now - bag.spawnTime > BAG_LIFETIME) {
        bag.sprite.destroy();
        this.bags.splice(i, 1);
        continue;
      }

      // Auto-pickup when player walks over
      const dx = bag.sprite.x - playerX;
      const dy = bag.sprite.y - playerY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 20) {
        // Pickup!
        this.onBagPickedUp.forEach(cb => cb(bag.items));
        bag.sprite.destroy();
        this.bags.splice(i, 1);
      }
    }
  }

  private getBagTier(items: { itemId: string; quantity: number }[]): LootBagTier {
    let bestRarity = ItemRarity.Common;
    for (const { itemId } of items) {
      const item = getItem(itemId);
      if (!item) continue;
      if (this.rarityRank(item.rarity) > this.rarityRank(bestRarity)) {
        bestRarity = item.rarity;
      }
    }
    switch (bestRarity) {
      case ItemRarity.Mythic: return LootBagTier.Orange;
      case ItemRarity.Legendary: return LootBagTier.White;
      case ItemRarity.Rare: return LootBagTier.Cyan;
      case ItemRarity.Uncommon: return LootBagTier.Purple;
      default: return LootBagTier.Brown;
    }
  }

  private rarityRank(r: ItemRarity): number {
    switch (r) {
      case ItemRarity.Common: return 0;
      case ItemRarity.Uncommon: return 1;
      case ItemRarity.Rare: return 2;
      case ItemRarity.Legendary: return 3;
      case ItemRarity.Mythic: return 4;
    }
  }

  private getBagTexture(tier: LootBagTier): string {
    switch (tier) {
      case LootBagTier.Orange: return 'lootbag_orange';
      case LootBagTier.White: return 'lootbag_white';
      case LootBagTier.Cyan: return 'lootbag_cyan';
      case LootBagTier.Purple: return 'lootbag_purple';
      default: return 'lootbag_brown';
    }
  }
}
