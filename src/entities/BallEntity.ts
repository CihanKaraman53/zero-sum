import Phaser from 'phaser';

export type BallSpecial = 'multiply' | 'divide' | 'blast' | 'slice' | 'chance' | null;
export type BallFaction = 'green' | 'red';

/** Yeşil atılabilir top — mavi mantar. */
export const GREEN_THROWABLE_TEXTURE = 'bluecap_mushroom_clean';

/** bluecap_mushroom.png — opak yarı genişlik (kaynak piksel). */
export const MUSHROOM_OPAQUE_HALF_W = 164.5;

export function mushroomScaleForVisualRadius(visualRadius: number): number {
  return visualRadius / MUSHROOM_OPAQUE_HALF_W;
}

export function scaleForThrowableTexture(texKey: string, visualRadius: number): number {
  if (texKey === GREEN_THROWABLE_TEXTURE) return mushroomScaleForVisualRadius(visualRadius);
  return (visualRadius * 3.2) / 512;
}

/** Mantar üstü sayı tipografisi. */
export const THROWABLE_LABEL_FONT = '"Arial Black", Impact, system-ui, sans-serif';

export function applyThrowableLabel(
  label: Phaser.GameObjects.Text,
  visualRadius: number,
  offsetY = 0,
): void {
  label.setPosition(0, offsetY - visualRadius * 0.16);
}

export function throwableLabelFontSize(visualRadius: number, absValue: number): string {
  const r = visualRadius;
  const charCount = String(absValue).length + 1;
  let px: number;
  if (charCount <= 2) {
    px = Math.max(20, Math.round(r * 0.48));
  } else if (charCount === 3) {
    px = Math.max(18, Math.round(r * 0.40));
  } else if (charCount === 4) {
    px = Math.max(16, Math.round(r * 0.34));
  } else {
    px = Math.max(14, Math.round(r * 0.30));
  }
  return `${px}px`;
}

/** Shared contract for JellyBall entities. */
export interface BallEntity {
  poolKind: 'jelly';
  active: boolean;
  frozen: boolean;
  faction: BallFaction;
  value: number;
  sign: number;
  absValue: number;
  radius: number;
  visualRadius: number;
  anchorX: number;
  anchorY: number;
  isKing: boolean;
  special: BallSpecial;
  body: MatterJS.BodyType | null;
  sprite: Phaser.GameObjects.Sprite;
  playSquash(): void;
  deactivate(): void;
  setValue(newValue: number): void;
  makeKing(): void;
}

export function attachBallBody(body: MatterJS.BodyType, ball: BallEntity): void {
  (body as MatterJS.Body & { gameBall?: BallEntity }).gameBall = ball;
  (body as MatterJS.Body & { jellyBall?: BallEntity }).jellyBall = ball;
}

export function factionTexture(faction: BallFaction): string {
  return faction === 'green' ? GREEN_THROWABLE_TEXTURE : 'negative_ball';
}

export function ballLabelStyle(faction: BallFaction): {
  color: string;
  stroke: string;
  strokeThickness: number;
  shadowColor: string;
  shadowBlur: number;
  shadowOffsetY: number;
} {
  if (faction === 'green') {
    return {
      color: '#ffe566',
      stroke: '#1f3a18',
      strokeThickness: 4,
      shadowColor: '#0a1408',
      shadowBlur: 5,
      shadowOffsetY: 2,
    };
  }
  return {
    color: '#ffe4f0',
    stroke: '#4a1028',
    strokeThickness: 3,
    shadowColor: '#000000',
    shadowBlur: 3,
    shadowOffsetY: 1,
  };
}

export function applyBallLabelStyle(
  text: Phaser.GameObjects.Text,
  faction: BallFaction,
): void {
  const style = ballLabelStyle(faction);
  text.setColor(style.color);
  text.setStroke(style.stroke, style.strokeThickness);
  text.setShadow(style.shadowOffsetY, style.shadowOffsetY, style.shadowColor, style.shadowBlur, true, true);
}
