#!/usr/bin/env node
/**
 * Builds the single-file review build of the website.
 *
 * The hosted page has no server, so it cannot load anything over the network:
 * every supplied master is embedded as a data URI, straight from
 * assets/…/masters, which stay untouched as always.
 *
 * Reads apps/web/static-demo/index.template.html and replaces one placeholder
 * with the generated assets. Output goes to apps/web/static-demo/bbq-chicken-website.html,
 * which is generated and not committed.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import tokens from '../../packages/ui/src/tokens.json' with { type: 'json' };

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../..');
const FOOD = path.join(REPO, 'assets/food/masters');
const BRAND = path.join(REPO, 'assets/brand/masters');
const OUT_DIR = path.join(REPO, 'apps/web/static-demo');

/** Every master, by the image key the catalogue uses. */
const KEYS = [
  'golden-original',
  'honey-garlic',
  'soy-garlic',
  'secret-sauce',
  'hot-spicy',
  'cheesling',
  'half-and-half',
  'golden-original-wings',
  'boneless',
  'chicken-rice-meal',
  'chicken-burger',
  'korean-rice-bowl',
  'french-fries',
  'cheesling-fries',
  'ddeok-bokki',
  'rose-ddeok-bokki',
];

/** Only these are ever shown in a 16:9 crop, so only these need one. */
const WIDE = [
  'golden-original',
  'honey-garlic',
  'half-and-half',
  'chicken-rice-meal',
  'french-fries',
  'golden-original-wings',
];

const PORTRAIT_WIDTH = 640;
const WIDE_WIDTH = 1000;

function rgb(hex) {
  return [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));
}

const RED = rgb(tokens.brand.red);
const BLACK = rgb(tokens.brand.black);

function squaredDistance(r, g, b, target) {
  const dr = r - target[0];
  const dg = g - target[1];
  const db = b - target[2];
  return dr * dr + dg * dg + db * db;
}

/** The guidelines' dark-ground lock-up: black ink to white, wordmark still red. */
async function reverse(source) {
  const { data, info } = await sharp(source)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = Buffer.from(data);
  for (let i = 0; i < pixels.length; i += info.channels) {
    if (
      squaredDistance(pixels[i], pixels[i + 1], pixels[i + 2], BLACK) <=
      squaredDistance(pixels[i], pixels[i + 1], pixels[i + 2], RED)
    ) {
      pixels[i] = 0xff;
      pixels[i + 1] = 0xff;
      pixels[i + 2] = 0xff;
    }
  }

  return sharp(pixels, {
    raw: { width: info.width, height: info.height, channels: info.channels },
  })
    .png()
    .toBuffer();
}

async function crop(source, width, ratio) {
  return sharp(source)
    .resize(width, Math.round(width / ratio), {
      fit: 'cover',
      position: sharp.strategy.attention,
    })
    .webp({ quality: 76 })
    .toBuffer();
}

const uri = (buffer, type) => `data:${type};base64,${buffer.toString('base64')}`;

/**
 * The approved palette as CSS custom properties, so the single-file build
 * carries no colour of its own. tokens.json stays the one source.
 */
function paletteCss() {
  const lines = [
    ...Object.entries(tokens.brand).map(([name, hex]) => `--${name}:${hex};`),
    `--red-deep:${tokens.redDeep};`,
    ...[80, 60, 40, 20, 10].map((step) => `--red-${step}:${tokens.redTints[step]};`),
    ...[80, 60, 40, 20, 10].map((step) => `--black-${step}:${tokens.blackTints[step]};`),
    `--paper:${tokens.neutralTints[10]};`,
    `--line:${tokens.neutralTints[20]};`,
    `--line-strong:${tokens.lineStrong};`,
    `--muted:${tokens.neutralTints[100]};`,
  ];
  return lines.join(' ');
}

async function main() {
  const portrait = {};
  const wide = {};

  for (const key of KEYS) {
    const source = path.join(FOOD, `${key}.jpg`);
    portrait[key] = uri(await crop(source, PORTRAIT_WIDTH, 4 / 5), 'image/webp');
    if (WIDE.includes(key)) {
      wide[key] = uri(await crop(source, WIDE_WIDTH, 16 / 9), 'image/webp');
    }
  }

  const lockupSource = path.join(BRAND, 'bbq-lockup.png');
  const lockup = uri(
    await sharp(lockupSource).resize({ width: 560 }).png({ compressionLevel: 9 }).toBuffer(),
    'image/png',
  );
  const lockupReversed = uri(
    await sharp(await reverse(lockupSource))
      .resize({ width: 560 })
      .png({ compressionLevel: 9 })
      .toBuffer(),
    'image/png',
  );

  const assets =
    `const IMG = ${JSON.stringify(portrait)};\n` +
    `const IMG_WIDE = ${JSON.stringify(wide)};\n` +
    `const LOCKUP = ${JSON.stringify(lockup)};\n` +
    `const LOCKUP_REVERSED = ${JSON.stringify(lockupReversed)};`;

  const template = await readFile(path.join(OUT_DIR, 'index.template.html'), 'utf8');
  for (const placeholder of ['/*__ASSETS__*/', '/*__TOKENS__*/']) {
    if (!template.includes(placeholder)) {
      throw new Error(`The template has lost its ${placeholder} placeholder`);
    }
  }

  await mkdir(OUT_DIR, { recursive: true });
  const html = template
    .replace('/*__TOKENS__*/', paletteCss())
    .replace('/*__ASSETS__*/', assets);
  const target = path.join(OUT_DIR, 'bbq-chicken-website.html');
  await writeFile(target, html, 'utf8');

  const mb = (Buffer.byteLength(html, 'utf8') / 1024 / 1024).toFixed(2);
  console.log(`Wrote ${path.relative(REPO, target)} — ${mb} MB, ${KEYS.length} masters embedded`);
  if (Number(mb) > 15) {
    throw new Error('Over the 16 MB artifact ceiling; drop the derivative widths');
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
