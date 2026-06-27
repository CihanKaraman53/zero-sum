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
  dropsRemaining: number = 0;
  dropsTotal: number = 0;
  surviveTimeRemaining: number = 0;
  zeroSumCount: number = 0;
  forgedPositiveFusion: boolean = false;
  forgedNegativeFusion: boolean = false;

  // Drop queue (next 2 balls)
  dropQueue: DropQueueItem[] = [];

  // Helper to fetch active ball values from the scene
  public getActiveBallValues?: () => number[];
  public getActiveBallCount?: () => number;
  public getActiveFrozenCount?: () => number;

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
  private level4MultiplyUsed: boolean = false;
  private level5MultiplyUsed: boolean = false;
  private   level7DropIndex: number = 0;
  level8DropIndex: number = 0;
  /** Level 8: after cup flip, launcher spawns positive (green) balls. */
  level8FlipComplete: boolean = false;
  private level7PlusDropIndex: number = 0;
  private level7PlusSpecialUsed: boolean = false;
  private level9DropIndex: number = 0;
  private level9Plus16Sent: boolean = false;
  private level9Minus16Sent: boolean = false;
  private level10DropIndex: number = 0;
  private level10Bag: number[] = [];
  private readonly level6FixedSpecials: BallSpecial[] = ['blast', 'slice', 'chance'];
  private readonly level6SpecialAt = [8, 16, 24];

  loadLevel(index: number): void {
    if (index >= LEVELS.length) {
      // Loop or handle victory — for now, loop the last level with harder settings
      index = LEVELS.length - 1;
    }

    this.currentLevelIndex = index;
    this.currentLevel = LEVELS[index];
    this.hasWon = false;
    this.clearedFrozenBalls = 0;
    this.dropsTotal = this.currentLevel.dropLimit ?? 0;
    this.dropsRemaining = this.dropsTotal;
    this.surviveTimeRemaining = (this.currentLevel.surviveSeconds ?? 0) * 1000;
    this.zeroSumCount = 0;
    this.forgedPositiveFusion = false;
    this.forgedNegativeFusion = false;
    this.scoring.reset();
    
    if (index === 0) {
      this.level1Index = 0;
    } else if (index === 1) {
      this.level2Index = 0;
    } else if (index === 2) {
      this.level3Index = 0;
    } else if (index === 3) {
      this.level4Index = 0;
      this.level4MultiplyUsed = false;
    } else if (index === 4) {
      this.level5Index = 0;
      this.level5MultiplyUsed = false;
    } else if (index === 5) {
      this.level6Index = 0;
    } else if (index === 6) {
      this.level7DropIndex = 0;
    } else if (index === 7) {
      this.level8DropIndex = 0;
      this.level8FlipComplete = false;
    } else if (index === 8) {
      this.level9DropIndex = 0;
      this.level9Plus16Sent = false;
      this.level9Minus16Sent = false;
    } else if (index === 9) {
      this.level10DropIndex = 0;
      this.refillLevel10Bag();
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
        if (this.level4Index === 3 && !this.level4MultiplyUsed) {
          this.level4MultiplyUsed = true;
          this.dropQueue.push({ value: 0, special: 'multiply' });
        } else {
          const isPositive = Math.random() < 0.5;
          if (isPositive) {
            const positives = [2, 4, 8, 16];
            const val = positives[Math.floor(Math.random() * positives.length)];
            this.dropQueue.push({ value: val, special: null });
          } else {
            const negatives = [-2, -4, -8];
            const val = negatives[Math.floor(Math.random() * negatives.length)];
            this.dropQueue.push({ value: val, special: null });
          }
        }
        continue;
      } else if (this.currentLevelIndex === 4) {
        this.level5Index++;
        const pool = this.currentLevel.spawnPool;

        if (this.level5Index <= 10) {
          const val = pool[Math.floor(Math.random() * pool.length)];
          this.dropQueue.push({ value: val, special: null });
        } else if (!this.level5MultiplyUsed) {
          this.level5MultiplyUsed = true;
          this.dropQueue.push({ value: 0, special: 'multiply' });
        } else {
          const val = pool[Math.floor(Math.random() * pool.length)];
          this.dropQueue.push({ value: val, special: null });
        }
        continue;
      } else if (this.currentLevelIndex === 5) {
        this.level6Index++;
        const idx = this.level6Index;

        if (idx === 8 || idx === 16 || idx === 24) {
          const slot = this.level6SpecialAt.indexOf(idx);
          this.dropQueue.push({ value: 0, special: this.level6FixedSpecials[slot] });
        } else {
          const pool = this.currentLevel.spawnPool;
          const val = pool[Math.floor(Math.random() * pool.length)];
          this.dropQueue.push({ value: val, special: null });
        }
        continue;
      } else if (this.currentLevelIndex === 6) {
        this.level7DropIndex++;
        const idx = this.level7DropIndex;
        const pool = this.currentLevel.spawnPool;

        if (idx === 15) {
          this.dropQueue.push({ value: 0, special: 'blast' });
        } else if (idx === 45) {
          this.dropQueue.push({ value: 0, special: 'slice' });
        } else {
          const val = pool[Math.floor(Math.random() * pool.length)];
          this.dropQueue.push({ value: val, special: null });
        }
        continue;
      } else if (this.currentLevelIndex === 7) {
        this.level8DropIndex++;
        if (this.level8FlipComplete) {
          const mixed = [2, -2, 4, -4, 8, -8];
          const val = mixed[Math.floor(Math.random() * mixed.length)];
          this.dropQueue.push({ value: val, special: null });
        } else {
          const negatives = [-2, -4, -8];
          const val = negatives[Math.floor(Math.random() * negatives.length)];
          this.dropQueue.push({ value: val, special: null });
        }
        continue;
      } else if (this.currentLevelIndex === 8) {
        this.level9DropIndex++;
        const idx = this.level9DropIndex;
        const pool = [2, -2, 4, -4, 8, -8];

        if (!this.level9Plus16Sent && idx === 8) {
          this.level9Plus16Sent = true;
          this.dropQueue.push({ value: 16, special: null });
        } else if (!this.level9Minus16Sent && idx === 16) {
          this.level9Minus16Sent = true;
          this.dropQueue.push({ value: -16, special: null });
        } else {
          const val = pool[Math.floor(Math.random() * pool.length)];
          this.dropQueue.push({ value: val, special: null });
        }
        continue;
      } else if (this.currentLevelIndex === 9) {
        this.level10DropIndex++;
        if (this.level10Bag.length === 0) this.refillLevel10Bag();
        const val = this.level10Bag.pop()!;
        this.dropQueue.push({ value: val, special: null });
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

  hasDropLimit(): boolean {
    return this.dropsTotal > 0;
  }

  registerDropUsed(): void {
    if (this.dropsRemaining > 0) {
      this.dropsRemaining--;
    }
  }

  isOutOfDrops(): boolean {
    return this.hasDropLimit() && this.dropsRemaining <= 0;
  }

  hasTimeSurvival(): boolean {
    const t = this.currentLevel.type;
    return (t === 'time_survival' || t === 'empty_board') && (this.currentLevel.surviveSeconds ?? 0) > 0;
  }

  hasEmptyBoardGoal(): boolean {
    return this.currentLevel.type === 'empty_board';
  }

  getLevel8DropCount(): number {
    return this.level8DropIndex;
  }

  /** Called once when the Level 8 cup finishes its 360° spin. */
  markLevel8FlipComplete(): void {
    if (this.currentLevelIndex !== 7 || this.level8FlipComplete) return;
    this.level8FlipComplete = true;
    this.dropQueue = [];
    this.refillQueue();
  }

  hasZeroSumGoal(): boolean {
    return this.hasTimeSurvival() && (this.currentLevel.zeroSumTarget ?? 0) > 0;
  }

  getSurvivalSecondsRemaining(): number {
    return Math.max(0, Math.ceil(this.surviveTimeRemaining / 1000));
  }

  tickSurvival(deltaMs: number): void {
    if (!this.hasTimeSurvival() || this.hasWon) return;
    this.surviveTimeRemaining = Math.max(0, this.surviveTimeRemaining - deltaMs);
  }

  isSurvivalTimeExpired(): boolean {
    return this.hasTimeSurvival() && this.surviveTimeRemaining <= 0 && !this.hasWon;
  }

  hasAnchorClearGoal(): boolean {
    return this.currentLevelIndex === 9;
  }

  registerZeroSum(): void {
    if (!this.hasZeroSumGoal()) return;
    this.zeroSumCount++;
    if (this.zeroSumCount >= (this.currentLevel.zeroSumTarget ?? 0)) {
      this.hasWon = true;
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
    } else if (this.hasAnchorClearGoal()) {
      if (this.getActiveFrozenCount && this.getActiveFrozenCount() === 0) {
        this.hasWon = true;
        return true;
      }
      return false;
    } else if (this.currentLevel.type === 'board_clear') {
      if (this.currentLevel.clearCount && this.clearedFrozenBalls >= this.currentLevel.clearCount) {
        this.hasWon = true;
        return true;
      }
    } else if (this.currentLevel.type === 'time_survival') {
      return this.hasWon;
    } else if (this.currentLevel.type === 'empty_board') {
      if (this.getActiveBallCount && this.getActiveBallCount() === 0) {
        this.hasWon = true;
        return true;
      }
      return false;
    }
    // 'fusion_goal' is checked externally when a merge happens

    return false;
  }

  registerFusion(value: number): void {
    if (this.currentLevel.type !== 'fusion_goal' || !this.currentLevel.fusionTarget) return;

    const target = this.currentLevel.fusionTarget;

    if (this.currentLevel.dualFusion) {
      if (value >= target) this.forgedPositiveFusion = true;
      if (value <= -target) this.forgedNegativeFusion = true;
      if (this.forgedPositiveFusion && this.forgedNegativeFusion) {
        this.hasWon = true;
      }
    } else if (value > 0 && value >= target) {
      this.hasWon = true;
    }
  }

  hasDualFusionGoal(): boolean {
    return this.currentLevel.type === 'fusion_goal' && !!this.currentLevel.dualFusion;
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
    if (this.hasDropLimit()) {
      return this.dropsTotal > 0 ? 1 - this.dropsRemaining / this.dropsTotal : 0;
    } else if (this.hasAnchorClearGoal()) {
      const start = this.currentLevel.clearCount ?? 10;
      const left = this.getActiveFrozenCount?.() ?? start;
      return Math.min(1, Math.max(0, (start - left) / start));
    } else if (this.currentLevel.type === 'score_attack') {
      return Math.min(1, this.scoring.score / (this.currentLevel.targetScore || 1));
    } else if (this.currentLevel.type === 'board_clear') {
      return Math.min(1, this.clearedFrozenBalls / (this.currentLevel.clearCount || 1));
    } else if (this.currentLevel.type === 'fusion_goal') {
      return this.hasWon ? 1 : 0;
    } else if (this.currentLevel.type === 'time_survival') {
      if (this.hasZeroSumGoal()) {
        const target = this.currentLevel.zeroSumTarget ?? 1;
        return Math.min(1, this.zeroSumCount / target);
      }
      const total = (this.currentLevel.surviveSeconds ?? 1) * 1000;
      return total > 0 ? 1 - this.surviveTimeRemaining / total : 0;
    } else if (this.currentLevel.type === 'empty_board') {
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

  private refillLevel10Bag(): void {
    this.level10Bag = [2, -2, 4, -4, 8, -8, 2, -2, 4, -4, 8, -8];
    for (let i = this.level10Bag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = this.level10Bag[i];
      this.level10Bag[i] = this.level10Bag[j];
      this.level10Bag[j] = tmp;
    }
  }

  private pickRandomSpecial(): BallSpecial {
    const roll = Math.random();
    if (roll < 0.20) return 'multiply';
    if (roll < 0.35) return 'divide';
    if (roll < 0.55) return 'blast';
    if (roll < 0.75) return 'slice';
    return 'chance';
  }
}
