import Phaser from 'phaser';
import { ObjectPool } from './ObjectPool';
import { JellyBall } from '../entities/JellyBall';
import { AnchorBall } from '../entities/AnchorBall';
import { BALL_POOL_SIZE, ANCHOR_POOL_SIZE } from './Constants';

/**
 * Session-scoped pools — allocated once, survive GameScene shutdown/restart.
 * Avoids 300ms+ preAllocate spikes on level transitions and game-over retry.
 */
class GamePoolRegistry {
  ball: ObjectPool<JellyBall> | null = null;
  anchor: ObjectPool<AnchorBall> | null = null;

  ensure(scene: Phaser.Scene): { ball: ObjectPool<JellyBall>; anchor: ObjectPool<AnchorBall> } {
    if (!this.ball) {
      this.ball = new ObjectPool(
        () => new JellyBall(scene),
        (b) => b.deactivate(),
        BALL_POOL_SIZE
      );
    } else {
      this.ball.releaseAll();
      this.rehydrateBalls(scene);
    }

    if (!this.anchor) {
      this.anchor = new ObjectPool(
        () => new AnchorBall(scene),
        (a) => a.deactivate(),
        ANCHOR_POOL_SIZE
      );
    } else {
      this.anchor.releaseAll();
      this.rehydrateAnchors(scene);
    }

    return { ball: this.ball, anchor: this.anchor };
  }

  private rehydrateBalls(scene: Phaser.Scene): void {
    this.ball!.forEachAll((b) => b.rehydrate(scene));
  }

  private rehydrateAnchors(scene: Phaser.Scene): void {
    this.anchor!.forEachAll((a) => a.rehydrate(scene));
  }
}

export const gamePools = new GamePoolRegistry();
