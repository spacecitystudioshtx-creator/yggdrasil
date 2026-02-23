import { QuestDef, QuestObjective, getQuest, getAvailableQuests } from '../data/QuestDatabase';

/**
 * QuestManager: Tracks active quests, progress, and completion.
 *
 * Listens for game events (enemy killed, item collected, level up, biome entered)
 * and updates quest objectives accordingly.
 */

export interface ActiveQuest {
  def: QuestDef;
  objectives: QuestObjective[];
  isComplete: boolean;
}

export class QuestManager {
  activeQuests: ActiveQuest[] = [];
  completedQuestIds: string[] = [];
  readonly maxActiveQuests = 6;

  // Event callbacks
  private onChanged: (() => void)[] = [];
  private onQuestComplete: ((quest: ActiveQuest) => void)[] = [];
  private onObjectiveProgress: ((quest: ActiveQuest, objective: QuestObjective) => void)[] = [];

  onChange(callback: () => void): void { this.onChanged.push(callback); }
  onComplete(callback: (quest: ActiveQuest) => void): void { this.onQuestComplete.push(callback); }
  onProgress(callback: (quest: ActiveQuest, obj: QuestObjective) => void): void { this.onObjectiveProgress.push(callback); }

  private notifyChanged(): void { this.onChanged.forEach(cb => cb()); }

  /** Accept a quest */
  acceptQuest(questId: string): boolean {
    if (this.activeQuests.length >= this.maxActiveQuests) return false;
    if (this.activeQuests.some(q => q.def.id === questId)) return false;
    if (this.completedQuestIds.includes(questId)) return false;

    const def = getQuest(questId);
    if (!def) return false;

    const activeQuest: ActiveQuest = {
      def,
      objectives: def.objectives.map(o => ({ ...o, current: 0 })),
      isComplete: false,
    };

    this.activeQuests.push(activeQuest);
    this.notifyChanged();
    return true;
  }

  /** Abandon a quest */
  abandonQuest(questId: string): void {
    this.activeQuests = this.activeQuests.filter(q => q.def.id !== questId);
    this.notifyChanged();
  }

  /** Complete a quest (claim rewards) */
  completeQuest(questId: string): ActiveQuest | null {
    const idx = this.activeQuests.findIndex(q => q.def.id === questId && q.isComplete);
    if (idx === -1) return null;

    const quest = this.activeQuests.splice(idx, 1)[0];
    this.completedQuestIds.push(questId);

    this.onQuestComplete.forEach(cb => cb(quest));
    this.notifyChanged();
    return quest;
  }

  /** Report an enemy kill */
  reportKill(enemyTextureKey: string): void {
    for (const quest of this.activeQuests) {
      if (quest.isComplete) continue;
      for (const obj of quest.objectives) {
        if (obj.type === 'kill' && obj.targetId === enemyTextureKey && obj.current < obj.targetCount) {
          obj.current++;
          this.onObjectiveProgress.forEach(cb => cb(quest, obj));
          this.checkQuestComplete(quest);
        }
      }
    }
  }

  /** Report an item collected */
  reportCollect(itemId: string): void {
    for (const quest of this.activeQuests) {
      if (quest.isComplete) continue;
      for (const obj of quest.objectives) {
        if (obj.type === 'collect') {
          // Support 'rune_any' for any rune stone
          const match = obj.targetId === itemId ||
            (obj.targetId === 'rune_any' && itemId.startsWith('rune_'));
          if (match && obj.current < obj.targetCount) {
            obj.current++;
            this.onObjectiveProgress.forEach(cb => cb(quest, obj));
            this.checkQuestComplete(quest);
          }
        }
      }
    }
  }

  /** Report a level change */
  reportLevel(level: number): void {
    for (const quest of this.activeQuests) {
      if (quest.isComplete) continue;
      for (const obj of quest.objectives) {
        if (obj.type === 'reach_level') {
          obj.current = Math.min(level, obj.targetCount);
          if (obj.current >= obj.targetCount) {
            this.onObjectiveProgress.forEach(cb => cb(quest, obj));
            this.checkQuestComplete(quest);
          }
        }
      }
    }
  }

  /** Report entering a biome */
  reportBiome(biomeType: string): void {
    for (const quest of this.activeQuests) {
      if (quest.isComplete) continue;
      for (const obj of quest.objectives) {
        if (obj.type === 'reach_biome' && obj.targetId === biomeType) {
          obj.current = 1;
          this.onObjectiveProgress.forEach(cb => cb(quest, obj));
          this.checkQuestComplete(quest);
        }
      }
    }
  }

  /** Report equipping an item type */
  reportEquip(slotType: string): void {
    for (const quest of this.activeQuests) {
      if (quest.isComplete) continue;
      for (const obj of quest.objectives) {
        if (obj.type === 'equip' && obj.targetId === slotType) {
          obj.current = 1;
          this.onObjectiveProgress.forEach(cb => cb(quest, obj));
          this.checkQuestComplete(quest);
        }
      }
    }
  }

  private checkQuestComplete(quest: ActiveQuest): void {
    const allDone = quest.objectives.every(o => o.current >= o.targetCount);
    if (allDone && !quest.isComplete) {
      quest.isComplete = true;
      this.notifyChanged();
    }
  }

  /** Get quests available to accept */
  getAvailable(playerLevel: number): QuestDef[] {
    const alreadyActive = this.activeQuests.map(q => q.def.id);
    return getAvailableQuests(playerLevel, this.completedQuestIds)
      .filter(q => !alreadyActive.includes(q.id));
  }
}
