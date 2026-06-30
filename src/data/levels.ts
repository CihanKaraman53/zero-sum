/**
 * Level configurations — Zero Cure chapters.
 */

export type LevelDropMode = 'mixed' | 'negative';

export interface LevelQuest {
  target: number;
  required: number;
}

export interface LevelLayout {
  arenaWidth: number;
  questWidth: number;
}

export interface LevelConfig {
  id: number;
  name: string;
  type: 'board_clear';
  clearCount?: number;
  spawnPool: number[];
  specialChance: number;
  gravity: number;
  dropSpeed: number;
  description: string;
  quests: LevelQuest[];
  layout: LevelLayout;
  tutorialDrops: number[];
  postTutorialPool: number[];
  dropMode: LevelDropMode;
  negativeSpawnChance?: number;
  /** Dual-bottle chapters — stacked in the quest column. */
  dualBottles?: boolean;
  /** Single bottle cycles through quests[] in order (+16 full → empty → −32 …). */
  sequentialPhases?: boolean;
  /** Countdown seconds — fail when timer hits zero. */
  timeLimitSec?: number;
  /** Max drops — fail when moves hit zero before quests complete. */
  moveLimit?: number;
}

export const LEVEL_1: LevelConfig = {
  id: 1,
  name: 'Genesis Matrix',
  type: 'board_clear',
  clearCount: 9999,
  spawnPool: [2, 4, 8],
  specialChance: 0,
  gravity: 1.0,
  dropSpeed: 1.2,
  description: 'Aynı sayıları birleştirerek +16 iksirini doldur!',
  quests: [{ target: 16, required: 3 }],
  layout: { arenaWidth: 90, questWidth: 132 },
  tutorialDrops: [4, 2, 4, 8, 8, -2, 8, 8],
  postTutorialPool: [2, 4, 8],
  dropMode: 'mixed',
  negativeSpawnChance: 0.15,
};

export const LEVEL_2: LevelConfig = {
  id: 2,
  name: 'Shadow Matrix',
  type: 'board_clear',
  clearCount: 9999,
  spawnPool: [2, 4, 8],
  specialChance: 0,
  gravity: 1.0,
  dropSpeed: 1.2,
  description: 'Eksi topları birleştirerek −16 iksirini doldur!',
  quests: [{ target: -16, required: 3 }],
  layout: { arenaWidth: 90, questWidth: 132 },
  tutorialDrops: [-4, -2, -4, -8, -8, 2, -8, -8],
  postTutorialPool: [2, 4, 8],
  dropMode: 'negative',
};

export const LEVEL_3: LevelConfig = {
  id: 3,
  name: 'Phase Matrix',
  type: 'board_clear',
  clearCount: 9999,
  spawnPool: [2, 4, 8, 16],
  specialChance: 0,
  gravity: 1.0,
  dropSpeed: 1.2,
  description: '+16 iksirini 4 kez doldur, sonra −32 iksirine geç!',
  quests: [
    { target: 16, required: 4 },
    { target: -32, required: 2 },
  ],
  sequentialPhases: true,
  layout: { arenaWidth: 320, questWidth: 132 },
  tutorialDrops: [4, -4, 2, -2, 4, -8, 8, -8, 16, -16, -4, -8],
  postTutorialPool: [2, 4, 8, 16],
  dropMode: 'mixed',
  negativeSpawnChance: 0.5,
};

export const LEVEL_4: LevelConfig = {
  id: 4,
  name: 'Clock Matrix',
  type: 'board_clear',
  clearCount: 9999,
  spawnPool: [2, 4, 8, 16, 32],
  specialChance: 0,
  gravity: 1.0,
  dropSpeed: 1.2,
  description: '100 saniyede +32, sonra −64 iksirini doldur!',
  quests: [
    { target: 32, required: 2 },
    { target: -64, required: 2 },
  ],
  sequentialPhases: true,
  layout: { arenaWidth: 320, questWidth: 132 },
  timeLimitSec: 100,
  tutorialDrops: [8, -8, 16, -16, 8, -16, 16, -8, 32, -32, -16, -32],
  postTutorialPool: [2, 4, 8, 16, 32],
  dropMode: 'mixed',
  negativeSpawnChance: 0.5,
};

export const LEVEL_5: LevelConfig = {
  id: 5,
  name: 'Limit Matrix',
  type: 'board_clear',
  clearCount: 9999,
  spawnPool: [2, 4, 8, 16, 32],
  specialChance: 0,
  gravity: 1.0,
  dropSpeed: 1.2,
  description: '35 hamlede +64, sonra −64 iksirini doldur!',
  quests: [
    { target: 64, required: 1 },
    { target: -64, required: 1 },
  ],
  sequentialPhases: true,
  layout: { arenaWidth: 320, questWidth: 132 },
  moveLimit: 35,
  tutorialDrops: [16, -16, 32, -32, 16, 32, -32, 16, 32, -16, 8, -8],
  postTutorialPool: [2, 4, 8, 16, 32],
  dropMode: 'mixed',
  negativeSpawnChance: 0.5,
};

export const LEVELS: LevelConfig[] = [LEVEL_1, LEVEL_2, LEVEL_3, LEVEL_4, LEVEL_5];

/** @deprecated use getLevel(1) */
export const LEVEL = LEVEL_1;

export function getLevel(id: number): LevelConfig {
  return LEVELS.find((l) => l.id === id) ?? LEVEL_1;
}

export function getNextLevelId(id: number): number | null {
  const idx = LEVELS.findIndex((l) => l.id === id);
  if (idx < 0 || idx >= LEVELS.length - 1) return null;
  return LEVELS[idx + 1].id;
}

export function formatQuestTarget(value: number): string {
  return value > 0 ? `+${value}` : `${value}`;
}
