#!/usr/bin/env node
/**
 * Renders the app icons from the product mark. Run once after changing the
 * mark; the outputs in apps/web/public/icons are committed.
 *
 * The mark is a square doorway ("one front door") cut into a gold tile. It is
 * deliberately unlike any official emblem and must stay that way. It has no
 * rounded corners; a home screen applies its own mask.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const out = path.resolve(import.meta.dirname, '..', 'apps', 'web', 'public', 'icons');
mkdirSync(out, { recursive: true });

/** `pad` is the safe-zone inset (0–1) used for maskable icons. */
const mark = (pad = 0) => {
  const scale = 1 - pad * 2;
  const offset = 16 * pad * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" fill="#d5a52a"/>
  <g transform="translate(${offset / 2} ${offset / 2}) scale(${scale})">
    <rect x="11" y="7" width="10" height="16" fill="#070c14"/>
    <rect x="7" y="23" width="18" height="2" fill="#070c14"/>
  </g>
</svg>`;
};

writeFileSync(path.join(out, 'icon.svg'), `${mark()}\n`);
const png = (svg, size, name) =>
  sharp(Buffer.from(svg), { density: 600 }).resize(size, size).png().toFile(path.join(out, name));

await png(mark(), 192, 'icon-192.png');
await png(mark(), 512, 'icon-512.png');
await png(mark(0.14), 512, 'maskable-512.png');
await png(mark(0.08), 180, 'apple-touch-icon.png');
console.log('icons written to', out);
