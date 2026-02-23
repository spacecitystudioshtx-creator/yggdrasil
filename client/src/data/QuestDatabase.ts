/**
 * Quest definitions for Yggdrasil.
 *
 * Quests follow RotMG style (mostly kill X, clear dungeon, find items)
 * but presented with Stardew Valley warmth (friendly NPC dialogue, story flavor).
 */

export type QuestObjectiveType = 'kill' | 'collect' | 'reach_level' | 'reach_biome' | 'clear_dungeon' | 'equip';

export interface QuestObjective {
  id: string;
  description: string;
  type: QuestObjectiveType;
  targetId: string;       // enemy ID, item ID, biome type, etc.
  targetCount: number;
  current: number;        // runtime progress
}

export interface QuestReward {
  xp: number;
  gold: number;
  itemIds: string[];      // item IDs to grant
}

export interface QuestDef {
  id: string;
  name: string;
  description: string;
  category: 'main' | 'side' | 'daily';
  minLevel: number;
  prerequisiteQuestIds: string[];

  giverName: string;      // NPC name (for UI)
  giverDialogue: string;  // what the NPC says when offering quest
  completeDialogue: string;

  objectives: Omit<QuestObjective, 'current'>[];
  rewards: QuestReward;
}

// ============================================================================
// QUEST DATABASE — Norse mythology themed, Stardew-style warmth
// ============================================================================

export const QUEST_DATABASE: Record<string, QuestDef> = {

  // ---- MAIN STORY ----
  'main_01': {
    id: 'main_01',
    name: 'A Stranger in Midgard',
    description: 'You\'ve awakened in the Frozen Shores with no memory of how you arrived. The old seeress Gríma says you must prove yourself before Asgard opens its gates.',
    category: 'main',
    minLevel: 1,
    prerequisiteQuestIds: [],
    giverName: 'Gríma the Seeress',
    giverDialogue: 'Ah, another lost soul washed upon these shores... The norns have woven your fate into Midgard\'s tapestry. Prove your worth — slay the draugr that haunt this coast.',
    completeDialogue: 'The frost still clings to your blade, but I see fire in your eyes. You may yet survive what comes.',
    objectives: [
      { id: 'main01_kill', description: 'Slay draugr on the Frozen Shores', type: 'kill', targetId: 'enemy_small', targetCount: 5 },
    ],
    rewards: { xp: 100, gold: 25, itemIds: ['potion_hp_small', 'potion_hp_small'] },
  },

  'main_02': {
    id: 'main_02',
    name: 'Into the Birchwood',
    description: 'Gríma senses a disturbance deeper in Midgard. The trolls of the Birch Forest grow restless. Press inward and discover what stirs them.',
    category: 'main',
    minLevel: 3,
    prerequisiteQuestIds: ['main_01'],
    giverName: 'Gríma the Seeress',
    giverDialogue: 'The trees whisper of troll-kind gathering in numbers unseen for an age. Something drives them from the deep forest. Venture in and bring me word of what you find.',
    completeDialogue: 'Frost trolls... so it is as I feared. The Fimbulwinter creeps closer. You must grow stronger.',
    objectives: [
      { id: 'main02_biome', description: 'Reach the Birch Forest', type: 'reach_biome', targetId: 'birch_forest', targetCount: 1 },
      { id: 'main02_kill', description: 'Defeat frost trolls', type: 'kill', targetId: 'enemy_medium', targetCount: 8 },
    ],
    rewards: { xp: 250, gold: 50, itemIds: ['sword_t3'] },
  },

  'main_03': {
    id: 'main_03',
    name: 'The Gathering Storm',
    description: 'The volcanic wastes at Midgard\'s heart burn with unnatural fury. Something terrible stirs near Muspelheim\'s border.',
    category: 'main',
    minLevel: 8,
    prerequisiteQuestIds: ['main_02'],
    giverName: 'Gríma the Seeress',
    giverDialogue: 'I have seen it in the flames — Surtr\'s children march from the volcanic wastes. If they breach the forest, all of Midgard burns. You must push into the inner lands and stem the tide.',
    completeDialogue: 'You walk where even einherjar fear to tread. The All-Father watches you now, young warrior.',
    objectives: [
      { id: 'main03_biome', description: 'Reach the Volcanic Wastes', type: 'reach_biome', targetId: 'volcanic_wastes', targetCount: 1 },
      { id: 'main03_kill', description: 'Slay fire giants', type: 'kill', targetId: 'enemy_medium', targetCount: 15 },
      { id: 'main03_level', description: 'Reach level 10', type: 'reach_level', targetId: 'level', targetCount: 10 },
    ],
    rewards: { xp: 500, gold: 150, itemIds: ['sword_t6', 'potion_hp_large', 'potion_hp_large'] },
  },

  // ---- SIDE QUESTS ----
  'side_01': {
    id: 'side_01',
    name: 'Well-Armed',
    description: 'A warrior is only as good as their gear. Equip a proper weapon.',
    category: 'side',
    minLevel: 1,
    prerequisiteQuestIds: [],
    giverName: 'Brokkr the Smith',
    giverDialogue: 'You plan to fight draugr with THAT? Here, let me show you how to equip something proper. Open your inventory and equip a weapon, any weapon.',
    completeDialogue: 'Now you look like someone who might survive past sundown. Come back when you need repairs.',
    objectives: [
      { id: 'side01_equip', description: 'Equip any weapon', type: 'equip', targetId: 'weapon', targetCount: 1 },
    ],
    rewards: { xp: 50, gold: 10, itemIds: [] },
  },

  'side_02': {
    id: 'side_02',
    name: 'Mead for the Road',
    description: 'Collect mead flasks from fallen foes. A good supply of healing is essential.',
    category: 'side',
    minLevel: 2,
    prerequisiteQuestIds: [],
    giverName: 'Hildr the Innkeeper',
    giverDialogue: 'Going out to fight? Take some mead with you. The draugr sometimes carry flasks they\'ve looted from fallen travelers. Recover three for me and I\'ll make it worth your while.',
    completeDialogue: 'Three flasks returned! You\'re more reliable than my last courier. Here — take this with my thanks.',
    objectives: [
      { id: 'side02_collect', description: 'Collect Mead Flasks', type: 'collect', targetId: 'potion_hp_small', targetCount: 3 },
    ],
    rewards: { xp: 75, gold: 20, itemIds: ['ring_t0'] },
  },

  'side_03': {
    id: 'side_03',
    name: 'Power of the Runes',
    description: 'The ancient rune stones hold the power to permanently strengthen a warrior. Find one and consume it.',
    category: 'side',
    minLevel: 5,
    prerequisiteQuestIds: ['main_01'],
    giverName: 'Gríma the Seeress',
    giverDialogue: 'Beyond mere levels lies true power — the rune stones. They fall from the mightiest foes, each one a fragment of the World Tree\'s magic. Find one and let its power flow through you.',
    completeDialogue: 'You feel it, don\'t you? The World Tree\'s strength coursing through your veins. Seek more runes to reach your full potential.',
    objectives: [
      { id: 'side03_collect', description: 'Find any Rune Stone', type: 'collect', targetId: 'rune_any', targetCount: 1 },
    ],
    rewards: { xp: 100, gold: 30, itemIds: ['rune_life'] },
  },

  'side_04': {
    id: 'side_04',
    name: 'The Culling',
    description: 'The draugr population near the shores has gotten out of hand. Thin their numbers.',
    category: 'side',
    minLevel: 2,
    prerequisiteQuestIds: [],
    giverName: 'Jarl Eirik',
    giverDialogue: 'The draugr swarm the shores like lice on a thrall. We need someone to cull their numbers before they push inland. Twenty should send a message to whatever dark power raises them.',
    completeDialogue: 'Twenty fewer draugr haunting our shores. The fisherfolk will rest easier tonight. You have the jarl\'s thanks.',
    objectives: [
      { id: 'side04_kill', description: 'Slay 20 draugr', type: 'kill', targetId: 'enemy_small', targetCount: 20 },
    ],
    rewards: { xp: 200, gold: 75, itemIds: ['armor_heavy_t5'] },
  },

  'side_05': {
    id: 'side_05',
    name: 'Growing Stronger',
    description: 'Reach level 5 to unlock new challenges.',
    category: 'side',
    minLevel: 1,
    prerequisiteQuestIds: [],
    giverName: 'Gríma the Seeress',
    giverDialogue: 'Experience is the greatest teacher, child. Grow strong enough and the deeper mysteries of Midgard will reveal themselves to you.',
    completeDialogue: 'Level 5! The norns take notice. New paths open before you.',
    objectives: [
      { id: 'side05_level', description: 'Reach level 5', type: 'reach_level', targetId: 'level', targetCount: 5 },
    ],
    rewards: { xp: 150, gold: 50, itemIds: ['potion_hp_large'] },
  },
};

export function getQuest(id: string): QuestDef | undefined {
  return QUEST_DATABASE[id];
}

export function getAvailableQuests(level: number, completedQuestIds: string[]): QuestDef[] {
  return Object.values(QUEST_DATABASE).filter(q => {
    if (q.minLevel > level) return false;
    if (completedQuestIds.includes(q.id)) return false;
    if (q.prerequisiteQuestIds.some(pid => !completedQuestIds.includes(pid))) return false;
    return true;
  });
}
