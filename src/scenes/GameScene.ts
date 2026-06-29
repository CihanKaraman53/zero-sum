import Phaser from 'phaser';

import { ObjectPool } from '../core/ObjectPool';
import { JellyBall } from '../entities/JellyBall';
import { Launcher } from '../entities/Launcher';

import { Background } from '../effects/Background';
import { ParticleManager } from '../effects/ParticleManager';
import { FloatingText } from '../effects/FloatingText';

import { ScoringSystem } from '../systems/ScoringSystem';
import { ComboSystem } from '../systems/ComboSystem';
import { CollisionSystem } from '../systems/CollisionSystem';
import { BlackHoleSystem } from '../systems/BlackHoleSystem';
import { LevelManager } from '../systems/LevelManager';

import { HUD } from '../ui/HUD';
import { CureLevel1UI } from '../ui/CureLevel1UI';

import {
  FIXED_TIMESTEP,
  GAME_WIDTH, GAME_HEIGHT,
  CAT_WALL, CAT_BALL, WALL_RESTITUTION, WALL_FRICTION,
  CURE_L1_PADDING, CURE_L1_PLAY_WIDTH, CURE_L1_CONTAINER_TOP,
  CURE_L1_QUEST_REQUIRED, CURE_L1_QUEST_TARGET,
} from '../core/Constants';
import { gamePools } from '../core/GamePools';
import { devWarn } from '../core/Production';

export class GameScene extends Phaser.Scene {
  private background!: Background;
  private ballPool!: ObjectPool<JellyBall>;
  private launcher!: Launcher;

  private particles!: ParticleManager;
  private floatingText!: FloatingText;

  private scoring!: ScoringSystem;
  private combo!: ComboSystem;
  private collisionSys!: CollisionSystem;
  private blackHoleSys!: BlackHoleSystem;
  private levelManager!: LevelManager;

  private hud!: HUD;
  private cureUI!: CureLevel1UI;

  private isGameOver = false;
  private isVictoryPending = false;
  private fixedAccumulator = 0;
  private plusEightCount = 0;

  private readonly spawnQueue: { x: number; y: number }[] = [];
  private lastPointerX = GAME_WIDTH / 2;
  private hasPointerX = false;

  public containerLeft = CURE_L1_PADDING;
  public containerRight = CURE_L1_PLAY_WIDTH - CURE_L1_PADDING;
  public containerBottom = GAME_HEIGHT - 20;
  public containerTop = CURE_L1_CONTAINER_TOP;

  private leftWall!: MatterJS.BodyType;
  private rightWall!: MatterJS.BodyType;
  private bottomWall!: MatterJS.BodyType;

  private readonly onPointerDown = (pointer: Phaser.Input.Pointer): void => {
    if (pointer.x > CURE_L1_PLAY_WIDTH) return;
    this.spawnQueue.push({ x: pointer.x, y: pointer.y });
  };

  private readonly onPointerMove = (pointer: Phaser.Input.Pointer): void => {
    this.lastPointerX = pointer.x;
    this.hasPointerX = true;
  };

  constructor() {
    super('GameScene');
  }

  create() {
    this.isGameOver = false;
    this.isVictoryPending = false;
    this.fixedAccumulator = 0;
    this.plusEightCount = 0;

    this.input.off('pointerdown', this.onPointerDown);
    this.input.off('pointermove', this.onPointerMove);
    this.spawnQueue.length = 0;
    this.hasPointerX = false;

    this.matter.world.resume();

    this.background = new Background(this);
    this.particles = new ParticleManager(this);
    this.floatingText = new FloatingText(this);

    const pools = gamePools.ensure(this);
    this.ballPool = pools.ball;

    this.scoring = new ScoringSystem(this);
    this.levelManager = new LevelManager(this.scoring);
    this.combo = new ComboSystem(this, () => this.blackHoleSys.trigger());

    this.containerLeft = CURE_L1_PADDING;
    this.containerRight = CURE_L1_PLAY_WIDTH - CURE_L1_PADDING;
    this.containerTop = CURE_L1_CONTAINER_TOP;
    this.containerBottom = GAME_HEIGHT - 20;

    this.launcher = new Launcher(this);
    this.launcher.setSpeed(0);
    this.launcher.x = CURE_L1_PLAY_WIDTH / 2;
    this.launcher.container.setX(this.launcher.x);
    this.launcher.setPreview(
      this.levelManager.getQueue()[0].value,
      this.levelManager.getQueue()[0].special,
      this.levelManager.getQueue()[0].faction,
    );
    this.launcher.updateBounds(this.containerLeft + 24, this.containerRight - 24);

    this.collisionSys = new CollisionSystem(
      this, this.ballPool, this.particles, this.floatingText, this.scoring, this.combo,
    );
    this.blackHoleSys = new BlackHoleSystem(this, this.ballPool, this.particles, this.scoring);

    this.collisionSys.onFusion = (value: number, faction: 'green' | 'red', source) => {
      if (
        value === CURE_L1_QUEST_TARGET &&
        faction === 'green' &&
        !this.isVictoryPending &&
        source instanceof JellyBall &&
        source.active
      ) {
        this.cureUI.harvestFromBall(source, () => {
          this.ballPool.release(source);
          this.plusEightCount = this.cureUI.getCollected();
          if (this.plusEightCount >= CURE_L1_QUEST_REQUIRED) {
            this.isVictoryPending = true;
            this.time.delayedCall(1200, () => this.handleVictory());
          }
        });
      }
    };

    this.setupWalls();

    this.background.setCureMinimal(true);

    this.hud = new HUD(this, this.scoring, this.levelManager);
    this.cureUI = new CureLevel1UI(this, this.particles);

    this.launcher.container.setDepth(30);
    this.launcher.setCureMinimal(true);

    this.syncDropPreviews();

    this.input.on('pointerdown', this.onPointerDown);
    this.input.on('pointermove', this.onPointerMove);

    this.hud.update();
  }

  update(time: number, delta: number) {
    if (this.isGameOver) return;

    this.processSpawnQueue(time);

    this.fixedAccumulator += delta;
    if (this.fixedAccumulator >= FIXED_TIMESTEP) {
      if (!this.isVictoryPending) {
        this.launcher.update(time, this.getPointerX());
      }
      this.particles.update(FIXED_TIMESTEP);
      this.combo.update(time);
      this.blackHoleSys.update(FIXED_TIMESTEP);
      this.fixedAccumulator -= FIXED_TIMESTEP;
    }
    if (this.fixedAccumulator > FIXED_TIMESTEP * 2) {
      this.fixedAccumulator = 0;
    }

    this.background.update(time);

    this.ballPool.forEachActive((ball) => {
      if (ball.active && !ball.frozen) ball.syncPosition();
    });
  }

  private processSpawnQueue(time: number): void {
    if (this.spawnQueue.length === 0 || this.isVictoryPending) return;
    const next = this.spawnQueue.shift()!;
    this.applySpawnAim(next.x);
    this.executeDrop(time, next.x);
  }

  private applySpawnAim(pointerX: number): void {
    this.launcher.isPlayerControlled = true;
    this.launcher.x = Phaser.Math.Clamp(
      pointerX,
      this.containerLeft + 24,
      this.containerRight - 24,
    );
  }

  private getPointerX(): number | null {
    if (!this.hasPointerX || this.isVictoryPending) return null;
    this.launcher.isPlayerControlled = true;
    return this.lastPointerX;
  }

  private executeDrop(time: number, spawnX?: number): void {
    if (this.isGameOver || this.isVictoryPending) return;
    if (spawnX !== undefined && spawnX > CURE_L1_PLAY_WIDTH) return;

    if (this.launcher.tryDrop(time)) {
      const dropItem = this.levelManager.consumeNextDrop();
      const dropX = spawnX ?? this.launcher.getX();
      const dropY = this.launcher.getDropY();
      const spawnRadius = 18;
      const clampedX = Phaser.Math.Clamp(
        dropX,
        this.containerLeft + spawnRadius + 2,
        this.containerRight - spawnRadius - 2,
      );

      const ball = this.ballPool.acquire();
      if (ball) {
        ball.activate(
          clampedX, dropY,
          dropItem.value, dropItem.special, false, false,
          dropItem.faction,
        );
      }

      const nextInQueue = this.levelManager.getQueue()[0];
      this.launcher.setPreview(nextInQueue.value, nextInQueue.special, nextInQueue.faction);
      this.syncDropPreviews();
    }
  }

  private syncDropPreviews(): void {
    this.cureUI.updateUpcomingQueue(this.levelManager.getQueue());
  }

  private setupWalls(): void {
    const wallOpts = {
      isStatic: true,
      restitution: WALL_RESTITUTION,
      friction: WALL_FRICTION,
      collisionFilter: { category: CAT_WALL, mask: CAT_BALL | CAT_WALL },
    };

    this.bottomWall = this.matter.add.rectangle(
      CURE_L1_PLAY_WIDTH / 2,
      this.containerBottom + 50,
      CURE_L1_PLAY_WIDTH * 2,
      100,
      wallOpts,
    ) as MatterJS.BodyType;

    this.leftWall = this.matter.add.rectangle(
      this.containerLeft - 50, GAME_HEIGHT / 2, 100, GAME_HEIGHT, wallOpts,
    ) as MatterJS.BodyType;

    this.rightWall = this.matter.add.rectangle(
      this.containerRight + 50, GAME_HEIGHT / 2, 100, GAME_HEIGHT, wallOpts,
    ) as MatterJS.BodyType;
  }

  private handleVictory(): void {
    if (this.isGameOver) return;
    this.isGameOver = true;
    this.levelManager.markWon();
    this.launcher.isPlayerControlled = false;
    this.playVictorySound();
    this.matter.world.pause();

    this.time.delayedCall(1200, () => {
      this.particles.destroy();
      this.floatingText.destroy();
      this.collisionSys.destroy();
      this.scene.start('GameOverScene', {
        score: this.scoring.score,
        highScore: this.scoring.highScore,
        won: true,
      });
    });
  }

  private playVictorySound(): void {
    try {
      const ctx = (this.sound as Phaser.Sound.WebAudioSoundManager & { context?: AudioContext }).context
        ?? new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const now = ctx.currentTime;

      const playTone = (freq: number, start: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.15, start);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
        osc.start(start);
        osc.stop(start + duration);
      };

      playTone(523.25, now, 0.15);
      playTone(659.25, now + 0.1, 0.15);
      playTone(783.99, now + 0.2, 0.15);
      playTone(1046.50, now + 0.3, 0.4);
    } catch (e) {
      devWarn('AudioContext error/blocked:', e);
    }
  }
}
