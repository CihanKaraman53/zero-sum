import { LevelConfig, LEVELS } from '../data/levels';
import { ScoringSystem } from './ScoringSystem';
import { BallSpecial } from '../entities/JellyBall';

export interface DropQueueItem {
  value: number;
  special: BallSpecial;
}

/**
 * LevelManager — handles logic for level objectives, spawning rules, and progress.
 */
export class LevelManager {
  currentLevelIndex: number = 0;
  currentLevel!: LevelConfig;
  scoring: ScoringSystem;

  // Progress tracking
  hasWon: boolean = false;
  clearedFrozenBalls: number = 0;

  // Drop queue (next 2 balls)
  dropQueue: DropQueueItem[] = [];

  constructor(scoring: ScoringSystem) {
    this.scoring = scoring;
    this.loadLevel(0);
  }

  loadLevel(index: number): void {
    if (index >= LEVELS.length) {
      // Loop or handle victory — for now, loop the last level with harder settings
      index = LEVELS.length - 1;
    }

    this.currentLevelIndex = index;
    this.currentLevel = LEVELS[index];
    this.hasWon = false;
    this.clearedFrozenBalls = 0;
    this.scoring.reset();

    // Init queue
    this.dropQueue = [];
    this.refillQueue();
  }

  nextLevel(): void {
    this.loadLevel(this.currentLevelIndex + 1);
  }

  /**
   * Gets the next item to drop, and generates a new one for the queue.
   */
  consumeNextDrop(): DropQueueItem {
    const next = this.dropQueue.shift()!;
    this.refillQueue();
    return next;
  }

  getQueue(): DropQueueItem[] {
    return this.dropQueue;
  }

  /**
   * Fills the drop queue up to 2 items based on current level spawn pools.
   */
  private refillQueue(): void {
    while (this.dropQueue.length < 2) {
      const pool = this.currentLevel.spawnPool;
      const isSpecial = Math.random() < this.currentLevel.specialChance;

      let value = 2;
      let special: BallSpecial = null;

      if (isSpecial) {
        special = Math.random() > 0.5 ? 'multiply' : 'divide';
        // Give a placeholder value, it will be overridden by the special graphic
      } else {
        value = pool[Math.floor(Math.random() * pool.length)];
      }

      this.dropQueue.push({ value, special });
    }
  }

  /**
   * Check if level win condition is met.
   */
  checkWinCondition(): boolean {
    if (this.hasWon) return true;

    if (this.currentLevel.type === 'score_attack') {
      if (this.currentLevel.targetScore && this.scoring.score >= this.currentLevel.targetScore) {
        this.hasWon = true;
        return true;
      }
    } else if (this.currentLevel.type === 'board_clear') {
      if (this.currentLevel.clearCount && this.clearedFrozenBalls >= this.currentLevel.clearCount) {
        this.hasWon = true;
        return true;
      }
    }
    // 'fusion_goal' is checked externally when a merge happens

    return false;
  }

  registerFusion(absValue: number): void {
    if (this.currentLevel.type === 'fusion_goal') {
      if (this.currentLevel.fusionTarget && absValue >= this.currentLevel.fusionTarget) {
        this.hasWon = true;
      }
    }
  }

  registerDestroyedBall(wasFrozen: boolean): void {
    if (this.currentLevel.type === 'board_clear' && wasFrozen) {
      this.clearedFrozenBalls++;
    }
  }

  /**
   * Returns a 0-1 float representing progress towards the level goal.
   */
  getProgress(): number {
    if (this.currentLevel.type === 'score_attack') {
      return Math.min(1, this.scoring.score / (this.currentLevel.targetScore || 1));
    } else if (this.currentLevel.type === 'board_clear') {
      return Math.min(1, this.clearedFrozenBalls / (this.currentLevel.clearCount || 1));
    } else if (this.currentLevel.type === 'fusion_goal') {
      // Find max ball value on screen (hard to track here directly without looping pool,
      // so we just return 0 or 1 for fusion)
      return this.hasWon ? 1 : 0;
    }
    return 0;
  }

  getGravity(): number {
    return this.currentLevel.gravity;
  }

  getLauncherSpeed(): number {
    return this.currentLevel.dropSpeed;
  }
}
