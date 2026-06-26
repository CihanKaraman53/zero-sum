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

  // Helper to fetch active ball values from the scene
  public getActiveBallValues?: () => number[];

  constructor(scoring: ScoringSystem) {
    this.scoring = scoring;
    this.loadLevel(0);
  }

  level1Index: number = 0;
  level2Index: number = 0;
  level3Index: number = 0;
  level4Index: number = 0;
  level5Index: number = 0;
  level6Index: number = 0;

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
    
    if (index === 0) {
      this.level1Index = 0;
    } else if (index === 1) {
      this.level2Index = 0;
    } else if (index === 2) {
      this.level3Index = 0;
    } else if (index === 3) {
      this.level4Index = 0;
    } else if (index === 4) {
      this.level5Index = 0;
    } else if (index === 5) {
      this.level6Index = 0;
    }

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
      if (this.currentLevelIndex === 0) {
        const tutorialQueue = [2, 2, 4, -8];
        if (this.level1Index < tutorialQueue.length) {
          const val = tutorialQueue[this.level1Index];
          this.level1Index++;
          this.dropQueue.push({ value: val, special: null });
          continue;
        } else {
          this.dropQueue.push({ value: 2, special: null });
          continue;
        }
      } else if (this.currentLevelIndex === 1) {
        const tutorialQueue2 = [16, -4, -4, -4, -4];
        if (this.level2Index < tutorialQueue2.length) {
          const val = tutorialQueue2[this.level2Index];
          this.level2Index++;
          this.dropQueue.push({ value: val, special: null });
          continue;
        } else {
          // Smart algorithm for Level 2 to prevent flooding with only one color:
          if (this.getActiveBallValues) {
            const activeValues = this.getActiveBallValues();
            if (activeValues.length > 0) {
              const positives = activeValues.filter(v => v > 0);
              const negatives = activeValues.filter(v => v < 0);
              
              if (positives.length > 0 && negatives.length === 0) {
                // Only positive balls on board -> spawn a negative counterpart
                this.dropQueue.push({ value: -Math.abs(positives[0]), special: null });
                continue;
              } else if (negatives.length > 0 && positives.length === 0) {
                // Only negative balls on board -> spawn a positive counterpart
                this.dropQueue.push({ value: Math.abs(negatives[0]), special: null });
                continue;
              } else {
                // Both positive and negative balls on board -> balance them out
                if (positives.length >= negatives.length) {
                  this.dropQueue.push({ value: -Math.abs(positives[0]), special: null });
                } else {
                  this.dropQueue.push({ value: Math.abs(negatives[0]), special: null });
                }
                continue;
              }
            }
          }
          this.dropQueue.push({ value: -4, special: null });
          continue;
        }
      } else if (this.currentLevelIndex === 2) {
        if (this.level3Index === 0) {
          this.level3Index++;
          this.dropQueue.push({ value: 8, special: null });
          continue;
        } else if (this.level3Index === 1) {
          this.level3Index++;
          this.dropQueue.push({ value: 8, special: null });
          continue;
        } else {
          const isPositive = Math.random() < 0.6;
          let val = 2;
          if (isPositive) {
            const positives = [2, 4, 8];
            val = positives[Math.floor(Math.random() * positives.length)];
          } else {
            const negatives = [-2, -4];
            val = negatives[Math.floor(Math.random() * negatives.length)];
          }
          this.level3Index++;
          this.dropQueue.push({ value: val, special: null });
          continue;
        }
      } else if (this.currentLevelIndex === 3) {
        this.level4Index++;
        if (this.level4Index === 3) {
          // Guarantee an X2 Multiplier early so the player gets to learn it
          this.dropQueue.push({ value: 0, special: 'multiply' });
        } else {
          const rand = Math.random();
          if (rand < 0.50) {
            const positives = [2, 4, 8, 16];
            const val = positives[Math.floor(Math.random() * positives.length)];
            this.dropQueue.push({ value: val, special: null });
          } else if (rand < 0.80) {
            const negatives = [-2, -4, -8];
            const val = negatives[Math.floor(Math.random() * negatives.length)];
            this.dropQueue.push({ value: val, special: null });
          } else {
            // 20% chance of X2 Multiplier ball
            this.dropQueue.push({ value: 0, special: 'multiply' });
          }
        }
        continue;
      } else if (this.currentLevelIndex === 4) {
        // No special balls in Level 5 per requirements. Only standard balls.
        this.level5Index++;
        const pool = this.currentLevel.spawnPool;
        const val = pool[Math.floor(Math.random() * pool.length)];
        this.dropQueue.push({ value: val, special: null });
        continue;
      } else if (this.currentLevelIndex === 5) {
        this.level6Index++;
        if (this.level6Index === 2) {
          // Guarantee a Blast Ball early in Level 6
          this.dropQueue.push({ value: 0, special: 'blast' });
        } else if (this.level6Index === 4) {
          // Guarantee a Slice Ball early in Level 6
          this.dropQueue.push({ value: 0, special: 'slice' });
        } else if (this.level6Index === 6) {
          // Guarantee a Dice Ball early in Level 6
          this.dropQueue.push({ value: 0, special: 'chance' });
        } else {
          const rand = Math.random();
          if (rand < 0.08) {
            this.dropQueue.push({ value: 0, special: 'blast' });
          } else if (rand < 0.16) {
            this.dropQueue.push({ value: 0, special: 'slice' });
          } else if (rand < 0.24) {
            this.dropQueue.push({ value: 0, special: 'chance' });
          } else {
            const pool = this.currentLevel.spawnPool;
            const val = pool[Math.floor(Math.random() * pool.length)];
            this.dropQueue.push({ value: val, special: null });
          }
        }
        continue;
      }

      const pool = this.currentLevel.spawnPool;
      const isSpecial = Math.random() < this.currentLevel.specialChance;

      let value = 2;
      let special: BallSpecial = null;

      if (isSpecial) {
        const randSpecial = Math.random();
        if (randSpecial < 0.20) {
          special = 'multiply';
        } else if (randSpecial < 0.40) {
          special = 'divide';
        } else if (randSpecial < 0.65) {
          special = 'blast';
        } else if (randSpecial < 0.85) {
          special = 'slice';
        } else {
          special = 'chance';
        }
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
