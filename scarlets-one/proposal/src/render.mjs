// Prints build/deck.html to PDF, after checking the layout of every slide.
//
//   node proposal/src/render.mjs [--pages]   (--pages also saves a PNG per slide)
import { mkdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const here = dirname(fileURLToPath(import.meta.url));
const html = join(here, '..', 'build', 'deck.html');
const pdf = join(here, '..', 'Scarlets_One_Fan_App_Proposal.pdf');

const browser = await chromium.launch();
const page = await (
  await browser.newContext({ viewport: { width: 1920, height: 1080 } })
).newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('requestfailed', (request) => errors.push(`failed: ${request.url()}`));
await page.goto(pathToFileURL(html).href, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(400);

const report = await page.evaluate(() => {
  const issues = [];
  const text = (el) => (el.textContent || '').trim().slice(0, 34);
  document.querySelectorAll('.slide').forEach((slide, index) => {
    const n = index + 1;
    const frame = slide.getBoundingClientRect();
    slide.querySelectorAll('img').forEach((img) => {
      if (!(img.complete && img.naturalWidth > 0))
        issues.push(`slide ${n}: image did not load ${img.getAttribute('src')}`);
    });
    slide.querySelectorAll('.card').forEach((card) => {
      const box = card.getBoundingClientRect();
      card.querySelectorAll('*').forEach((el) => {
        if (el.closest('svg') && el.tagName !== 'svg') return;
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) return;
        const over = Math.max(
          r.bottom - box.bottom,
          r.right - box.right,
          box.left - r.left,
          box.top - r.top,
        );
        if (over > 1)
          issues.push(
            `slide ${n}: <${el.tagName.toLowerCase()}> leaves its card by ${Math.round(over)}px "${text(el)}"`,
          );
      });
      // text sitting on top of its heading: the space between them collapsed
      const heading = card.querySelector(':scope > h3');
      const body = card.querySelector(
        ':scope > .txt, :scope > .bul, :scope > .meta, :scope > .who',
      );
      if (heading && body) {
        const gap =
          body.getBoundingClientRect().top +
          parseFloat(getComputedStyle(body).paddingTop) -
          heading.getBoundingClientRect().bottom;
        if (gap < 10) issues.push(`slide ${n}: only ${Math.round(gap)}px under "${text(heading)}"`);
      }
    });
    slide.querySelectorAll('*').forEach((el) => {
      if (el.closest('.frame') || el.closest('svg')) return;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      if (
        r.bottom > frame.bottom + 0.5 ||
        r.right > frame.right + 0.5 ||
        r.left < frame.left - 0.5
      ) {
        issues.push(
          `slide ${n}: <${el.tagName.toLowerCase()} class="${el.className}"> runs off the slide "${text(el)}"`,
        );
      }
    });
    // SVG text running outside its drawing
    slide.querySelectorAll('svg.chart, svg.loop').forEach((svg) => {
      const box = svg.getBoundingClientRect();
      svg.querySelectorAll('text').forEach((label) => {
        const r = label.getBoundingClientRect();
        if (
          r.right > box.right + 1 ||
          r.left < box.left - 1 ||
          r.bottom > box.bottom + 1 ||
          r.top < box.top - 1
        ) {
          issues.push(`slide ${n}: chart label outside its drawing "${text(label)}"`);
        }
      });
    });
    const head = slide.querySelector('.head');
    if (head) {
      const bottom = head.getBoundingClientRect().bottom;
      slide.querySelectorAll('.body > *').forEach((child) => {
        const top = child.getBoundingClientRect().top;
        if (top < bottom + 14)
          issues.push(`slide ${n}: content starts ${Math.round(top - bottom)}px from the title`);
      });
    }
    const note = slide.querySelector('.fn');
    if (note) {
      const top = note.getBoundingClientRect().top;
      slide.querySelectorAll('.card').forEach((card) => {
        const bottom = card.getBoundingClientRect().bottom;
        if (bottom > top - 4)
          issues.push(
            `slide ${n}: a card reaches the footnote (${Math.round(bottom)} against ${Math.round(top)})`,
          );
      });
      if (note.getBoundingClientRect().bottom > frame.bottom - 20)
        issues.push(`slide ${n}: footnote too close to the edge`);
    }
  });
  const fonts = [...document.fonts]
    .filter((font) => font.status === 'loaded')
    .map((font) => `${font.weight}${font.style === 'italic' ? 'i' : ''}`);
  return { slides: document.querySelectorAll('.slide').length, fonts, issues };
});

if (process.argv.includes('--pages')) {
  const dir = join(here, '..', '.cache', 'pages');
  mkdirSync(dir, { recursive: true });
  const slides = page.locator('.slide');
  for (let i = 0; i < report.slides; i += 1) {
    await slides.nth(i).screenshot({ path: join(dir, `${String(i + 1).padStart(2, '0')}.png`) });
  }
}

await page.pdf({
  path: pdf,
  width: '1920px',
  height: '1080px',
  printBackground: true,
  preferCSSPageSize: true,
});
await browser.close();

console.log(`[proposal] ${report.slides} slides, fonts ${report.fonts.join(' ')}`);
for (const issue of [...report.issues, ...errors]) console.log(`  ISSUE ${issue}`);
console.log(`[proposal] wrote ${pdf}: ${(statSync(pdf).size / 1048576).toFixed(2)} MB`);
if (report.issues.length || errors.length) process.exit(1);
