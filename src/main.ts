import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { MenuScene } from './scenes/MenuScene';
import { LevelSelectScene } from './scenes/LevelSelectScene';
import { GameScene } from './scenes/GameScene';
import { GameOverScene } from './scenes/GameOverScene';
import { GAME_WIDTH, GAME_HEIGHT, GRAVITY_Y } from './core/Constants';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.WEBGL, // Force WebGL for neon performance
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#060515',
  parent: 'game-container',
  scale: {
    mode: Phaser.Scale.FIT,
    // Flex on #game-container handles centering — Phaser margins fight flex and push right
    autoCenter: Phaser.Scale.NO_CENTER,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
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
  scene: [BootScene, MenuScene, LevelSelectScene, GameScene, GameOverScene]
};

const game = new Phaser.Game(config);

window.addEventListener('resize', () => {
  game.scale.refresh();
});
