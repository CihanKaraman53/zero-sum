import Phaser from 'phaser';
import {
  GAME_WIDTH, GAME_HEIGHT, CONTAINER_LEFT, CONTAINER_RIGHT,
  CONTAINER_TOP, CONTAINER_BOTTOM, CONTAINER_BORDER_COLOR, OVERFLOW_Y, OVERFLOW_COLOR
} from '../core/Constants';

/**
 * Background — cyberpunk neon atmosphere rendered entirely in Phaser Canvas.
 * Full-screen unified backdrop; centered play tube rotates as one unit.
 */
export class Background {
  scene: Phaser.Scene;
  private bgGfx: Phaser.GameObjects.Graphics;
  private gridContainer: Phaser.GameObjects.Container;
  private cupVisual: Phaser.GameObjects.Container;
  private interiorGfx: Phaser.GameObjects.Graphics;
  private gridGfx: Phaser.GameObjects.Graphics;
  private wallGfx: Phaser.GameObjects.Graphics;
  private paradoxGfx: Phaser.GameObjects.Graphics;
  private overflowGfx: Phaser.GameObjects.Graphics;
  private vignetteGfx: Phaser.GameObjects.Graphics;
  private gridOffset: number = 0;
  private twistTween?: Phaser.Tweens.Tween;
  private wallPulseTween?: Phaser.Tweens.Tween;
  private isTwisted = false;
  private flipVignette = false;

  public currentLeft: number = CONTAINER_LEFT;
  public currentRight: number = CONTAINER_RIGHT;
  public currentBottom: number = CONTAINER_BOTTOM;

  private tubeCenterX(): number {
    return (this.currentLeft + this.currentRight) / 2;
  }

  private tubeCenterY(): number {
    return (CONTAINER_TOP + this.currentBottom) / 2;
  }

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    this.bgGfx = scene.add.graphics().setDepth(0);
    this.drawBackground();

    this.cupVisual = scene.add.container(this.tubeCenterX(), this.tubeCenterY()).setDepth(2);
    this.gridContainer = this.cupVisual;
    this.interiorGfx = scene.add.graphics();
    this.gridGfx = scene.add.graphics();
    this.wallGfx = scene.add.graphics();
    this.paradoxGfx = scene.add.graphics().setAlpha(0);
    this.cupVisual.add([this.interiorGfx, this.gridGfx, this.wallGfx, this.paradoxGfx]);
    this.drawInterior();
    this.drawWalls();

    this.overflowGfx = scene.add.graphics().setDepth(4);

    this.vignetteGfx = scene.add.graphics().setDepth(50);
    this.drawVignette();
  }

  update(time: number): void {
    this.gridOffset = (time * 0.01) % 40;
    this.drawGrid();
    this.drawOverflowLine(time);
  }

  public updateContainerBounds(left: number, right: number, bottom: number): void {
    this.currentLeft = left;
    this.currentRight = right;
    this.currentBottom = bottom;
    this.cupVisual.setPosition(this.tubeCenterX(), this.tubeCenterY());
    this.drawBackground();
    this.drawInterior();
    this.drawWalls();
  }

  getCupVisual(): Phaser.GameObjects.Container {
    return this.cupVisual;
  }

  setCupVisualAngle(degrees: number): void {
    this.cupVisual.setAngle(degrees);
    this.isTwisted = Math.abs(degrees % 360) >= 90 && Math.abs(degrees % 360) < 270;
  }

  resetCupVisualState(): void {
    this.twistTween?.stop();
    this.wallPulseTween?.stop();
    this.cupVisual.setAngle(0);
    this.cupVisual.setScale(1);
    this.cupVisual.setDepth(2);
    this.setFlipVignetteMode(false);
    this.vignetteGfx.setVisible(true);
    this.drawVignette();
  }

  /** Softer vignette while the cup spins. */
  setFlipVignetteMode(active: boolean): void {
    this.flipVignette = active;
    this.drawVignette();
  }

  /** Full 360° cup rotation — balls tumble inside via rotating gravity. */
  playCupRotation(
    duration: number,
    callbacks: { onUpdate?: (angleDeg: number) => void; onComplete?: () => void }
  ): void {
    this.twistTween?.stop();
    this.wallPulseTween?.stop();
    this.setFlipVignetteMode(true);
    this.cupVisual.setDepth(8);
    this.cupVisual.setScale(1);

    this.paradoxGfx.setAlpha(0.45);
    this.drawParadoxGlow(0.45);

    this.wallPulseTween = this.scene.tweens.add({
      targets: this.paradoxGfx,
      alpha: { from: 0.5, to: 0.18 },
      duration: 500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    const state = { angle: 0 };
    this.cupVisual.setAngle(0);

    this.twistTween = this.scene.tweens.add({
      targets: state,
      angle: 360,
      duration,
      ease: 'Sine.easeInOut',
      onUpdate: () => {
        this.cupVisual.setAngle(state.angle);
        this.isTwisted = state.angle >= 90 && state.angle < 270;
        callbacks.onUpdate?.(state.angle);
      },
      onComplete: () => {
        this.cupVisual.setAngle(0);
        this.isTwisted = false;
        this.cupVisual.setDepth(2);
        this.setFlipVignetteMode(false);
        this.wallPulseTween?.stop();
        this.scene.tweens.add({
          targets: this.paradoxGfx,
          alpha: 0,
          duration: 400,
          onComplete: () => this.paradoxGfx.clear(),
        });
        callbacks.onComplete?.();
      },
    });
  }

  /** @deprecated use playCupRotation */
  playCupFlip(
    duration: number,
    callbacks: { onHalfway?: () => void; onComplete?: () => void }
  ): void {
    this.playCupRotation(duration, {
      onUpdate: (deg) => {
        if (deg >= 90 && callbacks.onHalfway) {
          callbacks.onHalfway();
        }
      },
      onComplete: () => callbacks.onComplete?.(),
    });
  }

  playGravityTwist(inverted: boolean, instant = false): void {
    this.isTwisted = inverted;
    this.twistTween?.stop();
    this.wallPulseTween?.stop();

    if (instant) {
      this.cupVisual.setAngle(inverted ? 180 : 0);
      this.cupVisual.setScale(1);
      this.paradoxGfx.setAlpha(0);
      return;
    }

    this.twistTween = this.scene.tweens.add({
      targets: this.cupVisual,
      angle: inverted ? 180 : 0,
      duration: 700,
      ease: 'Cubic.easeInOut',
    });

    if (inverted) {
      this.paradoxGfx.setAlpha(0.85);
      this.wallPulseTween = this.scene.tweens.add({
        targets: this.paradoxGfx,
        alpha: { from: 0.85, to: 0.25 },
        duration: 350,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
      this.drawParadoxGlow(0.85);
    } else {
      this.scene.tweens.add({
        targets: this.paradoxGfx,
        alpha: 0,
        duration: 400,
        onComplete: () => this.paradoxGfx.clear(),
      });
    }
  }

  private tubeLocalBounds() {
    const w = this.currentRight - this.currentLeft;
    const h = this.currentBottom - CONTAINER_TOP;
    return { l: -w / 2, r: w / 2, t: -h / 2, b: h / 2, w, h };
  }

  private drawParadoxGlow(alpha: number): void {
    this.paradoxGfx.clear();
    const { l, r, t, b, w, h } = this.tubeLocalBounds();

    this.paradoxGfx.lineStyle(6, 0x00f0ff, alpha * 0.35);
    this.paradoxGfx.beginPath();
    this.paradoxGfx.moveTo(l - 3, t);
    this.paradoxGfx.lineTo(l - 3, b);
    this.paradoxGfx.strokePath();

    this.paradoxGfx.lineStyle(6, 0xff3388, alpha * 0.35);
    this.paradoxGfx.beginPath();
    this.paradoxGfx.moveTo(r + 3, t);
    this.paradoxGfx.lineTo(r + 3, b);
    this.paradoxGfx.strokePath();

    this.paradoxGfx.fillStyle(0xff2244, alpha * 0.06);
    this.paradoxGfx.fillRect(l, t, w, h);
  }

  /** Single unified backdrop; play tube is drawn centered in cupVisual only. */
  private drawBackground(): void {
    this.bgGfx.clear();

    this.bgGfx.fillStyle(0x060515, 1);
    this.bgGfx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    const steps = 20;
    const stepH = GAME_HEIGHT / steps;
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const r = Math.round(6 + t * 6);
      const g = Math.round(5 + t * 3);
      const b = Math.round(16 + t * 14);
      this.bgGfx.fillStyle((r << 16) | (g << 8) | b, 0.55);
      this.bgGfx.fillRect(0, i * stepH, GAME_WIDTH, stepH + 1);
    }

    // Soft spotlight behind the centered play tube
    const cx = this.tubeCenterX();
    const cy = this.tubeCenterY();
    const tubeW = this.currentRight - this.currentLeft;
    const tubeH = this.currentBottom - CONTAINER_TOP;
    const glowW = tubeW + 48;
    const glowH = tubeH + 32;

    this.bgGfx.fillStyle(0x0a1028, 0.45);
    this.bgGfx.fillRoundedRect(cx - glowW / 2, cy - glowH / 2, glowW, glowH, 12);

    this.bgGfx.lineStyle(1, CONTAINER_BORDER_COLOR, 0.12);
    this.bgGfx.strokeRoundedRect(cx - glowW / 2, cy - glowH / 2, glowW, glowH, 12);
  }

  /** Centered play tube — rotates with cup; backdrop stays full-screen unified. */
  private drawInterior(): void {
    this.interiorGfx.clear();
    const { l, t, w, h } = this.tubeLocalBounds();

    this.interiorGfx.fillStyle(0x070818, 1);
    this.interiorGfx.fillRect(l, t, w, h);

    this.interiorGfx.fillStyle(0x0a0820, 0.4);
    this.interiorGfx.fillRect(l + w * 0.12, t, w * 0.76, h);

    const shadowW = Math.min(24, w * 0.1);
    this.interiorGfx.fillStyle(0x030210, 0.4);
    this.interiorGfx.fillRect(l, t, shadowW, h);
    this.interiorGfx.fillRect(l + w - shadowW, t, shadowW, h);

    this.interiorGfx.lineStyle(1, 0x1a3355, 0.35);
    this.interiorGfx.strokeRect(l + 1, t + 1, w - 2, h - 2);
  }

  private drawGrid(): void {
    this.gridGfx.clear();
    this.gridGfx.lineStyle(1, 0x1a3355, this.isTwisted ? 0.28 : 0.15);

    const spacing = 40;
    const offset = this.gridOffset;
    const { l, r, t, b } = this.tubeLocalBounds();

    for (let x = l; x <= r; x += spacing) {
      this.gridGfx.beginPath();
      this.gridGfx.moveTo(x, t);
      this.gridGfx.lineTo(x, b);
      this.gridGfx.strokePath();
    }

    for (let y = t + offset; y <= b; y += spacing) {
      this.gridGfx.beginPath();
      this.gridGfx.moveTo(l, y);
      this.gridGfx.lineTo(r, y);
      this.gridGfx.strokePath();
    }
  }

  private drawWalls(): void {
    this.wallGfx.clear();
    const { l, r, t, b } = this.tubeLocalBounds();

    this.wallGfx.lineStyle(8, CONTAINER_BORDER_COLOR, 0.25);
    this.wallGfx.beginPath();
    this.wallGfx.moveTo(l, t);
    this.wallGfx.lineTo(l, b);
    this.wallGfx.strokePath();

    this.wallGfx.lineStyle(3, 0xffffff, 0.95);
    this.wallGfx.beginPath();
    this.wallGfx.moveTo(l, t);
    this.wallGfx.lineTo(l, b);
    this.wallGfx.strokePath();

    this.wallGfx.lineStyle(8, CONTAINER_BORDER_COLOR, 0.25);
    this.wallGfx.beginPath();
    this.wallGfx.moveTo(r, t);
    this.wallGfx.lineTo(r, b);
    this.wallGfx.strokePath();

    this.wallGfx.lineStyle(3, 0xffffff, 0.95);
    this.wallGfx.beginPath();
    this.wallGfx.moveTo(r, t);
    this.wallGfx.lineTo(r, b);
    this.wallGfx.strokePath();

    this.wallGfx.lineStyle(4, CONTAINER_BORDER_COLOR, 0.8);
    this.wallGfx.beginPath();
    this.wallGfx.moveTo(l, b);
    this.wallGfx.lineTo(r, b);
    this.wallGfx.strokePath();

    this.wallGfx.lineStyle(10, CONTAINER_BORDER_COLOR, 0.08);
    this.wallGfx.beginPath();
    this.wallGfx.moveTo(l, t - 10);
    this.wallGfx.lineTo(l, b);
    this.wallGfx.lineTo(r, b);
    this.wallGfx.lineTo(r, t - 10);
    this.wallGfx.strokePath();

    const anchorW = 20;
    const anchorH = 12;
    this.wallGfx.fillStyle(0x1a2135, 1);
    this.wallGfx.lineStyle(2, 0x00ccff, 1);

    this.wallGfx.fillRoundedRect(l - anchorW / 2, t - anchorH / 2, anchorW, anchorH, 2);
    this.wallGfx.strokeRoundedRect(l - anchorW / 2, t - anchorH / 2, anchorW, anchorH, 2);
    this.wallGfx.fillRoundedRect(l - anchorW / 2, b - anchorH / 2, anchorW, anchorH, 2);
    this.wallGfx.strokeRoundedRect(l - anchorW / 2, b - anchorH / 2, anchorW, anchorH, 2);
    this.wallGfx.fillRoundedRect(r - anchorW / 2, t - anchorH / 2, anchorW, anchorH, 2);
    this.wallGfx.strokeRoundedRect(r - anchorW / 2, t - anchorH / 2, anchorW, anchorH, 2);
    this.wallGfx.fillRoundedRect(r - anchorW / 2, b - anchorH / 2, anchorW, anchorH, 2);
    this.wallGfx.strokeRoundedRect(r - anchorW / 2, b - anchorH / 2, anchorW, anchorH, 2);
  }

  private drawOverflowLine(time: number): void {
    this.overflowGfx.clear();
    const levelIndex = (this.scene as any).levelManager?.currentLevelIndex;
    if (levelIndex === 8) return;

    const alpha = 0.4 + 0.3 * Math.sin(time * 0.003);
    const overflowY = (this.scene as any).dynamicOverflowY ?? OVERFLOW_Y;

    this.overflowGfx.lineStyle(2, OVERFLOW_COLOR, alpha);
    this.overflowGfx.beginPath();
    this.overflowGfx.moveTo(this.currentLeft + 2, overflowY);
    this.overflowGfx.lineTo(this.currentRight - 2, overflowY);
    this.overflowGfx.strokePath();

    this.overflowGfx.lineStyle(1, OVERFLOW_COLOR, alpha * 0.5);
    const dashLen = 6;
    const gap = 8;
    for (let x = this.currentLeft + 5; x < this.currentRight - 5; x += dashLen + gap) {
      this.overflowGfx.beginPath();
      this.overflowGfx.moveTo(x, overflowY - 3);
      this.overflowGfx.lineTo(x + dashLen, overflowY - 3);
      this.overflowGfx.strokePath();
    }
  }

  private drawVignette(): void {
    this.vignetteGfx.clear();

    // Top/bottom only — no left/right dark bars (they caused the 3-panel look)
    const size = 100;
    const topAlpha = this.flipVignette ? 0.06 : 0.12;

    for (let i = 0; i < 6; i++) {
      const a = topAlpha - i * 0.018;
      if (a <= 0) break;
      this.vignetteGfx.fillStyle(0x000000, a);
      this.vignetteGfx.fillRect(0, i * (size / 6), GAME_WIDTH, size / 6);
      this.vignetteGfx.fillRect(0, GAME_HEIGHT - (i + 1) * (size / 6), GAME_WIDTH, size / 6);
    }
  }
}
