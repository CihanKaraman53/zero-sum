import Phaser from 'phaser';

/**
 * Game-wide constants — single source of truth.
 * Reused global vectors for zero-allocation math in update loops.
 */

// ── Canvas dimensions (9:16 portrait) ──
export const GAME_WIDTH = 480;
export const GAME_HEIGHT = 854;

/** Cap retina multiplier — 2x keeps mobile sharp without 3x GPU cost. */
export const MAX_RENDER_DPR = 2;

export function getRenderResolution(): number {
  if (typeof window === 'undefined') return 1;
  return Math.min(window.devicePixelRatio || 1, MAX_RENDER_DPR);
}

// ── Container (play area) ──
export const CONTAINER_LEFT = 40;
export const CONTAINER_RIGHT = GAME_WIDTH - 40;
export const CONTAINER_TOP = 160;
export const CONTAINER_BOTTOM = GAME_HEIGHT - 20;
export const CONTAINER_WIDTH = CONTAINER_RIGHT - CONTAINER_LEFT;
export const CONTAINER_CENTER_X = (CONTAINER_LEFT + CONTAINER_RIGHT) / 2;
export const CONTAINER_CENTER_Y = (CONTAINER_TOP + CONTAINER_BOTTOM) / 2;

// ── Overflow (red line) ──
export const OVERFLOW_Y = CONTAINER_TOP + 30;

// ── Launcher ──
export const LAUNCHER_Y = CONTAINER_TOP - 20;
export const LAUNCHER_MIN_X = CONTAINER_LEFT + 30;
export const LAUNCHER_MAX_X = CONTAINER_RIGHT - 30;
export const DROP_COOLDOWN = 350; // ms between drops

// ── Ball sizes (radius by abs value) ──
export function getBallRadius(absValue: number): number {
  if (absValue <= 2) return 18;
  if (absValue === 4) return 24;
  if (absValue === 8) return 32;
  if (absValue === 16) return 42;
  const logVal = Math.log2(absValue);
  return Math.round(18 + (logVal - 1) * 8);
}

// ── Colors ──
export const POSITIVE_COLOR = 0x00ff88;
export const POSITIVE_COLOR_STR = '#00ff88';
export const NEGATIVE_COLOR = 0xff3388;
export const NEGATIVE_COLOR_STR = '#ff3388';
export const SPECIAL_COLOR = 0x00ccff;
export const SPECIAL_COLOR_STR = '#00ccff';
export const KING_COLOR = 0xffd700;
export const KING_COLOR_STR = '#ffd700';
export const BG_COLOR = 0x0a0a1a;
export const CONTAINER_BORDER_COLOR = 0x1a6bff;
export const OVERFLOW_COLOR = 0xff2244;

// ── Physics ──
export const GRAVITY_Y = 1.2;
export const FIXED_TIMESTEP = 16.666; // 60 FPS in ms
/** Fixed delta passed to Matter.Engine.update — never scales with frame lag. */
export const MATTER_DELTA = FIXED_TIMESTEP;

// ── Collision categories (bit flags) ──
export const CAT_BALL = 0x0001;
export const CAT_WALL = 0x0002;
export const CAT_SENSOR = 0x0004;
/** Static level anchors — skip anchor↔anchor broadphase pairs. */
export const CAT_ANCHOR = 0x0008;

// ── Pool sizes ──
export const BALL_POOL_SIZE = 50;
export const ANCHOR_POOL_SIZE = 16;
export const PARTICLE_POOL_SIZE = 200;
export const MAX_LIVE_PARTICLES = 96;
export const TEXT_POOL_SIZE = 20;

// ── Combo ──
export const COMBO_TIMEOUT = 2000; // ms to lose combo chain
export const BLACK_HOLE_TRIGGER = 3; // consecutive zero-sums needed
export const BLACK_HOLE_DURATION = 3000; // ms

// ── Scoring ──
export const SCORE_MERGE_BASE = 10;
export const SCORE_ZEROSUM_BASE = 100;
export const SCORE_SHRINK_BASE = 25;
export const SCORE_BLACKHOLE_BASE = 200;

// ── Reusable temp vectors (zero allocation in game loop) ──
export const TEMP_VEC = { x: 0, y: 0 };
export const TEMP_VEC2 = { x: 0, y: 0 };
