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
@font-face{font-family:Display;font-style:italic;src:url(data:font/woff2;base64,${font('fraunces', 'fraunces-latin-opsz-italic.woff2')}) format('woff2');font-weight:100 900}
@font-face{font-family:Body;src:url(data:font/woff2;base64,${font('atkinson-hyperlegible-next', 'atkinson-hyperlegible-next-latin-wght-normal.woff2')}) format('woff2');font-weight:200 800}
*{box-sizing:border-box;margin:0}
body{width:1200px;height:630px;position:relative;overflow:hidden;background:#070c14;color:#f4f1ea;font-family:Body,sans-serif}
.photo{position:absolute;inset:0;background:url(data:image/jpeg;base64,${photo}) 72% 30%/cover}
.shade{position:absolute;inset:0;background:linear-gradient(90deg,rgba(7,12,20,.97) 0%,rgba(7,12,20,.9) 38%,rgba(7,12,20,.46) 58%,rgba(7,12,20,.06) 80%)}
.text{position:absolute;left:64px;top:56px;bottom:56px;width:640px;display:flex;flex-direction:column}
.brand{display:flex;align-items:center;gap:16px;font:440 31px/1 Display,serif;letter-spacing:-.015em}
.brand em{color:#e6c15c;font-style:italic;font-weight:400}
.eyebrow{margin-top:auto;display:flex;align-items:center;gap:16px;color:#e6c15c;font:500 16px/1.4 ui-monospace,Menlo,Consolas,'Liberation Mono',monospace;letter-spacing:.16em;text-transform:uppercase}
.eyebrow::before{content:'';width:44px;height:1px;background:#d5a52a}
h1{margin-top:22px;font:380 76px/.98 Display,serif;letter-spacing:-.03em}
h1 em{color:#e6c15c;font-style:italic;font-weight:380}
.label{margin-top:34px;align-self:flex-start;padding:10px 16px;border:1px solid #6a5520;background:rgba(30,25,11,.86);color:#e6c15c;font:500 15px/1.4 ui-monospace,Menlo,Consolas,'Liberation Mono',monospace;letter-spacing:.12em;text-transform:uppercase}
</style></head><body>
<div class="photo"></div><div class="shade"></div>
<div class="text">
  <div class="brand"><svg width="44" height="44" viewBox="0 0 32 32"><rect width="32" height="32" fill="#d5a52a"/><rect x="11" y="7" width="10" height="16" fill="#070c14"/><rect x="7" y="23" width="18" height="2" fill="#070c14"/></svg>Home Affairs <em>One</em></div>
  <div class="eyebrow">A concept for South Africa</div>
  <h1>One trusted front door to <em>Home Affairs</em> services.</h1>
  <div class="label">Concept prototype · not an official service</div>
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
