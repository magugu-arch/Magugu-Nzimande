#!/usr/bin/env node
/**
 * Builds the app three ways from one bundle:
 *
 *   release/tashas-app.html   one self-contained HTML document: app code,
 *                             styles, display font and all 28 images inline.
 *                             Opens offline from a file. This is the download.
 *   build/artifact.html       the same parts without the document wrapper, for
 *                             hosts that supply their own (the Claude viewer).
 *   build/pwa/                index.html + manifest + service worker + icons,
 *                             for deployment on a stable HTTPS domain.
 *
 * Run: npm run build   (derives images first if they are missing)
 */
import { build, transform } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync, copyFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rel = (...p) => path.join(root, ...p);
const pkg = JSON.parse(readFileSync(rel('package.json'), 'utf8'));

const TITLE = 'Tashas App Prototype';
const DESCRIPTION =
  'Prototype of the Tashas guest app: find a café, book a table with deposits, rewards, notifications and staff operations, running on sandbox providers.';

if (!existsSync(rel('build/derived/index.json'))) {
  execFileSync('node', [rel('scripts/derive-images.mjs')], { stdio: 'inherit' });
}

// ---- app code
const bundle = await build({
  entryPoints: [rel('src/web/main.tsx')],
  bundle: true,
  minify: true,
  format: 'iife',
  target: ['es2020', 'safari15', 'chrome100', 'firefox100'],
  jsx: 'automatic',
  jsxImportSource: 'preact',
  write: false,
  legalComments: 'none',
  charset: 'utf8',
  logLevel: 'warning',
  tsconfig: rel('tsconfig.json'),
});
const js = bundle.outputFiles[0].text.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');

// ---- styles, with the display font inlined
const font = (f) => `data:font/woff2;base64,${readFileSync(rel('assets/fonts', f)).toString('base64')}`;
const rawCss = readFileSync(rel('src/web/styles.css'), 'utf8')
  .replace('__FONT_REGULAR__', font('Newsreader-subset.woff2'))
  .replace('__FONT_ITALIC__', font('Newsreader-Italic-subset.woff2'));
const css = (await transform(rawCss, { loader: 'css', minify: true, target: ['safari15', 'chrome100'] })).code.replace(/<\/style/gi, '<\\/style');

// ---- images
const index = JSON.parse(readFileSync(rel('build/derived/index.json'), 'utf8'));
const images = {};
for (const [id, v] of Object.entries(index)) {
  images[id] = { src: `data:image/webp;base64,${readFileSync(rel('build/derived', v.file)).toString('base64')}`, w: v.w, h: v.h };
}
const imagesJson = JSON.stringify(images).replace(/</g, '\\u003c');

const built = new Date().toISOString();
const parts = {
  meta: `<meta id="tashas-meta" name="description" content="${DESCRIPTION}" data-version="${pkg.version}" data-built="${built}">`,
  css: `<style id="tashas-css">${css}</style>`,
  app: '<div id="app"><div style="display:grid;place-items:center;height:100%;font:300 2.4rem Georgia,serif;color:#5d564b">tashas</div></div>',
  images: `<script type="application/json" id="tashas-images">${imagesJson}</script>`,
  code: `<script id="tashas-app">${js}</script>`,
};

const head = (extra = '') =>
  [
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">',
    `<title>${TITLE}</title>`,
    '<meta name="theme-color" content="#f5f0e7" media="(prefers-color-scheme: light)">',
    '<meta name="theme-color" content="#15130f" media="(prefers-color-scheme: dark)">',
    '<meta name="robots" content="noindex">',
    parts.meta,
    extra,
    parts.css,
  ].join('\n');

const document = (extraHead = '') =>
  `<!doctype html>\n<html lang="en">\n<head>\n${head(extraHead)}\n</head>\n<body>\n${parts.app}\n${parts.images}\n${parts.code}\n</body>\n</html>\n`;

mkdirSync(rel('release'), { recursive: true });
mkdirSync(rel('build/pwa'), { recursive: true });

// 1. The standalone download.
writeFileSync(rel('release/tashas-app.html'), document());

// 2. The fragment for hosts that wrap pages in their own document.
writeFileSync(
  rel('build/artifact.html'),
  [`<title>${TITLE}</title>`, '<meta name="claude:viewport-fit-sides" content="cover">', parts.meta, parts.css, parts.app, parts.images, parts.code].join('\n') + '\n',
);

// 3. The installable PWA.
const icons = rel('build/pwa/icons');
mkdirSync(icons, { recursive: true });
execFileSync('python3', ['-c', ICONS_PY(), rel('assets/fonts/Newsreader-subset.woff2'), icons], { stdio: 'inherit' });
writeFileSync(
  rel('build/pwa/index.html'),
  document(
    [
      '<link rel="manifest" href="manifest.webmanifest">',
      '<link rel="icon" href="icons/icon-192.png" sizes="192x192">',
      '<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">',
      '<meta name="apple-mobile-web-app-capable" content="yes">',
      '<meta name="apple-mobile-web-app-status-bar-style" content="default">',
    ].join('\n'),
  ),
);
writeFileSync(
  rel('build/pwa/manifest.webmanifest'),
  JSON.stringify(
    {
      name: 'Tashas',
      short_name: 'Tashas',
      description: DESCRIPTION,
      start_url: './',
      scope: './',
      display: 'standalone',
      background_color: '#f5f0e7',
      theme_color: '#f5f0e7',
      icons: [
        { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    null,
    2,
  ),
);
writeFileSync(
  rel('build/pwa/sw.js'),
  `// Offline shell for the installed app. Live booking, payments and messages still need the network.
const CACHE = 'tashas-${pkg.version}-${built.slice(0, 19).replace(/\D/g, '')}';
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'];
self.addEventListener('install', (e) => e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener('activate', (e) => e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(fetch(e.request).then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request).then((r) => r || caches.match('index.html'))));
});
`,
);
writeFileSync(rel('build/pwa/robots.txt'), 'User-agent: *\nDisallow: /\n# Prototype: do not index until Tashas approves content and a canonical domain.\n');
copyFileSync(rel('assets/fonts/OFL.txt'), rel('build/pwa/FONT-LICENSE.txt'));

const size = (f) => `${(statSync(f).size / 1048576).toFixed(2)} MB`;
console.log(`release/tashas-app.html  ${size(rel('release/tashas-app.html'))}`);
console.log(`build/artifact.html      ${size(rel('build/artifact.html'))}`);
console.log(`build/pwa/index.html     ${size(rel('build/pwa/index.html'))}`);
console.log(`app code ${(js.length / 1024).toFixed(0)} KB · styles ${(css.length / 1024).toFixed(0)} KB · images ${(imagesJson.length / 1048576).toFixed(2)} MB`);

function ICONS_PY() {
  return String.raw`
import sys, os
from PIL import Image, ImageDraw, ImageFont
font_path, out = sys.argv[1], sys.argv[2]
SAGE, CREAM = (85, 101, 74), (251, 248, 242)
def load(size):
    try:
        return ImageFont.truetype(font_path, size)
    except Exception:
        for f in ['/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf']:
            if os.path.exists(f):
                return ImageFont.truetype(f, size)
        return ImageFont.load_default()
def icon(size, pad, name, rounded):
    im = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    if rounded:
        d.rounded_rectangle([0, 0, size - 1, size - 1], radius=int(size * 0.22), fill=SAGE)
    else:
        d.rectangle([0, 0, size, size], fill=SAGE)
    f = load(int(size * (0.62 - pad)))
    text = 't'
    box = d.textbbox((0, 0), text, font=f)
    w, h = box[2] - box[0], box[3] - box[1]
    d.text(((size - w) / 2 - box[0], (size - h) / 2 - box[1] - size * 0.02), text, font=f, fill=CREAM)
    im.save(os.path.join(out, name))
icon(192, 0, 'icon-192.png', True)
icon(512, 0, 'icon-512.png', True)
icon(512, 0.14, 'icon-maskable-512.png', False)
icon(180, 0, 'apple-touch-icon.png', False)
`;
}
