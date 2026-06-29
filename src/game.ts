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
 * In-game perf overlay — DOM elements, Phaser sahnesinin dışında.
 *   • FPS satırı: rolling fps + session min
 *   • LAT satırı: dokunma → bir sonraki frame'in görsel tepkisi (input latency)
 *
 * Sadece development'ta görünür. Vite `import.meta.env.DEV` derleme anında
 * sabit `true/false`'a indirgenir → production build'de bu blok tamamen
 * tree-shake edilir, bundle'a hiç girmez.
 */
if (import.meta.env.DEV) {
const overlayEl = document.createElement('div');
overlayEl.style.cssText = [
  'position:fixed',
  'top:8px',
  'right:8px',
  'z-index:9999',
  'font:bold 13px/1.35 monospace',
  'background:rgba(0,0,0,0.55)',
  'padding:5px 9px',
  'border-radius:5px',
  'pointer-events:none',
  'user-select:none',
  'min-width:120px',
  'text-align:right',
].join(';');

const fpsEl = document.createElement('div');
fpsEl.style.color = '#00ff88';
fpsEl.textContent = '-- fps';

const latEl = document.createElement('div');
latEl.style.color = '#9fd8ff';
latEl.style.marginTop = '3px';
latEl.textContent = 'lat: tap to test';

overlayEl.appendChild(fpsEl);
overlayEl.appendChild(latEl);
document.body.appendChild(overlayEl);

// ── FPS sayım state ──
let fpsLast = performance.now();
let fpsFrames = 0;
let fpsMin = Infinity;

// ── Input latency state ──
/**
 * Pointer/touch event'in browser tarafından oluşturulduğu an (event.timeStamp).
 * Bir sonraki rAF'de bunu görsel tepki zamanından çıkarırız.
 */
let pendingInputTs: number | null = null;
let latSum = 0;
let latCount = 0;
let latMax = 0;
let latLast = 0;

const captureInput = (e: PointerEvent | TouchEvent | MouseEvent) => {
  // Sadece ilk capture'ı kaydet; multi-touch'ta da tek bir ölçüm yapılsın.
  if (pendingInputTs !== null) return;
  pendingInputTs = e.timeStamp;
};

window.addEventListener('pointerdown', captureInput, { passive: true, capture: true });
window.addEventListener('touchstart', captureInput, { passive: true, capture: true });

setInterval(() => {
  const now = performance.now();
  const elapsed = (now - fpsLast) / 1000;
  const fps = fpsFrames / elapsed;
  if (fps < fpsMin && fpsFrames > 5) fpsMin = fps;
  fpsEl.textContent = `${fps.toFixed(0)} fps | min ${fpsMin === Infinity ? '--' : fpsMin.toFixed(0)}`;
  fpsEl.style.color = fps >= 55 ? '#00ff88' : fps >= 40 ? '#ffd700' : '#ff3344';
  fpsFrames = 0;
  fpsLast = now;

  if (latCount > 0) {
    const avg = latSum / latCount;
    latEl.textContent = `lat: ${avg.toFixed(0)}ms (last ${latLast.toFixed(0)} · max ${latMax.toFixed(0)})`;
    latEl.style.color = avg < 60 ? '#9fd8ff' : avg < 100 ? '#ffd700' : '#ff7a99';
  }
}, 500);

const tickFps = () => {
  if (pendingInputTs !== null) {
    const lat = performance.now() - pendingInputTs;
    // event.timeStamp ile performance.now() aynı zaman ekseninde (high-res monotonic).
    pendingInputTs = null;
    latLast = lat;
    latSum += lat;
    latCount++;
    if (lat > latMax) latMax = lat;
  }
  fpsFrames++;
  requestAnimationFrame(tickFps);
};
requestAnimationFrame(tickFps);
} // end DEV-only block
