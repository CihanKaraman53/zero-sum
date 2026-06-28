import Phaser from 'phaser';
import { JellyBall } from '../entities/JellyBall';
import { ObjectPool } from '../core/ObjectPool';

type GeyserState = 'SILENCE' | 'WARNING' | 'STORM';

interface WindParticle {
  x: number;
  y: number;
  vy: number;
  alpha: number;
  size: number;
  length: number;
  color: number;
  isStreamer: boolean;
}

export class GeyserSystem {
  private scene: Phaser.Scene;
  private ballPool: ObjectPool<JellyBall>;
  private gfx: Phaser.GameObjects.Graphics;

  private state: GeyserState = 'SILENCE';
  private timer: number = 0;

  // Storm (launch) starts at 18s: 16s calm → 2s warning → 2s storm
  private readonly DURATION_SILENCE = 16000;
  private readonly DURATION_WARNING = 2000;
  private readonly DURATION_STORM = 2000;

  private readonly columnWidth = 160;

  private particles: WindParticle[] = [];
  private readonly maxParticles = 180;
  private windPhase = 0;

  constructor(scene: Phaser.Scene, ballPool: ObjectPool<JellyBall>) {
    this.scene = scene;
    this.ballPool = ballPool;
    this.gfx = scene.add.graphics().setDepth(15);

    for (let i = 0; i < this.maxParticles; i++) {
      this.particles.push({
        x: 0,
        y: 0,
        vy: 0,
        alpha: 0,
        size: 0,
        length: 0,
        color: 0xffffff,
        isStreamer: false
      });
    }
  }

  setVisible(visible: boolean): void {
    this.gfx.setVisible(visible);
    if (!visible) {
      this.gfx.clear();
      this.particles.forEach(p => { p.alpha = 0; });
    }
  }

  reset(): void {
    this.state = 'SILENCE';
    this.timer = 0;
    this.windPhase = 0;
    this.gfx.clear();
    this.particles.forEach(p => { p.alpha = 0; });
  }

  /** Advance wind cycle — call once per physics step. */
  tick(delta: number): void {
    this.timer += delta;
    this.windPhase += delta * 0.004;

    switch (this.state) {
      case 'SILENCE':
        if (this.timer >= this.DURATION_SILENCE) {
          this.state = 'WARNING';
          this.timer = 0;
        }
        break;
      case 'WARNING':
        if (this.timer >= this.DURATION_WARNING) {
          this.state = 'STORM';
          this.timer = 0;
        }
        break;
      case 'STORM':
        if (this.timer >= this.DURATION_STORM) {
          this.state = 'SILENCE';
          this.timer = 0;
        }
        break;
    }
  }

  /** Apply launch forces — call once per physics step, before Matter integrates. */
  applyForces(): void {
    this.applyAirForces();
  }

  update(time: number, delta: number): void {
    this.updateParticles(delta);
    this.draw(time);
  }

  private wakeAndSetVelocity(body: MatterJS.BodyType, vx: number, vy: number): void {
    if (body.isSleeping) {
      this.scene.matter.body.set(body, { isSleeping: false });
    }
    this.scene.matter.body.setVelocity(body, { x: vx, y: vy });
  }

  private applyAirForces(): void {
    if (this.state === 'SILENCE') return;

    const containerLeft = (this.scene as any).containerLeft as number;
    const containerRight = (this.scene as any).containerRight as number;
    const containerBottom = (this.scene as any).containerBottom as number;
    const containerTop = (this.scene as any).containerTop as number;

    const leftBandRight = containerLeft + this.columnWidth;
    const rightBandLeft = containerRight - this.columnWidth;
    const midX = (containerLeft + containerRight) / 2;

    this.ballPool.forEachActive((ball) => {
      if (!ball.active || !ball.body || ball.frozen) return;

      const body = ball.body;
      const bx = body.position.x;
      const by = body.position.y;
      const r = ball.radius;

      const inHeight = by + r > containerTop && by - r < containerBottom;
      const inPlayArea = bx + r > containerLeft && bx - r < containerRight;
      if (!inHeight || !inPlayArea) return;

      const inLeftCol = bx + r > containerLeft && bx - r < leftBandRight;
      const inRightCol = bx - r < containerRight && bx + r > rightBandLeft;
      const inSideVent = inLeftCol || inRightCol;

      if (this.state === 'WARNING') {
        const vx = (Math.random() - 0.5) * 1.2;
        const vy = -5 - Math.random() * 4;
        this.wakeAndSetVelocity(body, vx, vy);
        ball.playSquash();
      } else if (this.state === 'STORM') {
        const pushDir = inLeftCol && !inRightCol ? 1 : inRightCol && !inLeftCol ? -1 : bx < midX ? 1 : -1;
        const targetVy = -24 - Math.random() * 4;
        const targetVx = inSideVent
          ? pushDir * (2.5 + Math.random() * 1.5)
          : (Math.random() - 0.5) * 1.5;
        this.wakeAndSetVelocity(body, targetVx, targetVy);
      }
    });
  }

  private updateParticles(delta: number): void {
    const containerLeft = (this.scene as any).containerLeft;
    const containerRight = (this.scene as any).containerRight;
    const containerBottom = (this.scene as any).containerBottom;

    if (this.state !== 'SILENCE') {
      const spawnChance = this.state === 'STORM' ? 0.55 : 0.22;
      this.particles.forEach(p => {
        if (p.alpha <= 0 && Math.random() < spawnChance) {
          const isLeft = Math.random() < 0.5;
          const minX = isLeft ? containerLeft + 5 : containerRight - this.columnWidth + 5;
          const maxX = isLeft ? containerLeft + this.columnWidth - 5 : containerRight - 5;

          p.x = Phaser.Math.Between(minX, maxX);
          p.y = containerBottom - 10;
          p.alpha = 0.55 + Math.random() * 0.45;

          if (this.state === 'STORM') {
            p.vy = -4.5 - Math.random() * 3;
            p.isStreamer = Math.random() < 0.75;
            p.length = p.isStreamer ? 22 + Math.random() * 35 : 0;
            p.size = p.isStreamer ? 2.5 : 2 + Math.random() * 2.5;
            p.color = 0xe8f8ff;
          } else {
            p.vy = -1.2 - Math.random() * 0.8;
            p.isStreamer = Math.random() < 0.35;
            p.length = p.isStreamer ? 10 + Math.random() * 14 : 0;
            p.size = 2 + Math.random() * 2;
            p.color = 0x88eeff;
          }
        }
      });
    }

    const decay = this.state === 'STORM' ? delta * 0.00035 : delta * 0.0007;
    this.particles.forEach(p => {
      if (p.alpha > 0) {
        p.y += p.vy * (delta / 16.666);
        p.alpha -= decay;

        if (p.y < (this.scene as any).containerTop || p.alpha <= 0) {
          p.alpha = 0;
        }
      }
    });
  }

  /** Visible side-vent air columns + rising streaks (no audio). */
  private draw(time: number): void {
    this.gfx.clear();

    if (this.state === 'SILENCE') return;

    const containerLeft = (this.scene as any).containerLeft as number;
    const containerRight = (this.scene as any).containerRight as number;
    const containerBottom = (this.scene as any).containerBottom as number;
    const containerTop = (this.scene as any).containerTop as number;
    const ventHeight = containerBottom - containerTop;
    const intensity = this.state === 'STORM' ? 1 : 0.45 + 0.25 * Math.sin(this.windPhase * 3);

    this.drawVentColumn(containerLeft, containerLeft + this.columnWidth, containerTop, containerBottom, ventHeight, intensity, time);
    this.drawVentColumn(containerRight - this.columnWidth, containerRight, containerTop, containerBottom, ventHeight, intensity, time);

    this.particles.forEach(p => {
      if (p.alpha <= 0) return;
      if (p.isStreamer) {
        this.gfx.lineStyle(p.size, p.color, p.alpha * 0.85);
        this.gfx.lineBetween(p.x, p.y, p.x + Math.sin(p.y * 0.05) * 3, p.y - p.length);
      } else {
        this.gfx.fillStyle(p.color, p.alpha * 0.7);
        this.gfx.fillCircle(p.x, p.y, p.size);
      }
    });
  }

  private drawVentColumn(
    x0: number, x1: number,
    top: number, bottom: number,
    ventHeight: number,
    intensity: number,
    time: number
  ): void {
    const cx = (x0 + x1) / 2;
    const colW = x1 - x0;
    const streakCount = this.state === 'STORM' ? 9 : 5;

    // Soft air glow column
    this.gfx.fillStyle(0x00ccff, 0.04 * intensity);
    this.gfx.fillRect(x0 + 4, top, colW - 8, ventHeight);

    // Rising wind streaks
    for (let i = 0; i < streakCount; i++) {
      const phase = (time * 0.002 + i * 0.17) % 1;
      const y = bottom - phase * ventHeight;
      const sway = Math.sin(time * 0.004 + i) * 6;
      const streakH = this.state === 'STORM' ? 28 + (i % 3) * 10 : 14 + (i % 2) * 8;
      const alpha = (1 - phase) * 0.35 * intensity;

      this.gfx.lineStyle(1.5, 0xccfaff, alpha);
      this.gfx.lineBetween(cx + sway - 4, y, cx + sway + 4, y - streakH);

      this.gfx.lineStyle(1, 0xffffff, alpha * 0.6);
      this.gfx.lineBetween(cx + sway, y, cx + sway + Math.sin(i) * 2, y - streakH * 0.7);
    }

    // Floor vent shimmer
    this.gfx.fillStyle(0x00f0ff, 0.12 * intensity);
    this.gfx.fillEllipse(cx, bottom - 6, colW * 0.7, 8);
  }

  destroy(): void {
    this.gfx.destroy();
  }
}
