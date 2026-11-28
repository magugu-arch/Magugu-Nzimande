#!/usr/bin/env node
/**
 * Screenshots for design review: node scripts/shoot.mjs <baseUrl> <outDir> <path> [path...]
 * Captures each path on a desktop viewport and an emulated iPhone, scrolling
 * first so scroll-reveal content is visible.
 */
import { chromium, devices } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const [base, out, ...paths] = process.argv.slice(2);
await mkdir(out, { recursive: true });
const browser = await chromium.launch();
const targets = [
  { name: 'desktop', ctx: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 } },
  { name: 'iphone', ctx: { ...devices['iPhone 15'], deviceScaleFactor: 1 } },
];
for (const t of targets) {
  const context = await browser.newContext(t.ctx);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  for (const p of paths) {
    await page.goto(base + p, { waitUntil: 'load', timeout: 60000 });
    await page.waitForTimeout(1500);
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 500) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 60));
      }
      document.querySelectorAll('.reveal').forEach((el) => el.classList.add('is-visible'));
      window.scrollTo(0, 0);
      await new Promise((r) => setTimeout(r, 400));
    });
    await page.waitForTimeout(1200);
    const file = path.join(out, `${t.name}${p === '/' ? '-home' : p.replace(/[/?=&]+/g, '-')}.png`);
    await page.screenshot({ path: file, fullPage: true, caret: 'initial' });
    console.log(file, errors.length ? `errors: ${errors.join(' | ')}` : 'ok');
    errors.length = 0;
  }
  await context.close();
}
await browser.close();
