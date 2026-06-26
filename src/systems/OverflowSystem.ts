import Phaser from 'phaser';
import { JellyBall } from '../entities/JellyBall';
import { ObjectPool } from '../core/ObjectPool';
import { OVERFLOW_Y } from '../core/Constants';

/**
 * OverflowSystem — monitors balls crossing the Game Over threshold (red line).
 * Triggers a 3-second panic mode countdown. If the area isn't cleared, game over.
 */
export class OverflowSystem {
  scene: Phaser.Scene;
  ballPool: ObjectPool<JellyBall>;

  isPanicMode: boolean = false;
  panicTimer: number = 0;
  private readonly PANIC_MAX_TIME = 3000; // 3 seconds

  private warningText: Phaser.GameObjects.Text;
  private countdownText: Phaser.GameObjects.Text;
  private onGameOver: () => void;

  constructor(scene: Phaser.Scene, ballPool: ObjectPool<JellyBall>, onGameOver: () => void) {
    this.scene = scene;
    this.ballPool = ballPool;
    this.onGameOver = onGameOver;

    const cx = this.scene.cameras.main.width / 2;
    const cy = OVERFLOW_Y - 40;

    this.warningText = scene.add.text(cx, cy, 'OVERFLOW WARNING!', {
      fontFamily: '"Orbitron", monospace',
      fontSize: '24px',
      color: '#ff2244',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4
    }).setOrigin(0.5).setDepth(40).setVisible(false);

    this.countdownText = scene.add.text(cx, cy + 30, '3.0', {
      fontFamily: '"Orbitron", monospace',
      fontSize: '32px',
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#ff2244',
      strokeThickness: 4
    }).setOrigin(0.5).setDepth(40).setVisible(false);
  }

  /**
   * Check ball positions. Called each frame.
   */
  update(delta: number): void {
    const activeBalls = this.ballPool.getActiveItems();
    let hasOverflow = false;
    const overflowY = (this.scene as any).dynamicOverflowY ?? OVERFLOW_Y;

    // Reposition warnings relative to dynamic overflow line
    if (this.warningText) {
      this.warningText.setY(overflowY - 40);
    }
    if (this.countdownText) {
      this.countdownText.setY(overflowY - 10);
    }

    // Check if any ball (that has settled/isn't currently falling fast from launcher) is above threshold
    for (const ball of activeBalls) {
      if (!ball.active || !ball.body) continue;

      // Ball center is above the red line, and it's settled (very low velocity)
      if (ball.body.position.y - ball.radius < overflowY && Math.abs(ball.body.velocity.y) < 0.5 && Math.abs(ball.body.velocity.x) < 0.5) {
        hasOverflow = true;
        break; // One is enough
      }
    }

    if (hasOverflow) {
      if (!this.isPanicMode) {
        this.startPanic();
      }

      this.panicTimer -= delta;

      // Update text
      const secondsLeft = Math.max(0, this.panicTimer / 1000).toFixed(1);
      this.countdownText.setText(secondsLeft);
      this.countdownText.setScale(1 + 0.1 * Math.sin(this.panicTimer * 0.02)); // Pulse

      if (this.panicTimer <= 0) {
        // TIME UP - GAME OVER
        this.isPanicMode = false;
        this.warningText.setVisible(false);
        this.countdownText.setVisible(false);
        this.onGameOver();
      }
    } else {
      if (this.isPanicMode) {
        this.stopPanic();
      }
    }
  }

  private startPanic(): void {
    this.isPanicMode = true;
    this.panicTimer = this.PANIC_MAX_TIME;
    this.warningText.setVisible(true);
    this.countdownText.setVisible(true);

    // Fade in animation
    this.warningText.setAlpha(0);
    this.countdownText.setAlpha(0);
    this.scene.tweens.add({
      targets: [this.warningText, this.countdownText],
      alpha: 1,
      duration: 200,
    });
  }

  public stopPanic(): void {
    this.isPanicMode = false;
    this.scene.tweens.killTweensOf([this.warningText, this.countdownText]);
    this.warningText.setVisible(false);
    this.countdownText.setVisible(false);
  }
}
