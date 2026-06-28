import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../core/Constants';

/**
 * GameOverScene — displays final score and restart / menu actions.
 */
export class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOverScene');
  }

  create(data: { score: number; highScore: number; won?: boolean }) {
    const won = !!data.won;
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;

    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x050510, 0.9).setOrigin(0);

    this.add.text(cx, cy - 100, won ? 'GÖREV TAMAMLANDI' : 'SYSTEM FAILURE', {
      fontFamily: '"Orbitron", monospace',
      fontSize: won ? '34px' : '42px',
      color: won ? '#00ff88' : '#ff2244',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 6,
    }).setOrigin(0.5);

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

    this.createButton(cx - 90, cy + 120, 'TEKRAR', 0x00ff88, () => {
      this.scene.start('GameScene');
    });

    this.createButton(cx + 90, cy + 120, 'MENÜ', 0x00ccff, () => {
      this.scene.start('MenuScene');
    });
  }

  private createButton(
    x: number, y: number, label: string, color: number, onClick: () => void
  ): void {
    const btn = this.add.container(x, y);
    const bg = this.add.graphics();
    const draw = (hover: boolean) => {
      bg.clear();
      bg.lineStyle(2, hover ? 0xffffff : color, 1);
      bg.fillStyle(color, hover ? 0.5 : 0.2);
      bg.fillRoundedRect(-80, -25, 160, 50, 8);
      bg.strokeRoundedRect(-80, -25, 160, 50, 8);
    };
    draw(false);

    const text = this.add.text(0, 0, label, {
      fontFamily: '"Orbitron", monospace',
      fontSize: '22px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    btn.add([bg, text]);
    btn.setInteractive(new Phaser.Geom.Rectangle(-80, -25, 160, 50), Phaser.Geom.Rectangle.Contains);
    btn.on('pointerover', () => draw(true));
    btn.on('pointerout', () => draw(false));
    btn.on('pointerdown', () => {
      this.tweens.add({
        targets: btn,
        scaleX: 0.9,
        scaleY: 0.9,
        duration: 50,
        yoyo: true,
        onComplete: onClick,
      });
    });
  }
}
