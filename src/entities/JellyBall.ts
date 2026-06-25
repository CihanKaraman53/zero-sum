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
  sprite: Phaser.GameObjects.Sprite;
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
  private wobbleScale: number = 0; // used for collision wobble

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    // Container holds all visual elements
    this.container = scene.add.container(0, 0);
    this.container.setVisible(false);
    this.container.setDepth(10);

    // We will use gfx for frozen overlay or stroke only, no main body fill
    this.gfx = scene.add.graphics();
    this.container.add(this.gfx);

    // PNG Sprite
    this.sprite = scene.add.sprite(0, 0, 'positive_ball');
    this.container.add(this.sprite);

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
      restitution: 0.1, // Softer bounce
      friction: 0.1,
      frictionAir: 0.015,
      density: 0.001, // Lighter feel
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
    
    // Physics-based procedural jelly stretch!
    // Instead of rotating the whole container, we rotate the sprite towards velocity
    // and stretch it based on speed.
    const vx = this.body.velocity.x;
    const vy = this.body.velocity.y;
    const speed = Math.sqrt(vx * vx + vy * vy);
    
    const r = this.body.circleRadius || 15;
    const baseSize = Math.min(this.sprite.width, this.sprite.height) || 256; 
    const baseScale = (r * 3.2) / baseSize;

    if (speed > 1.5 && !this.frozen) {
      // Moving fast: align to velocity vector and stretch
      const angle = Math.atan2(vy, vx);
      this.sprite.setRotation(angle);
      
      const stretch = Math.min(speed * 0.02, 0.4); // max 40% stretch
      this.sprite.setScale(
        baseScale * (1 + stretch + this.wobbleScale), 
        baseScale * (1 - stretch + this.wobbleScale)
      );
    } else {
      // Idle or moving slow: normal rotation and slight wobble
      this.sprite.setRotation(this.body.angle);
      this.sprite.setScale(
        baseScale * (1 + this.wobbleScale), 
        baseScale * (1 - this.wobbleScale)
      );
    }

    // Keep label rotation fixed so it's always readable
    this.label.setRotation(0);



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
   * Physics-based wobble impact for collisions.
   */
  playSquash(): void {
    if (this.squashTween) this.squashTween.stop();
    this.wobbleScale = 0;
    
    // Check collision speed to determine wobble intensity
    const speed = Math.sqrt(this.body!.velocity.x ** 2 + this.body!.velocity.y ** 2);
    const intensity = Phaser.Math.Clamp(speed * 0.05, 0.1, 0.3);

    this.squashTween = this.scene.tweens.add({
      targets: this,
      wobbleScale: { from: intensity, to: -intensity * 0.5 },
      duration: 60,
      yoyo: true,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.wobbleScale = 0;
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
      this.sprite.setTexture('positive_ball');
      this.sprite.setTint(SPECIAL_COLOR);
    } else if (this.special === 'divide') {
      color = SPECIAL_COLOR;
      colorStr = SPECIAL_COLOR_STR;
      this.sprite.setTexture('positive_ball');
      this.sprite.setTint(SPECIAL_COLOR);
    } else if (this.sign > 0) {
      color = POSITIVE_COLOR;
      colorStr = POSITIVE_COLOR_STR;
      this.sprite.setTexture('positive_ball');
      this.sprite.clearTint();
    } else {
      color = NEGATIVE_COLOR;
      colorStr = NEGATIVE_COLOR_STR;
      this.sprite.setTexture('negative_ball');
      this.sprite.clearTint();
    }

    // Dynamic Size Scaling based on radius is now handled dynamically in syncPosition
    // We only set texture and tint here
    
    // Main ball (Clear GFX, only use for frozen)
    this.gfx.clear();

    // Border ring (optional, can help if image has empty borders)
    // this.gfx.lineStyle(2, color, 1);
    // this.gfx.strokeCircle(0, 0, r);

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
