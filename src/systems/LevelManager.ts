import { LevelConfig, LEVEL } from '../data/levels';
import { ScoringSystem } from './ScoringSystem';
import { BallSpecial } from '../entities/JellyBall';

export interface DropQueueItem {
  value: number;
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
  private readonly tutorialQueue = [2, 2, 4, -8];
  private readonly queueSize = 3;

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
        const val = this.tutorialQueue[this.tutorialIndex++];
        this.dropQueue.push({ value: val, special: null });
      } else {
        this.dropQueue.push({ value: 2, special: null });
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
