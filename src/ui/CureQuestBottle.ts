import Phaser from 'phaser';
import type { JellyBall } from '../entities/JellyBall';
import type { ParticleManager } from '../effects/ParticleManager';
import { formatQuestTarget } from '../data/levels';
import { ballLabelStyle, THROWABLE_LABEL_FONT } from '../entities/BallEntity';

const TEX_SIZE = 256;
const BOTTLE_INTERIOR = { x: 52, y: 86, w: 152, h: 122, r: 20 };
const FILL_BY_STEP = [0.06, 0.42, 0.74, 1.0];
const FILL_TWEEN_MS = 900;
const MUSHROOM_SLOT_PX = 24;
const MUSHROOM_SLOT_GAP = 26;
const COUNTER_BELOW_BOTTLE = 36;
const COUNTER_PILL_MIN_W = 115;
const COUNTER_PILL_H_FULL = 52;
const COUNTER_PILL_H_COMPACT = 40;
const MUSHROOM_EMPTY_TINT = 0x6a7288;
const MUSHROOM_EMPTY_ALPHA = 0.42;
const FX_DEPTH = 55;

const CURE_BLUE = 0x3888ec;
const CURE_BLUE_LIGHT = 0x55aaff;
const CURE_BLUE_NEON = 0x1490ff;
const CURE_BLUE_DARK = 0x2e6aaa;
const CURE_BLUE_MUTED = 0x5280c0;
const CURE_BLUE_DEEP = 0x3280b8;
const CURE_BLUE_PALE = 0xb0d4ff;
const CURE_BLUE_MIST = 0xe0eeff;
const CURE_BLUE_FLASH = 0xcce0ff;
const CURE_BLUE_TINT = 0xaac8ff;
const CURE_BLUE_STR = '#55aaff';
const QUEST_TARGET_LABEL = ballLabelStyle('green');
const CURE_BLUE_STROKE = '#102840';
const CURE_BLUE_INNER = 0x162030;
const CURE_BLUE_FILL = 0x0c1828;
const CURE_BLUE_BORDER_IDLE = 0x3d4a5c;

interface MushroomSlot {
  root: Phaser.GameObjects.Container;
  icon: Phaser.GameObjects.Image;
}

interface BottleGeom {
  display: number;
  bodyCx: number;
  bodyCy: number;
  bodyW: number;
  bodyH: number;
  bodyR: number;
  fillLeft: number;
  fillTop: number;
  fillBottom: number;
  emblemSize: number;
  questLabelX: number;
  questLabelY: number;
  bottleMouthY: number;
}

function bottleGeom(display: number): BottleGeom {
  const scale = display / TEX_SIZE;
  const bodyCx = ((BOTTLE_INTERIOR.x + BOTTLE_INTERIOR.w / 2) - TEX_SIZE / 2) * scale;
  const bodyCy = ((BOTTLE_INTERIOR.y + BOTTLE_INTERIOR.h / 2) - TEX_SIZE / 2) * scale;
  const bodyW = BOTTLE_INTERIOR.w * scale;
  const bodyH = BOTTLE_INTERIOR.h * scale;
  const bodyR = BOTTLE_INTERIOR.r * scale;
  const emblemSize = bodyW * 0.68;
  return {
    display,
    bodyCx,
    bodyCy,
    bodyW,
    bodyH,
    bodyR,
    fillLeft: bodyCx - bodyW / 2,
    fillTop: bodyCy - bodyH / 2,
    fillBottom: bodyCy + bodyH / 2,
    emblemSize,
    questLabelX: bodyCx,
    questLabelY: bodyCy - emblemSize * 0.22,
    bottleMouthY: bodyCy - emblemSize * 0.22 - 10,
  };
}

export class CureQuestBottle {
  private questTarget: number;
  private questRequired: number;
  readonly panelX: number;
  readonly bottleCy: number;
  readonly geom: BottleGeom;

  private readonly scene: Phaser.Scene;
  private readonly particles: ParticleManager | null;
  private readonly root: Phaser.GameObjects.Container;
  private readonly bottleContainer: Phaser.GameObjects.Container;
  private readonly liquidGfx: Phaser.GameObjects.Graphics;
  private readonly shellImg: Phaser.GameObjects.Image;
  private readonly emblemImg: Phaser.GameObjects.Image;
  private readonly questTargetText: Phaser.GameObjects.Text;
  private readonly counterRoot: Phaser.GameObjects.Container;
  private readonly counterPill: Phaser.GameObjects.Rectangle;
  private readonly counterValueText: Phaser.GameObjects.Text;
  private readonly mushroomSlots: MushroomSlot[] = [];
  private readonly slotPulsing: boolean[] = [];
  private readonly counterWorldY: number;
  private readonly fillTweenState = { level: FILL_BY_STEP[0] };
  private fillTween: Phaser.Tweens.Tween | null = null;
  private collected = 0;
  /** Dual-bottle / perf path — no mask, no stroked text, minimal graphics. */
  private readonly liteVisual: boolean;

  constructor(
    scene: Phaser.Scene,
    parent: Phaser.GameObjects.Container,
    panelX: number,
    bottleCy: number,
    questTarget: number,
    questRequired: number,
    displaySize: number,
    particles?: ParticleManager,
    useLiquidMask = true,
    maxSlotCount?: number,
  ) {
    this.scene = scene;
    this.particles = particles ?? null;
    this.panelX = panelX;
    this.bottleCy = bottleCy;
    this.questTarget = questTarget;
    this.questRequired = questRequired;
    this.geom = bottleGeom(displaySize);
    this.liteVisual = !useLiquidMask;
    this.root = scene.add.container(0, 0);
    parent.add(this.root);

    this.bottleContainer = scene.add.container(panelX, bottleCy);
    this.root.add(this.bottleContainer);

    const bottleBack = scene.add.container(0, 0);
    this.bottleContainer.add(bottleBack);

    const g = this.geom;
    const liquidMask = useLiquidMask ? this.createBodyMask(scene, bottleBack) : null;

    if (!this.liteVisual) {
      const innerBg = scene.add.graphics();
      innerBg.fillStyle(CURE_BLUE_INNER, 1);
      innerBg.fillRoundedRect(g.fillLeft, g.fillTop, g.bodyW, g.bodyH, g.bodyR);
      if (liquidMask) innerBg.setMask(liquidMask);
      bottleBack.add(innerBg);
    }

    this.liquidGfx = scene.add.graphics();
    if (liquidMask) this.liquidGfx.setMask(liquidMask);
    if (this.liteVisual) this.liquidGfx.setVisible(false);
    bottleBack.add(this.liquidGfx);

    this.emblemImg = scene.add.image(g.bodyCx, g.bodyCy, 'bluecap_mushroom_clean');
    this.emblemImg.setOrigin(0.5);
    this.emblemImg.setDisplaySize(g.emblemSize, g.emblemSize);
    bottleBack.add(this.emblemImg);

    this.shellImg = scene.add.image(0, 0, 'bottle_01_shell');
    this.shellImg.setDisplaySize(g.display, g.display);
    bottleBack.add(this.shellImg);

    this.questTargetText = scene.add
      .text(g.questLabelX, g.questLabelY, formatQuestTarget(questTarget), {
        fontFamily: THROWABLE_LABEL_FONT,
        fontSize: displaySize >= 140 ? '13px' : '11px',
        fontStyle: 'bold',
        color: QUEST_TARGET_LABEL.color,
        stroke: QUEST_TARGET_LABEL.stroke,
        strokeThickness: displaySize >= 140 ? 5 : QUEST_TARGET_LABEL.strokeThickness,
      })
      .setOrigin(0.5);
    bottleBack.add(this.questTargetText);

    this.counterWorldY = bottleCy + g.display / 2 + COUNTER_BELOW_BOTTLE;
    this.counterRoot = scene.add.container(panelX, this.counterWorldY).setDepth(4);
    this.root.add(this.counterRoot);

    const slotCount = maxSlotCount ?? questRequired;
    const isFull = displaySize >= 140;
    const counterW = Math.max(isFull ? COUNTER_PILL_MIN_W : 91, (slotCount - 1) * MUSHROOM_SLOT_GAP + 47);
    const counterH = isFull ? COUNTER_PILL_H_FULL : COUNTER_PILL_H_COMPACT;

    this.counterPill = scene.add
      .rectangle(0, 0, counterW, counterH, 0x0a1810, this.liteVisual ? 1 : 0.94)
      .setStrokeStyle(2, CURE_BLUE_BORDER_IDLE, 0.65);
    this.counterRoot.add(this.counterPill);

    const slotY = isFull ? -10 : -7;
    for (let i = 0; i < slotCount; i++) {
      const slotX = (i - (questRequired - 1) / 2) * MUSHROOM_SLOT_GAP;
      this.mushroomSlots.push(this.createMushroomSlot(scene, slotX, slotY));
      this.slotPulsing.push(false);
      if (i >= questRequired) this.mushroomSlots[i].root.setVisible(false);
    }

    this.counterValueText = scene.add
      .text(0, isFull ? 12 : 9, `0 / ${questRequired}`, {
        fontFamily: 'system-ui, "Arial Black", sans-serif',
        fontSize: isFull ? '15px' : '12px',
        fontStyle: 'bold',
        color: CURE_BLUE_STR,
        ...(this.liteVisual ? {} : { stroke: CURE_BLUE_STROKE, strokeThickness: 3 }),
      })
      .setOrigin(0.5);
    this.counterRoot.add(this.counterValueText);

    if (!this.liteVisual) this.redrawLiquid();
    this.updateCounterDisplay(0);
  }

  getQuestTarget(): number {
    return this.questTarget;
  }

  getCollected(): number {
    return this.collected;
  }

  isComplete(): boolean {
    return this.collected >= this.questRequired;
  }

  canAccept(value: number): boolean {
    return value === this.questTarget && !this.isComplete();
  }

  incrementProgress(): number {
    if (this.isComplete()) return this.collected;
    this.collected++;
    this.applyProgress(this.collected);
    return this.collected;
  }

  getHarvestTarget(): { x: number; y: number } {
    return { x: this.panelX, y: this.bottleCy + this.geom.bodyCy };
  }

  onHarvestComplete(): void {
    this.playBottleMagicEffect();
    this.playCollectChing();
  }

  /** Phase complete — drain, empty, swap target (sequential single-bottle). */
  transitionPhase(target: number, required: number, onComplete: () => void): void {
    this.fillTween?.stop();
    this.scene.tweens.add({
      targets: this.fillTweenState,
      level: FILL_BY_STEP[0],
      duration: 700,
      ease: 'Cubic.easeIn',
      onUpdate: () => this.redrawLiquid(),
      onComplete: () => {
        this.collected = 0;
        this.questTarget = target;
        this.questRequired = required;
        this.fillTweenState.level = FILL_BY_STEP[0];

        const style = ballLabelStyle('green');
        this.questTargetText.setText(formatQuestTarget(target));
        this.questTargetText.setColor(style.color);
        this.questTargetText.setStroke(style.stroke, style.strokeThickness);

        this.relayoutSlots(required);
        this.updateCounterDisplay(0);
        if (this.liteVisual) this.liquidGfx.setVisible(false);
        else this.redrawLiquid();

        this.scene.tweens.add({
          targets: this.questTargetText,
          scale: 1.2,
          duration: 220,
          yoyo: true,
          ease: 'Back.easeOut',
          onComplete,
        });
      },
    });
  }

  private relayoutSlots(required: number): void {
    for (let i = 0; i < this.mushroomSlots.length; i++) {
      const slot = this.mushroomSlots[i];
      if (i >= required) {
        slot.root.setVisible(false);
        this.stopSlotPulse(i);
        continue;
      }
      slot.root.setVisible(true);
      slot.root.x = (i - (required - 1) / 2) * MUSHROOM_SLOT_GAP;
      this.stopSlotPulse(i);
      this.setSlotEmpty(slot);
    }
  }

  private targetFill(step: number): number {
    if (step <= 0) return FILL_BY_STEP[0];
    if (this.questRequired === 3) return FILL_BY_STEP[step] ?? 1;
    return 0.06 + (step / this.questRequired) * 0.94;
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

  private createBodyMask(
    scene: Phaser.Scene,
    parent: Phaser.GameObjects.Container,
  ): Phaser.Display.Masks.GeometryMask {
    const g = this.geom;
    const maskGfx = scene.add.graphics();
    maskGfx.setVisible(false);
    maskGfx.fillStyle(0xffffff, 1);
    maskGfx.fillRoundedRect(g.fillLeft, g.fillTop, g.bodyW, g.bodyH, g.bodyR);
    parent.add(maskGfx);
    return maskGfx.createGeometryMask();
  }

  private mushroomBaseScale(slot: MushroomSlot): number {
    return MUSHROOM_SLOT_PX / slot.icon.frame.width;
  }

  private setSlotEmpty(slot: MushroomSlot): void {
    slot.icon.setScale(this.mushroomBaseScale(slot));
    slot.icon.setTint(MUSHROOM_EMPTY_TINT);
    slot.icon.setAlpha(MUSHROOM_EMPTY_ALPHA);
    slot.root.setScale(1);
  }

  private setSlotFilled(slot: MushroomSlot): void {
    slot.icon.setScale(this.mushroomBaseScale(slot));
    slot.icon.clearTint();
    slot.icon.setAlpha(1);
  }

  private updateCounterDisplay(step: number, newlyFilledIndex = -1): void {
    this.counterValueText.setText(`${step} / ${this.questRequired}`);
    this.counterPill.setStrokeStyle(2, step > 0 ? CURE_BLUE : CURE_BLUE_BORDER_IDLE, step > 0 ? 0.95 : 0.55);
    this.counterPill.setFillStyle(step > 0 ? CURE_BLUE_FILL : 0x0a1810, step > 0 ? 0.96 : 0.94);

    for (let i = 0; i < this.mushroomSlots.length; i++) {
      const slot = this.mushroomSlots[i];
      if (i < step) {
        this.setSlotFilled(slot);
        if (i === newlyFilledIndex) this.popSlot(i);
        else if (!this.slotPulsing[i]) this.startSlotPulse(i);
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
    this.particles?.burst(wx, wy, CURE_BLUE, 6, 2, 340);
    this.scene.tweens.add({
      targets: slot.root,
      scale: 1.35,
      duration: 140,
      yoyo: true,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.setSlotFilled(slot);
        this.startSlotPulse(index);
      },
    });
  }

  private applyProgress(step: number): void {
    this.updateCounterDisplay(step, step - 1);
    if (this.liteVisual && step > 0) this.liquidGfx.setVisible(true);
    const targetFill = this.targetFill(step);
    this.fillTween?.stop();
    this.redrawLiquid();
    this.fillTween = this.scene.tweens.add({
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

    this.scene.tweens.killTweensOf(this.questTargetText);
    this.scene.tweens.add({
      targets: this.bottleContainer,
      scaleX: 1.06,
      scaleY: 1.06,
      duration: 180,
      yoyo: true,
      ease: 'Back.easeOut',
    });
    this.scene.tweens.add({
      targets: this.counterRoot,
      scale: 1.12,
      duration: 150,
      yoyo: true,
      ease: 'Back.easeOut',
    });
    this.scene.tweens.add({
      targets: this.questTargetText,
      scale: 1.12,
      duration: 200,
      yoyo: true,
      ease: 'Back.easeOut',
    });
  }

  private redrawLiquid(): void {
    const g = this.geom;
    const gfx = this.liquidGfx;
    gfx.clear();
    const level = this.fillTweenState.level;
    if (level <= 0.02) return;

    const fillH = g.fillBottom - g.fillTop;
    const surfaceY = g.fillBottom - fillH * level;
    gfx.fillStyle(CURE_BLUE_DARK, 1);
    gfx.fillRect(g.fillLeft, surfaceY, g.bodyW, g.fillBottom - surfaceY + 4);
    gfx.fillStyle(CURE_BLUE_LIGHT, 0.9);
    gfx.fillRect(g.fillLeft + 2, surfaceY, g.bodyW - 4, 5);
  }

  private playBottleMagicEffect(): void {
    const g = this.geom;
    const mouthX = this.panelX + g.bodyCx;
    const mouthY = this.bottleCy + g.bottleMouthY;
    this.particles?.bottleMagicPuff(mouthX, mouthY);

    const ring = this.scene.add.graphics().setDepth(FX_DEPTH).setPosition(mouthX, mouthY);
    ring.lineStyle(2, CURE_BLUE_LIGHT, 0.85);
    ring.strokeCircle(0, 0, 8);
    this.scene.tweens.add({
      targets: ring,
      scaleX: 2.4,
      scaleY: 2.4,
      alpha: 0,
      duration: 520,
      ease: 'Cubic.easeOut',
      onComplete: () => ring.destroy(),
    });

    this.emblemImg.setTint(CURE_BLUE_TINT);
    this.scene.tweens.add({
      targets: this.emblemImg,
      scaleX: this.emblemImg.scaleX * 1.08,
      scaleY: this.emblemImg.scaleY * 1.08,
      duration: 120,
      yoyo: true,
      repeat: 1,
      ease: 'Sine.easeOut',
      onComplete: () => this.emblemImg.clearTint(),
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
    this.root.destroy(true);
  }
}
