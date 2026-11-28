#!/usr/bin/env node
/**
 * One-off importer: turns the supplied key images into web masters in
 * public/images/. Masters keep the source dimensions as high-quality
 * progressive JPEGs; Next.js derives AVIF/WebP sizes from them at request time.
 *
 *   node scripts/import-images.mjs <mapping.json>
 *
 * mapping.json: [{ "src": "/abs/path/IMG_8159.png", "slug": "towers-mural-hero" }, ...]
 * Re-run `npm run assets:manifest` afterwards.
 */
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const mappingFile = process.argv[2];
if (!mappingFile) {
  console.error('Usage: node scripts/import-images.mjs <mapping.json>');
  process.exit(1);
}

const outDir = path.resolve(import.meta.dirname, '..', 'public', 'images');
await mkdir(outDir, { recursive: true });

const mapping = JSON.parse(await readFile(mappingFile, 'utf8'));
for (const { src, slug } of mapping) {
  const out = path.join(outDir, `${slug}.jpg`);
  const info = await sharp(src)
    .rotate()
    .resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 84, progressive: true, mozjpeg: true, chromaSubsampling: '4:4:4' })
    .toFile(out);
  console.log(`${slug}.jpg  ${info.width}x${info.height}  ${(info.size / 1024).toFixed(0)} KB`);
}
