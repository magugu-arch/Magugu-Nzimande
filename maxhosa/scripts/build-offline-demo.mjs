#!/usr/bin/env node
/**
 * Build the single-file offline demo and its share package.
 *
 * The demo has to open from a double-click in Finder, from Android's Files
 * app, or from a WhatsApp download, with no server and no internet. So
 * everything it needs is folded into one HTML file:
 *
 *   - demo/styles.css, inline
 *   - demo/js/*.js, concatenated in order into one classic <script> (no
 *     modules — those do not load from file://)
 *   - data/sample-catalogue.json, inline as MX_DATA
 *   - the 24 verified images from the manifest, as data: URIs
 *   - the display face (Playfair Display, OFL), as a data: URI
 *
 * The page's Content-Security-Policy then forbids every network fetch, so if
 * anything here ever reached for the network it would fail loudly in testing
 * rather than quietly work only when online.
 *
 * Outputs (all in deliverables/):
 *   MAXHOSA_AFRICA_App_Offline_Demo.html
 *   OPEN_ME_FIRST_README.txt
 *   MAXHOSA_AFRICA_App_Offline_Package.zip   (the two files above)
 *
 * Run: node scripts/build-offline-demo.mjs
 */
import { fileURLToPath } from 'node:url';
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { deflateRawSync } from 'node:zlib';
import { Script } from 'node:vm';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(root, 'deliverables');
const HTML_NAME = 'MAXHOSA_AFRICA_App_Offline_Demo.html';
const README_NAME = 'OPEN_ME_FIRST_README.txt';
const ZIP_NAME = 'MAXHOSA_AFRICA_App_Offline_Package.zip';
const FONT = path.join(
  root,
  'node_modules/@expo-google-fonts/playfair-display/500Medium/PlayfairDisplay_500Medium.ttf',
);

const read = (p) => readFileSync(path.join(root, p), 'utf8');
const pkg = JSON.parse(read('package.json'));

// --- data ---------------------------------------------------------------
const manifest = JSON.parse(read('assets/maxhosa/MAXHOSA_AFRICA_24_Image_Asset_Manifest.json'));
const catalogue = JSON.parse(read('data/sample-catalogue.json'));
delete catalogue.$comment;

const assets = {};
for (const a of manifest.assets) {
  const bytes = readFileSync(path.join(root, 'assets/maxhosa', a.file));
  assets[a.id] = {
    uri: `data:image/jpeg;base64,${bytes.toString('base64')}`,
    alt: a.alt,
    title: a.title,
  };
}

// Every image the catalogue names must be one of the 24, and all 24 must be used.
const referenced = new Set();
const note = (id, where) => {
  if (!assets[id]) throw new Error(`${where} names ${id}, which is not in the verified manifest`);
  referenced.add(id);
};
catalogue.categories.forEach((c) => note(c.asset, `category ${c.id}`));
catalogue.products.forEach((p) => p.media.forEach((m) => note(m, `product ${p.id}`)));
catalogue.stories.forEach((s) => [s.hero, ...s.media].forEach((m) => note(m, `story ${s.id}`)));
['mx-asset-10'].forEach((id) => note(id, 'home hero'));
const unused = Object.keys(assets).filter((id) => !referenced.has(id));
if (unused.length) throw new Error(`verified assets not placed anywhere in the demo: ${unused.join(', ')}`);

const data = { ...catalogue, assets };

// --- script -------------------------------------------------------------
const jsDir = path.join(root, 'demo/js');
const jsFiles = readdirSync(jsDir)
  .filter((f) => f.endsWith('.js'))
  .sort();
const js =
  "(function () {\n'use strict';\n" +
  jsFiles.map((f) => `/* ${f} */\n${readFileSync(path.join(jsDir, f), 'utf8')}`).join('\n') +
  '\n})();\n';
// Fail the build on a syntax error rather than shipping a blank page.
new Script(js, { filename: 'offline-demo.js' });
for (const banned of [/\bimport\s*\(/, /^\s*import\s/m, /\bfetch\s*\(/, /XMLHttpRequest/, /serviceWorker/]) {
  if (banned.test(js)) throw new Error(`demo script must not use ${banned}`);
}

// --- page ---------------------------------------------------------------
const font = readFileSync(FONT).toString('base64');
const css = read('demo/styles.css').replace('__FONT_DISPLAY__', `data:font/ttf;base64,${font}`);
const built = new Date().toISOString().slice(0, 10);
const json = JSON.stringify(data).replace(/</g, '\\u003c');

const html = read('demo/index.html')
  .replace('/*__CSS__*/', () => css)
  .replace('/*__DATA__*/ null', () => json)
  .replace('/*__JS__*/', () => js.replace(/<\/script/gi, '<\\/script'))
  .replace('__VERSION__', pkg.version)
  .replace('__BUILT__', built);

mkdirSync(OUT, { recursive: true });
writeFileSync(path.join(OUT, HTML_NAME), html);
const readme = read('demo/OPEN_ME_FIRST_README.txt');
writeFileSync(path.join(OUT, README_NAME), readme);

// --- zip ----------------------------------------------------------------
writeFileSync(
  path.join(OUT, ZIP_NAME),
  zip([
    { name: `MAXHOSA_AFRICA_App_Offline_Package/${README_NAME}`, data: Buffer.from(readme) },
    { name: `MAXHOSA_AFRICA_App_Offline_Package/${HTML_NAME}`, data: Buffer.from(html) },
  ]),
);

const mb = (n) => (n / 1024 / 1024).toFixed(2) + ' MB';
console.log(`Wrote deliverables/${HTML_NAME} (${mb(Buffer.byteLength(html))}), ${README_NAME} and ${ZIP_NAME}.`);

/**
 * A minimal ZIP writer (deflate, no extras) — enough for two files, and it
 * keeps the build free of an archiver dependency.
 */
function zip(entries) {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc32 = (buf) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const now = new Date();
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2);
  const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();

  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const e of entries) {
    const name = Buffer.from(e.name, 'utf8');
    const compressed = deflateRawSync(e.data, { level: 9 });
    const crc = crc32(e.data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // UTF-8 names
    local.writeUInt16LE(8, 8); // deflate
    local.writeUInt16LE(dosTime, 10);
    local.writeUInt16LE(dosDate, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(e.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, name, compressed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(dosTime, 12);
    central.writeUInt16LE(dosDate, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(e.data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, name);
    offset += local.length + name.length + compressed.length;
  }
  const centralSize = centrals.reduce((n, b) => n + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, ...centrals, end]);
}
