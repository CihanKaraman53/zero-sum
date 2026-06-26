/**
 * Level configuration data for the first 10 levels.
 * JSON-ready structure supporting 3 win condition archetypes.
 */

export interface LevelConfig {
  id: number;
  name: string;
  type: 'score_attack' | 'fusion_goal' | 'board_clear';
  targetScore?: number;
  fusionTarget?: number;
  clearCount?: number;
  spawnPool: number[];          // values that can spawn (e.g. [2, -2, 4, -4])
  specialChance: number;        // 0-1 chance of ×2/÷2 special ball
  gravity: number;              // matter.js gravity scale
  dropSpeed: number;            // launcher auto-move speed
  description: string;          // tutorial/flavor text
  hazards?: string[];           // future: environmental hazards
  preplacedBalls?: { value: number; x: number; y: number; frozen?: boolean }[];
}

export const LEVELS: LevelConfig[] = [
  {
    id: 1,
    name: 'Genesis Matrix',
    type: 'board_clear',
    clearCount: 9999,
    spawnPool: [2],
    specialChance: 0,
    gravity: 1.0,
    dropSpeed: 1.2,
    description: 'İlk Adım: Aynı sayıları birleştir! Zıt sayıları çarpıştırarak yok et.'
  },
  {
    id: 2,
    name: 'The Core Reaction',
    type: 'board_clear',
    clearCount: 9999,
    spawnPool: [2],
    specialChance: 0,
    gravity: 1.0,
    dropSpeed: 1.4,
    description: '+16 topunu negatif -4 ile parçala! Tüm topları yok et.'
  },
  {
    id: 3,
    name: 'Zero Sum Academy',
    type: 'score_attack',
    targetScore: 1000,
    spawnPool: [2, 4, 8, -2, -4],
    specialChance: 0,
    gravity: 1.0,
    dropSpeed: 1.4,
    description: '1000 puan hedefine ulaşarak seviyeyi tamamla! Kombo ve bölünmeleri kullan.'
  },
  {
    id: 4,
    name: 'The X2 Multiplier',
    type: 'fusion_goal',
    fusionTarget: 64,
    spawnPool: [2, 4, 8, 16, -2, -4, -8],
    specialChance: 0.1,
    gravity: 1.1,
    dropSpeed: 1.5,
    description: '+64 değerindeki topu oluşturarak seviyeyi tamamla! X2 katlayıcı topunu kullan.'
  },
  {
    id: 5,
    name: 'Bubbled Ascent',
    type: 'score_attack',
    targetScore: 2000,
    spawnPool: [2, -2, 4, -4],
    specialChance: 0.05,
    gravity: 1.1,
    dropSpeed: 1.5,
    description: '2000 puan hedefine ulaşarak seviyeyi tamamla!'
  },
  {
    id: 6,
    name: 'Magnetized Divide',
    type: 'board_clear',
    clearCount: 6,
    spawnPool: [2, -2, 4, -4],
    specialChance: 0,
    gravity: 1.1,
    dropSpeed: 1.6,
    description: 'Tüm donmuş blokları zıt yüklerle yok et!',
    preplacedBalls: [
      { value: 8, x: 120, y: 780, frozen: true },
      { value: 8, x: 200, y: 780, frozen: true },
      { value: 8, x: 280, y: 780, frozen: true },
      { value: -8, x: 160, y: 720, frozen: true },
      { value: -8, x: 240, y: 720, frozen: true },
      { value: -8, x: 320, y: 720, frozen: true }
    ]
  },
  {
    id: 7,
    name: 'Chain Breaker',
    type: 'fusion_goal',
    fusionTarget: 32,
    spawnPool: [2, -2, 4, -4, 8],
    specialChance: 0.1,
    gravity: 1.15,
    dropSpeed: 1.6,
    description: 'Zincirli engelleri aşarak +32 topunu oluştur!'
  },
  {
    id: 8,
    name: 'Monsoon Valley',
    type: 'score_attack',
    targetScore: 4000,
    spawnPool: [2, -2, 4, -4, 8],
    specialChance: 0.15,
    gravity: 1.2,
    dropSpeed: 1.7,
    description: 'Rüzgarlı vadide engellere çarparak 4000 puana ulaş!'
  },
  {
    id: 9,
    name: 'Spectral Maze',
    type: 'fusion_goal',
    fusionTarget: 64,
    spawnPool: [2, -2, 4, -4, 8],
    specialChance: 0.1,
    gravity: 1.2,
    dropSpeed: 1.7,
    description: '+64 değerindeki devasa topu oluştur!'
  },
  {
    id: 10,
    name: 'The Abyss',
    type: 'board_clear',
    clearCount: 8,
    spawnPool: [-2, -4, -8],
    specialChance: 0.15,
    gravity: 1.3,
    dropSpeed: 1.8,
    description: 'Asit yükselmeden tahtadaki donmuş blokları erit!',
    preplacedBalls: [
      { value: 16, x: 80, y: 780, frozen: true },
      { value: 16, x: 160, y: 780, frozen: true },
      { value: 16, x: 240, y: 780, frozen: true },
      { value: 16, x: 320, y: 780, frozen: true },
      { value: 16, x: 400, y: 780, frozen: true },
      { value: -16, x: 120, y: 720, frozen: true },
      { value: -16, x: 240, y: 720, frozen: true },
      { value: -16, x: 360, y: 720, frozen: true }
    ]
  }
];
