import Phaser from 'phaser';
import {
  getBallRadius, getBallVisualRadius, SPECIAL_COLOR,
  CAT_BALL, CAT_WALL, CONTAINER_BOTTOM, CONTAINER_LEFT, CONTAINER_RIGHT,
  BALL_RESTITUTION, BALL_FRICTION, BALL_FRICTION_AIR, BALL_DENSITY,
} from '../core/Constants';
import {
  attachBallBody, BallEntity, BallSpecial, BallFaction, factionTexture,
  applyBallLabelStyle, GREEN_THROWABLE_TEXTURE,
  scaleForThrowableTexture, applyThrowableLabel, throwableLabelFontSize, THROWABLE_LABEL_FONT,
} from './BallEntity';

export type { BallSpecial, BallFaction };

const BASE_SCALE_CACHE = new Map<string, number>();

function getBaseScaleForRadius(visualR: number, spriteSize: number, texKey: string): number {
  const size = Math.max(spriteSize, 1);
  const key = `${visualR}_${size}_${texKey}`;
  let cached = BASE_SCALE_CACHE.get(key);
  if (cached === undefined) {
    cached = scaleForThrowableTexture(texKey, visualR);
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
  sprite!: Phaser.GameObjects.Sprite;
  label!: Phaser.GameObjects.Text;

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
  visualRadius: number = 18;
  anchorX: number = 0;
  anchorY: number = 0;

  private squashTween: Phaser.Tweens.Tween | null = null;
  private wobbleScale: number = 0;
  private lastTextureKey = '';
  private lastLabelText = '';
  private lastFontSize = '';
  private lastStyleFaction: BallFaction | '' = '';
  private cachedBaseScale = 0;
  /** Container'ın display list'te olup olmadığı — pool dönüşünde tamamen çıkar. */
  private inDisplayList = false;
  /** Last sprite scale we wrote — skip Phaser setter if unchanged. */
  private lastDrawnScaleX = 0;
  private lastDrawnScaleY = 0;
  private lastDrawnRotation = 0;
  private lastDrawnX = NaN;
  private lastDrawnY = NaN;

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

    this.sprite = this.scene.add.sprite(0, 0, GREEN_THROWABLE_TEXTURE);
    this.container.add(this.sprite);

    this.label = this.scene.add.text(0, 0, '', {
      fontFamily: THROWABLE_LABEL_FONT,
      fontSize: '20px',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    applyBallLabelStyle(this.label, 'green');
    this.container.add(this.label);

    this.inDisplayList = true;
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
    this.visualRadius = special ? 22 : getBallVisualRadius(this.absValue);
    this.radius = special ? 18 : getBallRadius(this.absValue);
    this.lastTextureKey = '';
    this.lastLabelText = '';
    this.lastFontSize = '';
    this.lastStyleFaction = '';
    this.wobbleScale = 0;
    this.lastDrawnScaleX = 0;
    this.lastDrawnScaleY = 0;
    this.lastDrawnRotation = 0;
    this.lastDrawnX = NaN;
    this.lastDrawnY = NaN;

    this.body = this.scene.matter.add.circle(x, y, this.radius, {
      restitution: BALL_RESTITUTION,
      friction: BALL_FRICTION,
      frictionAir: BALL_FRICTION_AIR,
      density: BALL_DENSITY,
      isStatic: frozen,
      ignoreGravity: frozen,
      sleepThreshold: 30,
      collisionFilter: {
        category: CAT_BALL,
        mask: CAT_BALL | CAT_WALL,
      },
      label: 'jellyball',
    });

    attachBallBody(this.body, this);

    this.applyVisuals(true);
    this.cachedBaseScale = getBaseScaleForRadius(
      this.visualRadius,
      Math.min(this.sprite.width, this.sprite.height),
      this.getTextureKey(),
    );

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
    this.container.setVisible(false);
  }

  syncPosition(): void {
    if (!this.active || !this.body || this.frozen || this.harvesting) return;

    const body = this.body;
    const wobble = this.wobbleScale;

    // Fully asleep pile — zero work until a collision wakes the body
    if (body.isSleeping && wobble === 0) return;

    const px = body.position.x;
    const py = body.position.y;
    const vx = body.velocity.x;
    const vy = body.velocity.y;
    const speedSq = vx * vx + vy * vy;

    if (px !== this.lastDrawnX || py !== this.lastDrawnY) {
      this.container.setPosition(px, py);
      this.lastDrawnX = px;
      this.lastDrawnY = py;
    }

    const baseScale = this.cachedBaseScale;
    let targetScaleX: number;
    let targetScaleY: number;
    let targetRotation: number;

    if (speedSq > 2.25) {
      const speed = Math.sqrt(speedSq);
      targetRotation = Math.atan2(vy, vx);
      const stretch = Math.min(speed * 0.02, 0.4);
      targetScaleX = baseScale * (1 + stretch + wobble);
      targetScaleY = baseScale * (1 - stretch + wobble);
    } else {
      targetRotation = body.angle;
      targetScaleX = baseScale * (1 + wobble);
      targetScaleY = baseScale * (1 - wobble);
    }

    if (targetRotation !== this.lastDrawnRotation) {
      this.sprite.setRotation(targetRotation);
      this.lastDrawnRotation = targetRotation;
    }
    if (targetScaleX !== this.lastDrawnScaleX || targetScaleY !== this.lastDrawnScaleY) {
      this.sprite.setScale(targetScaleX, targetScaleY);
      this.lastDrawnScaleX = targetScaleX;
      this.lastDrawnScaleY = targetScaleY;
    }

    const scene = this.scene as {
      containerLeft?: number;
      containerRight?: number;
      containerBottom?: number;
    };
    const left = (scene.containerLeft ?? CONTAINER_LEFT) - 60;
    const right = (scene.containerRight ?? CONTAINER_RIGHT) + 60;
    const bottom = (scene.containerBottom ?? CONTAINER_BOTTOM) + 120;
    if (py > bottom || px < left || px > right) {
      this.deactivate();
    }
  }

  setValue(newValue: number): void {
    this.value = newValue;
    this.sign = newValue >= 0 ? 1 : -1;
    this.absValue = Math.abs(newValue);
    this.visualRadius = getBallVisualRadius(this.absValue);
    this.radius = getBallRadius(this.absValue);

    if (this.body) {
      const scale = this.radius / (this.body.circleRadius || this.radius);
      this.scene.matter.body.scale(this.body, scale, scale);
    }

    this.applyVisuals(true);
    this.cachedBaseScale = getBaseScaleForRadius(
      this.visualRadius,
      Math.min(this.sprite.width, this.sprite.height),
      this.getTextureKey(),
    );
    this.playSquash();
  }

  makeKing(): void {
    // Level 1 cure modunda king mekaniği yok — boş bırak ama API'yi koru.
    this.isKing = true;
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
    if (this.special === 'multiply' || this.special === 'divide') {
      return this.visualRadius > 20 ? '14px' : '12px';
    }
    return throwableLabelFontSize(this.visualRadius, this.absValue);
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
      this.cachedBaseScale = getBaseScaleForRadius(this.visualRadius, Math.min(this.sprite.width, this.sprite.height), texKey);
    }

    const labelText = this.getLabelText();
    const fontSize = this.getLabelFontSize();
    // `force` bayrağı text rebake (=texture yeniden render) tetiklemesin — sadece değer farklıysa.
    if (labelText !== this.lastLabelText) {
      this.label.setText(labelText);
      this.lastLabelText = labelText;
    }
    if (fontSize !== this.lastFontSize) {
      this.label.setFontSize(fontSize);
      this.lastFontSize = fontSize;
    }
    this.label.setVisible(labelText.length > 0);
    if (this.faction !== this.lastStyleFaction) {
      applyBallLabelStyle(this.label, this.faction);
      this.lastStyleFaction = this.faction;
    }
    this.layoutThrowableLabel();
  }

  private layoutThrowableLabel(): void {
    const texKey = this.getTextureKey();
    if (texKey !== GREEN_THROWABLE_TEXTURE || this.special) {
      this.label.setPosition(0, 0);
      return;
    }
    applyThrowableLabel(this.label, this.visualRadius);
  }
}
