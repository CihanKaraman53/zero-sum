import Phaser from 'phaser';
import { ScoringSystem } from '../systems/ScoringSystem';
import { LevelManager } from '../systems/LevelManager';
import { GAME_WIDTH, GAME_HEIGHT, CONTAINER_BORDER_COLOR } from '../core/Constants';

/**
 * HUD — Heads Up Display.
 * Rendered purely in Phaser Canvas (zero DOM).
 */
export class HUD {
  scene: Phaser.Scene;
  scoring: ScoringSystem;
  levelManager: LevelManager;

  private scoreText!: Phaser.GameObjects.Text;
  private highScoreText!: Phaser.GameObjects.Text;
  private levelText!: Phaser.GameObjects.Text;
  private titleGlow!: Phaser.GameObjects.Text;
  private comboGroup!: Phaser.GameObjects.Container;
  private comboMultiplierText!: Phaser.GameObjects.Text;



  constructor(scene: Phaser.Scene, scoring: ScoringSystem, levelManager: LevelManager) {
    this.scene = scene;
    this.scoring = scoring;
    this.levelManager = levelManager;

    this.createTopLeft();
    this.createTitle();
    this.createComboTracker();

    // Set initial values
    this.updateScore(this.scoring.score, this.scoring.highScore);
    this.updateCombo(0);

    // Listen to events instead of polling in update loop
    this.scene.events.on('score-changed', this.updateScore, this);
    this.scene.events.on('combo-changed', this.updateCombo, this);

    // Clean up on shutdown
    this.scene.events.once('shutdown', this.destroy, this);
  }

  update(): void {
    // No-op: HUD updates are now fully event-driven to maximize performance
  }

  private updateScore(score: number, highScore: number): void {
    this.scoreText.setText(`SCORE: ${score.toLocaleString()}`);
    this.highScoreText.setText(`High Score: ${highScore.toLocaleString()}`);
  }

  private updateCombo(comboCount: number): void {
    this.setComboActive(comboCount);
  }

  destroy(): void {
    this.scene.events.off('score-changed', this.updateScore, this);
    this.scene.events.off('combo-changed', this.updateCombo, this);
  }

  setComboActive(multiplier: number): void {
    if (multiplier > 1) {
      this.comboGroup.setVisible(true);
      this.comboMultiplierText.setText(`x${multiplier}`);
      // Pulse tween
      this.scene.tweens.add({
        targets: this.comboMultiplierText,
        scaleX: 1.2,
        scaleY: 1.2,
        duration: 100,
        yoyo: true,
      });
    } else {
      this.comboGroup.setVisible(false);
    }
  }

  private createTopLeft(): void {
    this.levelText = this.scene.add.text(10, 10, 'LEVEL 1', {
      fontFamily: '"Orbitron", monospace',
      fontSize: '24px',
      color: '#00ff88',
      fontStyle: 'bold',
    }).setDepth(30);

    this.scoreText = this.scene.add.text(10, 40, 'SCORE: 0', {
      fontFamily: '"Orbitron", monospace',
      fontSize: '20px',
      color: '#00ccff',
      fontStyle: 'bold',
    }).setDepth(30);

    this.highScoreText = this.scene.add.text(10, 65, 'High Score: 0', {
      fontFamily: '"Orbitron", monospace',
      fontSize: '16px',
      color: '#aaaaaa',
    }).setDepth(30);
  }

  private createTitle(): void {
    const cx = GAME_WIDTH / 2;

    this.titleGlow = this.scene.add.text(cx, 30, 'ZERO SUM DROP', {
      fontFamily: '"Orbitron", monospace',
      fontSize: '32px',
      color: '#ffffff',
      fontStyle: 'italic bold',
    }).setOrigin(0.5).setDepth(30);

    // Cheap glitch/neon effect with multiple texts
    const t1 = this.scene.add.text(cx - 2, 30, 'ZERO SUM DROP', {
      fontFamily: '"Orbitron", monospace', fontSize: '32px', color: '#ff00ff', fontStyle: 'italic bold',
    }).setOrigin(0.5).setDepth(29).setAlpha(0.5);

    const t2 = this.scene.add.text(cx + 2, 30, 'ZERO SUM DROP', {
      fontFamily: '"Orbitron", monospace', fontSize: '32px', color: '#00ffff', fontStyle: 'italic bold',
    }).setOrigin(0.5).setDepth(29).setAlpha(0.5);

    this.scene.tweens.add({
      targets: [t1, t2],
      alpha: 0.1,
      duration: 100,
      yoyo: true,
      repeat: -1,
      repeatDelay: Math.random() * 2000 + 1000
    });
  }

  private createComboTracker(): void {
    this.comboGroup = this.scene.add.container(20, GAME_HEIGHT / 2 - 50).setDepth(30).setVisible(false);

    const label = this.scene.add.text(0, 0, 'CHAIN COMBO', {
      fontFamily: '"Orbitron", monospace',
      fontSize: '18px',
      color: '#ffaa00',
      fontStyle: 'bold',
    });

    this.comboMultiplierText = this.scene.add.text(30, 30, 'x2', {
      fontFamily: '"Orbitron", monospace',
      fontSize: '48px',
      color: '#ffaa00',
      fontStyle: 'bold',
      stroke: '#ff0000',
      strokeThickness: 2,
    });

    this.comboGroup.add([label, this.comboMultiplierText]);
  }


}
