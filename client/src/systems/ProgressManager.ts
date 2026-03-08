/**
 * ProgressManager: Saves per-class checkpoint progress to localStorage.
 *
 * Each class tracks which "stages" have been unlocked:
 *   stage 0 = Midgard (starting area) — always unlocked
 *   stage 1 = After Frostheim Caverns (level 6)
 *   stage 2 = After Verdant Hollows (level 8)
 *   stage 3 = After Muspelheim Forge (level 10)
 *   stage 4 = After Helheim Sanctum (Fenrir fight unlocked)
 *
 * When a character completes a dungeon, progress is saved for their class.
 * On CharacterSelect, the player can choose which stage to drop into.
 */

export interface StageCheckpoint {
  stageIndex: number;    // 0-4
  label: string;         // display name
  dungeonId?: string;    // dungeon to enter immediately (if not overworld)
  startLevel: number;    // player starts at this level
  description: string;
}

export const STAGE_CHECKPOINTS: StageCheckpoint[] = [
  {
    stageIndex: 0,
    label: 'Midgard',
    startLevel: 1,
    description: 'Start fresh in the Frozen Shores.',
  },
  {
    stageIndex: 1,
    label: 'Frostheim Cleared',
    startLevel: 6,
    description: 'Enter Verdant Hollows from level 6.',
  },
  {
    stageIndex: 2,
    label: 'Verdant Cleared',
    startLevel: 8,
    description: 'Enter Muspelheim Forge from level 8.',
  },
  {
    stageIndex: 3,
    label: 'Muspelheim Cleared',
    startLevel: 10,
    description: 'Enter Helheim Sanctum from level 10.',
  },
  {
    stageIndex: 4,
    label: 'Helheim Cleared',
    startLevel: 10,
    description: 'Face Fenrir — the final battle.',
  },
];

interface ClassProgress {
  classId: string;
  highestStage: number;   // 0-4
}

/** Mid-run player state saved across browser refresh */
export interface PlayerRunState {
  classId: string;
  level: number;
  xp: number;
  maxHp: number;
  hp: number;
  maxMp: number;
  mp: number;
  /** Which dungeon portals have already been spawned (comma-separated) */
  spawnedPortals: string;
}

const STORAGE_KEY    = 'yggdrasil_progress_v1';
const RUN_STATE_KEY  = 'yggdrasil_run_v1';

export class ProgressManager {
  private data: Record<string, ClassProgress>;

  constructor() {
    this.data = this.load();
  }

  /** Get the highest unlocked stage index for a class */
  getHighestStage(classId: string): number {
    return this.data[classId]?.highestStage ?? 0;
  }

  /** Unlock a new stage for a class (only advances, never goes back) */
  unlockStage(classId: string, stageIndex: number): void {
    const current = this.getHighestStage(classId);
    if (stageIndex > current) {
      this.data[classId] = { classId, highestStage: stageIndex };
      this.save();
    }
  }

  /** Map a completed dungeonId to the next stage index */
  static dungeonToStage(completedDungeonId: string): number {
    switch (completedDungeonId) {
      case 'frostheim_caverns': return 1;
      case 'verdant_hollows':   return 2;
      case 'muspelheim_forge':  return 3;
      case 'helheim_sanctum':   return 4;
      default: return 0;
    }
  }

  /** Get all unlocked checkpoints for a class */
  getUnlockedCheckpoints(classId: string): StageCheckpoint[] {
    const highest = this.getHighestStage(classId);
    return STAGE_CHECKPOINTS.filter(s => s.stageIndex <= highest);
  }

  // -----------------------------------------------------------------------
  // Mid-run state — persists level/XP/HP/MP across browser refresh
  // -----------------------------------------------------------------------

  /** Save the player's current in-run state to localStorage */
  saveRunState(state: PlayerRunState): void {
    try {
      localStorage.setItem(RUN_STATE_KEY, JSON.stringify(state));
    } catch {}
  }

  /** Load a previously saved run state. Returns null if none or classId mismatch. */
  loadRunState(classId: string): PlayerRunState | null {
    try {
      const raw = localStorage.getItem(RUN_STATE_KEY);
      if (!raw) return null;
      const state = JSON.parse(raw) as PlayerRunState;
      // Only restore state for the same class
      if (state.classId !== classId) return null;
      return state;
    } catch {
      return null;
    }
  }

  /** Clear the saved run state (call on death or intentional new-game) */
  clearRunState(): void {
    try {
      localStorage.removeItem(RUN_STATE_KEY);
    } catch {}
  }

  private load(): Record<string, ClassProgress> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  private save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch {}
  }
}
