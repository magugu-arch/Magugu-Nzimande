#!/usr/bin/env node
/**
 * npm run build:whatsapp
 * preview/Grateful-iPhone-WhatsApp.html: the whole handover as pictures and
 * plain text, with NO scripts at all. iPhone WhatsApp (and the Files app)
 * open HTML in a quick preview that never runs code, so this edition shows
 * every page of the website as a full-length phone screenshot, plus the
 * studio dashboard, the photographs, the audit and the costing.
 * Images are JPEG (the most widely supported format), all embedded.
 * Run `npm run build:single` and refresh the audit and costing first.
 * Screenshots need Chromium (set PW_CHROMIUM to use a local browser).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { CHECKLIST_URL, dir, esc, fontFaces, page as reportPage, photoCaption, photos, PREVIEW_URL, touchIcon } from './lib/handover-shared.mjs';

const HIDE_FLOATING = `[aria-label="Preview notice"], nav[aria-label="Page navigation"], nav[aria-label="Quick booking"] { display: none !important; }`;
const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const file = new URL('Grateful-Website-Preview.html', dir).href;
const jpeg = (buf) => `data:image/jpeg;base64,${buf.toString('base64')}`;

async function open(width, height, scale) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: scale, reducedMotion: 'reduce' });
  await page.goto(file);
  await page.waitForTimeout(1200);
  return page;
}

// Every public page, full length, as a phone shows it.
const pages = [
  { name: 'Home', note: 'The first thing a visitor sees: the burgundy gown, the studio’s promise, selected work, the philosophy, services and the process.', go: null },
  { name: 'Work', note: 'The portfolio. Each garment opens its own page.', go: ['footer', 'Work'] },
  { name: 'Garment Study 01', note: 'One garment’s page: the photograph, its description and details.', go: ['card', 'Garment Study 01'] },
  { name: 'About', note: 'The studio’s story, philosophy and way of working.', go: ['footer', 'About'] },
  { name: 'Services', note: 'The four services, each with its length and price (or “quote required”) and a Book button.', go: ['footer', 'Services'] },
  { name: 'Book', note: 'Online booking in four steps: service, date and time, details, review. The studio number shows here for questions.', go: ['footer', 'Book'] },
  { name: 'Contact', note: 'Email, location, hours and an enquiry form.', go: ['footer', 'Contact'] },
];
const shots = [];
for (const p of pages) {
  const page = await open(390, 844, 1.5);
  if (p.go?.[0] === 'footer') await page.locator('footer').getByRole('link', { name: p.go[1], exact: true }).first().click();
  if (p.go?.[0] === 'card') {
    await page.locator('footer').getByRole('link', { name: 'Work', exact: true }).first().click();
    await page.waitForTimeout(800);
    await page.getByRole('link', { name: new RegExp(p.go[1]) }).first().click();
  }
  await page.waitForTimeout(1200);
  await page.addStyleTag({ content: HIDE_FLOATING });
  shots.push({ ...p, src: jpeg(await page.screenshot({ type: 'jpeg', quality: 62, fullPage: true })) });
  await page.close();
}

// The homepage on a computer screen, and the studio dashboard.
const desk = await open(1440, 900, 1);
await desk.addStyleTag({ content: HIDE_FLOATING });
const desktopHome = jpeg(await desk.screenshot({ type: 'jpeg', quality: 70 }));
await desk.close();
const dash = await open(1280, 900, 1);
await dash.getByRole('button', { name: 'Studio dashboard' }).click();
await dash.getByRole('button', { name: 'Sign in' }).click();
await dash.getByRole('heading', { name: 'Diary' }).waitFor();
await dash.waitForTimeout(800);
await dash.addStyleTag({ content: HIDE_FLOATING });
const dashboard = jpeg(await dash.screenshot({ type: 'jpeg', quality: 70 }));
await dash.close();

// The photographs as JPEG, 640 wide, re-encoded in the browser (no image library needed).
const convert = await browser.newPage();
const photoJpegs = [];
for (const p of photos) {
  const data = await convert.evaluate(async (src) => {
    const img = new Image();
    img.src = src;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = 640;
    c.height = Math.round((img.naturalHeight * 640) / img.naturalWidth);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.78);
  }, p.src);
  photoJpegs.push({ ...p, src: data });
}
// iPhones shrink or drop very tall images in their preview, so long page
// screenshots are cut into slices of at most 2000 px, stacked with no gap.
for (const shot of shots) {
  shot.slices = await convert.evaluate(async (src) => {
    const img = new Image();
    img.src = src;
    await img.decode();
    const out = [];
    for (let y = 0; y < img.naturalHeight; y += 2000) {
      const h = Math.min(2000, img.naturalHeight - y);
      const c = document.createElement('canvas');
      c.width = img.naturalWidth;
      c.height = h;
      c.getContext('2d').drawImage(img, 0, y, c.width, h, 0, 0, c.width, h);
      out.push(c.toDataURL('image/jpeg', 0.62));
    }
    return out;
  }, shot.src);
}
await browser.close();

const audit = reportPage('Grateful-Build-Audit.html', '#audit');
const costing = reportPage('Grateful-Website-Costing.html', '#costing');
const golive = reportPage('Grateful-Go-Live-Guide.html', '#golive');
const DESCRIPTION = 'The Grateful website, as pictures of every page, with its photographs, completion audit and costing. Made to open anywhere, including inside WhatsApp on an iPhone.';

const html = `<!doctype html>
<html lang="en-ZA">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Grateful — Website Handover (iPhone and WhatsApp)</title>
<meta name="description" content="${esc(DESCRIPTION)}">
<meta name="author" content="Grateful (Pty) Ltd">
<meta name="theme-color" content="#000000">
<meta name="color-scheme" content="light dark">
<meta name="robots" content="noindex">
<meta property="og:title" content="Grateful — Website Handover">
<meta property="og:description" content="${esc(DESCRIPTION)}">
<link rel="apple-touch-icon" href="${touchIcon}">
<style>
${fontFaces}
:root { --ink: #0b0b0b; --paper: #ffffff; --rule: #dcdcdc; --muted: #5a5a5a; --soft: #f5f5f4; color-scheme: light; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --ink: #f4f4f4; --paper: #0a0a0a; --rule: #2c2c2c; --muted: #a8a8a8; --soft: #151515; color-scheme: dark; } }
:root[data-theme="dark"] { --ink: #f4f4f4; --paper: #0a0a0a; --rule: #2c2c2c; --muted: #a8a8a8; --soft: #151515; color-scheme: dark; }
html { -webkit-text-size-adjust: 100%; }
body { margin: 0; background: var(--paper); color: var(--ink); font: 16px/1.6 'Baskervville', Baskerville, Georgia, serif; }
.w { max-width: 1040px; margin: 0 auto; padding: 0 16px; }
.top { border-bottom: 1px solid var(--ink); padding: calc(12px + env(safe-area-inset-top, 0px)) 0 12px; }
.brand { font: 600 12px/1.4 'Inter', 'Helvetica Neue', Arial, sans-serif; letter-spacing: .16em; text-transform: uppercase; }
.lbl { font: 600 11px/1.4 'Inter', 'Helvetica Neue', Arial, sans-serif; letter-spacing: .14em; text-transform: uppercase; color: var(--muted); }
h1 { margin: 28px 0 0; font-weight: 400; font-size: clamp(2rem, 7vw, 3.2rem); line-height: 1.05; letter-spacing: -.02em; }
h1 em, h2 em { font-style: italic; }
h2 { margin: 0; font-weight: 400; font-size: clamp(1.6rem, 5vw, 2.2rem); line-height: 1.1; }
p { margin: 12px 0 0; }
.muted { color: var(--muted); }
.note { margin-top: 16px; background: var(--soft); padding: 12px 14px; border-radius: 4px; font: 14px/1.55 'Inter', 'Helvetica Neue', Arial, sans-serif; color: var(--muted); }
.note b { color: var(--ink); }
a { color: inherit; word-break: break-word; }
.toc { margin: 20px 0 8px; padding: 0; list-style: none; border-top: 1px solid var(--rule); font: 15px/1.4 'Inter', 'Helvetica Neue', Arial, sans-serif; }
.toc li { border-bottom: 1px solid var(--rule); }
.toc a { display: block; padding: 12px 0; text-decoration: none; }
.sec { padding: 32px 0; border-bottom: 1px solid var(--rule); }
.shot { margin: 16px auto 0; display: grid; gap: 8px; }
.shot img { display: block; width: 100%; height: auto; border: 1px solid var(--rule); border-radius: 6px; background: #000; }
.shot.phone { max-width: 390px; }
.stack { border: 1px solid var(--rule); border-radius: 6px; overflow: hidden; background: #000; }
.stack img { border: 0; border-radius: 0; }
figcaption { font: 12.5px/1.45 'Inter', 'Helvetica Neue', Arial, sans-serif; color: var(--muted); }
.pages { display: grid; gap: 40px; margin-top: 8px; }
.photos { margin-top: 16px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.photos figure { margin: 0; display: grid; gap: 8px; }
.photos img { display: block; width: 100%; height: auto; border-radius: 4px; }
@media (min-width: 900px) { .photos { grid-template-columns: repeat(5, minmax(0, 1fr)); } .pages { grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: start; } }
${audit.css}
${costing.css}
${golive.css}
</style>
</head>
<body>
<div class="top"><div class="w"><span class="brand">Grateful · Website handover</span></div></div>
<main>
<div class="w">
  <h1>The Grateful website, <em>page by page.</em></h1>
  <p class="muted">A fashion design studio in Mulbarton, Johannesburg. This edition is made to open anywhere, including inside WhatsApp on an iPhone: every page of the website is shown as a picture, followed by the photographs, the completion audit, the costing and the go-live guide.</p>
  <p class="note"><b>To click through the working website,</b> open this link in Safari: <a href="${PREVIEW_URL}">${PREVIEW_URL}</a></p>
  <ul class="toc">
    <li><a href="#pages">The website, page by page</a></li>
    <li><a href="#dashboard">The studio dashboard</a></li>
    <li><a href="#photos">The photographs</a></li>
    <li><a href="#audit">Completion audit: 80% complete</a></li>
    <li><a href="#costing">Costing</a></li>
    <li><a href="#golive">Go-live guide: the ten steps to switch the site on</a></li>
    <li><a href="#checklist">Launch checklist</a></li>
  </ul>
</div>

<section id="pages" class="sec"><div class="w">
  <span class="lbl">The website</span>
  <h2>Page by page, <em>as a phone shows it.</em></h2>
  <figure class="shot"><img src="${desktopHome}" alt="The Grateful home page on a computer screen"><figcaption>Home page on a computer screen</figcaption></figure>
  <div class="pages">
    ${shots
      .map((s) => `<div><h2 style="font-size:1.5rem;margin-top:8px">${esc(s.name)}</h2><p class="muted" style="font-size:.98rem">${esc(s.note)}</p><figure class="shot phone"><div class="stack" role="img" aria-label="The ${esc(s.name)} page of the Grateful website on a phone, full length">${s.slices.map((src) => `<img src="${src}" alt="">`).join('')}</div><figcaption>${esc(s.name)} · phone, full page</figcaption></figure></div>`)
      .join('\n    ')}
  </div>
</div></section>

<section id="dashboard" class="sec"><div class="w">
  <span class="lbl">For the studio</span>
  <h2>The studio dashboard</h2>
  <p class="muted">Where the studio sees the diary, records phone bookings, reschedules or cancels, sets prices and opening hours, and works through enquiries. Shown here with sample bookings.</p>
  <figure class="shot"><img src="${dashboard}" alt="The Grateful studio dashboard diary with sample bookings"><figcaption>Studio dashboard · diary</figcaption></figure>
</div></section>

<section id="photos" class="sec"><div class="w">
  <span class="lbl">Photography</span>
  <h2>The photographs</h2>
  <div class="photos">
    ${photoJpegs.map((p) => `<figure><img src="${p.src}" alt="${esc(p.alt)}"><figcaption>${esc(photoCaption[p.key] ?? p.key)}</figcaption></figure>`).join('\n    ')}
  </div>
</div></section>

<section id="audit" class="sec" style="padding:0">
${audit.body}
</section>

<section id="costing" class="sec" style="padding:0">
${costing.body}
</section>

<section id="golive" class="sec" style="padding:0">
${golive.body}
</section>

<section id="checklist" class="sec" style="border-bottom:0"><div class="w" style="padding-bottom:40px">
  <h2>Launch checklist</h2>
  <p>What the site still needs from the studio is filled in online, and answers save as you go: <a href="${CHECKLIST_URL}">${CHECKLIST_URL}</a></p>
</div></section>
</main>
</body>
</html>
`;

if (/<script/i.test(html)) throw new Error('The WhatsApp edition must contain no scripts');
writeFileSync(new URL('Grateful-iPhone-WhatsApp.html', dir), html);
console.log(`Wrote preview/Grateful-iPhone-WhatsApp.html (${(html.length / 1024 / 1024).toFixed(2)} MB)`);
