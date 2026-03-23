import { WeaponType, ArmorType, StatType } from '@yggdrasil/shared';

/**
 * ClassDatabase: Defines the 6 starter classes for Yggdrasil.
 *
 * Each class has:
 *   - Base stats at level 1
 *   - Stat gains per level (up to level 20)
 *   - Stat caps for Rune Stone maxing (8/8 endgame)
 *   - Starting gear (weapon, ability, armor, ring)
 *   - Weapon type and armor type restrictions
 *   - Visual properties (sprite tint, description)
 */

export interface ClassDef {
  id: string;
  name: string;
  description: string;
  lore: string;

  // Weapon/Armor restrictions
  weaponType: WeaponType;
  armorType: ArmorType;

  // Base stats at level 1
  baseStats: {
    maxHp: number;
    maxMp: number;
    attack: number;
    defense: number;
    speed: number;
    dexterity: number;
    vitality: number;
    wisdom: number;
  };

  // Stat gains per level (added each level up)
  levelGains: {
    maxHp: number;
    maxMp: number;
    attack: number;
    defense: number;
    speed: number;
    dexterity: number;
    vitality: number;
    wisdom: number;
  };

  // Stat caps (max achievable with Rune Stones)
  statCaps: {
    maxHp: number;
    maxMp: number;
    attack: number;
    defense: number;
    speed: number;
    dexterity: number;
    vitality: number;
    wisdom: number;
  };

  // Starting gear item IDs
  startingGear: {
    weapon: string;
    ability: string;
    armor: string;
    ring: string;
  };

  // Weapon attack profile — defines how this class shoots
  weaponProfile: {
    projectileCount: number;     // how many projectiles per shot
    spreadAngle: number;         // spread in degrees (0 = single line)
    projectileSpeed: number;     // pixels/sec
    projectileLifetime: number;  // ms — shorter = melee range
    projectileTint: number;      // color tint for projectile
    fireRateMultiplier: number;  // multiplies base fire rate (>1 = faster)
    damageMultiplier: number;    // multiplies base damage per projectile
    projectileSize: number;      // body size multiplier (1 = default 4px)
  };

  // Visual
  spriteTint: number;
  abilityName: string;
  abilityDescription: string;
}

// ============================================================================
// 6 Starter Classes
// ============================================================================

export const CLASS_DEFS: Record<string, ClassDef> = {
  viking: {
    id: 'viking',
    name: 'Viking',
    description: 'A stalwart warrior clad in heavy armor. Excels at taking damage and standing firm.',
    lore: 'The shield-wall is where a Viking finds glory. In the crash of steel and the roar of battle, they are immovable.',
    weaponType: WeaponType.Sword,
    armorType: ArmorType.Heavy,
    baseStats: {
      maxHp: 320, maxMp: 100,
      attack: 18, defense: 10,
      speed: 20, dexterity: 20,
      vitality: 35, wisdom: 15,
    },
    levelGains: {
      maxHp: 40, maxMp: 8,
      attack: 3, defense: 3,
      speed: 2, dexterity: 2,
      vitality: 4, wisdom: 1,
    },
    statCaps: {
      maxHp: 900, maxMp: 252,
      attack: 55, defense: 55,
      speed: 50, dexterity: 50,
      vitality: 90, wisdom: 50,
    },
    startingGear: {
      weapon: 'sword_t0',
      ability: 'ability_shield_t0',
      armor: 'armor_heavy_t0',
      ring: 'ring_t0',
    },
    // Viking: 5 short-range burst projectiles in a wide arc (sword swing)
    weaponProfile: {
      projectileCount: 5,
      spreadAngle: 90,
      projectileSpeed: 280,
      projectileLifetime: 350,
      projectileTint: 0x88aacc,
      fireRateMultiplier: 0.70,
      damageMultiplier: 0.45,
      projectileSize: 1.5,
    },
    spriteTint: 0x6688bb, // steel blue
    abilityName: 'Shield Wall',
    abilityDescription: 'Raise your shield to halve all incoming damage for 5 seconds.',
  },

  runemaster: {
    id: 'runemaster',
    name: 'Runemaster',
    description: 'A wielder of ancient runic magic. Devastating ranged damage but fragile.',
    lore: 'The runes speak to those who listen. Each mark carved is a word of power, a fragment of creation itself.',
    weaponType: WeaponType.Staff,
    armorType: ArmorType.Robe,
    baseStats: {
      maxHp: 150, maxMp: 200,
      attack: 20, defense: 5,
      speed: 25, dexterity: 25,
      vitality: 15, wisdom: 30,
    },
    levelGains: {
      maxHp: 20, maxMp: 15,
      attack: 4, defense: 1,
      speed: 2, dexterity: 2,
      vitality: 1, wisdom: 3,
    },
    statCaps: {
      maxHp: 550, maxMp: 385,
      attack: 75, defense: 25,
      speed: 55, dexterity: 60,
      vitality: 40, wisdom: 75,
    },
    startingGear: {
      weapon: 'staff_t0',
      ability: 'ability_spell_t0',
      armor: 'armor_robe_t0',
      ring: 'ring_t0',
    },
    // Runemaster: 1 slow, long-range, high-damage arcane bolt (mana-gated, no timer)
    weaponProfile: {
      projectileCount: 1,
      spreadAngle: 0,
      projectileSpeed: 350,
      projectileLifetime: 1800,
      projectileTint: 0xaa44ff,
      fireRateMultiplier: 0.75,
      damageMultiplier: 2.0,
      projectileSize: 1.5,
    },
    spriteTint: 0xaa44ff, // purple
    abilityName: 'Rune Blast',
    abilityDescription: 'Erupt 12 arcane bolts in a full ring around you. Costs mana.',
  },

  valkyrie: {
    id: 'valkyrie',
    name: 'Valkyrie',
    description: 'A divine warrior who bridges life and death. Balanced between melee and support.',
    lore: 'Chosen by Odin himself, the Valkyries carry the worthy to Valhalla. In battle, they are swift and relentless.',
    weaponType: WeaponType.Spear,
    armorType: ArmorType.Medium,
    baseStats: {
      maxHp: 200, maxMp: 150,
      attack: 18, defense: 8,
      speed: 30, dexterity: 20,
      vitality: 22, wisdom: 22,
    },
    levelGains: {
      maxHp: 30, maxMp: 12,
      attack: 3, defense: 2,
      speed: 2, dexterity: 2,
      vitality: 2, wisdom: 2,
    },
    statCaps: {
      maxHp: 670, maxMp: 300,
      attack: 60, defense: 35,
      speed: 60, dexterity: 55,
      vitality: 60, wisdom: 60,
    },
    startingGear: {
      weapon: 'spear_t0',
      ability: 'ability_shield_t0',
      armor: 'armor_medium_t0',
      ring: 'ring_t0',
    },
    // Valkyrie: 3 medium-range spear projectiles in tight spread
    weaponProfile: {
      projectileCount: 3,
      spreadAngle: 15,
      projectileSpeed: 380,
      projectileLifetime: 900,
      projectileTint: 0xffdd44,
      fireRateMultiplier: 0.90,
      damageMultiplier: 0.55,
      projectileSize: 1.2,
    },
    spriteTint: 0xffdd44, // gold
    abilityName: 'Divine Touch',
    abilityDescription: 'Call upon divine grace to instantly restore 80 HP.',
  },

  berserker: {
    id: 'berserker',
    name: 'Berserker',
    description: 'A frenzied warrior who trades defense for overwhelming offensive power.',
    lore: 'In the grip of battle-fury, a Berserker knows neither fear nor pain. Only the red mist remains.',
    weaponType: WeaponType.Axe,
    armorType: ArmorType.Light,
    baseStats: {
      maxHp: 190, maxMp: 80,
      attack: 20, defense: 2,
      speed: 25, dexterity: 30,
      vitality: 20, wisdom: 10,
    },
    levelGains: {
      maxHp: 25, maxMp: 5,
      attack: 5, defense: 1,
      speed: 2, dexterity: 3,
      vitality: 2, wisdom: 0,
    },
    statCaps: {
      maxHp: 600, maxMp: 200,
      attack: 80, defense: 20,
      speed: 60, dexterity: 75,
      vitality: 50, wisdom: 30,
    },
    startingGear: {
      weapon: 'axe_t0',
      ability: 'ability_shield_t0',
      armor: 'armor_light_t0',
      ring: 'ring_t0',
    },
    // Berserker: 3 fast, short-medium range axe throws in wide arc
    weaponProfile: {
      projectileCount: 3,
      spreadAngle: 45,
      projectileSpeed: 420,
      projectileLifetime: 500,
      projectileTint: 0xcc3333,
      fireRateMultiplier: 1.0,
      damageMultiplier: 0.50,
      projectileSize: 1.4,
    },
    spriteTint: 0xcc3333, // red
    abilityName: 'Frenzy',
    abilityDescription: 'Enter a blood-rage, boosting fire rate by 50% for 5 seconds.',
  },

  skald: {
    id: 'skald',
    name: 'Skald',
    description: 'A battle-poet who empowers allies with ancient war chants. Support class.',
    lore: 'The Skald\'s song echoes through the battlefield. Each verse is a blessing, each chorus a curse upon foes.',
    weaponType: WeaponType.Wand,
    armorType: ArmorType.Robe,
    baseStats: {
      maxHp: 170, maxMp: 180,
      attack: 18, defense: 5,
      speed: 25, dexterity: 20,
      vitality: 20, wisdom: 35,
    },
    levelGains: {
      maxHp: 20, maxMp: 15,
      attack: 3, defense: 1,
      speed: 2, dexterity: 2,
      vitality: 1, wisdom: 3,
    },
    statCaps: {
      maxHp: 550, maxMp: 385,
      attack: 50, defense: 25,
      speed: 55, dexterity: 50,
      vitality: 50, wisdom: 75,
    },
    startingGear: {
      weapon: 'wand_t0',
      ability: 'ability_spell_t0',
      armor: 'armor_robe_t0',
      ring: 'ring_t0',
    },
    // Skald: 1 reliable wand bolt, moderate damage, long range
    weaponProfile: {
      projectileCount: 1,
      spreadAngle: 0,
      projectileSpeed: 300,
      projectileLifetime: 2000,
      projectileTint: 0x44ccaa,
      fireRateMultiplier: 1.0,
      damageMultiplier: 1.5,
      projectileSize: 1.0,
    },
    spriteTint: 0x44ccaa, // teal
    abilityName: 'Healing Chant',
    abilityDescription: 'Sing a battle hymn that instantly restores 100 HP. Costs mana.',
  },

  huntsman: {
    id: 'huntsman',
    name: 'Huntsman',
    description: 'A keen-eyed archer who strikes from range. High dexterity and speed.',
    lore: 'Through forest and mountain, the Huntsman stalks prey that others dare not face. Their arrows never miss.',
    weaponType: WeaponType.Bow,
    armorType: ArmorType.Light,
    baseStats: {
      maxHp: 170, maxMp: 100,
      attack: 20, defense: 5,
      speed: 35, dexterity: 30,
      vitality: 18, wisdom: 18,
    },
    levelGains: {
      maxHp: 20, maxMp: 8,
      attack: 3, defense: 1,
      speed: 3, dexterity: 3,
      vitality: 1, wisdom: 1,
    },
    statCaps: {
      maxHp: 580, maxMp: 252,
      attack: 60, defense: 25,
      speed: 70, dexterity: 75,
      vitality: 45, wisdom: 50,
    },
    startingGear: {
      weapon: 'bow_t0',
      ability: 'ability_shield_t0',
      armor: 'armor_light_t0',
      ring: 'ring_t0',
    },
    // Huntsman: 1 fast, long-range arrow, rapid fire
    weaponProfile: {
      projectileCount: 1,
      spreadAngle: 0,
      projectileSpeed: 520,
      projectileLifetime: 1500,
      projectileTint: 0x88aa44,
      fireRateMultiplier: 1.4,
      damageMultiplier: 1.1,
      projectileSize: 0.8,
    },
    spriteTint: 0x88aa44, // forest green
    abilityName: 'Arrow Volley',
    abilityDescription: 'Fire 8 arrows in a wide cone burst, shredding enemies ahead of you.',
  },
};

/** Get a class definition by ID */
export function getClass(id: string): ClassDef | undefined {
  return CLASS_DEFS[id];
}

/** Get all class definitions */
export function getAllClasses(): ClassDef[] {
  return Object.values(CLASS_DEFS);
}
