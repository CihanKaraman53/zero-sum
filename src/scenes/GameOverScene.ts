import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../core/Constants';

/**
 * GameOverScene — displays final score and restart button.
 */
export class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOverScene');
  }

  create(data: { score: number; highScore: number; levelIndex?: number }) {
    const levelIndex = data.levelIndex ?? 0;
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
    const rebootBtn = this.add.container(cx - 90, cy + 120);
    const rebootBg = this.add.graphics();
    rebootBg.lineStyle(2, 0x00ff88, 1);
    rebootBg.fillStyle(0x00ff88, 0.2);
    rebootBg.fillRoundedRect(-80, -25, 160, 50, 8);
    rebootBg.strokeRoundedRect(-80, -25, 160, 50, 8);

    const rebootText = this.add.text(0, 0, 'REBOOT', {
      fontFamily: '"Orbitron", monospace',
      fontSize: '22px',
      color: '#00ff88',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    rebootBtn.add([rebootBg, rebootText]);
    rebootBtn.setInteractive(new Phaser.Geom.Rectangle(-80, -25, 160, 50), Phaser.Geom.Rectangle.Contains);

    rebootBtn.on('pointerover', () => {
      rebootBg.clear();
      rebootBg.lineStyle(2, 0xffffff, 1);
      rebootBg.fillStyle(0x00ff88, 0.5);
      rebootBg.fillRoundedRect(-80, -25, 160, 50, 8);
      rebootBg.strokeRoundedRect(-80, -25, 160, 50, 8);
    });

    rebootBtn.on('pointerout', () => {
      rebootBg.clear();
      rebootBg.lineStyle(2, 0x00ff88, 1);
      rebootBg.fillStyle(0x00ff88, 0.2);
      rebootBg.fillRoundedRect(-80, -25, 160, 50, 8);
      rebootBg.strokeRoundedRect(-80, -25, 160, 50, 8);
    });

    rebootBtn.on('pointerdown', () => {
      this.tweens.add({
        targets: rebootBtn,
        scaleX: 0.9,
        scaleY: 0.9,
        duration: 50,
        yoyo: true,
        onComplete: () => {
          this.scene.start('GameScene', { levelIndex, fromLevelSelect: true });
        }
      });
    });

    // Levels Button
    const levelsBtn = this.add.container(cx + 90, cy + 120);
    const levelsBg = this.add.graphics();
    levelsBg.lineStyle(2, 0x00ccff, 1);
    levelsBg.fillStyle(0x00ccff, 0.2);
    levelsBg.fillRoundedRect(-80, -25, 160, 50, 8);
    levelsBg.strokeRoundedRect(-80, -25, 160, 50, 8);

    const levelsText = this.add.text(0, 0, 'BÖLÜMLER', {
      fontFamily: '"Orbitron", monospace',
      fontSize: '18px',
      color: '#00ccff',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    levelsBtn.add([levelsBg, levelsText]);
    levelsBtn.setInteractive(new Phaser.Geom.Rectangle(-80, -25, 160, 50), Phaser.Geom.Rectangle.Contains);

    levelsBtn.on('pointerover', () => {
      levelsBg.clear();
      levelsBg.lineStyle(2, 0xffffff, 1);
      levelsBg.fillStyle(0x00ccff, 0.5);
      levelsBg.fillRoundedRect(-80, -25, 160, 50, 8);
      levelsBg.strokeRoundedRect(-80, -25, 160, 50, 8);
    });

    levelsBtn.on('pointerout', () => {
      levelsBg.clear();
      levelsBg.lineStyle(2, 0x00ccff, 1);
      levelsBg.fillStyle(0x00ccff, 0.2);
      levelsBg.fillRoundedRect(-80, -25, 160, 50, 8);
      levelsBg.strokeRoundedRect(-80, -25, 160, 50, 8);
    });

    levelsBtn.on('pointerdown', () => {
      this.tweens.add({
        targets: levelsBtn,
        scaleX: 0.9,
        scaleY: 0.9,
        duration: 50,
        yoyo: true,
        onComplete: () => {
          this.scene.start('LevelSelectScene');
        }
      });
    });
  }
}
