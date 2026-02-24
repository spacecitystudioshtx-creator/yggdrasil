import { ItemType, ItemSlot, ItemRarity, StatType, WeaponType, ArmorType } from '@yggdrasil/shared';

/**
 * Item definition for the game.
 * Covers weapons, abilities, armor, rings, consumables, and stat potions (Rune Stones).
 */
export interface GameItem {
  id: string;
  name: string;
  description: string;
  type: ItemType;
  slot?: ItemSlot;
  rarity: ItemRarity;
  tier: number;            // T0-T12 for tiered, -1 for UT

  // Stat bonuses when equipped
  statBonuses?: Partial<Record<StatType, number>>;

  // Weapon stats
  weaponType?: WeaponType;
  damage?: number;
  rateOfFire?: number;     // attacks per second
  range?: number;          // tile distance
  numProjectiles?: number;
  spreadAngle?: number;    // degrees

  // Armor
  armorType?: ArmorType;

  // Consumable
  hpRestore?: number;
  mpRestore?: number;
  statBoost?: { stat: StatType; amount: number };

  // Economy
  sellValue: number;

  // Visual
  spriteColor: number;     // hex color for inventory icon
  spriteAccent: number;    // accent color
  stackable: boolean;
  maxStack: number;
}

// ============================================================================
// ITEM DATABASE — Norse mythology themed
// ============================================================================

export const ITEM_DATABASE: Record<string, GameItem> = {

  // ---- SWORDS (Viking, Shieldmaiden, Rune Knight) ----
  'sword_t0': {
    id: 'sword_t0', name: 'Rusty Blade', description: 'A dull iron sword. Better than fists.',
    type: ItemType.Weapon, slot: ItemSlot.Weapon, rarity: ItemRarity.Common, tier: 0,
    weaponType: WeaponType.Sword, damage: 15, rateOfFire: 2.0, range: 4.5, numProjectiles: 1, spreadAngle: 0,
    sellValue: 5, spriteColor: 0x888888, spriteAccent: 0x664422, stackable: false, maxStack: 1,
  },
  'sword_t3': {
    id: 'sword_t3', name: 'Iron Longsword', description: 'A sturdy blade forged by village smiths.',
    type: ItemType.Weapon, slot: ItemSlot.Weapon, rarity: ItemRarity.Common, tier: 3,
    weaponType: WeaponType.Sword, damage: 45, rateOfFire: 2.2, range: 5.0, numProjectiles: 1, spreadAngle: 0,
    statBonuses: { [StatType.Attack]: 2 },
    sellValue: 30, spriteColor: 0xaaaaaa, spriteAccent: 0x886633, stackable: false, maxStack: 1,
  },
  'sword_t6': {
    id: 'sword_t6', name: 'Rune-Etched Blade', description: 'Dwarven runes glow along the fuller.',
    type: ItemType.Weapon, slot: ItemSlot.Weapon, rarity: ItemRarity.Uncommon, tier: 6,
    weaponType: WeaponType.Sword, damage: 80, rateOfFire: 2.5, range: 5.5, numProjectiles: 1, spreadAngle: 0,
    statBonuses: { [StatType.Attack]: 4, [StatType.Dexterity]: 2 },
    sellValue: 120, spriteColor: 0xccccdd, spriteAccent: 0x4488ff, stackable: false, maxStack: 1,
  },
  'sword_t10': {
    id: 'sword_t10', name: 'Gram, Dragon-Slayer', description: 'The legendary blade that slew Fafnir.',
    type: ItemType.Weapon, slot: ItemSlot.Weapon, rarity: ItemRarity.Rare, tier: 10,
    weaponType: WeaponType.Sword, damage: 140, rateOfFire: 3.0, range: 6.0, numProjectiles: 1, spreadAngle: 0,
    statBonuses: { [StatType.Attack]: 7, [StatType.Dexterity]: 4, [StatType.Speed]: 2 },
    sellValue: 500, spriteColor: 0xffffff, spriteAccent: 0xff4444, stackable: false, maxStack: 1,
  },

  // ---- STAVES (Runemaster, Seidkona) ----
  'staff_t0': {
    id: 'staff_t0', name: 'Gnarled Branch', description: 'A crooked stick that channels weak magic.',
    type: ItemType.Weapon, slot: ItemSlot.Weapon, rarity: ItemRarity.Common, tier: 0,
    weaponType: WeaponType.Staff, damage: 20, rateOfFire: 1.5, range: 7.0, numProjectiles: 1, spreadAngle: 0,
    sellValue: 5, spriteColor: 0x664422, spriteAccent: 0x88ff88, stackable: false, maxStack: 1,
  },
  'staff_t5': {
    id: 'staff_t5', name: 'Seidr Staff', description: 'Carved from Yggdrasil bark. Hums with power.',
    type: ItemType.Weapon, slot: ItemSlot.Weapon, rarity: ItemRarity.Uncommon, tier: 5,
    weaponType: WeaponType.Staff, damage: 65, rateOfFire: 1.8, range: 8.0, numProjectiles: 2, spreadAngle: 10,
    statBonuses: { [StatType.Attack]: 3, [StatType.Wisdom]: 3 },
    sellValue: 80, spriteColor: 0x886644, spriteAccent: 0xaa44ff, stackable: false, maxStack: 1,
  },

  // ---- BOWS (Huntsman, Norn-Blessed) ----
  'bow_t0': {
    id: 'bow_t0', name: 'Hunting Bow', description: 'A simple yew bow. Steady and true.',
    type: ItemType.Weapon, slot: ItemSlot.Weapon, rarity: ItemRarity.Common, tier: 0,
    weaponType: WeaponType.Bow, damage: 18, rateOfFire: 1.8, range: 8.0, numProjectiles: 1, spreadAngle: 0,
    sellValue: 5, spriteColor: 0x886633, spriteAccent: 0xdddddd, stackable: false, maxStack: 1,
  },
  'bow_t5': {
    id: 'bow_t5', name: 'Ull\'s Longbow', description: 'Blessed by the god of archery himself.',
    type: ItemType.Weapon, slot: ItemSlot.Weapon, rarity: ItemRarity.Uncommon, tier: 5,
    weaponType: WeaponType.Bow, damage: 55, rateOfFire: 2.0, range: 9.0, numProjectiles: 3, spreadAngle: 15,
    statBonuses: { [StatType.Dexterity]: 5 },
    sellValue: 80, spriteColor: 0xaa8844, spriteAccent: 0x44ccff, stackable: false, maxStack: 1,
  },

  // ---- AXES (Berserker, Huskarl) ----
  'axe_t0': {
    id: 'axe_t0', name: 'Woodcutter\'s Axe', description: 'Better for trees than trolls, but it works.',
    type: ItemType.Weapon, slot: ItemSlot.Weapon, rarity: ItemRarity.Common, tier: 0,
    weaponType: WeaponType.Axe, damage: 25, rateOfFire: 1.3, range: 3.5, numProjectiles: 1, spreadAngle: 0,
    sellValue: 5, spriteColor: 0x888888, spriteAccent: 0x664422, stackable: false, maxStack: 1,
  },

  // ---- SPEARS (Valkyrie) ----
  'spear_t0': {
    id: 'spear_t0', name: 'Ash Spear', description: 'A simple ash-wood spear. Good reach.',
    type: ItemType.Weapon, slot: ItemSlot.Weapon, rarity: ItemRarity.Common, tier: 0,
    weaponType: WeaponType.Spear, damage: 18, rateOfFire: 1.6, range: 6.0, numProjectiles: 1, spreadAngle: 0,
    sellValue: 5, spriteColor: 0xaa8855, spriteAccent: 0xcccccc, stackable: false, maxStack: 1,
  },
  'spear_t5': {
    id: 'spear_t5', name: 'Gungnir\'s Echo', description: 'Forged in the likeness of Odin\'s spear. Never misses its mark.',
    type: ItemType.Weapon, slot: ItemSlot.Weapon, rarity: ItemRarity.Uncommon, tier: 5,
    weaponType: WeaponType.Spear, damage: 60, rateOfFire: 1.8, range: 7.0, numProjectiles: 3, spreadAngle: 15,
    statBonuses: { [StatType.Attack]: 3, [StatType.Speed]: 2 },
    sellValue: 80, spriteColor: 0xddcc66, spriteAccent: 0xffee88, stackable: false, maxStack: 1,
  },

  // ---- WANDS (Skald) ----
  'wand_t0': {
    id: 'wand_t0', name: 'Birch Wand', description: 'A slender wand humming with faint seidr magic.',
    type: ItemType.Weapon, slot: ItemSlot.Weapon, rarity: ItemRarity.Common, tier: 0,
    weaponType: WeaponType.Wand, damage: 16, rateOfFire: 2.0, range: 7.5, numProjectiles: 1, spreadAngle: 0,
    sellValue: 5, spriteColor: 0x44ccaa, spriteAccent: 0x88ffdd, stackable: false, maxStack: 1,
  },
  'wand_t5': {
    id: 'wand_t5', name: 'Galdr Wand', description: 'Inscribed with incantations. Bolts seek their target.',
    type: ItemType.Weapon, slot: ItemSlot.Weapon, rarity: ItemRarity.Uncommon, tier: 5,
    weaponType: WeaponType.Wand, damage: 50, rateOfFire: 2.5, range: 8.5, numProjectiles: 2, spreadAngle: 8,
    statBonuses: { [StatType.Wisdom]: 4, [StatType.Attack]: 2 },
    sellValue: 80, spriteColor: 0x66ddbb, spriteAccent: 0xaaffee, stackable: false, maxStack: 1,
  },

  // ---- ARMOR ----
  'armor_heavy_t0': {
    id: 'armor_heavy_t0', name: 'Leather Hauberk', description: 'Basic leather armor. Smells of cattle.',
    type: ItemType.Armor, slot: ItemSlot.Armor, rarity: ItemRarity.Common, tier: 0, armorType: ArmorType.Heavy,
    statBonuses: { [StatType.Defense]: 3 },
    sellValue: 5, spriteColor: 0x885533, spriteAccent: 0x664422, stackable: false, maxStack: 1,
  },
  'armor_heavy_t5': {
    id: 'armor_heavy_t5', name: 'Chainmail Byrnie', description: 'Iron rings woven tight. Worthy of a huskarl.',
    type: ItemType.Armor, slot: ItemSlot.Armor, rarity: ItemRarity.Uncommon, tier: 5, armorType: ArmorType.Heavy,
    statBonuses: { [StatType.Defense]: 12, [StatType.Speed]: -2 },
    sellValue: 80, spriteColor: 0xaaaaaa, spriteAccent: 0x888888, stackable: false, maxStack: 1,
  },
  'armor_medium_t0': {
    id: 'armor_medium_t0', name: 'Ringmail Tunic', description: 'A vest of interlocking rings. Good balance of protection and mobility.',
    type: ItemType.Armor, slot: ItemSlot.Armor, rarity: ItemRarity.Common, tier: 0, armorType: ArmorType.Medium,
    statBonuses: { [StatType.Defense]: 2, [StatType.Speed]: 1 },
    sellValue: 5, spriteColor: 0xbb9944, spriteAccent: 0x997733, stackable: false, maxStack: 1,
  },
  'armor_medium_t5': {
    id: 'armor_medium_t5', name: 'Valkyrie\'s Breastplate', description: 'Blessed by the Valkyries. Light as feathers, strong as iron.',
    type: ItemType.Armor, slot: ItemSlot.Armor, rarity: ItemRarity.Uncommon, tier: 5, armorType: ArmorType.Medium,
    statBonuses: { [StatType.Defense]: 8, [StatType.Speed]: 2, [StatType.Vitality]: 3 },
    sellValue: 80, spriteColor: 0xddbb55, spriteAccent: 0xffdd77, stackable: false, maxStack: 1,
  },
  'armor_robe_t0': {
    id: 'armor_robe_t0', name: 'Woolen Robe', description: 'Warm but offers little protection.',
    type: ItemType.Armor, slot: ItemSlot.Armor, rarity: ItemRarity.Common, tier: 0, armorType: ArmorType.Robe,
    statBonuses: { [StatType.Defense]: 1, [StatType.Wisdom]: 2 },
    sellValue: 5, spriteColor: 0x4444aa, spriteAccent: 0x222266, stackable: false, maxStack: 1,
  },
  'armor_light_t0': {
    id: 'armor_light_t0', name: 'Hide Vest', description: 'Supple leather that doesn\'t slow you down.',
    type: ItemType.Armor, slot: ItemSlot.Armor, rarity: ItemRarity.Common, tier: 0, armorType: ArmorType.Light,
    statBonuses: { [StatType.Defense]: 2, [StatType.Speed]: 1 },
    sellValue: 5, spriteColor: 0x996644, spriteAccent: 0x775533, stackable: false, maxStack: 1,
  },

  // ---- RINGS ----
  'ring_t0': {
    id: 'ring_t0', name: 'Iron Band', description: 'A plain iron ring. Slightly lucky.',
    type: ItemType.Ring, slot: ItemSlot.Ring, rarity: ItemRarity.Common, tier: 0,
    statBonuses: { [StatType.Life]: 10 },
    sellValue: 5, spriteColor: 0x888888, spriteAccent: 0x666666, stackable: false, maxStack: 1,
  },
  'ring_t4': {
    id: 'ring_t4', name: 'Ring of Freya', description: 'A golden ring that pulses with vitality.',
    type: ItemType.Ring, slot: ItemSlot.Ring, rarity: ItemRarity.Uncommon, tier: 4,
    statBonuses: { [StatType.Life]: 40, [StatType.Vitality]: 3 },
    sellValue: 60, spriteColor: 0xddaa44, spriteAccent: 0xffcc66, stackable: false, maxStack: 1,
  },

  // ---- ABILITIES ----
  'ability_shield_t0': {
    id: 'ability_shield_t0', name: 'Wooden Shield', description: 'Hold SPACE to raise. Blocks some damage.',
    type: ItemType.Ability, slot: ItemSlot.Ability, rarity: ItemRarity.Common, tier: 0,
    statBonuses: { [StatType.Defense]: 2 },
    sellValue: 5, spriteColor: 0x886633, spriteAccent: 0x664422, stackable: false, maxStack: 1,
  },
  'ability_spell_t0': {
    id: 'ability_spell_t0', name: 'Rune of Fire', description: 'SPACE: Hurl a burst of flame.',
    type: ItemType.Ability, slot: ItemSlot.Ability, rarity: ItemRarity.Common, tier: 0,
    statBonuses: { [StatType.Wisdom]: 1 },
    sellValue: 5, spriteColor: 0xff4422, spriteAccent: 0xffaa00, stackable: false, maxStack: 1,
  },

  // ---- CONSUMABLES ----
  'potion_hp_small': {
    id: 'potion_hp_small', name: 'Mead Flask', description: 'Restores 50 HP. Tastes of honey.',
    type: ItemType.Consumable, rarity: ItemRarity.Common, tier: 0,
    hpRestore: 50,
    sellValue: 3, spriteColor: 0xcc3333, spriteAccent: 0xaa2222, stackable: true, maxStack: 8,
  },
  'potion_hp_large': {
    id: 'potion_hp_large', name: 'Healing Draught', description: 'Restores 150 HP. Brewed by a Gothi.',
    type: ItemType.Consumable, rarity: ItemRarity.Uncommon, tier: 0,
    hpRestore: 150,
    sellValue: 15, spriteColor: 0xff4444, spriteAccent: 0xcc2222, stackable: true, maxStack: 8,
  },
  'potion_mp_small': {
    id: 'potion_mp_small', name: 'Seidr Tonic', description: 'Restores 50 MP. Glows faintly blue.',
    type: ItemType.Consumable, rarity: ItemRarity.Common, tier: 0,
    mpRestore: 50,
    sellValue: 3, spriteColor: 0x3344cc, spriteAccent: 0x2233aa, stackable: true, maxStack: 8,
  },

  // ---- RUNE STONES (Stat potions) ----
  'rune_life': {
    id: 'rune_life', name: 'Rune of Eihwaz', description: '+1 Life. The rune of endurance.',
    type: ItemType.StatPotion, rarity: ItemRarity.Uncommon, tier: 0,
    statBoost: { stat: StatType.Life, amount: 5 },
    sellValue: 30, spriteColor: 0xcc3333, spriteAccent: 0xff6666, stackable: true, maxStack: 20,
  },
  'rune_mana': {
    id: 'rune_mana', name: 'Rune of Laguz', description: '+1 Mana. The rune of water.',
    type: ItemType.StatPotion, rarity: ItemRarity.Uncommon, tier: 0,
    statBoost: { stat: StatType.Mana, amount: 5 },
    sellValue: 30, spriteColor: 0x3344cc, spriteAccent: 0x6688ff, stackable: true, maxStack: 20,
  },
  'rune_attack': {
    id: 'rune_attack', name: 'Rune of Tiwaz', description: '+1 Attack. The rune of the war god.',
    type: ItemType.StatPotion, rarity: ItemRarity.Rare, tier: 0,
    statBoost: { stat: StatType.Attack, amount: 1 },
    sellValue: 50, spriteColor: 0xff4444, spriteAccent: 0xffaa44, stackable: true, maxStack: 20,
  },
  'rune_defense': {
    id: 'rune_defense', name: 'Rune of Algiz', description: '+1 Defense. The rune of protection.',
    type: ItemType.StatPotion, rarity: ItemRarity.Rare, tier: 0,
    statBoost: { stat: StatType.Defense, amount: 1 },
    sellValue: 50, spriteColor: 0x44cc44, spriteAccent: 0x88ff88, stackable: true, maxStack: 20,
  },
  'rune_speed': {
    id: 'rune_speed', name: 'Rune of Raidho', description: '+1 Speed. The rune of the journey.',
    type: ItemType.StatPotion, rarity: ItemRarity.Uncommon, tier: 0,
    statBoost: { stat: StatType.Speed, amount: 1 },
    sellValue: 30, spriteColor: 0x44cccc, spriteAccent: 0x88ffff, stackable: true, maxStack: 20,
  },
  'rune_dexterity': {
    id: 'rune_dexterity', name: 'Rune of Fehu', description: '+1 Dexterity. The rune of swiftness.',
    type: ItemType.StatPotion, rarity: ItemRarity.Uncommon, tier: 0,
    statBoost: { stat: StatType.Dexterity, amount: 1 },
    sellValue: 30, spriteColor: 0xddaa44, spriteAccent: 0xffcc66, stackable: true, maxStack: 20,
  },
  'rune_vitality': {
    id: 'rune_vitality', name: 'Rune of Uruz', description: '+1 Vitality. The rune of the aurochs.',
    type: ItemType.StatPotion, rarity: ItemRarity.Uncommon, tier: 0,
    statBoost: { stat: StatType.Vitality, amount: 1 },
    sellValue: 30, spriteColor: 0xcc6633, spriteAccent: 0xff8844, stackable: true, maxStack: 20,
  },
  'rune_wisdom': {
    id: 'rune_wisdom', name: 'Rune of Ansuz', description: '+1 Wisdom. Odin\'s rune of insight.',
    type: ItemType.StatPotion, rarity: ItemRarity.Uncommon, tier: 0,
    statBoost: { stat: StatType.Wisdom, amount: 1 },
    sellValue: 30, spriteColor: 0xaa44dd, spriteAccent: 0xcc88ff, stackable: true, maxStack: 20,
  },
};

/** Get item by ID */
export function getItem(id: string): GameItem | undefined {
  return ITEM_DATABASE[id];
}

/** Get all items of a given type */
export function getItemsByType(type: ItemType): GameItem[] {
  return Object.values(ITEM_DATABASE).filter(i => i.type === type);
}
