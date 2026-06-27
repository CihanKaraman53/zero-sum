import Phaser from 'phaser';
import {
  LAUNCHER_Y, LAUNCHER_MIN_X, LAUNCHER_MAX_X, CONTAINER_CENTER_X,
  DROP_COOLDOWN, CONTAINER_BORDER_COLOR, getBallRadius, CONTAINER_BOTTOM, CONTAINER_TOP
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
  ballPreview: Phaser.GameObjects.Sprite;
  ballLabel: Phaser.GameObjects.Text;

  x: number = CONTAINER_CENTER_X;
  direction: number = 1;
  speed: number = 1.5;
  canDrop: boolean = true;
  lastDropTime: number = 0;
  isPlayerControlled: boolean = false;

  minX: number = LAUNCHER_MIN_X;
  maxX: number = LAUNCHER_MAX_X;
  private previewValue: number = 2;
  private previewSpecial: string | null = null;
  private invertedMode = false;
  private invertedContainerBottom = CONTAINER_BOTTOM;

  updateBounds(minX: number, maxX: number): void {
    this.minX = minX;
    this.maxX = maxX;
    this.x = Phaser.Math.Clamp(this.x, this.minX, this.maxX);
  }

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    this.container = scene.add.container(this.x, LAUNCHER_Y);
    this.container.setDepth(20);

    // Aim line (dashed vertical line down)
    this.aimLine = scene.add.graphics();
    this.container.add(this.aimLine);

    // Main body - premium cyberpunk launcher drawn dynamically
    this.bodyGfx = scene.add.graphics();
    this.container.add(this.bodyGfx);

    // Ball preview (mini ball inside launcher)
    this.ballPreview = scene.add.sprite(0, 0, 'positive_ball');
    this.container.add(this.ballPreview);

    this.ballLabel = scene.add.text(0, 0, '', {
      fontFamily: '"Orbitron", monospace',
      fontSize: '18px', // Slightly larger font since launcher is bigger
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5);
    this.container.add(this.ballLabel);

    this.drawBody();
  }

  private drawBody(): void {
    this.bodyGfx.clear();

    // 1. Sleek Cyberpunk stabilizer wings
    // Dark steel metallic base
    this.bodyGfx.fillStyle(0x111625, 0.95);
    // Left wing
    this.bodyGfx.fillRoundedRect(-110, -10, 80, 20, 4);
    // Right wing
    this.bodyGfx.fillRoundedRect(30, -10, 80, 20, 4);

    // Neon highlight lines on the stabilizer wings
    this.bodyGfx.lineStyle(1.5, 0x00ccff, 0.8);
    this.bodyGfx.strokeRoundedRect(-110, -10, 80, 20, 4);
    this.bodyGfx.strokeRoundedRect(30, -10, 80, 20, 4);

    // Inner wing circuit details
    this.bodyGfx.lineStyle(1, 0x00ff88, 0.5);
    this.bodyGfx.lineBetween(-100, 0, -40, 0);
    this.bodyGfx.lineBetween(40, 0, 100, 0);

    // LED indicators on stabilizer wings
    this.bodyGfx.fillStyle(0x00ff88, 0.8);
    this.bodyGfx.fillCircle(-90, 0, 2.5);
    this.bodyGfx.fillCircle(90, 0, 2.5);

    // 2. Central circular housing (holding the ball)
    // Outer metallic ring
    this.bodyGfx.fillStyle(0x1a2135, 1);
    this.bodyGfx.fillCircle(0, 0, 36);
    this.bodyGfx.lineStyle(3, 0x00ccff, 1);
    this.bodyGfx.strokeCircle(0, 0, 36);

    // Inner glowing ring
    this.bodyGfx.lineStyle(1.5, 0x00ff88, 0.7);
    this.bodyGfx.strokeCircle(0, 0, 28);

    // 3. Cyber claws gripping the ball (styled as small curved mechanical claws)
    this.bodyGfx.fillStyle(0x2a354d, 1);
    this.bodyGfx.lineStyle(1.5, 0x00ccff, 0.8);
    
    // Left claw shape
    this.bodyGfx.beginPath();
    this.bodyGfx.moveTo(-34, -10);
    this.bodyGfx.lineTo(-24, 0);
    this.bodyGfx.lineTo(-34, 10);
    this.bodyGfx.closePath();
    this.bodyGfx.fillPath();
    this.bodyGfx.strokePath();

    // Right claw shape
    this.bodyGfx.beginPath();
    this.bodyGfx.moveTo(34, -10);
    this.bodyGfx.lineTo(24, 0);
    this.bodyGfx.lineTo(34, 10);
    this.bodyGfx.closePath();
    this.bodyGfx.fillPath();
    this.bodyGfx.strokePath();
    
    // Small glowing power core at top center
    this.bodyGfx.fillStyle(0x00ccff, 0.9);
    this.bodyGfx.fillCircle(0, -32, 4);
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
      this.x = Phaser.Math.Clamp(pointerX, this.minX, this.maxX);
    } else {
      // Auto-sway
      this.x += this.direction * this.speed;
      if (this.x >= this.maxX) {
        this.x = this.maxX;
        this.direction = -1;
      } else if (this.x <= this.minX) {
        this.x = this.minX;
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

    const baseY = this.container.y;
    this.scene.tweens.add({
      targets: this.container,
      y: this.invertedMode ? baseY - 8 : baseY + 8,
      duration: 60,
      yoyo: true,
      ease: 'Sine.easeOut',
    });

    return true;
  }

  setSpeed(speed: number): void {
    this.speed = speed;
  }

  setInvertedMode(on: boolean, containerBottom?: number): void {
    this.invertedMode = on;
    if (on) {
      this.invertedContainerBottom = containerBottom ?? CONTAINER_BOTTOM;
      this.container.setY(this.invertedContainerBottom + 52);
      this.container.setAngle(180);
    } else {
      this.container.setY(LAUNCHER_Y);
      this.container.setAngle(0);
    }
    this.drawBody();
  }

  getX(): number {
    return this.x;
  }

  getDropY(): number {
    if (this.invertedMode) {
      return this.invertedContainerBottom - 28;
    }
    return LAUNCHER_Y + 20;
  }



  private drawPreview(): void {
    if (this.previewSpecial === 'multiply') {
      this.ballPreview.setTexture('x2_ball');
      this.ballPreview.clearTint();
    } else if (this.previewSpecial === 'blast') {
      this.ballPreview.setTexture('blast_ball');
      this.ballPreview.clearTint();
    } else if (this.previewSpecial === 'slice') {
      this.ballPreview.setTexture('slice_ball');
      this.ballPreview.clearTint();
    } else if (this.previewSpecial === 'chance') {
      this.ballPreview.setTexture('dice_ball');
      this.ballPreview.clearTint();
    } else if (this.previewSpecial) {
      this.ballPreview.setTexture('positive_ball');
      this.ballPreview.setTint(0x00ccff);
    } else if (this.previewValue > 0) {
      this.ballPreview.setTexture('positive_ball');
      this.ballPreview.clearTint();
    } else {
      this.ballPreview.setTexture('negative_ball');
      this.ballPreview.clearTint();
    }

    // All preview balls appear uniform in size inside the launcher housing
    const radius = 34;
    this.ballPreview.setDisplaySize(radius * 2, radius * 2);

    if (this.previewSpecial === 'multiply') {
      this.ballLabel.setText('×2');
    } else if (this.previewSpecial === 'divide') {
      this.ballLabel.setText('÷2');
    } else if (this.previewSpecial === 'blast' || this.previewSpecial === 'slice' || this.previewSpecial === 'chance') {
      this.ballLabel.setText('');
    } else {
      const prefix = this.previewValue > 0 ? '+' : '';
      this.ballLabel.setText(`${prefix}${this.previewValue}`);
    }
  }

  private drawAimLine(time: number): void {
    this.aimLine.clear();
    const alpha = 0.2 + 0.15 * Math.sin(time * 0.005);
    this.aimLine.lineStyle(2, 0x00ccff, alpha);

    if (this.invertedMode) {
      const startY = -32;
      const endY = -(this.invertedContainerBottom - CONTAINER_TOP - 40);
      this.aimLine.beginPath();
      this.aimLine.moveTo(0, startY);
      this.aimLine.lineTo(0, endY);
      this.aimLine.strokePath();
    } else {
      const startY = 32;
      const endY = 800;
      this.aimLine.beginPath();
      this.aimLine.moveTo(0, startY);
      this.aimLine.lineTo(0, endY);
      this.aimLine.strokePath();
    }
  }
}
