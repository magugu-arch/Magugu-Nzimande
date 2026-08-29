#!/usr/bin/env node
/**
 * Generates the web image derivatives from the supplied masters.
 *
 * Masters in assets/food/masters are never edited and never served. Everything
 * the website loads is produced here, which is why apps/web/public/food is
 * generated rather than committed — run `npm run assets:derive` in apps/web, or
 * let `npm run build` do it.
 *
 * Two crops per master, each at 480 / 768 / 1200 wide, in WebP with a JPEG
 * fallback for anything that cannot take WebP:
 *   portrait 4:5  cards, product detail, cart lines
 *   wide    16:9  hero, offer banners
 */

import { mkdir, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../..');
const MASTERS = path.join(REPO, 'assets/food/masters');
const OUT = path.join(REPO, 'apps/web/public/food');

const WIDTHS = [480, 768, 1200];
const CROPS = [
  { suffix: '', ratio: 4 / 5 },
  { suffix: '-wide', ratio: 16 / 9 },
];

async function main() {
  const files = (await readdir(MASTERS)).filter((name) => /\.(jpe?g|png)$/i.test(name));
  if (files.length === 0) {
    console.error(`No masters found in ${MASTERS}`);
    process.exit(1);
  }

  await mkdir(OUT, { recursive: true });

  let written = 0;
  for (const file of files) {
    const key = path.basename(file, path.extname(file));
    const source = path.join(MASTERS, file);

    for (const crop of CROPS) {
      for (const width of WIDTHS) {
        const height = Math.round(width / crop.ratio);
        // Centre-weighted cover crop at an exact ratio, so a master is never
        // stretched. `attention` keeps the hero piece in frame on the portrait
        // masters, which are the ones a centre crop would slice.
        const base = sharp(source).resize(width, height, {
          fit: 'cover',
          position: sharp.strategy.attention,
        });

        const stem = path.join(OUT, `${key}${crop.suffix}-${width}`);
        const [webp, jpeg] = await Promise.all([
          base.clone().webp({ quality: 74 }).toBuffer(),
          base.clone().jpeg({ quality: 80, progressive: true, mozjpeg: true }).toBuffer(),
        ]);

        await Promise.all([
          writeFile(`${stem}.webp`, webp),
          writeFile(`${stem}.jpg`, jpeg),
        ]);
        written += 2;
      }
    }
  }

  console.log(`Wrote ${written} derivatives for ${files.length} masters into ${path.relative(REPO, OUT)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
