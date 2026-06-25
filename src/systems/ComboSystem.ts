import { COMBO_TIMEOUT, BLACK_HOLE_TRIGGER } from '../core/Constants';

/**
 * ComboSystem — tracks consecutive Zero Sum chains.
 * Triggers Black Hole when threshold reached.
 */
export class ComboSystem {
  comboCount: number = 0;
  maxCombo: number = 0;
  lastZeroSumTime: number = 0;
  blackHoleReady: boolean = false;
  private onBlackHoleTrigger: (() => void) | null = null;

  constructor(onBlackHoleTrigger?: () => void) {
    this.onBlackHoleTrigger = onBlackHoleTrigger || null;
  }

  reset(): void {
    this.comboCount = 0;
    this.maxCombo = 0;
    this.lastZeroSumTime = 0;
    this.blackHoleReady = false;
  }

  /**
   * Register a Zero Sum event. Returns current combo count.
   */
  registerZeroSum(time: number): number {
    // Check if within combo window
    if (time - this.lastZeroSumTime > COMBO_TIMEOUT && this.comboCount > 0) {
      this.comboCount = 0;
    }

    this.comboCount++;
    this.lastZeroSumTime = time;

    if (this.comboCount > this.maxCombo) {
      this.maxCombo = this.comboCount;
    }

    // Black hole trigger check
    if (this.comboCount >= BLACK_HOLE_TRIGGER && !this.blackHoleReady) {
      this.blackHoleReady = true;
      if (this.onBlackHoleTrigger) {
        this.onBlackHoleTrigger();
      }
    }

    return this.comboCount;
  }

  /**
   * Check if combo has expired. Called each frame.
   */
  update(time: number): void {
    if (this.comboCount > 0 && time - this.lastZeroSumTime > COMBO_TIMEOUT) {
      this.comboCount = 0;
      this.blackHoleReady = false;
    }
  }

  consumeBlackHole(): void {
    this.blackHoleReady = false;
    this.comboCount = 0;
  }

  getMultiplier(): number {
    return Math.max(1, this.comboCount);
  }
}
