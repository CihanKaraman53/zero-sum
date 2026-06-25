import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../core/Constants';

/**
 * GameOverScene — displays final score and restart button.
 */
export class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOverScene');
  }

  create(data: { score: number, highScore: number }) {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;

    // Background overlay
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x050510, 0.9).setOrigin(0);

    // Title
    this.add.text(cx, cy - 100, 'SYSTEM FAILURE', {
      fontFamily: '"Orbitron", monospace',
      fontSize: '42px',
      color: '#ff2244',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 6
    }).setOrigin(0.5);

    // Score
    this.add.text(cx, cy, `SCORE: ${data.score}`, {
      fontFamily: '"Orbitron", monospace',
      fontSize: '28px',
      color: '#00ccff',
    }).setOrigin(0.5);

    this.add.text(cx, cy + 40, `HIGH SCORE: ${data.highScore}`, {
      fontFamily: '"Orbitron", monospace',
      fontSize: '20px',
      color: '#aaaaaa',
    }).setOrigin(0.5);

    // Restart Button
    const btn = this.add.container(cx, cy + 120);
    const btnBg = this.add.graphics();
    btnBg.lineStyle(2, 0x00ff88, 1);
    btnBg.fillStyle(0x00ff88, 0.2);
    btnBg.fillRoundedRect(-80, -25, 160, 50, 8);
    btnBg.strokeRoundedRect(-80, -25, 160, 50, 8);
    
    const btnText = this.add.text(0, 0, 'REBOOT', {
      fontFamily: '"Orbitron", monospace',
      fontSize: '22px',
      color: '#00ff88',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    btn.add([btnBg, btnText]);

    // Interactivity
    const hitArea = new Phaser.Geom.Rectangle(-80, -25, 160, 50);
    btn.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains);

    btn.on('pointerover', () => {
      btnBg.clear();
      btnBg.lineStyle(2, 0xffffff, 1);
      btnBg.fillStyle(0x00ff88, 0.5);
      btnBg.fillRoundedRect(-80, -25, 160, 50, 8);
      btnBg.strokeRoundedRect(-80, -25, 160, 50, 8);
    });

    btn.on('pointerout', () => {
      btnBg.clear();
      btnBg.lineStyle(2, 0x00ff88, 1);
      btnBg.fillStyle(0x00ff88, 0.2);
      btnBg.fillRoundedRect(-80, -25, 160, 50, 8);
      btnBg.strokeRoundedRect(-80, -25, 160, 50, 8);
    });

    btn.on('pointerdown', () => {
      // Small click effect
      this.tweens.add({
        targets: btn,
        scaleX: 0.9,
        scaleY: 0.9,
        duration: 50,
        yoyo: true,
        onComplete: () => {
          this.scene.start('GameScene');
        }
      });
    });
  }
}
