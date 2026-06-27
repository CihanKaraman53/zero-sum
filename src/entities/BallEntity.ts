import Phaser from 'phaser';

export type BallSpecial = 'multiply' | 'divide' | 'blast' | 'slice' | 'chance' | null;

/** Shared contract for dynamic JellyBall and static AnchorBall. */
export interface BallEntity {
  poolKind: 'jelly' | 'anchor';
  active: boolean;
  frozen: boolean;
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
  (body as any).gameBall = ball;
  (body as any).jellyBall = ball;
}
