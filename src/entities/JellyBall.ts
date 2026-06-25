import Phaser from 'phaser';
import {
  getBallRadius, POSITIVE_COLOR, NEGATIVE_COLOR, SPECIAL_COLOR, KING_COLOR,
  POSITIVE_COLOR_STR, NEGATIVE_COLOR_STR, SPECIAL_COLOR_STR, KING_COLOR_STR,
  CAT_BALL, CAT_WALL, CONTAINER_BOTTOM
} from '../core/Constants';

export type BallSpecial = 'multiply' | 'divide' | null;

/**
 * JellyBall — the core game entity.
 * Each ball = 1 Matter.js circle body + 1 Phaser Graphics overlay + text label.
 * Jelly feel via squash & stretch sprite tweens (NOT soft-body constraints).
 */
export class JellyBall {
  scene: Phaser.Scene;
  body: MatterJS.BodyType | null = null;
  container: Phaser.GameObjects.Container;
  gfx: Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Text;

  crownGfx: Phaser.GameObjects.Graphics;

  value: number = 2;
  sign: number = 1;
  absValue: number = 2;
  isKing: boolean = false;
  special: BallSpecial = null;
  active: boolean = false;
  frozen: boolean = false;
  radius: number = 18;

  // Squash & stretch state (reused, no alloc)
  private squashTween: Phaser.Tweens.Tween | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    // Container holds all visual elements
    this.container = scene.add.container(0, 0);
    this.container.setVisible(false);
    this.container.setDepth(10);

    // Main ball graphic
    this.gfx = scene.add.graphics();
    this.container.add(this.gfx);

    // Number label
    this.label = scene.add.text(0, 0, '', {
      fontFamily: '"Orbitron", "Courier New", monospace',
      fontSize: '16px',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5);
    this.container.add(this.label);



    // Crown (for King Ball)
    this.crownGfx = scene.add.graphics();
    this.crownGfx.setVisible(false);
    this.container.add(this.crownGfx);
  }

  /**
   * Activate ball from pool with given value.
   */
  activate(x: number, y: number, value: number, special: BallSpecial = null, frozen: boolean = false): void {
    this.value = value;
    this.sign = value >= 0 ? 1 : -1;
    this.absValue = Math.abs(value);
    this.special = special;
    this.isKing = false;
    this.frozen = frozen;
    this.active = true;
    this.radius = special ? 20 : getBallRadius(this.absValue);

    // Create Matter.js body
    this.body = this.scene.matter.add.circle(x, y, this.radius, {
      restitution: 0.3,
      friction: 0.05,
      frictionAir: 0.01,
      density: 0.002,
      isStatic: frozen,
      collisionFilter: {
        category: CAT_BALL,
        mask: CAT_BALL | CAT_WALL,
      },
      label: 'jellyball',
    });

    // Store reference on body for collision lookup
    (this.body as any).jellyBall = this;

    // Draw visuals
    this.redraw();

    // Show
    this.container.setPosition(x, y);
    this.container.setVisible(true);
    this.container.setScale(1, 1);
    this.container.setAlpha(1);

    // Spawn pop-in animation
    this.container.setScale(0.3, 0.3);
    this.scene.tweens.add({
      targets: this.container,
      scaleX: 1,
      scaleY: 1,
      duration: 200,
      ease: 'Back.easeOut',
    });
  }

  /**
   * Deactivate ball and return to pool.
   */
  deactivate(): void {
    this.active = false;
    this.container.setVisible(false);
    if (this.squashTween) {
      this.squashTween.stop();
      this.squashTween = null;
    }
    if (this.body) {
      this.scene.matter.world.remove(this.body);
      this.body = null;
    }
  }

  /**
   * Update visual position to match physics body. Called each frame.
   */
  syncPosition(): void {
    if (!this.active || !this.body) return;
    this.container.setPosition(this.body.position.x, this.body.position.y);
    this.container.setRotation(this.body.angle);



    // Out of bounds check
    if (this.body.position.y > CONTAINER_BOTTOM + 100 ||
        this.body.position.x < -50 || this.body.position.x > 530) {
      // Force back to pool
      this.deactivate();
    }
  }

  /**
   * Change value (used for shrink mechanic).
   */
  setValue(newValue: number): void {
    this.value = newValue;
    this.sign = newValue >= 0 ? 1 : -1;
    this.absValue = Math.abs(newValue);
    this.radius = getBallRadius(this.absValue);

    // Update physics body radius
    if (this.body) {
      const scale = this.radius / (this.body.circleRadius || this.radius);
      this.scene.matter.body.scale(this.body, scale, scale);
    }

    this.redraw();
    this.playSquash();
  }

  /**
   * Make this ball a King Ball (two ±16 merged).
   */
  makeKing(): void {
    this.isKing = true;
    this.redraw();
  }

  /**
   * Squash & stretch tween for jelly feel on collision.
   */
  playSquash(): void {
    if (this.squashTween) this.squashTween.stop();
    this.container.setScale(1, 1);
    this.squashTween = this.scene.tweens.add({
      targets: this.container,
      scaleX: 1.2,
      scaleY: 0.8,
      duration: 80,
      yoyo: true,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        if (this.container) this.container.setScale(1, 1);
      }
    });
  }

  /**
   * Redraw all graphics for current state.
   */
  private redraw(): void {
    const r = this.radius;
    let color: number;
    let colorStr: string;

    if (this.special === 'multiply') {
      color = SPECIAL_COLOR;
      colorStr = SPECIAL_COLOR_STR;
    } else if (this.special === 'divide') {
      color = SPECIAL_COLOR;
      colorStr = SPECIAL_COLOR_STR;
    } else if (this.sign > 0) {
      color = POSITIVE_COLOR;
      colorStr = POSITIVE_COLOR_STR;
    } else {
      color = NEGATIVE_COLOR;
      colorStr = NEGATIVE_COLOR_STR;
    }

    // Main ball
    this.gfx.clear();

    // Outer glow
    this.gfx.fillStyle(color, 0.15);
    this.gfx.fillCircle(0, 0, r + 6);

    // Main body
    this.gfx.fillStyle(color, 0.6);
    this.gfx.fillCircle(0, 0, r);

    // Inner bright core
    this.gfx.fillStyle(color, 0.9);
    this.gfx.fillCircle(0, 0, r * 0.7);

    // Specular highlight
    this.gfx.fillStyle(0xffffff, 0.3);
    this.gfx.fillCircle(-r * 0.25, -r * 0.25, r * 0.35);

    // Border ring
    this.gfx.lineStyle(2, color, 1);
    this.gfx.strokeCircle(0, 0, r);

    // Frozen overlay
    if (this.frozen) {
      this.gfx.lineStyle(3, 0x4488ff, 0.8);
      this.gfx.strokeCircle(0, 0, r + 3);
      this.gfx.lineStyle(1, 0xaaddff, 0.5);
      this.gfx.strokeCircle(0, 0, r + 6);
    }

    // Label
    if (this.special === 'multiply') {
      this.label.setText('×2');
      this.label.setFontSize(r > 20 ? '20px' : '16px');
    } else if (this.special === 'divide') {
      this.label.setText('÷2');
      this.label.setFontSize(r > 20 ? '20px' : '16px');
    } else {
      const prefix = this.sign > 0 ? '+' : '';
      this.label.setText(`${prefix}${this.value}`);
      const fontSize = this.absValue >= 10 ? Math.max(12, r * 0.65) : Math.max(14, r * 0.75);
      this.label.setFontSize(`${Math.round(fontSize)}px`);
    }
    this.label.setColor('#ffffff');



    // Crown
    this.crownGfx.clear();
    if (this.isKing) {
      this.crownGfx.setVisible(true);
      this.crownGfx.fillStyle(KING_COLOR, 1);
      const cy = -r - 4;
      this.crownGfx.fillTriangle(-8, cy, 0, cy - 10, 8, cy);
      this.crownGfx.fillTriangle(-12, cy, -4, cy - 8, 4, cy);
      this.crownGfx.fillTriangle(-4, cy, 4, cy - 8, 12, cy);
      this.crownGfx.fillRect(-12, cy, 24, 4);
    } else {
      this.crownGfx.setVisible(false);
    }
  }


}
