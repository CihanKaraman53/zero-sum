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
  private cachedLabelText: string[] = ['', ''];

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
        if (this.cachedLabelText[i] !== '') {
          this.cachedLabelText[i] = '';
          label.setText('');
        }
        continue;
      }

      sprite.setVisible(true);

      if (item.special === 'multiply') {
        sprite.setTexture('x2_ball');
        sprite.clearTint();
      } else if (item.special === 'blast') {
        sprite.setTexture('blast_ball');
        sprite.clearTint();
      } else if (item.special === 'slice') {
        sprite.setTexture('slice_ball');
        sprite.clearTint();
      } else if (item.special === 'chance') {
        sprite.setTexture('dice_ball');
        sprite.clearTint();
      } else if (item.special) {
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

      let labelText = '';
      if (item.special === 'multiply') {
        labelText = '×2';
      } else if (item.special === 'divide') {
        labelText = '÷2';
      } else if (item.special === 'blast' || item.special === 'slice' || item.special === 'chance') {
        labelText = '';
      } else {
        const prefix = item.value > 0 ? '+' : '';
        labelText = `${prefix}${item.value}`;
      }
      if (labelText !== this.cachedLabelText[i]) {
        this.cachedLabelText[i] = labelText;
        label.setText(labelText);
      }
    }
  }
}
