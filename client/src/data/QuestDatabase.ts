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
// QUEST DATABASE — Three starter quests that funnel the player to level 5
// ============================================================================

export const QUEST_DATABASE: Record<string, QuestDef> = {

  'starter_01': {
    id: 'starter_01',
    name: 'First Blood',
    description: 'The Frozen Shores are crawling with draugr. Prove yourself by cutting them down.',
    category: 'main',
    minLevel: 1,
    prerequisiteQuestIds: [],
    giverName: 'Gríma the Seeress',
    giverDialogue: 'You are new here, warrior. The undead haunt these shores in great numbers. Kill ten of them and you will start to feel stronger.',
    completeDialogue: 'Well done. Your blade arm is coming along. Keep at it.',
    objectives: [
      { id: 'sq1_kill', description: 'Slay 10 enemies', type: 'kill', targetId: 'enemy_small', targetCount: 10 },
    ],
    rewards: { xp: 120, gold: 30, itemIds: ['potion_hp_small', 'potion_hp_small', 'potion_hp_small'] },
  },

  'starter_02': {
    id: 'starter_02',
    name: 'Loot the Fallen',
    description: 'The dead carry healing potions. Collect some to survive the trials ahead.',
    category: 'side',
    minLevel: 1,
    prerequisiteQuestIds: [],
    giverName: 'Brokkr the Smith',
    giverDialogue: 'Don\'t let the mead flasks rot on the battlefield. Grab three of them — you\'ll need the healing when things get rough.',
    completeDialogue: 'Good thinking. Always keep your potions stocked.',
    objectives: [
      { id: 'sq2_collect', description: 'Collect 3 potions', type: 'collect', targetId: 'potion_hp_small', targetCount: 3 },
    ],
    rewards: { xp: 80, gold: 20, itemIds: ['potion_mp_small', 'potion_mp_small'] },
  },

  'starter_03': {
    id: 'starter_03',
    name: 'Grow Strong',
    description: 'Reach level 5. A portal to the first dungeon will open.',
    category: 'main',
    minLevel: 1,
    prerequisiteQuestIds: [],
    giverName: 'Gríma the Seeress',
    giverDialogue: 'Power comes from experience. Kill, survive, level up. Reach level 5 and Midgard will reveal its first true trial — the Frostheim Caverns.',
    completeDialogue: 'Level 5! Look — a portal has opened. The Frostheim Caverns await you. Enter and prove your worth.',
    objectives: [
      { id: 'sq3_level', description: 'Reach level 5', type: 'reach_level', targetId: 'level', targetCount: 5 },
    ],
    rewards: { xp: 200, gold: 50, itemIds: ['potion_hp_large', 'potion_hp_large'] },
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
