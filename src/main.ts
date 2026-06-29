/**
 * main.ts is the entry point.
 * We dynamically import game.ts so that the initial page load is fast
 * and Lighthouse FCP/LCP metrics are not blocked by the heavy Phaser script evaluation.
 */

const init = async () => {
  await import('./game');
};

// Start the game initialization only after the initial page and background image have loaded.
// This ensures that the main thread is not blocked during initial render.
if (document.readyState === 'complete') {
  setTimeout(init, 50);
} else {
  window.addEventListener('load', () => setTimeout(init, 50));
}
