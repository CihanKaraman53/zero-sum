import Phaser from 'phaser';
import { JellyBall } from '../entities/JellyBall';
import { ObjectPool } from '../core/ObjectPool';
import { ParticleManager } from '../effects/ParticleManager';
import { ScoringSystem } from './ScoringSystem';
import {
  CONTAINER_CENTER_X, CONTAINER_CENTER_Y, BLACK_HOLE_DURATION, CAT_BALL
} from '../core/Constants';

/**
 * BlackHoleSystem — handles the Chain Reaction Black Hole combo mechanic.
 * Spawns a vortex in the center, pulls all balls, annihilates them, then explodes.
 */
export class BlackHoleSystem {
  scene: Phaser.Scene;
  ballPool: ObjectPool<JellyBall>;
  particles: ParticleManager;
  scoring: ScoringSystem;

  isActive: boolean = false;
  private timer: number = 0;
  private vortexGfx: Phaser.GameObjects.Graphics;
  private vortexRotation: number = 0;
  private destroyedCount: number = 0;

  constructor(
    scene: Phaser.Scene,
    ballPool: ObjectPool<JellyBall>,
    particles: ParticleManager,
    scoring: ScoringSystem
  ) {
    this.scene = scene;
    this.ballPool = ballPool;
    this.particles = particles;
    this.scoring = scoring;

    this.vortexGfx = scene.add.graphics();
    this.vortexGfx.setPosition(CONTAINER_CENTER_X, CONTAINER_CENTER_Y);
    this.vortexGfx.setDepth(15); // Between background and balls
    this.vortexGfx.setVisible(false);
  }

  forceHide(): void {
    this.isActive = false;
    this.timer = 0;
    this.vortexGfx.setVisible(false);
    this.vortexGfx.clear();
    this.scene.tweens.killTweensOf(this.vortexGfx);
  }

  /**
   * Trigger the black hole event.
   */
  trigger(): void {
    if (this.isActive) return;

    this.isActive = true;
    this.timer = BLACK_HOLE_DURATION;
    this.vortexRotation = 0;
    this.destroyedCount = 0;

    this.vortexGfx.setVisible(true);
    this.vortexGfx.setScale(0.1);
    this.scene.tweens.add({
      targets: this.vortexGfx,
      scaleX: 1,
      scaleY: 1,
      duration: 500,
      ease: 'Back.easeOut',
    });

    // Screen shake
    this.scene.cameras.main.shake(300, 0.01);
  }

  /**
   * Update the black hole effect and physics pull.
   */
  update(delta: number): void {
    if (!this.isActive) return;

    this.timer -= delta;

    // Draw the vortex
    this.vortexRotation += 0.05 * (delta / 16.666);
    this.drawVortex();

    // Pull logic
    const pullStrength = 0.0003; // Base force magnitude
    const maxDist = 300;
    const centerX = CONTAINER_CENTER_X;
    const centerY = CONTAINER_CENTER_Y;

    const activeBalls = this.ballPool.getActiveItems();
    activeBalls.forEach((ball) => {
      if (!ball.active || !ball.body || ball.frozen) return;

      const bx = ball.body.position.x;
      const by = ball.body.position.y;
      const dx = centerX - bx;
      const dy = centerY - by;
      const distSq = dx * dx + dy * dy;
      const dist = Math.sqrt(distSq);

      if (dist < maxDist) {
        // Apply radial gravity
        const forceMag = pullStrength * (1 - dist / maxDist) * ball.body.mass;
        const forceX = (dx / dist) * forceMag;
        const forceY = (dy / dist) * forceMag;

        this.scene.matter.body.applyForce(ball.body, ball.body.position, { x: forceX, y: forceY });

        // Annihilation if close enough to center
        if (dist < 40) {
          ball.deactivate();
          this.ballPool.release(ball);
          this.destroyedCount++;
          this.particles.burst(bx, by, 0x8800ff, 5, 2, 200);
        }
      }
    });

    // Detonate when time is up
    if (this.timer <= 0) {
      this.detonate();
    }
  }

  private drawVortex(): void {
    this.vortexGfx.clear();
    const r = 60 + Math.sin(this.timer * 0.01) * 10; // Pulsing radius

    // Core
    this.vortexGfx.fillStyle(0x000000, 1);
    this.vortexGfx.fillCircle(0, 0, r * 0.4);

    // Event horizon (glow)
    this.vortexGfx.lineStyle(4, 0x8800ff, 0.8);
    this.vortexGfx.strokeCircle(0, 0, r * 0.6);

    // Spiral arms
    this.vortexGfx.lineStyle(2, 0x00ccff, 0.6);
    for (let i = 0; i < 4; i++) {
      const angleOffset = (Math.PI / 2) * i + this.vortexRotation;
      this.vortexGfx.beginPath();
      for (let j = 0; j < 10; j++) {
        const rad = r * 0.3 + (j / 10) * (r * 0.8);
        const theta = angleOffset + (j / 10) * Math.PI;
        const px = Math.cos(theta) * rad;
        const py = Math.sin(theta) * rad;
        if (j === 0) this.vortexGfx.moveTo(px, py);
        else this.vortexGfx.lineTo(px, py);
      }
      this.vortexGfx.strokePath();
    }
  }

  private detonate(): void {
    this.isActive = false;

    // Tween out vortex
    this.scene.tweens.add({
      targets: this.vortexGfx,
      scaleX: 0.1,
      scaleY: 0.1,
      alpha: 0,
      duration: 300,
      onComplete: () => {
        this.vortexGfx.setVisible(false);
        this.vortexGfx.setAlpha(1);
      }
    });

    // Massive explosion
    this.particles.blackHoleExplosion(CONTAINER_CENTER_X, CONTAINER_CENTER_Y);
    this.scene.cameras.main.shake(500, 0.02);

    // Outward shockwave
    const pushStrength = 0.01;
    const activeBalls = this.ballPool.getActiveItems();
    activeBalls.forEach((ball) => {
      if (!ball.active || !ball.body || ball.frozen) return;
      const bx = ball.body.position.x;
      const by = ball.body.position.y;
      const dx = bx - CONTAINER_CENTER_X;
      const dy = by - CONTAINER_CENTER_Y;
      const distSq = dx * dx + dy * dy;
      if (distSq > 0.1) {
        const dist = Math.sqrt(distSq);
        const forceX = (dx / dist) * pushStrength * ball.body.mass;
        const forceY = (dy / dist) * pushStrength * ball.body.mass;
        this.scene.matter.body.applyForce(ball.body, ball.body.position, { x: forceX, y: forceY });
      }
    });

    // Reward points based on destroyed balls
    if (this.destroyedCount > 0) {
      this.scoring.addBlackHoleClear(this.destroyedCount);
    }
  }
}
