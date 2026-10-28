#!/usr/bin/env node
/**
 * Renders marketing/deck.html to release/Tashas_App_Marketing_Strategy.pdf,
 * one 1600 × 900 page per slide. Exo 2 comes from Google Fonts, so this needs
 * network access. Pass --preview <dir> to also save a PNG of every slide for
 * review. Run: node marketing/build-deck.mjs [--preview dir]
 */
import { mkdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const pdf = path.join(here, '..', 'release', 'Tashas_App_Marketing_Strategy.pdf');
const previewAt = process.argv.indexOf('--preview');
const preview = previewAt > -1 ? path.resolve(process.argv[previewAt + 1]) : null;
const { chromium } = createRequire(import.meta.url)('playwright');

// The Playwright that resolves may not match the browser on disk; fall back to
// a Chromium given by CHROMIUM_PATH (or the cloud image's preinstalled one).
const browser = await chromium
  .launch()
  .catch(() => chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium' }));
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await page.goto(pathToFileURL(path.join(here, 'deck.html')).href, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
const ok = await page.evaluate(() => document.fonts.check('300 40px "Exo 2"') && document.fonts.check('600 16px "Exo 2"'));
if (!ok) throw new Error('Exo 2 did not load; check network access to fonts.googleapis.com');
const broken = await page.evaluate(() => [...document.images].filter((i) => !i.complete || !i.naturalWidth).map((i) => i.src));
if (broken.length) throw new Error(`images failed to load: ${broken.join(', ')}`);

if (preview) {
  mkdirSync(preview, { recursive: true });
  const slides = page.locator('.slide');
  const count = await slides.count();
  for (let i = 0; i < count; i++) {
    await slides.nth(i).screenshot({ path: path.join(preview, `slide-${String(i + 1).padStart(2, '0')}.png`) });
  }
  console.log(`  ✓ ${count} slide previews in ${preview}`);
}

await page.emulateMedia({ media: 'print' });
await page.pdf({ path: pdf, width: '1600px', height: '900px', printBackground: true, preferCSSPageSize: true });
await browser.close();
console.log(`  ✓ ${path.relative(process.cwd(), pdf)} (${(statSync(pdf).size / 1e6).toFixed(1)} MB)`);
