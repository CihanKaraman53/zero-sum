import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../core/Constants';

/**
 * MenuScene — main menu with navigation to level select.
 */
export class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
  }

  create() {
    const cx = GAME_WIDTH / 2;

    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x050510).setOrigin(0);

    const grid = this.add.graphics().setAlpha(0.15);
    grid.lineStyle(1, 0x00ff88, 0.4);
    for (let x = 0; x < GAME_WIDTH; x += 40) {
      grid.lineBetween(x, 0, x, GAME_HEIGHT);
    }
    for (let y = 0; y < GAME_HEIGHT; y += 40) {
      grid.lineBetween(0, y, GAME_WIDTH, y);
    }

    const title = this.add.text(cx, 220, 'ZERO SUM', {
      fontFamily: '"Orbitron", monospace',
      fontSize: '48px',
      color: '#ff3388',
      fontStyle: 'italic bold',
    }).setOrigin(0.5);

    const subtitle = this.add.text(cx, 280, 'DROP', {
      fontFamily: '"Orbitron", monospace',
      fontSize: '48px',
      color: '#00ff88',
      fontStyle: 'italic bold',
    }).setOrigin(0.5);

    this.tweens.add({
      targets: [title, subtitle],
      alpha: 0.85,
      duration: 900,
      yoyo: true,
      repeat: -1,
    });

    this.createButton(cx, 480, 220, 56, 'BÖLÜMLER', 0x00ff88, () => {
      this.scene.start('LevelSelectScene');
    });

    this.add.text(cx, GAME_HEIGHT - 40, 'Tap to choose a level', {
      fontFamily: '"Orbitron", monospace',
      fontSize: '13px',
      color: '#666688',
    }).setOrigin(0.5);
  }

  private createButton(
    x: number, y: number, w: number, h: number,
    label: string, color: number, onClick: () => void
  ): void {
    const btn = this.add.container(x, y).setDepth(2);
    const bg = this.add.graphics();
    const draw = (hover: boolean) => {
      bg.clear();
      bg.lineStyle(2, hover ? 0xffffff : color, 1);
      bg.fillStyle(color, hover ? 0.45 : 0.2);
      bg.fillRoundedRect(-w / 2, -h / 2, w, h, 10);
      bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 10);
    };
    draw(false);

    const text = this.add.text(0, 0, label, {
      fontFamily: '"Orbitron", monospace',
      fontSize: '24px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    btn.add([bg, text]);

    const hit = this.add.rectangle(x, y, w, h, 0x000000, 0.001)
      .setDepth(3)
      .setInteractive({ useHandCursor: true });

    hit.on('pointerover', () => draw(true));
    hit.on('pointerout', () => draw(false));
    hit.on('pointerup', onClick);
  }
}
