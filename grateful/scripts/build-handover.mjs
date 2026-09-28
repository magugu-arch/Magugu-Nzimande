#!/usr/bin/env node
/**
 * npm run build:handover
 * One file with everything in it: preview/Grateful-Handover.html. It holds
 *   - the interactive website preview (in a frame, built from
 *     preview/Grateful-Website-Preview.html),
 *   - the completion audit and the costing, as plain pages that read even
 *     where scripts can't run (the iPhone Files preview),
 *   - the fonts, so nothing is fetched from the internet.
 * Run `npm run build:single` and refresh the audit and costing first.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const dir = new URL('../preview/', import.meta.url);
const read = (f) => readFileSync(new URL(f, dir), 'utf8');
const font = (pkg, file) => readFileSync(new URL(`../node_modules/@fontsource-variable/${pkg}/files/${file}`, import.meta.url)).toString('base64');

const PREVIEW_URL = 'https://claude.ai/artifact/UxjQRoLaGToJwxH5sEnHKN';
const CHECKLIST_URL = 'https://claude.ai/artifact/8Min81Y6Tcq4Tg2XbQ3eN6';

/** Prefix every selector in a stylesheet with `scope`, so a page's styles only reach its own section. */
function scopeCss(css, scope) {
  css = css.replace(/\/\*[\s\S]*?\*\//g, '');
  let out = '';
  let i = 0;
  while (i < css.length) {
    const open = css.indexOf('{', i);
    if (open === -1) break;
    const head = css.slice(i, open).trim();
    // Find the matching close brace (blocks nest one level, in @media).
    let depth = 1;
    let j = open + 1;
    while (j < css.length && depth) {
      if (css[j] === '{') depth++;
      else if (css[j] === '}') depth--;
      j++;
    }
    const body = css.slice(open + 1, j - 1);
    if (head.startsWith('@media') || head.startsWith('@supports')) out += `${head}{${scopeCss(body, scope)}}`;
    else if (head.startsWith('@')) out += `${head}{${body}}`;
    else {
      const sel = head
        .split(',')
        .map((s) => s.trim())
        .map((s) => {
          if (s === 'body' || s === 'html' || s === ':root') return scope;
          if (s.startsWith(':root')) return `${s} ${scope}`;
          return `${scope} ${s}`;
        })
        .join(', ');
      out += `${sel}{${body}}`;
    }
    i = j;
  }
  return out;
}

/** The styles and the visible page (the .wrap block) of one of the report pages. */
function page(file, scope) {
  const html = read(file);
  const style = html.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? '';
  const start = html.indexOf('<div class="wrap">');
  const end = html.lastIndexOf('</div>');
  if (start === -1 || end === -1) throw new Error(`${file}: no .wrap block found`);
  return { css: scopeCss(style, scope), body: html.slice(start, end + 6) };
}

const audit = page('Grateful-Build-Audit.html', '#audit');
const costing = page('Grateful-Website-Costing.html', '#costing');
const site = read('Grateful-Website-Preview.html').replace(/&/g, '&amp;').replace(/"/g, '&quot;');

const html = `<!doctype html>
<html lang="en-ZA">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Grateful — Website Handover</title>
<style>
@font-face { font-family: 'Baskervville'; font-style: normal; font-weight: 400 700; font-display: swap; src: url(data:font/woff2;base64,${font('baskervville', 'baskervville-latin-wght-normal.woff2')}) format('woff2'); }
@font-face { font-family: 'Baskervville'; font-style: italic; font-weight: 400 700; font-display: swap; src: url(data:font/woff2;base64,${font('baskervville', 'baskervville-latin-wght-italic.woff2')}) format('woff2'); }
@font-face { font-family: 'Inter'; font-style: normal; font-weight: 100 900; font-display: swap; src: url(data:font/woff2;base64,${font('inter', 'inter-latin-wght-normal.woff2')}) format('woff2'); }
:root { --hub-ink: #0b0b0b; --hub-paper: #ffffff; --hub-rule: #dcdcdc; --hub-muted: #5a5a5a; --hub-soft: #f5f5f4; color-scheme: light; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --hub-ink: #f4f4f4; --hub-paper: #0a0a0a; --hub-rule: #2c2c2c; --hub-muted: #a8a8a8; --hub-soft: #151515; color-scheme: dark; } }
:root[data-theme="dark"] { --hub-ink: #f4f4f4; --hub-paper: #0a0a0a; --hub-rule: #2c2c2c; --hub-muted: #a8a8a8; --hub-soft: #151515; color-scheme: dark; }
html { scroll-behavior: smooth; -webkit-text-size-adjust: 100%; }
@media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } }
body { margin: 0; background: var(--hub-paper); color: var(--hub-ink); font: 16px/1.6 'Baskervville', Baskerville, Georgia, serif; }
.hub-top { position: sticky; top: 0; z-index: 10; background: var(--hub-paper); border-bottom: 1px solid var(--hub-ink); padding: calc(10px + env(safe-area-inset-top, 0px)) 16px 10px; }
.hub-top .in { max-width: 1040px; margin: 0 auto; display: flex; flex-wrap: wrap; gap: 8px 20px; align-items: baseline; justify-content: space-between; }
.hub-brand { font: 600 12px/1.4 'Inter', 'Helvetica Neue', Arial, sans-serif; letter-spacing: .16em; text-transform: uppercase; }
.hub-nav { display: flex; flex-wrap: wrap; gap: 4px 18px; }
.hub-nav a { font: 600 11px/1 'Inter', 'Helvetica Neue', Arial, sans-serif; letter-spacing: .14em; text-transform: uppercase; color: inherit; text-decoration: none; padding: 10px 0; }
.hub-nav a:hover, .hub-nav a:focus-visible { text-decoration: underline; text-underline-offset: 4px; }
.hub-sec { scroll-margin-top: 64px; border-bottom: 1px solid var(--hub-rule); }
.hub-intro { max-width: 1040px; margin: 0 auto; padding: 32px 16px 20px; }
.hub-intro h1 { margin: 0; font-weight: 400; font-size: clamp(2rem, 5vw, 3.2rem); line-height: 1.05; letter-spacing: -.02em; }
.hub-intro h1 em { font-style: italic; }
.hub-intro p { margin: 12px 0 0; max-width: 42em; color: var(--hub-muted); }
.hub-note { margin-top: 16px; background: var(--hub-soft); padding: 12px 14px; border-radius: 4px; font: 14px/1.55 'Inter', 'Helvetica Neue', Arial, sans-serif; color: var(--hub-muted); }
.hub-note b { color: var(--hub-ink); }
.hub-note a, .hub-intro a { color: inherit; word-break: break-all; }
.hub-frame { max-width: 1280px; margin: 0 auto; padding: 0 16px 32px; }
.hub-frame iframe { display: block; width: 100%; height: min(86vh, 980px); min-height: 560px; border: 1px solid var(--hub-rule); border-radius: 4px; background: #000; }
${audit.css}
${costing.css}
</style>
</head>
<body>
<header class="hub-top"><div class="in">
  <span class="hub-brand">Grateful · Website handover</span>
  <nav class="hub-nav" aria-label="Sections">
    <a href="#website">Website</a><a href="#audit">Audit</a><a href="#costing">Costing</a><a href="#checklist">Checklist</a>
  </nav>
</div></header>

<main>
<section id="website" class="hub-sec" aria-labelledby="website-h">
  <div class="hub-intro">
    <h1 id="website-h">The Grateful website, <em>audit and costing, in one file.</em></h1>
    <p>Everything is inside this file: no internet needed. Try the website below. Bookings, payments and messages are simulated, and nothing is saved or sent. Use the Preview box in its corner to open the studio dashboard.</p>
    <p class="hub-note"><b>On an iPhone or iPad:</b> the Files app shows a preview that can’t run the interactive website, so the frame below may stay blank there. Open the online version in Safari instead: <a href="${PREVIEW_URL}">${PREVIEW_URL}</a>. The audit and costing further down read normally.</p>
  </div>
  <div class="hub-frame">
    <iframe title="Grateful website preview" loading="eager" srcdoc="${site}"></iframe>
  </div>
</section>

<section id="audit" class="hub-sec" aria-label="Completion audit">
${audit.body}
</section>

<section id="costing" class="hub-sec" aria-label="Costing">
${costing.body}
</section>

<section id="checklist" class="hub-sec" aria-labelledby="checklist-h" style="border-bottom:0">
  <div class="hub-intro" style="padding-bottom:48px">
    <h1 id="checklist-h" style="font-size:clamp(1.6rem,4vw,2.2rem)">Launch checklist</h1>
    <p>What the site still needs from the studio (portfolio names, photo permission, social links, hours and prices, privacy details, wording sign-off, accounts) is filled in online, where answers are saved as you go: <a href="${CHECKLIST_URL}">${CHECKLIST_URL}</a>.</p>
  </div>
</section>
</main>
</body>
</html>
`;

writeFileSync(new URL('Grateful-Handover.html', dir), html);
console.log(`Wrote preview/Grateful-Handover.html (${(html.length / 1024 / 1024).toFixed(2)} MB)`);
