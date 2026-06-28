import Phaser from 'phaser';
import { ObjectPool } from './ObjectPool';
import { JellyBall } from '../entities/JellyBall';
import { BALL_POOL_SIZE } from './Constants';

/**
 * Session-scoped pools — allocated once, survive GameScene shutdown/restart.
 * Avoids 300ms+ preAllocate spikes on level transitions and game-over retry.
 */
class GamePoolRegistry {
  ball: ObjectPool<JellyBall> | null = null;

  ensure(scene: Phaser.Scene): { ball: ObjectPool<JellyBall> } {
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

    return { ball: this.ball };
  }

  private rehydrateBalls(scene: Phaser.Scene): void {
    this.ball!.forEachAll((b) => b.rehydrate(scene));
  }
}

export const gamePools = new GamePoolRegistry();
