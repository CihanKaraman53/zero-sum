import Phaser from 'phaser';
import { LevelManager } from '../systems/LevelManager';
import { CURE_L1_PLAY_WIDTH } from '../core/Constants';

/**
 * NextQueue — displays the next 3 drops under the title (Zero Cure layout).
 */
export class NextQueue {
  scene: Phaser.Scene;
  levelManager: LevelManager;
  container: Phaser.GameObjects.Container;

  private previewSprites: Phaser.GameObjects.Sprite[] = [];
  private previewLabels: Phaser.GameObjects.Text[] = [];
  private cachedLabelText = ['', '', ''];

  constructor(scene: Phaser.Scene, levelManager: LevelManager) {
    this.scene = scene;
    this.levelManager = levelManager;

    const startX = CURE_L1_PLAY_WIDTH / 2 - 80;
    const startY = 88;

    this.container = scene.add.container(startX, startY).setDepth(30);

    const titleText = scene.add.text(80, -28, 'NEXT', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '11px',
      color: '#64748b',
      fontStyle: 'bold',
      letterSpacing: 1.5,
    }).setOrigin(0.5);
    this.container.add(titleText);

    const spacing = 52;
    for (let i = 0; i < 3; i++) {
      const bx = i * spacing;
      const sprite = scene.add.sprite(bx + 20, 20, 'positive_ball');
      this.container.add(sprite);
      this.previewSprites.push(sprite);

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

  destroy(): void {
    this.container.destroy(true);
  }

  update(): void {
    const queue = this.levelManager.getQueue();

    for (let i = 0; i < 3; i++) {
      const item = queue[i];
      const sprite = this.previewSprites[i];
      const label = this.previewLabels[i];

      if (!item) {
        sprite.setVisible(false);
        if (this.cachedLabelText[i] !== '') {
          this.cachedLabelText[i] = '';
          label.setText('');
        }
        continue;
      }

      sprite.setVisible(true);

      if (item.value > 0) {
        sprite.setTexture('positive_ball');
        sprite.clearTint();
      } else {
        sprite.setTexture('negative_ball');
        sprite.clearTint();
      }

      const previewSize = 42;
      const isFirst = i === 0;
      const size = isFirst ? previewSize * 1.05 : previewSize * 0.92;
      sprite.setScale(1, 1);
      sprite.setDisplaySize(size, size);
      sprite.setAlpha(isFirst ? 1 : 0.55);
      label.setAlpha(isFirst ? 1 : 0.55);
      label.setScale(isFirst ? 1.05 : 0.92);

      const prefix = item.value > 0 ? '+' : '';
      const labelText = `${prefix}${item.value}`;
      if (labelText !== this.cachedLabelText[i]) {
        this.cachedLabelText[i] = labelText;
        label.setText(labelText);
      }
    }
  }
}
