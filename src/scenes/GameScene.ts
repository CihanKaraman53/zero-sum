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

import { HUD } from '../ui/HUD';
import { NextQueue } from '../ui/NextQueue';

import { 
  BALL_POOL_SIZE, CONTAINER_LEFT, CONTAINER_RIGHT, 
  CONTAINER_BOTTOM, CONTAINER_TOP, FIXED_TIMESTEP,
  GAME_WIDTH, GAME_HEIGHT
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

  // UI
  private hud!: HUD;
  private nextQueue!: NextQueue;

  // State
  private isGameOver: boolean = false;
  private fixedAccumulator: number = 0;

  constructor() {
    super('GameScene');
  }

  create() {
    this.isGameOver = false;
    this.fixedAccumulator = 0;

    // 1. Initialize Effects (Rendered behind or above physics depending on depth)
    this.background = new Background(this);
    this.particles = new ParticleManager(this);
    this.floatingText = new FloatingText(this);

    // 2. Initialize Core Systems
    this.scoring = new ScoringSystem();
    this.combo = new ComboSystem(() => this.blackHoleSys.trigger());
    this.levelManager = new LevelManager(this.scoring);
    
    // 3. Initialize Pools
    this.ballPool = new ObjectPool<JellyBall>(
      () => new JellyBall(this),
      (b) => b.deactivate(),
      BALL_POOL_SIZE
    );

    // 4. Initialize Launcher
    this.launcher = new Launcher(this);
    this.launcher.setSpeed(this.levelManager.getLauncherSpeed());
    this.launcher.setPreview(
      this.levelManager.getQueue()[0].value, 
      this.levelManager.getQueue()[0].special
    );

    // 5. Initialize Mechanics Systems
    this.collisionSys = new CollisionSystem(
      this, this.ballPool, this.particles, this.floatingText, this.scoring, this.combo
    );
    this.blackHoleSys = new BlackHoleSystem(this, this.ballPool, this.particles, this.scoring);
    this.overflowSys = new OverflowSystem(this, this.ballPool, () => this.handleGameOver());

    // Callbacks for level progression
    this.collisionSys.onFusion = (value: number) => this.levelManager.registerFusion(value);
    this.collisionSys.onBallDestroyed = () => this.levelManager.registerDestroyedBall(false); // Can improve to pass if frozen

    // 6. Setup Container Walls (Matter Static Bodies)
    this.setupWalls();

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
  }

  update(time: number, delta: number) {
    if (this.isGameOver) return;

    // Fixed timestep integration for smooth physics regardless of framerate
    this.fixedAccumulator += delta;
    while (this.fixedAccumulator >= FIXED_TIMESTEP) {
      // Step systems that require fixed logic
      this.background.update(time);
      this.launcher.update(time, null); // Pointer move handled separately
      this.particles.update(FIXED_TIMESTEP);
      this.combo.update(time);
      this.blackHoleSys.update(FIXED_TIMESTEP);
      this.overflowSys.update(FIXED_TIMESTEP);

      // Level Progression Check
      if (this.levelManager.checkWinCondition()) {
        this.levelManager.nextLevel();
        this.launcher.setSpeed(this.levelManager.getLauncherSpeed());
        this.floatingText.show(GAME_WIDTH/2, GAME_HEIGHT/2, 'LEVEL UP!', '#00ff88', 36, 1500);
      }

      this.hud.setComboActive(this.combo.getMultiplier());
      this.hud.update();

      // Clear collision processed flags for the next step
      this.collisionSys.clearProcessed();

      this.fixedAccumulator -= FIXED_TIMESTEP;
    }

    // Uncapped interpolation updates
    const activeBalls = this.ballPool.getActiveItems();
    activeBalls.forEach(ball => ball.syncPosition());
  }

  private handleInputDrop(pointer: Phaser.Input.Pointer) {
    if (this.isGameOver) return;

    if (this.launcher.tryDrop(this.time.now)) {
      // Get ball from queue
      const dropItem = this.levelManager.consumeNextDrop();
      
      // Spawn ball
      const ball = this.ballPool.acquire();
      if (ball) {
        ball.activate(this.launcher.getX(), this.launcher.getDropY(), dropItem.value, dropItem.special);
      }

      // Update launcher preview
      const nextInQueue = this.levelManager.getQueue()[0];
      this.launcher.setPreview(nextInQueue.value, nextInQueue.special);
      this.nextQueue.update();
    }
  }

  private handlePointerMove(pointer: Phaser.Input.Pointer) {
    if (this.isGameOver) return;
    this.launcher.isPlayerControlled = true;
    this.launcher.x = Phaser.Math.Clamp(pointer.x, CONTAINER_LEFT + 30, CONTAINER_RIGHT - 30);
  }

  private setupWalls() {
    const wallOpts = { isStatic: true, restitution: 0.2, friction: 0.1 };
    
    // Bottom
    this.matter.add.rectangle(
      (CONTAINER_LEFT + CONTAINER_RIGHT) / 2, 
      CONTAINER_BOTTOM + 50, 
      CONTAINER_RIGHT - CONTAINER_LEFT, 
      100, 
      wallOpts
    );
    // Left
    this.matter.add.rectangle(CONTAINER_LEFT - 50, GAME_HEIGHT / 2, 100, GAME_HEIGHT, wallOpts);
    // Right
    this.matter.add.rectangle(CONTAINER_RIGHT + 50, GAME_HEIGHT / 2, 100, GAME_HEIGHT, wallOpts);
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
}
