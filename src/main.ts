import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { MenuScene } from './scenes/MenuScene';
import { GameScene } from './scenes/GameScene';
import { GameOverScene } from './scenes/GameOverScene';
import { GAME_WIDTH, GAME_HEIGHT, GRAVITY_Y, MATTER_DELTA } from './core/Constants';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.WEBGL,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#0a1018',
  parent: 'game-container',
  antialias: true,
  pixelArt: false,
  render: {
    antialias: true,
    transparent: true,
    powerPreference: 'high-performance',
    roundPixels: false,
    autoMobileTextures: true,
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
  },
  physics: {
    default: 'matter',
    matter: {
      gravity: { x: 0, y: GRAVITY_Y },
      debug: false,
      enableSleeping: true,
      positionIterations: 4,
      velocityIterations: 2,
      constraintIterations: 1,
      getDelta: () => MATTER_DELTA,
      autoUpdate: true,
      runner: {
        fps: 60,
        delta: MATTER_DELTA,
        maxUpdates: 1,
        maxFrameTime: MATTER_DELTA,
        frameDeltaSmoothing: false,
        frameDeltaSnapping: false,
      },
    }
  },
  fps: {
    target: 60,
    forceSetTimeOut: false,
  },
  scene: [BootScene, MenuScene, GameScene, GameOverScene]
};

const game = new Phaser.Game(config);

const refreshLayout = () => {
  game.scale.refresh();
};

game.events.once('ready', refreshLayout);

window.addEventListener('resize', refreshLayout);
window.addEventListener('orientationchange', refreshLayout);
window.visualViewport?.addEventListener('resize', refreshLayout);

const container = document.getElementById('game-container');
if (container && typeof ResizeObserver !== 'undefined') {
  new ResizeObserver(refreshLayout).observe(container);
}
