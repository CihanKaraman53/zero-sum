import Phaser from 'phaser';
import { getBallRadius, KING_COLOR, CAT_BALL, CAT_WALL, CAT_ANCHOR } from '../core/Constants';
import { attachBallBody, BallEntity } from './BallEntity';

const BASE_SCALE_CACHE = new Map<string, number>();

function getBaseScaleForRadius(r: number, spriteSize: number): number {
  const size = Math.max(spriteSize, 1);
  const key = `${r}_${size}`;
  let cached = BASE_SCALE_CACHE.get(key);
  if (cached === undefined) {
    cached = (r * 3.2) / size;
    BASE_SCALE_CACHE.set(key, cached);
  }
  return cached;
}

/**
 * AnchorBall — static level targets. No per-frame sync loop.
 * Matter body is isStatic; visuals update only on spawn, setValue, or squash tween.
 */
export class AnchorBall implements BallEntity {
  readonly poolKind = 'anchor' as const;
  scene: Phaser.Scene;
  body: MatterJS.BodyType | null = null;
  container!: Phaser.GameObjects.Container;
  gfx!: Phaser.GameObjects.Graphics;
  sprite!: Phaser.GameObjects.Sprite;
  label!: Phaser.GameObjects.Text;
  crownGfx!: Phaser.GameObjects.Graphics;

  value = 2;
  sign = 1;
  absValue = 2;
  isKing = false;
  special = null as BallEntity['special'];
  active = false;
  frozen = true;
  radius = 18;
  anchorX = 0;
  anchorY = 0;

  private squashTween: Phaser.Tweens.Tween | null = null;
  private wobbleScale = 0;
  private baseScale = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.initVisuals();
  }

  rehydrate(scene: Phaser.Scene): void {
    this.scene = scene;
    if (this.container?.scene === scene) return;
    this.active = false;
    this.body = null;
    if (this.squashTween) {
      this.squashTween.stop();
      this.squashTween = null;
    }
    this.wobbleScale = 0;
    this.initVisuals();
  }

  private initVisuals(): void {
    if (this.container) {
      this.container.destroy(true);
    }

    this.container = this.scene.add.container(0, 0);
    this.container.setVisible(false);
    this.container.setDepth(10);

    this.gfx = this.scene.add.graphics();
    this.container.add(this.gfx);

    this.sprite = this.scene.add.sprite(0, 0, 'positive_ball');
    this.container.add(this.sprite);

    this.label = this.scene.add.text(0, 0, '', {
      fontFamily: '"Orbitron", "Courier New", monospace',
      fontSize: '16px',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5);
    this.container.add(this.label);

    this.crownGfx = this.scene.add.graphics();
    this.crownGfx.setVisible(false);
    this.container.add(this.crownGfx);
  }

  activate(x: number, y: number, value: number, skipSpawnTween = false): void {
    this.value = value;
    this.sign = value >= 0 ? 1 : -1;
    this.absValue = Math.abs(value);
    this.isKing = false;
    this.active = true;
    this.anchorX = x;
    this.anchorY = y;
    this.radius = getBallRadius(this.absValue);
    this.wobbleScale = 0;

    this.body = this.scene.matter.add.circle(x, y, this.radius, {
      isStatic: true,
      restitution: 0.1,
      friction: 0.1,
      ignoreGravity: true,
      collisionFilter: {
        category: CAT_ANCHOR,
        mask: CAT_BALL | CAT_WALL,
      },
      label: 'jellyball',
    });

    attachBallBody(this.body, this);

    this.applyVisuals();
    this.layoutVisuals();

    this.container.setVisible(true);
    this.container.setScale(1, 1);
    this.container.setAlpha(1);

    if (!skipSpawnTween) {
      this.container.setScale(0.3, 0.3);
      this.scene.tweens.add({
        targets: this.container,
        scaleX: 1,
        scaleY: 1,
        duration: 200,
        ease: 'Back.easeOut',
      });
    }
  }

  deactivate(): void {
    this.active = false;
    this.container.setVisible(false);
    if (this.squashTween) {
      this.squashTween.stop();
      this.squashTween = null;
    }
    this.scene.tweens.killTweensOf(this.container);
    this.scene.tweens.killTweensOf(this);
    this.wobbleScale = 0;
    if (this.body) {
      this.scene.matter.world.remove(this.body);
      this.body = null;
    }
  }

  setValue(newValue: number): void {
    this.value = newValue;
    this.sign = newValue >= 0 ? 1 : -1;
    this.absValue = Math.abs(newValue);
    this.radius = getBallRadius(this.absValue);

    if (this.body) {
      const scale = this.radius / (this.body.circleRadius || this.radius);
      this.scene.matter.body.scale(this.body, scale, scale);
    }

    this.applyVisuals();
    this.layoutVisuals();
    this.playSquash();
  }

  makeKing(): void {
    if (this.isKing) return;
    this.isKing = true;
    this.drawCrown();
  }

  playSquash(): void {
    if (this.squashTween) this.squashTween.stop();
    this.wobbleScale = 0.2;

    this.squashTween = this.scene.tweens.add({
      targets: this,
      wobbleScale: { from: 0.2, to: -0.1 },
      duration: 60,
      yoyo: true,
      ease: 'Quad.easeOut',
      onUpdate: () => this.applyWobbleScale(),
      onComplete: () => {
        this.wobbleScale = 0;
        this.applyWobbleScale();
      },
    });
  }

  private applyWobbleScale(): void {
    this.sprite.setScale(
      this.baseScale * (1 + this.wobbleScale),
      this.baseScale * (1 - this.wobbleScale)
    );
  }

  private layoutVisuals(): void {
    this.container.setPosition(this.anchorX, this.anchorY);
    this.baseScale = getBaseScaleForRadius(this.radius, Math.min(this.sprite.width, this.sprite.height));
    this.sprite.setRotation(0);
    this.applyWobbleScale();
    this.label.setRotation(0);
  }

  private applyVisuals(): void {
    const texKey = this.sign > 0 ? 'positive_ball' : 'negative_ball';
    this.sprite.setTexture(texKey);
    this.sprite.clearTint();

    const prefix = this.sign > 0 ? '+' : '';
    this.label.setText(`${prefix}${this.value}`);
    const fontSize = this.absValue >= 10
      ? Math.max(12, this.radius * 0.65)
      : Math.max(14, this.radius * 0.75);
    this.label.setFontSize(`${Math.round(fontSize)}px`);

    const r = this.radius;
    this.gfx.clear();
    this.gfx.lineStyle(3, 0x4488ff, 0.8);
    this.gfx.strokeCircle(0, 0, r + 3);
    this.gfx.lineStyle(1, 0xaaddff, 0.5);
    this.gfx.strokeCircle(0, 0, r + 6);

    if (this.isKing) {
      this.drawCrown();
    } else {
      this.crownGfx.clear();
      this.crownGfx.setVisible(false);
    }
  }

  private drawCrown(): void {
    const r = this.radius;
    this.crownGfx.clear();
    this.crownGfx.setVisible(true);
    this.crownGfx.fillStyle(KING_COLOR, 1);
    const cy = -r - 4;
    this.crownGfx.fillTriangle(-8, cy, 0, cy - 10, 8, cy);
    this.crownGfx.fillTriangle(-12, cy, -4, cy - 8, 4, cy);
    this.crownGfx.fillTriangle(-4, cy, 4, cy - 8, 12, cy);
    this.crownGfx.fillRect(-12, cy, 24, 4);
  }
}
