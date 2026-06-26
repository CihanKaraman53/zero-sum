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
  private timer: number = 0; // ms in current state

  // Timings in milliseconds
  private readonly DURATION_SILENCE = 5000;
  private readonly DURATION_WARNING = 2000;
  private readonly DURATION_STORM = 2000;

  // Configuration
  private readonly columnWidth = 120;
  private readonly maxPushHeight = 180; // push balls higher up the screen

  // Particles
  private particles: WindParticle[] = [];
  private readonly maxParticles = 150;

  constructor(scene: Phaser.Scene, ballPool: ObjectPool<JellyBall>) {
    this.scene = scene;
    this.ballPool = ballPool;

    // Create graphics layer for rendering air streams (vents themselves are now invisible)
    this.gfx = scene.add.graphics().setDepth(5);

    // Pre-allocate particles to avoid GC churn
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
      this.particles.forEach(p => p.alpha = 0);
    }
  }

  update(time: number, delta: number): void {
    this.timer += delta;

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

    this.applyAirForces();
    this.updateParticles(delta);
    this.draw();
  }

  private applyAirForces(): void {
    if (this.state === 'SILENCE') return;

    // Access dynamic container bounds from the GameScene
    const containerLeft = (this.scene as any).containerLeft;
    const containerRight = (this.scene as any).containerRight;
    const containerBottom = (this.scene as any).containerBottom;

    const activeBalls = this.ballPool.getActiveItems();

    activeBalls.forEach(ball => {
      if (ball.active && ball.body) {
        const bx = ball.body.position.x;
        const by = ball.body.position.y;

        // Check bounds dynamically
        const inLeftCol = bx >= containerLeft && bx <= containerLeft + this.columnWidth;
        const inRightCol = bx >= containerRight - this.columnWidth && bx <= containerRight;
        
        // Push if inside the container height range (covering the entire left/right sides)
        const inHeight = by > (this.scene as any).containerTop && by < containerBottom;

        if ((inLeftCol || inRightCol) && inHeight) {
          const currentVel = ball.body.velocity;

          if (this.state === 'WARNING') {
            // Vibrate/shake slightly in place without drifting sideways or towards the center
            const vx = (Math.random() - 0.5) * 0.8;
            const vy = (Math.random() - 0.5) * 0.8;
            this.scene.matter.body.setVelocity(ball.body, { x: vx, y: vy });
            ball.playSquash(); // Wobble feedback
          } else if (this.state === 'STORM') {
            // Push towards center slightly to avoid scraping walls: positive vx for left column, negative vx for right column
            const pushDir = inLeftCol ? 1 : -1;
            
            // Instantly apply maximum upward velocity for an explosive, instant blast!
            const targetVy = -25.0;
            
            // Slight inward bias + tiny random spread to go straight up and scatter nicely
            const targetVx = pushDir * 0.8 + (Math.random() - 0.5) * 1.0;
            
            this.scene.matter.body.setVelocity(ball.body, { x: targetVx, y: targetVy });
          }
        }
      }
    });
  }

  private updateParticles(delta: number): void {
    const containerLeft = (this.scene as any).containerLeft;
    const containerRight = (this.scene as any).containerRight;
    const containerBottom = (this.scene as any).containerBottom;

    if (this.state !== 'SILENCE') {
      const spawnChance = this.state === 'STORM' ? 0.4 : 0.15;
      this.particles.forEach(p => {
        if (p.alpha <= 0 && Math.random() < spawnChance) {
          const isLeft = Math.random() < 0.5;
          const minX = isLeft ? containerLeft + 5 : containerRight - this.columnWidth + 5;
          const maxX = isLeft ? containerLeft + this.columnWidth - 5 : containerRight - 5;
          
          p.x = Phaser.Math.Between(minX, maxX);
          p.y = containerBottom - 10;
          p.alpha = 0.6 + Math.random() * 0.4;
          
          if (this.state === 'STORM') {
            p.vy = -3.5 - Math.random() * 2.5;
            p.isStreamer = Math.random() < 0.6;
            p.length = p.isStreamer ? 15 + Math.random() * 20 : 0;
            p.size = p.isStreamer ? 2 : 2 + Math.random() * 3;
            p.color = 0xffffff;
          } else {
            p.vy = -0.8 - Math.random() * 0.6;
            p.isStreamer = false;
            p.length = 0;
            p.size = 2 + Math.random() * 2;
            p.color = 0x00ccff;
          }
        }
      });
    }

    // Slower decay so particles reach the top of the container
    const decay = this.state === 'STORM' ? delta * 0.0004 : delta * 0.0008;
    this.particles.forEach(p => {
      if (p.alpha > 0) {
        p.y += p.vy * (delta / 16.666);
        p.alpha -= decay;

        // Clean up when reaching the top or fading out
        if (p.y < (this.scene as any).containerTop || p.alpha <= 0) {
          p.alpha = 0;
        }
      }
    });
  }

  private draw(): void {
    this.gfx.clear();

    // Vents are now completely invisible (grate drawing code removed per requirements)

    // Draw active wind particles and streamers
    this.particles.forEach(p => {
      if (p.alpha > 0) {
        if (p.isStreamer) {
          this.gfx.lineStyle(p.size, p.color, p.alpha);
          this.gfx.lineBetween(p.x, p.y, p.x, p.y - p.length);
        } else {
          this.gfx.fillStyle(p.color, p.alpha);
          this.gfx.fillCircle(p.x, p.y, p.size);
          if (this.state === 'STORM') {
            this.gfx.lineStyle(1, 0x00ccff, p.alpha * 0.5);
            this.gfx.strokeCircle(p.x, p.y, p.size + 1.5);
          }
        }
      }
    });
  }

  destroy(): void {
    this.gfx.destroy();
  }
}
