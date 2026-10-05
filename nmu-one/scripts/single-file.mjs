#!/usr/bin/env node
/**
 * Packs the web export (dist-web/) into one self-contained HTML file that
 * runs offline when opened straight from disk: dist-single/NMU-ONE-App.html.
 *
 *   npm run export:single
 *
 * Opened from a file there is no web server, so two things are done here:
 *
 *   1. Assets. Every "/assets/…" URL in the bundle becomes an entry in one
 *      table of data: URIs. The large photo size reuses the medium one to keep
 *      the file phone-sized.
 *   2. Routing. Expo Router keeps the route in the address bar, which a
 *      file:// page cannot change. The bundle runs with a stand-in `window`
 *      whose `location` and `history` are virtual. Each virtual entry is
 *      mirrored by a same-address entry in the real history, so the browser's
 *      back and forward buttons still work, and the route survives a reload.
 *
 * The result is checked by running the pitch journey against it:
 *   npm run e2e:single
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(import.meta.url), '../..');
const dist = join(root, 'dist-web');
const outDir = join(root, 'dist-single');
const out = join(outDir, 'NMU-ONE-App.html');

if (!existsSync(join(dist, 'index.html'))) {
  throw new Error('No web export in dist-web/. Run `npm run export:web` first.');
}

const indexHtml = readFileSync(join(dist, 'index.html'), 'utf8');
const bundlePath = indexHtml.match(/<script src="([^"]+\.js)"/)?.[1];
if (!bundlePath) throw new Error('Could not find the bundle in dist-web/index.html');
let bundle = readFileSync(join(dist, bundlePath), 'utf8');

// ── 1. Assets ────────────────────────────────────────────────────────────────

const MIME = {
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ttf': 'font/ttf',
  '.ico': 'image/x-icon',
};

/** photos/lg/x.HASH.webp → photos/md/x.OTHERHASH.webp, when it exists. */
function smaller(path) {
  const m = path.match(/^(.*\/photos\/)lg\/([^.]+)\.[0-9a-f]+(\.\w+)$/);
  if (!m) return path;
  const dir = join(dist, `${m[1]}md`);
  const file = readdirSync(dir).find((f) => f.startsWith(`${m[2]}.`) && f.endsWith(m[3]));
  return file ? `${m[1]}md/${file}` : path;
}

const table = [];
const indexOf = new Map();
function assetIndex(path) {
  const source = smaller(path);
  if (!indexOf.has(source)) {
    const bytes = readFileSync(join(dist, source));
    const mime = MIME[extname(source)];
    if (!mime) throw new Error(`No MIME type for ${source}`);
    indexOf.set(source, table.length);
    table.push(`data:${mime};base64,${bytes.toString('base64')}`);
  }
  return indexOf.get(source);
}

let replaced = 0;
bundle = bundle.replace(/"(\/assets\/[^"]+)"/g, (_, path) => {
  replaced += 1;
  return `__NMU_ASSETS[${assetIndex(path)}]`;
});
if (bundle.includes('"/assets/') || bundle.includes("'/assets/")) {
  throw new Error('An asset URL was left in the bundle');
}

// ── 2. Make the bundle safe to inline ────────────────────────────────────────
// Inside <script>, "</script", "<!--" and "<script" change how HTML parses the
// text. Each only occurs inside string or regex literals, where \x escapes mean
// the same characters.
bundle = bundle
  .replace(/<\/script/gi, '<\\/script')
  .replace(/<!--/g, '<\\x21--')
  .replace(/<script/gi, '<\\x73cript');

// ── 3. Virtual location and history ──────────────────────────────────────────

const shim = `(function () {
  'use strict';
  var real = window, realHistory = real.history, realLocation = real.location;
  var ORIGIN = 'http://localhost', KEY = 'nmu-one:file-history';
  var entries = [{ url: ORIGIN + '/', state: null }], idx = 0;
  try {
    var saved = JSON.parse(real.sessionStorage.getItem(KEY) || 'null');
    if (saved && saved.entries && saved.entries.length) { entries = saved.entries; idx = Math.min(saved.idx, entries.length - 1); }
  } catch (e) {}
  var cur = new URL(entries[idx].url);
  function save() { try { real.sessionStorage.setItem(KEY, JSON.stringify({ entries: entries, idx: idx })); } catch (e) {} }
  function resolveUrl(u) { return new URL(String(u), cur.href); }
  function internal(u) { try { return resolveUrl(u).origin === ORIGIN; } catch (e) { return false; } }
  function mark(i) { try { realHistory.replaceState({ nmu: i }, ''); } catch (e) {} }
  function pushReal(i) { try { realHistory.pushState({ nmu: i }, ''); } catch (e) {} }

  var hist = {
    get length() { return entries.length; },
    get state() { return entries[idx].state; },
    scrollRestoration: 'auto',
    pushState: function (state, title, url) {
      if (url != null) cur = resolveUrl(url);
      entries = entries.slice(0, idx + 1);
      entries.push({ url: cur.href, state: state === undefined ? null : state });
      idx = entries.length - 1;
      pushReal(idx); save();
    },
    replaceState: function (state, title, url) {
      if (url != null) cur = resolveUrl(url);
      entries[idx] = { url: cur.href, state: state === undefined ? null : state };
      mark(idx); save();
    },
    go: function (n) { n = n | 0; if (!n) { realLocation.reload(); return; } realHistory.go(n); },
    back: function () { realHistory.back(); },
    forward: function () { realHistory.forward(); },
  };

  // The browser's own back and forward land here first (registered before the
  // app), so the virtual location is current when the router reads it.
  real.addEventListener('popstate', function (e) {
    var i = e.state && typeof e.state.nmu === 'number' ? e.state.nmu : 0;
    if (i >= entries.length) i = entries.length - 1;
    idx = i; cur = new URL(entries[idx].url); save();
  });
  mark(idx);

  function navigate(u, replace) {
    if (!internal(u)) { real.open(String(u), '_blank', 'noopener'); return; }
    hist[replace ? 'replaceState' : 'pushState'](null, '', u);
    real.dispatchEvent(new PopStateEvent('popstate', { state: { nmu: idx } }));
  }

  var loc = {
    get href() { return cur.href; }, set href(v) { navigate(v, false); },
    get origin() { return ORIGIN; },
    get protocol() { return 'http:'; },
    get host() { return 'localhost'; },
    get hostname() { return 'localhost'; },
    get port() { return ''; },
    get pathname() { return cur.pathname; }, set pathname(v) { navigate(v, false); },
    get search() { return cur.search; }, set search(v) { var u = new URL(cur.href); u.search = v; navigate(u.href, false); },
    get hash() { return cur.hash; }, set hash(v) { var u = new URL(cur.href); u.hash = v; hist.replaceState(hist.state, '', u.href); },
    assign: function (u) { navigate(u, false); },
    replace: function (u) { navigate(u, true); },
    reload: function () { realLocation.reload(); },
    toString: function () { return cur.href; },
  };

  var bound = new Map();
  var win = new Proxy(real, {
    get: function (t, k) {
      if (k === 'location') return loc;
      if (k === 'history') return hist;
      if (k === 'window' || k === 'self' || k === 'top' || k === 'parent' || k === 'globalThis') return win;
      var v = Reflect.get(t, k);
      // Methods need the real window as \`this\`; constructors stay unbound.
      if (typeof v === 'function' && typeof k === 'string' && /^[a-z]/.test(k)) {
        var b = bound.get(v);
        if (!b) { b = v.bind(t); bound.set(v, b); }
        return b;
      }
      return v;
    },
    set: function (t, k, v) {
      if (k === 'location') { loc.href = v; return true; }
      t[k] = v;
      return true;
    },
  });

  real.__NMU_RUNTIME = { window: win, location: loc, history: hist };
})();`;

// ── 4. The page ──────────────────────────────────────────────────────────────

const favicon = `data:image/x-icon;base64,${readFileSync(join(dist, 'favicon.ico')).toString('base64')}`;
const resetCss = indexHtml.match(/<style id="expo-reset">([\s\S]*?)<\/style>/)?.[1] ?? '';
const built = new Date().toISOString().slice(0, 10);

const page = `<!DOCTYPE html>
<html lang="en-ZA">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>NMU ONE</title>
<meta name="description" content="NMU ONE: a concept campus app for Nelson Mandela University. Independent prototype, not an official NMU product. All data is synthetic. Runs offline from this one file.">
<meta name="application-name" content="NMU ONE">
<meta name="generator" content="Expo web export, packed by scripts/single-file.mjs">
<meta name="date" content="${built}">
<meta name="robots" content="noindex, nofollow">
<meta name="theme-color" content="#141C2B">
<link rel="icon" href="${favicon}">
<style>${resetCss}
  body { margin: 0; background: #141C2B; }
  .nmu-boot { margin: auto; max-width: 30em; padding: 32px 24px; color: #FFFFFF; text-align: center;
    font: 16px/1.5 system-ui, -apple-system, 'Segoe UI', sans-serif; }
  .nmu-boot b { display: block; font-size: 22px; letter-spacing: .06em; }
  .nmu-boot i { display: block; width: 32px; height: 3px; margin: 10px auto 16px; background: #FFCC00; }
  .nmu-boot small { display: block; margin-top: 16px; color: #C3CCDA; font-size: 13px; }
</style>
</head>
<body>
<noscript><div class="nmu-boot"><b>NMU ONE</b><i></i>This app needs JavaScript. Open the file in a web browser such as Chrome, Safari, Edge or Firefox.</div></noscript>
<div id="root"><div class="nmu-boot"><b>NMU ONE</b><i></i>Starting the app…<small>If this message stays, this viewer can't run apps (the iPhone Files preview, for example). Open the file in a web browser instead.</small></div></div>
<script>${shim}</script>
<script>window.__NMU_ASSETS = ${JSON.stringify(table)};</script>
<script>
(function (window, location, history, __NMU_ASSETS) {
${bundle}
}).call(globalThis, __NMU_RUNTIME.window, __NMU_RUNTIME.location, __NMU_RUNTIME.history, window.__NMU_ASSETS);
</script>
</body>
</html>
`;

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, page);
console.log(
  `${out}\n  ${(page.length / 1e6).toFixed(1)} MB · ${replaced} asset references → ${table.length} embedded files`,
);
