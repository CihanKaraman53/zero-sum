import { getLevel, LevelConfig, LevelQuest } from '../data/levels';
import { ScoringSystem } from './ScoringSystem';
import { BallSpecial, BallFaction } from '../entities/JellyBall';

export interface DropQueueItem {
  value: number;
  faction: BallFaction;
  special: BallSpecial;
}

/**
 * LevelManager — spawn queue and tutorial progression per chapter.
 */
export class LevelManager {
  currentLevel: LevelConfig;
  scoring: ScoringSystem;

  hasWon = false;
  dropQueue: DropQueueItem[] = [];

  private tutorialIndex = 0;
  private readonly queueSize = 3;
  private phaseIndex = 0;

  constructor(scoring: ScoringSystem, levelId = 1, resetScore = true) {
    this.scoring = scoring;
    this.currentLevel = getLevel(levelId);
    this.reset(resetScore);
  }

  reset(resetScore = true): void {
    this.hasWon = false;
    this.tutorialIndex = 0;
    this.phaseIndex = 0;
    if (resetScore) {
      this.scoring.reset();
    }
    this.dropQueue = [];
    this.refillQueue();
  }

  consumeNextDrop(): DropQueueItem {
    const next = this.dropQueue.shift()!;
    this.refillQueue();
    return next;
  }

  getQueue(): DropQueueItem[] {
    return this.dropQueue;
  }

  getQuests(): LevelQuest[] {
    return this.currentLevel.quests;
  }

  getActiveQuest(): LevelQuest {
    if (this.currentLevel.sequentialPhases) {
      return this.currentLevel.quests[this.phaseIndex];
    }
    return this.currentLevel.quests[0];
  }

  getPhaseIndex(): number {
    return this.phaseIndex;
  }

  hasMorePhases(): boolean {
    return (
      !!this.currentLevel.sequentialPhases &&
      this.phaseIndex < this.currentLevel.quests.length - 1
    );
  }

  advancePhase(): void {
    if (!this.hasMorePhases()) return;
    this.phaseIndex++;
    this.refillQueue();
  }

  isSequentialPhases(): boolean {
    return !!this.currentLevel.sequentialPhases;
  }

  /** @deprecated single-quest levels */
  getQuestTarget(): number {
    return this.currentLevel.quests[0].target;
  }

  /** @deprecated single-quest levels */
  getQuestRequired(): number {
    return this.currentLevel.quests[0].required;
  }

  isHarvestValue(value: number): boolean {
    if (this.currentLevel.sequentialPhases) {
      return value === this.getActiveQuest().target;
    }
    return this.currentLevel.quests.some((q) => q.target === value);
  }

  private activeDirectTargets(): Set<number> {
    if (this.currentLevel.sequentialPhases) {
      return new Set([this.getActiveQuest().target]);
    }
    return new Set(this.currentLevel.quests.map((q) => q.target));
  }

  private refillQueue(): void {
    const { tutorialDrops, postTutorialPool, dropMode } = this.currentLevel;
    const directTargets = this.activeDirectTargets();

    while (this.dropQueue.length < this.queueSize) {
      if (this.tutorialIndex < tutorialDrops.length) {
        const value = tutorialDrops[this.tutorialIndex++];
        this.dropQueue.push({ value, faction: 'green', special: null });
        continue;
      }

      const candidates = postTutorialPool.filter((absVal) => {
        if (dropMode === 'negative') return !directTargets.has(-absVal);
        return !directTargets.has(absVal) && !directTargets.has(-absVal);
      });
      const pool = candidates.length > 0 ? candidates : postTutorialPool;
      const absVal = pool[Math.floor(Math.random() * pool.length)];
      let value: number;
      if (dropMode === 'negative') {
        value = -absVal;
      } else {
        const negChance = this.effectiveNegativeSpawnChance();
        const negative = Math.random() < negChance;
        value = negative ? -absVal : absVal;
      }
      this.dropQueue.push({ value, faction: 'green', special: null });
    }
  }

  /** +16 fazında eksi daha seyrek; −32 fazında biraz daha sık. */
  private effectiveNegativeSpawnChance(): number {
    const base = this.currentLevel.negativeSpawnChance ?? 0;
    if (!this.currentLevel.sequentialPhases) return base;
    if (this.getActiveQuest().target < 0) return Math.max(base, 0.55);
    return Math.min(base, 0.35);
  }

  markWon(): void {
    this.hasWon = true;
  }

  getGravity(): number {
    return this.currentLevel.gravity;
  }

  getLauncherSpeed(): number {
    return this.currentLevel.dropSpeed;
  }
}
