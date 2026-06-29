import Phaser from 'phaser';
import { JellyBall } from '../entities/JellyBall';
import { BallEntity } from '../entities/BallEntity';
import { ObjectPool } from '../core/ObjectPool';
import { ParticleManager } from '../effects/ParticleManager';
import { FloatingText } from '../effects/FloatingText';
import { ScoringSystem } from './ScoringSystem';
import { ComboSystem } from './ComboSystem';
import { POSITIVE_COLOR, NEGATIVE_COLOR, FACTION_COLORS, CAT_BALL, getBallRadius, CONTAINER_TOP, CONTAINER_LEFT, CONTAINER_RIGHT, CONTAINER_BOTTOM } from '../core/Constants';
import { BallFaction } from '../entities/BallEntity';

export interface CollisionResult {
  type: 'merge' | 'zerosum' | 'shrink' | 'special' | 'none';
  ballA: JellyBall;
  ballB: JellyBall;
  points: number;
}


const JELLY_LABEL = 'jellyball';

type CollisionPair = { bodyA: MatterJS.BodyType; bodyB: MatterJS.BodyType };

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

  /** Numeric pair keys — no string allocation per collision. */
  private processedPairs = new Set<number>();
  /** Ball-ball pairs queued during collisionstart; resolved after the Matter step. */
  private pendingPairs: CollisionPair[] = [];
  /** Tick counter — used to throttle the overlap sweep. */
  private overlapTick = 0;
  /** Set when a value changes (activate/merge/setValue), forcing one overlap sweep. */
  private pendingOverlapSweep = false;
  private readonly onCollisionStart = (event: { pairs: CollisionPair[] }) => this.queueCollisions(event);
  private readonly onAfterUpdate = () => this.flushPendingCollisions();
  // Fusion callback for level manager
  onFusion: ((value: number, faction: BallFaction, source: BallEntity) => void) | null = null;
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

    // collisionstart only — collisionactive fires per pair per step (huge CPU sink with stacks)
    this.scene.matter.world.on('collisionstart', this.onCollisionStart);
    this.scene.matter.world.on('afterupdate', this.onAfterUpdate);
  }

  clearProcessed(): void {
    this.processedPairs.clear();
    this.pendingPairs.length = 0;
  }

  /** External nudge — call after value changes to force one overlap sweep next step. */
  requestOverlapSweep(): void {
    this.pendingOverlapSweep = true;
  }

  destroy(): void {
    this.scene.matter.world.off('collisionstart', this.onCollisionStart);
    this.scene.matter.world.off('afterupdate', this.onAfterUpdate);
  }

  private getBall(body: MatterJS.BodyType): BallEntity | null {
    return (body as MatterJS.Body & { gameBall?: BallEntity }).gameBall ?? null;
  }

  private pairKey(idA: number, idB: number): number {
    return idA < idB ? idA * 65536 + idB : idB * 65536 + idA;
  }

  private getEntityX(ball: BallEntity): number {
    return ball.body ? ball.body.position.x : ball.anchorX;
  }

  private getEntityY(ball: BallEntity): number {
    return ball.body ? ball.body.position.y : ball.anchorY;
  }

  private releaseBall(ball: BallEntity): void {
    ball.deactivate();
    this.ballPool.release(ball as JellyBall);
  }

  private forEachActiveBall(fn: (ball: BallEntity) => void): void {
    this.ballPool.forEachActive(fn);
  }

  private queueCollisions(event: { pairs: CollisionPair[] }): void {
    const pairs = event.pairs;
    const len = pairs.length;
    for (let i = 0; i < len; i++) {
      const pair = pairs[i];
      const labelA = pair.bodyA.label;
      const labelB = pair.bodyB.label;

      const aIsBall = labelA === JELLY_LABEL;
      const bIsBall = labelB === JELLY_LABEL;
      if (!aIsBall && !bIsBall) continue;

      // Wall/obstacle squash only — no body add/remove
      if (!aIsBall || !bIsBall) {
        const ball = aIsBall ? this.getBall(pair.bodyA) : this.getBall(pair.bodyB);
        if (ball?.active) ball.playSquash();
        continue;
      }

      this.pendingPairs.push(pair);
    }
  }

  private flushPendingCollisions(): void {
    const pending = this.pendingPairs;
    const len = pending.length;
    for (let i = 0; i < len; i++) {
      const pair = pending[i];
      if (!pair.bodyA?.id || !pair.bodyB?.id) continue;

      const ballA = this.getBall(pair.bodyA);
      const ballB = this.getBall(pair.bodyB);
      if (!ballA || !ballB || !ballA.active || !ballB.active) continue;
      if ((ballA as JellyBall).harvesting || (ballB as JellyBall).harvesting) continue;

      // Green ↔ red: normal physics bounce, but NO merge / zero-sum / shrink.
      if (ballA.faction !== ballB.faction) {
        ballA.playSquash();
        ballB.playSquash();
        continue;
      }

      const pairId = this.pairKey(pair.bodyA.id, pair.bodyB.id);
      if (this.processedPairs.has(pairId)) continue;
      this.processedPairs.add(pairId);

      if (ballA.frozen || ballB.frozen) {
        if (ballA.frozen && ballB.frozen) {
          ballA.playSquash();
          ballB.playSquash();
          continue;
        }
        const anchor = ballA.frozen ? ballA : ballB;
        const dynamic = ballA.frozen ? ballB : ballA;
        if ((dynamic as JellyBall).special) {
          this.handleSpecialCollision(dynamic as JellyBall, anchor);
        } else {
          this.processAnchorCollision(anchor, dynamic);
        }
        continue;
      }

      if (ballA.special || ballB.special) {
        this.handleSpecialCollision(ballA as JellyBall, ballB);
        continue;
      }

      const sameSign = ballA.sign === ballB.sign;
      const sameValue = ballA.absValue === ballB.absValue;

      if (sameSign && !sameValue) {
        ballA.playSquash();
        ballB.playSquash();
        continue;
      }

      this.processCollision(ballA, ballB);
    }

    // Throttle the N² overlap sweep — runs every 6 physics steps, or on demand.
    this.overlapTick++;
    if (this.pendingOverlapSweep || pending.length > 0 || this.overlapTick >= 6) {
      this.overlapTick = 0;
      this.pendingOverlapSweep = false;
      this.checkOverlapMerges();
    }

    pending.length = 0;
    this.processedPairs.clear();
  }

  /**
   * Görsel ≈ fizik dairesi — küçük tolerans yeterli.
   * Zero-alloc: iterates the pool's raw active slice directly.
   */
  private checkOverlapMerges(): void {
    const list = this.ballPool.getActiveList();
    const count = this.ballPool.getActiveCount();

    for (let i = 0; i < count; i++) {
      const a = list[i];
      if (!a.active || !a.body || a.harvesting || a.frozen || a.special) continue;
      const bodyA = a.body;
      const ax = bodyA.position.x;
      const ay = bodyA.position.y;
      const aSign = a.sign;
      const aAbs = a.absValue;
      const aFaction = a.faction;
      const aRadius = a.radius;

      for (let j = i + 1; j < count; j++) {
        const b = list[j];
        if (!b.active || !b.body || b.harvesting || b.frozen || b.special) continue;
        if (b.faction !== aFaction) continue;
        if (b.sign !== aSign || b.absValue !== aAbs) continue;

        const bodyB = b.body;
        if (!bodyA.id || !bodyB.id) break;

        const pairId = this.pairKey(bodyA.id, bodyB.id);
        if (this.processedPairs.has(pairId)) continue;

        const dx = ax - bodyB.position.x;
        const dy = ay - bodyB.position.y;
        const distSq = dx * dx + dy * dy;
        const touch = aRadius + b.radius + 2;
        if (distSq <= touch * touch) {
          this.processedPairs.add(pairId);
          const lower = ay >= bodyB.position.y ? a : b;
          const upper = lower === a ? b : a;
          this.handleMerge(lower, upper);
          if (!a.active) break;
        }
      }
    }
  }

  private processAnchorCollision(anchor: BallEntity, dynamic: BallEntity): void {
    const sameSign = anchor.sign === dynamic.sign;
    const sameValue = anchor.absValue === dynamic.absValue;

    if (sameSign && sameValue) {
      this.handleMerge(anchor, dynamic);
    } else if (sameSign) {
      anchor.playSquash();
      dynamic.playSquash();
    } else if (sameValue) {
      this.handleZeroSum(anchor, dynamic);
    } else {
      this.handleShrink(anchor, dynamic);
    }
  }

  private processCollision(ballA: BallEntity, ballB: BallEntity): void {
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

  private factionColor(faction: BallFaction): number {
    return FACTION_COLORS[faction];
  }

  private handleKingDestroy(king: BallEntity, victim: BallEntity): void {
    const midX = victim.body!.position.x;
    const midY = victim.body!.position.y;
    const victimVal = victim.absValue;

    // Destroy victim
    victim.deactivate();
    this.releaseBall(victim);

    // King squashes but takes no damage
    king.playSquash();

    const color = this.factionColor(victim.faction);
    this.particles.shrinkPoof(midX, midY, color);

    const points = this.scoring.addShrink(victimVal);
    this.floatingText.showScore(midX, midY - 20, points);

    if (this.onBallDestroyed) this.onBallDestroyed(victim.frozen);
  }

  private handleMerge(ballA: BallEntity, ballB: BallEntity): void {
    let survivor = ballA;
    let other = ballB;
    const yA = this.getEntityY(ballA);
    const yB = this.getEntityY(ballB);
    if (yB > yA) {
      survivor = ballB;
      other = ballA;
    }

    const absVal = survivor.absValue;
    const sign = survivor.sign;
    const newAbsVal = absVal * 2;
    const newValue = newAbsVal * sign;

    const sx = this.getEntityX(survivor);
    const sy = this.getEntityY(survivor);
    const ox = this.getEntityX(other);
    const oy = this.getEntityY(other);
    const survivorR = survivor.radius;
    const otherR = other.radius;
    const oldR = survivorR;
    const sameRow = Math.abs(sy - oy) < oldR * 0.55;
    const mergeX = sameRow ? (sx + ox) / 2 : sx;
    const bottomY = Math.max(sy + survivorR, oy + otherR);

    const vx = survivor.body && other.body
      ? (survivor.body.velocity.x + other.body.velocity.x) * 0.2
      : 0;

    other.deactivate();
    this.releaseBall(other);

    survivor.setValue(newValue);
    this.pendingOverlapSweep = true;
    const settleY = bottomY - survivor.radius;
    const mergeY = settleY;

    if (survivor.body) {
      this.scene.matter.body.setPosition(survivor.body, { x: mergeX, y: settleY });
      this.scene.matter.body.setVelocity(survivor.body, { x: vx, y: 2 });
      this.scene.matter.body.setAngularVelocity(survivor.body, 0);
    }
    if (survivor.frozen) {
      survivor.anchorX = mergeX;
      survivor.anchorY = settleY;
    }
    survivor.playSquash();

    if (newAbsVal >= 2048) {
      survivor.makeKing();
      this.particles.mergeBurst(mergeX, mergeY, this.factionColor(survivor.faction));
      this.floatingText.show(mergeX, mergeY, '👑 KING!', '#ffd700', 28, 1000);
    }

    this.particles.mergeBurst(mergeX, mergeY, this.factionColor(survivor.faction));
    this.floatingText.showMerge(mergeX, mergeY - 20);

    const points = this.scoring.addMerge(newAbsVal);
    this.floatingText.showScore(mergeX, mergeY - 40, points);

    if (this.onFusion) this.onFusion(newValue, survivor.faction, survivor);
    if (other.frozen && this.onBallDestroyed) this.onBallDestroyed(true);
  }

  private handleZeroSum(ballA: BallEntity, ballB: BallEntity): void {
    const absVal = ballA.absValue;
    const midX = (this.getEntityX(ballA) + this.getEntityX(ballB)) / 2;
    const midY = (this.getEntityY(ballA) + this.getEntityY(ballB)) / 2;

    const aFrozen = ballA.frozen;
    const bFrozen = ballB.frozen;

    // Destroy both
    ballA.deactivate();
    ballB.deactivate();
    this.releaseBall(ballA);
    this.releaseBall(ballB);

    this.particles.zeroSumExplosion(midX, midY, POSITIVE_COLOR, NEGATIVE_COLOR);
    this.floatingText.showZeroSum(midX, midY - 20);

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

    if (this.onBallDestroyed) {
      if (aFrozen) this.onBallDestroyed(true);
      if (bFrozen) this.onBallDestroyed(true);
    }
    if (this.onZeroSum) this.onZeroSum(absVal);
  }

  private handleShrink(ballA: BallEntity, ballB: BallEntity): void {
    if (!ballA.active || !ballB.active || !ballA.body || !ballB.body) return;

    let bigger: BallEntity, smaller: BallEntity;
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
    const pinSpawns = ballA.frozen || ballB.frozen;
    const spawnX = bigger.frozen ? bigger.anchorX : midX;
    const spawnY = bigger.frozen ? bigger.anchorY : midY;
    const aFrozen = ballA.frozen;
    const bFrozen = ballB.frozen;
    const spawnFaction = bigger.faction;

    // Destroy both balls (Splitting mechanic)
    smaller.deactivate();
    this.releaseBall(smaller);

    bigger.deactivate();
    this.releaseBall(bigger);

    const newAbsVal = bigger.absValue - smallAbsVal;
    const spawnAbsValues: number[] = [];

    if (bigger.absValue === 16 && smallAbsVal === 4) {
      for (let i = 0; i < 3; i++) spawnAbsValues.push(4);
    } else if (newAbsVal > 0) {
      let tempVal = newAbsVal;
      let power = 2;
      while (tempVal > 0) {
        if ((tempVal & power) === power) {
          spawnAbsValues.push(power);
          tempVal -= power;
        }
        power *= 2;
      }
    }

    const placedSpawns: { x: number; y: number; radius: number }[] = [];
    let spawnCount = 0;

    spawnAbsValues.sort((a, b) => b - a);

    const pinnedObstacles = pinSpawns ? this.buildObstacleList(placedSpawns) : null;

    for (const absVal of spawnAbsValues) {
      const pos = pinSpawns
        ? this.findPinnedSpawnPosition(spawnX, spawnY, absVal, pinnedObstacles!, placedSpawns)
        : {
            x: spawnX + (Math.random() - 0.5) * 20,
            y: spawnY + (Math.random() - 0.5) * 20,
          };

      if (pinSpawns) {
        const pinned = this.ballPool.acquire();
        if (!pinned) continue;
        pinned.activate(pos.x, pos.y, absVal * bigSign, null, true, true, spawnFaction);
        if (absVal >= 2048) pinned.makeKing();
        placedSpawns.push({ x: pos.x, y: pos.y, radius: pinned.radius });
      } else {
        const newBall = this.ballPool.acquire();
        if (!newBall) continue;
        newBall.activate(pos.x, pos.y, absVal * bigSign, null, false, false, spawnFaction);
        if (absVal >= 2048) newBall.makeKing();
        if (newBall.body) {
          const vx = (Math.random() - 0.5) * 4;
          const vy = -1 - Math.random() * 2;
          this.scene.matter.body.setVelocity(newBall.body, { x: vx, y: vy });
        }
        placedSpawns.push({ x: pos.x, y: pos.y, radius: newBall.radius });
      }
      spawnCount++;
    }

    if (spawnCount > 0) {
      const bigColor = this.factionColor(spawnFaction);
      this.particles.burst(midX, midY, bigColor, Math.min(spawnCount * 4, 12), 2, 320);
    } else {
      this.particles.zeroSumExplosion(midX, midY, POSITIVE_COLOR, NEGATIVE_COLOR);
    }

    const color = this.factionColor(smaller.faction);
    this.particles.shrinkPoof(midX, midY, color);

    const points = this.scoring.addShrink(smallAbsVal);
    this.floatingText.showScore(midX, midY - 20, points);

    if (this.onSplit) this.onSplit();
    if (this.onBallDestroyed) {
      if (ballA.frozen) this.onBallDestroyed(true);
      if (ballB.frozen) this.onBallDestroyed(true);
    }
  }

  /** Build obstacle snapshot once per shrink — avoids rescanning the pool per spawn. */
  private buildObstacleList(
    alreadyPlaced: { x: number; y: number; radius: number }[]
  ): { x: number; y: number; radius: number }[] {
    const obstacles = [...alreadyPlaced];
    this.forEachActiveBall((ball) => {
      obstacles.push({
        x: ball.frozen ? ball.anchorX : ball.body!.position.x,
        y: ball.frozen ? ball.anchorY : ball.body!.position.y,
        radius: ball.radius,
      });
    });
    return obstacles;
  }

  /** Find a non-overlapping position for a pinned (frozen) split spawn. */
  private findPinnedSpawnPosition(
    originX: number,
    originY: number,
    absValue: number,
    obstacles: { x: number; y: number; radius: number }[],
    alreadyPlaced: { x: number; y: number; radius: number }[]
  ): { x: number; y: number } {
    const scene = this.scene as any;
    const bounds = {
      left: (scene.containerLeft ?? CONTAINER_LEFT) + 4,
      right: (scene.containerRight ?? CONTAINER_RIGHT) - 4,
      top: CONTAINER_TOP + 36,
      bottom: (scene.containerBottom ?? CONTAINER_BOTTOM) - 8,
    };

    const radius = getBallRadius(absValue);
    const gap = 10;

    const fits = (x: number, y: number): boolean => {
      if (x - radius < bounds.left || x + radius > bounds.right) return false;
      if (y - radius < bounds.top || y + radius > bounds.bottom) return false;
      for (let o = 0; o < obstacles.length; o++) {
        const obs = obstacles[o];
        const dx = x - obs.x;
        const dy = y - obs.y;
        const minDist = radius + obs.radius + gap;
        if (dx * dx + dy * dy < minDist * minDist) return false;
      }
      for (let p = 0; p < alreadyPlaced.length; p++) {
        const obs = alreadyPlaced[p];
        const dx = x - obs.x;
        const dy = y - obs.y;
        const minDist = radius + obs.radius + gap;
        if (dx * dx + dy * dy < minDist * minDist) return false;
      }
      return true;
    };

    if (fits(originX, originY)) return { x: originX, y: originY };

    for (let ring = 1; ring <= 8; ring++) {
      const dist = radius * 2 + gap + (ring - 1) * 32;
      const steps = 8 + ring * 2;
      for (let i = 0; i < steps; i++) {
        const angle = (i / steps) * Math.PI * 2 + ring * 0.35;
        const x = originX + Math.cos(angle) * dist;
        const y = originY + Math.sin(angle) * dist;
        if (fits(x, y)) return { x, y };
      }
    }

    for (let row = 0; row < 6; row++) {
      const dy = (row + 1) * (radius * 2 + gap);
      for (const sign of [-1, 1]) {
        const y = originY + sign * dy;
        for (const dx of [0, radius + gap, -(radius + gap), (radius + gap) * 2, -(radius + gap) * 2]) {
          const x = originX + dx;
          if (fits(x, y)) return { x, y };
        }
      }
    }

    return { x: originX, y: originY - radius * 2 - gap * 2 };
  }

  private handleSpecialCollision(ballA: BallEntity, ballB: BallEntity): void {
    let special: JellyBall;
    let target: BallEntity;

    if (ballA.special) {
      special = ballA as JellyBall;
      target = ballB;
    } else {
      special = ballB as JellyBall;
      target = ballA;
    }

    // Don't process special vs special
    if (target.special) return;

    // Specials cannot affect anchored blocks — deflect and consume the special
    if (target.frozen) {
      const hitX = special.body!.position.x;
      const hitY = special.body!.position.y;
      this.particles.burst(hitX, hitY, 0x4488ff, 10, 2.5, 350);
      this.floatingText.show(hitX, hitY - 28, 'BLOCKED!', '#4488ff', 18, 700);
      target.playSquash();
      special.deactivate();
      this.ballPool.release(special);
      return;
    }

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

      if (this.onFusion) this.onFusion(newValue, target.faction, target);
    } else if (special.special === 'divide') {
      // ÷2: split target into two smaller balls
      const halfAbsVal = target.absValue / 2;
      if (halfAbsVal >= 2) {
        const halfValue = halfAbsVal * target.sign;
        target.setValue(halfValue);

        // Spawn second ball from pool
        const newBall = this.ballPool.acquire();
        if (newBall) {
          newBall.activate(x + 20, y - 10, halfValue, null, false, false, target.faction);
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
      this.ballPool.forEachActive((ball) => {
        if (!ball.active || ball === special || !ball.body || ball.frozen) return;
        const bx = ball.body.position.x;
        const by = ball.body.position.y;
        const dist = Phaser.Math.Distance.Between(hitX, hitY, bx, by);
        if (dist <= explosionRadius) {
          const color = FACTION_COLORS[ball.faction];
          this.particles.burst(bx, by, color, 12, 2.0, 350);
          ball.deactivate();
          this.ballPool.release(ball);
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
      this.releaseBall(target);
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
          childBall.activate(hitX + offsetX, hitY, childValue, null, false, false, target.faction);

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
}
