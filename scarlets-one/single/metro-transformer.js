/**
 * Metro transformer for the single-file build (see apps/mobile/metro.config.js).
 *
 * It wraps Expo's transformer, as the Expo docs describe, and does two things
 * before handing over:
 *
 * 1. Images and fonts become JavaScript modules. The 39 reference photos point
 *    at copies embedded once in the HTML page; small library icons carry their
 *    own bytes.
 * 2. Expo Router's four browser-history modules read the address from an
 *    adapter (single/runtime.js) instead of `window.location`, because a page
 *    opened from a file cannot change its path. Every replacement is counted:
 *    if an Expo upgrade changes those modules, the build stops here.
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const upstream = require('@expo/metro-config/babel-transformer');

const REFERENCE_DIR = path.resolve(__dirname, '../assets/reference');
const IMAGE_TYPES = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};
const FONT_TYPES = { '.ttf': 'font/ttf' };

const manifest = JSON.parse(fs.readFileSync(path.join(REFERENCE_DIR, 'manifest.json'), 'utf8'));
const referenceByFile = new Map(manifest.map((entry) => [entry.file, entry]));

const NAV = 'globalThis.__SO_NAV__';

/** [file suffix, [[search, replacement, expected count], ...]] */
const ROUTER_PATCHES = [
  [
    'expo-router/build/fork/createMemoryHistory.js',
    [
      ['window.history', `${NAV}.history`, 6],
      [': location.hash;', `: ${NAV}.location.hash;`, 1],
    ],
  ],
  [
    'expo-router/build/fork/useLinking.js',
    [
      ['window.location', `${NAV}.location`, 2],
      ['const { location } = window;', `const location = ${NAV}.location;`, 1],
    ],
  ],
  ['expo-router/build/link/linking.js', [['window.location', `${NAV}.location`, 2]]],
  ['expo-router/build/ExpoRoot.js', [['window.location', `${NAV}.location`, 1]]],
];

function count(haystack, needle) {
  return haystack.split(needle).length - 1;
}

function patchRouter(src, absolute) {
  const normalised = absolute.split(path.sep).join('/');
  const entry = ROUTER_PATCHES.find(([suffix]) => normalised.endsWith(`/node_modules/${suffix}`));
  if (!entry) return src;
  let out = src;
  for (const [search, replacement, expected] of entry[1]) {
    const found = count(out, search);
    if (found !== expected) {
      throw new Error(
        `single-file build: expected ${expected} of "${search}" in ${entry[0]}, found ${found}. ` +
          'Expo Router has changed; review single/metro-transformer.js.',
      );
    }
    out = out.split(search).join(replacement);
  }
  return out;
}

function pngSize(buffer) {
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function imageModule(absolute, ext) {
  const reference =
    path.dirname(absolute) === REFERENCE_DIR ? referenceByFile.get(path.basename(absolute)) : null;
  if (reference) {
    const key = path.basename(absolute, ext);
    return (
      `module.exports = { uri: globalThis.__SO_MEDIA__[${JSON.stringify(key)}], ` +
      `width: ${reference.width}, height: ${reference.height} };`
    );
  }
  const buffer = fs.readFileSync(absolute);
  if (ext !== '.png') {
    throw new Error(`single-file build: no size reader for ${absolute}`);
  }
  const { width, height } = pngSize(buffer);
  const uri = `data:${IMAGE_TYPES[ext]};base64,${buffer.toString('base64')}`;
  return `module.exports = { uri: ${JSON.stringify(uri)}, width: ${width}, height: ${height} };`;
}

function fontModule(absolute, ext) {
  const key = path.basename(absolute, ext).toLowerCase();
  // The page declares the font once; the module hands the same bytes to expo-font.
  return `module.exports = globalThis.__SO_FONTS__[${JSON.stringify(key)}];`;
}

module.exports.transform = async ({ src, filename, options, ...rest }) => {
  const absolute = path.resolve(options.projectRoot, filename);
  const ext = path.extname(absolute).toLowerCase();
  let source = src;
  if (IMAGE_TYPES[ext]) source = imageModule(absolute, ext);
  else if (FONT_TYPES[ext]) source = fontModule(absolute, ext);
  else if (ext === '.js') source = patchRouter(src, absolute);
  return upstream.transform({ src: source, filename, options, ...rest });
};

module.exports.getCacheKey = () =>
  crypto
    .createHash('sha1')
    .update(upstream.getCacheKey ? String(upstream.getCacheKey()) : '')
    .update(fs.readFileSync(__filename))
    .update(JSON.stringify(manifest.map((entry) => [entry.file, entry.width, entry.height])))
    .digest('hex');
