/**
 * Builds every image the app ships from the photographs Mábu supplied.
 *
 *   assets/photos/masters/*.jpg   the supplied photographs, as received (JPEG q92)
 *   assets/photos/*.jpg           what the app loads — generated, never hand-edited
 *   src/content/photoRegistry.ts  the require() map — generated
 *   assets/icon.png, splash, favicon, adaptive icon — generated from the wordmark
 *
 * The brand board is a collage, so its dish tiles, interiors and textures are
 * cut out of it at the rectangles listed in BOARD_CROPS. Those crops are small
 * (the board's tiles are ~220px wide), so they are used for cards and
 * thumbnails only; full-bleed heroes use the full-size photographs. When
 * higher-resolution dish photography arrives, drop it into masters/ with the
 * same key and delete its BOARD_CROPS entry — nothing else changes.
 *
 * Run: npm run assets:photos
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import opentypeModule from 'opentype.js';
import { Buffer } from 'node:buffer';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const masters = path.join(root, 'assets/photos/masters');
const out = path.join(root, 'assets/photos');
const sourceDir = path.join(root, 'assets/photos/source');

/** Full-resolution PNGs as uploaded are folded into lean JPEG masters once. */
if (fs.existsSync(sourceDir)) {
  fs.mkdirSync(masters, { recursive: true });
  for (const file of fs.readdirSync(sourceDir)) {
    if (!/\.(png|jpe?g|webp)$/i.test(file)) continue;
    const key = file.replace(/\.[^.]+$/, '');
    await sharp(path.join(sourceDir, file))
      .jpeg({ quality: 92, mozjpeg: true })
      .toFile(path.join(masters, `${key}.jpg`));
    console.log(`master  ${key}.jpg`);
  }
}

/**
 * Composites: images that hold several pictures — the brand board, and the
 * menu design comps supplied later. Each lists rectangles to cut out,
 * [left, top, width, height] in the composite's own pixels. Crops are small
 * (the comps' dish thumbnails are ~330px wide), so they are used for cards
 * and thumbnails; a real photograph with the same key always wins.
 */
/** A dish thumbnail in a 957×1643 menu comp: inset from the card's rounded edge. */
const thumb = (top, bottom, left = 52) => [left, top + 8, 384 - left, bottom - top - 16];

const COMPOSITES = {
  // The home-screen concept is kept as a design reference; nothing is cut from it.
  'mockup-home': {},
  'brand-board': {
    'bar-lounge': [420, 0, 368, 457],
    'dish-signature-mains': [288, 459, 219, 205],
    'dish-seafood': [509, 459, 226, 205],
    'dish-desserts': [737, 459, 218, 205],
    'dish-cocktails': [957, 459, 163, 205],
    'dish-wines': [1122, 459, 198, 205],
    'dish-private-functions': [1322, 459, 214, 205],
    'table-setting': [0, 600, 285, 424],
    chandeliers: [288, 736, 509, 288],
    'floor-pattern': [800, 736, 366, 288],
    'texture-pattern': [1367, 48, 150, 104],
    'texture-timber': [1367, 199, 150, 95],
    'texture-marble': [1367, 344, 150, 63],
  },
  'mockup-starters': {
    'hero-starters': [330, 115, 627, 405],
    'menu-tiger-prawns': thumb(612, 795),
    'menu-scallops': thumb(814, 997),
    'menu-carpaccio': thumb(1016, 1200),
    'menu-burrata': thumb(1219, 1403),
    'menu-crispy-calamari': thumb(1423, 1607),
  },
  'mockup-signature': {
    'hero-signature': [455, 110, 502, 440],
    'menu-ribeye-bone': thumb(641, 822),
    'menu-fillet-mignon': thumb(837, 1016),
    'menu-tomahawk': thumb(1030, 1210),
    'menu-lamb-rack': thumb(1224, 1402),
    'menu-wagyu-striploin': thumb(1417, 1597),
  },
  'mockup-vegetarian': {
    'hero-vegetarian': [410, 110, 547, 420],
    'menu-roast-vegetables': thumb(616, 797, 54),
    'menu-mushroom-risotto': thumb(811, 990, 54),
    'menu-quinoa-butternut': thumb(1004, 1183, 54),
    'menu-halloumi': thumb(1197, 1377, 54),
    'menu-cauliflower-curry': thumb(1395, 1577, 54),
  },
  'mockup-seafood': {
    'hero-seafood': [380, 110, 577, 425],
    'menu-king-prawns': thumb(618, 797, 54),
    'menu-salmon': thumb(813, 992, 54),
    'menu-line-fish': thumb(1006, 1185, 54),
    'menu-calamari': thumb(1199, 1379, 54),
    'menu-seafood-platter': thumb(1397, 1579, 54),
  },
};

/** Longest edge the app ever needs; a 3x phone is ~1290px wide. */
const MAX_EDGE = 1400;

const registry = [];

for (const file of fs.readdirSync(masters).sort()) {
  if (!file.endsWith('.jpg')) continue;
  const key = file.replace(/\.jpg$/, '');
  if (key in COMPOSITES) continue;
  const meta = await sharp(path.join(masters, file)).metadata();
  await sharp(path.join(masters, file))
    .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 80, mozjpeg: true, progressive: true })
    .toFile(path.join(out, `${key}.jpg`));
  registry.push({ key, width: meta.width, height: meta.height, source: 'photograph' });
}

for (const [composite, crops] of Object.entries(COMPOSITES)) {
  const file = path.join(masters, `${composite}.jpg`);
  if (!fs.existsSync(file)) continue;
  for (const [key, [left, top, width, height]] of Object.entries(crops)) {
    if (registry.some((r) => r.key === key)) continue; // a real photograph wins
    await sharp(file)
      .extract({ left, top, width, height })
      .jpeg({ quality: 88, mozjpeg: true })
      .toFile(path.join(out, `${key}.jpg`));
    registry.push({ key, width, height, source: 'crop' });
  }
}

registry.sort((a, b) => a.key.localeCompare(b.key));
const lines = registry.map(
  (r) =>
    `  '${r.key}': { source: require('../../assets/photos/${r.key}.jpg'), width: ${r.width}, height: ${r.height}, origin: '${r.source}' },`,
);
fs.writeFileSync(
  path.join(root, 'src/content/photoRegistry.ts'),
  `// GENERATED by scripts/derive-photos.mjs — do not edit. Run \`npm run assets:photos\`.

export interface PhotoEntry {
  source: number;
  width: number;
  height: number;
  /** 'crop' is cut from a composite (brand board, design comp): cards and thumbnails only. */
  origin: 'photograph' | 'crop';
}

export const photoRegistry = {
${lines.join('\n')}
} as const satisfies Record<string, PhotoEntry>;

export type PhotoKey = keyof typeof photoRegistry;
`,
);
console.log(`registry ${registry.length} photos`);

/* ── Brand marks ──────────────────────────────────────────────────────────── */

const OBSIDIAN = '#0B0B0B';
const BRASS = '#C9A35B';
const fontFile = fs.readFileSync(
  path.join(
    root,
    'node_modules/@expo-google-fonts/playfair-display/400Regular/PlayfairDisplay_400Regular.ttf',
  ),
);
// CommonJS package: take `parse` off the default export (not the default's own member).
// eslint-disable-next-line import/no-named-as-default-member
const { parse: parseFont } = opentypeModule;
const font = parseFont(
  fontFile.buffer.slice(fontFile.byteOffset, fontFile.byteOffset + fontFile.byteLength),
);

/** The wordmark as an SVG path, centred in a square canvas. */
function markSvg(size, text, fontSize, { background = OBSIDIAN, accent = true } = {}) {
  const p = font.getPath(text, 0, 0, fontSize);
  const bb = p.getBoundingBox();
  const w = bb.x2 - bb.x1;
  const h = bb.y2 - bb.y1;
  const dx = (size - w) / 2 - bb.x1;
  const dy = (size - h) / 2 - bb.y1 + (accent ? fontSize * 0.06 : 0);
  const shifted = font.getPath(text, dx, dy, fontSize).toPathData(2);
  // The board's acute accent is a long, thin brass stroke over the A.
  const accentStroke = accent
    ? `<line x1="${size / 2 - fontSize * 0.02}" y1="${dy + bb.y1 - fontSize * 0.08}" x2="${size / 2 + fontSize * 0.14}" y2="${dy + bb.y1 - fontSize * 0.34}" stroke="${BRASS}" stroke-width="${fontSize * 0.022}" stroke-linecap="round"/>`
    : '';
  const bg = background ? `<rect width="100%" height="100%" fill="${background}"/>` : '';
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">${bg}<path d="${shifted}" fill="${BRASS}"/>${accentStroke}</svg>`,
  );
}

const brand = [
  ['icon.png', markSvg(1024, 'M', 620)],
  ['favicon.png', markSvg(96, 'M', 60, { accent: false })],
  ['splash-icon.png', markSvg(1024, 'MÁBU', 250, { background: null, accent: false })],
  ['adaptive-icon.png', markSvg(1024, 'M', 420, { background: null })],
];
for (const [file, svg] of brand) {
  await sharp(svg)
    .png()
    .toFile(path.join(root, 'assets', file));
  console.log(`brand   ${file}`);
}
