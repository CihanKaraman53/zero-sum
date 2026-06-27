/**
 * Level configuration data for the first 10 levels.
 * JSON-ready structure supporting 3 win condition archetypes.
 */

export interface LevelConfig {
  id: number;
  name: string;
  type: 'score_attack' | 'fusion_goal' | 'board_clear' | 'drop_survival' | 'time_survival' | 'empty_board';
  targetScore?: number;
  fusionTarget?: number;
  /** Both +fusionTarget and -fusionTarget must be forged to win. */
  dualFusion?: boolean;
  clearCount?: number;
  dropLimit?: number;
  surviveSeconds?: number;
  zeroSumTarget?: number;
  spawnPool: number[];
  specialChance: number;
  gravity: number;
  dropSpeed: number;
  description: string;
  hazards?: string[];
  preplacedBalls?: { value: number; x: number; y: number; frozen?: boolean }[];
}

/** Play-area half-width per level index (level 7 = narrow corridor). */
export const LEVEL_CONTAINER_HALF_WIDTHS = [
  37.5,  // Level 1
  77.5,  // Level 2
  117.5, // Level 3
  200,   // Level 4-6 (max width)
  200,
  200,
  125,   // Level 7 (37.5% narrower than 200)
  200,   // Level 8-10 (full width restored)
  200,
  200
];

/** Play-area floor Y per level index (level 6 = half height). */
export const LEVEL_CONTAINER_BOTTOMS = [
  834, 834, 834, 834, 834,  // Levels 1-5 (full)
  497,                       // Level 6 (half height)
  834, 834, 834, 834         // Levels 7-10 (full)
];

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
    name: 'Arsenal Trial',
    type: 'fusion_goal',
    fusionTarget: 128,
    dropLimit: 30,
    spawnPool: [2, -2, 4, -4, 8, -8, 16, -16, 32, -32, 64, -64],
    specialChance: 0,
    gravity: 1.1,
    dropSpeed: 1.6,
    description: '30 hamlede +128 topunu oluştur! Bomba, balta ve zar toplarını akıllıca kullan.'
  },
  {
    id: 7,
    name: 'The Narrows',
    type: 'time_survival',
    surviveSeconds: 90,
    zeroSumTarget: 15,
    spawnPool: [2, -2, 4, -4, 8, -8],
    specialChance: 0,
    gravity: 1.15,
    dropSpeed: 1.6,
    description: '90 saniyede 15 kez sıfır yap! (+2 ile -2 gibi zıt topları çarpıştır.)'
  },
  {
    id: 8,
    name: 'The Twisted Paradox',
    type: 'empty_board',
    surviveSeconds: 80,
    spawnPool: [-2, -4, -8],
    specialChance: 0,
    gravity: 1.0,
    dropSpeed: 1.7,
    description: '10s kırmızı top, kutu döner, sonra karma (+/-) top — 80s içinde tahtayı temizle.'
  },
  {
    id: 9,
    name: 'Spectral Maze',
    type: 'fusion_goal',
    fusionTarget: 128,
    dualFusion: true,
    spawnPool: [2, -2, 4, -4, 8, -8],
    specialChance: 0,
    gravity: 1.2,
    dropSpeed: 1.7,
    description: 'Yan rüzgarlar! Hem +128 hem -128 topunu oluştur.'
  },
  {
    id: 10,
    name: 'The Abyss',
    type: 'board_clear',
    clearCount: 10,
    spawnPool: [2, -2, 4, -4, 8, -8],
    specialChance: 0,
    gravity: 1.3,
    dropSpeed: 1.8,
    description: 'Havadaki sabit blokları temizle! Normal oyun kuralları — sadece sabitler düşmez.',
    preplacedBalls: [
      // Upper band
      { value: 8, x: 110, y: 340, frozen: true },
      { value: -8, x: 370, y: 340, frozen: true },
      { value: 16, x: 240, y: 300, frozen: true },
      // Mid band
      { value: -16, x: 100, y: 450, frozen: true },
      { value: 4, x: 240, y: 470, frozen: true },
      { value: -4, x: 380, y: 450, frozen: true },
      // Lower-mid band
      { value: 2, x: 120, y: 580, frozen: true },
      { value: -2, x: 360, y: 580, frozen: true },
      { value: -16, x: 240, y: 640, frozen: true },
      { value: 8, x: 240, y: 720, frozen: true }
    ]
  }
];
