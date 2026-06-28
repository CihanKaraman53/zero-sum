import Phaser from 'phaser';
import { ScoringSystem } from '../systems/ScoringSystem';
import { LevelManager } from '../systems/LevelManager';

/**
 * HUD — minimal combo tracker (Zero Cure hides legacy score UI).
 */
export class HUD {
  scene: Phaser.Scene;
  scoring: ScoringSystem;
  levelManager: LevelManager;

  private comboGroup!: Phaser.GameObjects.Container;
  private comboMultiplierText!: Phaser.GameObjects.Text;
  private cachedComboText = '';

  constructor(scene: Phaser.Scene, scoring: ScoringSystem, levelManager: LevelManager) {
    this.scene = scene;
    this.scoring = scoring;
    this.levelManager = levelManager;

    this.createComboTracker();
    this.updateCombo(0);

    this.scene.events.on('score-changed', this.updateScore, this);
    this.scene.events.on('combo-changed', this.updateCombo, this);
    this.scene.events.once('shutdown', this.destroy, this);
  }

  private createComboTracker(): void {
    this.comboGroup = this.scene.add.container(0, 0).setDepth(35).setVisible(false);
    this.comboMultiplierText = this.scene.add.text(0, 0, '', {
      fontFamily: '"Orbitron", monospace',
      fontSize: '28px',
      color: '#ffd700',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5);
    this.comboGroup.add(this.comboMultiplierText);
  }

  update(): void {
    // Event-driven; no polling needed for single-level cure layout.
  }

  private updateScore(_score: number, _highScore: number): void {
    // Score shown only on game-over screen in cure layout.
  }

  updateCombo(combo: number): void {
    if (!this.comboMultiplierText) return;
    const text = combo > 1 ? `×${combo}` : '';
    if (text !== this.cachedComboText) {
      this.cachedComboText = text;
      this.comboMultiplierText.setText(text);
    }
    this.comboGroup.setVisible(combo > 1);
  }

  destroy(): void {
    this.scene.events.off('score-changed', this.updateScore, this);
    this.scene.events.off('combo-changed', this.updateCombo, this);
    this.comboGroup?.destroy(true);
  }
}
