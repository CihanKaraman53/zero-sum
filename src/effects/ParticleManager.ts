import Phaser from 'phaser';
import { ObjectPool } from '../core/ObjectPool';
import { PARTICLE_POOL_SIZE } from '../core/Constants';

interface Particle {
  gfx: Phaser.GameObjects.Graphics;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  radius: number;
  color: number;
  active: boolean;
}

/**
 * ParticleManager — object-pooled particle system.
 * Max 15-20 particles per burst, short lifespan, instant recycle.
 * Zero allocation during gameplay.
 */
export class ParticleManager {
  scene: Phaser.Scene;
  pool: ObjectPool<Particle>;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    this.pool = new ObjectPool<Particle>(
      () => this.createParticle(),
      (p) => this.resetParticle(p),
      PARTICLE_POOL_SIZE
    );
  }

  private createParticle(): Particle {
    const gfx = this.scene.add.graphics();
    gfx.setDepth(25);
    gfx.setVisible(false);
    return {
      gfx,
      x: 0, y: 0, vx: 0, vy: 0,
      life: 0, maxLife: 300, radius: 3,
      color: 0xffffff, active: false
    };
  }

  private resetParticle(p: Particle): void {
    p.active = false;
    p.gfx.setVisible(false);
    p.gfx.clear();
  }

  /**
   * Emit a burst of particles at position.
   */
  burst(x: number, y: number, color: number, count: number = 15, speed: number = 3, lifespan: number = 400): void {
    const clampedCount = Math.min(count, 20); // performance cap
    for (let i = 0; i < clampedCount; i++) {
      const p = this.pool.acquire();
      if (!p) break;

      const angle = (Math.PI * 2 * i) / clampedCount + (Math.random() - 0.5) * 0.5;
      const spd = speed * (0.5 + Math.random() * 0.5);

      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * spd;
      p.vy = Math.sin(angle) * spd;
      p.life = lifespan;
      p.maxLife = lifespan;
      p.radius = 2 + Math.random() * 3;
      p.color = color;
      p.active = true;
      p.gfx.setVisible(true);
    }
  }

  /**
   * Emit merge particles (smaller, topcolor).
   */
  mergeBurst(x: number, y: number, color: number): void {
    this.burst(x, y, color, 10, 2, 300);
  }

  /**
   * Emit Zero Sum explosion (bigger, white + color).
   */
  zeroSumExplosion(x: number, y: number, color1: number, color2: number): void {
    this.burst(x, y, color1, 10, 4, 500);
    this.burst(x, y, color2, 8, 3.5, 450);
    this.burst(x, y, 0xffffff, 5, 5, 350);
  }

  /**
   * Emit shrink poof.
   */
  shrinkPoof(x: number, y: number, color: number): void {
    this.burst(x, y, color, 5, 1.5, 250);
  }

  /**
   * Black hole explosion.
   */
  blackHoleExplosion(x: number, y: number): void {
    this.burst(x, y, 0x8800ff, 20, 6, 600);
    this.burst(x, y, 0x00ccff, 15, 5, 500);
    this.burst(x, y, 0xffffff, 10, 7, 400);
  }

  /**
   * Update all active particles. Called each frame.
   */
  update(delta: number): void {
    const dt = delta / 16.666; // normalize to 60fps
    const activeItems = this.pool.getActiveItems();

    activeItems.forEach(p => {
      if (!p.active) return;

      p.life -= delta;
      if (p.life <= 0) {
        this.pool.release(p);
        return;
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 0.05 * dt; // tiny gravity

      const progress = 1 - (p.life / p.maxLife);
      const alpha = 1 - progress;
      const scale = 1 - progress * 0.5;

      p.gfx.clear();
      p.gfx.fillStyle(p.color, alpha);
      p.gfx.fillCircle(0, 0, p.radius * scale);

      // Outer glow
      p.gfx.fillStyle(p.color, alpha * 0.3);
      p.gfx.fillCircle(0, 0, p.radius * scale * 1.8);

      p.gfx.setPosition(p.x, p.y);
    });
  }

  destroy(): void {
    this.pool.releaseAll();
  }
}
