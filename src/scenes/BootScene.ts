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

    // Load custom font (Orbitron) via a dummy text to ensure it's loaded by the browser
    // Assuming Orbitron is imported in index.html (we will add it there or via WebFont loader)
    // For this implementation, we just wait a short moment and transition.
  }

  create() {
    // Add a small delay to ensure fonts render correctly
    this.time.delayedCall(500, () => {
      this.scene.start('GameScene');
    });
  }
}
