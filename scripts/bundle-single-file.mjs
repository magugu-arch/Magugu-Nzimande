#!/usr/bin/env node
/**
 * Fold the exported web app into one self-contained HTML file.
 *
 * `expo export` produces an index.html, a JS bundle and ~100 separate asset
 * files. That is correct for a web server and useless for anywhere that can
 * only take a single document — an artifact host, an email attachment, a USB
 * stick handed to somebody without a toolchain.
 *
 * Every asset path in the bundle is a plain string, so each one is replaced by
 * a `data:` URI of the file it named. Photographs are re-encoded as WebP and
 * capped at a phone's pixel width on the way through, because the shipped
 * artwork is sized for a retina device and base64 inflates whatever it is given
 * by a third.
 *
 * The result is the same app, running the same bundle, against the same mock
 * service layer. It is not the store build: the photographs are smaller, and
 * deep links cannot work because there is only one document to serve.
 *
 * Run: node scripts/bundle-single-file.mjs [outputPath]
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BUILD = path.join(root, '.preview-web');
const out = process.argv[2] ?? path.join(root, '.preview-web', 'bbq-chicken-app.html');

const EXPORT_COMMAND =
  '  EXPO_PUBLIC_USE_MOCK_API=1 npx expo export --platform web --output-dir .preview-web --clear';

if (!existsSync(BUILD)) {
  console.error('No export found. Run:\n' + EXPORT_COMMAND);
  process.exit(2);
}

/**
 * Refuse to fold an export that is older than the code it claims to be.
 *
 * This reads as belt and braces and is not. `expo export` defaults to `dist`,
 * this script reads `.preview-web`, and the two look identical from the
 * outside — so `expo export --platform web && npm run bundle:single` rebuilds
 * one directory and bundles the other, reports success twice, and hands back a
 * file containing whatever was last built. It shipped a fix to a customer that
 * the file did not contain, and nothing in either command said a word.
 *
 * A build older than `src` is always wrong, so it is worth an error rather
 * than a note somebody has to remember to read.
 */
function newestSourceTime(dir) {
  let newest = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    newest = Math.max(newest, entry.isDirectory() ? newestSourceTime(full) : statSync(full).mtimeMs);
  }
  return newest;
}

const exportedJs = path.join(BUILD, '_expo');
const builtAt = existsSync(exportedJs) ? newestSourceTime(exportedJs) : 0;
const sourceAt = newestSourceTime(path.join(root, 'src'));

if (builtAt < sourceAt) {
  const behind = Math.round((sourceAt - builtAt) / 60_000);
  console.error(
    `The export in .preview-web is ${behind} minute(s) older than src/, so it does not\n` +
      'contain the current code. Bundling it would produce a file that looks right\n' +
      'and is not. Rebuild first:\n' +
      EXPORT_COMMAND,
  );
  process.exit(2);
}

/**
 * How wide each crop needs to be, in device pixels.
 *
 * The app lays out at 390pt; at 2x that is 780. Anything past ~900 is detail
 * nobody can see on a phone and weight everybody pays for.
 */
const MAX_EDGE = { banner: 820, card: 720, detail: 840, thumb: 280 };
const DEFAULT_MAX_EDGE = 560;

/**
 * WebP quality for the inlined copies.
 *
 * Lower than the shipped derivatives on purpose. These are re-encodes of
 * already-compressed JPEGs viewed at phone width, and base64 adds a third on
 * top of whatever they weigh, so a few points of quality buys back megabytes
 * that a viewer would otherwise wait for.
 */
const QUALITY = { opaque: 72, alpha: 76 };

/**
 * What a single-document host will actually accept.
 *
 * The caps above were chosen against a sixteen-product menu. Eight more
 * products took the file to 16.4 MB — past the 16 MB an artifact host allows —
 * and this script printed "self-contained" and exited 0, because it measured
 * the file only to report it. A build that cannot be published is a failed
 * build, and finding that out at the publish step, after a full export, is
 * finding it out too late.
 */
const MAX_BYTES = 16 * 1000 * 1000;

const MIME = {
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
};

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

const assetsDir = path.join(BUILD, 'assets');
const files = existsSync(assetsDir) ? walk(assetsDir) : [];
const images = files.filter((file) => /\.(png|jpe?g)$/i.test(file));

/**
 * Re-encode every photograph as WebP at phone size, in one Python pass —
 * Pillow is already here for the screenshot pipeline and Node has no image
 * codec of its own.
 */
const recipe = images.map((file) => {
  const variant = path.basename(path.dirname(file));
  return { file, max: MAX_EDGE[variant] ?? DEFAULT_MAX_EDGE };
});

console.log(`Re-encoding ${recipe.length} images…`);
const encoded = JSON.parse(
  execFileSync(
    'python3',
    [
      '-c',
      `
import sys, json, io, base64
from PIL import Image
out = {}
for item in json.load(sys.stdin):
    im = Image.open(item['file'])
    longest = max(im.size)
    if longest > item['max']:
        scale = item['max'] / longest
        im = im.resize((max(1, round(im.width * scale)), max(1, round(im.height * scale))), Image.LANCZOS)
    buf = io.BytesIO()
    if im.mode in ('RGBA', 'LA', 'P'):
        im.convert('RGBA').save(buf, 'WEBP', quality=${QUALITY.alpha}, method=6)
    else:
        im.convert('RGB').save(buf, 'WEBP', quality=${QUALITY.opaque}, method=6)
    out[item['file']] = base64.b64encode(buf.getvalue()).decode()
json.dump(out, sys.stdout)
`,
    ],
    { input: JSON.stringify(recipe), maxBuffer: 1024 * 1024 * 512, encoding: 'utf8' },
  ),
);

/** Every asset, as the data URI that replaces its path. */
const dataUris = new Map();
for (const file of files) {
  const key = '/' + path.relative(BUILD, file).split(path.sep).join('/');
  if (encoded[file]) {
    dataUris.set(key, `data:image/webp;base64,${encoded[file]}`);
    continue;
  }
  const mime = MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream';
  dataUris.set(key, `data:${mime};base64,${readFileSync(file).toString('base64')}`);
}

const bundleDir = path.join(BUILD, '_expo/static/js/web');
const bundleName = readdirSync(bundleDir).find((name) => name.endsWith('.js'));
if (!bundleName) throw new Error('no JS bundle in the export');
let bundle = readFileSync(path.join(bundleDir, bundleName), 'utf8');

// Longest paths first, so no replacement can clip a longer one that shares its
// prefix.
let replaced = 0;
for (const [key, uri] of [...dataUris].sort((a, b) => b[0].length - a[0].length)) {
  const before = bundle.length;
  bundle = bundle.split(key).join(uri);
  if (bundle.length !== before) replaced += 1;
}
console.log(`Inlined ${replaced}/${dataUris.size} assets into the bundle.`);

/**
 * Start the router at the app's own root, wherever the file happens to live.
 *
 * Expo Router reads `location.pathname` to decide the first screen. Served as
 * one document at some arbitrary URL — `/artifact/<id>`, or a path on somebody's
 * disk — that pathname matches no route, and the app opens on "This page has
 * moved on. It may have been taken off the menu."
 *
 * Rewriting the path before the bundle reads it is enough. From `file://` the
 * browser refuses, so there the entry route is handed over directly instead;
 * both land on the welcome screen.
 */
const START_AT_ROOT = `
(function () {
  try {
    if (location.pathname !== '/') {
      history.replaceState(null, '', '/' + location.search + location.hash);
      return;
    }
  } catch (error) {
    // file:// forbids rewriting the path, so the router will resolve the
    // document's own path, match nothing and render the catch-all. Its own
    // "Back to home" works — React Navigation falls back to in-memory
    // navigation once the History API refuses it — so press it rather than
    // leaving somebody who double-clicked the file staring at "This page has
    // moved on. It may have been taken off the menu."
  }
  var tries = 0;
  var timer = setInterval(function () {
    var screen = document.querySelector('[data-testid="not-found-screen"]');
    if (screen) {
      var action = screen.querySelector('[role="button"], button');
      if (action) { action.click(); clearInterval(timer); return; }
    }
    // Give up rather than poll forever: past this the app has started
    // somewhere real, or it never will and the catch-all is the honest screen.
    if (++tries > 60) clearInterval(timer);
  }, 100);
})();
`.trim();

const html = readFileSync(path.join(BUILD, 'index.html'), 'utf8');
const single = html
  // The bundle is inlined, so its <script src> has nothing left to fetch.
  .replace(/<script[^>]*src="[^"]*_expo\/static\/js\/web\/[^"]*"[^>]*><\/script>/g, '')
  .replace(/<link[^>]*rel="icon"[^>]*>/g, '')
  /**
   * A replacer *function*, never a replacement string.
   *
   * `String.replace` treats `$` specially in a replacement string: `$$` means
   * one literal `$`, `$&` means the matched text. Passing the bundle as a
   * string therefore rewrote Metro's own `$$require_external` to
   * `$require_external` and expanded every `$&` into `</body>`, adding 17 709
   * characters of nonsense and leaving a bundle that parses standalone and
   * throws "Invalid or unexpected token" the moment it is inlined. A function
   * hands the text back untouched.
   */
  .replace('</body>', () => `<script>\n${START_AT_ROOT}\n</script>\n<script>\n${bundle}\n</script>\n</body>`);

writeFileSync(out, single);

const bytes = statSync(out).size;
const mb = (bytes / 1e6).toFixed(1);
console.log(`Wrote ${path.relative(root, out)} — ${mb} MB, self-contained.`);

if (bytes > MAX_BYTES) {
  console.error(
    `\nThat is past the ${(MAX_BYTES / 1e6).toFixed(0)} MB a single-document host accepts, ` +
      `by ${((bytes - MAX_BYTES) / 1e6).toFixed(1)} MB.\n` +
      'Lower MAX_EDGE or QUALITY at the top of this script and run it again — ' +
      'the export in .preview-web is still good, so `npm run bundle:single` alone is enough.',
  );
  process.exit(2);
}
