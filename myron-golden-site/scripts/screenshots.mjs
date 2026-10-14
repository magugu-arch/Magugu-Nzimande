#!/usr/bin/env node
/**
 * Viewport review (brief §13): screenshots of each route at the widths the
 * acceptance tests name, plus a horizontal-overflow check on every one.
 *
 *   npm run build && npm start &   # then:
 *   npm run screenshots -- --base http://localhost:3000 --routes /,/about --widths 390,1440
 *
 * Writes to .screenshots/ (git-ignored). Exits non-zero if any page scrolls
 * sideways.
 */
import { mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .join(' ')
    .split('--')
    .filter(Boolean)
    .map((part) => {
      const [k, ...v] = part.trim().split(' ');
      return [k, v.join(' ')];
    }),
);

const base = args.base || 'http://localhost:3000';
const widths = (args.widths || '360,390,768,1024,1440,1920').split(',').map(Number);
const routes = (
  args.routes ||
  '/,/about,/work-with-myron,/programs,/programs/make-more-offers-challenge,/books,/books/boss-moves,/learn,/learn/selling-as-service,/insights,/insights/purpose-at-work,/events,/events/business-growth-workshop,/speaking,/press,/contact,/login,/privacy,/search?q=offers,/review,/does-not-exist'
).split(',');
const fullPage = args.full !== 'false';
const outDir = path.resolve('.screenshots');
await mkdir(outDir, { recursive: true });

const executablePath = existsSync('/opt/pw-browsers/chromium')
  ? '/opt/pw-browsers/chromium'
  : undefined;
const browser = await chromium.launch({ executablePath });
const problems = [];

for (const width of widths) {
  const context = await browser.newContext({
    viewport: { width, height: width < 768 ? 844 : 900 },
    deviceScaleFactor: 1,
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  page.on('pageerror', (err) =>
    problems.push(`${width}px ${page.url()}: page error ${err.message}`),
  );
  page.on('console', (msg) => {
    // The 404 route is expected to answer 404.
    if (
      msg.type() === 'error' &&
      !(page.url().includes('does-not-exist') && msg.text().includes('404'))
    )
      problems.push(`${width}px ${page.url()}: console ${msg.text()}`);
  });
  for (const route of routes) {
    await page.goto(base + route, { waitUntil: 'networkidle' });
    // Bring every lazy image and reveal into view before capturing.
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 600) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 40));
      }
      window.scrollTo(0, 0);
    });
    await page
      .waitForFunction(
        () =>
          // Only images a reader could see: lazy images off to the side of a
          // scroll rail, or hidden at this width, are right not to load.
          Array.from(document.images)
            .filter((i) => {
              const r = i.getBoundingClientRect();
              return (
                i.offsetParent !== null && r.width > 0 && r.left < window.innerWidth && r.right > 0
              );
            })
            .every((i) => i.complete),
        null,
        {
          timeout: 15000,
        },
      )
      .catch(() => problems.push(`${width}px ${route}: images still loading after 15s`));
    await page.waitForTimeout(250);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    if (overflow > 0) problems.push(`${width}px ${route}: horizontal overflow of ${overflow}px`);
    const name = `${route.replace(/[/?=]+/g, '_').replace(/^_|_$/g, '') || 'home'}@${width}.png`;
    await page.screenshot({ path: path.join(outDir, name), fullPage });
  }
  await context.close();
}

await browser.close();
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log(`Captured ${routes.length * widths.length} screenshots in ${outDir}; no overflow.`);
