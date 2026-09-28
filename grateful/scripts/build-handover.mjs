#!/usr/bin/env node
/**
 * npm run build:handover
 * One file with everything in it: preview/Grateful-Handover.html. It holds
 *   - the interactive website preview (in a frame, built from
 *     preview/Grateful-Website-Preview.html),
 *   - the completion audit, the costing and the go-live guide, as plain pages that read even
 *     where scripts can't run (the iPhone Files preview),
 *   - the fonts, so nothing is fetched from the internet.
 *   - screenshots of the website and the photographs, as plain images, so
 *     the iPhone Files preview shows what the site looks like,
 *   - page details: title, description, icon, theme colour, share tags.
 * Run `npm run build:single` and refresh the audit, costing and guide first.
 * Screenshots need Chromium (set PW_CHROMIUM to use a local browser).
 */
import { writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

import { CHECKLIST_URL, DESCRIPTION, dir, esc, fontFaces, icon, page, photoCaption, photos, PREVIEW_URL, read, touchIcon } from './lib/handover-shared.mjs';

// Screenshots of the offline preview, taken fresh so they always match the current site.
async function screenshots() {
  const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
  const file = new URL('Grateful-Website-Preview.html', dir).href;
  const shots = [];
  for (const [label, width, height, scale, route, clickText] of [
    ['Home page · computer', 1440, 900, 1, null, null],
    ['Home page · phone', 390, 844, 2, null, null],
    ['Work page · computer', 1440, 900, 1, 'Work', null],
    ['Booking · phone', 390, 844, 2, null, 'Book a Consultation'],
  ]) {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: scale, reducedMotion: 'reduce' });
    await page.goto(file);
    await page.addStyleTag({ content: '[aria-label="Preview notice"]{display:none!important}' });
    await page.waitForTimeout(1500);
    if (route) await page.getByRole('navigation', { name: /main/i }).getByRole('link', { name: route }).click();
    if (clickText) await page.getByRole('link', { name: clickText }).first().click();
    if (route || clickText) await page.waitForTimeout(1500);
    const jpg = await page.screenshot({ type: 'jpeg', quality: 70 });
    shots.push({ label, phone: width < 600, src: `data:image/jpeg;base64,${jpg.toString('base64')}` });
    await page.close();
  }
  await browser.close();
  return shots;
}
const shots = await screenshots();
const audit = page('Grateful-Build-Audit.html', '#audit');
const costing = page('Grateful-Website-Costing.html', '#costing');
const golive = page('Grateful-Go-Live-Guide.html', '#golive');
const site = read('Grateful-Website-Preview.html').replace(/&/g, '&amp;').replace(/"/g, '&quot;');

const html = `<!doctype html>
<html lang="en-ZA">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Grateful — Website Handover</title>
<meta name="description" content="${esc(DESCRIPTION)}">
<meta name="author" content="Grateful (Pty) Ltd">
<meta name="application-name" content="Grateful Website Handover">
<meta name="theme-color" content="#000000">
<meta name="color-scheme" content="light dark">
<meta name="robots" content="noindex">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Grateful">
<meta property="og:title" content="Grateful — Website Handover">
<meta property="og:description" content="${esc(DESCRIPTION)}">
<meta property="og:url" content="${PREVIEW_URL}">
<meta name="twitter:card" content="summary">
<link rel="icon" type="image/svg+xml" href="${icon}">
<link rel="apple-touch-icon" href="${touchIcon}">
<style>
${fontFaces}
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
.hub-glance { max-width: 1280px; margin: 0 auto; padding: 0 16px 32px; display: grid; grid-template-columns: minmax(0, 3fr) minmax(0, 1fr); gap: 16px; align-items: start; }
.hub-glance figure, .hub-photos figure { margin: 0; display: grid; gap: 8px; }
.hub-glance img, .hub-photos img { display: block; width: 100%; height: auto; border: 1px solid var(--hub-rule); border-radius: 4px; background: #000; }
figcaption { font: 12.5px/1.45 'Inter', 'Helvetica Neue', Arial, sans-serif; color: var(--hub-muted); }
.hub-photos { max-width: 1280px; margin: 0 auto; padding: 0 16px 40px; display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 16px; }
.hub-photos img { aspect-ratio: 4 / 5; object-fit: cover; object-position: 50% 25%; }
@media (max-width: 760px) { .hub-glance { grid-template-columns: repeat(2, minmax(0, 1fr)); } .hub-glance .wide { grid-column: 1 / -1; } .hub-photos { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
.hub-frame { max-width: 1280px; margin: 0 auto; padding: 0 16px 32px; }
.hub-frame iframe { display: block; width: 100%; height: min(86vh, 980px); min-height: 560px; border: 1px solid var(--hub-rule); border-radius: 4px; background: #000; }
${audit.css}
${costing.css}
${golive.css}
</style>
</head>
<body>
<header class="hub-top"><div class="in">
  <span class="hub-brand">Grateful · Website handover</span>
  <nav class="hub-nav" aria-label="Sections">
    <a href="#website">Website</a><a href="#photos">Photos</a><a href="#audit">Audit</a><a href="#costing">Costing</a><a href="#golive">Go live</a><a href="#checklist">Checklist</a>
  </nav>
</div></header>

<main>
<section id="website" class="hub-sec" aria-labelledby="website-h">
  <div class="hub-intro">
    <h1 id="website-h">The Grateful website, <em>audit and costing, in one file.</em></h1>
    <p>Everything is inside this file: no internet needed. Try the website below. Bookings, payments and messages are simulated, and nothing is saved or sent. Use the Preview box in its corner to open the studio dashboard.</p>
    <p class="hub-note"><b>On an iPhone or iPad:</b> the Files app shows a preview that can’t run the interactive website, so the frame below may stay blank there. Open the online version in Safari instead: <a href="${PREVIEW_URL}">${PREVIEW_URL}</a>. The audit and costing further down read normally.</p>
  </div>
  <div class="hub-glance" aria-label="Screenshots">
    ${shots
      .map((s) => `<figure class="${s.phone ? '' : 'wide'}"><img src="${s.src}" alt="Screenshot of the Grateful website: ${esc(s.label)}"><figcaption>${esc(s.label)}</figcaption></figure>`)
      .join('\n    ')}
  </div>
  <div class="hub-intro" style="padding-top:0"><p><b style="color:var(--hub-ink)">Try it:</b> the working website is below. Click around, book a test appointment, or open the studio dashboard from the Preview box.</p></div>
  <div class="hub-frame">
    <iframe title="Grateful website preview" loading="eager" srcdoc="${site}"></iframe>
  </div>
</section>

<section id="photos" class="hub-sec" aria-labelledby="photos-h">
  <div class="hub-intro"><h1 id="photos-h" style="font-size:clamp(1.6rem,4vw,2.2rem)">The photographs</h1><p>The five photographs the website uses, in full colour, with where each appears.</p></div>
  <div class="hub-photos">
    ${photos.map((p) => `<figure><img src="${p.src}" alt="${esc(p.alt)}"><figcaption>${esc(photoCaption[p.key] ?? p.key)}</figcaption></figure>`).join('\n    ')}
  </div>
</section>

<section id="audit" class="hub-sec" aria-label="Completion audit">
${audit.body}
</section>

<section id="costing" class="hub-sec" aria-label="Costing">
${costing.body}
</section>

<section id="golive" class="hub-sec" aria-label="Go-live guide">
${golive.body}
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
