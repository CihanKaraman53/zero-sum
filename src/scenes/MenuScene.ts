import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../core/Constants';

/**
 * MenuScene — main menu displaying the transparent Zero Cure board.
 * Blurs the background and starts the game on play.
 */
export class MenuScene extends Phaser.Scene {
  private bgBlurElement: HTMLElement | null = null;

  constructor() {
    super('MenuScene');
  }

  create() {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;

    // 1. Apply blur to the HTML background element (#game-bg)
    this.bgBlurElement = document.getElementById('game-bg');
    if (this.bgBlurElement) {
      this.bgBlurElement.style.filter = 'blur(10px) contrast(1.06) saturate(1.05)';
      this.bgBlurElement.style.transition = 'filter 0.5s ease';
    }

    // 2. Create a container to hold the board and the interactive button
    const container = this.add.container(cx, cy);

    // Add the transparent board image
    const board = this.add.image(0, 0, 'menu_bg');
    
    // Scale board to be slightly larger than GAME_WIDTH to avoid being too small (cropped slightly on sides)
    const scaleFactor = 1.35;
    board.displayWidth = GAME_WIDTH * scaleFactor;
    board.scaleY = board.scaleX;

    const boardWidth = board.displayWidth;
    const boardHeight = boardWidth * (558 / 1024);

    // Add the board to the container
    container.add(board);

    // 3. Position of the pre-written "OYNA" button at the bottom of the board
    // Relative coordinates inside the container (centered at 0, 0)
    // The button vertical center is at 84.2% from the top of the board:
    // y = boardHeight * 0.842 - boardHeight / 2 = boardHeight * 0.342
    const buttonLocalY = boardHeight * 0.342;

    // Button width is ~22.8% of board width, height is ~14.5% of board height
    const btnWidth = boardWidth * 0.228;
    const btnHeight = boardHeight * 0.145;

    // Create an invisible interactive rectangle for the click/hover zone
    const hitArea = this.add.rectangle(0, buttonLocalY, btnWidth, btnHeight, 0x000000, 0.001);
    hitArea.setInteractive({ useHandCursor: true });
    container.add(hitArea);

    // Hover effects on the play button (we scale the whole board container slightly)
    hitArea.on('pointerover', () => {
      this.tweens.add({
        targets: container,
        scale: 1.04,
        duration: 150,
        ease: 'Back.easeOut'
      });
    });

    hitArea.on('pointerout', () => {
      this.tweens.add({
        targets: container,
        scale: 1.0,
        duration: 150,
        ease: 'Power2'
      });
    });

    hitArea.on('pointerup', () => {
      this.startGame(container);
    });
  }

  private startGame(container: Phaser.GameObjects.Container): void {
    // Smoothly remove the blur from the background image
    if (this.bgBlurElement) {
      this.bgBlurElement.style.filter = 'contrast(1.06) saturate(1.05)';
    }

    // Fade out the menu board, then start the game scene
    this.tweens.add({
      targets: container,
      alpha: 0,
      scale: 0.9,
      duration: 300,
      ease: 'Power2',
      onComplete: () => {
        this.scene.start('GameScene');
      }
    });
  }
}
