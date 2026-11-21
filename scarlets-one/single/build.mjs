// Builds Scarlets_One.html: the whole supporter app in one self-contained file.
//
//   npm run single:build
//
// Steps:
//   1. Compress the 39 reference images for a phone screen.
//   2. Export the app's web bundle with images, the icon font and the router's
//      address handling compiled for a single file (single/metro-transformer.js).
//   3. Open that app in a phone-sized browser and capture the five tabs and the
//      image library as still HTML. That is what a viewer without JavaScript
//      shows: an iPhone's file preview, or Android's "HTML Viewer".
//   4. Write one HTML file holding the metadata, the still preview, the images
//      (once each), the icon font and the app.
//
// Flags: --skip-export reuses the last web bundle.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const sharp = require('sharp');
const { chromium, devices } = require('playwright');

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const mobile = join(root, 'apps', 'mobile');
const cache = join(here, '.cache');
const exportDir = join(mobile, 'dist-single');
const output = join(root, 'Scarlets_One.html');
const args = new Set(process.argv.slice(2));

const TITLE = 'Scarlets One (concept)';
const DESCRIPTION =
  'Scarlets One is a supporter app concept for Scarlets Rugby: fixtures, Match Centre, matchday planning, Passport and the Fan Zone in one place. Not an official Scarlets product. All data is demo data.';
const SHORT_DESCRIPTION =
  'A supporter app concept: fixtures, Match Centre, matchday, Passport and Fan Zone. Not an official Scarlets product.';
const WINE = '#3B101B';

const FRAMES = ['home', 'match', 'matchday', 'passport', 'fan-zone', 'library', 'about'];
const TABS = ['home', 'match', 'matchday', 'passport', 'fan-zone'];
/** Expo Router names the first tab `index`. */
const TAB_TEST_IDS = {
  'tab-index': 'home',
  'tab-match': 'match',
  'tab-matchday': 'matchday',
  'tab-passport': 'passport',
  'tab-fan-zone': 'fan-zone',
};

const log = (message) => console.log(`[single] ${message}`);
const kb = (bytes) => `${(bytes / 1024).toFixed(0)} KB`;
const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;
const dataUri = (type, buffer) => `data:${type};base64,${buffer.toString('base64')}`;
const escapeHtml = (text) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* ------------------------------------------------------------------ 1. media */

const MEDIA_LONG_SIDE = 1200;
const MEDIA_QUALITY = 76;
/** Identity references are embedded exactly as supplied: never re-encoded. */
const UNTOUCHED = new Set(['crest', 'shirt-reference']);
const MIME = { png: 'image/png', webp: 'image/webp', jpg: 'image/jpeg', jpeg: 'image/jpeg' };

async function prepareMedia() {
  const manifest = JSON.parse(readFileSync(join(root, 'assets', 'reference', 'manifest.json')));
  mkdirSync(join(cache, 'media'), { recursive: true });
  const media = [];
  for (const entry of manifest) {
    const source = readFileSync(join(root, 'assets', 'reference', entry.file));
    const key = entry.file.replace(/\.[a-z]+$/, '');
    if (UNTOUCHED.has(entry.id)) {
      media.push({ key, type: MIME[entry.file.split('.').pop()], buffer: source });
      continue;
    }
    const stamp = createHash('sha1')
      .update(source)
      .update(`${MEDIA_LONG_SIDE}:${MEDIA_QUALITY}`)
      .digest('hex')
      .slice(0, 16);
    const cached = join(cache, 'media', `${key}.${stamp}.webp`);
    if (!existsSync(cached)) {
      const buffer = await sharp(source)
        .resize({
          width: MEDIA_LONG_SIDE,
          height: MEDIA_LONG_SIDE,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: MEDIA_QUALITY, effort: 6 })
        .toBuffer();
      writeFileSync(cached, buffer);
    }
    media.push({ key, type: 'image/webp', buffer: readFileSync(cached) });
  }
  return media;
}

/* ----------------------------------------------------------------- 2. export */

function exportBundle() {
  if (args.has('--skip-export') && existsSync(exportDir)) {
    log('reusing the last web bundle (--skip-export)');
  } else {
    log('exporting the web bundle for a single file');
    execFileSync(
      'npx',
      ['expo', 'export', '--platform', 'web', '--output-dir', 'dist-single', '--clear'],
      { cwd: mobile, stdio: 'inherit', env: { ...process.env, SCARLETS_SINGLE_FILE: '1' } },
    );
  }
  const dir = join(exportDir, '_expo', 'static', 'js', 'web');
  const scripts = readdirSync(dir).filter((file) => file.endsWith('.js'));
  if (scripts.length !== 1) {
    throw new Error(`Expected one script in the export, found ${scripts.length}`);
  }
  const others = readdirSync(exportDir, { recursive: true }).filter((file) =>
    /\.(png|jpe?g|webp|ttf|css)$/.test(String(file)),
  );
  if (others.length > 0) {
    throw new Error(`The export still has separate files: ${others.join(', ')}`);
  }
  return readFileSync(join(dir, scripts[0]), 'utf8');
}

/** Every image and font the bundle asks the page for must be in the page. */
function assertEmbedded(bundle, media, fonts) {
  const wanted = (name) =>
    [
      ...bundle.matchAll(
        new RegExp(`${name}(?:\\[['"]([^'"]+)['"]\\]|\\.([A-Za-z_$][\\w$]*))`, 'g'),
      ),
    ].map((m) => m[1] ?? m[2]);
  const mediaKeys = new Set(media.map((item) => item.key));
  const missingMedia = wanted('__SO_MEDIA__').filter((key) => !mediaKeys.has(key));
  const missingFonts = wanted('__SO_FONTS__').filter((key) => !fonts[key]);
  if (missingMedia.length || missingFonts.length) {
    throw new Error(`Not embedded: ${[...missingMedia, ...missingFonts].join(', ')}`);
  }
  return {
    media: new Set(wanted('__SO_MEDIA__')).size,
    fonts: new Set(wanted('__SO_FONTS__')).size,
  };
}

/* --------------------------------------------------------------- 4. the page */

const inlineScript = (code) => code.replace(/<\/(script)/gi, '<\\/$1').replace(/<!--/g, '<\\!--');

async function icons() {
  const icon = readFileSync(join(mobile, 'assets', 'icon.png'));
  const png = (size) => sharp(icon).resize(size, size).png({ compressionLevel: 9 }).toBuffer();
  return {
    favicon: dataUri('image/png', await png(48)),
    touch: dataUri('image/png', await png(180)),
  };
}

function head({ icon, fontsCss, mediaCss, staticCss, built }) {
  const shell = readFileSync(join(here, 'shell.css'), 'utf8');
  const bootScript = readFileSync(join(here, 'boot.js'), 'utf8');
  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<!--
  SCARLETS ONE: a supporter app concept. Not an official Scarlets product.
  One self-contained file: metadata, 39 images, the icon font and the app.
  Nothing is loaded from the internet and nothing is sent anywhere.
  Every fixture, score, reward and venue detail is demo data.
  Built ${built}. Source: scarlets-one/ (npm run single:build).
-->
<meta name="viewport" content="width=390">
<meta name="color-scheme" content="light">
<script>${inlineScript(bootScript)}</script>
<title>${escapeHtml(TITLE)}</title>
<meta name="description" content="${escapeHtml(DESCRIPTION)}">
<meta name="robots" content="noindex, nofollow">
<meta name="application-name" content="Scarlets One">
<meta name="theme-color" content="${WINE}">
<meta name="format-detection" content="telephone=no">
<meta name="referrer" content="no-referrer">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Scarlets One">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Scarlets One">
<meta property="og:locale" content="en_GB">
<meta property="og:locale:alternate" content="cy_GB">
<meta property="og:title" content="${escapeHtml(TITLE)}">
<meta property="og:description" content="${escapeHtml(SHORT_DESCRIPTION)}">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${escapeHtml(TITLE)}">
<meta name="twitter:description" content="${escapeHtml(SHORT_DESCRIPTION)}">
<link rel="icon" type="image/png" href="${icon.favicon}">
<link rel="apple-touch-icon" href="${icon.touch}">
<style id="so-shell">${shell}</style>
<style id="so-static-css">${staticCss}</style>
<style id="so-fonts">${fontsCss}</style>
<style id="so-media">${mediaCss}</style>
</head>`;
}

function about(mediaCount) {
  return `<div class="so-frame so-about" data-frame="about">
<div class="so-about-body">
<i class="so-m so-m-01-crest so-about-crest" role="img" aria-label="Scarlets crest"></i>
<h1>Scarlets One</h1>
<p class="so-lead">A supporter app concept. Not an official Scarlets product.</p>
<h2>You are looking at the preview</h2>
<p>This viewer shows a still copy of the app. The five tabs at the bottom switch and every page scrolls. Buttons inside a page do nothing here.</p>
<h2>To use the working app</h2>
<p><strong>Android:</strong> open this same file with Chrome. When your phone asks how to open it, choose Chrome, not HTML Viewer.</p>
<p><strong>Computer:</strong> open the file in any browser.</p>
<p><strong>iPhone and iPad:</strong> the Files and WhatsApp previews can only show this still copy. The working app runs on an iPhone from a web link in Safari, not from a file.</p>
<h2>What is real and what is not</h2>
<p>Every fixture, score, reward and venue detail is demo data and is labelled DEMO. The ${mediaCount} images are concept material until the club confirms rights and approval. Nothing in this file is loaded from the internet, and nothing you do in it is sent anywhere.</p>
<div class="so-actions">
<label class="so-button" for="so-t-home">Back to the app preview</label>
<label class="so-button so-button-quiet" for="so-t-library">Image library (${mediaCount} images)</label>
</div>
</div>
</div>`;
}

function staticSection(frames, mediaCount) {
  const radios = FRAMES.map(
    (frame) =>
      `<input class="so-radio" type="radio" name="so-tab" id="so-t-${frame}" aria-label="Show ${frame}"${frame === 'home' ? ' checked' : ''}>`,
  ).join('');
  const body = frames
    .map((frame) => `<div class="so-frame" data-frame="${frame.name}">${frame.html}</div>`)
    .join('\n');
  return `<div id="so-static" aria-label="Still preview of the Scarlets One app concept">
${radios}
<div class="so-strip"><span>Scarlets One · concept preview</span><label for="so-t-about">About this file</label><label class="so-strip-back" for="so-t-home">Back to preview</label></div>
<div class="so-frames">
${body}
${about(mediaCount)}
</div>
</div>`;
}

function page({ headHtml, staticHtml, runtime, bundle }) {
  return `${headHtml}
<body>
<div id="so-splash" role="status" aria-label="Scarlets One is starting"><i class="so-m so-m-01-crest"></i><span>Scarlets One</span><small>Concept. Not an official Scarlets product.</small></div>
<div id="root"></div>
${staticHtml}
<script>${inlineScript(runtime)}</script>
<script>${inlineScript(bundle)}</script>
</body>
</html>
`;
}

/* -------------------------------------------------------------- 3. the stills */

/** Runs in the page. Returns the visible app as inert HTML. */
function snapshotInPage(tabTestIds) {
  const root = document.getElementById('root');
  const clone = root.cloneNode(true);
  const ids = window.__SO_MEDIA_IDS__ || {};
  const problems = [];
  const stack = [[root, clone]];
  while (stack.length) {
    const [live, copy] = stack.pop();
    const liveChildren = Array.from(live.children);
    const copyChildren = Array.from(copy.children);
    for (let i = liveChildren.length - 1; i >= 0; i -= 1) {
      const liveChild = liveChildren[i];
      let copyChild = copyChildren[i];
      const style = getComputedStyle(liveChild);
      if (style.display === 'none' || liveChild.tagName === 'SCRIPT') {
        copyChild.remove();
        continue;
      }
      const testId = liveChild.getAttribute('data-testid');
      copyChild.removeAttribute('data-testid');
      copyChild.removeAttribute('tabindex');
      copyChild.removeAttribute('id');

      if (liveChild.tagName === 'IMG') {
        const src = liveChild.getAttribute('src') || '';
        const key = ids[src];
        if (key) {
          const still = document.createElement('i');
          still.className = `so-m so-m-${key} ${liveChild.className}`.trim();
          still.setAttribute(
            'style',
            `${liveChild.getAttribute('style') || ''};display:block;background-size:${style.objectFit};background-position:${style.objectPosition}`,
          );
          const alt = liveChild.getAttribute('alt');
          if (alt) {
            still.setAttribute('role', 'img');
            still.setAttribute('aria-label', alt);
          } else {
            still.setAttribute('aria-hidden', 'true');
          }
          copyChild.replaceWith(still);
        } else if (!src.startsWith('data:')) {
          problems.push(`image without an embedded source: ${src.slice(0, 60)}`);
        }
        continue;
      }

      const frame = testId ? tabTestIds[testId] || (testId === 'nav-back' ? 'home' : null) : null;
      if (frame) {
        const label = document.createElement('label');
        label.setAttribute('for', `so-t-${frame}`);
        label.className = `${copyChild.className} so-tab`;
        const inline = copyChild.getAttribute('style');
        if (inline) label.setAttribute('style', inline);
        const name = liveChild.getAttribute('aria-label');
        if (name) label.setAttribute('aria-label', name);
        while (copyChild.firstChild) label.appendChild(copyChild.firstChild);
        copyChild.replaceWith(label);
        copyChild = label;
      }
      stack.push([liveChild, copyChild]);
    }
  }
  const html = clone.innerHTML.replace(
    /(^|[;"\s])backdrop-filter:\s*([^;"]+)/g,
    '$1-webkit-backdrop-filter: $2; backdrop-filter: $2',
  );
  return { html, problems };
}

/** Runs in the page. Returns the app's own style rules, in order. */
function stylesInPage() {
  const out = [];
  for (const sheet of Array.from(document.styleSheets)) {
    const owner = sheet.ownerNode;
    if (owner && owner.id && owner.id.startsWith('so-')) continue;
    let rules = [];
    try {
      rules = Array.from(sheet.cssRules);
    } catch {
      continue;
    }
    for (const rule of rules) {
      const text = rule.cssText;
      if (text.startsWith('@font-face')) continue;
      out.push(
        text.replace(
          /([{;\s])backdrop-filter:\s*([^;}]+)/g,
          '$1-webkit-backdrop-filter: $2; backdrop-filter: $2',
        ),
      );
    }
  }
  return out.join('\n');
}

async function captureStills(stagePath) {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent: devices['Pixel 7'].userAgent,
    locale: 'en-GB',
    colorScheme: 'light',
    reducedMotion: 'reduce',
  });
  await context.addInitScript(() => {
    try {
      if (!localStorage.getItem('scarlets:prefs')) {
        localStorage.setItem(
          'scarlets:prefs',
          JSON.stringify({
            state: {
              onboarded: true,
              locale: 'en',
              theme: 'light',
              following: ['first_team'],
              reduceMotion: true,
              deviceId: 'dev-still-preview',
            },
            version: 0,
          }),
        );
      }
    } catch {
      // Storage refused: the capture would show onboarding, and fails below.
    }
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(pathToFileURL(stagePath).href);

  const tap = (id) => page.locator(`[data-testid="${id}"]`).first().click();
  const settle = async () => {
    await page.waitForTimeout(700);
    await page.waitForFunction(() => Array.from(document.images).every((img) => img.complete));
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);
  };
  await page.waitForSelector('[data-testid="screen-home"]', { timeout: 30000 });

  // Passport is more useful to see as a member: sign in with the demo account.
  await tap('tab-passport');
  await tap('passport-sign-in');
  await tap('sign-in-member');
  await page.waitForSelector('[data-testid="passport-card"]');

  const frames = [];
  const problems = [];
  const take = async (name) => {
    await settle();
    const result = await page.evaluate(snapshotInPage, TAB_TEST_IDS);
    problems.push(...result.problems.map((problem) => `${name}: ${problem}`));
    frames.push({ name, html: result.html });
  };
  for (const tab of TABS) {
    await tap(tab === 'home' ? 'tab-index' : `tab-${tab}`);
    await take(tab);
  }
  await page.evaluate(() => {
    window.location.hash = '#/library';
  });
  await page.waitForSelector('[data-testid="screen-library"]');
  await take('library');

  const css = await page.evaluate(stylesInPage);
  await browser.close();
  if (errors.length) throw new Error(`The app raised errors during capture: ${errors.join(' | ')}`);
  if (problems.length) throw new Error(`Capture problems: ${problems.join(' | ')}`);
  return { frames, css };
}

/* ---------------------------------------------------------------------- run */

const media = await prepareMedia();
const mediaBytes = media.reduce((sum, item) => sum + item.buffer.length, 0);
log(`${media.length} images prepared, ${mb(mediaBytes)}`);

const fontFile = require.resolve(
  '@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf',
  { paths: [mobile] },
);
const fonts = { ionicons: readFileSync(fontFile) };
const fontsCss = Object.entries(fonts)
  .map(
    ([family, buffer]) =>
      `@font-face{font-family:"${family}";src:url("${dataUri('font/ttf', buffer)}") format("truetype");font-display:block}`,
  )
  .join('\n');
const mediaCss = media
  .map((item) => `.so-m-${item.key}{background-image:url("${dataUri(item.type, item.buffer)}")}`)
  .join('\n');

const bundle = exportBundle();
const used = assertEmbedded(bundle, media, fonts);
log(`bundle ${mb(Buffer.byteLength(bundle))}: uses ${used.media} images and ${used.fonts} font`);

const runtime = readFileSync(join(here, 'runtime.js'), 'utf8');
const icon = await icons();
const built = new Date().toISOString().slice(0, 10);

mkdirSync(cache, { recursive: true });
const stagePath = join(cache, 'stage.html');
writeFileSync(
  stagePath,
  page({
    headHtml: head({ icon, fontsCss, mediaCss, staticCss: '', built }),
    staticHtml: '',
    runtime,
    bundle,
  }),
);
log('capturing the still preview');
const stills = await captureStills(stagePath);
log(
  `captured ${stills.frames.length} screens: ${stills.frames
    .map((frame) => `${frame.name} ${kb(Buffer.byteLength(frame.html))}`)
    .join(', ')}; styles ${kb(Buffer.byteLength(stills.css))}`,
);

const html = page({
  headHtml: head({ icon, fontsCss, mediaCss, staticCss: stills.css, built }),
  staticHtml: staticSection(stills.frames, media.length),
  runtime,
  bundle,
});
writeFileSync(output, html);
log(`wrote ${output}: ${mb(Buffer.byteLength(html))}`);
