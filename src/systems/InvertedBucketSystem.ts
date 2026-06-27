import Phaser from 'phaser';
import { Background } from '../effects/Background';
import { Launcher } from '../entities/Launcher';
import { FloatingText } from '../effects/FloatingText';
import { ParticleManager } from '../effects/ParticleManager';
import { JellyBall } from '../entities/JellyBall';
import {
  GAME_WIDTH, CONTAINER_TOP, GRAVITY_Y, CAT_WALL, CAT_BALL
} from '../core/Constants';

type CupPhase = 'normal' | 'closing' | 'flipping' | 'done';

/**
 * 1. Open cup mouth at top, balls at bottom, launcher stays at top
 * 2. After 10s, lid slowly closes
 * 3. Full 360° rotation — balls tumble inside via rotating gravity + cup walls
 * 4. Lid re-opens, normal play continues
 */
export class InvertedBucketSystem {
  private scene: Phaser.Scene;
  private background: Background;
  private launcher: Launcher;
  private floatingText: FloatingText;
  private particles: ParticleManager;
  private getGravityScale: () => number;
  private getBalls: () => JellyBall[];
  private setMainWallsEnabled: (enabled: boolean) => void;

  private lidGfx?: Phaser.GameObjects.Graphics;
  private cupBodies: MatterJS.BodyType[] = [];
  private cupWallDefs: { lx: number; ly: number; w: number; h: number }[] = [];
  private pivotX = 0;
  private pivotY = 0;

  private levelActive = false;
  private phase: CupPhase = 'normal';
  private flipCountdown = 10000;
  private containerLeft = 0;
  private containerRight = 0;
  private containerBottom = 0;

  constructor(
    scene: Phaser.Scene,
    background: Background,
    launcher: Launcher,
    floatingText: FloatingText,
    particles: ParticleManager,
    getGravityScale: () => number,
    getBalls: () => JellyBall[],
    setMainWallsEnabled: (enabled: boolean) => void
  ) {
    this.scene = scene;
    this.background = background;
    this.launcher = launcher;
    this.floatingText = floatingText;
    this.particles = particles;
    this.getGravityScale = getGravityScale;
    this.getBalls = getBalls;
    this.setMainWallsEnabled = setMainWallsEnabled;
  }

  isLevelActive(): boolean {
    return this.levelActive;
  }

  hasFlipped(): boolean {
    return this.phase === 'done';
  }

  isFlipping(): boolean {
    return this.phase === 'flipping';
  }

  isBlockingInput(): boolean {
    return this.phase === 'closing' || this.phase === 'flipping';
  }

  getFlipSecondsRemaining(): number {
    if (this.phase !== 'normal') return 0;
    return Math.max(0, Math.ceil(this.flipCountdown / 1000));
  }

  start(left: number, right: number, bottom: number): void {
    this.levelActive = true;
    this.phase = 'normal';
    this.flipCountdown = 10000;
    this.containerLeft = left;
    this.containerRight = right;
    this.containerBottom = bottom;

    this.pivotX = (left + right) / 2;
    this.pivotY = (CONTAINER_TOP + bottom) / 2;

    this.scene.matter.world.setGravity(0, GRAVITY_Y * this.getGravityScale());
    this.background.playGravityTwist(false, true);

    this.lidGfx = this.scene.add.graphics().setDepth(26);
    this.background.getCupVisual().add(this.lidGfx);
    this.drawLid(0);

    this.floatingText.show(
      GAME_WIDTH / 2, CONTAINER_TOP + 18,
      'CUP FLIPS IN 10s', '#00f0ff', 18, 2200
    );
  }

  update(deltaMs: number): void {
    if (!this.levelActive || this.phase !== 'normal') return;
    this.flipCountdown -= deltaMs;
    if (this.flipCountdown <= 0) {
      this.beginCloseAndFlip();
    }
  }

  deactivate(): void {
    if (!this.levelActive) return;
    this.levelActive = false;
    this.phase = 'normal';

    this.scene.matter.world.setGravity(0, GRAVITY_Y);
    this.background.playGravityTwist(false, true);
    this.background.resetCupVisualState();

    this.lidGfx?.destroy();
    this.lidGfx = undefined;
    this.destroyCupWalls();
    this.setMainWallsEnabled(true);
  }

  destroy(): void {
    this.deactivate();
  }

  private beginCloseAndFlip(): void {
    this.phase = 'closing';
    this.launcher.isPlayerControlled = false;

    this.floatingText.show(
      GAME_WIDTH / 2, this.pivotY,
      'KAPAK KAPANIYOR...', '#ff3388', 20, 1800
    );

    const lidState = { open: 0 };
    this.scene.tweens.add({
      targets: lidState,
      open: 1,
      duration: 2600,
      ease: 'Sine.easeInOut',
      onUpdate: () => this.drawLid(lidState.open),
      onComplete: () => this.startFullRotation(),
    });
  }

  private startFullRotation(): void {
    this.phase = 'flipping';

    this.floatingText.show(
      GAME_WIDTH / 2, this.pivotY,
      'DÖNÜYOR!', '#ffffff', 24, 1600
    );

    this.setMainWallsEnabled(false);
    this.createCupWalls();

    this.background.playCupRotation(5200, {
      onUpdate: (angleDeg) => this.applyRotationFrame(angleDeg * (Math.PI / 180)),
      onComplete: () => this.finishRotation(),
    });
  }

  private applyRotationFrame(angleRad: number): void {
    const g = GRAVITY_Y * this.getGravityScale();
    this.scene.matter.world.setGravity(
      g * Math.sin(angleRad),
      g * Math.cos(angleRad)
    );

    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);

    for (let i = 0; i < this.cupBodies.length; i++) {
      const def = this.cupWallDefs[i];
      const wx = this.pivotX + def.lx * cos - def.ly * sin;
      const wy = this.pivotY + def.lx * sin + def.ly * cos;
      this.scene.matter.body.setPosition(this.cupBodies[i], { x: wx, y: wy });
      this.scene.matter.body.setAngle(this.cupBodies[i], angleRad);
    }
  }

  private finishRotation(): void {
    this.destroyCupWalls();
    this.setMainWallsEnabled(true);

    const scale = this.getGravityScale();
    this.scene.matter.world.setGravity(0, GRAVITY_Y * scale);
    this.background.setCupVisualAngle(0);

    this.phase = 'done';

    this.floatingText.show(
      GAME_WIDTH / 2, CONTAINER_TOP + 24,
      'KAPAK AÇILIYOR!', '#00ff88', 20, 1400
    );

    const lidState = { open: 1 };
    this.scene.tweens.add({
      targets: lidState,
      open: 0,
      duration: 1200,
      ease: 'Cubic.easeOut',
      onUpdate: () => this.drawLid(lidState.open),
      onComplete: () => {
        this.launcher.isPlayerControlled = true;
        this.scene.cameras.main.shake(120, 0.006);
      },
    });
  }

  private createCupWalls(): void {
    this.destroyCupWalls();

    const l = this.containerLeft;
    const r = this.containerRight;
    const t = CONTAINER_TOP;
    const b = this.containerBottom;
    const hw = (r - l) / 2;
    const hh = (b - t) / 2;
    const thick = 14;

    this.cupWallDefs = [
      { lx: -hw + thick / 2, ly: 0, w: thick, h: b - t },
      { lx: hw - thick / 2, ly: 0, w: thick, h: b - t },
      { lx: 0, ly: hh - thick / 2, w: r - l, h: thick },
      { lx: 0, ly: -hh + thick / 2, w: r - l, h: thick },
    ];

    const opts = {
      isStatic: true,
      restitution: 0.22,
      friction: 0.08,
      label: 'cupWall',
      collisionFilter: { category: CAT_WALL, mask: CAT_BALL | CAT_WALL },
    };

    for (const def of this.cupWallDefs) {
      const body = this.scene.matter.add.rectangle(
        this.pivotX + def.lx,
        this.pivotY + def.ly,
        def.w,
        def.h,
        opts
      );
      this.cupBodies.push(body);
    }
  }

  private destroyCupWalls(): void {
    for (const body of this.cupBodies) {
      this.scene.matter.world.remove(body);
    }
    this.cupBodies = [];
    this.cupWallDefs = [];
  }

  /** Lid in cup-local coords. openAmount 0 = wide open, 1 = sealed shut. */
  private drawLid(openAmount: number): void {
    if (!this.lidGfx) return;
    this.lidGfx.clear();

    const w = this.containerRight - this.containerLeft;
    const h = this.containerBottom - CONTAINER_TOP;
    const localLeft = -w / 2;
    const localRight = w / 2;
    const localTop = -h / 2;
    const lidY = localTop - 2;
    const lidH = 9;
    const midY = lidY + lidH / 2;

    const flapW = w * 0.36;
    const maxTravel = (w - flapW * 2) / 2 + 4;
    const travel = maxTravel * openAmount;
    const leftX = localLeft + travel;
    const rightX = localRight - flapW - travel;
    const gap = rightX - (leftX + flapW);
    const sealed = openAmount > 0.92;

    // Top lip rail — thin chrome line
    this.lidGfx.lineStyle(1, 0x334466, 0.7);
    this.lidGfx.beginPath();
    this.lidGfx.moveTo(localLeft - 2, lidY - 3);
    this.lidGfx.lineTo(localRight + 2, lidY - 3);
    this.lidGfx.strokePath();

    this.lidGfx.lineStyle(1, 0x00ccff, 0.45);
    this.lidGfx.beginPath();
    this.lidGfx.moveTo(localLeft, lidY - 1);
    this.lidGfx.lineTo(localRight, lidY - 1);
    this.lidGfx.strokePath();

    // Pin hinges
    for (const hx of [localLeft + 5, localRight - 5]) {
      this.lidGfx.fillStyle(0x111825, 1);
      this.lidGfx.fillCircle(hx, midY, 3);
      this.lidGfx.lineStyle(1, 0x00ccff, 0.85);
      this.lidGfx.strokeCircle(hx, midY, 3);
      this.lidGfx.fillStyle(0x00f0ff, 0.9);
      this.lidGfx.fillCircle(hx, midY, 1.2);
    }

    const drawShutter = (gfx: Phaser.GameObjects.Graphics, x: number, isLeft: boolean) => {
      const slant = sealed ? 0 : (isLeft ? -3 : 3) * (1 - openAmount);
      const topY = lidY + (isLeft ? slant : -slant);
      const botY = lidY + lidH + (isLeft ? -slant : slant);

      gfx.fillStyle(0x141c2e, 0.92);
      gfx.beginPath();
      gfx.moveTo(x, topY);
      gfx.lineTo(x + flapW, topY);
      gfx.lineTo(x + flapW, botY);
      gfx.lineTo(x, botY);
      gfx.closePath();
      gfx.fillPath();

      gfx.lineStyle(1, 0xffffff, 0.18);
      gfx.beginPath();
      gfx.moveTo(x + 3, topY + 2);
      gfx.lineTo(x + flapW - 3, topY + 2);
      gfx.strokePath();

      gfx.lineStyle(1.5, sealed ? 0xff3388 : 0x00ccff, sealed ? 0.85 : 0.65);
      gfx.beginPath();
      gfx.moveTo(x, topY);
      gfx.lineTo(x + flapW, topY);
      gfx.lineTo(x + flapW, botY);
      gfx.lineTo(x, botY);
      gfx.closePath();
      gfx.strokePath();

      gfx.lineStyle(3, isLeft ? 0x00f0ff : 0xff3388, 0.08);
      gfx.strokeRect(x - 1, topY - 1, flapW + 2, botY - topY + 2);
    };

    const gfx = this.lidGfx;
    drawShutter(gfx, leftX, true);
    drawShutter(gfx, rightX, false);

    // Open mouth — soft light beam
    if (gap > 8 && !sealed) {
      this.lidGfx.fillStyle(0x00f0ff, 0.06);
      this.lidGfx.fillTriangle(
        leftX + flapW, lidY,
        rightX, lidY,
        (leftX + flapW + rightX) / 2, lidY - 14
      );
      this.lidGfx.lineStyle(1, 0x00f0ff, 0.25);
      this.lidGfx.beginPath();
      this.lidGfx.moveTo(leftX + flapW + 2, lidY + 1);
      this.lidGfx.lineTo(rightX - 2, lidY + 1);
      this.lidGfx.strokePath();
    }

    // Seal line when closed
    if (sealed) {
      this.lidGfx.lineStyle(1.5, 0xff3388, 0.95);
      this.lidGfx.beginPath();
      this.lidGfx.moveTo(localLeft + 8, midY);
      this.lidGfx.lineTo(localRight - 8, midY);
      this.lidGfx.strokePath();
      this.lidGfx.lineStyle(4, 0xff3388, 0.12);
      this.lidGfx.beginPath();
      this.lidGfx.moveTo(localLeft + 8, midY);
      this.lidGfx.lineTo(localRight - 8, midY);
      this.lidGfx.strokePath();
    }
  }
}
