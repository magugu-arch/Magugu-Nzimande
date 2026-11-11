#!/usr/bin/env node
/**
 * Screenshots for the deck, taken from the working concept:
 *   - six phone screens from the single-file app (always);
 *   - the staff-console dashboard when the admin is running:
 *       npm run admin &   then   node deck/capture.mjs --admin http://localhost:3100
 *
 * Every screen shows its own DEMO / SAMPLE / CONCEPT labels; nothing is
 * retouched after capture. Saved as JPEG to keep the PDF light.
 */
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, 'screens');
mkdirSync(out, { recursive: true });

const args = process.argv.slice(2);
const adminIdx = args.indexOf('--admin');
const adminBase = adminIdx >= 0 ? args[adminIdx + 1] : null;

const browser = await chromium
  .launch()
  .catch(() =>
    chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium' }),
  );

// Phone screens. Reduce Motion gives settled frames with no parallax offset.
const app = pathToFileURL(join(here, '..', 'single-file', 'Kaizer_Chiefs_One_Concept.html')).href;
const phone = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  reducedMotion: 'reduce',
});
for (const [name, hash, scroll] of [
  ['phone-home', 'home', 0],
  ['phone-match', 'match', 0],
  ['phone-fan', 'fan', 0],
  ['phone-tickets', 'tickets', 0],
  ['phone-membership', 'membership', 0],
  ['phone-rewards', 'rewards', 0],
]) {
  const page = await phone.newPage();
  await page.goto(`${app}#${hash}`);
  await page.waitForTimeout(500);
  if (scroll) await page.evaluate((y) => window.scrollTo(0, y), scroll);
  await page.waitForTimeout(200);
  await page.screenshot({ path: join(out, `${name}.jpg`), type: 'jpeg', quality: 88 });
  console.log(name);
  await page.close();
}
await phone.close();

// Staff console.
if (adminBase) {
  for (const [name, staffId, path] of [['console-dashboard', 'demo-staff-root', '/']]) {
    const ctx = await browser.newContext({
      viewport: { width: 1180, height: 850 },
      deviceScaleFactor: 2,
    });
    const page = await ctx.newPage();
    await page.goto(`${adminBase}/sign-in`);
    await page.check(`input[value="${staffId}"]`);
    await page.click('button[type=submit]');
    await page.waitForURL(`${adminBase}/`);
    await page.goto(`${adminBase}${path}`);
    await page.waitForLoadState('networkidle');
    // The dev server's own overlay badge is not part of the console.
    await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
    await page.screenshot({ path: join(out, `${name}.jpg`), type: 'jpeg', quality: 88 });
    console.log(name);
    await ctx.close();
  }
}

await browser.close();
