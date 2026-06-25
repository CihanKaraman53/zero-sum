import {
  SCORE_MERGE_BASE, SCORE_ZEROSUM_BASE, SCORE_SHRINK_BASE, SCORE_BLACKHOLE_BASE
} from '../core/Constants';

/**
 * ScoringSystem — tracks score, high score, combo multiplier.
 * High score persisted in localStorage.
 */
export class ScoringSystem {
  score: number = 0;
  highScore: number = 0;
  private comboMultiplier: number = 1;

  constructor() {
    this.loadHighScore();
  }

  reset(): void {
    this.score = 0;
    this.comboMultiplier = 1;
  }

  setComboMultiplier(mult: number): void {
    this.comboMultiplier = mult;
  }

  addMerge(absValue: number): number {
    const points = absValue * SCORE_MERGE_BASE * this.comboMultiplier;
    this.score += points;
    this.checkHighScore();
    return points;
  }

  addZeroSum(absValue: number): number {
    const points = absValue * SCORE_ZEROSUM_BASE * this.comboMultiplier;
    this.score += points;
    this.checkHighScore();
    return points;
  }

  addShrink(smallAbsValue: number): number {
    const points = smallAbsValue * SCORE_SHRINK_BASE * this.comboMultiplier;
    this.score += points;
    this.checkHighScore();
    return points;
  }

  addBlackHoleClear(totalDestroyed: number): number {
    const points = totalDestroyed * SCORE_BLACKHOLE_BASE * this.comboMultiplier;
    this.score += points;
    this.checkHighScore();
    return points;
  }

  private checkHighScore(): void {
    if (this.score > this.highScore) {
      this.highScore = this.score;
      this.saveHighScore();
    }
  }

  private loadHighScore(): void {
    try {
      const saved = localStorage.getItem('zsd_highscore');
      this.highScore = saved ? parseInt(saved, 10) : 0;
    } catch {
      this.highScore = 0;
    }
  }

  private saveHighScore(): void {
    try {
      localStorage.setItem('zsd_highscore', this.highScore.toString());
    } catch { /* silently fail */ }
  }
}
