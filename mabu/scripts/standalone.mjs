/**
 * Builds the whole app as ONE self-contained HTML file: the JavaScript bundle
 * inlined, every photograph and font embedded as a data URI, nothing fetched.
 *
 *   dist-standalone/mabu.html            open by double-clicking (Mac, Windows,
 *                                        Android file viewers, any browser)
 *   dist-standalone/mabu-artifact.html   the same, as a page body for hosting
 *                                        inside another page's skeleton
 *
 * Browsers refuse URL path changes on a local file, so the build swaps the
 * bundle's reads of window.location / window.history for an in-memory copy.
 * The app routes exactly as it does on the web, without touching the address
 * bar. `#menu`, `#book`, `#events` … deep-link to a screen.
 *
 * Runs in demo mode (the in-app mock back end), with data kept in the
 * browser. Run after `npm run export:web`:  npm run standalone
 */
import fs from 'node:fs';
import path from 'node:path';
import { Buffer } from 'node:buffer';
import sharp from 'sharp';
import { root } from './lib/web.mjs';

const dist = path.join(root, 'dist-web');
const out = path.join(root, 'dist-standalone');
fs.mkdirSync(out, { recursive: true });

const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
const src = /<script src="([^"]+)"/.exec(html)?.[1];
if (!src) throw new Error('No bundle in dist-web/index.html — run npm run export:web first');
let js = fs.readFileSync(path.join(dist, src), 'utf8');

/* ── Embed assets ─────────────────────────────────────────────────────── */

const MIME = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
};
// Phones never need more than this for a full-width photograph in one file.
const MAX_EDGE = 1080;
let embedded = 0;
let bytes = 0;
const cache = new Map();
for (const m of js.matchAll(/"(\/assets\/[^"]+)"/g)) {
  const url = m[1];
  if (cache.has(url)) continue;
  const file = path.join(dist, decodeURIComponent(url.split('?')[0]));
  if (!fs.existsSync(file)) continue;
  const ext = path.extname(file).toLowerCase();
  let data = fs.readFileSync(file);
  if (ext === '.jpg' || ext === '.jpeg') {
    data = await sharp(data)
      .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 74, mozjpeg: true, progressive: true })
      .toBuffer();
  }
  cache.set(
    url,
    `data:${MIME[ext] ?? 'application/octet-stream'};base64,${data.toString('base64')}`,
  );
  embedded += 1;
  bytes += data.length;
}
js = js.replace(/"(\/assets\/[^"]+)"/g, (whole, url) =>
  cache.has(url) ? `"${cache.get(url)}"` : whole,
);

/* ── Route in memory ──────────────────────────────────────────────────── */

const before = js.length;
js = js
  .replace(/window\.location=(?!=)/g, 'window.__mabuLoc.href=')
  .replace(/window\.location\b/g, 'window.__mabuLoc')
  .replace(/window\.history\b/g, 'window.__mabuHist')
  .replace(
    /(?<![\w$.])location\.(pathname|search|hash|href|origin|protocol)\b/g,
    'window.__mabuLoc.$1',
  );
if (js.length === before)
  throw new Error('Routing shim found nothing to replace — bundle changed?');

const shim = `(function(){
var ORIGIN='https://mabu.app', real=window.location;
var start='/';
try{var h=decodeURIComponent((real.hash||'').replace(/^#\\/?/,''));if(/^[\\w.~-]+(\\/[\\w.~-]+)*$/.test(h))start='/'+h;}catch(e){}
var stack=[{state:null,url:start}],idx=0;
function cur(){return new URL(stack[idx].url,ORIGIN);}
function rel(u){var x=new URL(String(u),cur());return x.pathname+x.search+x.hash;}
function pop(){setTimeout(function(){window.dispatchEvent(new PopStateEvent('popstate',{state:stack[idx].state}));},0);}
// The browser's own popstate (a changed #hash) is not the app's history.
window.addEventListener('popstate',function(e){if(e.isTrusted)e.stopImmediatePropagation();},true);
function nav(v,replace){var u=new URL(String(v),cur());
 if(u.origin!==ORIGIN){if(/^https?:$/.test(u.protocol)){window.open(u.href,'_blank','noopener');}else{try{real.href=u.href;}catch(e){}}return;}
 var p=u.pathname+u.search+u.hash;
 if(replace){stack[idx]={state:null,url:p};}else{stack=stack.slice(0,idx+1);stack.push({state:null,url:p});idx++;}
 pop();}
window.__mabuLoc={
 get href(){return cur().href},set href(v){nav(v)},
 get pathname(){return cur().pathname},get search(){return cur().search},get hash(){return cur().hash},
 get origin(){return ORIGIN},get protocol(){return 'https:'},get host(){return 'mabu.app'},get hostname(){return 'mabu.app'},get port(){return ''},
 assign:function(v){nav(v)},replace:function(v){nav(v,true)},reload:function(){real.reload()},toString:function(){return cur().href}};
window.__mabuHist={
 get state(){return stack[idx].state},get length(){return stack.length},scrollRestoration:'auto',
 pushState:function(s,t,u){var url=u==null?stack[idx].url:rel(u);stack=stack.slice(0,idx+1);stack.push({state:s,url:url});idx++;},
 replaceState:function(s,t,u){stack[idx]={state:s,url:u==null?stack[idx].url:rel(u)};},
 go:function(n){idx=Math.max(0,Math.min(stack.length-1,idx+(n||0)));pop();},
 back:function(){this.go(-1)},forward:function(){this.go(1)}};
})();`;

/* ── Write ────────────────────────────────────────────────────────────── */

const safe = (code) => code.replace(/<\/script/gi, '<\\/script');
const style = `html,body{height:100%;margin:0;background:#0B0B0B}body{overflow:hidden}#root{display:flex;height:100%;flex:1}`;
const title = 'Mábu';
const favicon = fs.existsSync(path.join(root, 'assets/favicon.png'))
  ? `data:image/png;base64,${fs.readFileSync(path.join(root, 'assets/favicon.png')).toString('base64')}`
  : '';

const body = `<div id="root"></div>
<noscript>Mábu needs JavaScript to run.</noscript>
<script>${safe(shim)}</script>
<script>${safe(js)}</script>`;

const full = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<meta name="theme-color" content="#0B0B0B" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="color-scheme" content="dark" />
<title>${title}</title>
${favicon ? `<link rel="icon" href="${favicon}" />` : ''}
<style>${style}</style>
</head>
<body>
${body}
</body>
</html>
`;
// The artifact host supplies doctype, head and body; the page brings the rest.
const fragment = `<title>Mábu App</title>
<style>:root{color-scheme:dark}${style.replace('html,body{height:100%;margin:0;', 'html,body{height:100%;')}</style>
${body}
`;

fs.writeFileSync(path.join(out, 'mabu.html'), full);
fs.writeFileSync(path.join(out, 'mabu-artifact.html'), fragment);
const mb = (n) => `${(n / 1024 / 1024).toFixed(1)} MB`;
console.log(`embedded ${embedded} assets (${mb(bytes)})`);
console.log(`dist-standalone/mabu.html ${mb(Buffer.byteLength(full))}`);
