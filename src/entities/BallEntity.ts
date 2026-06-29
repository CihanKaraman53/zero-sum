import Phaser from 'phaser';

export type BallSpecial = 'multiply' | 'divide' | 'blast' | 'slice' | 'chance' | null;
export type BallFaction = 'green' | 'red';

/** Yeşil atılabilir top — mavi mantar. */
export const GREEN_THROWABLE_TEXTURE = 'bluecap_mushroom_clean';

/** bluecap_mushroom.png — opaque bbox yarıçapları (kaynak piksel, merkez = 256). */
export const MUSHROOM_OPAQUE_HALF_W = 164.5;
export const MUSHROOM_OPAQUE_HALF_H = 194;

/** Görseli fizik dairesine oturt: şapka genişliği = çap (2×radius). */
export function mushroomScaleForRadius(radius: number): number {
  return radius / MUSHROOM_OPAQUE_HALF_W;
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
} {
  if (faction === 'green') {
    return { color: '#fff6b3', stroke: '#1a4a12', strokeThickness: 5 };
  }
  return { color: '#ffe4f0', stroke: '#4a1028', strokeThickness: 5 };
}

export function applyBallLabelStyle(
  text: Phaser.GameObjects.Text,
  faction: BallFaction,
): void {
  const style = ballLabelStyle(faction);
  text.setColor(style.color);
  text.setStroke(style.stroke, style.strokeThickness);
  text.setShadow(0, 1, '#000000', 6, true, true);
}
