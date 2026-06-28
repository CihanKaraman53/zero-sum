import Phaser from 'phaser';
import {
  CURE_L1_LAUNCHER_Y,
  CURE_L1_PLAY_WIDTH,
  CURE_L1_QUEST_REQUIRED,
  CURE_L1_QUEST_TARGET,
  CURE_L1_QUEST_WIDTH,
  GAME_HEIGHT,
  GAME_WIDTH,
} from '../core/Constants';

/**
 * Level 1 only — Zero Cure screenshot layout (title, play chrome, quest panel).
 * Does not change win rules; purely visual shell.
 */
export class CureLevel1UI {
  private readonly root: Phaser.GameObjects.Container;
  private readonly counterText: Phaser.GameObjects.Text;
  private collected = 0;

  constructor(scene: Phaser.Scene) {
    this.root = scene.add.container(0, 0).setDepth(5);

    this.root.add(
      scene.add
        .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x030308)
        .setDepth(-2),
    );

    this.root.add(
      scene.add
        .rectangle(CURE_L1_PLAY_WIDTH / 2, GAME_HEIGHT / 2, CURE_L1_PLAY_WIDTH, GAME_HEIGHT, 0x06060b)
        .setDepth(-1),
    );

    const panelX = CURE_L1_PLAY_WIDTH + CURE_L1_QUEST_WIDTH / 2;
    this.root.add(
      scene.add
        .rectangle(panelX, GAME_HEIGHT / 2, CURE_L1_QUEST_WIDTH - 6, GAME_HEIGHT - 28, 0x0a0a12, 0.98)
        .setStrokeStyle(2, 0x334155),
    );

    this.root.add(
      scene.add.rectangle(CURE_L1_PLAY_WIDTH, GAME_HEIGHT / 2, 2, GAME_HEIGHT, 0x334155),
    );

    const arenaGfx = scene.add.graphics();
    arenaGfx.lineStyle(2, 0x334155, 1);
    arenaGfx.strokeRect(14, 14, CURE_L1_PLAY_WIDTH - 28, GAME_HEIGHT - 28);
    arenaGfx.lineStyle(1, 0x475569, 0.35);
    arenaGfx.strokeLineShape(
      new Phaser.Geom.Line(14, CURE_L1_LAUNCHER_Y + 18, CURE_L1_PLAY_WIDTH - 14, CURE_L1_LAUNCHER_Y + 18),
    );
    this.root.add(arenaGfx);

    this.root.add(
      scene.add
        .text(CURE_L1_PLAY_WIDTH / 2, 28, 'ZERO CURE', {
          fontFamily: 'system-ui, -apple-system, sans-serif',
          fontSize: '20px',
          color: '#cbd5e1',
          fontStyle: 'bold',
        })
        .setOrigin(0.5),
    );

    this.root.add(
      scene.add
        .text(panelX, 40, 'QUEST', {
          fontFamily: 'system-ui, -apple-system, sans-serif',
          fontSize: '13px',
          color: '#94a3b8',
          fontStyle: 'bold',
        })
        .setOrigin(0.5),
    );

    const questY = GAME_HEIGHT / 2 - 20;
    const questSprite = scene.add.sprite(panelX, questY, 'positive_ball');
    questSprite.setDisplaySize(72, 72);
    this.root.add(questSprite);

    this.root.add(
      scene.add
        .text(panelX, questY, `+${CURE_L1_QUEST_TARGET}`, {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '18px',
          color: '#ffffff',
          fontStyle: 'bold',
          stroke: '#000000',
          strokeThickness: 3,
        })
        .setOrigin(0.5),
    );

    this.counterText = scene.add
      .text(panelX, questY + 52, `0/${CURE_L1_QUEST_REQUIRED}`, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '18px',
        color: '#4ade80',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    this.root.add(this.counterText);

    scene.tweens.add({
      targets: questSprite,
      y: questY - 5,
      duration: 1400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  /** Tutorial milestones — visual quest counter only. */
  setProgress(step: number): void {
    this.collected = Phaser.Math.Clamp(step, 0, CURE_L1_QUEST_REQUIRED);
    this.counterText.setText(`${this.collected}/${CURE_L1_QUEST_REQUIRED}`);
  }

  destroy(): void {
    this.root.destroy(true);
  }
}
