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
import { CureTimerBar } from '../ui/CureTimerBar';
import { CureMoveBar } from '../ui/CureMoveBar';

import {
  FIXED_TIMESTEP,
  GAME_WIDTH, GAME_HEIGHT,
  CAT_WALL, CAT_BALL, WALL_RESTITUTION, WALL_FRICTION,
  CURE_L1_PADDING, CURE_L1_CONTAINER_TOP,
  getCureUILayout,
  getBallRadius,
  DROP_COOLDOWN,
  CURE_L1_UI_TOP,
} from '../core/Constants';
import { getNextLevelId } from '../data/levels';
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
  private timerBar: CureTimerBar | null = null;
  private moveBar: CureMoveBar | null = null;
  private timeRemainingMs = 0;
  private moveLimit = 0;
  private movesUsed = 0;
  private questHarvestCooldown = 0;

  private readonly QUEST_HARVEST_SCAN_MS = 100;

  private isGameOver = false;
  private isVictoryPending = false;
  private fixedAccumulator = 0;
  private startLevelId = 1;
  private carryScore = false;
  private uiLayout = getCureUILayout();

  private readonly spawnQueue: { x: number; y: number }[] = [];
  private lastDropInputTime = 0;
  private lastPointerX = GAME_WIDTH / 2;
  private hasPointerX = false;

  public containerLeft = CURE_L1_PADDING;
  public containerRight = CURE_L1_PADDING;
  public containerBottom = GAME_HEIGHT - 20;
  public containerTop = CURE_L1_CONTAINER_TOP;

  private leftWall!: MatterJS.BodyType;
  private rightWall!: MatterJS.BodyType;
  private bottomWall!: MatterJS.BodyType;
  private questWall!: MatterJS.BodyType;

  private readonly onPointerDown = (pointer: Phaser.Input.Pointer): void => {
    if (pointer.x > this.uiLayout.arenaRight) return;
    if (this.moveBar && this.movesUsed >= this.moveLimit) return;

    const now = this.time.now;
    const tap = { x: pointer.x, y: pointer.y };

    // Kuyrukta bekleyen atış varsa sadece nişanı güncelle (spam → tek top)
    if (this.spawnQueue.length > 0) {
      this.spawnQueue[0] = tap;
      return;
    }

    // Cooldown bitmeden yeni tıklama yok say — basılı tutma / click spam
    if (now - this.lastDropInputTime < DROP_COOLDOWN) return;

    this.lastDropInputTime = now;
    this.spawnQueue.push(tap);
  };

  private readonly onPointerMove = (pointer: Phaser.Input.Pointer): void => {
    this.lastPointerX = pointer.x;
    this.hasPointerX = true;
  };

  constructor() {
    super('GameScene');
  }

  private onShutdown(): void {
    this.input.off('pointerdown', this.onPointerDown);
    this.input.off('pointermove', this.onPointerMove);
    this.collisionSys?.destroy();
    this.particles?.destroy();
    this.floatingText?.destroy();
    this.timerBar?.destroy();
    this.timerBar = null;
    this.moveBar?.destroy();
    this.moveBar = null;
  }

  init(data?: { levelId?: number; carryScore?: boolean }): void {
    this.startLevelId = data?.levelId ?? 1;
    this.carryScore = !!data?.carryScore;
  }

  create() {
    this.events.once('shutdown', this.onShutdown, this);
    this.isGameOver = false;
    this.isVictoryPending = false;
    this.fixedAccumulator = 0;
    this.questHarvestCooldown = 0;

    this.input.off('pointerdown', this.onPointerDown);
    this.input.off('pointermove', this.onPointerMove);
    this.spawnQueue.length = 0;
    this.lastDropInputTime = 0;
    this.hasPointerX = false;

    this.matter.world.resume();

    this.background = new Background(this);
    this.particles = new ParticleManager(this);
    this.floatingText = new FloatingText(this);

    const pools = gamePools.ensure(this);
    this.ballPool = pools.ball;

    this.scoring = new ScoringSystem(this);
    this.levelManager = new LevelManager(this.scoring, this.startLevelId, !this.carryScore);
    // Cure modunda kara delik combo yok — tahtadaki +16 kurulumunu yutmamalı.
    this.combo = new ComboSystem(this);

    this.uiLayout = getCureUILayout(this.levelManager.currentLevel.layout);
    this.containerLeft = this.uiLayout.arenaLeft;
    this.containerRight = this.uiLayout.arenaRight;
    this.containerTop = CURE_L1_CONTAINER_TOP;
    this.containerBottom = GAME_HEIGHT - 20;

    this.launcher = new Launcher(this);
    this.launcher.setSpeed(0);
    this.launcher.x = this.uiLayout.arenaCenterX;
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
    this.blackHoleSys.forceHide();

    this.setupWalls();

    this.background.setCureMinimal(true);
    this.background.setCureAtmosphere(true);
    this.background.updateContainerBounds(
      this.containerLeft,
      this.containerRight,
      this.containerBottom,
      this.containerTop,
    );

    this.hud = new HUD(this, this.scoring, this.levelManager);
    this.cureUI = new CureLevel1UI(
      this,
      this.levelManager.getQuests(),
      this.levelManager.currentLevel.layout,
      this.levelManager.currentLevel.dualBottles ?? false,
      this.particles,
      this.levelManager,
      () => this.syncBoardQuestBalls(),
    );

    this.collisionSys.isQuestProtected = (value) => this.levelManager.isHarvestValue(value);
    this.collisionSys.onFusion = (value: number, faction: 'green' | 'red', source) => {
      this.onQuestValueFormed(value, faction, source);
    };
    this.collisionSys.onSplit = () => { this.questHarvestCooldown = 0; };
    this.collisionSys.onZeroSum = () => { this.questHarvestCooldown = 0; };

    this.launcher.container.setDepth(30);
    this.launcher.setCureMinimal(true);

    this.syncDropPreviews();

    this.input.on('pointerdown', this.onPointerDown);
    this.input.on('pointermove', this.onPointerMove);

    this.hud.update();

    const timeLimit = this.levelManager.currentLevel.timeLimitSec;
    const moveLimit = this.levelManager.currentLevel.moveLimit;
    if (timeLimit && timeLimit > 0) {
      this.timeRemainingMs = timeLimit * 1000;
      this.timerBar = new CureTimerBar(
        this,
        timeLimit,
        this.uiLayout.questCenterX,
        CURE_L1_UI_TOP + 12,
        this.uiLayout.questWidth - 24,
      );
      this.moveLimit = 0;
      this.movesUsed = 0;
      this.moveBar = null;
    } else if (moveLimit && moveLimit > 0) {
      this.timeRemainingMs = 0;
      this.timerBar = null;
      this.moveLimit = moveLimit;
      this.movesUsed = 0;
      this.moveBar = new CureMoveBar(
        this,
        moveLimit,
        this.uiLayout.arenaCenterX,
        this.containerBottom,
        this.uiLayout.arenaWidth - 24,
      );
    } else {
      this.timeRemainingMs = 0;
      this.moveLimit = 0;
      this.movesUsed = 0;
      this.timerBar = null;
      this.moveBar = null;
    }
  }

  update(time: number, delta: number) {
    if (this.isGameOver) return;

    this.tickTimer(delta);
    this.tickQuestHarvestScan(delta);
    this.processSpawnQueue(time);

    this.fixedAccumulator += delta;
    if (this.fixedAccumulator >= FIXED_TIMESTEP) {
      if (!this.isVictoryPending) {
        this.launcher.update(time, this.getPointerX());
      }
      this.particles.update(FIXED_TIMESTEP);
      this.combo.update(time);
      this.fixedAccumulator -= FIXED_TIMESTEP;
    }
    if (this.fixedAccumulator > FIXED_TIMESTEP * 2) {
      this.fixedAccumulator = 0;
    }

    this.background.update(time);

    const list = this.ballPool.getActiveList();
    const count = this.ballPool.getActiveCount();
    for (let i = 0; i < count; i++) {
      list[i].syncPosition();
    }
  }

  private tickQuestHarvestScan(delta: number): void {
    if (this.isVictoryPending || this.isGameOver || this.cureUI.isHarvesting()) return;
    this.questHarvestCooldown -= delta;
    if (this.questHarvestCooldown > 0) return;
    this.questHarvestCooldown = this.QUEST_HARVEST_SCAN_MS;
    this.syncBoardQuestBalls();
  }

  /** Birleşme / shrink sonrası — tüm bölümlerde aynı hasat yolu. */
  private onQuestValueFormed(
    value: number,
    faction: 'green' | 'red',
    source: unknown,
  ): void {
    if (this.isVictoryPending || this.isGameOver || faction !== 'green') return;
    if (
      this.levelManager.isHarvestValue(value) &&
      source instanceof JellyBall &&
      source.active &&
      !source.harvesting
    ) {
      this.cureUI.harvestFromBall(source, () => {
        this.ballPool.release(source);
        this.onQuestHarvestComplete();
      });
      return;
    }
    this.syncBoardQuestBalls();
  }

  private syncBoardQuestBalls(): void {
    this.cureUI.harvestMatchingBoardBalls(this.ballPool, (ball) => {
      this.ballPool.release(ball);
      this.onQuestHarvestComplete();
    });
  }

  private onQuestHarvestComplete(): void {
    if (this.cureUI.areAllQuestsComplete() && !this.isVictoryPending && !this.isGameOver) {
      this.isVictoryPending = true;
      this.time.delayedCall(1200, () => this.handleVictory());
    }
  }

  private tickTimer(delta: number): void {
    if (this.timeRemainingMs <= 0 || this.isVictoryPending || !this.timerBar) return;
    this.timeRemainingMs = Math.max(0, this.timeRemainingMs - delta);
    this.timerBar.setRemaining(this.timeRemainingMs / 1000);
    if (this.timeRemainingMs <= 0) this.handleTimeUp();
  }

  private handleTimeUp(): void {
    if (this.isGameOver || this.isVictoryPending) return;
    this.isGameOver = true;
    this.launcher.isPlayerControlled = false;
    this.matter.world.pause();

    const score = this.scoring.score;
    const highScore = this.scoring.highScore;

    this.time.delayedCall(800, () => {
      this.particles.destroy();
      this.floatingText.destroy();
      this.collisionSys.destroy();

      this.scene.start('GameOverScene', {
        score,
        highScore,
        won: false,
      });
    });
  }

  private processSpawnQueue(time: number): void {
    if (this.spawnQueue.length === 0 || this.isVictoryPending) return;
    if (this.moveBar && this.movesUsed >= this.moveLimit) return;
    const next = this.spawnQueue[0];
    this.applySpawnAim(next.x);
    if (this.executeDrop(time, next.x)) {
      this.spawnQueue.shift();
      this.lastDropInputTime = time;
    }
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

  private executeDrop(time: number, spawnX?: number): boolean {
    if (this.isGameOver || this.isVictoryPending) return false;
    if (spawnX !== undefined && spawnX > this.uiLayout.arenaRight) return false;

    if (this.launcher.tryDrop(time)) {
      const dropItem = this.levelManager.consumeNextDrop();
      const dropX = spawnX ?? this.launcher.getX();
      const dropY = this.launcher.getDropY();
      const spawnRadius = getBallRadius(Math.abs(dropItem.value));
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
      this.consumeMove();
      this.time.delayedCall(80, () => this.syncBoardQuestBalls());
      return true;
    }
    return false;
  }

  private consumeMove(): void {
    if (!this.moveBar || this.moveLimit <= 0) return;
    if (this.movesUsed >= this.moveLimit) return;
    this.movesUsed++;
    this.moveBar.setUsed(this.movesUsed);
    if (this.movesUsed >= this.moveLimit && !this.isVictoryPending) {
      this.time.delayedCall(400, () => {
        if (!this.isVictoryPending && !this.isGameOver) this.handleMovesUp();
      });
    }
  }

  private handleMovesUp(): void {
    if (this.isGameOver || this.isVictoryPending) return;
    this.isGameOver = true;
    this.launcher.isPlayerControlled = false;
    this.matter.world.pause();

    const score = this.scoring.score;
    const highScore = this.scoring.highScore;

    this.time.delayedCall(800, () => {
      this.particles.destroy();
      this.floatingText.destroy();
      this.collisionSys.destroy();

      this.scene.start('GameOverScene', {
        score,
        highScore,
        won: false,
      });
    });
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
      this.uiLayout.arenaCenterX,
      this.containerBottom + 50,
      this.uiLayout.arenaWidth * 2,
      100,
      wallOpts,
    ) as MatterJS.BodyType;

    this.leftWall = this.matter.add.rectangle(
      this.containerLeft - 50, GAME_HEIGHT / 2, 100, GAME_HEIGHT, wallOpts,
    ) as MatterJS.BodyType;

    this.rightWall = this.matter.add.rectangle(
      this.containerRight + 50, GAME_HEIGHT / 2, 100, GAME_HEIGHT, wallOpts,
    ) as MatterJS.BodyType;

    this.questWall = this.matter.add.rectangle(
      this.uiLayout.questRight + 50,
      GAME_HEIGHT / 2,
      100,
      GAME_HEIGHT,
      wallOpts,
    ) as MatterJS.BodyType;
  }

  private handleVictory(): void {
    if (this.isGameOver) return;
    this.isGameOver = true;
    this.levelManager.markWon();
    this.launcher.isPlayerControlled = false;
    this.playVictorySound();
    this.matter.world.pause();

    const nextLevelId = getNextLevelId(this.levelManager.currentLevel.id);
    const score = this.scoring.score;
    const highScore = this.scoring.highScore;

    this.time.delayedCall(1200, () => {
      this.particles.destroy();
      this.floatingText.destroy();
      this.collisionSys.destroy();

      if (nextLevelId !== null) {
        this.scene.start('GameScene', { levelId: nextLevelId, carryScore: true });
        return;
      }

      this.scene.start('GameOverScene', {
        score,
        highScore,
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
