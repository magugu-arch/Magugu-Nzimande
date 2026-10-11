#!/usr/bin/env node
/**
 * Test the single-file offline demo in a real browser, with the network cut.
 *
 * The browser context is offline and every request that is not file:, data:
 * or blob: is aborted and counted, so "works offline" is a measured fact
 * rather than a hope. At four widths it checks the page loads cleanly, the
 * demo label is fully visible, nothing scrolls sideways, every button has a
 * name and all 24 images decode. On the phone width it then walks every
 * required view and the gestures: sheet dismiss by flick, back-swipe from the
 * edge, the browser's own Back, and the tracker in each delivery state.
 *
 * Writes docs/OFFLINE_DEMO_TEST_RESULTS.md and screenshots to
 * .offline-demo-shots/ (git-ignored). Exits non-zero on any failure.
 *
 * Run: node scripts/test-offline-demo.mjs   (after npm run demo:build)
 */
import { fileURLToPath, pathToFileURL } from 'node:url';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HTML = path.join(root, 'deliverables', 'MAXHOSA_AFRICA_App_Offline_Demo.html');
const SHOTS = path.join(root, '.offline-demo-shots');
const REPORT = path.join(root, 'docs', 'OFFLINE_DEMO_TEST_RESULTS.md');
const URL = pathToFileURL(HTML).href;

if (!existsSync(HTML)) {
  console.error('No demo found. Run: npm run demo:build');
  process.exit(2);
}
mkdirSync(SHOTS, { recursive: true });

const results = [];
let failed = 0;
function check(group, name, ok, detail = '') {
  results.push({ group, name, ok: !!ok, detail });
  if (!ok) failed++;
  console.log(`${ok ? '  ✓' : '  ✗'} [${group}] ${name}${detail ? ` — ${detail}` : ''}`);
}

// ---- static checks on the file itself -----------------------------------
const source = readFileSync(HTML, 'utf8');
const externalRefs = source.match(/(?:src|href)\s*=\s*["']https?:|url\(\s*["']?https?:|@import|<script[^>]+src=|<link[^>]+href=/gi) || [];
check('file', 'no external src/href/url()/@import/script/link references', externalRefs.length === 0, externalRefs.slice(0, 3).join(', '));
check('file', 'no ES-module scripts', !/<script[^>]+type=["']module/i.test(source));
check('file', 'Content-Security-Policy forbids network fetches', /connect-src 'none'/.test(source) && /default-src 'none'/.test(source));
check('file', 'demo label present in markup', source.includes('Concept demo — sample products, sample courier, no real purchase/delivery'));
const sizeMb = statSync(HTML).size / 1024 / 1024;
check('file', 'single file under 5 MB', sizeMb < 5, `${sizeMb.toFixed(2)} MB`);

// ---- browser ------------------------------------------------------------
async function launch() {
  try {
    return await chromium.launch({ args: ['--disable-background-networking'] });
  } catch {
    // Pre-installed Chromium when the pinned Playwright build is not downloaded.
    return chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--disable-background-networking'] });
  }
}
const browser = await launch();
const browserVersion = browser.version();

async function openPage(viewport, opts = {}) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: opts.dpr ?? 2,
    isMobile: !!opts.mobile,
    hasTouch: !!opts.mobile,
    offline: true,
    colorScheme: opts.colorScheme ?? 'light',
    reducedMotion: opts.reducedMotion ?? 'no-preference',
  });
  const page = await context.newPage();
  const problems = { console: [], blocked: [] };
  page.on('console', (m) => {
    if (m.type() === 'error') problems.console.push(m.text());
  });
  page.on('pageerror', (e) => problems.console.push(`pageerror: ${e.message}`));
  await context.route('**/*', (route) => {
    const u = route.request().url();
    if (/^(file|data|blob):/.test(u)) return route.continue();
    problems.blocked.push(u);
    return route.abort();
  });
  await page.goto(URL);
  await page.waitForFunction(() => window.MX_READY === true, null, { timeout: 15000 });
  return { context, page, problems };
}

const settle = (page, ms = 650) => page.waitForTimeout(ms);
const shot = (page, name) => page.screenshot({ path: path.join(SHOTS, `${name}.png`) });

const VIEWPORTS = [
  { label: 'phone 390×844', key: 'phone', viewport: { width: 390, height: 844 }, mobile: true },
  { label: 'small phone 320×640', key: 'small', viewport: { width: 320, height: 640 }, mobile: true },
  { label: 'tablet 820×1180', key: 'tablet', viewport: { width: 820, height: 1180 }, mobile: true },
  { label: 'desktop 1280×900', key: 'desktop', viewport: { width: 1280, height: 900 }, mobile: false, dpr: 1 },
];

for (const vp of VIEWPORTS) {
  const g = vp.label;
  const { context, page, problems } = await openPage(vp.viewport, vp);
  const layout = await page.evaluate(() => {
    const strip = document.querySelector('.demo-strip span');
    const unnamed = [...document.querySelectorAll('button')]
      .filter((b) => b.offsetParent !== null)
      .filter((b) => !(b.getAttribute('aria-label') || b.textContent.trim()))
      .map((b) => b.outerHTML.slice(0, 80));
    const imgsNoAlt = [...document.querySelectorAll('img')].filter((i) => !i.hasAttribute('alt')).length;
    return {
      overflowX: document.documentElement.scrollWidth - window.innerWidth,
      stripClipped: strip.scrollWidth > strip.clientWidth + 1 || strip.scrollHeight > strip.clientHeight + 1,
      unnamed,
      imgsNoAlt,
    };
  });
  check(g, 'loads with no console errors', problems.console.length === 0, problems.console.slice(0, 2).join(' | '));
  check(g, 'no horizontal page scroll', layout.overflowX <= 0, `${layout.overflowX}px`);
  check(g, 'demo label fully visible (not truncated)', !layout.stripClipped);
  check(g, 'every visible button has an accessible name', layout.unnamed.length === 0, layout.unnamed[0] || '');
  check(g, 'every image has an alt attribute', layout.imgsNoAlt === 0);
  const decode = await page.evaluate(async () => {
    const ids = Object.keys(window.MX_DATA.assets);
    const out = await Promise.all(
      ids.map(
        (id) =>
          new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve(img.naturalWidth > 0);
            img.onerror = () => resolve(false);
            img.src = window.MX_DATA.assets[id].uri;
          }),
      ),
    );
    return { count: ids.length, decoded: out.filter(Boolean).length };
  });
  check(g, 'all 24 verified images decode', decode.count === 24 && decode.decoded === 24, `${decode.decoded}/${decode.count}`);
  await shot(page, `${vp.key}-home`);
  check(g, 'no network requests attempted', problems.blocked.length === 0, problems.blocked.slice(0, 2).join(', '));
  await context.close();
}

// ---- journeys on the phone ----------------------------------------------
{
  const g = 'journeys (phone)';
  const { context, page, problems } = await openPage({ width: 390, height: 844 }, { mobile: true });
  const top = () => page.locator('.screen.pushed').last();

  // Shop: search, no results, filters persist across a product visit.
  await page.click('.tab[data-tab="shop"]');
  await page.fill('#shop-q', 'polo');
  const polo = await page.locator('#shop-results .pcard').count();
  check(g, 'Shop search finds "polo"', polo >= 1, `${polo} results`);
  await page.fill('#shop-q', 'zzzz');
  check(g, 'Shop shows a no-results state', await page.locator('#shop-results .empty').isVisible());
  await page.click('[data-action="clear-filters"]');
  await page.click('[data-action="shop-cat"][data-id="women"]');
  const women = await page.locator('#shop-results .pcard').count();
  await shot(page, 'phone-shop');

  // Product: no preselected size, an error without one, then add.
  await page.locator('#shop-results .card-link').first().click();
  await settle(page);
  const checked = await top().locator('.sizes [aria-checked="true"]').count();
  check(g, 'Product page has no preselected size', checked === 0);
  await top().locator('[data-action="add-to-bag"]').click();
  check(g, 'Add without a size explains what to do', (await top().locator('.size-status').textContent()).includes('Choose a size'));
  const firstAvailable = top().locator('.sizes .chip:not(.is-unavailable)').first();
  await firstAvailable.click();
  await top().locator('[data-action="add-to-bag"]').click();
  await settle(page, 300);
  const badge = await page.locator('[data-bag-badge]').first().textContent();
  check(g, 'Adding a sized piece updates the bag badge', badge.trim() === '1', `badge ${badge}`);
  await shot(page, 'phone-product');

  // Back via the browser's own history (Android back button) keeps filters.
  await page.goBack();
  await settle(page);
  check(g, 'Browser Back closes the product page', (await page.locator('.screen.pushed').count()) === 0);
  check(
    g,
    'Shop filters persist after returning from a product',
    (await page.locator('[data-action="shop-cat"][data-id="women"]').getAttribute('aria-checked')) === 'true' &&
      (await page.locator('#shop-results .pcard').count()) === women,
  );

  // Edge swipe back.
  await page.locator('#shop-results .card-link').first().click();
  await settle(page);
  await page.mouse.move(4, 500);
  await page.mouse.down();
  for (let x = 20; x <= 320; x += 30) await page.mouse.move(x, 505, { steps: 1 });
  await page.mouse.up();
  await settle(page, 900);
  check(g, 'Swipe from the left edge pops the product page', (await page.locator('.screen.pushed').count()) === 0);

  // Saved.
  await page.locator('#shop-results [data-action="toggle-save"]').first().click();
  await page.click('.tab[data-tab="saved"]');
  check(g, 'Saved shows a saved piece', (await page.locator('#tab-saved .pcard').count()) === 1);
  await shot(page, 'phone-saved');

  // Bag sheet: drag down and flick to dismiss.
  await page.click('.tab[data-tab="home"]');
  await page.locator('#tab-home [data-action="open-bag"]').click();
  await settle(page);
  check(g, 'Bag opens with the line and sample totals', (await page.locator('.sheet .line').count()) === 1);
  check(g, 'Bag is labelled demo — no real order or payment', (await page.locator('.sheet').textContent()).includes('Demo — no real order or payment'));
  await shot(page, 'phone-bag');
  const grab = await page.locator('.sheet-grab').boundingBox();
  await page.mouse.move(grab.x + grab.width / 2, grab.y + 4);
  await page.mouse.down();
  for (let dy = 20; dy <= 260; dy += 40) await page.mouse.move(grab.x + grab.width / 2, grab.y + 4 + dy);
  await page.mouse.up();
  await settle(page, 1000);
  check(g, 'Flicking the bag sheet down dismisses it', (await page.locator('.sheet-layer').count()) === 0);

  // Checkout outcomes, then a confirmed order opens its tracker.
  await page.locator('#tab-home [data-action="open-bag"]').click();
  await settle(page);
  await page.click('[data-action="checkout"]');
  await settle(page);
  await page.click('[data-outcome="failed"]');
  await page.click('[data-co="go"]');
  await page.waitForSelector('[data-co="retry"]', { timeout: 5000 });
  check(g, 'Failed payment has its own state and keeps the bag', (await page.locator('.outcome h3').textContent()).includes('didn’t go through') && (await page.locator('[data-bag-badge]').first().textContent()).trim() === '1');
  await page.click('[data-co="retry"]');
  await page.click('[data-outcome="pending"]');
  await page.click('[data-co="go"]');
  await page.waitForSelector('[data-co="recheck"]', { timeout: 5000 });
  check(g, 'Pending payment has its own state', (await page.locator('.outcome h3').textContent()).includes('Waiting for payment'));
  await page.click('[data-co="recheck"]');
  await page.waitForSelector('[data-co="track"]', { timeout: 5000 });
  const placed = await page.evaluate(() => JSON.parse(localStorage.getItem('mx.orders') || '[]').length);
  check(g, 'Confirmed checkout creates exactly one new order', placed === 2, `${placed} orders`);
  await shot(page, 'phone-checkout');
  await page.click('[data-co="track"]');
  await settle(page, 1200);
  check(g, 'Confirmed order opens its delivery tracker', (await top().getAttribute('class')).includes('tracker'));

  // Tracker states.
  const status = () => top().locator('.status-card').textContent();
  check(g, 'Tracker: no estimate before the courier has it', (await status()).includes('not yet available'));
  check(g, 'Tracker: no tracking reference before handover', (await top().textContent()).includes('Not assigned yet'));
  for (let i = 0; i < 3; i++) {
    await top().locator('[data-t="advance"]').click();
    await settle(page, 150);
  }
  check(g, 'Tracker: estimate is attributed to the courier once handed over', (await status()).includes('Estimate from courier'));
  check(g, 'Tracker: scan-only shipment says location tracking is unavailable', (await top().textContent()).includes('Location tracking isn’t available'));
  await top().locator('[data-t="exception"][data-v="delayed"]').click();
  check(g, 'Tracker: a delay withdraws the estimate', (await status()).includes('not available'));
  check(g, 'Tracker: a delay offers next steps', (await top().locator('.exception .btn').count()) >= 2);
  await top().locator('[data-t="exception"][data-v="none"]').click();
  await top().locator('[data-t="unknown"]').click();
  check(g, 'Tracker: an unknown courier event is not shown as a status', (await top().textContent()).includes('haven’t reviewed yet') && (await status()).includes('With the courier'));
  await top().locator('[data-t="unknown"]').click();
  await top().locator('[data-t="advance"]').click();
  await top().locator('[data-t="advance"]').click();
  await top().locator('[data-t="mode"][data-v="local"]').click();
  await settle(page, 300);
  check(g, 'Tracker: same-day courier shows a map labelled as demo, not GPS', (await top().locator('.map').textContent()).includes('Demo location — not GPS'));
  await shot(page, 'phone-tracker-live');
  await top().locator('[data-t="stale"]').click();
  check(g, 'Tracker: stale location is flagged', (await status()).includes('may be out of date'));
  await top().locator('[data-t="advance"]').click();
  check(g, 'Tracker: delivered state', (await status()).includes('Delivered'));
  await shot(page, 'phone-tracker-delivered');
  check(g, 'Tracker: advance is disabled after delivery', (await top().locator('[data-t="advance"]').getAttribute('aria-disabled')) === 'true');
  await page.goBack();
  await settle(page);

  // Appointment enquiry.
  await page.click('.tab[data-tab="discover"]');
  await page.locator('#tab-discover [data-action="open-appointment"]').click();
  await settle(page);
  await top().locator('[data-ap="submit"]').click();
  await settle(page, 200);
  check(g, 'Appointment: submitting empty shows inline errors', (await top().locator('.error:not(:empty)').count()) >= 3);
  await top().locator('[data-ap="type"]').nth(2).click();
  await top().locator('[data-ap="date"]:not([aria-disabled="true"])').first().click();
  await top().locator('[data-ap="time"]:not([aria-disabled="true"])').first().click();
  await top().locator('[data-field="name"]').fill('Sample Client');
  await top().locator('[data-field="email"]').fill('sample@example.com');
  await top().locator('[data-ap="submit"]').click();
  await page.waitForSelector('.screen.pushed .outcome', { timeout: 5000 });
  const sent = await top().textContent();
  check(g, 'Appointment: enquiry is pending confirmation, not booked', sent.includes('Pending confirmation') && sent.includes('DEMO-APT-'));
  await shot(page, 'phone-appointment');
  await page.goBack();
  await settle(page);

  // Discover story, Account, market switch.
  await page.locator('#tab-discover [data-action="open-story"]').first().click();
  await settle(page);
  check(g, 'Story copy is marked as an editorial placeholder', (await top().textContent()).includes('Editorial placeholder'));
  await page.goBack();
  await settle(page);
  await page.click('.tab[data-tab="account"]');
  await page.click('[data-action="open-market"]');
  await settle(page);
  await page.click('[data-m="GB"]');
  await settle(page, 300);
  await page.goBack();
  await settle(page);
  await page.click('.tab[data-tab="shop"]');
  const price = await page.locator('#shop-results .pcard-price').first().textContent();
  check(g, 'Changing market switches to that market’s sample prices', price.includes('£'), price);

  // Photo viewer: open and drag down to close.
  await page.locator('#shop-results .card-link').first().click();
  await settle(page);
  await top().locator('[data-action="zoom"]').first().click();
  await settle(page, 400);
  check(g, 'Product photo opens the zoom viewer', (await page.locator('.viewer').count()) === 1);
  await page.mouse.move(195, 400);
  await page.mouse.down();
  for (let y = 420; y <= 700; y += 40) await page.mouse.move(195, y);
  await page.mouse.up();
  await settle(page, 900);
  check(g, 'Dragging the photo down closes the viewer', (await page.locator('.viewer').count()) === 0);

  // External links never break the demo offline.
  await page.goBack();
  await settle(page);
  await page.click('.tab[data-tab="account"]');
  await page.locator('#tab-account [data-action="external"]').click();
  check(g, 'External link explains it needs internet', (await page.locator('.toast').textContent()).includes('requires internet'));

  check(g, 'no console errors during the journeys', problems.console.length === 0, problems.console.slice(0, 2).join(' | '));
  check(g, 'no network requests during the journeys', problems.blocked.length === 0, problems.blocked.slice(0, 2).join(', '));
  await context.close();
}

// ---- preferences: reduced motion, dark mode, storage denied -------------
{
  const g = 'preferences';
  const rm = await openPage({ width: 390, height: 844 }, { mobile: true, reducedMotion: 'reduce' });
  await rm.page.locator('#tab-home .card-link').first().click();
  await settle(rm.page, 500);
  check(g, 'Reduce Motion: screens still open (cross-fade, no slide)', (await rm.page.locator('.screen.pushed').count()) === 1);
  check(g, 'Reduce Motion: no errors', rm.problems.console.length === 0);
  await rm.context.close();

  const dark = await openPage({ width: 390, height: 844 }, { mobile: true, colorScheme: 'dark' });
  const bg = await dark.page.evaluate(() => getComputedStyle(document.querySelector('.device')).backgroundColor);
  check(g, 'Dark mode follows the system setting', bg === 'rgb(16, 14, 11)', bg);
  await dark.page.click('.tab[data-tab="shop"]');
  await shot(dark.page, 'phone-dark-shop');
  await dark.context.close();

  // Storage denied, as some file:// and content:// contexts do.
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, offline: true });
  await ctx.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new Error('denied');
      },
    });
  });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(URL);
  await p.waitForFunction(() => window.MX_READY === true, null, { timeout: 15000 });
  await p.locator('#tab-home .card-link').first().click();
  await settle(p);
  check(g, 'Storage denied: the demo still runs from memory', errs.length === 0 && (await p.locator('.screen.pushed').count()) === 1, errs[0] || '');
  await ctx.close();
}

await browser.close();

// ---- report -------------------------------------------------------------
const groups = [...new Set(results.map((r) => r.group))];
const passed = results.filter((r) => r.ok).length;
const date = new Date().toISOString().slice(0, 10);
const md = `# Offline demo — test results

Automated run on ${date} against \`deliverables/MAXHOSA_AFRICA_App_Offline_Demo.html\`
(${sizeMb.toFixed(2)} MB), Chromium ${browserVersion}, headless, **network disabled**
(every non-\`file:\`/\`data:\`/\`blob:\` request aborted and counted).

**${passed} of ${results.length} checks passed.**

Re-run with \`npm run demo:test\`. Screenshots are written to \`.offline-demo-shots/\`.

${groups
  .map(
    (grp) =>
      `## ${grp}\n\n| Check | Result |\n|---|---|\n` +
      results
        .filter((r) => r.group === grp)
        .map((r) => `| ${r.name}${r.detail ? ` (${r.detail.replace(/\|/g, '\\|')})` : ''} | ${r.ok ? 'Pass' : '**FAIL**'} |`)
        .join('\n'),
  )
  .join('\n\n')}

## Real-device and real-app checks — not yet performed

The automated run uses desktop Chromium emulating phone and tablet viewports
(touch enabled for the phone/tablet runs; gestures driven by a mouse pointer).
The checks below need a person and real hardware and have **not** been done
in this environment:

| Check | Status |
|---|---|
| macOS: double-click in Finder opens in Safari / Chrome | Not tested |
| Android: open from Files → Downloads in Chrome (Samsung, Pixel file managers) | Not tested |
| iPhone: open from the Files app in Safari | Not tested |
| WhatsApp: send as Document, download, open in a browser | Not tested |
| Touch feel of sheets, back-swipe and pinch-zoom on a real phone | Not tested |
| VoiceOver (iOS) and TalkBack (Android) walkthrough | Not tested |
| Dynamic Type / Android font scale at the largest setting | Not tested |
`;
writeFileSync(REPORT, md);
console.log(`\n${passed}/${results.length} passed. Report: docs/OFFLINE_DEMO_TEST_RESULTS.md`);
process.exit(failed ? 1 : 0);
