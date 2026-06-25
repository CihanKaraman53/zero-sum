import Phaser from 'phaser';
import {
  LAUNCHER_Y, LAUNCHER_MIN_X, LAUNCHER_MAX_X, CONTAINER_CENTER_X,
  DROP_COOLDOWN, CONTAINER_BORDER_COLOR
} from '../core/Constants';

/**
 * Launcher — the mechanical dropper at the top of the container.
 * Cyberpunk-style hovering machine that auto-moves left/right.
 * Player clicks/taps to drop the ball.
 */
export class Launcher {
  scene: Phaser.Scene;
  container: Phaser.GameObjects.Container;
  bodyGfx: Phaser.GameObjects.Graphics;
  aimLine: Phaser.GameObjects.Graphics;
  ballPreview: Phaser.GameObjects.Graphics;
  ballLabel: Phaser.GameObjects.Text;

  x: number = CONTAINER_CENTER_X;
  direction: number = 1;
  speed: number = 1.5;
  canDrop: boolean = true;
  lastDropTime: number = 0;
  isPlayerControlled: boolean = false;

  // Current ball info for preview
  private previewValue: number = 2;
  private previewSpecial: string | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    this.container = scene.add.container(this.x, LAUNCHER_Y);
    this.container.setDepth(20);

    // Aim line (dashed vertical line down)
    this.aimLine = scene.add.graphics();
    this.container.add(this.aimLine);

    // Main body
    this.bodyGfx = scene.add.graphics();
    this.container.add(this.bodyGfx);

    // Ball preview (mini ball inside launcher)
    this.ballPreview = scene.add.graphics();
    this.container.add(this.ballPreview);

    this.ballLabel = scene.add.text(0, 0, '', {
      fontFamily: '"Orbitron", monospace',
      fontSize: '12px',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 1,
    }).setOrigin(0.5);
    this.container.add(this.ballLabel);

    this.drawBody();
  }

  /**
   * Set the preview ball info.
   */
  setPreview(value: number, special: string | null): void {
    this.previewValue = value;
    this.previewSpecial = special;
    this.drawPreview();
  }

  /**
   * Update launcher position each frame.
   */
  update(time: number, pointerX: number | null): void {
    // Cooldown check
    if (!this.canDrop && time - this.lastDropTime > DROP_COOLDOWN) {
      this.canDrop = true;
    }

    // Movement
    if (pointerX !== null && this.isPlayerControlled) {
      // Player is controlling — follow pointer X
      this.x = Phaser.Math.Clamp(pointerX, LAUNCHER_MIN_X, LAUNCHER_MAX_X);
    } else {
      // Auto-sway
      this.x += this.direction * this.speed;
      if (this.x >= LAUNCHER_MAX_X) {
        this.x = LAUNCHER_MAX_X;
        this.direction = -1;
      } else if (this.x <= LAUNCHER_MIN_X) {
        this.x = LAUNCHER_MIN_X;
        this.direction = 1;
      }
    }

    this.container.setX(this.x);

    // Aim line pulse
    this.drawAimLine(time);
  }

  /**
   * Attempt to drop. Returns true if drop happened.
   */
  tryDrop(time: number): boolean {
    if (!this.canDrop) return false;
    this.canDrop = false;
    this.lastDropTime = time;

    // Drop animation
    this.scene.tweens.add({
      targets: this.container,
      y: LAUNCHER_Y + 8,
      duration: 60,
      yoyo: true,
      ease: 'Sine.easeOut',
    });

    return true;
  }

  setSpeed(speed: number): void {
    this.speed = speed;
  }

  getX(): number {
    return this.x;
  }

  getDropY(): number {
    return LAUNCHER_Y + 20;
  }

  private drawBody(): void {
    this.bodyGfx.clear();

    // Main housing
    this.bodyGfx.fillStyle(0x1a1a2e, 1);
    this.bodyGfx.fillRoundedRect(-22, -18, 44, 36, 6);

    // Border glow
    this.bodyGfx.lineStyle(2, CONTAINER_BORDER_COLOR, 0.8);
    this.bodyGfx.strokeRoundedRect(-22, -18, 44, 36, 6);

    // Inner mechanism circle
    this.bodyGfx.fillStyle(0x0a0a1a, 1);
    this.bodyGfx.fillCircle(0, 0, 14);
    this.bodyGfx.lineStyle(1.5, 0x00ccff, 0.6);
    this.bodyGfx.strokeCircle(0, 0, 14);

    // Neon dots on sides
    this.bodyGfx.fillStyle(0x00ccff, 0.8);
    this.bodyGfx.fillCircle(-17, -10, 2);
    this.bodyGfx.fillCircle(17, -10, 2);
    this.bodyGfx.fillCircle(-17, 10, 2);
    this.bodyGfx.fillCircle(17, 10, 2);

    // Bottom nozzle
    this.bodyGfx.fillStyle(0x2a2a4e, 1);
    this.bodyGfx.fillRect(-6, 16, 12, 6);
    this.bodyGfx.lineStyle(1, CONTAINER_BORDER_COLOR, 0.6);
    this.bodyGfx.strokeRect(-6, 16, 12, 6);
  }

  private drawPreview(): void {
    this.ballPreview.clear();
    const r = 10;

    let color: number;
    if (this.previewSpecial) {
      color = 0x00ccff;
    } else if (this.previewValue > 0) {
      color = 0x00ff88;
    } else {
      color = 0xff3388;
    }

    this.ballPreview.fillStyle(color, 0.7);
    this.ballPreview.fillCircle(0, 0, r);
    this.ballPreview.lineStyle(1, color, 1);
    this.ballPreview.strokeCircle(0, 0, r);

    if (this.previewSpecial === 'multiply') {
      this.ballLabel.setText('×2');
    } else if (this.previewSpecial === 'divide') {
      this.ballLabel.setText('÷2');
    } else {
      const prefix = this.previewValue > 0 ? '+' : '';
      this.ballLabel.setText(`${prefix}${this.previewValue}`);
    }
  }

  private drawAimLine(time: number): void {
    this.aimLine.clear();
    const alpha = 0.15 + 0.1 * Math.sin(time * 0.004);
    this.aimLine.lineStyle(1, 0x00ccff, alpha);

    // Dashed line
    const startY = 22;
    const endY = 200;
    const dashLen = 8;
    const gapLen = 6;
    let y = startY;
    while (y < endY) {
      const end = Math.min(y + dashLen, endY);
      this.aimLine.beginPath();
      this.aimLine.moveTo(0, y);
      this.aimLine.lineTo(0, end);
      this.aimLine.strokePath();
      y = end + gapLen;
    }
  }
}
