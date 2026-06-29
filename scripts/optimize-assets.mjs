#!/usr/bin/env node
/**
 * Asset optimizer — converts large PNGs to size-capped WebP.
 *
 * Reads every .png in public/assets/ that is listed in USED_ASSETS, downsizes
 * if its native dimension exceeds MAX_EDGE, encodes WebP at QUALITY, writes
 * the .webp sibling, and prints a before/after report.
 *
 * Original PNGs are kept on disk as fallback and for the in-Boot canvas
 * key-out routines, but Phaser/index.html should reference the .webp paths.
 */
import sharp from 'sharp';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSETS_DIR = path.join(__dirname, '..', 'public', 'assets');

/** Only convert assets we actually load — leave unused PNGs alone. */
const USED_ASSETS = [
  'nature_orb.png',
  'fire_orb.png',
  'x2_ball.png',
  'blast_ball.png',
  'slice_ball.png',
  'dice_ball.png',
  'magnet_ball.png',
  'ghost_ball.png',
  'launcher.png',
  'bottle_01.png',
  'bluecap_mushroom.png',
  'greater_stamina_potion.png',
  'potion_plus8.png',
  'mage_gloves.png',
  'cure_forest_bg.png', // loaded by index.html as <img>
];

/** Hard cap on the longest side — anything bigger is downscaled. */
const MAX_EDGE = 512;
/** WebP quality — 85 is visually lossless for game art. */
const QUALITY = 85;

const pad = (s, n) => String(s).padStart(n);
const fmtKB = (bytes) => `${(bytes / 1024).toFixed(1).padStart(7)} KB`;

const stats = [];

for (const name of USED_ASSETS) {
  const src = path.join(ASSETS_DIR, name);
  const out = src.replace(/\.png$/i, '.webp');

  let srcStat;
  try {
    srcStat = await fs.stat(src);
  } catch {
    console.warn(`skip (missing): ${name}`);
    continue;
  }

  const img = sharp(src);
  const meta = await img.metadata();
  const longestEdge = Math.max(meta.width ?? 0, meta.height ?? 0);
  const needsResize = longestEdge > MAX_EDGE;

  let pipeline = img;
  if (needsResize) {
    pipeline = pipeline.resize({
      width: meta.width >= meta.height ? MAX_EDGE : undefined,
      height: meta.height > meta.width ? MAX_EDGE : undefined,
      fit: 'inside',
      withoutEnlargement: true,
    });
  }

  await pipeline
    .webp({
      quality: QUALITY,
      effort: 6,
      smartSubsample: true,
    })
    .toFile(out);

  const outStat = await fs.stat(out);

  stats.push({
    name,
    fromBytes: srcStat.size,
    toBytes: outStat.size,
    fromDim: `${meta.width}x${meta.height}`,
    toDim: needsResize
      ? meta.width >= meta.height
        ? `${MAX_EDGE}x${Math.round((meta.height / meta.width) * MAX_EDGE)}`
        : `${Math.round((meta.width / meta.height) * MAX_EDGE)}x${MAX_EDGE}`
      : `${meta.width}x${meta.height}`,
  });
}

console.log('\n  Asset                              From dim     →  To dim       PNG size      WebP size       Saved');
console.log('  ' + '─'.repeat(106));

let totalFrom = 0;
let totalTo = 0;
for (const s of stats) {
  totalFrom += s.fromBytes;
  totalTo += s.toBytes;
  const savedPct = ((1 - s.toBytes / s.fromBytes) * 100).toFixed(1);
  console.log(
    `  ${pad(s.name, 34)}  ${pad(s.fromDim, 9)} →  ${pad(s.toDim, 9)}   ${fmtKB(s.fromBytes)}    ${fmtKB(s.toBytes)}    ${pad(savedPct + '%', 6)}`
  );
}

console.log('  ' + '─'.repeat(106));
console.log(
  `  ${pad('TOTAL', 34)}  ${pad('', 9)}    ${pad('', 9)}   ${fmtKB(totalFrom)}    ${fmtKB(totalTo)}    ${pad(((1 - totalTo / totalFrom) * 100).toFixed(1) + '%', 6)}\n`
);
