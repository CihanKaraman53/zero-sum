import Phaser from 'phaser';
import { ScoringSystem } from '../systems/ScoringSystem';
import { LevelManager } from '../systems/LevelManager';
import { GAME_WIDTH, GAME_HEIGHT, CONTAINER_TOP, LAUNCHER_Y } from '../core/Constants';

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
  private dropsText!: Phaser.GameObjects.Text;
  private goalText!: Phaser.GameObjects.Text;
  private surviveText!: Phaser.GameObjects.Text;

  private cachedGoalText = '';
  private cachedDropsText = '';
  private cachedSurvivalText = '';
  private cachedLevelNum = -1;

  constructor(scene: Phaser.Scene, scoring: ScoringSystem, levelManager: LevelManager) {
    this.scene = scene;
    this.scoring = scoring;
    this.levelManager = levelManager;

    this.createTopLeft();
    this.createTitle();
    this.createComboTracker();
    this.createDropsCounter();
    this.createSurvivalTimer();

    // Set initial values
    this.updateScore(this.scoring.score, this.scoring.highScore);
    this.updateCombo(0);
    this.updateDrops();

    // Listen to events instead of polling in update loop
    this.scene.events.on('score-changed', this.updateScore, this);
    this.scene.events.on('combo-changed', this.updateCombo, this);

    // Clean up on shutdown
    this.scene.events.once('shutdown', this.destroy, this);
  }

  private flipCountdownHint: number | null = null;

  setFlipCountdownHint(seconds: number | null): void {
    this.flipCountdownHint = seconds;
  }

  update(): void {
    const lvlNum = this.levelManager.currentLevelIndex + 1;
    if (lvlNum !== this.cachedLevelNum) {
      this.cachedLevelNum = lvlNum;
      this.levelText.setText(`LEVEL ${lvlNum}`);
    }
    this.updateDrops();
    this.updateGoal();
    this.updateSurvival();
    this.updateZeroSumGoal();
  }

  private setGoalText(text: string, visible: boolean): void {
    if (text !== this.cachedGoalText) {
      this.cachedGoalText = text;
      this.goalText.setText(text);
    }
    this.goalText.setVisible(visible);
  }

  updateZeroSumGoal(): void {
    if (!this.goalText) return;
    const lvl = this.levelManager.currentLevel;
    if (this.levelManager.hasZeroSumGoal()) {
      const target = lvl.zeroSumTarget ?? 0;
      this.setGoalText(`ZERO: ${this.levelManager.zeroSumCount}/${target}`, true);
    } else if (this.levelManager.hasEmptyBoardGoal()) {
      const count = this.levelManager.getActiveBallCount?.() ?? 0;
      const flipHint = this.flipCountdownHint != null && this.flipCountdownHint > 0
        ? ` | FLIP: ${this.flipCountdownHint}s`
        : '';
      this.setGoalText(`CLEAR: ${count} left${flipHint}`, true);
    } else if (this.levelManager.hasAnchorClearGoal()) {
      const left = this.levelManager.getActiveFrozenCount?.() ?? 0;
      this.setGoalText(`ANCHORS: ${left} left`, true);
    } else if (lvl.type === 'fusion_goal' && lvl.fusionTarget) {
      if (this.levelManager.hasDualFusionGoal()) {
        const t = lvl.fusionTarget;
        const pos = this.levelManager.forgedPositiveFusion ? '✓' : '…';
        const neg = this.levelManager.forgedNegativeFusion ? '✓' : '…';
        this.setGoalText(`GOAL: +${t} ${pos}  -${t} ${neg}`, true);
      } else {
        this.setGoalText(`GOAL: +${lvl.fusionTarget}`, true);
      }
    } else {
      if (this.cachedGoalText !== '') {
        this.cachedGoalText = '';
      }
      this.goalText.setVisible(false);
    }
  }

  updateSurvival(): void {
    if (!this.surviveText) return;
    if (this.levelManager.hasTimeSurvival()) {
      const secs = this.levelManager.getSurvivalSecondsRemaining();
      const text = `${secs}s`;
      this.surviveText.setVisible(true);
      if (text !== this.cachedSurvivalText) {
        this.cachedSurvivalText = text;
        this.surviveText.setText(text);
      }
      this.surviveText.setColor(secs <= 10 ? '#ff2244' : '#00f0ff');
    } else {
      this.cachedSurvivalText = '';
      this.surviveText.setVisible(false);
    }
  }

  updateGoal(): void {
    this.updateZeroSumGoal();
  }

  updateDrops(): void {
    if (!this.dropsText) return;
    if (this.levelManager.hasDropLimit()) {
      const text = `${this.levelManager.dropsRemaining}`;
      this.dropsText.setVisible(true);
      if (text !== this.cachedDropsText) {
        this.cachedDropsText = text;
        this.dropsText.setText(text);
      }
    } else {
      this.cachedDropsText = '';
      this.dropsText.setVisible(false);
    }
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
    const lvlNum = this.levelManager.currentLevelIndex + 1;
    this.levelText = this.scene.add.text(10, 10, `LEVEL ${lvlNum}`, {
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

    const titleContainer = this.scene.add.container(cx, 30).setDepth(30);

    const zeroSumText = this.scene.add.text(-45, 0, 'ZERO SUM', {
      fontFamily: '"Orbitron", monospace',
      fontSize: '32px',
      color: '#ff3388',
      fontStyle: 'italic bold',
    }).setOrigin(0.5);

    const dropText = this.scene.add.text(75, 0, 'DROP', {
      fontFamily: '"Orbitron", monospace',
      fontSize: '32px',
      color: '#00ff88',
      fontStyle: 'italic bold',
    }).setOrigin(0.5);

    const zeroSumShadow1 = this.scene.add.text(-47, 0, 'ZERO SUM', {
      fontFamily: '"Orbitron", monospace', fontSize: '32px', color: '#ff00ff', fontStyle: 'italic bold',
    }).setOrigin(0.5).setAlpha(0.4).setDepth(-1);

    const zeroSumShadow2 = this.scene.add.text(-43, 0, 'ZERO SUM', {
      fontFamily: '"Orbitron", monospace', fontSize: '32px', color: '#00ffff', fontStyle: 'italic bold',
    }).setOrigin(0.5).setAlpha(0.4).setDepth(-1);

    const dropShadow1 = this.scene.add.text(73, 0, 'DROP', {
      fontFamily: '"Orbitron", monospace', fontSize: '32px', color: '#ff00ff', fontStyle: 'italic bold',
    }).setOrigin(0.5).setAlpha(0.4).setDepth(-1);

    const dropShadow2 = this.scene.add.text(77, 0, 'DROP', {
      fontFamily: '"Orbitron", monospace', fontSize: '32px', color: '#00ffff', fontStyle: 'italic bold',
    }).setOrigin(0.5).setAlpha(0.4).setDepth(-1);

    titleContainer.add([
      zeroSumShadow1, zeroSumShadow2, zeroSumText,
      dropShadow1, dropShadow2, dropText
    ]);

    this.titleGlow = zeroSumText; 
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

  private createDropsCounter(): void {
    const x = GAME_WIDTH - 16;
    const y = LAUNCHER_Y - 8;

    this.scene.add.text(x, y - 18, 'MOVES', {
      fontFamily: '"Orbitron", monospace',
      fontSize: '11px',
      color: '#888899',
      fontStyle: 'bold',
    }).setOrigin(1, 0.5).setDepth(30);

    this.dropsText = this.scene.add.text(x, y + 6, '30', {
      fontFamily: '"Orbitron", monospace',
      fontSize: '36px',
      color: '#00ff88',
      fontStyle: 'bold',
      stroke: '#003322',
      strokeThickness: 3,
    }).setOrigin(1, 0.5).setDepth(30).setVisible(false);

    this.goalText = this.scene.add.text(GAME_WIDTH / 2, LAUNCHER_Y + 55, '', {
      fontFamily: '"Orbitron", monospace',
      fontSize: '16px',
      color: '#ff3388',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(30).setVisible(false);
  }

  private createSurvivalTimer(): void {
    this.scene.add.text(GAME_WIDTH / 2, 58, 'TIME', {
      fontFamily: '"Orbitron", monospace',
      fontSize: '11px',
      color: '#888899',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(31);

    this.surviveText = this.scene.add.text(GAME_WIDTH / 2, 78, '', {
      fontFamily: '"Orbitron", monospace',
      fontSize: '22px',
      color: '#00f0ff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(31).setVisible(false);
  }


}
