/**
 * Generates every icon from the S + T monogram (identity option 01), using the
 * app icon from the identity document: the bone S and crimson drop on tower black.
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
import { stAppIconSvg, stMark } from '../src/components/brand/st-identity';

const root = path.resolve(import.meta.dirname, '..');
const appDir = path.join(root, 'src', 'app');
const iconDir = path.join(root, 'public', 'icons');
await mkdir(iconDir, { recursive: true });

const png = (svg: string, size: number) => sharp(Buffer.from(svg)).resize(size, size).png({ compressionLevel: 9 }).toBuffer();

// Favicon: a rounded tile with the mark a little larger than on the app icon, so it reads at 16 px.
const tile = stAppIconSvg({ size: 64, radius: 0.22, inset: 0.14 });
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
await writeFile(path.join(appDir, 'apple-icon.png'), await png(stAppIconSvg({ size: 512, radius: 0, inset: 0.2 }), 180));

// Install icons. "any" icons carry their own rounded corners, as in the identity document.
const rounded = stAppIconSvg({ size: 512, radius: 0.22, inset: 0.2 });
await writeFile(path.join(iconDir, 'icon-192.png'), await png(rounded, 192));
await writeFile(path.join(iconDir, 'icon-512.png'), await png(rounded, 512));

// Maskable: platforms crop to a circle or squircle, so keep the mark inside the 80% safe zone.
await writeFile(path.join(iconDir, 'icon-maskable-512.png'), await png(stAppIconSvg({ size: 512, radius: 0, inset: 0.28 }), 512));

// Android notification badge: a white silhouette on transparent (Android ignores colour).
const b = 96;
const markH = b * 0.72;
const k = markH / stMark.height;
const badge = `<svg xmlns="http://www.w3.org/2000/svg" width="${b}" height="${b}" viewBox="0 0 ${b} ${b}"><g transform="translate(${((b - stMark.width * k) / 2).toFixed(2)} ${((b - markH) / 2).toFixed(2)}) scale(${k.toFixed(4)})"><path fill="#FFFFFF" d="${stMark.s}"/><path fill="#FFFFFF" d="${stMark.t}"/></g></svg>`;
await writeFile(path.join(iconDir, 'badge-96.png'), await png(badge, b));

console.log('Icons written: icon.svg, favicon.ico, apple-icon.png, public/icons/*');
