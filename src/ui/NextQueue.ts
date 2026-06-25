import Phaser from 'phaser';
import { LevelManager } from '../systems/LevelManager';
import { GAME_WIDTH, CONTAINER_BORDER_COLOR } from '../core/Constants';

/**
 * NextQueue — displays the next 2 drops in the top right corner.
 */
export class NextQueue {
  scene: Phaser.Scene;
  levelManager: LevelManager;
  container: Phaser.GameObjects.Container;

  private boxesGfx: Phaser.GameObjects.Graphics;
  private previewGraphics: Phaser.GameObjects.Graphics[] = [];
  private previewLabels: Phaser.GameObjects.Text[] = [];

  constructor(scene: Phaser.Scene, levelManager: LevelManager) {
    this.scene = scene;
    this.levelManager = levelManager;

    const startX = GAME_WIDTH - 110;
    const startY = 30;

    this.container = scene.add.container(startX, startY).setDepth(30);

    const title = scene.add.text(50, -20, 'NEXT:', {
      fontFamily: '"Orbitron", monospace',
      fontSize: '14px',
      color: '#00ccff',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.container.add(title);

    this.boxesGfx = scene.add.graphics();
    this.container.add(this.boxesGfx);

    // Create 2 preview slots
    for (let i = 0; i < 2; i++) {
      const bx = i * 50;

      // Box outline
      this.boxesGfx.lineStyle(2, CONTAINER_BORDER_COLOR, 0.6);
      this.boxesGfx.strokeRect(bx, 0, 40, 40);

      // Inner graphic
      const gfx = scene.add.graphics();
      gfx.setPosition(bx + 20, 20);
      this.container.add(gfx);
      this.previewGraphics.push(gfx);

      // Label
      const label = scene.add.text(bx + 20, 20, '', {
        fontFamily: '"Orbitron", monospace',
        fontSize: '12px',
        color: '#ffffff',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 1,
      }).setOrigin(0.5);
      this.container.add(label);
      this.previewLabels.push(label);
    }
  }

  update(): void {
    const queue = this.levelManager.getQueue();

    for (let i = 0; i < 2; i++) {
      const item = queue[i];
      const gfx = this.previewGraphics[i];
      const label = this.previewLabels[i];

      gfx.clear();
      if (!item) {
        label.setText('');
        continue;
      }

      let color: number;
      if (item.special) color = 0x00ccff;
      else if (item.value > 0) color = 0x00ff88;
      else color = 0xff3388;

      gfx.fillStyle(color, 0.7);
      gfx.fillCircle(0, 0, 14);
      gfx.lineStyle(1.5, color, 1);
      gfx.strokeCircle(0, 0, 14);

      if (item.special === 'multiply') {
        label.setText('×2');
      } else if (item.special === 'divide') {
        label.setText('÷2');
      } else {
        const prefix = item.value > 0 ? '+' : '';
        label.setText(`${prefix}${item.value}`);
      }
    }
  }
}
