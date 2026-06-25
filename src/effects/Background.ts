import Phaser from 'phaser';
import {
  GAME_WIDTH, GAME_HEIGHT, CONTAINER_LEFT, CONTAINER_RIGHT,
  CONTAINER_TOP, CONTAINER_BOTTOM, CONTAINER_BORDER_COLOR, OVERFLOW_Y, OVERFLOW_COLOR
} from '../core/Constants';

/**
 * Background — cyberpunk neon atmosphere rendered entirely in Phaser Canvas.
 * Includes: dark bg, neon grid, container walls, overflow line, vignette.
 */
export class Background {
  scene: Phaser.Scene;
  private bgGfx: Phaser.GameObjects.Graphics;
  private gridGfx: Phaser.GameObjects.Graphics;
  private wallGfx: Phaser.GameObjects.Graphics;
  private overflowGfx: Phaser.GameObjects.Graphics;
  private vignetteGfx: Phaser.GameObjects.Graphics;
  private gridOffset: number = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    // Background gradient
    this.bgGfx = scene.add.graphics().setDepth(0);
    this.drawBackground();

    // Animated grid
    this.gridGfx = scene.add.graphics().setDepth(1);

    // Container walls
    this.wallGfx = scene.add.graphics().setDepth(2);
    this.drawWalls();

    // Overflow red line
    this.overflowGfx = scene.add.graphics().setDepth(3);

    // Vignette overlay
    this.vignetteGfx = scene.add.graphics().setDepth(50);
    this.drawVignette();
  }

  update(time: number): void {
    // Slowly scroll the grid
    this.gridOffset = (time * 0.01) % 40;
    this.drawGrid();

    // Pulsing overflow line
    this.drawOverflowLine(time);
  }

  private drawBackground(): void {
    // Dark gradient background
    this.bgGfx.clear();
    const steps = 20;
    const h = GAME_HEIGHT / steps;
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const r = Math.round(5 + t * 10);
      const g = Math.round(5 + t * 5);
      const b = Math.round(15 + t * 20);
      const color = (r << 16) | (g << 8) | b;
      this.bgGfx.fillStyle(color, 1);
      this.bgGfx.fillRect(0, i * h, GAME_WIDTH, h + 1);
    }

    // Container interior (darker)
    this.bgGfx.fillStyle(0x050510, 0.8);
    this.bgGfx.fillRect(CONTAINER_LEFT, CONTAINER_TOP, CONTAINER_RIGHT - CONTAINER_LEFT, CONTAINER_BOTTOM - CONTAINER_TOP);
  }

  private drawGrid(): void {
    this.gridGfx.clear();
    this.gridGfx.lineStyle(1, 0x1a3355, 0.15);

    const spacing = 40;
    const offset = this.gridOffset;

    // Vertical lines
    for (let x = CONTAINER_LEFT; x <= CONTAINER_RIGHT; x += spacing) {
      this.gridGfx.beginPath();
      this.gridGfx.moveTo(x, CONTAINER_TOP);
      this.gridGfx.lineTo(x, CONTAINER_BOTTOM);
      this.gridGfx.strokePath();
    }

    // Horizontal lines (with scroll)
    for (let y = CONTAINER_TOP + offset; y <= CONTAINER_BOTTOM; y += spacing) {
      this.gridGfx.beginPath();
      this.gridGfx.moveTo(CONTAINER_LEFT, y);
      this.gridGfx.lineTo(CONTAINER_RIGHT, y);
      this.gridGfx.strokePath();
    }
  }

  private drawWalls(): void {
    this.wallGfx.clear();

    // Left wall
    this.wallGfx.lineStyle(3, CONTAINER_BORDER_COLOR, 0.8);
    this.wallGfx.beginPath();
    this.wallGfx.moveTo(CONTAINER_LEFT, CONTAINER_TOP - 10);
    this.wallGfx.lineTo(CONTAINER_LEFT, CONTAINER_BOTTOM);
    this.wallGfx.strokePath();

    // Right wall
    this.wallGfx.beginPath();
    this.wallGfx.moveTo(CONTAINER_RIGHT, CONTAINER_TOP - 10);
    this.wallGfx.lineTo(CONTAINER_RIGHT, CONTAINER_BOTTOM);
    this.wallGfx.strokePath();

    // Bottom wall
    this.wallGfx.beginPath();
    this.wallGfx.moveTo(CONTAINER_LEFT, CONTAINER_BOTTOM);
    this.wallGfx.lineTo(CONTAINER_RIGHT, CONTAINER_BOTTOM);
    this.wallGfx.strokePath();

    // Outer glow effect on walls
    this.wallGfx.lineStyle(6, CONTAINER_BORDER_COLOR, 0.15);
    this.wallGfx.beginPath();
    this.wallGfx.moveTo(CONTAINER_LEFT, CONTAINER_TOP - 10);
    this.wallGfx.lineTo(CONTAINER_LEFT, CONTAINER_BOTTOM);
    this.wallGfx.lineTo(CONTAINER_RIGHT, CONTAINER_BOTTOM);
    this.wallGfx.lineTo(CONTAINER_RIGHT, CONTAINER_TOP - 10);
    this.wallGfx.strokePath();
  }

  private drawOverflowLine(time: number): void {
    this.overflowGfx.clear();
    const alpha = 0.4 + 0.3 * Math.sin(time * 0.003);

    // Main line
    this.overflowGfx.lineStyle(2, OVERFLOW_COLOR, alpha);
    this.overflowGfx.beginPath();
    this.overflowGfx.moveTo(CONTAINER_LEFT + 2, OVERFLOW_Y);
    this.overflowGfx.lineTo(CONTAINER_RIGHT - 2, OVERFLOW_Y);
    this.overflowGfx.strokePath();

    // "Game Over" text label
    // (We just draw dashes to indicate the danger zone)
    this.overflowGfx.lineStyle(1, OVERFLOW_COLOR, alpha * 0.5);
    const dashLen = 6;
    const gap = 8;
    for (let x = CONTAINER_LEFT + 5; x < CONTAINER_RIGHT - 5; x += dashLen + gap) {
      this.overflowGfx.beginPath();
      this.overflowGfx.moveTo(x, OVERFLOW_Y - 3);
      this.overflowGfx.lineTo(x + dashLen, OVERFLOW_Y - 3);
      this.overflowGfx.strokePath();
    }
  }

  private drawVignette(): void {
    this.vignetteGfx.clear();

    // Corner darkening (simple rects with gradient alpha)
    const size = 120;
    for (let i = 0; i < 8; i++) {
      const alpha = 0.15 - i * 0.018;
      if (alpha <= 0) break;
      this.vignetteGfx.fillStyle(0x000000, alpha);

      // Top
      this.vignetteGfx.fillRect(0, i * (size / 8), GAME_WIDTH, size / 8);
      // Bottom
      this.vignetteGfx.fillRect(0, GAME_HEIGHT - (i + 1) * (size / 8), GAME_WIDTH, size / 8);
      // Left
      this.vignetteGfx.fillRect(i * (size / 8), 0, size / 8, GAME_HEIGHT);
      // Right
      this.vignetteGfx.fillRect(GAME_WIDTH - (i + 1) * (size / 8), 0, size / 8, GAME_HEIGHT);
    }
  }
}
