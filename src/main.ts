import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { MenuScene } from './scenes/MenuScene';
import { GameScene } from './scenes/GameScene';
import { GameOverScene } from './scenes/GameOverScene';
import { GAME_WIDTH, GAME_HEIGHT, GRAVITY_Y } from './core/Constants';

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

/**
 * In-game FPS overlay — DOM element, Phaser sahnesinin dışında.
 * Tüm scene'lerde (menu + oyun + game over) çalışır, DevTools açık olmadan
 * gerçek browser fps'i gösterir. Maliyeti yok denecek kadar az (~0.01ms/frame).
 */
const fpsEl = document.createElement('div');
fpsEl.style.cssText = [
  'position:fixed',
  'top:8px',
  'right:8px',
  'z-index:9999',
  'font:bold 14px/1 monospace',
  'color:#00ff88',
  'background:rgba(0,0,0,0.55)',
  'padding:4px 8px',
  'border-radius:4px',
  'pointer-events:none',
  'user-select:none',
  'min-width:60px',
  'text-align:center',
].join(';');
fpsEl.textContent = '-- fps';
document.body.appendChild(fpsEl);

let fpsLast = performance.now();
let fpsFrames = 0;
let fpsMin = Infinity;
setInterval(() => {
  const now = performance.now();
  const elapsed = (now - fpsLast) / 1000;
  const fps = fpsFrames / elapsed;
  if (fps < fpsMin && fpsFrames > 5) fpsMin = fps;
  fpsEl.textContent = `${fps.toFixed(0)} | min ${fpsMin === Infinity ? '--' : fpsMin.toFixed(0)}`;
  // Renk göstergesi
  fpsEl.style.color = fps >= 55 ? '#00ff88' : fps >= 40 ? '#ffd700' : '#ff3344';
  fpsFrames = 0;
  fpsLast = now;
}, 500);

const tickFps = () => {
  fpsFrames++;
  requestAnimationFrame(tickFps);
};
requestAnimationFrame(tickFps);
