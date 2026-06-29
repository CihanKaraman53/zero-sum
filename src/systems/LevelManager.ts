import { LevelConfig, LEVEL } from '../data/levels';
import { ScoringSystem } from './ScoringSystem';
import { BallSpecial, BallFaction } from '../entities/JellyBall';

export interface DropQueueItem {
  value: number;
  faction: BallFaction;
  special: BallSpecial;
}

/**
 * LevelManager — spawn queue and tutorial progression for the single chapter.
 */
export class LevelManager {
  currentLevel: LevelConfig = LEVEL;
  scoring: ScoringSystem;

  hasWon = false;
  dropQueue: DropQueueItem[] = [];

  private tutorialIndex = 0;
  /** Level 1 — green only; mostly +, rare −. */
  private readonly tutorialQueue: DropQueueItem[] = [];
  private readonly queueSize = 3;
  /** ~15% of drops are negative (same green orb). */
  private readonly negativeSpawnChance = 0.15;

  constructor(scoring: ScoringSystem) {
    this.scoring = scoring;
    this.reset();
  }

  reset(): void {
    this.hasWon = false;
    this.tutorialIndex = 0;
    this.scoring.reset();
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

  private refillQueue(): void {
    while (this.dropQueue.length < this.queueSize) {
      if (this.tutorialIndex < this.tutorialQueue.length) {
        this.dropQueue.push(this.tutorialQueue[this.tutorialIndex++]);
      } else {
        const pool = this.currentLevel.spawnPool;
        const absVal = pool[Math.floor(Math.random() * pool.length)];
        const negative = Math.random() < this.negativeSpawnChance;
        const value = negative ? -absVal : absVal;
        this.dropQueue.push({ value, faction: 'green', special: null });
      }
    }
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
