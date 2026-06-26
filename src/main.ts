import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import { GameOverScene } from './scenes/GameOverScene';
import { GAME_WIDTH, GAME_HEIGHT, GRAVITY_Y } from './core/Constants';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.WEBGL, // Force WebGL for neon performance
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#050510',
  parent: 'game-container',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.NO_CENTER,
  },
  physics: {
    default: 'matter',
    matter: {
      gravity: { x: 0, y: GRAVITY_Y },
      debug: false,
      enableSleeping: false, // Balls are constantly moving slightly, sleeping breaks collision flow
    }
  },
  fps: {
    target: 60,
    forceSetTimeOut: true
  },
  scene: [BootScene, GameScene, GameOverScene]
};

new Phaser.Game(config);
