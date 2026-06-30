import Phaser from 'phaser';

const BAR_H = 7;
const BORDER = 0xe8d5a8;

/**
 * Quest panel üstünde ince zaman çizgisi — sayı yok, doluluk oranından anlaşılır.
 */
export class CureTimerBar {
  private readonly root: Phaser.GameObjects.Container;
  private readonly fill: Phaser.GameObjects.Rectangle;
  private readonly totalSec: number;
  private readonly maxFillW: number;

  constructor(
    scene: Phaser.Scene,
    totalSec: number,
    centerX: number,
    topY: number,
    width: number,
  ) {
    this.totalSec = totalSec;
    const barW = Math.max(48, width);
    this.maxFillW = barW - 6;
    const barCy = topY + BAR_H / 2;

    this.root = scene.add.container(0, 0).setDepth(38);

    const track = scene.add
      .rectangle(centerX, barCy, barW, BAR_H, 0x0a1218, 0.55)
      .setStrokeStyle(1.5, BORDER, 0.85);
    this.fill = scene.add
      .rectangle(centerX - barW / 2 + 3, barCy, this.maxFillW, BAR_H - 4, 0x3888ec, 0.95)
      .setOrigin(0, 0.5);

    this.root.add([track, this.fill]);
    this.setRemaining(totalSec);
  }

  setRemaining(sec: number): void {
    const clamped = Math.max(0, sec);
    const ratio = clamped / this.totalSec;
    this.fill.width = this.maxFillW * ratio;

    if (ratio <= 0.15) this.fill.setFillStyle(0xff4455, 0.95);
    else if (ratio <= 0.35) this.fill.setFillStyle(0xffaa44, 0.95);
    else this.fill.setFillStyle(0x3888ec, 0.95);
  }

  destroy(): void {
    this.root.destroy(true);
  }
}
