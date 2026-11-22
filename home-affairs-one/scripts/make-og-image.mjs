#!/usr/bin/env node
/**
 * Renders the social preview image (1200 × 630) shown when a hosted link to the
 * prototype is shared on WhatsApp, iMessage and similar:
 *
 *   share/og-image.jpg
 *
 * It is drawn as a small web page with the product's own fonts and photograph,
 * then captured, so it always matches the app. The "concept prototype" label is
 * part of the image: a preview must never look like an official service.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';
import sharp from 'sharp';

const root = path.resolve(import.meta.dirname, '..');
const font = (pkg, file) =>
  readFileSync(
    path.join(root, 'node_modules', '@fontsource-variable', pkg, 'files', file),
  ).toString('base64');
const photo = (
  await sharp(path.join(root, 'assets', 'masters', 'IMG_7994.png'))
    .resize({ width: 1200 })
    .jpeg({ quality: 88 })
    .toBuffer()
).toString('base64');

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:Display;src:url(data:font/woff2;base64,${font('fraunces', 'fraunces-latin-opsz-normal.woff2')}) format('woff2');font-weight:100 900}
@font-face{font-family:Body;src:url(data:font/woff2;base64,${font('atkinson-hyperlegible-next', 'atkinson-hyperlegible-next-latin-wght-normal.woff2')}) format('woff2');font-weight:200 800}
*{box-sizing:border-box;margin:0}
body{width:1200px;height:630px;position:relative;overflow:hidden;background:#0a1c2e;color:#fff;font-family:Body,sans-serif}
.photo{position:absolute;inset:0;background:url(data:image/jpeg;base64,${photo}) 72% 30%/cover}
.shade{position:absolute;inset:0;background:linear-gradient(90deg,rgba(10,28,46,.97) 0%,rgba(10,28,46,.92) 36%,rgba(10,28,46,.5) 56%,rgba(10,28,46,0) 76%)}
.text{position:absolute;left:64px;top:56px;bottom:56px;width:600px;display:flex;flex-direction:column}
.brand{display:flex;align-items:center;gap:14px;font:600 30px/1 Display,serif;letter-spacing:-.01em}
.brand em{color:#f1dc9f;font-style:normal}
.eyebrow{margin-top:auto;display:flex;align-items:center;gap:12px;color:#f1dc9f;font-size:19px;font-weight:700;letter-spacing:.09em;text-transform:uppercase}
.eyebrow::before{content:'';width:34px;height:3px;border-radius:3px;background:#d5a52a}
h1{margin-top:18px;font:540 66px/1.04 Display,serif;letter-spacing:-.02em}
h1 em{color:#f1dc9f;font-weight:480}
.pill{margin-top:30px;align-self:flex-start;padding:10px 18px;border-radius:999px;background:#f8ebc8;color:#102a43;font-size:21px;font-weight:700}
</style></head><body>
<div class="photo"></div><div class="shade"></div>
<div class="text">
  <div class="brand"><svg width="46" height="46" viewBox="0 0 32 32"><rect width="32" height="32" rx="9" fill="#183b5c"/><path d="M10.5 24.5V15a5.5 5.5 0 0 1 11 0v9.5z" fill="#fff"/><rect x="7.5" y="23.75" width="17" height="2.25" rx="1.125" fill="#d5a52a"/></svg>Home Affairs <em>One</em></div>
  <div class="eyebrow">A concept for South Africa</div>
  <h1>One trusted front door to <em>Home Affairs</em> services.</h1>
  <div class="pill">Concept prototype · not an official service</div>
</div></body></html>`;

const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
});
const page = await browser.newPage({
  viewport: { width: 1200, height: 630 },
  deviceScaleFactor: 1,
});
await page.setContent(html, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
const out = path.join(root, 'share', 'og-image.jpg');
await page.screenshot({ path: out, type: 'jpeg', quality: 86 });
await browser.close();
console.log(`social preview image: ${path.relative(root, out)}`);
