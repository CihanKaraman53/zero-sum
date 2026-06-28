/**
 * Single level configuration — Zero Cure tutorial chapter.
 */

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
}

export const LEVEL: LevelConfig = {
  id: 1,
  name: 'Genesis Matrix',
  type: 'board_clear',
  clearCount: 9999,
  spawnPool: [2],
  specialChance: 0,
  gravity: 1.0,
  dropSpeed: 1.2,
  description: 'İlk Adım: Aynı sayıları birleştir! Zıt sayıları çarpıştırarak yok et.',
};
