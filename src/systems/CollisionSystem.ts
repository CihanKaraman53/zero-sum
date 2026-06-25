import Phaser from 'phaser';
import { JellyBall } from '../entities/JellyBall';
import { ObjectPool } from '../core/ObjectPool';
import { ParticleManager } from '../effects/ParticleManager';
import { FloatingText } from '../effects/FloatingText';
import { ScoringSystem } from './ScoringSystem';
import { ComboSystem } from './ComboSystem';
import { POSITIVE_COLOR, NEGATIVE_COLOR, CAT_BALL } from '../core/Constants';

export interface CollisionResult {
  type: 'merge' | 'zerosum' | 'shrink' | 'special' | 'none';
  ballA: JellyBall;
  ballB: JellyBall;
  points: number;
}

/**
 * CollisionSystem — handles all jelly ball collision logic.
 * Merge (same sign + same value), Zero Sum (opposite sign + same value),
 * Shrink (opposite sign + different value).
 */
export class CollisionSystem {
  scene: Phaser.Scene;
  ballPool: ObjectPool<JellyBall>;
  particles: ParticleManager;
  floatingText: FloatingText;
  scoring: ScoringSystem;
  combo: ComboSystem;

  // Prevent double-processing in same frame
  private processedPairs: Set<string> = new Set();
  // Fusion callback for level manager
  onFusion: ((absValue: number) => void) | null = null;
  onBallDestroyed: (() => void) | null = null;

  constructor(
    scene: Phaser.Scene,
    ballPool: ObjectPool<JellyBall>,
    particles: ParticleManager,
    floatingText: FloatingText,
    scoring: ScoringSystem,
    combo: ComboSystem
  ) {
    this.scene = scene;
    this.ballPool = ballPool;
    this.particles = particles;
    this.floatingText = floatingText;
    this.scoring = scoring;
    this.combo = combo;

    // Register Matter.js collision listener
    this.scene.matter.world.on('collisionstart', this.onCollision, this);
  }

  clearProcessed(): void {
    this.processedPairs.clear();
  }

  private getJellyBall(body: any): JellyBall | null {
    if (!body) return null;
    if (body.jellyBall) return body.jellyBall;
    if (body.parent && body.parent.jellyBall) return body.parent.jellyBall;
    if (body.gameObject && (body.gameObject as any).jellyBall) return (body.gameObject as any).jellyBall;
    return null;
  }

  private onCollision(event: any): void {
    const pairs = event.pairs;
    for (let i = 0; i < pairs.length; i++) {
      const pair = pairs[i];
      const bodyA = pair.bodyA;
      const bodyB = pair.bodyB;

      // Only process ball-ball collisions
      if (bodyA.label !== 'jellyball' || bodyB.label !== 'jellyball') {
        // Ball hit wall — squash animation
        const ball = bodyA.label === 'jellyball' ? this.getJellyBall(bodyA) :
                     bodyB.label === 'jellyball' ? this.getJellyBall(bodyB) : null;
        if (ball && ball.active) {
          ball.playSquash();
        }
        continue;
      }

      const ballA = this.getJellyBall(bodyA);
      const ballB = this.getJellyBall(bodyB);

      if (!ballA || !ballB || !ballA.active || !ballB.active) continue;

      // Prevent double processing
      const pairId = bodyA.id < bodyB.id ? `${bodyA.id}_${bodyB.id}` : `${bodyB.id}_${bodyA.id}`;
      if (this.processedPairs.has(pairId)) continue;
      this.processedPairs.add(pairId);

      // Handle special balls
      if (ballA.special || ballB.special) {
        this.handleSpecialCollision(ballA, ballB);
        continue;
      }

      this.processCollision(ballA, ballB);
    }
  }

  private processCollision(ballA: JellyBall, ballB: JellyBall): void {
    const sameSign = ballA.sign === ballB.sign;
    const sameValue = ballA.absValue === ballB.absValue;

    if (sameSign && sameValue) {
      // MERGE: same sign + same value
      this.handleMerge(ballA, ballB);
    } else if (!sameSign) {
      // Opposite signs!
      if (ballA.isKing || ballB.isKing) {
        if (ballA.isKing && ballB.isKing) {
          // Both are Kings! And opposite sign. Zero Sum.
          if (sameValue) {
            this.handleZeroSum(ballA, ballB);
          } else {
            // Shouldn't happen if Kings are only 16, but safe fallback
            this.handleShrink(ballA, ballB);
          }
        } else {
          // One is King, the other is not. The King DESTROYS the other without taking damage.
          this.handleKingDestroy(ballA.isKing ? ballA : ballB, ballA.isKing ? ballB : ballA);
        }
      } else if (sameValue) {
        this.handleZeroSum(ballA, ballB);
      } else {
        this.handleShrink(ballA, ballB);
      }
    } else {
      // Same sign, different value — just squash
      ballA.playSquash();
      ballB.playSquash();
    }
  }

  private handleKingDestroy(king: JellyBall, victim: JellyBall): void {
    const midX = victim.body!.position.x;
    const midY = victim.body!.position.y;
    const victimVal = victim.absValue;

    // Destroy victim
    victim.deactivate();
    this.ballPool.release(victim);

    // King squashes but takes no damage
    king.playSquash();

    const color = victim.sign > 0 ? POSITIVE_COLOR : NEGATIVE_COLOR;
    this.particles.shrinkPoof(midX, midY, color);

    const points = this.scoring.addShrink(victimVal);
    this.floatingText.showScore(midX, midY - 20, points);

    if (this.onBallDestroyed) this.onBallDestroyed();
  }

  private handleMerge(ballA: JellyBall, ballB: JellyBall): void {
    const absVal = ballA.absValue;
    const sign = ballA.sign;

    const newAbsVal = absVal * 2;
    const newValue = newAbsVal * sign;
    const midX = (ballA.body!.position.x + ballB.body!.position.x) / 2;
    const midY = (ballA.body!.position.y + ballB.body!.position.y) / 2;

    // Remove B, evolve A
    ballB.deactivate();
    this.ballPool.release(ballB);

    ballA.setValue(newValue);
    if (ballA.body) {
      this.scene.matter.body.setPosition(ballA.body, { x: midX, y: midY });
    }
    ballA.playSquash();

    if (newAbsVal >= 2048) {
      ballA.makeKing();
      const color = sign > 0 ? POSITIVE_COLOR : NEGATIVE_COLOR;
      this.particles.mergeBurst(midX, midY, color);
      this.floatingText.show(midX, midY, '👑 KING!', '#ffd700', 28, 1000);
    } else {
      const color = sign > 0 ? POSITIVE_COLOR : NEGATIVE_COLOR;
      this.particles.mergeBurst(midX, midY, color);
      this.floatingText.showMerge(midX, midY - 20);
    }

    const points = this.scoring.addMerge(newAbsVal);
    this.floatingText.showScore(midX, midY - 40, points);

    if (this.onFusion) this.onFusion(newAbsVal);
  }

  private handleZeroSum(ballA: JellyBall, ballB: JellyBall): void {
    const absVal = ballA.absValue;
    const midX = (ballA.body!.position.x + ballB.body!.position.x) / 2;
    const midY = (ballA.body!.position.y + ballB.body!.position.y) / 2;

    // Destroy both
    ballA.deactivate();
    ballB.deactivate();
    this.ballPool.release(ballA);
    this.ballPool.release(ballB);

    // Epic explosion
    this.particles.zeroSumExplosion(midX, midY, POSITIVE_COLOR, NEGATIVE_COLOR);
    this.floatingText.showZeroSum(midX, midY - 20);

    // Screen shake
    this.scene.cameras.main.shake(200, 0.008 + absVal * 0.001);

    // Score
    const time = this.scene.time.now;
    const comboCount = this.combo.registerZeroSum(time);
    this.scoring.setComboMultiplier(this.combo.getMultiplier());
    const points = this.scoring.addZeroSum(absVal);
    this.floatingText.showScore(midX, midY - 50, points);

    if (comboCount > 1) {
      this.floatingText.showCombo(midX, midY - 80, comboCount);
    }

    if (this.onBallDestroyed) this.onBallDestroyed();
  }

  private handleShrink(ballA: JellyBall, ballB: JellyBall): void {
    // Determine which is bigger
    let bigger: JellyBall, smaller: JellyBall;
    if (ballA.absValue > ballB.absValue) {
      bigger = ballA;
      smaller = ballB;
    } else {
      bigger = ballB;
      smaller = ballA;
    }

    const midX = bigger.body!.position.x;
    const midY = bigger.body!.position.y;
    const smallAbsVal = smaller.absValue;
    const bigSign = bigger.sign;

    // Destroy both balls (Splitting mechanic)
    smaller.deactivate();
    this.ballPool.release(smaller);
    
    bigger.deactivate();
    this.ballPool.release(bigger);

    const newAbsVal = bigger.absValue - smallAbsVal;
    
    if (newAbsVal > 0) {
      // Split into powers of 2 using binary representation
      let spawnCount = 0;
      let tempVal = newAbsVal;
      let power = 2;
      while (tempVal > 0) {
        if ((tempVal & power) === power) {
          // Spawn this ball
          const newBall = this.ballPool.acquire();
          if (newBall) {
            // Offset slightly to prevent exact overlap
            const ox = (Math.random() - 0.5) * 20;
            const oy = (Math.random() - 0.5) * 20;
            newBall.activate(midX + ox, midY + oy, power * bigSign);

            if (power >= 2048) {
              newBall.makeKing();
            }

            // Apply velocity burst (pof pof pof)
            if (newBall.body) {
              const vx = (Math.random() - 0.5) * 4;
              const vy = -1 - Math.random() * 2; // Pop upward
              this.scene.matter.body.setVelocity(newBall.body, { x: vx, y: vy });
            }
          }
          spawnCount++;
          tempVal -= power;
        }
        power *= 2;
      }
      
      const bigColor = bigSign > 0 ? POSITIVE_COLOR : NEGATIVE_COLOR;
      this.particles.burst(midX, midY, bigColor, spawnCount * 6, 2, 350);
    } else {
      // Fallback
      this.particles.zeroSumExplosion(midX, midY, POSITIVE_COLOR, NEGATIVE_COLOR);
    }

    const color = smaller.sign > 0 ? POSITIVE_COLOR : NEGATIVE_COLOR;
    this.particles.shrinkPoof(midX, midY, color);

    const points = this.scoring.addShrink(smallAbsVal);
    this.floatingText.showScore(midX, midY - 20, points);

    if (this.onBallDestroyed) this.onBallDestroyed();
  }

  private handleSpecialCollision(ballA: JellyBall, ballB: JellyBall): void {
    let special: JellyBall, target: JellyBall;

    if (ballA.special) {
      special = ballA;
      target = ballB;
    } else {
      special = ballB;
      target = ballA;
    }

    // Don't process special vs special
    if (target.special) return;

    const x = target.body!.position.x;
    const y = target.body!.position.y;

    if (special.special === 'multiply') {
      // ×2: double the target's value
      const newAbsVal = target.absValue * 2;
      const newValue = newAbsVal * target.sign;
      target.setValue(newValue);
      if (newAbsVal >= 2048 && !target.isKing) {
        target.makeKing();
      }
      target.playSquash();

      this.particles.burst(x, y, 0x00ccff, 12, 3, 350);
      this.floatingText.show(x, y - 30, '×2!', '#00ccff', 26, 700);

      if (this.onFusion) this.onFusion(newAbsVal);
    } else if (special.special === 'divide') {
      // ÷2: split target into two smaller balls
      const halfAbsVal = target.absValue / 2;
      if (halfAbsVal >= 2) {
        const halfValue = halfAbsVal * target.sign;
        target.setValue(halfValue);

        // Spawn second ball from pool
        const newBall = this.ballPool.acquire();
        if (newBall) {
          newBall.activate(x + 20, y - 10, halfValue);
          // Push apart
          if (newBall.body) {
            this.scene.matter.body.setVelocity(newBall.body, { x: 1.5, y: -1 });
          }
          if (target.body) {
            this.scene.matter.body.setVelocity(target.body, { x: -1.5, y: -1 });
          }
        }

        this.particles.burst(x, y, 0x00ccff, 8, 2, 300);
        this.floatingText.show(x, y - 30, '÷2!', '#00ccff', 26, 700);
      }
    }

    // Remove special ball
    special.deactivate();
    this.ballPool.release(special);
  }

  destroy(): void {
    this.scene.matter.world.off('collisionstart', this.onCollision, this);
  }
}
