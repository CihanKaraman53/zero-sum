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
    name: 'İlk Adım',
    type: 'score_attack',
    targetScore: 500,
    spawnPool: [2, -2],
    specialChance: 0,
    gravity: 1.0,
    dropSpeed: 1.2,
    description: 'Aynı sayıları birleştir! +2 ile +2 = +4 olur.'
  },
  {
    id: 2,
    name: 'Sıfır Gücü',
    type: 'score_attack',
    targetScore: 1000,
    spawnPool: [2, -2],
    specialChance: 0,
    gravity: 1.0,
    dropSpeed: 1.4,
    description: 'Zıt sayıları buluştur! +2 ve -2 = ZERO SUM patlaması!'
  },
  {
    id: 3,
    name: 'Füzyon Hedefi',
    type: 'fusion_goal',
    fusionTarget: 4,
    spawnPool: [2, -2],
    specialChance: 0,
    gravity: 1.0,
    dropSpeed: 1.4,
    description: '+4 topunu oluştur! İki tane +2 birleştir.'
  },
  {
    id: 4,
    name: 'Yeni Boyut',
    type: 'score_attack',
    targetScore: 2000,
    spawnPool: [2, -2, 4, -4],
    specialChance: 0,
    gravity: 1.1,
    dropSpeed: 1.5,
    description: '±4 toplar sahneye çıkıyor! Büyük birleşmeler yap.'
  },
  {
    id: 5,
    name: 'Sekizli Hedef',
    type: 'fusion_goal',
    fusionTarget: 8,
    spawnPool: [2, -2, 4, -4],
    specialChance: 0,
    gravity: 1.1,
    dropSpeed: 1.5,
    description: '+8 topunu oluştur! +4 ile +4 birleştir.'
  },
  {
    id: 6,
    name: 'Çarpma Gücü',
    type: 'score_attack',
    targetScore: 3500,
    spawnPool: [2, -2, 4, -4],
    specialChance: 0.12,
    gravity: 1.1,
    dropSpeed: 1.6,
    description: '×2 topu ile sayıları ikiye katla!'
  },
  {
    id: 7,
    name: 'Tahta Temizliği',
    type: 'board_clear',
    clearCount: 5,
    spawnPool: [-2, -4, -2, -4],
    specialChance: 0,
    gravity: 1.0,
    dropSpeed: 1.4,
    description: 'Donmuş pozitif topları negatiflerle yok et!',
    preplacedBalls: [
      { value: 2, x: 120, y: 700, frozen: true },
      { value: 4, x: 200, y: 700, frozen: true },
      { value: 2, x: 280, y: 700, frozen: true },
      { value: 4, x: 160, y: 640, frozen: true },
      { value: 2, x: 240, y: 640, frozen: true },
    ]
  },
  {
    id: 8,
    name: 'Bölme Ustası',
    type: 'score_attack',
    targetScore: 5000,
    spawnPool: [2, -2, 4, -4, 8, -8],
    specialChance: 0.15,
    gravity: 1.2,
    dropSpeed: 1.7,
    description: '÷2 topu sıkışan alanı kurtarır! Topları böl.'
  },
  {
    id: 9,
    name: 'Kral Yolu',
    type: 'fusion_goal',
    fusionTarget: 16,
    spawnPool: [2, -2, 4, -4, 8, -8],
    specialChance: 0.1,
    gravity: 1.2,
    dropSpeed: 1.7,
    description: '+16 topunu oluştur! ×2 gücünü kullan.'
  },
  {
    id: 10,
    name: 'Kara Delik',
    type: 'score_attack',
    targetScore: 8000,
    spawnPool: [2, -2, 4, -4, 8, -8],
    specialChance: 0.18,
    gravity: 1.3,
    dropSpeed: 1.8,
    description: 'Peş peşe Zero Sum yap ve Kara Deliği tetikle!'
  }
];
