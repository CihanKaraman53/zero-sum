import Phaser from 'phaser';
import { ObjectPool } from '../core/ObjectPool';
import { PARTICLE_POOL_SIZE, MAX_LIVE_PARTICLES } from '../core/Constants';

/** Base geometry radius — never changed after pool create (avoids setRadius GPU rebuild). */
const BASE_RADIUS = 5;

interface Particle {
  /** Visual-only circle — no Matter.js body. */
  circle: Phaser.GameObjects.Arc;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  /** Target visual radius at spawn (scale = visualRadius / BASE_RADIUS). */
  visualRadius: number;
  color: number;
  renderAlpha: number;
  renderScale: number;
  renderX: number;
  renderY: number;
  /** Upward drift — subtracted from gravity each frame. */
  buoyancy: number;
  drag: number;
  wobblePhase: number;
  additive: boolean;
}

/**
 * ParticleManager — pooled visual-only particles.
 * Fixed geometry radius; size changes via setScale (not setRadius).
 */
export class ParticleManager {
  scene: Phaser.Scene;
  private pool: ObjectPool<Particle>;
  private live: Particle[] = [];
  private maxLive = MAX_LIVE_PARTICLES;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    this.pool = new ObjectPool<Particle>(
      () => this.createParticle(),
      (p) => this.resetParticle(p),
      PARTICLE_POOL_SIZE
    );
  }

  private createParticle(): Particle {
    const circle = this.scene.add.circle(0, 0, BASE_RADIUS, 0xffffff);
    circle.setDepth(25);
    circle.setVisible(false);
    circle.setActive(false);
    return {
      circle,
      x: 0, y: 0, vx: 0, vy: 0,
      life: 0, maxLife: 300, visualRadius: BASE_RADIUS,
      color: 0xffffff,
      renderAlpha: -1,
      renderScale: -1,
      renderX: Number.NaN,
      renderY: Number.NaN,
      buoyancy: 0,
      drag: 1,
      wobblePhase: 0,
      additive: false,
    };
  }

  private resetParticle(p: Particle): void {
    p.life = 0;
    p.vx = 0;
    p.vy = 0;
    p.renderAlpha = -1;
    p.renderScale = -1;
    p.renderX = Number.NaN;
    p.renderY = Number.NaN;
    p.buoyancy = 0;
    p.drag = 1;
    p.wobblePhase = 0;
    p.additive = false;
    p.circle.setBlendMode(Phaser.BlendModes.NORMAL);
    p.circle.setScale(1);
    p.circle.setAlpha(1);
    p.circle.setVisible(false);
    p.circle.setActive(false);
  }

  setMaxLive(count: number): void {
    this.maxLive = Math.max(0, count);
    while (this.live.length > this.maxLive) {
      this.retire(this.live[0], 0);
    }
  }

  /** Hard suspend — used in ultra perf tier to skip all particle work. */
  suspended = false;
  setSuspended(on: boolean): void {
    this.suspended = on;
    if (on) {
      while (this.live.length > 0) this.retire(this.live[0], 0);
    }
  }

  private acquireLive(): Particle | null {
    if (this.live.length >= this.maxLive) {
      this.retire(this.live[0], 0);
    }

    const p = this.pool.acquire();
    if (!p) return null;

    this.live.push(p);
    return p;
  }

  private retire(p: Particle, index: number): void {
    const last = this.live.length - 1;
    if (index >= 0 && index <= last) {
      this.live[index] = this.live[last];
      this.live.pop();
    } else {
      const idx = this.live.indexOf(p);
      if (idx >= 0) {
        this.live[idx] = this.live[last];
        this.live.pop();
      }
    }
    this.pool.release(p);
  }

  burst(x: number, y: number, color: number, count: number = 15, speed: number = 3, lifespan: number = 400): void {
    if (this.suspended || this.maxLive === 0) return;
    const clampedCount = Math.min(count, 16);
    for (let i = 0; i < clampedCount; i++) {
      const p = this.acquireLive();
      if (!p) break;

      const angle = (Math.PI * 2 * i) / clampedCount + (Math.random() - 0.5) * 0.5;
      const spd = speed * (0.5 + Math.random() * 0.5);

      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * spd;
      p.vy = Math.sin(angle) * spd;
      p.life = lifespan;
      p.maxLife = lifespan;
      p.visualRadius = 2 + Math.random() * 3;
      p.color = color;
      p.buoyancy = 0;
      p.drag = 1;
      p.wobblePhase = 0;
      p.additive = false;
      p.renderAlpha = -1;
      p.renderScale = -1;
      p.renderX = Number.NaN;
      p.renderY = Number.NaN;

      const scale = p.visualRadius / BASE_RADIUS;
      p.circle.setFillStyle(color, 1);
      p.circle.setScale(scale);
      p.circle.setAlpha(1);
      p.circle.setPosition(x, y);
      p.circle.setBlendMode(Phaser.BlendModes.NORMAL);
      p.circle.setActive(true);
      p.circle.setVisible(true);
    }
  }

  mergeBurst(x: number, y: number, color: number): void {
    this.burst(x, y, color, 8, 2, 280);
  }

  zeroSumExplosion(x: number, y: number, color1: number, color2: number): void {
    this.burst(x, y, color1, 8, 4, 450);
    this.burst(x, y, color2, 6, 3.5, 400);
    this.burst(x, y, 0xffffff, 4, 5, 320);
  }

  shrinkPoof(x: number, y: number, color: number): void {
    this.burst(x, y, color, 4, 1.5, 220);
  }

  /** Upward green smoke + additive sparkles — quest bottle absorbs a +8 harvest. */
  bottleMagicPuff(x: number, y: number): void {
    if (this.suspended || this.maxLive === 0) return;

    for (let i = 0; i < 12; i++) {
      const p = this.acquireLive();
      if (!p) break;

      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.9;
      const spd = 0.6 + Math.random() * 1.4;

      p.x = x + (Math.random() - 0.5) * 16;
      p.y = y + (Math.random() - 0.5) * 6;
      p.vx = Math.cos(angle) * spd * 0.45;
      p.vy = Math.sin(angle) * spd;
      p.life = 700 + Math.random() * 500;
      p.maxLife = p.life;
      p.visualRadius = 3.5 + Math.random() * 5;
      p.color = Math.random() > 0.5 ? 0x3888ec : 0x224a7a;
      p.buoyancy = 0.11;
      p.drag = 0.988;
      p.wobblePhase = Math.random() * Math.PI * 2;
      p.additive = false;
      p.renderAlpha = -1;
      p.renderScale = -1;
      p.renderX = Number.NaN;
      p.renderY = Number.NaN;

      const scale = p.visualRadius / BASE_RADIUS;
      p.circle.setFillStyle(p.color, 1);
      p.circle.setScale(scale);
      p.circle.setAlpha(0.28 + Math.random() * 0.18);
      p.circle.setPosition(p.x, p.y);
      p.circle.setDepth(52);
      p.circle.setBlendMode(Phaser.BlendModes.NORMAL);
      p.circle.setActive(true);
      p.circle.setVisible(true);
    }

    const sparkleColors = [0xffffff, 0xcce0ff, 0x55aaff, 0x1490ff, 0xfff8a0];
    for (let i = 0; i < 18; i++) {
      const p = this.acquireLive();
      if (!p) break;

      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.6;
      const spd = 1.8 + Math.random() * 3.2;

      p.x = x + (Math.random() - 0.5) * 12;
      p.y = y + (Math.random() - 0.5) * 4;
      p.vx = Math.cos(angle) * spd;
      p.vy = Math.sin(angle) * spd;
      p.life = 320 + Math.random() * 260;
      p.maxLife = p.life;
      p.visualRadius = 0.8 + Math.random() * 2.2;
      p.color = sparkleColors[i % sparkleColors.length];
      p.buoyancy = 0.05;
      p.drag = 0.975;
      p.wobblePhase = 0;
      p.additive = true;
      p.renderAlpha = -1;
      p.renderScale = -1;
      p.renderX = Number.NaN;
      p.renderY = Number.NaN;

      const scale = p.visualRadius / BASE_RADIUS;
      p.circle.setFillStyle(p.color, 1);
      p.circle.setScale(scale);
      p.circle.setAlpha(1);
      p.circle.setPosition(p.x, p.y);
      p.circle.setDepth(54);
      p.circle.setBlendMode(Phaser.BlendModes.ADD);
      p.circle.setActive(true);
      p.circle.setVisible(true);
    }
  }

  blackHoleExplosion(x: number, y: number): void {
    this.burst(x, y, 0x8800ff, 12, 6, 550);
    this.burst(x, y, 0x00ccff, 10, 5, 450);
    this.burst(x, y, 0xffffff, 6, 7, 350);
  }

  update(delta: number): void {
    if (this.live.length === 0) return;

    const dt = delta / 16.666;

    for (let i = this.live.length - 1; i >= 0; i--) {
      const p = this.live[i];

      p.life -= delta;
      if (p.life <= 0) {
        this.retire(p, i);
        continue;
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += (0.05 - p.buoyancy) * dt;
      if (p.drag < 1) {
        const damp = Math.pow(p.drag, dt);
        p.vx *= damp;
        p.vy *= damp;
      }
      if (p.wobblePhase !== 0) {
        p.x += Math.sin(p.life * 0.014 + p.wobblePhase) * 0.22 * dt;
      }

      const progress = 1 - (p.life / p.maxLife);
      const alpha = (p.additive ? 1 - progress * 0.85 : 1 - progress * 0.95);

      if (alpha <= 0.03) {
        this.retire(p, i);
        continue;
      }

      const scale = (p.visualRadius / BASE_RADIUS) * (1 - progress * 0.5);

      if (
        alpha !== p.renderAlpha ||
        Math.abs(scale - p.renderScale) > 0.02 ||
        Math.abs(p.x - p.renderX) > 0.5 ||
        Math.abs(p.y - p.renderY) > 0.5
      ) {
        p.circle.setPosition(p.x, p.y);
        p.circle.setScale(scale);
        p.circle.setAlpha(alpha);
        p.renderAlpha = alpha;
        p.renderScale = scale;
        p.renderX = p.x;
        p.renderY = p.y;
      }
    }
  }

  getLiveCount(): number {
    return this.live.length;
  }

  destroy(): void {
    while (this.live.length > 0) {
      this.retire(this.live[0], 0);
    }
    this.pool.releaseAll();
  }
}
