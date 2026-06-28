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
import { OverflowSystem } from '../systems/OverflowSystem';
import { LevelManager } from '../systems/LevelManager';
import { InvertedBucketSystem } from '../systems/InvertedBucketSystem';
import { GeyserSystem } from '../systems/GeyserSystem';

import { HUD } from '../ui/HUD';
import { NextQueue } from '../ui/NextQueue';

import { 
  CONTAINER_LEFT, CONTAINER_RIGHT, 
  CONTAINER_BOTTOM, CONTAINER_TOP, FIXED_TIMESTEP,
  GAME_WIDTH, GAME_HEIGHT, OVERFLOW_Y, GRAVITY_Y, getBallRadius,
  CAT_WALL, CAT_BALL, WALL_RESTITUTION, WALL_FRICTION,
} from '../core/Constants';
import { gamePools } from '../core/GamePools';
import { devWarn } from '../core/Production';
import { LEVEL_CONTAINER_BOTTOMS, LEVEL_CONTAINER_HALF_WIDTHS } from '../data/levels';

export class GameScene extends Phaser.Scene {
  // Entites & Object Pools
  private background!: Background;
  private ballPool!: ObjectPool<JellyBall>;
  private launcher!: Launcher;

  // Effects
  private particles!: ParticleManager;
  private floatingText!: FloatingText;

  // Systems
  private scoring!: ScoringSystem;
  private combo!: ComboSystem;
  private collisionSys!: CollisionSystem;
  private blackHoleSys!: BlackHoleSystem;
  private overflowSys!: OverflowSystem;
  private levelManager!: LevelManager;
  private invertedBucketSys?: InvertedBucketSystem;
  private geyserSys!: GeyserSystem;

  // UI
  private hud!: HUD;
  private nextQueue!: NextQueue;

  // State
  private isGameOver: boolean = false;
  private isLevelTransitioning: boolean = false;
  private fixedAccumulator: number = 0;
  public dynamicOverflowY: number = OVERFLOW_Y;
  private ceilingTimer: number = 15000;
  private pressureText?: Phaser.GameObjects.Text;
  private shrinkFxTimer?: Phaser.Time.TimerEvent;
  private survivalFailPending: boolean = false;
  private invertedOverflowTimer: number = 0;

  // Spawn queue — pointerdown only enqueues; update() drains one request per frame
  private readonly spawnQueue: { x: number; y: number }[] = [];
  private lastPointerX = GAME_WIDTH / 2;
  private hasPointerX = false;
  private hudGoalDirty = false;

  private readonly onPointerDown = (pointer: Phaser.Input.Pointer): void => {
    this.spawnQueue.push({ x: pointer.x, y: pointer.y });
  };

  private readonly onPointerMove = (pointer: Phaser.Input.Pointer): void => {
    this.lastPointerX = pointer.x;
    this.hasPointerX = true;
  };

  private readonly onGeyserBeforeUpdate = (): void => {
    if (!this.levelManager?.isSpectralMazeLevel() || this.isLevelTransitioning || this.isGameOver) return;
    this.geyserSys.tick(FIXED_TIMESTEP);
    this.geyserSys.applyForces();
  };

  // Tutorial State
  private tutorialStep: number = 1;
  private tutorial2Step: number = 1;
  private tutorialText?: Phaser.GameObjects.Text;
  private tutorialArrow?: Phaser.GameObjects.Graphics;

  // Dynamic Sizing State
  public containerLeft: number = CONTAINER_LEFT;
  public containerRight: number = CONTAINER_RIGHT;
  public containerBottom: number = CONTAINER_BOTTOM;
  public containerTop: number = CONTAINER_TOP;
  private leftWall!: any;
  private rightWall!: any;
  private bottomWall!: any;

  constructor() {
    super('GameScene');
  }

  create(data?: { levelIndex?: number; fromLevelSelect?: boolean }) {
    this.isGameOver = false;
    this.isLevelTransitioning = false;
    this.fixedAccumulator = 0;
    this.dynamicOverflowY = OVERFLOW_Y;
    this.ceilingTimer = 15000;
    this.survivalFailPending = false;
    this.invertedOverflowTimer = 0;
    this.invertedBucketSys?.destroy();
    this.invertedBucketSys = undefined;
    this.geyserSys?.destroy();
    this.matter.world.off('beforeupdate', this.onGeyserBeforeUpdate);

    this.input.off('pointerdown', this.onPointerDown);
    this.input.off('pointermove', this.onPointerMove);
    this.spawnQueue.length = 0;
    this.hudGoalDirty = false;
    this.hasPointerX = false;

    this.matter.world.resume();

    if (this.pressureText) {
      this.pressureText.destroy();
      this.pressureText = undefined;
    }

    // 1. Initialize Effects (Rendered behind or above physics depending on depth)
    this.background = new Background(this);
    this.particles = new ParticleManager(this);
    this.floatingText = new FloatingText(this);

    // 2. Session-scoped pools — pre-allocated once, never mid-game factory()
    const pools = gamePools.ensure(this);
    this.ballPool = pools.ball;

    // 3. Initialize Core Systems
    this.scoring = new ScoringSystem(this);
    this.levelManager = new LevelManager(this.scoring);
    this.levelManager.getActiveBallValues = () => {
      const vals: number[] = [];
      this.ballPool.forEachActive((b) => vals.push(b.value));
      return vals;
    };
    this.levelManager.getActiveBallCount = () => this.ballPool.getActiveCount();
    this.combo = new ComboSystem(this, () => {
      this.blackHoleSys.trigger();
    });

    const fromLevelSelect = !!(data && data.fromLevelSelect);
    if (data && typeof data.levelIndex === 'number') {
      this.levelManager.loadLevel(data.levelIndex);
    }

    // Dynamic Sizing Initialisation
    const lvlIdx = this.levelManager.currentLevelIndex;
    const sizeIdx = Math.min(lvlIdx, LEVEL_CONTAINER_HALF_WIDTHS.length - 1);
    const prevIdx = Math.min(Math.max(lvlIdx - 1, 0), LEVEL_CONTAINER_HALF_WIDTHS.length - 1);
    const targetHalfW = LEVEL_CONTAINER_HALF_WIDTHS[sizeIdx];
    const startHalfW = lvlIdx === 0 ? targetHalfW : LEVEL_CONTAINER_HALF_WIDTHS[prevIdx];
    const targetBottom = LEVEL_CONTAINER_BOTTOMS[Math.min(lvlIdx, LEVEL_CONTAINER_BOTTOMS.length - 1)];
    const startBottom = lvlIdx === 0 ? targetBottom : LEVEL_CONTAINER_BOTTOMS[prevIdx];
    const cx = GAME_WIDTH / 2;
    if (fromLevelSelect) {
      this.containerLeft = cx - targetHalfW;
      this.containerRight = cx + targetHalfW;
      this.containerBottom = targetBottom;
    } else {
      this.containerLeft = cx - startHalfW;
      this.containerRight = cx + startHalfW;
      this.containerBottom = startBottom;
    }
    
    // 4. Initialize Launcher
    this.launcher = new Launcher(this);
    this.launcher.setSpeed(lvlIdx === 0 ? 0 : this.levelManager.getLauncherSpeed());
    this.launcher.x = cx;
    this.launcher.container.setX(cx);
    this.launcher.setPreview(
      this.levelManager.getQueue()[0].value, 
      this.levelManager.getQueue()[0].special
    );
    this.launcher.updateBounds(this.containerLeft + 30, this.containerRight - 30);

    // 5. Initialize Mechanics Systems
    this.collisionSys = new CollisionSystem(
      this, this.ballPool, this.particles, this.floatingText, this.scoring, this.combo
    );
    this.blackHoleSys = new BlackHoleSystem(this, this.ballPool, this.particles, this.scoring);
    this.overflowSys = new OverflowSystem(this, this.ballPool, () => this.handleGameOver());
    this.geyserSys = new GeyserSystem(this, this.ballPool);
    this.matter.world.off('beforeupdate', this.onGeyserBeforeUpdate);
    this.matter.world.on('beforeupdate', this.onGeyserBeforeUpdate);

    // Callbacks for level progression
    this.collisionSys.onFusion = (value: number) => {
      this.levelManager.registerFusion(value);
      if (this.levelManager.hasDualFusionGoal() || this.levelManager.currentLevel.type === 'fusion_goal') {
        this.hudGoalDirty = true;
      }
      
      if (this.levelManager.currentLevelIndex === 3 && value >= 64 && !this.isLevelTransitioning) {
        this.levelManager.hasWon = true;
        this.handleLevel4Win();
      }

      if (this.levelManager.currentLevelIndex === 0) {
        if (value === 4 && this.tutorialStep === 2) {
          if (this.tutorialArrow) {
            this.tutorialArrow.destroy();
            this.tutorialArrow = undefined;
          }
          this.tutorialStep = 3;
        } else if (value === 8 && this.tutorialStep === 3) {
          this.tutorialStep = 4;
        }
      }
    };

    this.collisionSys.onBallDestroyed = (wasFrozen: boolean) => {
      this.levelManager.registerDestroyedBall(wasFrozen);
      if (this.levelManager.hasEmptyBoardGoal()) {
        this.hudGoalDirty = true;
      }
      if (this.levelManager.hasEmptyBoardGoal() && this.levelManager.checkWinCondition()) {
        this.handleLevelWin();
      }
    };

    this.collisionSys.onZeroSum = (absVal: number) => {
      if (this.levelManager.hasZeroSumGoal()) {
        this.levelManager.registerZeroSum();
        this.hudGoalDirty = true;
      }

      if (this.levelManager.hasEmptyBoardGoal()) {
        this.hudGoalDirty = true;
      }

      if (this.levelManager.currentLevelIndex === 0 && this.tutorialStep === 4) {
        if (this.tutorialText) {
          this.tutorialText.destroy();
          this.tutorialText = undefined;
        }
        
        // Immediately after the board clears
        this.time.delayedCall(1000, () => {
          this.playSeamlessTransition(0);
        });
      }
    };

    this.collisionSys.onSplit = () => {
      if (this.levelManager.hasEmptyBoardGoal()) {
        this.hudGoalDirty = true;
      }
    };

    // 6. Setup Container Walls (Matter Static Bodies)
    this.setupWalls();

    // Wall width & height progression tween
    const isHeightChange = startBottom !== targetBottom;
    const isWidthChange = startHalfW !== targetHalfW;
    if (!fromLevelSelect && lvlIdx > 0 && (isWidthChange || isHeightChange)) {
      const layoutFx = (lvlIdx === 5 && isHeightChange) || (lvlIdx === 6 && isWidthChange);
      this.playContainerResize(
        startHalfW * 2, targetHalfW * 2, startBottom, targetBottom,
        layoutFx ? 2800 : 1000, layoutFx
      );
    } else {
      this.applyContainerBounds(targetHalfW, targetBottom);
    }

    // 7. Setup UI
    this.hud = new HUD(this, this.scoring, this.levelManager);
    this.nextQueue = new NextQueue(this, this.levelManager);

    // 8. Input Handling — handlers only enqueue; spawn runs in update()
    this.input.on('pointerdown', this.onPointerDown);
    this.input.on('pointermove', this.onPointerMove);

    // Spawn preplaced level objects if any
    this.spawnPreplacedBalls();
    this.spawnLevel8BottomRow();
    this.setupInvertedBucketForLevel();
    this.setupGeyserForLevel();

    // Initial UI update
    this.hud.update();
    this.nextQueue.update();

    // 9. Initialise Tutorial Elements
    if (this.levelManager.currentLevelIndex === 0) {
      this.tutorialStep = 1;
      
      this.tutorialText = this.add.text(GAME_WIDTH / 2, this.launcher.container.y + 60, "Drag & Drop 👆", {
        fontFamily: '"Orbitron", monospace',
        fontSize: '24px',
        color: '#00ff88',
        fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(40);
      
      this.tweens.add({
        targets: this.tutorialText,
        scaleX: 1.1,
        scaleY: 1.1,
        duration: 500,
        yoyo: true,
        repeat: -1
      });

      this.tutorialArrow = this.add.graphics().setDepth(40);
      this.tutorialArrow.lineStyle(3, 0x00ff88, 1);
      this.tutorialArrow.fillStyle(0x00ff88, 1);
      this.tutorialArrow.beginPath();
      this.tutorialArrow.moveTo(-10, -20);
      this.tutorialArrow.lineTo(10, -20);
      this.tutorialArrow.lineTo(10, 0);
      this.tutorialArrow.lineTo(20, 0);
      this.tutorialArrow.lineTo(0, 20);
      this.tutorialArrow.lineTo(-20, 0);
      this.tutorialArrow.lineTo(-10, 0);
      this.tutorialArrow.closePath();
      this.tutorialArrow.fillPath();
      this.tutorialArrow.strokePath();
      this.tutorialArrow.setVisible(false);
    } else if (this.levelManager.currentLevelIndex === 1) {
      this.tutorial2Step = 1;
    }
  }

  update(time: number, delta: number) {
    if (this.isGameOver) return;

    this.processSpawnQueue(time);
    this.flushDeferredHudUpdates();

    if (this.levelManager.currentLevelIndex >= 6 &&
        this.levelManager.currentLevelIndex !== 7 &&
        this.levelManager.currentLevelIndex !== 8 &&
        this.levelManager.currentLevelIndex !== 9) {
      this.updateCeilingPressure(delta);
    }

    if (
      this.levelManager.hasTimeSurvival() &&
      !this.isLevelTransitioning &&
      !this.isGameOver
    ) {
      this.levelManager.tickSurvival(delta);
      this.hud.updateSurvival();
      if (this.levelManager.isSurvivalTimeExpired()) {
        this.checkSurvivalFailed();
      }
    }

    if (this.invertedBucketSys?.isLevelActive()) {
      this.invertedBucketSys.update(delta);
      if (!this.invertedBucketSys.hasFlipped()) {
        this.hud.setFlipCountdownHint(this.invertedBucketSys.getFlipSecondsRemaining());
      } else {
        this.hud.setFlipCountdownHint(null);
        if (!this.levelManager.level8FlipComplete) {
          this.levelManager.markLevel8FlipComplete();
          this.nextQueue.update();
          this.launcher.setPreview(
            this.levelManager.getQueue()[0].value,
            this.levelManager.getQueue()[0].special
          );
          this.floatingText.show(
            GAME_WIDTH / 2, CONTAINER_TOP + 50,
            'KARMA TOPLAR! + ve - gelir', '#00ff88', 18, 2200
          );
        }
      }
    }

    if (this.levelManager.currentLevelIndex >= 2 && !this.isLevelTransitioning) {
      if (this.levelManager.checkWinCondition()) {
        if (this.levelManager.currentLevelIndex === 3) {
          this.handleLevel4Win();
        } else {
          this.handleLevelWin();
        }
      }
    }

    // One game-logic tick per frame — matches runner.maxUpdates: 1 (no catch-up spiral)
    this.fixedAccumulator += delta;
    if (this.fixedAccumulator >= FIXED_TIMESTEP) {
      if (!this.isLevelTransitioning) {
        const pointerX = this.getDeferredPointerX();
        this.launcher.update(time, pointerX);
      }
      this.particles.update(FIXED_TIMESTEP);
      this.combo.update(time);
      this.blackHoleSys.update(FIXED_TIMESTEP);

      const skipOverflow =
        this.levelManager.currentLevelIndex === 0 ||
        this.levelManager.isSpectralMazeLevel() ||
        this.invertedBucketSys?.isFlipping();
      if (!skipOverflow) {
        this.overflowSys.update(FIXED_TIMESTEP);
      }

      this.fixedAccumulator -= FIXED_TIMESTEP;
    }
    if (this.fixedAccumulator > FIXED_TIMESTEP * 2) {
      this.fixedAccumulator = 0;
    }

    this.background.update(time);

    this.ballPool.forEachActive((ball) => {
      if (ball.active && !ball.frozen) ball.syncPosition();
    });

    if (this.levelManager.isSpectralMazeLevel() && !this.isLevelTransitioning && !this.isGameOver) {
      this.geyserSys.setVisible(true);
      this.geyserSys.update(time, delta);
    } else {
      this.geyserSys.setVisible(false);
    }

    // Tutorial dynamic visual updates
    if (this.levelManager.currentLevelIndex === 0) {
      if (this.tutorialStep === 2 && this.tutorialArrow) {
        let ball2: JellyBall | undefined;
        this.ballPool.forEachActive((b) => {
          if (!ball2 && b.value === 2) ball2 = b;
        });
        if (ball2 && ball2.body) {
          this.tutorialArrow.setPosition(ball2.body.position.x, ball2.body.position.y - 50);
          this.tutorialArrow.setVisible(true);
        } else {
          this.tutorialArrow.setVisible(false);
        }
      } else if (this.tutorialStep === 4) {
        let ball8: JellyBall | undefined;
        this.ballPool.forEachActive((b) => {
          if (!ball8 && b.value === 8) ball8 = b;
        });
        if (ball8 && ball8.body) {
          if (!this.tutorialText) {
            this.tutorialText = this.add.text(ball8.body.position.x, ball8.body.position.y - 70, "Match Opposites to Clear!", {
              fontFamily: '"Orbitron", monospace',
              fontSize: '20px',
              color: '#ff3388',
              fontStyle: 'bold',
              stroke: '#000000',
              strokeThickness: 3,
            }).setOrigin(0.5).setDepth(40);
            this.tweens.add({
              targets: this.tutorialText,
              scaleX: 1.1,
              scaleY: 1.1,
              duration: 500,
              yoyo: true,
              repeat: -1
            });
          } else {
            this.tutorialText.setPosition(ball8.body.position.x, ball8.body.position.y - 70);
          }
        } else {
          if (this.tutorialText) {
            this.tutorialText.destroy();
            this.tutorialText = undefined;
          }
        }
      }
    } else if (this.levelManager.currentLevelIndex === 1) {
      if (this.tutorial2Step === 2) {
        let ball16: JellyBall | undefined;
        this.ballPool.forEachActive((b) => {
          if (!ball16 && Math.abs(b.value) === 16) ball16 = b;
        });
        if (ball16 && ball16.body) {
          if (!this.tutorialText) {
            this.tutorialText = this.add.text(ball16.body.position.x, ball16.body.position.y - 75, "Hit with a lower negative to SPLIT!", {
              fontFamily: '"Orbitron", monospace',
              fontSize: '18px',
              color: '#ff3388',
              fontStyle: 'bold',
              stroke: '#000000',
              strokeThickness: 3,
            }).setOrigin(0.5).setDepth(40);
            this.tweens.add({
              targets: this.tutorialText,
              scaleX: 1.1,
              scaleY: 1.1,
              duration: 500,
              yoyo: true,
              repeat: -1
            });
          } else {
            this.tutorialText.setPosition(ball16.body.position.x, ball16.body.position.y - 75);
          }
        } else {
          if (this.tutorialText) {
            this.tutorialText.destroy();
            this.tutorialText = undefined;
          }
          this.tutorial2Step = 3;
        }
      } else if (this.tutorial2Step === 3) {
        if (this.ballPool.getActiveCount() === 0) {
          this.tutorial2Step = 4;
          this.time.delayedCall(800, () => {
            this.playSeamlessTransition(1);
          });
        }
      }
    }
  }

  /** Drain one spawn request per frame — keeps Matter instantiation off the input path. */
  private processSpawnQueue(time: number): void {
    if (this.spawnQueue.length === 0) return;
    const nextSpawn = this.spawnQueue.shift()!;
    this.applySpawnAim(nextSpawn.x);
    this.executeDrop(time, nextSpawn.x);
  }

  private flushDeferredHudUpdates(): void {
    if (!this.hudGoalDirty) return;
    this.hudGoalDirty = false;
    this.hud.updateZeroSumGoal();
  }

  private applySpawnAim(pointerX: number): void {
    if (this.levelManager.currentLevelIndex === 0) return;
    this.launcher.isPlayerControlled = true;
    this.launcher.x = Phaser.Math.Clamp(
      pointerX,
      this.containerLeft + 30,
      this.containerRight - 30
    );
  }

  private getDeferredPointerX(): number | null {
    if (
      !this.hasPointerX ||
      this.isLevelTransitioning ||
      this.levelManager.currentLevelIndex === 0
    ) {
      return null;
    }
    this.launcher.isPlayerControlled = true;
    return this.lastPointerX;
  }

  private executeDrop(time: number, spawnX?: number): void {
    if (this.isGameOver || this.isLevelTransitioning) return;
    if (this.invertedBucketSys?.isBlockingInput()) return;
    if (this.levelManager.isOutOfDrops()) return;

    if (this.launcher.tryDrop(time)) {
      const dropItem = this.levelManager.consumeNextDrop();
      const dropX = spawnX ?? this.launcher.getX();
      const dropY = this.launcher.getDropY();

      const ball = this.ballPool.acquire();
      if (ball) {
        ball.activate(dropX, dropY, dropItem.value, dropItem.special);
      }

      if (this.levelManager.hasDropLimit()) {
        this.levelManager.registerDropUsed();
        this.hud.updateDrops();
        if (this.levelManager.isOutOfDrops() && !this.levelManager.hasWon) {
          this.time.delayedCall(1800, () => this.checkMovesExpired());
        }
      }

      if (this.levelManager.hasEmptyBoardGoal()) {
        this.hudGoalDirty = true;
      }

      if (this.levelManager.currentLevelIndex === 0 && this.tutorialStep === 1) {
        if (this.tutorialText) {
          this.tweens.add({
            targets: this.tutorialText,
            alpha: 0,
            duration: 300,
            onComplete: () => {
              this.tutorialText?.destroy();
              this.tutorialText = undefined;
            }
          });
        }
        this.tutorialStep = 2;
      } else if (this.levelManager.currentLevelIndex === 1 && this.tutorial2Step === 1) {
        this.tutorial2Step = 2;
      }

      const nextInQueue = this.levelManager.getQueue()[0];
      this.launcher.setPreview(nextInQueue.value, nextInQueue.special);
      this.nextQueue.update();
    }
  }

  private applyContainerBounds(halfWidth: number, bottom: number): void {
    const cx = GAME_WIDTH / 2;
    this.containerLeft = cx - halfWidth;
    this.containerRight = cx + halfWidth;
    this.containerBottom = bottom;

    if (this.leftWall) {
      this.matter.body.setPosition(this.leftWall as any, { x: this.containerLeft - 50, y: GAME_HEIGHT / 2 });
    }
    if (this.rightWall) {
      this.matter.body.setPosition(this.rightWall as any, { x: this.containerRight + 50, y: GAME_HEIGHT / 2 });
    }
    if (this.bottomWall) {
      this.matter.body.setPosition(this.bottomWall as any, { x: GAME_WIDTH / 2, y: this.containerBottom + 50 });
    }

    this.background.updateContainerBounds(this.containerLeft, this.containerRight, this.containerBottom);
    this.launcher.updateBounds(this.containerLeft + 30, this.containerRight - 30);
  }

  private setMainWallsEnabled(enabled: boolean): void {
    for (const wall of [this.leftWall, this.rightWall, this.bottomWall]) {
      if (!wall) continue;
      this.matter.body.set(wall, { isSensor: !enabled });
    }
  }

  private checkSurvivalFailed(): void {
    if (this.survivalFailPending || this.isGameOver || this.isLevelTransitioning || this.levelManager.hasWon) return;
    if (!this.levelManager.isSurvivalTimeExpired()) return;

    this.survivalFailPending = true;
    this.floatingText.show(
      GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40,
      'TIME UP!', '#ff2244', 28, 1200
    );
    this.time.delayedCall(1200, () => {
      if (!this.levelManager.hasWon) this.handleGameOver();
    });
  }

  private checkMovesExpired(): void {
    if (this.isGameOver || this.isLevelTransitioning || this.levelManager.hasWon) return;
    if (!this.levelManager.isOutOfDrops()) return;

    this.floatingText.show(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40, 'OUT OF MOVES!', '#ff2244', 28, 1200);
    this.time.delayedCall(1200, () => {
      if (!this.levelManager.hasWon) this.handleGameOver();
    });
  }

  private playContainerResize(
    fromW: number, toW: number, fromH: number, toH: number,
    duration: number, withShrinkFx: boolean, onComplete?: () => void
  ): void {
    const boundsObj = { w: fromW, h: fromH };
    this.shrinkFxTimer?.destroy();

    if (withShrinkFx) {
      this.shrinkFxTimer = this.time.addEvent({
        delay: 90,
        loop: true,
        callback: () => {
          const px = Phaser.Math.Between(this.containerLeft + 15, this.containerRight - 15);
          this.particles.burst(px, this.containerBottom, 0x00ccff, 4, 1.8, 280);
          if (toW < fromW) {
            this.particles.burst(this.containerLeft, GAME_HEIGHT / 2, 0xff3388, 3, 1.5, 220);
            this.particles.burst(this.containerRight, GAME_HEIGHT / 2, 0xff3388, 3, 1.5, 220);
          }
        }
      });
    }

    this.tweens.add({
      targets: boundsObj,
      w: toW,
      h: toH,
      duration,
      ease: withShrinkFx ? 'Cubic.easeInOut' : 'Cubic.easeOut',
      onUpdate: () => {
        this.applyContainerBounds(boundsObj.w / 2, boundsObj.h);
      },
      onComplete: () => {
        this.shrinkFxTimer?.destroy();
        this.shrinkFxTimer = undefined;
        this.applyContainerBounds(toW / 2, toH);
        if (withShrinkFx) {
          this.cameras.main.shake(250, 0.01);
          this.particles.burst(GAME_WIDTH / 2, this.containerBottom, 0x00ff88, 20, 2.5, 450);
        } else if (toH > fromH) {
          this.particles.burst(GAME_WIDTH / 2, this.containerBottom, 0x00ccff, 16, 2, 400);
        }
        if (toW < fromW) {
          this.cameras.main.shake(200, 0.008);
          this.particles.burst(this.containerLeft, GAME_HEIGHT / 2, 0xff3388, 14, 2, 350);
          this.particles.burst(this.containerRight, GAME_HEIGHT / 2, 0xff3388, 14, 2, 350);
        }
        onComplete?.();
      }
    });
  }

  private setupWalls() {
    const wallOpts = {
      isStatic: true,
      restitution: WALL_RESTITUTION,
      friction: WALL_FRICTION,
      collisionFilter: { category: CAT_WALL, mask: CAT_BALL | CAT_WALL },
    };
    
    // Bottom
    this.bottomWall = this.matter.add.rectangle(
      GAME_WIDTH / 2, 
      this.containerBottom + 50, 
      GAME_WIDTH * 2, 
      100, 
      wallOpts
    ) as any;
    // Left
    this.leftWall = this.matter.add.rectangle(this.containerLeft - 50, GAME_HEIGHT / 2, 100, GAME_HEIGHT, wallOpts) as any;
    // Right
    this.rightWall = this.matter.add.rectangle(this.containerRight + 50, GAME_HEIGHT / 2, 100, GAME_HEIGHT, wallOpts) as any;
  }

  private spawnLevel8BottomRow(): void {
    if (this.levelManager.currentLevelIndex !== 7) return;

    const count = 8;
    const value = -2;
    const radius = getBallRadius(2);
    const y = this.containerBottom - radius - 12;
    const left = this.containerLeft + radius + 12;
    const right = this.containerRight - radius - 12;

    for (let i = 0; i < count; i++) {
      const x = left + (i / (count - 1)) * (right - left);
      const ball = this.ballPool.acquire();
      if (ball) {
        ball.activate(x, y, value, null);
      }
    }
  }

  private setupInvertedBucketForLevel(): void {
    this.invertedBucketSys?.destroy();
    this.invertedBucketSys = undefined;

    if (this.levelManager.currentLevelIndex === 7) {
      this.invertedBucketSys = new InvertedBucketSystem(
        this,
        this.background,
        this.launcher,
        this.floatingText,
        this.particles,
        () => this.levelManager.getGravity(),
        () => {
          const out: JellyBall[] = [];
          this.ballPool.forEachActive((b) => out.push(b));
          return out;
        },
        (enabled) => this.setMainWallsEnabled(enabled)
      );
      this.invertedBucketSys.start(
        this.containerLeft,
        this.containerRight,
        this.containerBottom
      );
    } else {
      this.matter.world.setGravity(0, GRAVITY_Y);
    }
  }

  private getCeilingPressureConfig(): { interval: number; step: number } {
    return { interval: 15000, step: 20 };
  }

  private setupGeyserForLevel(): void {
    if (this.levelManager.isSpectralMazeLevel()) {
      this.dynamicOverflowY = OVERFLOW_Y;
      this.ceilingTimer = 15000;
      if (this.pressureText) this.pressureText.setVisible(false);
      this.overflowSys.stopPanic();
      this.geyserSys.setVisible(true);
      this.floatingText.show(
        GAME_WIDTH / 2, CONTAINER_TOP + 72,
        'YAN RÜZGAR — +128 ve -128 oluştur', '#00f0ff', 18, 2400
      );
      this.geyserSys.reset();
    } else {
      this.geyserSys.setVisible(false);
    }
  }

  private finishLevelStart(): void {
    this.survivalFailPending = false;
    this.spawnPreplacedBalls();
    this.spawnLevel8BottomRow();
    this.setupInvertedBucketForLevel();
    this.setupGeyserForLevel();
    this.hud.update();
    this.nextQueue.update();
    this.isLevelTransitioning = false;
    this.launcher.isPlayerControlled = true;
    this.launcher.setSpeed(this.levelManager.getLauncherSpeed());
    this.launcher.updateBounds(this.containerLeft + 30, this.containerRight - 30);
    const nextInQueue = this.levelManager.getQueue()[0];
    this.launcher.setPreview(nextInQueue.value, nextInQueue.special);
  }

  private spawnPreplacedBalls() {
    const preplaced = this.levelManager.currentLevel.preplacedBalls;
    if (preplaced) {
      preplaced.forEach(p => {
        const ball = this.ballPool.acquire();
        if (ball) ball.activate(p.x, p.y, p.value, null, !!p.frozen);
      });
    }
  }

  private clearAllBoardBalls(withBurst = false): void {
    if (withBurst) {
      this.ballPool.forEachActive((ball) => {
        if (!ball.active) return;
        const x = ball.body?.position.x ?? ball.anchorX;
        const y = ball.body?.position.y ?? ball.anchorY;
        const color = ball.sign > 0 ? 0x00ff88 : 0xff3388;
        this.particles.burst(x, y, color, 12, 1.5, 300);
      });
    }
    this.ballPool.releaseAll();
  }

  /** In-place level reload — avoids scene.restart pool re-allocation spike. */
  private reloadLevel(levelIndex: number): void {
    this.clearAllBoardBalls(false);
    this.isGameOver = false;
    this.isLevelTransitioning = false;
    this.fixedAccumulator = 0;
    this.survivalFailPending = false;
    this.matter.world.resume();
    this.levelManager.loadLevel(levelIndex);
    this.finishLevelStart();
  }

  private handleGameOver() {
    this.isGameOver = true;
    
    // Disable physics
    this.matter.world.pause();

    // Small delay then transition
    this.time.delayedCall(1500, () => {
      // Clean up singletons
      this.particles.destroy();
      this.floatingText.destroy();
      this.collisionSys.destroy();
      
      this.scene.start('GameOverScene', { 
        score: this.scoring.score, 
        highScore: this.scoring.highScore,
        levelIndex: this.levelManager.currentLevelIndex,
      });
    });
  }
  private showLevelCompletedPopup() {
    // 1. Semi-transparent black background overlay starting at alpha: 0
    const overlay = this.add.graphics().setDepth(100);
    overlay.fillStyle(0x050510, 0.6);
    overlay.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    overlay.setAlpha(0);

    this.tweens.add({
      targets: overlay,
      alpha: 1,
      duration: 300,
    });

    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2 - 80;

    // 2. Neon Glow Title dropping from top with bounce ease
    const titleGlow = this.add.text(cx, -100, 'LEVEL COMPLETED', {
      fontFamily: '"Orbitron", monospace',
      fontSize: '42px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(101);

    const titleShadow = this.add.text(cx, -100, 'LEVEL COMPLETED', {
      fontFamily: '"Orbitron", monospace',
      fontSize: '42px',
      color: '#00ff88',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(100).setAlpha(0.6);

    this.tweens.add({
      targets: [titleGlow, titleShadow],
      y: cy,
      duration: 800,
      ease: 'Bounce.easeOut'
    });

    this.tweens.add({
      targets: titleShadow,
      scaleX: 1.05,
      scaleY: 1.05,
      alpha: 0.2,
      duration: 800,
      yoyo: true,
      repeat: -1
    });

    // 3. Next Level Button Container (sliding up from bottom)
    const nextBtn = this.add.container(cx, GAME_HEIGHT + 100).setDepth(101);

    const btnBg = this.add.rectangle(0, 0, 240, 60, 0x00ff88)
      .setStrokeStyle(3, 0xffffff)
      .setInteractive({ useHandCursor: true });

    const btnText = this.add.text(0, 0, 'NEXT LEVEL ➔', {
      fontFamily: '"Orbitron", monospace',
      fontSize: '22px',
      color: '#050510',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    nextBtn.add([btnBg, btnText]);

    this.tweens.add({
      targets: nextBtn,
      y: cy + 120,
      duration: 600,
      ease: 'Power2.easeOut'
    });

    // 4. Countdown Subtitle
    const timerText = this.add.text(cx, cy + 180, 'Next Level in 3...', {
      fontFamily: '"Orbitron", monospace',
      fontSize: '18px',
      color: '#aaaaaa',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(101).setAlpha(0);

    this.tweens.add({
      targets: timerText,
      alpha: 1,
      delay: 400,
      duration: 300,
    });

    // 5. Timer logic
    let countdown = 3;
    const startNextLevel = () => {
      if (timerEvent) timerEvent.destroy();
      btnBg.disableInteractive();

      // Exit animations: slide elements away and fade overlay
      this.tweens.add({
        targets: [titleGlow, titleShadow],
        y: -200,
        duration: 400,
        ease: 'Power2.easeIn'
      });

      this.tweens.add({
        targets: [nextBtn, timerText],
        y: GAME_HEIGHT + 200,
        duration: 400,
        ease: 'Power2.easeIn'
      });

      this.tweens.add({
        targets: overlay,
        alpha: 0,
        duration: 400,
        onComplete: () => {
          nextBtn.destroy();
          overlay.destroy();
          titleGlow.destroy();
          titleShadow.destroy();
          timerText.destroy();

          const nextLvlIndex = this.levelManager.currentLevelIndex + 1;
          this.reloadLevel(nextLvlIndex);
        }
      });
    };

    const timerEvent = this.time.addEvent({
      delay: 1000,
      repeat: 2,
      callback: () => {
        countdown--;
        timerText.setText(`Next Level in ${countdown}...`);
        if (countdown <= 0) {
          startNextLevel();
        }
      }
    });

    // Interactive Hover effects
    btnBg.on('pointerover', () => {
      btnBg.setFillStyle(0x00cc77);
      this.tweens.add({
        targets: nextBtn,
        scaleX: 1.05,
        scaleY: 1.05,
        duration: 100
      });
    });

    btnBg.on('pointerout', () => {
      btnBg.setFillStyle(0x00ff88);
      this.tweens.add({
        targets: nextBtn,
        scaleX: 1.0,
        scaleY: 1.0,
        duration: 100
      });
    });

    btnBg.on('pointerdown', () => {
      startNextLevel();
    });
  }

  private playVictorySound() {
    try {
      const ctx = (this.sound as any).context || new (window.AudioContext || (window as any).webkitAudioContext)();
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
      
      // Retro victory chime: C5 -> E5 -> G5 -> C6
      playTone(523.25, now, 0.15); // C5
      playTone(659.25, now + 0.1, 0.15); // E5
      playTone(783.99, now + 0.2, 0.15); // G5
      playTone(1046.50, now + 0.3, 0.4); // C6
    } catch (e) {
      devWarn('AudioContext error/blocked:', e);
    }
  }

  private handleLevelWin() {
    this.isLevelTransitioning = true;
    this.launcher.isPlayerControlled = false;

    this.clearAllBoardBalls(true);

    this.playVictorySound();

    this.time.delayedCall(1000, () => {
      this.playSeamlessTransition(this.levelManager.currentLevelIndex);
    });
  }

  private playSeamlessTransition(fromLevelIndex: number) {
    if (fromLevelIndex === 2) {
      this.playLevel3ToLevel4Transition();
      return;
    }
    if (fromLevelIndex === 4) {
      this.playLevel5ToLevel6Transition();
      return;
    }
    if (fromLevelIndex === 5) {
      this.playLevel6ToLevel7Transition();
      return;
    }
    if (fromLevelIndex === 6) {
      this.playLevel7ToLevel8Transition();
      return;
    }

    this.isLevelTransitioning = true;
    this.launcher.isPlayerControlled = false;

    // 1. Smoothly tween a dark alpha overlay (alpha: 0.6) over the game board.
    const overlay = this.add.graphics().setDepth(100);
    overlay.fillStyle(0x050510, 0.6);
    overlay.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    overlay.setAlpha(0);

    this.tweens.add({
      targets: overlay,
      alpha: 1,
      duration: 300,
    });

    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2 - 80;
    const currentLvlNum = fromLevelIndex + 1;
    const titleText = `LEVEL ${currentLvlNum} COMPLETED`;

    // 2. Drop the completed text from the top with a heavy bounce effect.
    const titleGlow = this.add.text(cx, -100, titleText, {
      fontFamily: '"Orbitron", monospace',
      fontSize: '38px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(101);

    const titleShadow = this.add.text(cx, -100, titleText, {
      fontFamily: '"Orbitron", monospace',
      fontSize: '38px',
      color: '#00ff88',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(100).setAlpha(0.6);

    this.tweens.add({
      targets: [titleGlow, titleShadow],
      y: cy,
      duration: 800,
      ease: 'Bounce.easeOut'
    });

    this.tweens.add({
      targets: titleShadow,
      scaleX: 1.05,
      scaleY: 1.05,
      alpha: 0.2,
      duration: 800,
      yoyo: true,
      repeat: -1
    });

    // 3. Play a satisfying "Victory/Ding" audio effect.
    this.playVictorySound();

    // 4. After 1.5 seconds, fade out the "Level Completed" text.
    this.time.delayedCall(2300, () => {
      this.tweens.add({
        targets: [titleGlow, titleShadow],
        alpha: 0,
        y: cy - 50,
        duration: 400,
        ease: 'Power2.easeIn',
        onComplete: () => {
          titleGlow.destroy();
          titleShadow.destroy();

          // 5. Animate container width and/or height change
          const startW = LEVEL_CONTAINER_HALF_WIDTHS[Math.min(fromLevelIndex, LEVEL_CONTAINER_HALF_WIDTHS.length - 1)] * 2;
          const targetW = LEVEL_CONTAINER_HALF_WIDTHS[Math.min(fromLevelIndex + 1, LEVEL_CONTAINER_HALF_WIDTHS.length - 1)] * 2;
          const startH = LEVEL_CONTAINER_BOTTOMS[Math.min(fromLevelIndex, LEVEL_CONTAINER_BOTTOMS.length - 1)];
          const targetH = LEVEL_CONTAINER_BOTTOMS[Math.min(fromLevelIndex + 1, LEVEL_CONTAINER_BOTTOMS.length - 1)];
          const heightChanging = startH !== targetH;
          const widthChanging = startW !== targetW;

          const finishTransition = () => {
            this.tweens.add({
              targets: overlay,
              alpha: 0,
              duration: 300,
              onComplete: () => {
                overlay.destroy();
                this.levelManager.nextLevel();
                this.finishLevelStart();
              }
            });
          };

          if (heightChanging || widthChanging) {
            this.playContainerResize(startW, targetW, startH, targetH, heightChanging || widthChanging ? 2200 : 1000, heightChanging || widthChanging, finishTransition);
          } else {
            const boundsObj = { w: startW };
            this.tweens.add({
              targets: boundsObj,
              w: targetW,
              duration: 1000,
              ease: 'Cubic.easeOut',
              onUpdate: () => {
                this.applyContainerBounds(boundsObj.w / 2, startH);
              },
              onComplete: () => {
                this.applyContainerBounds(targetW / 2, startH);
                finishTransition();
              }
            });
          }
        }
      });
    });
  }

  private playLevel3ToLevel4Transition() {
    this.isLevelTransitioning = true;
    this.launcher.isPlayerControlled = false;

    // 1. Trigger a flashing neon overlay screen
    const overlay = this.add.graphics().setDepth(100);
    overlay.fillStyle(0x050510, 0.7);
    overlay.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    overlay.setAlpha(0);

    this.tweens.add({
      targets: overlay,
      alpha: 1,
      duration: 300,
    });

    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2 - 80;

    // 2. Display the text: "WARM-UP COMPLETE! GET READY FOR THE REAL CHALLENGE."
    const titleGlow = this.add.text(cx, cy, "WARM-UP COMPLETE!\nGET READY FOR THE REAL CHALLENGE.", {
      fontFamily: '"Orbitron", monospace',
      fontSize: '20px',
      color: '#00ff88',
      fontStyle: 'bold',
      align: 'center',
      stroke: '#000000',
      strokeThickness: 4
    }).setOrigin(0.5).setDepth(101);

    this.playVictorySound();
    this.cameras.main.flash(200, 0, 255, 136);

    // 3. After 1.5 seconds, the left and right energy walls tween outward by another 1 grid slot, reaching their maximum full-size container width.
    this.time.delayedCall(1800, () => {
      this.tweens.add({
        targets: titleGlow,
        alpha: 0,
        y: cy - 40,
        duration: 300,
        onComplete: () => {
          titleGlow.destroy();
        }
      });

      // Expand energy walls
      const startW = LEVEL_CONTAINER_HALF_WIDTHS[2] * 2; // Level 3 width (235)
      const targetW = 400; // max width
      const boundsObj = { w: startW };
      
      this.tweens.add({
        targets: boundsObj,
        w: targetW,
        duration: 1200,
        ease: 'Cubic.easeOut',
        onUpdate: () => {
          const halfW = boundsObj.w / 2;
          this.containerLeft = cx - halfW;
          this.containerRight = cx + halfW;
          
          if (this.leftWall) {
            this.matter.body.setPosition(this.leftWall as any, { x: this.containerLeft - 50, y: GAME_HEIGHT / 2 });
          }
          if (this.rightWall) {
            this.matter.body.setPosition(this.rightWall as any, { x: this.containerRight + 50, y: GAME_HEIGHT / 2 });
          }
          
          this.background.updateContainerBounds(this.containerLeft, this.containerRight, this.containerBottom);
          this.launcher.updateBounds(this.containerLeft + 30, this.containerRight - 30);
        },
        onComplete: () => {
          // Play a heavy mechanical "locking" particle effect when the walls hit max width.
          this.cameras.main.shake(200, 0.01);
          this.particles.burst(this.containerLeft, this.containerBottom, 0x00ffff, 25, 3, 500);
          this.particles.burst(this.containerRight, this.containerBottom, 0x00ffff, 25, 3, 500);

          // 4. The Target Warning: A huge holographic warning pops up on the screen with an alert sound
          const alertText = this.add.text(cx, cy, "NEW MISSION:\nEVOLVE TO A +64 BALL TO WIN!", {
            fontFamily: '"Orbitron", monospace',
            fontSize: '22px',
            color: '#ff2244',
            fontStyle: 'bold',
            align: 'center',
            stroke: '#000000',
            strokeThickness: 5
          }).setOrigin(0.5).setDepth(101).setAlpha(0);

          try {
            const actx = (this.sound as any).context || new (window.AudioContext || (window as any).webkitAudioContext)();
            const osc = actx.createOscillator();
            const gain = actx.createGain();
            osc.connect(gain);
            gain.connect(actx.destination);
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(150, actx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(300, actx.currentTime + 0.3);
            gain.gain.setValueAtTime(0.15, actx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + 0.3);
            osc.start();
            osc.stop(actx.currentTime + 0.3);
          } catch (e) {}

          this.tweens.add({
            targets: alertText,
            alpha: 1,
            scaleX: 1.1,
            scaleY: 1.1,
            duration: 300,
            yoyo: true,
            repeat: 1,
            onComplete: () => {
              this.time.delayedCall(1000, () => {
                this.tweens.add({
                  targets: [alertText, overlay],
                  alpha: 0,
                  duration: 400,
                  onComplete: () => {
                    alertText.destroy();
                    overlay.destroy();

                    // Start Level 4
                    this.levelManager.nextLevel();
                    
                    this.dynamicOverflowY = OVERFLOW_Y;
                    this.ceilingTimer = 15000;

                    this.hud.update();
                    this.nextQueue.update();

                    this.isLevelTransitioning = false;
                    this.launcher.isPlayerControlled = true;
                    this.launcher.setSpeed(this.levelManager.getLauncherSpeed());

                    const nextInQueue = this.levelManager.getQueue()[0];
                    this.launcher.setPreview(nextInQueue.value, nextInQueue.special);
                  }
                });
              });
            }
          });
        }
      });
    });
  }

  private playLevel5ToLevel6Transition() {
    this.isLevelTransitioning = true;
    this.launcher.isPlayerControlled = false;

    const overlay = this.add.graphics().setDepth(100);
    overlay.fillStyle(0x050510, 0.75);
    overlay.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    overlay.setAlpha(0);

    this.tweens.add({ targets: overlay, alpha: 1, duration: 400 });

    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2 - 100;

    const titleGlow = this.add.text(cx, cy - 30, 'LEVEL 5 COMPLETED', {
      fontFamily: '"Orbitron", monospace',
      fontSize: '34px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(101).setAlpha(0);

    const titleShadow = this.add.text(cx, cy - 30, 'LEVEL 5 COMPLETED', {
      fontFamily: '"Orbitron", monospace',
      fontSize: '34px',
      color: '#00ff88',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(100).setAlpha(0);

    this.tweens.add({
      targets: [titleGlow, titleShadow],
      alpha: 1,
      y: cy,
      duration: 600,
      ease: 'Back.easeOut',
    });

    this.playVictorySound();

    const hydraulicLine = this.add.graphics().setDepth(99);
    const drawHydraulic = (y: number, alpha: number) => {
      hydraulicLine.clear();
      hydraulicLine.lineStyle(3, 0x00ccff, alpha);
      hydraulicLine.beginPath();
      hydraulicLine.moveTo(this.containerLeft, y);
      hydraulicLine.lineTo(this.containerRight, y);
      hydraulicLine.strokePath();
      hydraulicLine.fillStyle(0x00ccff, alpha * 0.15);
      hydraulicLine.fillRect(this.containerLeft, y - 2, this.containerRight - this.containerLeft, 4);
    };

    this.time.delayedCall(1600, () => {
      this.tweens.add({
        targets: [titleGlow, titleShadow],
        alpha: 0,
        y: cy - 50,
        duration: 350,
        onComplete: () => {
          titleGlow.destroy();
          titleShadow.destroy();
        }
      });

      const startH = LEVEL_CONTAINER_BOTTOMS[4];
      const targetH = LEVEL_CONTAINER_BOTTOMS[5];
      const startW = LEVEL_CONTAINER_HALF_WIDTHS[4] * 2;
      let lineAlpha = 0.9;

      drawHydraulic(startH, lineAlpha);

      this.playContainerResize(startW, startW, startH, targetH, 3000, true, () => {
        hydraulicLine.destroy();

        const alertText = this.add.text(cx, cy, 'NEW MISSION:\nFORGE +128 IN 30 MOVES', {
          fontFamily: '"Orbitron", monospace',
          fontSize: '22px',
          color: '#ff2244',
          fontStyle: 'bold',
          align: 'center',
          stroke: '#000000',
          strokeThickness: 5,
        }).setOrigin(0.5).setDepth(101).setAlpha(0).setScale(0.85);

        this.cameras.main.flash(180, 255, 34, 68);

        this.tweens.add({
          targets: alertText,
          alpha: 1,
          scaleX: 1,
          scaleY: 1,
          duration: 450,
          ease: 'Back.easeOut',
          onComplete: () => {
            this.time.delayedCall(1400, () => {
              this.tweens.add({
                targets: [alertText, overlay],
                alpha: 0,
                duration: 450,
                onComplete: () => {
                  alertText.destroy();
                  overlay.destroy();
                  this.levelManager.nextLevel();
                  this.finishLevelStart();
                }
              });
            });
          }
        });
      });

      // Animate hydraulic line rising with the floor
      const lineObj = { h: startH, a: lineAlpha };
      this.tweens.add({
        targets: lineObj,
        h: targetH,
        a: 0.3,
        duration: 3000,
        ease: 'Cubic.easeInOut',
        onUpdate: () => {
          drawHydraulic(lineObj.h, lineObj.a);
        },
      });
    });
  }

  private playLevel6ToLevel7Transition() {
    this.isLevelTransitioning = true;
    this.launcher.isPlayerControlled = false;

    const overlay = this.add.graphics().setDepth(100);
    overlay.fillStyle(0x050510, 0.75);
    overlay.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    overlay.setAlpha(0);
    this.tweens.add({ targets: overlay, alpha: 1, duration: 400 });

    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2 - 90;

    const titleGlow = this.add.text(cx, cy - 20, 'LEVEL 6 COMPLETED', {
      fontFamily: '"Orbitron", monospace',
      fontSize: '32px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(101).setAlpha(0);

    this.tweens.add({
      targets: titleGlow,
      alpha: 1,
      y: cy,
      duration: 600,
      ease: 'Back.easeOut',
    });

    this.playVictorySound();

    this.time.delayedCall(1500, () => {
      this.tweens.add({
        targets: titleGlow,
        alpha: 0,
        y: cy - 40,
        duration: 350,
        onComplete: () => titleGlow.destroy(),
      });

      const startH = LEVEL_CONTAINER_BOTTOMS[5];
      const targetH = LEVEL_CONTAINER_BOTTOMS[6];
      const startW = LEVEL_CONTAINER_HALF_WIDTHS[5] * 2;
      const targetW = LEVEL_CONTAINER_HALF_WIDTHS[6] * 2;

      this.playContainerResize(startW, targetW, startH, targetH, 3000, true, () => {
        const alertText = this.add.text(cx, cy, 'THE NARROWS\n15 ZERO SUMS IN 90s', {
          fontFamily: '"Orbitron", monospace',
          fontSize: '22px',
          color: '#00f0ff',
          fontStyle: 'bold',
          align: 'center',
          stroke: '#000000',
          strokeThickness: 5,
        }).setOrigin(0.5).setDepth(101).setAlpha(0);

        this.cameras.main.flash(180, 0, 240, 255);

        this.tweens.add({
          targets: alertText,
          alpha: 1,
          duration: 450,
          ease: 'Back.easeOut',
          onComplete: () => {
            this.time.delayedCall(1400, () => {
              this.tweens.add({
                targets: [alertText, overlay],
                alpha: 0,
                duration: 450,
                onComplete: () => {
                  alertText.destroy();
                  overlay.destroy();
                  this.levelManager.nextLevel();
                  this.finishLevelStart();
                }
              });
            });
          }
        });
      });
    });
  }

  private playLevel7ToLevel8Transition() {
    this.isLevelTransitioning = true;
    this.launcher.isPlayerControlled = false;

    const overlay = this.add.graphics().setDepth(100);
    overlay.fillStyle(0x050510, 0.75);
    overlay.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    overlay.setAlpha(0);
    this.tweens.add({ targets: overlay, alpha: 1, duration: 400 });

    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2 - 90;

    const titleGlow = this.add.text(cx, cy - 20, 'LEVEL 7 COMPLETED', {
      fontFamily: '"Orbitron", monospace',
      fontSize: '32px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(101).setAlpha(0);

    this.tweens.add({
      targets: titleGlow,
      alpha: 1,
      y: cy,
      duration: 600,
      ease: 'Back.easeOut',
    });

    this.playVictorySound();

    this.time.delayedCall(1500, () => {
      this.tweens.add({
        targets: titleGlow,
        alpha: 0,
        y: cy - 40,
        duration: 350,
        onComplete: () => titleGlow.destroy(),
      });

      const startW = LEVEL_CONTAINER_HALF_WIDTHS[6] * 2;
      const targetW = LEVEL_CONTAINER_HALF_WIDTHS[7] * 2;
      const h = LEVEL_CONTAINER_BOTTOMS[7];

      this.playContainerResize(startW, targetW, h, h, 2200, true, () => {
        const alertText = this.add.text(cx, cy, 'THE TWISTED PARADOX\n10s SONRA BARDAK TERS DÖNER', {
          fontFamily: '"Orbitron", monospace',
          fontSize: '20px',
          color: '#ff3388',
          fontStyle: 'bold',
          align: 'center',
          stroke: '#000000',
          strokeThickness: 5,
        }).setOrigin(0.5).setDepth(101).setAlpha(0);

        this.cameras.main.flash(200, 255, 51, 136);

        this.tweens.add({
          targets: alertText,
          alpha: 1,
          duration: 450,
          ease: 'Back.easeOut',
          onComplete: () => {
            this.time.delayedCall(1400, () => {
              this.tweens.add({
                targets: [alertText, overlay],
                alpha: 0,
                duration: 450,
                onComplete: () => {
                  alertText.destroy();
                  overlay.destroy();
                  this.levelManager.nextLevel();
                  this.finishLevelStart();
                }
              });
            });
          }
        });
      });
    });
  }

  private handleLevel4Win() {
    this.isLevelTransitioning = true;
    this.launcher.isPlayerControlled = false;

    // Freeze physics
    this.matter.world.pause();

    this.cameras.main.flash(300, 0, 255, 136); // neon green flash
    this.cameras.main.shake(400, 0.015);

    this.time.delayedCall(500, () => {
      this.matter.world.resume();
      this.clearAllBoardBalls(true);
      
      this.playVictorySound();
      
      this.time.delayedCall(1000, () => {
        this.playSeamlessTransition(3);
      });
    });
  }

  private updateCeilingPressure(delta: number) {
    if (this.isLevelTransitioning || this.isGameOver) {
      if (this.pressureText) this.pressureText.setVisible(false);
      return;
    }

    if (!this.pressureText) {
      this.pressureText = this.add.text(GAME_WIDTH / 2, OVERFLOW_Y - 20, 'DANGER INCOMING: 15s', {
        fontFamily: '"Orbitron", monospace',
        fontSize: '14px',
        color: '#ff2244',
        fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(30);
    } else {
      this.pressureText.setVisible(true);
    }

    const cfg = this.getCeilingPressureConfig();
    this.ceilingTimer -= delta;
    if (this.ceilingTimer <= 0) {
      this.ceilingTimer = cfg.interval;
      this.dynamicOverflowY = Math.min(this.containerBottom - 100, this.dynamicOverflowY + cfg.step);
      this.cameras.main.shake(150, 0.005);
      this.floatingText.show(GAME_WIDTH / 2, this.dynamicOverflowY + 20, 'WARNING: DANGER LINE DROPPED!', '#ff2244', 20, 1000);
    }

    const secLeft = Math.ceil(this.ceilingTimer / 1000);
    this.pressureText.setText(`DANGER INCOMING: ${secLeft}s`);
    this.pressureText.setPosition(GAME_WIDTH / 2, this.dynamicOverflowY - 20);
  }

}
