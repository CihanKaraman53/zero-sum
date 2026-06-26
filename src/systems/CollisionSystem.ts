import Phaser from 'phaser';
import { JellyBall } from '../entities/JellyBall';
import { ObjectPool } from '../core/ObjectPool';
import { ParticleManager } from '../effects/ParticleManager';
import { FloatingText } from '../effects/FloatingText';
import { ScoringSystem } from './ScoringSystem';
import { ComboSystem } from './ComboSystem';
import { POSITIVE_COLOR, NEGATIVE_COLOR, CAT_BALL, getBallRadius } from '../core/Constants';

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
  onBallDestroyed: ((wasFrozen: boolean) => void) | null = null;
  onZeroSum: ((absValue: number) => void) | null = null;
  onSplit: (() => void) | null = null;

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

    // Register Matter.js collision listeners for both initial impact and active overlaps
    this.scene.matter.world.on('collisionstart', (e: any) => this.onCollision(e, true), this);
    this.scene.matter.world.on('collisionactive', (e: any) => this.onCollision(e, false), this);
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

  private onCollision(event: any, isStart: boolean): void {
    const pairs = event.pairs;
    for (let i = 0; i < pairs.length; i++) {
      const pair = pairs[i];
      const bodyA = pair.bodyA;
      const bodyB = pair.bodyB;

      // Only process ball-ball collisions
      if (bodyA.label !== 'jellyball' || bodyB.label !== 'jellyball') {
        if (isStart) {
          // Ball hit wall — squash animation
          const ball = bodyA.label === 'jellyball' ? this.getJellyBall(bodyA) :
                       bodyB.label === 'jellyball' ? this.getJellyBall(bodyB) : null;
          if (ball && ball.active) {
            ball.playSquash();
          }
        }
        continue;
      }

      const ballA = this.getJellyBall(bodyA);
      const ballB = this.getJellyBall(bodyB);

      if (!ballA || !ballB || !ballA.active || !ballB.active) continue;

      // Prevent double processing
      const pairId = bodyA.id < bodyB.id ? `${bodyA.id}_${bodyB.id}` : `${bodyB.id}_${bodyA.id}`;
      if (this.processedPairs.has(pairId)) continue;

      // Handle special balls
      if (ballA.special || ballB.special) {
        this.processedPairs.add(pairId);
        this.handleSpecialCollision(ballA, ballB);
        continue;
      }

      const sameSign = ballA.sign === ballB.sign;
      const sameValue = ballA.absValue === ballB.absValue;

      // If they are not merging or zero-summing or shrinking (same sign, different value),
      // we only want to play squash on the initial collision start.
      if (sameSign && !sameValue) {
        if (isStart) {
          this.processedPairs.add(pairId);
          ballA.playSquash();
          ballB.playSquash();
        }
        continue;
      }

      // For merges, zero-sums, and shrinks, we process them immediately on start or active frame
      this.processedPairs.add(pairId);

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

    if (this.onBallDestroyed) this.onBallDestroyed(victim.frozen);
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
    }

    const isLevel3 = (this.scene as any).levelManager?.currentLevelIndex === 2;
    if (isLevel3) {
      this.floatingText.show(midX, midY - 20, '+100 PTS', '#00f0ff', 22, 800);
    } else {
      const color = sign > 0 ? POSITIVE_COLOR : NEGATIVE_COLOR;
      this.particles.mergeBurst(midX, midY, color);
      this.floatingText.showMerge(midX, midY - 20);
    }

    const points = this.scoring.addMerge(newAbsVal);
    if (!isLevel3) {
      this.floatingText.showScore(midX, midY - 40, points);
    }

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
    const isLevel3 = (this.scene as any).levelManager?.currentLevelIndex === 2;

    if (isLevel3) {
      this.floatingText.show(midX, midY - 20, '+500 ZERO SUM!', '#ffffff', 26, 1000);
    } else {
      this.floatingText.showZeroSum(midX, midY - 20);
    }

    // Screen shake
    this.scene.cameras.main.shake(200, 0.008 + absVal * 0.001);

    // Score
    const time = this.scene.time.now;
    const comboCount = this.combo.registerZeroSum(time);
    this.scoring.setComboMultiplier(this.combo.getMultiplier());
    const points = this.scoring.addZeroSum(absVal);
    if (!isLevel3) {
      this.floatingText.showScore(midX, midY - 50, points);
      if (comboCount > 1) {
        this.floatingText.showCombo(midX, midY - 80, comboCount);
      }
    }

    const wasFrozen = ballA.frozen || ballB.frozen;
    if (this.onBallDestroyed) this.onBallDestroyed(wasFrozen);
    if (this.onZeroSum) this.onZeroSum(absVal);
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
    
    if (bigger.absValue === 16 && smallAbsVal === 4) {
      for (let i = 0; i < 3; i++) {
        const newBall = this.ballPool.acquire();
        if (newBall) {
          const ox = (Math.random() - 0.5) * 20;
          const oy = (Math.random() - 0.5) * 20;
          newBall.activate(midX + ox, midY + oy, 4 * bigSign);

          if (newBall.body) {
            const vx = (Math.random() - 0.5) * 4;
            const vy = -2 - Math.random() * 2; // Pop upward
            this.scene.matter.body.setVelocity(newBall.body, { x: vx, y: vy });
          }
        }
      }
      const bigColor = bigSign > 0 ? POSITIVE_COLOR : NEGATIVE_COLOR;
      this.particles.burst(midX, midY, bigColor, 18, 2, 350);
    } else if (newAbsVal > 0) {
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

    const isLevel3 = (this.scene as any).levelManager?.currentLevelIndex === 2;
    if (isLevel3) {
      this.floatingText.show(midX, midY - 20, '+250 SPLIT COMBO!', '#ff33aa', 24, 900);
    }

    const points = this.scoring.addShrink(smallAbsVal);
    if (!isLevel3) {
      this.floatingText.showScore(midX, midY - 20, points);
    }

    if (this.onSplit) this.onSplit();
    if (this.onBallDestroyed) this.onBallDestroyed(smaller.frozen);
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
      if (target.sign < 0) {
        const hitX = special.body!.position.x;
        const hitY = special.body!.position.y;

        // 1. High-speed red sparks burst
        this.particles.burst(hitX, hitY, 0xff0044, 20, 4.0, 500);
        this.floatingText.show(hitX, hitY - 30, 'BLOCKED!', '#ff0044', 22, 800);
        
        // 2. Target squash & red tint flash
        target.playSquash();
        if (target.sprite) {
          target.sprite.setTint(0xff3355);
          this.scene.tweens.add({
            targets: target.sprite,
            alpha: 1, // dummy target to run tween
            duration: 250,
            onComplete: () => {
              if (target.active && target.sprite) {
                target.sprite.clearTint();
              }
            }
          });
        }

        // 3. Double energy ring shockwave effect
        for (let i = 0; i < 2; i++) {
          const ring = this.scene.add.graphics();
          ring.setPosition(hitX, hitY);
          ring.lineStyle(3, 0xff0044, 1.0);
          ring.strokeCircle(0, 0, 10);
          ring.setDepth(24);
          
          this.scene.tweens.add({
            targets: ring,
            scaleX: 3.5,
            scaleY: 3.5,
            alpha: 0,
            delay: i * 120,
            duration: 400,
            ease: 'Cubic.easeOut',
            onComplete: () => {
              ring.destroy();
            }
          });
        }

        // 4. Camera micro-shake
        this.scene.cameras.main.shake(120, 0.007);
        
        special.deactivate();
        this.ballPool.release(special);
        return;
      }

      // ×2: double the target's value
      const newAbsVal = target.absValue * 2;
      const newValue = newAbsVal * target.sign;
      target.setValue(newValue);
      if (newAbsVal >= 2048 && !target.isKing) {
        target.makeKing();
      }
      target.playSquash();

      // Flashes camera on successful X2 multiply!
      this.scene.cameras.main.flash(200, 255, 255, 255);

      this.particles.burst(x, y, 0x00ccff, 20, 3.5, 450);
      this.floatingText.show(x, y - 30, '×2 MULTIPLIER!', '#00f0ff', 24, 800);

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
    } else if (special.special === 'blast') {
      const hitX = special.body!.position.x;
      const hitY = special.body!.position.y;

      // 1. Play massive explosion particle burst
      this.particles.burst(hitX, hitY, 0xff5500, 30, 5.0, 600);
      this.particles.burst(hitX, hitY, 0xffaa00, 20, 3.0, 450);
      this.floatingText.show(hitX, hitY - 40, 'BOOM!', '#ff5500', 30, 900);

      // 2. Camera shake
      this.scene.cameras.main.shake(250, 0.018);

      // 3. Shockwave ring
      const ring = this.scene.add.graphics();
      ring.setPosition(hitX, hitY);
      ring.lineStyle(4, 0xffaa00, 1.0);
      ring.strokeCircle(0, 0, 15);
      ring.setDepth(24);
      this.scene.tweens.add({
        targets: ring,
        scaleX: 6.0,
        scaleY: 6.0,
        alpha: 0,
        duration: 500,
        ease: 'Cubic.easeOut',
        onComplete: () => {
          ring.destroy();
        }
      });

      // 4. Vaporize nearby balls
      const explosionRadius = Math.max(100, target.radius * 3.0);
      const activeBalls = Array.from(this.ballPool.getActiveItems());
      activeBalls.forEach(ball => {
        if (ball.active && ball !== special && ball.body) {
          const bx = ball.body.position.x;
          const by = ball.body.position.y;
          const dist = Phaser.Math.Distance.Between(hitX, hitY, bx, by);
          if (dist <= explosionRadius) {
            // Vaporize ball
            const color = ball.sign > 0 ? 0x00ff88 : 0xff3388;
            this.particles.burst(bx, by, color, 12, 2.0, 350);
            
            ball.deactivate();
            this.ballPool.release(ball);
          }
        }
      });
    } else if (special.special === 'slice') {
      const hitX = target.body!.position.x;
      const hitY = target.body!.position.y;

      const targetValue = target.value;
      const targetAbs = target.absValue;
      const targetSign = target.sign;

      // Deactivate target and slice ball
      target.deactivate();
      this.ballPool.release(target);
      special.deactivate();
      this.ballPool.release(special);

      if (targetAbs <= 2) {
        // Minimal value constraint: vaporize the +2 ball
        this.particles.burst(hitX, hitY, 0xff0044, 12, 2.0, 350);
        this.floatingText.show(hitX, hitY - 30, 'VAPORIZED!', '#ff0044', 22, 700);
        if (this.onBallDestroyed) this.onBallDestroyed(target.frozen);
        return;
      }

      // Slicing logic
      const childValue = targetValue / 2;
      const childRadius = getBallRadius(Math.abs(childValue));

      // Spawn two child balls
      for (let i = 0; i < 2; i++) {
        const childBall = this.ballPool.acquire();
        if (childBall) {
          // Offset them by their radius + 5 pixels to guarantee they do not overlap and merge back
          const offsetX = (i === 0 ? -1 : 1) * (childRadius + 5);
          childBall.activate(hitX + offsetX, hitY, childValue);

          if (childBall.body) {
            const vx = (i === 0 ? -1 : 1) * (2.0 + Math.random() * 1.0);
            const vy = -1.5 - Math.random() * 1.5;
            this.scene.matter.body.setVelocity(childBall.body, { x: vx, y: vy });
          }
        }
      }

      this.particles.burst(hitX, hitY, 0xff0044, 20, 3.5, 500);
      this.floatingText.show(hitX, hitY - 30, 'SLICED!', '#ff0044', 26, 800);
      this.scene.cameras.main.shake(150, 0.008);

      if (this.onSplit) this.onSplit();
      if (this.onBallDestroyed) this.onBallDestroyed(target.frozen);
      return;
    } else if (special.special === 'chance') {
      const hitX = target.body!.position.x;
      const hitY = target.body!.position.y;
      
      const targetValue = target.value;

      // Pool of values excluding 0
      const possibleValues = [-16, -8, -4, -2, 2, 4, 8, 16];
      // Filter out current value to ensure it always changes/rolls to something new!
      const filtered = possibleValues.filter(v => v !== targetValue);
      const newValue = filtered[Math.floor(Math.random() * filtered.length)];

      // Change target ball value
      target.setValue(newValue);
      target.playSquash();

      // Deactivate and release special ball
      special.deactivate();
      this.ballPool.release(special);

      // Particle effect and floating text
      // Neon Purple/Cyan color theme for the Dice/Quantum roll
      const effectColor = newValue > 0 ? 0xaa00ff : 0x00ccff;
      this.particles.burst(hitX, hitY, effectColor, 20, 3.0, 500);
      this.floatingText.show(hitX, hitY - 30, 'ROLL!', '#aa00ff', 26, 800);
      this.scene.cameras.main.shake(120, 0.007);
      return;
    }

    // Remove special ball
    special.deactivate();
    this.ballPool.release(special);
  }

  destroy(): void {
    this.scene.matter.world.off('collisionstart', this.onCollision, this);
  }
}
