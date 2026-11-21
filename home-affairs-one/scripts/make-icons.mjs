#!/usr/bin/env node
/**
 * Renders the app icons from the product mark. Run once after changing the
 * mark; the outputs in apps/web/public/icons are committed.
 *
 * The mark is an abstract arch ("one front door"). It is deliberately unlike
 * any official emblem and must stay that way.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const out = path.resolve(import.meta.dirname, '..', 'apps', 'web', 'public', 'icons');
mkdirSync(out, { recursive: true });

/** `pad` is the safe-zone inset (0–1) used for maskable icons. */
const mark = (pad = 0, radius = 9) => {
  const scale = 1 - pad * 2;
  const offset = 16 * pad * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="${radius}" fill="#102a43"/>
  <g transform="translate(${offset / 2} ${offset / 2}) scale(${scale})">
    <path d="M10.5 24.5V15a5.5 5.5 0 0 1 11 0v9.5z" fill="#fff"/>
    <rect x="7.5" y="23.75" width="17" height="2.25" rx="1.125" fill="#d5a52a"/>
  </g>
</svg>`;
};

writeFileSync(path.join(out, 'icon.svg'), `${mark()}\n`);
const png = (svg, size, name) =>
  sharp(Buffer.from(svg), { density: 600 }).resize(size, size).png().toFile(path.join(out, name));

await png(mark(), 192, 'icon-192.png');
await png(mark(), 512, 'icon-512.png');
await png(mark(0.14, 0), 512, 'maskable-512.png');
await png(mark(0.08, 0), 180, 'apple-touch-icon.png');
console.log('icons written to', out);
