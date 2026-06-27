import Phaser from 'phaser';

/**
 * BootScene — handles loading assets (like fonts) before starting the game.
 * Since we generate most textures programmatically, there's very little to load,
 * but we need to ensure the custom fonts are ready.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload() {
    // We could load a spritesheet/atlas here, but per requirements we are using 
    // mostly drawn graphics to ensure zero DOM and clean WebGL neon feel.
    
    // Create a loading text
    const cx = this.cameras.main.width / 2;
    const cy = this.cameras.main.height / 2;
    
    this.add.text(cx, cy, 'LOADING SYSTEM...', {
      fontFamily: 'monospace',
      fontSize: '20px',
      color: '#00ff88'
    }).setOrigin(0.5);

    // Load ball textures
    this.load.image('positive_ball', 'assets/positive.png');
    this.load.image('negative_ball', 'assets/negative.png');
    this.load.image('x2_ball', 'assets/x2_ball.png');
    this.load.image('blast_ball', 'assets/blast_ball.png');
    this.load.image('slice_ball', 'assets/slice_ball.png');
    this.load.image('dice_ball', 'assets/dice_ball.png');
    this.load.image('magnet_ball', 'assets/magnet_ball.png');
    this.load.image('ghost_ball', 'assets/ghost_ball.png');
    
    // Load launcher texture
    this.load.image('launcher', 'assets/launcher.png');
  }

  private applyTextureFilters(): void {
    const keys = [
      'positive_ball', 'negative_ball', 'x2_ball', 'blast_ball',
      'slice_ball', 'dice_ball', 'magnet_ball', 'ghost_ball', 'launcher',
    ];
    for (const key of keys) {
      if (this.textures.exists(key)) {
        this.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
      }
    }
  }

  create() {
    this.applyTextureFilters();
    // Add a small delay to ensure fonts render correctly
    this.time.delayedCall(500, () => {
      this.scene.start('MenuScene');
    });
  }
}
