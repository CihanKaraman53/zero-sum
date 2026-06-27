import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../core/Constants';
import { LEVELS } from '../data/levels';

/**
 * LevelSelectScene — pick any level to play.
 */
export class LevelSelectScene extends Phaser.Scene {
  constructor() {
    super('LevelSelectScene');
  }

  create() {
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x050510).setOrigin(0);

    this.createButton(56, 36, 90, 36, '← GERİ', 0x888899, () => {
      this.scene.start('MenuScene');
    });

    this.add.text(GAME_WIDTH / 2, 36, 'BÖLÜMLER', {
      fontFamily: '"Orbitron", monospace',
      fontSize: '26px',
      color: '#00f0ff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(1);

    const cols = 2;
    const cellW = 200;
    const cellH = 72;
    const gapX = 16;
    const gapY = 12;
    const gridW = cols * cellW + (cols - 1) * gapX;
    const startX = (GAME_WIDTH - gridW) / 2 + cellW / 2;
    const startY = 100;

    LEVELS.forEach((level, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const x = startX + col * (cellW + gapX);
      const y = startY + row * (cellH + gapY);

      this.createLevelCard(x, y, cellW, cellH, index, level.id, level.name);
    });
  }

  private createLevelCard(
    x: number, y: number, w: number, h: number,
    levelIndex: number, levelNum: number, levelName: string
  ): void {
    const card = this.add.container(x, y).setDepth(2);

    const bg = this.add.graphics();
    const color = 0x00ff88;

    const draw = (hover: boolean) => {
      bg.clear();
      bg.lineStyle(2, hover ? 0xffffff : color, hover ? 1 : 0.7);
      bg.fillStyle(color, hover ? 0.25 : 0.1);
      bg.fillRoundedRect(-w / 2, -h / 2, w, h, 8);
      bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 8);
    };
    draw(false);

    const numText = this.add.text(-w / 2 + 14, -8, `${levelNum}`, {
      fontFamily: '"Orbitron", monospace',
      fontSize: '22px',
      color: '#00ff88',
      fontStyle: 'bold',
    }).setOrigin(0, 0.5);

    const nameText = this.add.text(-w / 2 + 14, 14, levelName, {
      fontFamily: '"Orbitron", monospace',
      fontSize: '11px',
      color: '#aaaacc',
      wordWrap: { width: w - 28 },
    }).setOrigin(0, 0.5);

    card.add([bg, numText, nameText]);

    // Reliable hit target — Container.setInteractive is flaky on some Phaser builds
    const hit = this.add.rectangle(x, y, w, h, 0x000000, 0.001)
      .setDepth(3)
      .setInteractive({ useHandCursor: true });

    hit.on('pointerover', () => draw(true));
    hit.on('pointerout', () => draw(false));
    hit.on('pointerup', () => {
      this.cameras.main.flash(80, 0, 255, 136, false);
      this.scene.start('GameScene', { levelIndex, fromLevelSelect: true });
    });
  }

  private createButton(
    x: number, y: number, w: number, h: number,
    label: string, color: number, onClick: () => void
  ): Phaser.GameObjects.Container {
    const btn = this.add.container(x, y).setDepth(2);
    const bg = this.add.graphics();
    const draw = (hover: boolean) => {
      bg.clear();
      bg.lineStyle(2, hover ? 0xffffff : color, 1);
      bg.fillStyle(color, hover ? 0.35 : 0.15);
      bg.fillRoundedRect(-w / 2, -h / 2, w, h, 8);
      bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 8);
    };
    draw(false);

    const text = this.add.text(0, 0, label, {
      fontFamily: '"Orbitron", monospace',
      fontSize: '14px',
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

    return btn;
  }
}
