import Phaser from 'phaser';
import {
  CURE_L1_LAUNCHER_Y,
  CURE_L1_PADDING,
  CURE_L1_PLAY_WIDTH,
  CURE_L1_QUEST_REQUIRED,
  CURE_L1_QUEST_TARGET,
  CURE_L1_QUEST_WIDTH,
  GAME_HEIGHT,
} from '../core/Constants';
import type { JellyBall } from '../entities/JellyBall';
import type { ParticleManager } from '../effects/ParticleManager';
import { applyBallLabelStyle, factionTexture, GREEN_THROWABLE_TEXTURE } from '../entities/BallEntity';
import type { DropQueueItem } from '../systems/LevelManager';

const BOTTLE_DISPLAY = 160;
const TEX_SIZE = 256;
const SCALE = BOTTLE_DISPLAY / TEX_SIZE;

/** Matches BootScene cut-out (256×256 source). */
const BOTTLE_INTERIOR = { x: 52, y: 86, w: 152, h: 122, r: 20 };

const BODY_CX = ((BOTTLE_INTERIOR.x + BOTTLE_INTERIOR.w / 2) - TEX_SIZE / 2) * SCALE;
const BODY_CY = ((BOTTLE_INTERIOR.y + BOTTLE_INTERIOR.h / 2) - TEX_SIZE / 2) * SCALE;
const BODY_W = BOTTLE_INTERIOR.w * SCALE;
const BODY_H = BOTTLE_INTERIOR.h * SCALE;
const BODY_R = BOTTLE_INTERIOR.r * SCALE;
const FILL_LEFT = BODY_CX - BODY_W / 2;
const FILL_TOP = BODY_CY - BODY_H / 2;
const FILL_BOTTOM = BODY_CY + BODY_H / 2;

const FILL_BY_STEP = [0.06, 0.42, 0.74, 1.0];
const FILL_TWEEN_MS = 900;

const EMBLEM_SIZE = BODY_W * 0.68;
const QUEST_LABEL_X = BODY_CX;
const QUEST_LABEL_Y = BODY_CY - EMBLEM_SIZE * 0.22;
/** Mushroom cap / cork — effect origin in bottle-local space. */
const BOTTLE_MOUTH_Y = QUEST_LABEL_Y - 10;

interface MushroomSlot {
  root: Phaser.GameObjects.Container;
  icon: Phaser.GameObjects.Image;
}

const MUSHROOM_SLOT_PX = 22;
const MUSHROOM_SLOT_GAP = 17;
const COUNTER_BELOW_BOTTLE = 50;

/** Soluk (henüz toplanmamış) mantar rengi. */
const MUSHROOM_EMPTY_TINT = 0x6a7288;
const MUSHROOM_EMPTY_ALPHA = 0.42;

const UPCOMING_BALL_PX = 32;
const UPCOMING_SLOT_GAP = 44;
const QUEST_PANEL_H = GAME_HEIGHT - 32;
const QUEST_PANEL_TOP = (GAME_HEIGHT - QUEST_PANEL_H) / 2;

interface UpcomingSlot {
  root: Phaser.GameObjects.Container;
  glow: Phaser.GameObjects.Arc;
  sprite: Phaser.GameObjects.Sprite;
  label: Phaser.GameObjects.Text;
}

const FX_DEPTH = 55;

/**
 * Zero Cure — square bottle with stencil-masked liquid fill (right quest panel).
 */
export class CureLevel1UI {
  private readonly scene: Phaser.Scene;
  private readonly particles: ParticleManager | null;
  private readonly root: Phaser.GameObjects.Container;
  private readonly liquidGfx: Phaser.GameObjects.Graphics;
  private readonly shellImg: Phaser.GameObjects.Image;
  private readonly emblemImg: Phaser.GameObjects.Image;
  private readonly questTargetText: Phaser.GameObjects.Text;
  private counterRoot!: Phaser.GameObjects.Container;
  private counterPill!: Phaser.GameObjects.Rectangle;
  private counterValueText!: Phaser.GameObjects.Text;
  private readonly mushroomSlots: MushroomSlot[] = [];
  private readonly slotPulsing: boolean[] = [];
  private counterWorldY = 0;
  private upcomingRoot!: Phaser.GameObjects.Container;
  private readonly upcomingSlots: UpcomingSlot[] = [];
  private readonly panelX: number;
  private readonly bottleCy: number;
  private readonly bottleContainer: Phaser.GameObjects.Container;
  private readonly fillTweenState = { level: FILL_BY_STEP[0] };
  private collected = 0;
  private harvesting = false;
  private fillTween: Phaser.Tweens.Tween | null = null;
  private readonly pendingHarvests: { ball: JellyBall; onComplete: () => void }[] = [];

  constructor(scene: Phaser.Scene, particles?: ParticleManager) {
    this.scene = scene;
    this.particles = particles ?? null;
    this.root = scene.add.container(0, 0).setDepth(1);
    this.panelX = CURE_L1_PLAY_WIDTH + CURE_L1_QUEST_WIDTH / 2;
    this.bottleCy = GAME_HEIGHT / 2 - 8;

    this.drawArena(scene);

    const bottle = scene.add.container(this.panelX, this.bottleCy);
    this.bottleContainer = bottle;
    this.root.add(bottle);

    const bottleBack = scene.add.container(0, 0);
    bottle.add(bottleBack);

    const liquidMask = this.createBodyMask(scene, bottleBack);

    const innerBg = scene.add.graphics();
    innerBg.fillStyle(0x1a2e16, 1);
    innerBg.fillRoundedRect(FILL_LEFT, FILL_TOP, BODY_W, BODY_H, BODY_R);
    innerBg.setMask(liquidMask);
    bottleBack.add(innerBg);

    this.liquidGfx = scene.add.graphics();
    this.liquidGfx.setMask(liquidMask);
    bottleBack.add(this.liquidGfx);

    this.emblemImg = scene.add.image(BODY_CX, BODY_CY, 'bluecap_mushroom_clean');
    this.emblemImg.setOrigin(0.5);
    this.emblemImg.setDisplaySize(EMBLEM_SIZE, EMBLEM_SIZE);
    bottleBack.add(this.emblemImg);

    this.shellImg = scene.add.image(0, 0, 'bottle_01_shell');
    this.shellImg.setDisplaySize(BOTTLE_DISPLAY, BOTTLE_DISPLAY);
    bottleBack.add(this.shellImg);

    this.questTargetText = scene.add
      .text(QUEST_LABEL_X, QUEST_LABEL_Y, `+${CURE_L1_QUEST_TARGET}`, {
        fontFamily: 'system-ui, "Arial Black", sans-serif',
        fontSize: '13px',
        fontStyle: 'bold',
        color: '#fff8c8',
        stroke: '#0d2810',
        strokeThickness: 6,
      })
      .setOrigin(0.5);
    this.questTargetText.setShadow(0, 2, '#000000', 6, true, true);
    bottleBack.add(this.questTargetText);

    this.redrawLiquid();
    this.buildCounter(scene);
    this.buildUpcomingQueue(scene);
  }

  /** Sıradaki 2 top — şişe panelinin en üstü, çerçevesiz. */
  private buildUpcomingQueue(scene: Phaser.Scene): void {
    const y = QUEST_PANEL_TOP + 30;
    this.upcomingRoot = scene.add.container(this.panelX, y).setDepth(5);

    for (let i = 0; i < 2; i++) {
      const slotX = (i - 0.5) * UPCOMING_SLOT_GAP;
      const slotRoot = scene.add.container(slotX, 0);

      const glow = scene.add.circle(0, 0, UPCOMING_BALL_PX * 0.52, 0x5ecc38, 0.14);
      glow.setBlendMode(Phaser.BlendModes.ADD);

      const sprite = scene.add.sprite(0, 0, GREEN_THROWABLE_TEXTURE);
      sprite.setAlpha(0.88);

      const label = scene.add.text(0, 0, '', {
        fontFamily: 'system-ui, "Arial Black", sans-serif',
        fontSize: '13px',
        fontStyle: 'bold',
      }).setOrigin(0.5);
      applyBallLabelStyle(label, 'green');

      slotRoot.add([glow, sprite, label]);
      this.upcomingRoot.add(slotRoot);
      this.upcomingSlots.push({ root: slotRoot, glow, sprite, label });
    }

    this.root.add(this.upcomingRoot);
  }

  updateUpcomingQueue(queue: DropQueueItem[]): void {
    for (let i = 0; i < this.upcomingSlots.length; i++) {
      const item = queue[i + 1];
      const slot = this.upcomingSlots[i];
      if (!item) {
        slot.root.setVisible(false);
        continue;
      }
      slot.root.setVisible(true);
      this.applyUpcomingVisual(slot, item);
    }
  }

  private applyUpcomingVisual(slot: UpcomingSlot, item: DropQueueItem): void {
    const { sprite, label } = slot;

    if (item.special === 'multiply') {
      sprite.setTexture('x2_ball');
      sprite.clearTint();
      label.setText('×2');
    } else if (item.special === 'blast') {
      sprite.setTexture('blast_ball');
      sprite.clearTint();
      label.setText('');
    } else if (item.special === 'slice') {
      sprite.setTexture('slice_ball');
      sprite.clearTint();
      label.setText('');
    } else if (item.special === 'chance') {
      sprite.setTexture('dice_ball');
      sprite.clearTint();
      label.setText('');
    } else if (item.special) {
      sprite.setTexture('positive_ball');
      sprite.setTint(0x00ccff);
      label.setText('');
    } else {
      sprite.setTexture(factionTexture(item.faction));
      sprite.clearTint();
      const prefix = item.value > 0 ? '+' : '';
      label.setText(`${prefix}${item.value}`);
    }

    applyBallLabelStyle(label, item.faction);
    sprite.setScale(UPCOMING_BALL_PX / sprite.frame.width);
    slot.glow.setRadius(UPCOMING_BALL_PX * 0.52);
  }

  private buildCounter(scene: Phaser.Scene): void {
    this.counterWorldY = this.bottleCy + BOTTLE_DISPLAY / 2 + COUNTER_BELOW_BOTTLE;
    this.counterRoot = scene.add.container(this.panelX, this.counterWorldY).setDepth(4);

    this.counterPill = scene.add
      .rectangle(0, 0, 76, 44, 0x0a1810, 0.94)
      .setStrokeStyle(2, 0x3d5244, 0.65);
    this.counterRoot.add(this.counterPill);

    const slotY = -8;
    for (let i = 0; i < CURE_L1_QUEST_REQUIRED; i++) {
      const slotX = (i - (CURE_L1_QUEST_REQUIRED - 1) / 2) * MUSHROOM_SLOT_GAP;
      this.mushroomSlots.push(this.createMushroomSlot(scene, slotX, slotY));
      this.slotPulsing.push(false);
    }

    this.counterValueText = scene.add
      .text(0, 10, `0 / ${CURE_L1_QUEST_REQUIRED}`, {
        fontFamily: 'system-ui, "Arial Black", sans-serif',
        fontSize: '14px',
        fontStyle: 'bold',
        color: '#7aff8a',
        stroke: '#0a2810',
        strokeThickness: 3,
      })
      .setOrigin(0.5);
    this.counterValueText.setShadow(0, 1, '#000000', 4, true, true);
    this.counterRoot.add(this.counterValueText);

    this.updateCounterDisplay(0);
  }

  private createMushroomSlot(scene: Phaser.Scene, x: number, y: number): MushroomSlot {
    const root = scene.add.container(x, y);
    const icon = scene.add.image(0, 0, 'bluecap_mushroom_clean');
    icon.setOrigin(0.5);
    icon.setScale(MUSHROOM_SLOT_PX / icon.frame.width);
    root.add(icon);
    this.counterRoot.add(root);
    return { root, icon };
  }

  private mushroomBaseScale(slot: MushroomSlot): number {
    return MUSHROOM_SLOT_PX / slot.icon.frame.width;
  }

  private applyMushroomScale(slot: MushroomSlot): void {
    slot.icon.setScale(this.mushroomBaseScale(slot));
  }

  private setSlotEmpty(slot: MushroomSlot): void {
    this.applyMushroomScale(slot);
    slot.icon.setTint(MUSHROOM_EMPTY_TINT);
    slot.icon.setAlpha(MUSHROOM_EMPTY_ALPHA);
    slot.root.setScale(1);
  }

  private setSlotFilled(slot: MushroomSlot): void {
    this.applyMushroomScale(slot);
    slot.icon.clearTint();
    slot.icon.setAlpha(1);
  }

  private updateCounterDisplay(step: number, newlyFilledIndex: number = -1): void {
    this.counterValueText.setText(`${step} / ${CURE_L1_QUEST_REQUIRED}`);

    this.counterPill.setStrokeStyle(2, step > 0 ? 0x5ecc38 : 0x3d5244, step > 0 ? 0.95 : 0.55);
    if (step > 0) {
      this.counterPill.setFillStyle(0x0c2014, 0.96);
    } else {
      this.counterPill.setFillStyle(0x0a1810, 0.94);
    }

    for (let i = 0; i < this.mushroomSlots.length; i++) {
      const slot = this.mushroomSlots[i];
      const filled = i < step;

      if (filled) {
        this.setSlotFilled(slot);
        if (i === newlyFilledIndex) {
          this.popSlot(i);
        } else if (!this.slotPulsing[i]) {
          this.startSlotPulse(i);
        }
      } else {
        this.stopSlotPulse(i);
        this.setSlotEmpty(slot);
      }
    }
  }

  private stopSlotPulse(index: number): void {
    const slot = this.mushroomSlots[index];
    this.scene.tweens.killTweensOf(slot.icon);
    this.scene.tweens.killTweensOf(slot.root);
    this.slotPulsing[index] = false;
  }

  private startSlotPulse(index: number): void {
    if (this.slotPulsing[index]) return;
    this.slotPulsing[index] = true;

    const icon = this.mushroomSlots[index].icon;
    const base = this.mushroomBaseScale(this.mushroomSlots[index]);
    this.scene.tweens.add({
      targets: icon,
      scale: { from: base * 0.94, to: base * 1.06 },
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private popSlot(index: number): void {
    const slot = this.mushroomSlots[index];
    this.stopSlotPulse(index);

    slot.icon.clearTint();
    slot.icon.setAlpha(1);

    const wx = this.panelX + slot.root.x;
    const wy = this.counterWorldY + slot.root.y;
    this.particles?.burst(wx, wy, 0x5ecc38, 8, 2, 340);
    this.particles?.burst(wx, wy, 0x88ccff, 5, 1.8, 280);

    this.scene.tweens.add({
      targets: slot.root,
      scale: 1.35,
      duration: 140,
      yoyo: true,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.setSlotFilled(slot);
        this.applyMushroomScale(slot);
        this.startSlotPulse(index);
      },
    });
  }

  private createBodyMask(
    scene: Phaser.Scene,
    parent: Phaser.GameObjects.Container,
  ): Phaser.Display.Masks.GeometryMask {
    const maskGfx = scene.add.graphics();
    maskGfx.setVisible(false);
    maskGfx.fillStyle(0xffffff, 1);
    maskGfx.fillRoundedRect(FILL_LEFT, FILL_TOP, BODY_W, BODY_H, BODY_R);
    parent.add(maskGfx);
    return maskGfx.createGeometryMask();
  }

  private drawArena(scene: Phaser.Scene): void {
    const playW = CURE_L1_PLAY_WIDTH - CURE_L1_PADDING * 2;
    const playH = GAME_HEIGHT - CURE_L1_PADDING * 2;
    const playCx = CURE_L1_PADDING + playW / 2;
    const playCy = CURE_L1_PADDING + playH / 2;
    const questW = CURE_L1_QUEST_WIDTH - 8;
    const questH = GAME_HEIGHT - 32;
    const borderColor = 0xe8d5a8;

    const playBg = scene.add
      .rectangle(playCx, playCy, playW, playH, 0x0a1610, 0.72)
      .setStrokeStyle(3, borderColor, 0.92);
    this.root.add(playBg);

    const arenaGfx = scene.add.graphics().setDepth(2);
    const spawnLineY = CURE_L1_LAUNCHER_Y + 40;
    arenaGfx.lineStyle(2, 0xffefd0, 0.62);
    arenaGfx.beginPath();
    arenaGfx.moveTo(CURE_L1_PADDING + 4, spawnLineY);
    arenaGfx.lineTo(CURE_L1_PLAY_WIDTH - CURE_L1_PADDING - 4, spawnLineY);
    arenaGfx.strokePath();
    this.root.add(arenaGfx);

    const panelBg = scene.add
      .rectangle(this.panelX, GAME_HEIGHT / 2, questW, questH, 0x101a14, 0.78)
      .setStrokeStyle(3, borderColor, 0.92);
    this.root.add(panelBg);
  }

  getCollected(): number {
    return this.collected;
  }

  isHarvesting(): boolean {
    return this.harvesting;
  }

  harvestFromBall(ball: JellyBall, onComplete: () => void): void {
    if (this.collected >= CURE_L1_QUEST_REQUIRED || !ball.active) {
      onComplete();
      return;
    }

    if (this.harvesting) {
      ball.prepareHarvest();
      ball.container.setDepth(44);
      this.pendingHarvests.push({ ball, onComplete });
      return;
    }

    this.runHarvest(ball, onComplete);
  }

  private runHarvest(ball: JellyBall, onComplete: () => void): void {
    this.harvesting = true;
    const scene = this.bottleContainerScene();
    const targetX = this.panelX;
    const targetY = this.bottleCy + BODY_CY;
    const startX = ball.container.x;
    const startY = ball.container.y;
    const startScaleX = ball.container.scaleX;
    const startScaleY = ball.container.scaleY;
    const arcPeakY = Math.min(startY, targetY) - 90;

    ball.playHarvestPulse(() => {
      if (!ball.active) {
        this.finishHarvest(onComplete);
        return;
      }

      ball.prepareHarvest();
      ball.container.setDepth(45);

      const flight = { t: 0 };
      scene.tweens.add({
        targets: flight,
        t: 1,
        duration: 720,
        ease: 'Cubic.easeIn',
        onUpdate: () => {
          const t = flight.t;
          const u = 1 - t;
          ball.container.x = u * u * startX + 2 * u * t * ((startX + targetX) / 2) + t * t * targetX;
          ball.container.y = u * u * startY + 2 * u * t * arcPeakY + t * t * targetY;
          ball.container.setScale(
            startScaleX * (1 - t * 0.55),
            startScaleY * (1 - t * 0.55),
          );
          ball.container.setAlpha(1 - t * 0.85);
        },
        onComplete: () => {
          this.playBottleMagicEffect();
          this.playCollectChing();
          ball.deactivate();
          this.incrementProgress();
          this.finishHarvest(onComplete);
        },
      });
    });
  }

  private finishHarvest(onComplete: () => void): void {
    onComplete();
    if (this.pendingHarvests.length === 0) {
      this.harvesting = false;
      return;
    }
    const next = this.pendingHarvests.shift()!;
    if (!next.ball.active) {
      next.onComplete();
      this.finishHarvest(() => {});
      return;
    }
    this.runHarvest(next.ball, next.onComplete);
  }

  incrementProgress(): number {
    if (this.collected >= CURE_L1_QUEST_REQUIRED) return this.collected;
    this.collected++;
    this.applyProgress(this.collected);
    return this.collected;
  }

  private applyProgress(step: number): void {
    this.updateCounterDisplay(step, step - 1);
    const targetFill = FILL_BY_STEP[step] ?? 1;

    this.fillTween?.stop();
    this.redrawLiquid();
    this.fillTween = this.bottleContainerScene().tweens.add({
      targets: this.fillTweenState,
      level: targetFill,
      duration: FILL_TWEEN_MS,
      ease: 'Sine.easeInOut',
      onUpdate: () => this.redrawLiquid(),
      onComplete: () => {
        this.fillTweenState.level = targetFill;
        this.redrawLiquid();
        this.fillTween = null;
      },
    });

    const scene = this.bottleContainerScene();
    scene.tweens.killTweensOf(this.questTargetText);

    scene.tweens.add({
      targets: this.bottleContainer,
      scaleX: 1.06,
      scaleY: 1.06,
      duration: 180,
      yoyo: true,
      ease: 'Back.easeOut',
    });

    scene.tweens.add({
      targets: this.counterRoot,
      scale: 1.12,
      duration: 150,
      yoyo: true,
      ease: 'Back.easeOut',
    });

    scene.tweens.add({
      targets: this.questTargetText,
      scale: 1.12,
      duration: 200,
      yoyo: true,
      ease: 'Back.easeOut',
    });
  }

  private redrawLiquid(): void {
    const g = this.liquidGfx;
    g.clear();

    const level = this.fillTweenState.level;
    if (level <= 0.02) return;

    const fillH = FILL_BOTTOM - FILL_TOP;
    const surfaceY = FILL_BOTTOM - fillH * level;

    g.fillStyle(0x4dcc2e, 1);
    g.fillRect(FILL_LEFT, surfaceY, BODY_W, FILL_BOTTOM - surfaceY + 4);

    g.fillStyle(0x7aff55, 0.9);
    g.fillRect(FILL_LEFT + 2, surfaceY, BODY_W - 4, 5);

    const bubbles = Math.floor(2 + level * 5);
    for (let i = 0; i < bubbles; i++) {
      const t = (i * 0.61) % 1;
      const by = surfaceY + 6 + (FILL_BOTTOM - surfaceY) * (0.12 + t * 0.75);
      const bx = FILL_LEFT + 10 + (BODY_W - 20) * ((i * 0.37) % 1);
      g.fillStyle(0xffffff, 0.35 + (i % 2) * 0.15);
      g.fillCircle(bx, by, 1.2 + (i % 2) * 0.7);
    }
  }

  private bottleContainerScene(): Phaser.Scene {
    return this.shellImg.scene;
  }

  private playBottleMagicEffect(): void {
    const scene = this.bottleContainerScene();
    const mouthX = this.panelX + BODY_CX;
    const mouthY = this.bottleCy + BOTTLE_MOUTH_Y;
    const bodyX = this.panelX + BODY_CX;
    const bodyY = this.bottleCy + BODY_CY;

    this.particles?.bottleMagicPuff(mouthX, mouthY);

    this.spawnMagicRings(scene, mouthX, mouthY);
    this.spawnSmokePlumes(scene, mouthX, mouthY);
    this.spawnStarBurst(scene, mouthX, mouthY);
    this.spawnInwardSparkles(scene, bodyX, bodyY, mouthX, mouthY);
    this.flashBottleAbsorb(scene);
    this.flashLiquidSurface(scene);
  }

  private spawnMagicRings(scene: Phaser.Scene, x: number, y: number): void {
    const colors = [0x7aff55, 0xc8ffb0, 0x39ff14];
    for (let i = 0; i < 3; i++) {
      const ring = scene.add.graphics().setDepth(FX_DEPTH).setPosition(x, y);
      ring.lineStyle(2.5 - i * 0.5, colors[i], 0.85 - i * 0.15);
      ring.strokeCircle(0, 0, 6 + i * 2);
      scene.tweens.add({
        targets: ring,
        scaleX: 2.4 + i * 0.5,
        scaleY: 2.4 + i * 0.5,
        alpha: 0,
        duration: 520 + i * 80,
        delay: i * 70,
        ease: 'Cubic.easeOut',
        onComplete: () => ring.destroy(),
      });
    }
  }

  private spawnSmokePlumes(scene: Phaser.Scene, x: number, y: number): void {
    for (let i = 0; i < 5; i++) {
      const plume = scene.add.ellipse(
        x + Phaser.Math.Between(-10, 10),
        y,
        12 + i * 2,
        7,
        i % 2 === 0 ? 0x6fdc52 : 0x4ab832,
        0.32,
      );
      plume.setDepth(FX_DEPTH - 2);
      const drift = Phaser.Math.Between(-18, 18);
      scene.tweens.add({
        targets: plume,
        y: y - 36 - i * 16,
        x: x + drift,
        scaleX: 2.4 + i * 0.25,
        scaleY: 2,
        alpha: 0,
        angle: Phaser.Math.Between(-20, 20),
        duration: 780 + i * 100,
        delay: i * 55,
        ease: 'Sine.easeOut',
        onComplete: () => plume.destroy(),
      });
    }
  }

  private spawnStarBurst(scene: Phaser.Scene, x: number, y: number): void {
    const burst = scene.add.graphics().setDepth(FX_DEPTH + 1).setPosition(x, y);
    const rays = 12;
    for (let i = 0; i < rays; i++) {
      const a = (i / rays) * Math.PI * 2;
      const inner = 3 + (i % 2) * 2;
      const outer = 14 + (i % 3) * 4;
      burst.lineStyle(i % 2 === 0 ? 2 : 1.5, i % 2 === 0 ? 0xe8ffe0 : 0x7aff55, 0.9);
      burst.lineBetween(Math.cos(a) * inner, Math.sin(a) * inner, Math.cos(a) * outer, Math.sin(a) * outer);
    }
    scene.tweens.add({
      targets: burst,
      scale: 2.5,
      alpha: 0,
      angle: 35,
      duration: 480,
      ease: 'Cubic.easeOut',
      onComplete: () => burst.destroy(),
    });
  }

  private spawnInwardSparkles(
    scene: Phaser.Scene,
    bodyX: number,
    bodyY: number,
    mouthX: number,
    mouthY: number,
  ): void {
    for (let i = 0; i < 8; i++) {
      const dot = scene.add.circle(
        bodyX + Phaser.Math.Between(-18, 18),
        bodyY + Phaser.Math.Between(-12, 12),
        1.5 + Math.random() * 1.5,
        0xffffff,
        0.95,
      );
      dot.setDepth(FX_DEPTH);
      dot.setBlendMode(Phaser.BlendModes.ADD);
      scene.tweens.add({
        targets: dot,
        x: mouthX + Phaser.Math.Between(-6, 6),
        y: mouthY - 4,
        alpha: 0,
        scale: 0.15,
        duration: 420 + i * 35,
        delay: i * 25,
        ease: 'Cubic.easeIn',
        onComplete: () => dot.destroy(),
      });
    }
  }

  private flashBottleAbsorb(scene: Phaser.Scene): void {
    scene.tweens.killTweensOf(this.emblemImg);
    scene.tweens.killTweensOf(this.questTargetText);

    this.emblemImg.setTint(0xaaffaa);
    scene.tweens.add({
      targets: this.emblemImg,
      scaleX: this.emblemImg.scaleX * 1.08,
      scaleY: this.emblemImg.scaleY * 1.08,
      duration: 120,
      yoyo: true,
      repeat: 1,
      ease: 'Sine.easeOut',
      onComplete: () => this.emblemImg.clearTint(),
    });

    scene.tweens.add({
      targets: this.questTargetText,
      scale: 1.2,
      duration: 140,
      yoyo: true,
      ease: 'Back.easeOut',
    });

    const halo = scene.add.circle(
      this.panelX + BODY_CX,
      this.bottleCy + BOTTLE_MOUTH_Y,
      10,
      0x7aff55,
      0.45,
    );
    halo.setDepth(FX_DEPTH - 1);
    halo.setBlendMode(Phaser.BlendModes.ADD);
    scene.tweens.add({
      targets: halo,
      scale: 3.2,
      alpha: 0,
      duration: 420,
      ease: 'Cubic.easeOut',
      onComplete: () => halo.destroy(),
    });
  }

  private flashLiquidSurface(scene: Phaser.Scene): void {
    const level = this.fillTweenState.level;
    if (level <= 0.02) return;

    const fillH = FILL_BOTTOM - FILL_TOP;
    const surfaceY = FILL_BOTTOM - fillH * level;
    const flash = scene.add.graphics().setDepth(48);
    flash.fillStyle(0xd4ffcc, 0.85);
    flash.fillRect(FILL_LEFT, surfaceY - 2, BODY_W, 6);
    flash.setPosition(this.panelX, this.bottleCy);

    scene.tweens.add({
      targets: flash,
      alpha: 0,
      y: this.bottleCy - 8,
      duration: 380,
      ease: 'Sine.easeOut',
      onComplete: () => flash.destroy(),
    });
  }

  private playCollectChing(): void {
    try {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;

      const ctx = new Ctor();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.28);
      osc.onended = () => void ctx.close();
    } catch {
      // audio optional
    }
  }

  destroy(): void {
    this.counterRoot.destroy(true);
    this.root.destroy(true);
  }
}
