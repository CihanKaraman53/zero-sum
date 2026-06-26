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
import { GeyserSystem } from '../systems/GeyserSystem';

import { HUD } from '../ui/HUD';
import { NextQueue } from '../ui/NextQueue';

import { 
  BALL_POOL_SIZE, CONTAINER_LEFT, CONTAINER_RIGHT, 
  CONTAINER_BOTTOM, CONTAINER_TOP, FIXED_TIMESTEP,
  GAME_WIDTH, GAME_HEIGHT, OVERFLOW_Y
} from '../core/Constants';

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

  private readonly LEVEL_WIDTHS = [
    75,   // Level 1
    155,  // Level 2 (2 grid slots wider)
    235,  // Level 3 (2 grid slots wider than L2: +80px)
    400,  // Level 4 (Maximum Width)
    400,  // Level 5
    400,  // Level 6
    400,  // Level 7
    400,  // Level 8
    400,  // Level 9
    400   // Level 10
  ];

  constructor() {
    super('GameScene');
  }

  create(data?: { levelIndex?: number }) {
    this.isGameOver = false;
    this.isLevelTransitioning = false;
    this.fixedAccumulator = 0;
    this.dynamicOverflowY = OVERFLOW_Y;
    this.ceilingTimer = 15000;
    if (this.pressureText) {
      this.pressureText.destroy();
      this.pressureText = undefined;
    }

    // 1. Initialize Effects (Rendered behind or above physics depending on depth)
    this.background = new Background(this);
    this.particles = new ParticleManager(this);
    this.floatingText = new FloatingText(this);

    // 2. Initialize Core Systems
    this.scoring = new ScoringSystem(this);
    this.combo = new ComboSystem(this, () => this.blackHoleSys.trigger());
    this.levelManager = new LevelManager(this.scoring);
    this.levelManager.getActiveBallValues = () => {
      return Array.from(this.ballPool.getActiveItems()).map(b => b.value);
    };
    if (data && typeof data.levelIndex === 'number') {
      this.levelManager.loadLevel(data.levelIndex);
    }

    // Dynamic Sizing Initialisation
    const lvlIdx = this.levelManager.currentLevelIndex;
    const targetWidth = this.LEVEL_WIDTHS[Math.min(lvlIdx, this.LEVEL_WIDTHS.length - 1)];
    const startWidth = lvlIdx === 0 ? targetWidth : this.LEVEL_WIDTHS[Math.min(lvlIdx - 1, this.LEVEL_WIDTHS.length - 1)];
    const targetBottom = CONTAINER_BOTTOM;
    const startBottom = CONTAINER_BOTTOM;
    const cx = GAME_WIDTH / 2;
    this.containerLeft = cx - startWidth / 2;
    this.containerRight = cx + startWidth / 2;
    this.containerBottom = startBottom;
    
    // 3. Initialize Pools
    this.ballPool = new ObjectPool<JellyBall>(
      () => new JellyBall(this),
      (b) => b.deactivate(),
      BALL_POOL_SIZE
    );

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

    // Callbacks for level progression
    this.collisionSys.onFusion = (value: number) => {
      this.levelManager.registerFusion(value);
      
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

    this.collisionSys.onBallDestroyed = (wasFrozen: boolean) => this.levelManager.registerDestroyedBall(wasFrozen);

    this.collisionSys.onZeroSum = (absVal: number) => {
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
      // Danger line Y-drop disabled for Level 4
    };

    // 6. Setup Container Walls (Matter Static Bodies)
    this.setupWalls();

    // Wall width & height progression tween
    if (lvlIdx > 0 && (startWidth !== targetWidth || startBottom !== targetBottom)) {
      const boundsObj = { w: startWidth, h: startBottom };
      this.tweens.add({
        targets: boundsObj,
        w: targetWidth,
        h: targetBottom,
        duration: 1000,
        ease: 'Cubic.easeOut',
        onUpdate: () => {
          const halfW = boundsObj.w / 2;
          this.containerLeft = cx - halfW;
          this.containerRight = cx + halfW;
          this.containerBottom = boundsObj.h;

          // Update Matter physics wall positions
          if (this.leftWall) {
            this.matter.body.setPosition(this.leftWall as any, { x: this.containerLeft - 50, y: GAME_HEIGHT / 2 });
          }
          if (this.rightWall) {
            this.matter.body.setPosition(this.rightWall as any, { x: this.containerRight + 50, y: GAME_HEIGHT / 2 });
          }
          if (this.bottomWall) {
            this.matter.body.setPosition(this.bottomWall as any, { x: GAME_WIDTH / 2, y: this.containerBottom + 50 });
          }

          // Update Background
          this.background.updateContainerBounds(this.containerLeft, this.containerRight, this.containerBottom);

          // Update Launcher
          this.launcher.updateBounds(this.containerLeft + 30, this.containerRight - 30);
        }
      });
    } else {
      this.background.updateContainerBounds(this.containerLeft, this.containerRight, this.containerBottom);
      this.launcher.updateBounds(this.containerLeft + 30, this.containerRight - 30);
    }

    // 7. Setup UI
    this.hud = new HUD(this, this.scoring, this.levelManager);
    this.nextQueue = new NextQueue(this, this.levelManager);

    // 8. Input Handling
    this.input.on('pointerdown', this.handleInputDrop, this);
    this.input.on('pointermove', this.handlePointerMove, this);

    // Spawn preplaced level objects if any
    this.spawnPreplacedBalls();

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

    if (this.levelManager.currentLevelIndex > 3) {
      this.updateCeilingPressure(delta);
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

    // Fixed timestep integration for smooth physics regardless of framerate
    this.fixedAccumulator += delta;
    while (this.fixedAccumulator >= FIXED_TIMESTEP) {
      // Step systems that require fixed logic
      this.background.update(time);
      if (!this.isLevelTransitioning) {
        this.launcher.update(time, null); // Pointer move handled separately
      }
      this.particles.update(FIXED_TIMESTEP);
      this.combo.update(time);
      this.blackHoleSys.update(FIXED_TIMESTEP);

      // Disable overflow gameover timer for Level 1 (Tutorial)
      if (this.levelManager.currentLevelIndex !== 0) {
        this.overflowSys.update(FIXED_TIMESTEP);
      }

      // Clear collision processed flags for the next step
      this.collisionSys.clearProcessed();

      this.fixedAccumulator -= FIXED_TIMESTEP;
    }

    // Uncapped interpolation updates
    const activeBalls = this.ballPool.getActiveItems();
    activeBalls.forEach(ball => ball.syncPosition());

    // Update geyser system if in Level 5
    if (this.levelManager.currentLevelIndex === 4 && !this.isLevelTransitioning && !this.isGameOver) {
      this.geyserSys.setVisible(true);
      this.geyserSys.update(time, delta);
    } else {
      this.geyserSys.setVisible(false);
    }

    // Tutorial dynamic visual updates
    if (this.levelManager.currentLevelIndex === 0) {
      if (this.tutorialStep === 2 && this.tutorialArrow) {
        const balls = this.ballPool.getActiveItems();
        let ball2: JellyBall | undefined;
        for (const b of balls) {
          if (b.value === 2) {
            ball2 = b;
            break;
          }
        }
        if (ball2 && ball2.body) {
          this.tutorialArrow.setPosition(ball2.body.position.x, ball2.body.position.y - 50);
          this.tutorialArrow.setVisible(true);
        } else {
          this.tutorialArrow.setVisible(false);
        }
      } else if (this.tutorialStep === 4) {
        const balls = this.ballPool.getActiveItems();
        let ball8: JellyBall | undefined;
        for (const b of balls) {
          if (b.value === 8) {
            ball8 = b;
            break;
          }
        }
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
        const balls = this.ballPool.getActiveItems();
        let ball16: JellyBall | undefined;
        for (const b of balls) {
          if (Math.abs(b.value) === 16) {
            ball16 = b;
            break;
          }
        }
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

  private handleInputDrop(pointer: Phaser.Input.Pointer) {
    if (this.isGameOver || this.isLevelTransitioning) return;


    if (this.launcher.tryDrop(this.time.now)) {
      // Get ball from queue
      const dropItem = this.levelManager.consumeNextDrop();
      
      // Spawn ball
      const ball = this.ballPool.acquire();
      if (ball) {
        ball.activate(this.launcher.getX(), this.launcher.getDropY(), dropItem.value, dropItem.special);
      }

      // Tutorial Step 1 progress
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

      // Update launcher preview
      const nextInQueue = this.levelManager.getQueue()[0];
      this.launcher.setPreview(nextInQueue.value, nextInQueue.special);
      this.nextQueue.update();
    }
  }

  private handlePointerMove(pointer: Phaser.Input.Pointer) {
    if (this.isGameOver || this.isLevelTransitioning) return;
    if (this.levelManager.currentLevelIndex === 0) return; // Disable launcher dragging in Level 1
    this.launcher.isPlayerControlled = true;
    this.launcher.x = Phaser.Math.Clamp(pointer.x, this.containerLeft + 30, this.containerRight - 30);
  }

  private setupWalls() {
    const wallOpts = { isStatic: true, restitution: 0.2, friction: 0.1 };
    
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

  private spawnPreplacedBalls() {
    const preplaced = this.levelManager.currentLevel.preplacedBalls;
    if (preplaced) {
      preplaced.forEach(p => {
        const ball = this.ballPool.acquire();
        if (ball) {
          ball.activate(p.x, p.y, p.value, null, p.frozen);
        }
      });
    }
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
        highScore: this.scoring.highScore 
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
          this.scene.restart({ levelIndex: nextLvlIndex });
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
      console.warn("AudioContext error/blocked:", e);
    }
  }

  private handleLevelWin() {
    this.isLevelTransitioning = true;
    this.launcher.isPlayerControlled = false;

    // Clear any remaining balls with satisfying particle burst
    const activeBalls = this.ballPool.getActiveItems();
    activeBalls.forEach(ball => {
      if (ball.active && ball.body) {
        const px = ball.body.position.x;
        const py = ball.body.position.y;
        const color = ball.sign > 0 ? 0x00ff88 : 0xff3388;
        this.particles.burst(px, py, color, 12, 1.5, 300);
        ball.deactivate();
        this.ballPool.release(ball);
      }
    });

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
      this.showLevel5TeaserMenu();
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

          // 5. Play a smooth hydraulic/lazer tween animation expanding the left and right energy walls outward.
          const startW = this.LEVEL_WIDTHS[Math.min(fromLevelIndex, this.LEVEL_WIDTHS.length - 1)];
          const targetW = this.LEVEL_WIDTHS[Math.min(fromLevelIndex + 1, this.LEVEL_WIDTHS.length - 1)];
          const boundsObj = { w: startW };
          
          this.tweens.add({
            targets: boundsObj,
            w: targetW,
            duration: 1000,
            ease: 'Cubic.easeOut',
            onUpdate: () => {
              const halfW = boundsObj.w / 2;
              this.containerLeft = cx - halfW;
              this.containerRight = cx + halfW;
              
              // Update Matter physics wall positions
              if (this.leftWall) {
                this.matter.body.setPosition(this.leftWall as any, { x: this.containerLeft - 50, y: GAME_HEIGHT / 2 });
              }
              if (this.rightWall) {
                this.matter.body.setPosition(this.rightWall as any, { x: this.containerRight + 50, y: GAME_HEIGHT / 2 });
              }
              
              // Update Background visual representation
              this.background.updateContainerBounds(this.containerLeft, this.containerRight, this.containerBottom);

              // Update Launcher boundaries
              this.launcher.updateBounds(this.containerLeft + 30, this.containerRight - 30);
            },
            onComplete: () => {
              // 6. Fade out the dark overlay.
              this.tweens.add({
                targets: overlay,
                alpha: 0,
                duration: 300,
                onComplete: () => {
                  overlay.destroy();
                  
                  // Setup next level on levelManager (without reloading scene)
                  this.levelManager.nextLevel();
                  
                  // Update HUD and queue visuals
                  this.hud.update();
                  this.nextQueue.update();

                  // Unfreeze launcher controls
                  this.isLevelTransitioning = false;
                  this.launcher.isPlayerControlled = true;
                  this.launcher.setSpeed(this.levelManager.getLauncherSpeed());
                  
                  // Set launcher's next ball preview from levelManager's current queue
                  const nextInQueue = this.levelManager.getQueue()[0];
                  this.launcher.setPreview(nextInQueue.value, nextInQueue.special);
                }
              });
            }
          });
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
      const startW = this.LEVEL_WIDTHS[2]; // Level 3 width (235)
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

  private handleLevel4Win() {
    this.isLevelTransitioning = true;
    this.launcher.isPlayerControlled = false;

    // Freeze physics
    this.matter.world.pause();

    this.cameras.main.flash(300, 0, 255, 136); // neon green flash
    this.cameras.main.shake(400, 0.015);

    this.time.delayedCall(500, () => {
      this.matter.world.resume();
      const activeBalls = this.ballPool.getActiveItems();
      activeBalls.forEach(ball => {
        if (ball.active && ball.body) {
          const px = ball.body.position.x;
          const py = ball.body.position.y;
          this.particles.burst(px, py, 0x00ff88, 15, 2.5, 450);
          ball.deactivate();
          this.ballPool.release(ball);
        }
      });
      
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

    this.ceilingTimer -= delta;
    if (this.ceilingTimer <= 0) {
      this.ceilingTimer = 15000;
      this.dynamicOverflowY = Math.min(this.containerBottom - 100, this.dynamicOverflowY + 20);
      this.cameras.main.shake(150, 0.005);
      this.floatingText.show(GAME_WIDTH / 2, this.dynamicOverflowY + 20, 'WARNING: DANGER LINE DROPPED!', '#ff2244', 20, 1000);
    }

    const secLeft = Math.ceil(this.ceilingTimer / 1000);
    this.pressureText.setText(`DANGER INCOMING: ${secLeft}s`);
    this.pressureText.setPosition(GAME_WIDTH / 2, this.dynamicOverflowY - 20);
  }

  private showLevel5TeaserMenu() {
    this.isLevelTransitioning = true;
    this.launcher.isPlayerControlled = false;
    this.matter.world.pause();

    const teaserGroup = this.add.group();
    
    // 1. Cyberpunk translucent overlay
    const overlay = this.add.graphics().setDepth(150);
    overlay.fillStyle(0x050512, 0.88);
    overlay.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    overlay.setAlpha(0);
    teaserGroup.add(overlay);
    this.tweens.add({
      targets: overlay,
      alpha: 1,
      duration: 400
    });

    // 2. Main Title Text
    const titleText = this.add.text(GAME_WIDTH / 2, 70, "TRAINING COMPLETE!", {
      fontFamily: '"Orbitron", monospace',
      fontSize: '26px',
      color: '#ff0077',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(151);
    titleText.setShadow(0, 0, '#ff0077', 8, true, true);

    const subTitleText = this.add.text(GAME_WIDTH / 2, 105, "UNLOCKING SPECIAL ARSENAL...", {
      fontFamily: '"Orbitron", monospace',
      fontSize: '15px',
      color: '#00f0ff',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(151);
    subTitleText.setShadow(0, 0, '#00f0ff', 6, true, true);

    teaserGroup.add(titleText);
    teaserGroup.add(subTitleText);

    // 3. Grid Frames Gfx
    const framesGfx = this.add.graphics().setDepth(152);
    teaserGroup.add(framesGfx);

    const drawSlotFrame = (x: number, y: number, color: number) => {
      framesGfx.lineStyle(2, color, 1.0);
      framesGfx.strokeRoundedRect(x - 75, y - 45, 150, 90, 8);
      
      framesGfx.lineStyle(4, color, 0.4);
      framesGfx.strokeRoundedRect(x - 77, y - 47, 154, 94, 10);
    };

    // Render 4 neon slots
    drawSlotFrame(140, 220, 0xff5500); // Blast Ball (Orange)
    drawSlotFrame(340, 220, 0xff0044); // Slice Ball (Neon Red)
    drawSlotFrame(140, 350, 0xaa00ff); // Locked placeholder 1 (Purple)
    drawSlotFrame(340, 350, 0x00ffaa); // Clone Ball (Glitch Green)

    // Slot 1: Blast Ball (Glowing & Pulsing)
    const blastSprite = this.add.sprite(140, 220, 'blast_ball').setDepth(153).setDisplaySize(42, 42);
    teaserGroup.add(blastSprite);
    this.tweens.add({
      targets: blastSprite,
      y: 220 - 8,
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    const sparksTimer = this.time.addEvent({
      delay: 200,
      callback: () => {
        this.particles.burst(140, blastSprite.y, 0xff5500, 2, 1.2, 350);
      },
      loop: true
    });

    // Slot 2: Slice Ball (Glowing & Pulsing, Neon Red)
    const sliceSprite = this.add.sprite(340, 220, 'slice_ball').setDepth(153).setDisplaySize(42, 42);
    teaserGroup.add(sliceSprite);
    this.tweens.add({
      targets: sliceSprite,
      y: 220 - 8,
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    const sliceSparksTimer = this.time.addEvent({
      delay: 200,
      callback: () => {
        this.particles.burst(340, sliceSprite.y, 0xff0044, 2, 1.2, 350);
      },
      loop: true
    });

    // Slot 3: Dice Ball (Glowing & Pulsing, Neon Purple)
    const diceSprite = this.add.sprite(140, 350, 'dice_ball').setDepth(153).setDisplaySize(42, 42);
    teaserGroup.add(diceSprite);
    this.tweens.add({
      targets: diceSprite,
      y: 350 - 8,
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    const diceSparksTimer = this.time.addEvent({
      delay: 200,
      callback: () => {
        this.particles.burst(140, diceSprite.y, 0xaa00ff, 2, 1.2, 350);
      },
      loop: true
    });

    // Slot 4: Clone Ball (Glitch)
    const cloneSilhouette = this.add.sprite(340, 340, 'positive_ball').setDepth(153).setDisplaySize(38, 38).setAlpha(0.2);
    const txt4 = this.add.text(340, 375, "CLONE BALL\nLocked - Coming Soon!", {
      fontFamily: '"Orbitron", monospace',
      fontSize: '9px',
      color: '#00ffaa',
      align: 'center',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(153);
    teaserGroup.add(cloneSilhouette);
    teaserGroup.add(txt4);

    const glitchTimer = this.time.addEvent({
      delay: 150,
      callback: () => {
        const tints = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff, 0x00ffff];
        cloneSilhouette.setTint(tints[Math.floor(Math.random() * tints.length)]);
        cloneSilhouette.setAlpha(0.1 + Math.random() * 0.2);
      },
      loop: true
    });

    // Description text columns
    // Left column: Blast Ball
    const descTitleBlast = this.add.text(80, 435, "THE BLAST BALL", {
      fontFamily: '"Orbitron", monospace',
      fontSize: '9.5px',
      color: '#ff5500',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(153);
    descTitleBlast.setShadow(0, 0, '#ff5500', 6, true, true);

    const descBodyBlast = this.add.text(80, 510, 
      "Tactical clearance core.\nExplodes on impact and\nvaporizes all balls within\na tight 2x radius to save\nyou from tight spots!", {
      fontFamily: '"Orbitron", monospace',
      fontSize: '8.5px',
      color: '#cccccc',
      align: 'center',
      lineSpacing: 4
    }).setOrigin(0.5).setDepth(153);
    teaserGroup.add(descTitleBlast);
    teaserGroup.add(descBodyBlast);

    // Middle column: Slice Ball
    const descTitleSlice = this.add.text(240, 435, "THE SLICE BALL", {
      fontFamily: '"Orbitron", monospace',
      fontSize: '9.5px',
      color: '#ff0044',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(153);
    descTitleSlice.setShadow(0, 0, '#ff0044', 6, true, true);

    const descBodySlice = this.add.text(240, 510, 
      "High-tech cutting blade.\nHits any large ball and\ninstantly slices it in half\n(e.g., turns a +32 into\ntwo +16 balls) to clear\nupper grid blocks!", {
      fontFamily: '"Orbitron", monospace',
      fontSize: '8.5px',
      color: '#cccccc',
      align: 'center',
      lineSpacing: 4
    }).setOrigin(0.5).setDepth(153);
    teaserGroup.add(descTitleSlice);
    teaserGroup.add(descBodySlice);

    // Right column: Dice Ball
    const descTitleDice = this.add.text(400, 435, "THE DICE BALL", {
      fontFamily: '"Orbitron", monospace',
      fontSize: '9.5px',
      color: '#aa00ff',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(153);
    descTitleDice.setShadow(0, 0, '#aa00ff', 6, true, true);

    const descBodyDice = this.add.text(400, 510, 
      "Quantum probability core.\nHits any ball and\ntransforms it to a\nrandom value between\n-16 and +16 to shift\nthe energy of your grid!", {
      fontFamily: '"Orbitron", monospace',
      fontSize: '8.5px',
      color: '#cccccc',
      align: 'center',
      lineSpacing: 4
    }).setOrigin(0.5).setDepth(153);
    teaserGroup.add(descTitleDice);
    teaserGroup.add(descBodyDice);

    // Blinking neon action button
    const btnX = GAME_WIDTH / 2;
    const btnY = 640;
    
    const btnBg = this.add.graphics().setDepth(154);
    btnBg.fillStyle(0xff5500, 0.15);
    btnBg.lineStyle(3, 0xff5500, 1.0);
    btnBg.fillRoundedRect(btnX - 160, btnY - 25, 320, 50, 12);
    btnBg.strokeRoundedRect(btnX - 160, btnY - 25, 320, 50, 12);
    
    const btnGlow = this.add.graphics().setDepth(153);
    btnGlow.lineStyle(5, 0xff5500, 0.4);
    btnGlow.strokeRoundedRect(btnX - 162, btnY - 27, 324, 54, 14);
    
    const btnText = this.add.text(btnX, btnY, "EQUIP ARSENAL & ENTER LEVEL 6", {
      fontFamily: '"Orbitron", monospace',
      fontSize: '12px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(155);
    btnText.setShadow(0, 0, '#ff5500', 8, true, true);
    
    teaserGroup.add(btnBg);
    teaserGroup.add(btnGlow);
    teaserGroup.add(btnText);
    
    const pulseText = this.tweens.add({
      targets: btnText,
      alpha: 0.5,
      duration: 600,
      yoyo: true,
      repeat: -1
    });

    const pulseBg = this.tweens.add({
      targets: [btnBg, btnGlow],
      scaleX: 1.02,
      scaleY: 1.05,
      duration: 600,
      yoyo: true,
      repeat: -1
    });

    const clickZone = this.add.zone(btnX, btnY, 320, 50).setOrigin(0.5).setDepth(156).setInteractive({ useHandCursor: true });
    teaserGroup.add(clickZone);

    clickZone.on('pointerdown', () => {
      this.playVictorySound();
      clickZone.destroy();

      this.tweens.add({
        targets: [overlay, titleText, subTitleText, framesGfx, blastSprite, sliceSprite, diceSprite, cloneSilhouette, txt4, descTitleBlast, descBodyBlast, descTitleSlice, descBodySlice, descTitleDice, descBodyDice, btnBg, btnGlow, btnText],
        alpha: 0,
        duration: 500,
        onComplete: () => {
          sparksTimer.destroy();
          sliceSparksTimer.destroy();
          diceSparksTimer.destroy();
          glitchTimer.destroy();
          pulseText.destroy();
          pulseBg.destroy();
          teaserGroup.clear(true, true);

          this.matter.world.resume();

          // Clear board with explosion visual
          const activeBalls = this.ballPool.getActiveItems();
          activeBalls.forEach(ball => {
            if (ball.active && ball.body) {
              const px = ball.body.position.x;
              const py = ball.body.position.y;
              this.particles.burst(px, py, 0xff5500, 10, 2.0, 300);
              ball.deactivate();
              this.ballPool.release(ball);
            }
          });

          this.levelManager.nextLevel();
          this.isLevelTransitioning = false;

          const lvlIdx = this.levelManager.currentLevelIndex;
          const targetWidth = this.LEVEL_WIDTHS[Math.min(lvlIdx, this.LEVEL_WIDTHS.length - 1)];

          this.tweens.add({
            targets: { w: this.containerRight - this.containerLeft },
            w: targetWidth,
            duration: 800,
            ease: 'Cubic.easeOut',
            onUpdate: (tween, target: any) => {
              const halfW = target.w / 2;
              this.containerLeft = GAME_WIDTH / 2 - halfW;
              this.containerRight = GAME_WIDTH / 2 + halfW;
              this.background.updateContainerBounds(this.containerLeft, this.containerRight, this.containerBottom);
              this.launcher.updateBounds(this.containerLeft + 30, this.containerRight - 30);
            },
            onComplete: () => {
              this.launcher.isPlayerControlled = true;
              const nextInQueue = this.levelManager.getQueue()[0];
              this.launcher.setPreview(nextInQueue.value, nextInQueue.special);
              this.nextQueue.update();
              this.hud.update();
              this.spawnPreplacedBalls();
            }
          });
        }
      });
    });
  }

}
