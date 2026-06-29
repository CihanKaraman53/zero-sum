import Phaser from 'phaser';

/** Quest bottle interior cut-out in source texture pixels (256×256). */
const BOTTLE_INTERIOR = { x: 52, y: 86, w: 152, h: 122, r: 20 };

function punchRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/**
 * BootScene — handles loading assets (like fonts) before starting the game.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload() {
    const cx = this.cameras.main.width / 2;
    const cy = this.cameras.main.height / 2;

    this.add.text(cx, cy, 'LOADING SYSTEM...', {
      fontFamily: 'monospace',
      fontSize: '20px',
      color: '#00ff88',
    }).setOrigin(0.5);

    this.load.image('positive_ball', 'assets/nature_orb.webp');
    this.load.image('negative_ball', 'assets/fire_orb.webp');
    this.load.image('x2_ball', 'assets/x2_ball.webp');
    this.load.image('blast_ball', 'assets/blast_ball.webp');
    this.load.image('slice_ball', 'assets/slice_ball.webp');
    this.load.image('dice_ball', 'assets/dice_ball.webp');
    this.load.image('magnet_ball', 'assets/magnet_ball.webp');
    this.load.image('ghost_ball', 'assets/ghost_ball.webp');
    this.load.image('launcher', 'assets/launcher.webp');
    this.load.image('bottle_01', 'assets/bottle_01.webp');
    this.load.image('bluecap_mushroom', 'assets/bluecap_mushroom.webp');
    this.load.image('greater_stamina_potion', 'assets/greater_stamina_potion.webp');
    this.load.image('potion_plus8', 'assets/potion_plus8.webp');
    this.load.image('mage_gloves', 'assets/mage_gloves.webp');
    this.load.image('menu_bg', 'assets/zero_cure_menu.webp');
  }

  private applyTextureFilters(): void {
    const keys = [
      'positive_ball', 'negative_ball', 'x2_ball', 'blast_ball',
      'slice_ball', 'dice_ball', 'magnet_ball', 'ghost_ball', 'launcher',
      'bottle_01', 'bottle_01_shell', 'bluecap_mushroom', 'bluecap_mushroom_clean',
      'greater_stamina_potion', 'stamina_potion_clean',
      'potion_plus8', 'potion_plus8_clean',
      'mage_gloves', 'mage_gloves_clean',
    ];
    for (const key of keys) {
      if (this.textures.exists(key)) {
        this.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
      }
    }
  }

  create() {
    this.applyTextureFilters();
    this.buildBottleShellTexture();
    this.buildBluecapMushroomTexture();
    this.buildStaminaPotionTexture();
    this.buildPotionPlus8Texture();
    this.buildMageGlovesTexture();
    this.time.delayedCall(500, () => {
      this.scene.start('MenuScene');
    });
  }

  /** Bluecap mushroom emblem with keyed black background. */
  private buildBluecapMushroomTexture(): void {
    const key = 'bluecap_mushroom_clean';
    if (this.textures.exists(key)) return;

    const src = this.textures.get('bluecap_mushroom').getSourceImage() as HTMLImageElement;
    const w = src.width;
    const h = src.height;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(src, 0, 0, w, h);

    const pixels = ctx.getImageData(0, 0, w, h);
    for (let i = 0; i < pixels.data.length; i += 4) {
      const r = pixels.data[i];
      const g = pixels.data[i + 1];
      const b = pixels.data[i + 2];
      if (r < 48 && g < 48 && b < 48) {
        pixels.data[i + 3] = 0;
      }
    }
    ctx.putImageData(pixels, 0, 0);
    this.textures.addCanvas(key, canvas);
  }

  /** Stamina potion — atılabilir yeşil top, keyed black background. */
  private buildStaminaPotionTexture(): void {
    const key = 'stamina_potion_clean';
    if (this.textures.exists(key)) return;

    const src = this.textures.get('greater_stamina_potion').getSourceImage() as HTMLImageElement;
    const w = src.width;
    const h = src.height;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(src, 0, 0, w, h);

    const pixels = ctx.getImageData(0, 0, w, h);
    for (let i = 0; i < pixels.data.length; i += 4) {
      const r = pixels.data[i];
      const g = pixels.data[i + 1];
      const b = pixels.data[i + 2];
      if (r < 52 && g < 52 && b < 52) {
        pixels.data[i + 3] = 0;
      }
    }
    ctx.putImageData(pixels, 0, 0);
    this.textures.addCanvas(key, canvas);
  }

  /** +8 şişe — beyaz arka plan keyed, sayı asset içinde. */
  private buildPotionPlus8Texture(): void {
    const key = 'potion_plus8_clean';
    if (this.textures.exists(key)) return;

    const src = this.textures.get('potion_plus8').getSourceImage() as HTMLImageElement;
    const w = src.width;
    const h = src.height;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(src, 0, 0, w, h);

    const pixels = ctx.getImageData(0, 0, w, h);
    for (let i = 0; i < pixels.data.length; i += 4) {
      const r = pixels.data[i];
      const g = pixels.data[i + 1];
      const b = pixels.data[i + 2];
      if (r > 235 && g > 235 && b > 235) {
        pixels.data[i + 3] = 0;
      }
    }
    ctx.putImageData(pixels, 0, 0);
    this.textures.addCanvas(key, canvas);
  }

  /** Mage gloves launcher — keyed black background. */
  private buildMageGlovesTexture(): void {
    const key = 'mage_gloves_clean';
    if (this.textures.exists(key)) return;

    const src = this.textures.get('mage_gloves').getSourceImage() as HTMLImageElement;
    const w = src.width;
    const h = src.height;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(src, 0, 0, w, h);

    const pixels = ctx.getImageData(0, 0, w, h);
    for (let i = 0; i < pixels.data.length; i += 4) {
      const r = pixels.data[i];
      const g = pixels.data[i + 1];
      const b = pixels.data[i + 2];
      if (r < 52 && g < 52 && b < 52) {
        pixels.data[i + 3] = 0;
      }
    }
    ctx.putImageData(pixels, 0, 0);
    this.textures.addCanvas(key, canvas);
  }

  /** Glass shell with square interior punched out — liquid shows through. */
  private buildBottleShellTexture(): void {
    const key = 'bottle_01_shell';
    if (this.textures.exists(key)) return;

    const src = this.textures.get('bottle_01').getSourceImage() as HTMLImageElement;
    const w = 256;
    const h = 256;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(src, 0, 0, w, h);
    ctx.globalCompositeOperation = 'destination-out';
    const { x, y, w: iw, h: ih, r } = BOTTLE_INTERIOR;
    punchRoundRect(ctx, x, y, iw, ih, r);
    ctx.fill();
    this.textures.addCanvas(key, canvas);
  }
}
