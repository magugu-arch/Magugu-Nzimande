#!/usr/bin/env node
/**
 * Derive the website's logo files from the licensed master artwork.
 *
 * Source of truth, tight-cropped to its ink on a transparent ground:
 *   assets/brand/masters/bbq-lockup.png   symbol + wordmark + descriptor
 *   assets/brand/masters/bbq-symbol.png   the symbol mark alone
 *
 * The lock-up is never stacked, stretched, rotated or rearranged here: every
 * output is the one horizontal lock-up at a different size. The only derived
 * variant is the reversal the guidelines themselves show on bb.q Black — the
 * descriptor and symbol turn white while the wordmark stays bb.q Red. Ink
 * coverage is carried by the original alpha, so nothing is redrawn.
 *
 * Output is generated, not committed. Run from apps/web via `npm run
 * assets:derive`, which `npm run build` does for you.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import tokens from '../../packages/ui/src/tokens.json' with { type: 'json' };

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../..');
const MASTERS = path.join(REPO, 'assets/brand/masters');
const OUT = path.join(REPO, 'apps/web/public/brand');

function rgb(hex) {
  return [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));
}

/** bb.q Red and bb.q Black, the only two inks in the master. */
const RED = rgb(tokens.brand.red);
const BLACK = rgb(tokens.brand.black);

const LOCKUP_WIDTHS = [240, 480, 720];
const SYMBOL_WIDTHS = [96, 192, 512];

function squaredDistance(r, g, b, target) {
  const dr = r - target[0];
  const dg = g - target[1];
  const db = b - target[2];
  return dr * dr + dg * dg + db * db;
}

/**
 * Turns the black ink white and leaves the red ink alone, pixel by pixel.
 * Antialiased edges are carried by alpha, so the shape is untouched.
 */
async function reverse(source) {
  const { data, info } = await sharp(source)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = Buffer.from(data);
  for (let i = 0; i < pixels.length; i += info.channels) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    if (squaredDistance(r, g, b, BLACK) <= squaredDistance(r, g, b, RED)) {
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

async function emit(source, widths, name) {
  for (const width of widths) {
    const buffer = await sharp(source)
      .resize({ width, fit: 'inside', withoutEnlargement: false })
      .png({ compressionLevel: 9 })
      .toBuffer();
    await writeFile(path.join(OUT, `${name}-${width}.png`), buffer);
  }
}

async function main() {
  await mkdir(OUT, { recursive: true });

  const lockup = path.join(MASTERS, 'bbq-lockup.png');
  const symbol = path.join(MASTERS, 'bbq-symbol.png');

  await emit(lockup, LOCKUP_WIDTHS, 'lockup');
  await emit(await reverse(lockup), LOCKUP_WIDTHS, 'lockup-reversed');
  await emit(symbol, SYMBOL_WIDTHS, 'symbol');

  const count = LOCKUP_WIDTHS.length * 2 + SYMBOL_WIDTHS.length;
  console.log(`Wrote ${count} brand files into ${path.relative(REPO, OUT)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
