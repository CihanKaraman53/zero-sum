import Phaser from 'phaser';
import {
  getBallRadius, SPECIAL_COLOR, KING_COLOR,
  CAT_BALL, CAT_WALL, CONTAINER_BOTTOM,
  BALL_RESTITUTION, BALL_FRICTION, BALL_FRICTION_AIR, BALL_DENSITY,
} from '../core/Constants';
import { attachBallBody, BallEntity, BallSpecial, BallFaction, factionTexture, applyBallLabelStyle } from './BallEntity';

export type { BallSpecial, BallFaction };

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
 * JellyBall — rigid Matter.js circle + sprite overlay.
 * Visual stretch via sprite scale tweens only (no per-frame graphics redraw).
 */
export class JellyBall implements BallEntity {
  readonly poolKind = 'jelly' as const;
  scene: Phaser.Scene;
  body: MatterJS.BodyType | null = null;
  container!: Phaser.GameObjects.Container;
  gfx!: Phaser.GameObjects.Graphics;
  sprite!: Phaser.GameObjects.Sprite;
  label!: Phaser.GameObjects.Text;
  crownGfx!: Phaser.GameObjects.Graphics;

  value: number = 2;
  sign: number = 1;
  absValue: number = 2;
  faction: BallFaction = 'green';
  isKing: boolean = false;
  special: BallSpecial = null;
  active: boolean = false;
  frozen: boolean = false;
  harvesting: boolean = false;
  radius: number = 18;
  anchorX: number = 0;
  anchorY: number = 0;

  private squashTween: Phaser.Tweens.Tween | null = null;
  private wobbleScale: number = 0;
  private lastTextureKey = '';
  private lastLabelText = '';
  private lastFontSize = '';
  private frozenRingDrawn = false;
  private kingDrawn = false;
  private cachedBaseScale = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.initVisuals();
  }

  /** Recreate Phaser objects after GameScene shutdown (pooled reuse). */
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
    this.container.setDepth(25);

    this.gfx = this.scene.add.graphics();
    this.container.add(this.gfx);

    this.sprite = this.scene.add.sprite(0, 0, 'positive_ball');
    this.container.add(this.sprite);

    this.label = this.scene.add.text(0, 0, '', {
      fontFamily: 'system-ui, "Arial Black", sans-serif',
      fontSize: '16px',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    applyBallLabelStyle(this.label, 'green');
    this.container.add(this.label);

    this.crownGfx = this.scene.add.graphics();
    this.crownGfx.setVisible(false);
    this.container.add(this.crownGfx);
  }

  activate(
    x: number,
    y: number,
    value: number,
    special: BallSpecial = null,
    frozen: boolean = false,
    skipSpawnTween: boolean = false,
    faction: BallFaction = 'green',
  ): void {
    this.value = value;
    this.sign = value >= 0 ? 1 : -1;
    this.absValue = Math.abs(value);
    this.faction = faction;
    this.special = special;
    this.isKing = false;
    this.frozen = frozen;
    this.active = true;
    this.anchorX = x;
    this.anchorY = y;
    this.radius = special ? 20 : getBallRadius(this.absValue);
    this.kingDrawn = false;
    this.frozenRingDrawn = false;
    this.lastTextureKey = '';
    this.lastLabelText = '';
    this.lastFontSize = '';
    this.wobbleScale = 0;

    this.body = this.scene.matter.add.circle(x, y, this.radius, {
      restitution: BALL_RESTITUTION,
      friction: BALL_FRICTION,
      frictionAir: BALL_FRICTION_AIR,
      density: BALL_DENSITY,
      isStatic: frozen,
      ignoreGravity: frozen,
      collisionFilter: {
        category: CAT_BALL,
        mask: CAT_BALL | CAT_WALL,
      },
      label: 'jellyball',
    });

    attachBallBody(this.body, this);

    this.cachedBaseScale = getBaseScaleForRadius(this.radius, Math.min(this.sprite.width, this.sprite.height));
    this.applyVisuals(true);

    this.container.setPosition(x, y);
    this.container.setVisible(true);
    this.container.setScale(1, 1);
    this.container.setAlpha(1);
    this.harvesting = false;

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
    this.harvesting = false;
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

  syncPosition(): void {
    if (!this.active || !this.body || this.frozen || this.harvesting) return;

    const body = this.body;

    // Fully asleep pile — zero work until a collision wakes the body
    if (body.isSleeping && this.wobbleScale === 0) return;

    const px = body.position.x;
    const py = body.position.y;
    const vx = body.velocity.x;
    const vy = body.velocity.y;
    const speedSq = vx * vx + vy * vy;

    this.container.setPosition(px, py);

    const baseScale = this.cachedBaseScale;

    if (speedSq > 2.25) {
      const speed = Math.sqrt(speedSq);
      const angle = Math.atan2(vy, vx);
      this.sprite.setRotation(angle);
      const stretch = Math.min(speed * 0.02, 0.4);
      this.sprite.setScale(
        baseScale * (1 + stretch + this.wobbleScale),
        baseScale * (1 - stretch + this.wobbleScale)
      );
    } else {
      this.sprite.setRotation(body.angle);
      this.sprite.setScale(
        baseScale * (1 + this.wobbleScale),
        baseScale * (1 - this.wobbleScale)
      );
    }
    this.label.setRotation(0);

    if (py > CONTAINER_BOTTOM + 100 || px < -50 || px > 530) {
      this.deactivate();
    }
  }

  setValue(newValue: number): void {
    this.value = newValue;
    this.sign = newValue >= 0 ? 1 : -1;
    this.absValue = Math.abs(newValue);
    this.radius = getBallRadius(this.absValue);
    this.cachedBaseScale = getBaseScaleForRadius(this.radius, Math.min(this.sprite.width, this.sprite.height));

    if (this.body) {
      const scale = this.radius / (this.body.circleRadius || this.radius);
      this.scene.matter.body.scale(this.body, scale, scale);
    }

    this.applyVisuals(true);
    this.playSquash();
  }

  makeKing(): void {
    if (this.isKing) return;
    this.isKing = true;
    this.applyCrown(true);
  }

  playSquash(): void {
    if (!this.body || this.harvesting) return;
    if (this.squashTween) this.squashTween.stop();
    this.wobbleScale = 0;

    const speed = Math.sqrt(this.body.velocity.x ** 2 + this.body.velocity.y ** 2);
    const intensity = Phaser.Math.Clamp(speed * 0.07, 0.12, 0.42);

    this.squashTween = this.scene.tweens.add({
      targets: this,
      wobbleScale: { from: intensity, to: -intensity * 0.45 },
      duration: 110,
      yoyo: true,
      ease: 'Sine.easeOut',
      onComplete: () => {
        this.wobbleScale = 0;
      },
    });
  }

  /** Detach Matter body so the ball can tween to the quest pitcher. */
  prepareHarvest(): void {
    this.harvesting = true;
    if (this.body) {
      this.scene.matter.world.remove(this.body);
      this.body = null;
    }
  }

  playHarvestPulse(onComplete: () => void): void {
    if (!this.active || !this.container?.visible) {
      onComplete();
      return;
    }

    this.scene.tweens.killTweensOf(this.container);
    const baseX = this.container.scaleX;
    const baseY = this.container.scaleY;

    this.scene.tweens.add({
      targets: this.container,
      scaleX: baseX * 1.14,
      scaleY: baseY * 1.14,
      duration: 90,
      yoyo: true,
      repeat: 3,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        this.container.setScale(baseX, baseY);
        onComplete();
      },
    });
  }

  private getTextureKey(): string {
    if (this.special === 'multiply') return 'x2_ball';
    if (this.special === 'blast') return 'blast_ball';
    if (this.special === 'slice') return 'slice_ball';
    if (this.special === 'chance') return 'dice_ball';
    if (this.special === 'divide') return factionTexture(this.faction);
    return factionTexture(this.faction);
  }

  private getLabelText(): string {
    if (this.special === 'multiply') return '×2';
    if (this.special === 'divide') return '÷2';
    if (this.special === 'blast' || this.special === 'slice' || this.special === 'chance') return '';
    const prefix = this.sign > 0 ? '+' : '';
    return `${prefix}${this.value}`;
  }

  private getLabelFontSize(): string {
    const r = this.radius;
    if (this.special === 'multiply' || this.special === 'divide') {
      return r > 20 ? '20px' : '16px';
    }
    const px = this.absValue >= 10 ? Math.max(13, r * 0.7) : Math.max(15, r * 0.82);
    return `${Math.round(px)}px`;
  }

  private applyVisuals(force = false): void {
    const texKey = this.getTextureKey();
    if (force || texKey !== this.lastTextureKey) {
      this.sprite.setTexture(texKey);
      this.lastTextureKey = texKey;
      if (this.special === 'divide') {
        this.sprite.setTint(SPECIAL_COLOR);
      } else {
        this.sprite.clearTint();
      }
      this.cachedBaseScale = getBaseScaleForRadius(this.radius, Math.min(this.sprite.width, this.sprite.height));
    }

    const labelText = this.getLabelText();
    const fontSize = this.getLabelFontSize();
    if (force || labelText !== this.lastLabelText) {
      this.label.setText(labelText);
      this.lastLabelText = labelText;
    }
    if (force || fontSize !== this.lastFontSize) {
      this.label.setFontSize(fontSize);
      this.lastFontSize = fontSize;
    }
    applyBallLabelStyle(this.label, this.faction);

    if (this.frozen && !this.frozenRingDrawn) {
      const r = this.radius;
      this.gfx.clear();
      this.gfx.lineStyle(3, 0x4488ff, 0.8);
      this.gfx.strokeCircle(0, 0, r + 3);
      this.gfx.lineStyle(1, 0xaaddff, 0.5);
      this.gfx.strokeCircle(0, 0, r + 6);
      this.frozenRingDrawn = true;
    } else if (!this.frozen && this.frozenRingDrawn) {
      this.gfx.clear();
      this.frozenRingDrawn = false;
    }

    this.applyCrown(force);
  }

  private applyCrown(force = false): void {
    if (this.isKing && !this.kingDrawn) {
      const r = this.radius;
      this.crownGfx.clear();
      this.crownGfx.setVisible(true);
      this.crownGfx.fillStyle(KING_COLOR, 1);
      const cy = -r - 4;
      this.crownGfx.fillTriangle(-8, cy, 0, cy - 10, 8, cy);
      this.crownGfx.fillTriangle(-12, cy, -4, cy - 8, 4, cy);
      this.crownGfx.fillTriangle(-4, cy, 4, cy - 8, 12, cy);
      this.crownGfx.fillRect(-12, cy, 24, 4);
      this.kingDrawn = true;
    } else if (!this.isKing && (this.kingDrawn || force)) {
      this.crownGfx.clear();
      this.crownGfx.setVisible(false);
      this.kingDrawn = false;
    }
  }
}
