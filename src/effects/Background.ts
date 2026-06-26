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
  
  public currentLeft: number = CONTAINER_LEFT;
  public currentRight: number = CONTAINER_RIGHT;
  public currentBottom: number = CONTAINER_BOTTOM;

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

  public updateContainerBounds(left: number, right: number, bottom: number): void {
    this.currentLeft = left;
    this.currentRight = right;
    this.currentBottom = bottom;
    this.drawBackground();
    this.drawWalls();
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

    // Container interior (darker focus zone + subtle neon grid shadow)
    this.bgGfx.fillStyle(0x060515, 0.9);
    this.bgGfx.fillRect(this.currentLeft, CONTAINER_TOP, this.currentRight - this.currentLeft, this.currentBottom - CONTAINER_TOP);

    // Subtle side shadows inside the tube
    this.bgGfx.fillStyle(0x0c0b24, 0.4);
    const shadowW = Math.min(30, (this.currentRight - this.currentLeft) / 2);
    this.bgGfx.fillRect(this.currentLeft, CONTAINER_TOP, shadowW, this.currentBottom - CONTAINER_TOP);
    this.bgGfx.fillRect(this.currentRight - shadowW, CONTAINER_TOP, shadowW, this.currentBottom - CONTAINER_TOP);
  }

  private drawGrid(): void {
    this.gridGfx.clear();
    this.gridGfx.lineStyle(1, 0x1a3355, 0.15);

    const spacing = 40;
    const offset = this.gridOffset;

    // Vertical lines
    for (let x = this.currentLeft; x <= this.currentRight; x += spacing) {
      this.gridGfx.beginPath();
      this.gridGfx.moveTo(x, CONTAINER_TOP);
      this.gridGfx.lineTo(x, this.currentBottom);
      this.gridGfx.strokePath();
    }

    // Horizontal lines (with scroll)
    for (let y = CONTAINER_TOP + offset; y <= this.currentBottom; y += spacing) {
      this.gridGfx.beginPath();
      this.gridGfx.moveTo(this.currentLeft, y);
      this.gridGfx.lineTo(this.currentRight, y);
      this.gridGfx.strokePath();
    }
  }

  private drawWalls(): void {
    this.wallGfx.clear();

    // 1. Left Neon Laser Beam (thick glow + bright white core)
    this.wallGfx.lineStyle(8, CONTAINER_BORDER_COLOR, 0.25);
    this.wallGfx.beginPath();
    this.wallGfx.moveTo(this.currentLeft, CONTAINER_TOP);
    this.wallGfx.lineTo(this.currentLeft, this.currentBottom);
    this.wallGfx.strokePath();

    this.wallGfx.lineStyle(3, 0xffffff, 0.95);
    this.wallGfx.beginPath();
    this.wallGfx.moveTo(this.currentLeft, CONTAINER_TOP);
    this.wallGfx.lineTo(this.currentLeft, this.currentBottom);
    this.wallGfx.strokePath();

    // 2. Right Neon Laser Beam (thick glow + bright white core)
    this.wallGfx.lineStyle(8, CONTAINER_BORDER_COLOR, 0.25);
    this.wallGfx.beginPath();
    this.wallGfx.moveTo(this.currentRight, CONTAINER_TOP);
    this.wallGfx.lineTo(this.currentRight, this.currentBottom);
    this.wallGfx.strokePath();

    this.wallGfx.lineStyle(3, 0xffffff, 0.95);
    this.wallGfx.beginPath();
    this.wallGfx.moveTo(this.currentRight, CONTAINER_TOP);
    this.wallGfx.lineTo(this.currentRight, this.currentBottom);
    this.wallGfx.strokePath();

    // 3. Bottom wall
    this.wallGfx.lineStyle(4, CONTAINER_BORDER_COLOR, 0.8);
    this.wallGfx.beginPath();
    this.wallGfx.moveTo(this.currentLeft, this.currentBottom);
    this.wallGfx.lineTo(this.currentRight, this.currentBottom);
    this.wallGfx.strokePath();

    // Outer glow effect on walls
    this.wallGfx.lineStyle(10, CONTAINER_BORDER_COLOR, 0.1);
    this.wallGfx.beginPath();
    this.wallGfx.moveTo(this.currentLeft, CONTAINER_TOP - 10);
    this.wallGfx.lineTo(this.currentLeft, this.currentBottom);
    this.wallGfx.lineTo(this.currentRight, this.currentBottom);
    this.wallGfx.lineTo(this.currentRight, CONTAINER_TOP - 10);
    this.wallGfx.strokePath();

    // 4. Hydraulic Anchors (Top-Left, Bottom-Left, Top-Right, Bottom-Right)
    const anchorW = 20;
    const anchorH = 12;
    this.wallGfx.fillStyle(0x1a2135, 1);
    this.wallGfx.lineStyle(2, 0x00ccff, 1);

    // Top-Left
    this.wallGfx.fillRoundedRect(this.currentLeft - anchorW / 2, CONTAINER_TOP - anchorH / 2, anchorW, anchorH, 2);
    this.wallGfx.strokeRoundedRect(this.currentLeft - anchorW / 2, CONTAINER_TOP - anchorH / 2, anchorW, anchorH, 2);

    // Bottom-Left
    this.wallGfx.fillRoundedRect(this.currentLeft - anchorW / 2, this.currentBottom - anchorH / 2, anchorW, anchorH, 2);
    this.wallGfx.strokeRoundedRect(this.currentLeft - anchorW / 2, this.currentBottom - anchorH / 2, anchorW, anchorH, 2);

    // Top-Right
    this.wallGfx.fillRoundedRect(this.currentRight - anchorW / 2, CONTAINER_TOP - anchorH / 2, anchorW, anchorH, 2);
    this.wallGfx.strokeRoundedRect(this.currentRight - anchorW / 2, CONTAINER_TOP - anchorH / 2, anchorW, anchorH, 2);

    // Bottom-Right
    this.wallGfx.fillRoundedRect(this.currentRight - anchorW / 2, this.currentBottom - anchorH / 2, anchorW, anchorH, 2);
    this.wallGfx.strokeRoundedRect(this.currentRight - anchorW / 2, this.currentBottom - anchorH / 2, anchorW, anchorH, 2);
  }

  private drawOverflowLine(time: number): void {
    this.overflowGfx.clear();
    const alpha = 0.4 + 0.3 * Math.sin(time * 0.003);
    const overflowY = (this.scene as any).dynamicOverflowY ?? OVERFLOW_Y;

    // Main line
    this.overflowGfx.lineStyle(2, OVERFLOW_COLOR, alpha);
    this.overflowGfx.beginPath();
    this.overflowGfx.moveTo(this.currentLeft + 2, overflowY);
    this.overflowGfx.lineTo(this.currentRight - 2, overflowY);
    this.overflowGfx.strokePath();

    // "Game Over" text label
    this.overflowGfx.lineStyle(1, OVERFLOW_COLOR, alpha * 0.5);
    const dashLen = 6;
    const gap = 8;
    for (let x = this.currentLeft + 5; x < this.currentRight - 5; x += dashLen + gap) {
      this.overflowGfx.beginPath();
      this.overflowGfx.moveTo(x, overflowY - 3);
      this.overflowGfx.lineTo(x + dashLen, overflowY - 3);
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
