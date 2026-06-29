import Phaser from 'phaser';
import {
  LAUNCHER_Y, LAUNCHER_MIN_X, LAUNCHER_MAX_X, CONTAINER_CENTER_X,
  DROP_COOLDOWN, getBallVisualRadius, CONTAINER_BOTTOM, CONTAINER_TOP,
  CURE_L1_LAUNCHER_Y, GAME_HEIGHT,
} from '../core/Constants';
import {
  factionTexture, BallFaction, applyBallLabelStyle, GREEN_THROWABLE_TEXTURE,
  scaleForThrowableTexture, applyThrowableLabel, throwableLabelFontSize, THROWABLE_LABEL_FONT,
  MUSHROOM_OPAQUE_HALF_W,
} from './BallEntity';

/** Cure mode — mage gloves hold the preview orb between the palms. */
const CURE_GLOVE_SIZE = 68;
const CURE_BALL_PX = 38;
const CURE_BALL_HOLD_Y = 11;
const CURE_GLOVE_Y = 0;
/** Anchor near fingertips so wrists sit above, hands reach down into the arena. */
const CURE_GLOVE_ORIGIN_Y = 0.14;
const NORMAL_BALL_PX = 68;

/**
 * Launcher — the mechanical dropper at the top of the container.
 * Cyberpunk-style hovering machine that auto-moves left/right.
 * Player clicks/taps to drop the ball.
 */
export class Launcher {
  scene: Phaser.Scene;
  container: Phaser.GameObjects.Container;
  bodyGfx: Phaser.GameObjects.Graphics;
  glovesImg: Phaser.GameObjects.Image;
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
  private previewFaction: BallFaction = 'green';
  private invertedMode = false;
  private invertedContainerBottom = CONTAINER_BOTTOM;
  private aimThrottle = false;
  private aimFrame = 0;
  private cureMinimal = false;
  private ballHoldY = 0;
  private idleHoldTween: Phaser.Tweens.Tween | null = null;
  private idleBobTween: Phaser.Tweens.Tween | null = null;

  setAimThrottle(on: boolean): void {
    this.aimThrottle = on;
  }

  setCureMinimal(on: boolean): void {
    this.cureMinimal = on;
    if (on) {
      this.container.setY(CURE_L1_LAUNCHER_Y);
      this.bodyGfx.setVisible(false);
      this.glovesImg.setVisible(true);
      this.ballPreview.setVisible(true);
      this.ballLabel.setVisible(true);
      this.applyCureGloveLayout();
      this.drawPreview();
      this.startHoldIdle();
    } else {
      this.stopHoldIdle();
      this.container.setY(this.invertedMode ? this.invertedContainerBottom + 52 : LAUNCHER_Y);
      this.glovesImg.setVisible(false);
      this.ballPreview.setPosition(0, 0);
      this.ballLabel.setPosition(0, 0);
      this.ballPreview.setVisible(true);
      this.ballLabel.setVisible(true);
      this.bodyGfx.setVisible(true);
      this.drawBody();
    }
  }

  private gloveBaseScale(): number {
    return CURE_GLOVE_SIZE / this.glovesImg.frame.width;
  }

  private applyGloveScale(): void {
    this.glovesImg.setScale(this.gloveBaseScale());
  }

  private applyCureGloveLayout(): void {
    this.ballHoldY = CURE_BALL_HOLD_Y;
    this.glovesImg.setTexture('mage_gloves_clean');
    this.glovesImg.setOrigin(0.5, CURE_GLOVE_ORIGIN_Y);
    this.glovesImg.setAngle(180);
    this.glovesImg.setPosition(0, CURE_GLOVE_Y);
    this.applyGloveScale();

    this.ballPreview.setPosition(0, this.ballHoldY);
    this.ballLabel.setPosition(0, this.ballHoldY);

    this.container.sendToBack(this.aimLine);
    this.container.bringToTop(this.glovesImg);
  }

  private previewPixelSize(): number {
    return this.cureMinimal ? CURE_BALL_PX : NORMAL_BALL_PX;
  }

  private previewBaseScale(): number {
    if (this.cureMinimal && !this.previewSpecial) {
      return this.previewPixelSize() / (MUSHROOM_OPAQUE_HALF_W * 2);
    }
    return this.previewPixelSize() / this.ballPreview.frame.width;
  }

  /** Scale from texture pixels — setDisplaySize alone leaves native 512px in Phaser 4. */
  private applyPreviewScale(): void {
    const s = this.previewBaseScale();
    this.ballPreview.setScale(s);
  }

  private startHoldIdle(): void {
    this.stopHoldIdle();
    this.idleHoldTween = this.scene.tweens.add({
      targets: this.ballPreview,
      y: this.ballHoldY - 2,
      duration: 820,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    this.scene.tweens.add({
      targets: this.ballLabel,
      y: this.ballHoldY - 2,
      duration: 820,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    this.idleBobTween = this.scene.tweens.add({
      targets: this.glovesImg,
      y: CURE_GLOVE_Y + 1,
      duration: 980,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private stopHoldIdle(): void {
    this.idleHoldTween?.stop();
    this.idleHoldTween = null;
    this.idleBobTween?.stop();
    this.idleBobTween = null;
    this.scene.tweens.killTweensOf(this.ballPreview);
    this.scene.tweens.killTweensOf(this.ballLabel);
    this.scene.tweens.killTweensOf(this.glovesImg);
  }

  private playThrowAnimation(): void {
    if (!this.cureMinimal) return;

    this.stopHoldIdle();
    this.applyGloveScale();
    this.applyPreviewScale();
    this.glovesImg.setPosition(0, CURE_GLOVE_Y);
    this.ballPreview.setPosition(0, this.ballHoldY);
    this.ballLabel.setPosition(0, this.ballHoldY);

    // Sadece aşağı itme — scale dokunma (scale tween eldivenleri dev yapıyordu)
    this.scene.tweens.add({
      targets: this.glovesImg,
      y: CURE_GLOVE_Y + 5,
      duration: 65,
      yoyo: true,
      ease: 'Quad.easeOut',
      onComplete: () => this.startHoldIdle(),
    });

    this.scene.tweens.add({
      targets: this.ballPreview,
      y: this.ballHoldY + 8,
      duration: 65,
      yoyo: true,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.applyPreviewScale();
        this.ballPreview.setPosition(0, this.ballHoldY);
      },
    });

    this.scene.tweens.add({
      targets: this.ballLabel,
      y: this.ballHoldY + 8,
      duration: 65,
      yoyo: true,
      ease: 'Quad.easeOut',
      onComplete: () => this.ballLabel.setPosition(0, this.ballHoldY),
    });
  }

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

    this.glovesImg = scene.add.image(0, CURE_GLOVE_Y, 'mage_gloves_clean');
    this.glovesImg.setOrigin(0.5, CURE_GLOVE_ORIGIN_Y);
    this.glovesImg.setVisible(false);
    this.container.add(this.glovesImg);

    // Ball preview (held between mage gloves in cure mode)
    this.ballPreview = scene.add.sprite(0, 0, GREEN_THROWABLE_TEXTURE);
    this.container.add(this.ballPreview);

    this.ballLabel = scene.add.text(0, 0, '', {
      fontFamily: THROWABLE_LABEL_FONT,
      fontSize: '20px',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    applyBallLabelStyle(this.ballLabel, 'green');
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
  setPreview(value: number, special: string | null, faction: BallFaction = 'green'): void {
    this.previewValue = value;
    this.previewSpecial = special;
    this.previewFaction = faction;
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

    this.aimFrame++;
    if (!this.aimThrottle || this.aimFrame % 3 === 0) {
      this.drawAimLine(time);
    }
  }

  /**
   * Attempt to drop. Returns true if drop happened.
   */
  tryDrop(time: number): boolean {
    if (!this.canDrop) return false;
    this.canDrop = false;
    this.lastDropTime = time;

    const baseY = this.container.y;
    if (this.cureMinimal) {
      this.playThrowAnimation();
    } else {
      this.scene.tweens.add({
        targets: this.container,
        y: this.invertedMode ? baseY - 8 : baseY + 8,
        duration: 60,
        yoyo: true,
        ease: 'Sine.easeOut',
      });
    }

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
    if (this.cureMinimal) {
      return this.container.y + this.ballHoldY + 18;
    }
    if (this.invertedMode) {
      return this.invertedContainerBottom - 28;
    }
    return this.container.y + 36;
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
    } else {
      const absVal = Math.abs(this.previewValue);
      const tex = factionTexture(this.previewFaction);
      this.ballPreview.setTexture(tex);
      this.ballPreview.clearTint();
      const visualR = getBallVisualRadius(absVal);
      const s = scaleForThrowableTexture(tex, visualR) * (this.previewPixelSize() / (visualR * 2));
      this.ballPreview.setScale(s);
      this.ballPreview.setX(0);
    }

    if (this.cureMinimal) {
      this.ballPreview.setPosition(0, this.ballHoldY);
      this.layoutPreviewLabel();
      return;
    }

    this.applyPreviewScale();
    this.ballLabel.setPosition(0, 0);
    this.ballLabel.setFontSize('20px');
    this.ballLabel.setVisible(true);

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
    applyBallLabelStyle(this.ballLabel, this.previewFaction);
  }

  private layoutPreviewLabel(): void {
    if (this.previewSpecial) {
      this.ballLabel.setText('');
      this.ballLabel.setVisible(false);
      return;
    }
    this.ballLabel.setVisible(true);
    const absVal = Math.abs(this.previewValue);
    const visualR = getBallVisualRadius(absVal);
    this.ballLabel.setFontSize(throwableLabelFontSize(visualR, absVal));
    applyBallLabelStyle(this.ballLabel, this.previewFaction);
    const prefix = this.previewValue > 0 ? '+' : '';
    this.ballLabel.setText(`${prefix}${this.previewValue}`);
    applyThrowableLabel(this.ballLabel, visualR, this.ballHoldY);
  }

  private drawAimLine(time: number): void {
    this.aimLine.clear();
    const alpha = this.cureMinimal ? 0.12 : 0.2 + 0.15 * Math.sin(time * 0.005);
    this.aimLine.lineStyle(this.cureMinimal ? 1 : 2, this.cureMinimal ? 0x475569 : 0x00ccff, alpha);

    if (this.invertedMode) {
      const startY = -32;
      const endY = -(this.invertedContainerBottom - CONTAINER_TOP - 40);
      this.aimLine.beginPath();
      this.aimLine.moveTo(0, startY);
      this.aimLine.lineTo(0, endY);
      this.aimLine.strokePath();
    } else {
      const startY = this.cureMinimal ? this.ballHoldY + 18 : 32;
      const endY = GAME_HEIGHT - this.container.y - 36;
      this.aimLine.beginPath();
      this.aimLine.moveTo(0, startY);
      this.aimLine.lineTo(0, endY);
      this.aimLine.strokePath();
    }
  }
}
