import Phaser from 'phaser';
import {
  CURE_L1_LAUNCHER_Y,
  CURE_L1_UI_CENTER_Y,
  CURE_L1_UI_HEIGHT,
  CURE_L1_UI_TOP,
  CURE_PLAY_PANEL_ALPHA,
  CURE_QUEST_PANEL_ALPHA,
  GAME_HEIGHT,
  getCureUILayout,
} from '../core/Constants';
import type { JellyBall } from '../entities/JellyBall';
import type { ObjectPool } from '../core/ObjectPool';
import type { ParticleManager } from '../effects/ParticleManager';
import {
  applyBallLabelStyle, factionTexture, GREEN_THROWABLE_TEXTURE,
  scaleForThrowableTexture, applyThrowableLabel, throwableLabelFontSize, THROWABLE_LABEL_FONT,
} from '../entities/BallEntity';
import { getBallVisualRadius } from '../core/Constants';
import type { DropQueueItem } from '../systems/LevelManager';
import type { LevelLayout, LevelQuest } from '../data/levels';
import type { LevelManager } from '../systems/LevelManager';
import { CureQuestBottle } from './CureQuestBottle';

const CURE_BLUE = 0x3888ec;
const UPCOMING_BALL_PX = 32;
/** Zaman çubuğu (~26–33px) altında, üst üste binmeden. */
const QUEST_UPCOMING_Y = CURE_L1_UI_TOP + 62;
const BOTTLE_DISPLAY_FULL = 160;
const BOTTLE_DISPLAY_COMPACT = 108;

interface PendingHarvest {
  ball: JellyBall;
  bottle: CureQuestBottle;
  onComplete: () => void;
}

/**
 * Zero Cure — play arena + quest panel (one or two bottles).
 */
export class CureLevel1UI {
  private readonly scene: Phaser.Scene;
  private readonly particles: ParticleManager | null;
  private readonly root: Phaser.GameObjects.Container;
  private readonly layout: ReturnType<typeof getCureUILayout>;
  private readonly bottles: CureQuestBottle[] = [];
  /** Wide / dual-bottle chapters — same perf shell as L1 FPS test (opaque panels, no liquid mask). */
  private readonly perfLite: boolean;
  private upcomingRoot!: Phaser.GameObjects.Container;
  private readonly upcomingSlots: {
    root: Phaser.GameObjects.Container;
    glow: Phaser.GameObjects.Arc;
    sprite: Phaser.GameObjects.Sprite;
    label: Phaser.GameObjects.Text;
    lastKey: string;
  }[] = [];
  private harvesting = false;
  private readonly pendingHarvests: PendingHarvest[] = [];
  private readonly levelManager: LevelManager | null;
  private readonly onPhaseTransitionComplete: (() => void) | null;

  constructor(
    scene: Phaser.Scene,
    quests: LevelQuest[],
    layout: LevelLayout,
    dualBottles = false,
    particles?: ParticleManager,
    levelManager?: LevelManager,
    onPhaseTransitionComplete?: () => void,
  ) {
    this.scene = scene;
    this.particles = particles ?? null;
    this.levelManager = levelManager ?? null;
    this.onPhaseTransitionComplete = onPhaseTransitionComplete ?? null;
    this.perfLite = dualBottles;
    this.layout = getCureUILayout(layout);
    this.root = scene.add.container(0, 0).setDepth(1);

    this.drawArena(scene);

    const panelX = this.layout.questCenterX;
    const displaySize = dualBottles ? BOTTLE_DISPLAY_COMPACT : BOTTLE_DISPLAY_FULL;

    if (dualBottles && quests.length >= 2) {
      const positions = [GAME_HEIGHT * 0.30, GAME_HEIGHT * 0.62];
      for (let i = 0; i < quests.length; i++) {
        const q = quests[i];
        this.bottles.push(new CureQuestBottle(
          scene, this.root, panelX, positions[i], q.target, q.required, displaySize, particles, false,
        ));
      }
    } else {
      const sequential = this.levelManager?.isSequentialPhases() ?? false;
      const q = sequential ? this.levelManager!.getActiveQuest() : quests[0];
      const maxSlots = sequential ? Math.max(...quests.map((quest) => quest.required)) : q.required;
      this.bottles.push(new CureQuestBottle(
        scene, this.root, panelX, GAME_HEIGHT / 2 - 8, q.target, q.required, displaySize, particles,
        true, maxSlots,
      ));
    }

    this.buildUpcomingQueue(scene);
  }

  private buildUpcomingQueue(scene: Phaser.Scene): void {
    this.upcomingRoot = scene.add.container(this.layout.questCenterX, QUEST_UPCOMING_Y).setDepth(5);
    const slotRoot = scene.add.container(0, 0);
    const glow = scene.add.circle(0, 0, UPCOMING_BALL_PX * 0.52, CURE_BLUE, 0.14);
    glow.setBlendMode(Phaser.BlendModes.ADD);
    const sprite = scene.add.sprite(0, 0, GREEN_THROWABLE_TEXTURE);
    sprite.setAlpha(0.88);
    const label = scene.add.text(0, 0, '', {
      fontFamily: THROWABLE_LABEL_FONT,
      fontSize: '16px',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    applyBallLabelStyle(label, 'green');
    slotRoot.add([glow, sprite, label]);
    this.upcomingRoot.add(slotRoot);
    this.upcomingSlots.push({ root: slotRoot, glow, sprite, label, lastKey: '' });
    this.root.add(this.upcomingRoot);
  }

  updateUpcomingQueue(queue: DropQueueItem[]): void {
    const item = queue[1];
    const slot = this.upcomingSlots[0];
    if (!item) {
      if (slot.lastKey !== '__hidden') {
        slot.root.setVisible(false);
        slot.lastKey = '__hidden';
      }
      return;
    }
    const key = `${item.value}|${item.special ?? ''}|${item.faction}`;
    if (key === slot.lastKey) return;
    slot.lastKey = key;
    slot.root.setVisible(true);
    this.applyThrowablePreview(slot.sprite, slot.label, item, UPCOMING_BALL_PX);
    slot.glow.setRadius(UPCOMING_BALL_PX * 0.52);
  }

  private applyThrowablePreview(
    sprite: Phaser.GameObjects.Sprite,
    label: Phaser.GameObjects.Text,
    item: DropQueueItem,
    targetPx: number,
  ): void {
    if (item.special) {
      sprite.setTexture(item.special === 'multiply' ? 'x2_ball' : item.special === 'blast' ? 'blast_ball' : item.special === 'slice' ? 'slice_ball' : 'dice_ball');
      sprite.clearTint();
      label.setText(item.special === 'multiply' ? '×2' : '');
      sprite.setScale(targetPx / sprite.frame.width);
      return;
    }
    const absVal = Math.abs(item.value);
    sprite.clearTint();
    const visualR = getBallVisualRadius(absVal);
    const tex = factionTexture(item.faction);
    sprite.setScale(scaleForThrowableTexture(tex, visualR) * (targetPx / (visualR * 2)));
    label.setVisible(true);
    const prefix = item.value > 0 ? '+' : '';
    label.setText(`${prefix}${item.value}`);
    label.setFontSize(throwableLabelFontSize(visualR, absVal));
    applyBallLabelStyle(label, item.faction);
    applyThrowableLabel(label, visualR);
  }

  private drawArena(scene: Phaser.Scene): void {
    const borderColor = 0xe8d5a8;
    const playBg = scene.add
      .rectangle(this.layout.arenaCenterX, CURE_L1_UI_CENTER_Y, this.layout.arenaWidth, CURE_L1_UI_HEIGHT, 0x0a1610, CURE_PLAY_PANEL_ALPHA)
      .setStrokeStyle(3, borderColor, 0.92);
    this.root.add(playBg);

    const arenaGfx = scene.add.graphics().setDepth(2);
    const spawnLineY = CURE_L1_LAUNCHER_Y + 40;
    arenaGfx.lineStyle(2, 0xffefd0, 0.62);
    arenaGfx.beginPath();
    arenaGfx.moveTo(this.layout.arenaLeft + 4, spawnLineY);
    arenaGfx.lineTo(this.layout.arenaRight - 4, spawnLineY);
    arenaGfx.strokePath();
    this.root.add(arenaGfx);

    const panelBg = scene.add
      .rectangle(this.layout.questCenterX, CURE_L1_UI_CENTER_Y, this.layout.questWidth, CURE_L1_UI_HEIGHT, 0x101a14, CURE_QUEST_PANEL_ALPHA)
      .setStrokeStyle(3, borderColor, 0.92);
    this.root.add(panelBg);
  }

  getCollected(): number {
    return this.bottles.reduce((sum, b) => sum + b.getCollected(), 0);
  }

  areAllQuestsComplete(): boolean {
    if (this.levelManager?.isSequentialPhases()) {
      const bottle = this.bottles[0];
      return !this.levelManager.hasMorePhases() && bottle.isComplete();
    }
    return this.bottles.every((b) => b.isComplete());
  }

  isHarvesting(): boolean {
    return this.harvesting;
  }

  /**
   * Faz değişince tahtada hazır duran hedef topları şişeye al
   * (ör. +16 fazında oluşmuş −32, −32 fazı açılınca sayılsın).
   */
  harvestMatchingBoardBalls(
    ballPool: ObjectPool<JellyBall>,
    onBallHarvested: (ball: JellyBall) => void,
  ): void {
    if (this.harvesting) {
      this.scene.time.delayedCall(80, () => this.harvestMatchingBoardBalls(ballPool, onBallHarvested));
      return;
    }

    const list = ballPool.getActiveList();
    const count = ballPool.getActiveCount();

    for (let i = 0; i < count; i++) {
      const ball = list[i];
      if (!ball.active || ball.harvesting) continue;
      const bottle = this.bottles.find((b) => b.canAccept(ball.value));
      if (!bottle) continue;

      this.harvestFromBall(ball, () => {
        onBallHarvested(ball);
        this.harvestMatchingBoardBalls(ballPool, onBallHarvested);
      });
      return;
    }
  }

  harvestFromBall(ball: JellyBall, onComplete: () => void): void {
    const bottle = this.bottles.find((b) => b.canAccept(ball.value));
    if (!bottle || !ball.active) {
      onComplete();
      return;
    }

    if (this.harvesting) {
      ball.prepareHarvest();
      ball.container.setDepth(44);
      this.pendingHarvests.push({ ball, bottle, onComplete });
      return;
    }

    this.runHarvest(ball, bottle, onComplete);
  }

  private runHarvest(ball: JellyBall, bottle: CureQuestBottle, onComplete: () => void): void {
    this.harvesting = true;
    if (ball.body) {
      ball.container.setPosition(ball.body.position.x, ball.body.position.y);
    }
    ball.prepareHarvest();
    const target = bottle.getHarvestTarget();
    const startX = ball.container.x;
    const startY = ball.container.y;
    const startScaleX = ball.container.scaleX;
    const startScaleY = ball.container.scaleY;
    const arcPeakY = Math.min(startY, target.y) - 90;

    ball.playHarvestPulse(() => {
      if (!ball.active) {
        this.finishHarvest(onComplete);
        return;
      }

      ball.container.setDepth(45);
      const flight = { t: 0 };

      this.scene.tweens.add({
        targets: flight,
        t: 1,
        duration: 720,
        ease: 'Cubic.easeIn',
        onUpdate: () => {
          const t = flight.t;
          const u = 1 - t;
          ball.container.x = u * u * startX + 2 * u * t * ((startX + target.x) / 2) + t * t * target.x;
          ball.container.y = u * u * startY + 2 * u * t * arcPeakY + t * t * target.y;
          ball.container.setScale(startScaleX * (1 - t * 0.55), startScaleY * (1 - t * 0.55));
          ball.container.setAlpha(1 - t * 0.85);
        },
        onComplete: () => {
          bottle.onHarvestComplete();
          ball.deactivate();
          bottle.incrementProgress();

          if (this.levelManager?.isSequentialPhases() && bottle.isComplete() && this.levelManager.hasMorePhases()) {
            this.levelManager.advancePhase();
            const next = this.levelManager.getActiveQuest();
            bottle.transitionPhase(next.target, next.required, () => {
              this.finishHarvest(() => {
                onComplete();
                this.onPhaseTransitionComplete?.();
              });
            });
            return;
          }

          this.finishHarvest(onComplete);
        },
      });
    });
  }

  private finishHarvest(onComplete: () => void): void {
    onComplete();
    if (this.pendingHarvests.length === 0) {
      this.harvesting = false;
      return;
    }
    const next = this.pendingHarvests.shift()!;
    if (!next.ball.active) {
      next.onComplete();
      this.finishHarvest(() => {});
      return;
    }
    this.runHarvest(next.ball, next.bottle, next.onComplete);
  }

  destroy(): void {
    for (const b of this.bottles) b.destroy();
    this.root.destroy(true);
  }
}
