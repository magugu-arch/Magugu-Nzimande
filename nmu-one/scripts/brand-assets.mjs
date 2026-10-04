#!/usr/bin/env node
/**
 * NMU ONE — app icon, splash and favicon.
 *
 * These are typographic on purpose. The supplied C.I. sheet shows the NMU mark
 * only as a small raster, and redrawing a university's logo by hand is not
 * something a prototype should do. Until NMU supplies vector masters, every
 * icon is the NMU ONE wordmark set in Nunito Sans on Primary Navy, with the
 * Primary Yellow rule from the C.I. sheet. Replace this script's output with
 * the licensed mark when it arrives; nothing else references these files.
 *
 * Requires ImageMagick (`convert`). Run: npm run assets:brand
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const font = (weight) =>
  path.join(
    root,
    'node_modules/@expo-google-fonts/nunito-sans',
    weight,
    `NunitoSans_${weight}.ttf`,
  );

const NAVY = '#141C2B';
const YELLOW = '#FFCC00';
const out = (name) => path.join(root, 'assets', name);

/** Wordmark: "NMU" over a yellow rule over "ONE", centred on a square canvas. */
function wordmark({ size, background, file, scale = 1, nmuColour = 'white', oneColour = YELLOW }) {
  const s = (n) => Math.round(n * scale);
  execFileSync('convert', [
    '-size',
    `${size}x${size}`,
    `xc:${background}`,
    '-gravity',
    'center',
    '-font',
    font('800ExtraBold'),
    '-fill',
    nmuColour,
    '-pointsize',
    String(s(300)),
    '-annotate',
    `+0-${s(70)}`,
    'NMU',
    '-fill',
    oneColour,
    '-draw',
    `rectangle ${size / 2 - s(170)},${size / 2 + s(70)} ${size / 2 + s(170)},${size / 2 + s(84)}`,
    '-font',
    font('700Bold'),
    '-pointsize',
    String(s(120)),
    '-kerning',
    String(s(28)),
    '-annotate',
    `+0+${s(170)}`,
    'ONE',
    file,
  ]);
}

wordmark({ size: 1024, background: NAVY, file: out('icon.png') });
wordmark({ size: 1024, background: 'none', file: out('splash-icon.png') });
// Android adaptive icons crop to a circle inside a 66% safe zone.
wordmark({ size: 1024, background: 'none', file: out('android-icon-foreground.png'), scale: 0.62 });
execFileSync('convert', ['-size', '1024x1024', `xc:${NAVY}`, out('android-icon-background.png')]);
wordmark({
  size: 1024,
  background: 'none',
  file: out('android-icon-monochrome.png'),
  scale: 0.62,
  oneColour: 'white',
});
wordmark({
  size: 96,
  background: 'none',
  file: out('notification-icon.png'),
  scale: 0.09,
  oneColour: 'white',
});
execFileSync('convert', [out('icon.png'), '-resize', '48x48', out('favicon.png')]);

console.log('Brand assets written to assets/.');
