/**
 * Generates every icon from the one mark geometry:
 *   src/app/icon.svg        SVG favicon (modern browsers)
 *   src/app/favicon.ico     16/32/48 px PNG-in-ICO for everything else
 *   src/app/apple-icon.png  180 px home-screen icon for iPhone and iPad
 *   public/icons/*.png      192/512 px install icons, a maskable icon, a notification badge
 *
 *   npm run assets:icons
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { markSvg } from '../src/components/brand/mark-paths';

const root = path.resolve(import.meta.dirname, '..');
const appDir = path.join(root, 'src', 'app');
const iconDir = path.join(root, 'public', 'icons');
await mkdir(iconDir, { recursive: true });

const png = (svg: string, size: number) => sharp(Buffer.from(svg)).resize(size, size).png({ compressionLevel: 9 }).toBuffer();

// Favicon SVG: rounded tile so it reads on light and dark tab strips alike.
const tile = markSvg({ size: 64, background: 'charcoal', radius: 14, inset: 0.02 });
await writeFile(path.join(appDir, 'icon.svg'), tile);

// favicon.ico holding PNG images (supported by every browser since IE Vista era).
const icoSizes = [16, 32, 48];
const icoImages = await Promise.all(icoSizes.map((s) => png(tile, s)));
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(icoSizes.length, 4);
let offset = 6 + 16 * icoSizes.length;
const dir = icoImages.map((img, i) => {
  const e = Buffer.alloc(16);
  const s = icoSizes[i]!;
  e.writeUInt8(s, 0);
  e.writeUInt8(s, 1);
  e.writeUInt8(0, 2);
  e.writeUInt8(0, 3);
  e.writeUInt16LE(1, 4);
  e.writeUInt16LE(32, 6);
  e.writeUInt32LE(img.length, 8);
  e.writeUInt32LE(offset, 12);
  offset += img.length;
  return e;
});
await writeFile(path.join(appDir, 'favicon.ico'), Buffer.concat([header, ...dir, ...icoImages]));

// iOS draws its own rounded mask: full-bleed square, no transparency.
const square = markSvg({ size: 512, background: 'charcoal', radius: 0, inset: 0.08 });
await writeFile(path.join(appDir, 'apple-icon.png'), await png(square, 180));

// Install icons. "any" icons carry their own rounded corners.
const rounded = markSvg({ size: 512, background: 'charcoal', radius: 14, inset: 0.06 });
await writeFile(path.join(iconDir, 'icon-192.png'), await png(rounded, 192));
await writeFile(path.join(iconDir, 'icon-512.png'), await png(rounded, 512));

// Maskable: platform crops to a circle/squircle, so keep the mark inside the 80% safe zone.
const maskable = markSvg({ size: 512, background: 'charcoal', radius: 0, inset: 0.2 });
await writeFile(path.join(iconDir, 'icon-maskable-512.png'), await png(maskable, 512));

// Android notification badge: a white silhouette on transparent (Android ignores colour).
const badge = markSvg({ size: 96, background: 'none', detail: '#FFFFFF' }).replaceAll('url(#tw)', '#FFFFFF');
await writeFile(path.join(iconDir, 'badge-96.png'), await png(badge, 96));

console.log('Icons written: icon.svg, favicon.ico, apple-icon.png, public/icons/*');
