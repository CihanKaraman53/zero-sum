import Phaser from 'phaser';
import { ParticleManager } from '../effects/ParticleManager';
import { Background } from '../effects/Background';
import { Launcher } from '../entities/Launcher';
import { FloatingText } from '../effects/FloatingText';
import { GAME_WIDTH, CONTAINER_TOP, GRAVITY_Y } from '../core/Constants';

/**
 * GravityTwistSystem — Level 8 gravity inversions with camera + background FX.
 */
export class GravityTwistSystem {
  private scene: Phaser.Scene;
  private background: Background;
  private particles: ParticleManager;
  private floatingText: FloatingText;
  private launcher: Launcher;
  private getGravityScale: () => number;

  private twistActive = false;
  private restoreTimer?: Phaser.Time.TimerEvent;

  constructor(
    scene: Phaser.Scene,
    background: Background,
    particles: ParticleManager,
    floatingText: FloatingText,
    launcher: Launcher,
    getGravityScale: () => number
  ) {
    this.scene = scene;
    this.background = background;
    this.particles = particles;
    this.floatingText = floatingText;
    this.launcher = launcher;
    this.getGravityScale = getGravityScale;
  }

  isTwistActive(): boolean {
    return this.twistActive;
  }

  triggerTwist(twistNumber: 1 | 2): void {
    if (this.twistActive) return;

    this.twistActive = true;
    this.launcher.isPlayerControlled = false;

    const scale = this.getGravityScale();
    this.scene.matter.world.setGravity(0, -GRAVITY_Y * scale);

    this.cameras.shake(300, 0.02);
    this.cameras.flash(400, 255, 34, 68, false);
    this.scene.time.delayedCall(120, () => {
      this.cameras.flash(250, 0, 240, 255, false);
    });

    this.background.playGravityTwist(true);
    this.floatingText.show(
      GAME_WIDTH / 2, CONTAINER_TOP + 50,
      twistNumber === 1 ? 'REALITY TWIST!' : 'PARADOX STRIKE!',
      '#00f0ff', 26, 1400
    );

    this.restoreTimer?.destroy();
    this.restoreTimer = this.scene.time.delayedCall(4000, () => this.restoreNormal());
  }

  restoreNormal(): void {
    if (!this.twistActive) return;

    const scale = this.getGravityScale();
    this.scene.matter.world.setGravity(0, GRAVITY_Y * scale);

    this.cameras.shake(150, 0.008);
    this.background.playGravityTwist(false);

    const containerBottom = (this.scene as any).containerBottom ?? CONTAINER_TOP + 400;
    this.particles.burst(GAME_WIDTH / 2, CONTAINER_TOP + 30, 0x00f0ff, 18, 2.2, 400);
    this.particles.burst(GAME_WIDTH / 2, containerBottom - 20, 0xff3388, 14, 2, 350);

    this.floatingText.show(GAME_WIDTH / 2, CONTAINER_TOP + 50, 'GRAVITY RESTORED', '#00ff88', 20, 900);

    this.twistActive = false;
    this.launcher.isPlayerControlled = true;
  }

  resetGravity(): void {
    this.restoreTimer?.destroy();
    this.restoreTimer = undefined;
    this.twistActive = false;
    const scale = this.getGravityScale();
    this.scene.matter.world.setGravity(0, GRAVITY_Y * scale);
    this.background.playGravityTwist(false, true);
  }

  destroy(): void {
    this.restoreTimer?.destroy();
  }

  private get cameras() {
    return this.scene.cameras.main;
  }
}
