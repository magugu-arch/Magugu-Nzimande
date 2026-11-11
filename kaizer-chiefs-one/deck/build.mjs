#!/usr/bin/env node
/**
 * Builds the strategy deck:
 *
 *   node deck/build.mjs            checks, then writes the PDF
 *   node deck/build.mjs --pages d  also writes each page as a PNG into d
 *   node deck/build.mjs --check    checks only (figures and layout); writes no PDF
 *
 * Steps: check the figures add up, write deck.html, lay it out in Chromium,
 * fail if anything overflows its card or its page, print a tagged PDF with an
 * outline, then stamp the document metadata.
 */
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { mkdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { checkFigures } from './figures.mjs';
import { DESCRIPTION, SLIDES, TITLE, html } from './slides.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, 'Kaizer_Chiefs_One_App_Marketing_and_Investment_Strategy.pdf');
const args = process.argv.slice(2);
const pagesIdx = args.indexOf('--pages');
const pagesDir = pagesIdx >= 0 ? args[pagesIdx + 1] : null;

checkFigures();
const source = join(here, 'deck.html');
writeFileSync(source, html());

const browser = await chromium
  .launch()
  .catch(() =>
    chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium' }),
  );
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await page.goto(pathToFileURL(source).href);
await page.evaluate(() => document.fonts.ready);
await page.waitForFunction(() => [...document.images].every((i) => i.complete));

// Layout checks: every font and image present, nothing outside its page,
// nothing spilling out of its card.
const problems = await page.evaluate(() => {
  const out = [];
  for (const weight of [300, 400, 500, 600]) {
    if (!document.fonts.check(`${weight} 20px "Exo 2"`)) out.push(`font weight ${weight} missing`);
  }
  for (const img of document.images) {
    if (!img.naturalWidth) out.push(`image failed: ${img.getAttribute('src')}`);
    if (!img.alt) out.push(`image has no alt text: ${img.getAttribute('src')}`);
  }
  const label = (el) =>
    `${el.tagName.toLowerCase()}.${String(el.className.baseVal ?? el.className).replace(/\s+/g, '.')} "${(el.textContent || '').trim().slice(0, 40)}"`;
  document.querySelectorAll('.slide').forEach((slide, i) => {
    const n = i + 1;
    const s = slide.getBoundingClientRect();
    if (Math.round(s.width) !== 1600 || Math.round(s.height) !== 900) {
      out.push(`slide ${n} is ${s.width} x ${s.height}`);
    }
    // Text must stay inside the page with a margin.
    for (const el of slide.querySelectorAll(
      'h1, h3, h4, p, li, td, th, dt, dd, span, small, b, figcaption',
    )) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      if (
        r.left < s.left + 20 ||
        r.right > s.right - 20 ||
        r.top < s.top + 14 ||
        r.bottom > s.bottom - 14
      ) {
        out.push(`slide ${n}: ${label(el)} leaves the page`);
      }
    }
    // Nothing may spill out of a card, a bar or a message.
    for (const box of slide.querySelectorAll('.card, .bar, .msg, .frame, .top, .head')) {
      const b = box.getBoundingClientRect();
      for (const el of box.querySelectorAll(
        'h1, h3, h4, p, li, td, th, dt, dd, table, figcaption, .node, .cta',
      )) {
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) continue;
        if (
          r.left < b.left - 0.5 ||
          r.right > b.right + 0.5 ||
          r.top < b.top - 0.5 ||
          r.bottom > b.bottom + 0.5
        ) {
          out.push(`slide ${n}: ${label(el)} spills out of ${label(box).slice(0, 40)}`);
        }
      }
    }
    // Stacked text inside a card must not overlap.
    for (const box of slide.querySelectorAll('.card, .frame')) {
      const kids = [...box.children].filter((k) => {
        const r = k.getBoundingClientRect();
        const pos = getComputedStyle(k).position;
        return r.width && r.height && pos !== 'absolute' && k.tagName !== 'IMG';
      });
      for (let k = 1; k < kids.length; k += 1) {
        const prev = kids[k - 1].getBoundingClientRect();
        const cur = kids[k].getBoundingClientRect();
        const sideBySide = cur.left >= prev.right - 0.5 || prev.left >= cur.right - 0.5;
        if (!sideBySide && cur.top < prev.bottom - 0.5) {
          out.push(`slide ${n}: ${label(kids[k])} overlaps ${label(kids[k - 1])}`);
        }
      }
    }
    // Headline and supporting line on a photograph must not collide.
    const h = slide.querySelector('.frame h1');
    const sub = slide.querySelector('.frame .subline');
    const cta = slide.querySelector('.frame .cta');
    const hit = (a, b) => {
      const x = a.getBoundingClientRect();
      const y = b.getBoundingClientRect();
      return x.left < y.right && y.left < x.right && x.top < y.bottom && y.top < x.bottom;
    };
    if (h && sub && hit(h.firstChild ? rangeOf(h) : h, sub))
      out.push(`slide ${n}: headline meets the supporting line`);
    if (h && cta && hit(rangeOf(h), cta)) out.push(`slide ${n}: headline meets the button`);
    if (sub && cta && hit(sub, cta)) out.push(`slide ${n}: supporting line meets the button`);
  });
  // The headline's own ink box, not its full-width block.
  function rangeOf(el) {
    const range = document.createRange();
    range.selectNodeContents(el);
    return range;
  }
  return out;
});
if (problems.length) {
  console.error(`Layout check failed (${problems.length}):\n  ${problems.join('\n  ')}`);
  if (!args.includes('--force')) {
    await browser.close();
    process.exit(1);
  }
}

if (pagesDir) {
  mkdirSync(pagesDir, { recursive: true });
  const slides = await page.locator('.slide').all();
  for (let i = 0; i < slides.length; i += 1) {
    await slides[i].screenshot({
      path: join(pagesDir, `page-${String(i + 1).padStart(2, '0')}.png`),
    });
  }
}

if (args.includes('--check')) {
  await browser.close();
  console.log(`${SLIDES.length} slides: figures add up and nothing overflows.`);
  process.exit(0);
}

// Chromium builds each bookmark from the heading's text and drops the forced
// line breaks, which runs two words together. Collect the right titles so the
// metadata step can put the space back.
const titles = await page.evaluate(() => {
  const map = {};
  for (const el of document.querySelectorAll('h1, h3, h4')) {
    const text = el.innerText;
    if (text.includes('\n')) {
      map[text.replace(/\s*\n\s*/g, '')] = text.replace(/\s*\n\s*/g, ' ');
    }
  }
  return map;
});
const titlesFile = `${OUT}.titles.json`;
writeFileSync(titlesFile, JSON.stringify(titles));

const raw = `${OUT}.tmp`;
await page.pdf({
  path: raw,
  preferCSSPageSize: true,
  printBackground: true,
  tagged: true,
  outline: true,
});
await browser.close();

// Document metadata. If Python or pypdf is missing the PDF is still complete.
try {
  execFileSync(
    'python3',
    ['-I', join(here, 'finish.py'), raw, OUT, TITLE, DESCRIPTION, titlesFile],
    { stdio: 'inherit' },
  );
} catch {
  renameSync(raw, OUT);
  rmSync(titlesFile, { force: true });
  console.warn('Metadata step skipped (python3 with pypdf not available).');
}
console.log(
  `${SLIDES.length} slides, ${(statSync(OUT).size / 1e6).toFixed(1)} MB: ${OUT}${problems.length ? ' (with layout warnings)' : ''}`,
);
