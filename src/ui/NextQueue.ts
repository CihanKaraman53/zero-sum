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

  private previewSprites: Phaser.GameObjects.Sprite[] = [];
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

    // Create 2 preview slots
    for (let i = 0; i < 2; i++) {
      const bx = i * 50;

      // Sprite preview
      const sprite = scene.add.sprite(bx + 20, 20, 'positive_ball');
      this.container.add(sprite);
      this.previewSprites.push(sprite);

      // Label
      const label = scene.add.text(bx + 20, 20, '', {
        fontFamily: '"Orbitron", monospace',
        fontSize: '14px',
        color: '#ffffff',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 1.5,
      }).setOrigin(0.5);
      this.container.add(label);
      this.previewLabels.push(label);
    }
  }

  update(): void {
    const queue = this.levelManager.getQueue();

    for (let i = 0; i < 2; i++) {
      const item = queue[i];
      const sprite = this.previewSprites[i];
      const label = this.previewLabels[i];

      if (!item) {
        sprite.setVisible(false);
        label.setText('');
        continue;
      }

      sprite.setVisible(true);

      if (item.special) {
        sprite.setTexture('positive_ball');
        sprite.setTint(0x00ccff);
      } else if (item.value > 0) {
        sprite.setTexture('positive_ball');
        sprite.clearTint();
      } else {
        sprite.setTexture('negative_ball');
        sprite.clearTint();
      }

      // Display size (diameter 38px)
      sprite.setDisplaySize(38, 38);

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
