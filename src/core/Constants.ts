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

// ── Ball sizes (visual radius by abs value; physics hitbox is slightly smaller) ──
/** Matter.js circle is ~12.5% smaller than the bottle sprite silhouette. */
export const BALL_HITBOX_SHRINK = 0.875;

export function getBallVisualRadius(absValue: number): number {
  if (absValue <= 2) return 15;
  if (absValue === 4) return 21;
  if (absValue === 8) return 29;
  if (absValue === 16) return 39;
  if (absValue === 32) return 49;
  if (absValue === 64) return 59;
  const logVal = Math.log2(absValue);
  return Math.round(15 + (logVal - 1) * 7.2);
}

/** Physics collision radius — smaller than visual for natural stacking gaps. */
export function getBallRadius(absValue: number): number {
  return Math.max(10, Math.round(getBallVisualRadius(absValue) * BALL_HITBOX_SHRINK));
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
export const FIXED_TIMESTEP = 16.666; // 60 FPS in ms (render tick)
/**
 * Matter physics @ 60Hz — Matter.js Engine.update warns if delta > 16.667ms,
 * and ball stacking becomes unstable at 30Hz with this gravity/restitution.
 */
export const MATTER_DELTA = 16.666;
export const MATTER_FPS = 60;

/** Jelly ball Matter body — natural slide, soft bounce, jelly feel. */
export const BALL_RESTITUTION = 0.08;
export const BALL_FRICTION = 0.22;
export const BALL_FRICTION_AIR = 0.012;
export const BALL_DENSITY = 0.001;

/** Container walls — gentle cushion on landing. */
export const WALL_RESTITUTION = 0.14;
export const WALL_FRICTION = 0.1;

// ── Collision categories (bit flags) ──
export type BallFaction = 'green' | 'red';

/** All jelly balls share one physics layer — green/red bounce off each other normally. */
export const CAT_BALL = 0x0001;
export const CAT_WALL = 0x0002;
export const CAT_SENSOR = 0x0004;

export const FACTION_COLORS: Record<BallFaction, number> = {
  green: POSITIVE_COLOR,
  red: NEGATIVE_COLOR,
};

// ── Pool sizes ──
export const BALL_POOL_SIZE = 50;
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

// ── Level 1 “Zero Cure” visual shell (layout only — gameplay unchanged) ──
export const CURE_L1_QUEST_WIDTH = 132;
export const CURE_L1_PLAY_WIDTH = GAME_WIDTH - CURE_L1_QUEST_WIDTH;
export const CURE_L1_PADDING = 14;
/** Visible play rectangle — narrower than full play column, centered. */
export const CURE_L1_ARENA_WIDTH = 90;
export const CURE_L1_PANEL_GAP = 10;
export const CURE_L1_UI_HEIGHT = GAME_HEIGHT - CURE_L1_PADDING * 2;
export const CURE_L1_UI_TOP = CURE_L1_PADDING;
export const CURE_L1_UI_CENTER_Y = CURE_L1_UI_TOP + CURE_L1_UI_HEIGHT / 2;
export const CURE_L1_CONTAINER_TOP = 96;
export const CURE_L1_LAUNCHER_Y = 44;
/** Danger line — extra headroom above the spawn zone before overflow. */
export const CURE_L1_OVERFLOW_Y = CURE_L1_LAUNCHER_Y + 72;
export const CURE_L1_QUEST_TARGET = 16;
export const CURE_L1_QUEST_REQUIRED = 3;
/** Sabit panel görünümü — tüm bölümlerde aynı. */
export const CURE_PLAY_PANEL_ALPHA = 0.72;
export const CURE_QUEST_PANEL_ALPHA = 0.78;

export function getCureUILayout(layout?: { arenaWidth: number; questWidth: number }): {
  uiLeft: number;
  uiRight: number;
  arenaLeft: number;
  arenaRight: number;
  arenaCenterX: number;
  arenaWidth: number;
  questLeft: number;
  questRight: number;
  questCenterX: number;
  questWidth: number;
} {
  const arenaWidth = layout?.arenaWidth ?? CURE_L1_ARENA_WIDTH;
  const questWidth = layout?.questWidth ?? CURE_L1_QUEST_WIDTH;
  const uiWidth = arenaWidth + CURE_L1_PANEL_GAP + questWidth;
  const uiLeft = (GAME_WIDTH - uiWidth) / 2;
  const arenaLeft = uiLeft;
  const arenaRight = uiLeft + arenaWidth;
  const questLeft = arenaRight + CURE_L1_PANEL_GAP;
  const questRight = questLeft + questWidth;
  return {
    uiLeft,
    uiRight: questRight,
    arenaLeft,
    arenaRight,
    arenaCenterX: arenaLeft + arenaWidth / 2,
    arenaWidth,
    questLeft,
    questRight,
    questCenterX: questLeft + questWidth / 2,
    questWidth,
  };
}

export function getCureArenaBounds(): { left: number; right: number; centerX: number } {
  const layout = getCureUILayout();
  return { left: layout.arenaLeft, right: layout.arenaRight, centerX: layout.arenaCenterX };
}

