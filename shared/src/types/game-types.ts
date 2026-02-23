// ============================================================================
// Yggdrasil - Core Game Type Definitions
// ============================================================================

// --- Stats ---
export enum StatType {
  Life = 'life',
  Mana = 'mana',
  Attack = 'attack',
  Defense = 'defense',
  Speed = 'speed',
  Dexterity = 'dexterity',
  Vitality = 'vitality',
  Wisdom = 'wisdom',
}

export type StatBlock = Record<StatType, number>;

// --- Items ---
export enum ItemTier {
  T0 = 0, T1 = 1, T2 = 2, T3 = 3, T4 = 4, T5 = 5,
  T6 = 6, T7 = 7, T8 = 8, T9 = 9, T10 = 10, T11 = 11,
  T12 = 12, T13 = 13,
}

export enum ItemRarity {
  Common = 'common',
  Uncommon = 'uncommon',
  Rare = 'rare',
  Legendary = 'legendary',
  Mythic = 'mythic',
}

export enum ItemSlot {
  Weapon = 'weapon',
  Ability = 'ability',
  Armor = 'armor',
  Ring = 'ring',
}

export enum ItemType {
  Weapon = 'weapon',
  Ability = 'ability',
  Armor = 'armor',
  Ring = 'ring',
  Consumable = 'consumable',
  StatPotion = 'stat_potion',
  Material = 'material',
  QuestItem = 'quest_item',
}

// --- Damage ---
export enum DamageType {
  Physical = 'physical',
  Fire = 'fire',
  Ice = 'ice',
  Lightning = 'lightning',
  Poison = 'poison',
  Holy = 'holy',
  Dark = 'dark',
}

// --- Biomes ---
export enum BiomeType {
  FrozenShores = 'frozen_shores',
  BirchForest = 'birch_forest',
  VolcanicWastes = 'volcanic_wastes',
  NiflheimDepths = 'niflheim_depths',
  Asgard = 'asgard',
  Helheim = 'helheim',
  Jotunheim = 'jotunheim',
  Svartalfheim = 'svartalfheim',
  Muspelheim = 'muspelheim',
  Vanaheim = 'vanaheim',
  Alfheim = 'alfheim',
}

// --- Enemies ---
export enum EnemyBehavior {
  Wander = 'wander',
  Chase = 'chase',
  Stationary = 'stationary',
  Orbit = 'orbit',
  Flee = 'flee',
  Boss = 'boss',
}

// --- Bullet patterns ---
export enum BulletPatternType {
  Radial = 'radial',
  Aimed = 'aimed',
  Spiral = 'spiral',
  Shotgun = 'shotgun',
  Wall = 'wall',
  Star = 'star',
  Burst = 'burst',
}

// --- Loot bag tiers (visual) ---
export enum LootBagTier {
  Brown = 'brown',       // T0-T4, common consumables
  Purple = 'purple',     // T5-T8, uncommon
  Cyan = 'cyan',         // T9-T12, rare
  White = 'white',       // UT/Legendary
  Orange = 'orange',     // Mythic event items
}

// --- Character classes ---
export enum ArmorType {
  Heavy = 'heavy',
  Medium = 'medium',
  Light = 'light',
  Robe = 'robe',
}

export enum WeaponType {
  Sword = 'sword',
  Staff = 'staff',
  Spear = 'spear',
  Axe = 'axe',
  Wand = 'wand',
  Bow = 'bow',
  Dagger = 'dagger',
  Hammer = 'hammer',
  Katana = 'katana',
}

// --- Game state ---
export enum GameState {
  Loading = 'loading',
  MainMenu = 'main_menu',
  CharacterSelect = 'character_select',
  Nexus = 'nexus',
  Realm = 'realm',
  Dungeon = 'dungeon',
  Dead = 'dead',
  Paused = 'paused',
}
