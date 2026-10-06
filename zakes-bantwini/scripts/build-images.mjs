#!/usr/bin/env node
/**
 * Encode the supplied masters into the responsive derivatives the site serves.
 *
 *   assets/masters/IMG_68xx.*  →  public/media/IMG_68xx-{width}.{avif,webp}
 *                                 public/media/IMG_68xx-og.jpg   (1200×630 share card)
 *                              →  src/content/media.manifest.json (dimensions, widths,
 *                                 blur placeholder, dominant colour)
 *
 * Masters are never modified. Derivatives are never upscaled: a 1080px master
 * gets 480/828/1080, a 2752px master gets 480/828/1200/1600/2400.
 *
 * Derivatives are skipped when they are newer than their master, so this is
 * cheap enough to run before every `dev` and `build`. The manifest is
 * rewritten every run and committed; the pixels are gitignored.
 *
 * Usage: node scripts/build-images.mjs [--force]
 */
import { readdirSync, statSync, mkdirSync, existsSync, writeFileSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MASTERS = path.join(root, 'assets', 'masters');
const OUT = path.join(root, 'public', 'media');
const MANIFEST = path.join(root, 'src', 'content', 'media.manifest.json');
const STEPS = [480, 828, 1200, 1600, 2400];
const force = process.argv.includes('--force');

mkdirSync(OUT, { recursive: true });

const masters = readdirSync(MASTERS)
  .filter((f) => /\.(webp|png|jpe?g)$/i.test(f))
  .sort();

/** Widths to encode for a master of `width` pixels — never wider than the master. */
function widthsFor(width) {
  const widths = STEPS.filter((w) => w < width);
  if (width <= STEPS[STEPS.length - 1]) widths.push(width);
  return widths;
}

function fresh(target, sourceMtime) {
  return !force && existsSync(target) && statSync(target).mtimeMs >= sourceMtime;
}

const manifest = {};
let encoded = 0;

for (const file of masters) {
  const id = file.replace(/\.[^.]+$/, '');
  const src = path.join(MASTERS, file);
  const mtime = statSync(src).mtimeMs;
  const image = sharp(src);
  const meta = await image.metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  const widths = widthsFor(width);

  for (const w of widths) {
    const avif = path.join(OUT, `${id}-${w}.avif`);
    const webp = path.join(OUT, `${id}-${w}.webp`);
    if (!fresh(avif, mtime)) {
      await sharp(src).resize({ width: w }).avif({ quality: 52, effort: 4 }).toFile(avif);
      encoded++;
    }
    if (!fresh(webp, mtime)) {
      await sharp(src).resize({ width: w }).webp({ quality: 78 }).toFile(webp);
      encoded++;
    }
  }

  const og = path.join(OUT, `${id}-og.jpg`);
  if (!fresh(og, mtime)) {
    await sharp(src)
      .resize({ width: 1200, height: 630, fit: 'cover', position: sharp.strategy.attention })
      .jpeg({ quality: 82, mozjpeg: true })
      .toFile(og);
    encoded++;
  }

  const blurBuffer = await sharp(src).resize({ width: 24 }).webp({ quality: 40 }).toBuffer();
  const { dominant } = await sharp(src).stats();
  const hex = (n) => n.toString(16).padStart(2, '0');

  manifest[id] = {
    file,
    width,
    height,
    format: meta.format,
    bytes: statSync(src).size,
    widths,
    blur: `data:image/webp;base64,${blurBuffer.toString('base64')}`,
    color: `#${hex(dominant.r)}${hex(dominant.g)}${hex(dominant.b)}`,
  };
}

const json = JSON.stringify(manifest, null, 2) + '\n';
const previous = existsSync(MANIFEST) ? readFileSync(MANIFEST, 'utf8') : '';
if (json !== previous) writeFileSync(MANIFEST, json);

console.log(
  `images: ${masters.length} masters, ${encoded} derivative${encoded === 1 ? '' : 's'} encoded` +
    (json !== previous ? ', manifest updated' : ''),
);
