import Phaser from 'phaser';
import { ObjectPool } from '../core/ObjectPool';
import { TEXT_POOL_SIZE } from '../core/Constants';

interface FloatingTextItem {
  text: Phaser.GameObjects.Text;
  glowText: Phaser.GameObjects.Text;
  life: number;
  active: boolean;
}

/**
 * FloatingText — object-pooled neon floating score/combo text.
 * Rises upward and fades out. Zero allocation during gameplay.
 */
export class FloatingText {
  scene: Phaser.Scene;
  pool: ObjectPool<FloatingTextItem>;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    this.pool = new ObjectPool<FloatingTextItem>(
      () => this.createItem(),
      (item) => this.resetItem(item),
      TEXT_POOL_SIZE
    );
  }

  private createItem(): FloatingTextItem {
    const glowText = this.scene.add.text(0, 0, '', {
      fontFamily: '"Orbitron", monospace',
      fontSize: '24px',
      fontStyle: 'bold',
      color: '#ffffff',
    }).setOrigin(0.5).setVisible(false).setDepth(35).setAlpha(0.4);

    const text = this.scene.add.text(0, 0, '', {
      fontFamily: '"Orbitron", monospace',
      fontSize: '22px',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setVisible(false).setDepth(36);

    return { text, glowText, life: 0, active: false };
  }

  private resetItem(item: FloatingTextItem): void {
    item.active = false;
    item.text.setVisible(false);
    item.glowText.setVisible(false);
  }

  /**
   * Show floating text at position.
   */
  show(x: number, y: number, message: string, color: string = '#ffffff', size: number = 22, duration: number = 800): void {
    const item = this.pool.acquire();
    if (!item) return;

    item.text.setText(message);
    item.text.setPosition(x, y);
    item.text.setColor(color);
    item.text.setFontSize(`${size}px`);
    item.text.setVisible(true);
    item.text.setAlpha(1);
    item.text.setScale(0.5);

    item.glowText.setText(message);
    item.glowText.setPosition(x, y);
    item.glowText.setColor(color);
    item.glowText.setFontSize(`${size + 4}px`);
    item.glowText.setVisible(true);
    item.glowText.setAlpha(0.4);
    item.glowText.setScale(0.5);

    item.life = duration;
    item.active = true;

    // Pop-in then float up
    this.scene.tweens.add({
      targets: [item.text, item.glowText],
      scaleX: 1,
      scaleY: 1,
      duration: 150,
      ease: 'Back.easeOut',
    });

    this.scene.tweens.add({
      targets: [item.text, item.glowText],
      y: y - 60,
      alpha: 0,
      duration: duration,
      ease: 'Sine.easeIn',
      onComplete: () => {
        this.pool.release(item);
      }
    });
  }

  /**
   * Show score text.
   */
  showScore(x: number, y: number, score: number): void {
    const color = score > 0 ? '#00ff88' : '#ff3388';
    this.show(x, y, `+${score}`, color, 20, 700);
  }

  /**
   * Show combo text.
   */
  showCombo(x: number, y: number, combo: number): void {
    this.show(x, y, `x${combo} COMBO!`, '#ffcc00', 28, 900);
  }

  /**
   * Show Zero Sum text.
   */
  showZeroSum(x: number, y: number): void {
    this.show(x, y, 'ZERO SUM!', '#00ccff', 30, 1000);
  }

  /**
   * Show merge text.
   */
  showMerge(x: number, y: number): void {
    this.show(x, y, 'MERGE!', '#88ff88', 22, 600);
  }

  destroy(): void {
    this.pool.releaseAll();
  }
}
