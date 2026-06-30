import Phaser from 'phaser';

const BAR_H = 7;
const BORDER = 0xe8d5a8;

/**
 * Arena altında hamle sayacı — `35/0` formatında (limit / kullanılan).
 * Her atışta ikinci sayı artar; bar doluluk oranı kullanılan hamleyi gösterir.
 */
export class CureMoveBar {
  private readonly root: Phaser.GameObjects.Container;
  private readonly fill: Phaser.GameObjects.Rectangle;
  private readonly label: Phaser.GameObjects.Text;
  private readonly totalMoves: number;
  private readonly maxFillW: number;

  constructor(
    scene: Phaser.Scene,
    totalMoves: number,
    centerX: number,
    bottomY: number,
    width: number,
  ) {
    this.totalMoves = totalMoves;
    const barW = Math.max(80, width);
    this.maxFillW = barW - 6;
    const barCy = bottomY - BAR_H / 2 - 14;

    this.root = scene.add.container(0, 0).setDepth(38);

    const track = scene.add
      .rectangle(centerX, barCy, barW, BAR_H, 0x0a1218, 0.55)
      .setStrokeStyle(1.5, BORDER, 0.85);
    this.fill = scene.add
      .rectangle(centerX - barW / 2 + 3, barCy, 0, BAR_H - 4, 0x3888ec, 0.95)
      .setOrigin(0, 0.5);
    this.label = scene.add
      .text(centerX, barCy + BAR_H / 2 + 6, `${totalMoves}/0`, {
        fontFamily: '"Orbitron", system-ui, sans-serif',
        fontSize: '14px',
        fontStyle: 'bold',
        color: '#e8d5a8',
      })
      .setOrigin(0.5, 0);

    this.root.add([track, this.fill, this.label]);
    this.setUsed(0);
  }

  setUsed(used: number): void {
    const clamped = Phaser.Math.Clamp(used, 0, this.totalMoves);
    const ratio = clamped / this.totalMoves;
    this.fill.width = this.maxFillW * ratio;
    this.label.setText(`${this.totalMoves}/${clamped}`);

    if (ratio >= 0.85) this.fill.setFillStyle(0xff4455, 0.95);
    else if (ratio >= 0.65) this.fill.setFillStyle(0xffaa44, 0.95);
    else this.fill.setFillStyle(0x3888ec, 0.95);
  }

  destroy(): void {
    this.root.destroy(true);
  }
}
