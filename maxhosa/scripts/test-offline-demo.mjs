#!/usr/bin/env node
/**
 * Test the single-file offline demo in a real browser, with the network cut.
 *
 * The browser context is offline and every request that is not file:, data:
 * or blob: is aborted and counted, so "works offline" is a measured fact
 * rather than a hope. At four widths it checks the page loads cleanly, the
 * demo label is fully visible, nothing scrolls sideways, every button has a
 * name and every image in the manifest (the 24 verified plus approved
 * additions) decodes. On the phone width it then walks every required view
 * and the gestures: sheet dismiss by flick, back-swipe from the edge, the
 * browser's own Back, the tracker in each delivery state, and the events
 * loop (calendar, RSVP, waitlist, invitation, calendar file, invite).
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
const MANIFEST = JSON.parse(
  readFileSync(path.join(root, 'assets/maxhosa/MAXHOSA_AFRICA_24_Image_Asset_Manifest.json'), 'utf8'),
);
const VERIFIED = MANIFEST.assets.filter((a) => !a.addition).length;
const ADDITIONS = MANIFEST.assets.length - VERIFIED;

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
  if (opts.reportOnline) {
    // Some Chromium builds report navigator.onLine = true even in an offline
    // context (CI's does); pin it so the outbound-link path runs everywhere.
    await context.addInitScript(() => Object.defineProperty(navigator, 'onLine', { get: () => true }));
  }
  const page = await context.newPage();
  const problems = { console: [], blocked: [], outbound: [] };
  page.on('console', (m) => {
    if (m.type() === 'error') problems.console.push(m.text());
  });
  page.on('pageerror', (e) => problems.console.push(`pageerror: ${e.message}`));
  await context.route('**/*', (route) => {
    const req = route.request();
    const u = req.url();
    if (/^(file|data|blob):/.test(u)) return route.continue();
    // A tab the visitor opened from an outbound policy link is not the demo
    // fetching anything — record it separately and still block it. Whether
    // that tab opens depends on what the browser reports as online.
    let fromDemo = true;
    try {
      fromDemo = req.frame().page() === page;
    } catch {
      // Playwright has no frame yet for a new tab's first navigation.
      fromDemo = !req.isNavigationRequest();
    }
    (fromDemo ? problems.blocked : problems.outbound).push(u);
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
  check(
    g,
    `all ${VERIFIED} verified images and ${ADDITIONS} approved addition(s) decode`,
    VERIFIED === 24 && decode.count === MANIFEST.assets.length && decode.decoded === decode.count,
    `${decode.decoded}/${decode.count}`,
  );
  await shot(page, `${vp.key}-home`);
  check(g, 'no network requests attempted', problems.blocked.length === 0, problems.blocked.slice(0, 2).join(', '));
  await context.close();
}

// ---- journeys on the phone ----------------------------------------------
{
  const g = 'journeys (phone)';
  const { context, page, problems } = await openPage({ width: 390, height: 844 }, { mobile: true, reportOnline: true });
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

  check(
    g,
    'Outbound links go only to maxhosa.africa, and only when chosen',
    problems.outbound.every((u) => u.startsWith('https://maxhosa.africa/')),
    problems.outbound.length ? `${problems.outbound.join(', ')} — opened by the visitor, blocked by the test` : 'none opened',
  );
  check(g, 'no console errors during the journeys', problems.console.length === 0, problems.console.slice(0, 2).join(' | '));
  check(g, 'no network requests during the journeys', problems.blocked.length === 0, problems.blocked.slice(0, 2).join(', '));
  await context.close();
}

// ---- events: the calendar that brings people back ------------------------
{
  const g = 'events (phone)';
  const { context, page, problems } = await openPage({ width: 390, height: 844 }, { mobile: true });
  const top = () => page.locator('.screen.pushed').last();
  const sheet = () => page.locator('.sheet-layer').last();
  const primary = () => top().locator('.action-bar .btn');
  const readDownload = async (click) => {
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 5000 }), click()]);
    return { name: dl.suggestedFilename(), text: readFileSync(await dl.path(), 'utf8') };
  };
  const SCARCITY = /\b\d+\s*(places?|spaces?|seats?|spots?|tickets?)\s*(left|remaining)\b|only\s+\d+/i;

  // Home leads with the next fixture.
  const next = page.locator('#tab-home [data-action="open-event"]').first();
  check(g, 'Home shows the next fixture, labelled as a sample', (await next.textContent()).includes('Sample event'));
  await next.click();
  await settle(page);
  const firstEvent = await top().textContent();
  check(g, 'Event page: kind, date in SAST and status', firstEvent.includes('SAST') && firstEvent.includes('Spaces available'));
  check(g, 'Event page: the venue is not published', firstEvent.includes('shared with confirmed guests'));
  check(g, 'Event page: no invented scarcity counts', !SCARCITY.test(firstEvent));
  check(g, 'Event page: the event edit is shoppable', (await top().locator('.rail .pcard').count()) >= 3);
  await shot(page, 'phone-event');

  // Add to calendar: a real .ics in SAST, labelled as a sample.
  const one = await readDownload(() => top().locator('[data-ev="ics"]').click());
  check(
    g,
    'Add to calendar saves an .ics with the right UTC time',
    one.name.endsWith('.ics') && one.text.startsWith('BEGIN:VCALENDAR') && /DTSTART:\d{8}T163000Z/.test(one.text) && one.text.includes('sample event'),
    one.name,
  );
  check(g, 'Calendar file lines are folded to 75 octets', one.text.split('\r\n').every((l) => Buffer.byteLength(l) <= 75));

  // RSVP: validation, then a place held, then the follow-ups.
  await primary().click();
  await settle(page);
  await page.evaluate(() => {
    document.getElementById('rsvp-name').value = '';
    document.getElementById('rsvp-email').value = '';
  });
  await sheet().locator('[data-r="submit"]').click();
  await settle(page, 300);
  check(g, 'RSVP: empty details show inline errors', (await sheet().locator('.error svg').count()) === 2);
  await sheet().locator('#rsvp-name').fill('Sample Guest');
  await sheet().locator('#rsvp-email').fill('guest@example.com');
  await sheet().locator('[data-g="2"]').click();
  check(g, 'RSVP: future-event marketing is off by default', (await sheet().locator('[data-u="future"]').getAttribute('aria-checked')) === 'false');
  await sheet().locator('[data-r="submit"]').click();
  await settle(page, 400);
  const done = await sheet().textContent();
  check(g, 'RSVP: place held, labelled demo', done.includes('You’re going (demo)'));
  check(
    g,
    'RSVP: offers calendar, invite and the event edit next',
    done.includes('Add to calendar') && done.includes('Invite a friend') && done.includes('Shop the event edit'),
  );
  await shot(page, 'phone-rsvp-done');
  await sheet().locator('[data-action="close-sheet"]').first().click();
  await settle(page);
  check(g, 'Event page shows your RSVP and +1', (await top().textContent()).includes('You’re going · +1'));
  check(g, 'Primary action becomes Add to calendar', (await primary().textContent()).includes('Add to calendar'));

  // Release the place, then undo.
  await top().locator('[data-ev="cancel"]').click();
  await settle(page, 300);
  const released = !(await top().textContent()).includes('You’re going');
  await page.locator('.toast button').click();
  await settle(page, 300);
  check(g, 'Releasing a place can be undone', released && (await top().textContent()).includes('You’re going'));

  // Invite a friend — the phone's share sheet, or text to copy where there is none.
  await page.evaluate(() => {
    navigator.share = undefined;
  });
  await top().locator('.prose ~ div [data-ev="share"], [data-ev="share"]').last().click();
  await settle(page);
  const invite = await sheet().locator('#invite-text').inputValue();
  check(g, 'Invite: shareable text names the event and says sample', invite.includes('New-season preview evening') && invite.includes('sample event'));
  await sheet().locator('[data-copy]').click();
  await settle(page, 200);
  check(g, 'Invite: copy confirms', /Invite copied|Selected/.test(await page.locator('.toast').last().textContent()));
  await page.goBack();
  await settle(page);

  // Product page from the event edit points back to the event.
  await top().locator('.rail .card-link').first().click();
  await settle(page);
  check(g, 'Product page: “Wear it to” links the next event', (await top().locator('.wear-it').textContent()).includes('Wear it to'));
  await page.goBack();
  await settle(page);
  await page.goBack();
  await settle(page);

  // Calendar and fixtures.
  await page.click('.tab[data-tab="discover"]');
  check(g, 'Discover previews the next three fixtures', (await page.locator('#tab-discover .fixture').count()) === 3);
  await page.locator('#tab-discover [data-action="open-events"]').first().click();
  await settle(page);
  check(g, 'Calendar: month grid with labelled days', (await top().locator('.cal-cell[data-day]').count()) >= 28);
  const unnamedDays = await top().locator('.cal-cell[data-day]:not([aria-label])').count();
  check(g, 'Calendar: every day has an accessible name', unnamedDays === 0);
  await shot(page, 'phone-events-calendar');
  const title0 = await top().locator('.cal-title').textContent();
  await top().locator('[data-cal="next"]').click();
  await settle(page, 500);
  const title1 = await top().locator('.cal-title').textContent();
  const box = await top().locator('.cal-grid-wrap').boundingBox();
  await page.mouse.move(box.x + box.width - 30, box.y + box.height / 2);
  await page.mouse.down();
  for (let x = box.x + box.width - 50; x >= box.x + 20; x -= 30) await page.mouse.move(x, box.y + box.height / 2 + 2);
  await page.mouse.up();
  await settle(page, 700);
  const title2 = await top().locator('.cal-title').textContent();
  check(g, 'Calendar: buttons and a sideways swipe change month', title0 !== title1 && title1 !== title2 && title0 !== title2, `${title0} → ${title1} → ${title2}`);
  await top().locator('[data-cal="prev"]').click();
  await settle(page, 300);
  await top().locator('[data-cal="prev"]').click();
  await settle(page, 300);
  let day = top().locator('.cal-cell.has-events').first();
  if (!(await day.count())) {
    await top().locator('[data-cal="next"]').click();
    await settle(page, 300);
    day = top().locator('.cal-cell.has-events').first();
  }
  await day.click();
  await settle(page, 300);
  const dayCards = await top().locator('.fixtures .fixture').count();
  check(g, 'Calendar: choosing a day lists that day’s fixtures', dayCards >= 1 && (await top().locator('[data-cal="clear-day"]').isVisible()), `${dayCards}`);
  await top().locator('[data-cal="clear-day"]').click();
  await top().locator('[data-city="Cape Town"]').click();
  const ct = await top().locator('.fixtures .fixture').allTextContents();
  check(g, 'Fixtures: city filter', ct.length >= 1 && ct.every((t) => t.includes('Cape Town')), `${ct.length}`);
  await top().locator('[data-city="all"]').click();
  await top().locator('[data-when="past"]').click();
  const past = await top().locator('.fixtures .fixture').allTextContents();
  check(g, 'Fixtures: past events are kept, marked past', past.length >= 1 && past.every((t) => t.includes('Past event')));
  await top().locator('.fixtures .fixture').first().click();
  await settle(page);
  check(g, 'Past event: shop the looks from the day', (await primary().textContent()).includes('Shop the looks'));
  await page.goBack();
  await settle(page);
  await top().locator('[data-when="upcoming"]').click();
  check(g, 'Fixtures: no invented scarcity counts anywhere', !SCARCITY.test(await top().textContent()));

  // Full evening: waitlist. The client-supplied image is its hero.
  await top().locator('.fixture', { hasText: 'Sunset knitwear soirée' }).click();
  await settle(page);
  const alt25 = MANIFEST.assets.find((a) => a.id === 'mx-asset-25').alt;
  check(g, 'Full event shows the client-supplied image as its hero', (await top().locator('.story-hero img').getAttribute('alt')) === alt25);
  check(g, 'Full event offers the waitlist, not a place', (await primary().textContent()).includes('Join the waitlist') && (await top().textContent()).includes('Waitlist open'));
  await primary().click();
  await settle(page);
  check(g, 'RSVP remembers your details on this device', (await sheet().locator('#rsvp-email').inputValue()) === 'guest@example.com');
  await sheet().locator('[data-r="submit"]').click();
  await settle(page, 400);
  check(g, 'Waitlist: confirmed as waitlist, not a place', (await sheet().textContent()).includes('You’re on the waitlist (demo)'));
  await sheet().locator('[data-action="close-sheet"]').first().click();
  await settle(page);
  await page.goBack();
  await settle(page);

  // Invitation only: a request, never self-granted access.
  await top().locator('.fixture', { hasText: 'private viewing' }).click();
  await settle(page);
  await primary().click();
  await settle(page);
  check(g, 'Invite-only: asks for no +1', (await sheet().locator('[data-g]').count()) === 0);
  await sheet().locator('[data-r="submit"]').click();
  await settle(page, 400);
  const req = await sheet().textContent();
  check(g, 'Invite-only: a request, checked by MAXHOSA', req.includes('Invitation requested (demo)') && !req.includes('Add to calendar'));
  await sheet().locator('[data-action="close-sheet"]').first().click();
  await settle(page);
  await page.goBack();
  await settle(page);

  // Stay in the loop: every fixture in one file; follow with consent.
  const all = await readDownload(() => top().locator('[data-ev="ics-all"]').click());
  const upcoming = await page.evaluate(() => window.MX_DATA.events.filter((e) => e.startsInDays >= 0).length);
  check(g, 'Add all fixtures: one file with every upcoming event', (all.text.match(/BEGIN:VEVENT/g) || []).length === upcoming, `${upcoming} events`);
  await top().locator('[data-ev="follow"]').click();
  await settle(page);
  const consent = await sheet().textContent();
  await sheet().locator('[data-yes]').click();
  await settle(page);
  check(
    g,
    'Following fixtures asks first, as marketing',
    consent.includes('This is marketing') && (await top().locator('[data-ev="follow"]').getAttribute('aria-checked')) === 'true',
  );
  const narrow = await top().locator('.scroller').evaluate((el) => el.scrollWidth - el.clientWidth);
  check(g, 'Events screen has no sideways scroll', narrow <= 0, `${narrow}px`);
  await page.goBack();
  await settle(page);

  // Account keeps your events together.
  await page.click('.tab[data-tab="account"]');
  check(g, 'Account counts your RSVPs', (await page.locator('#tab-account [data-action="open-my-events"]').textContent()).includes('3 RSVPs'));
  await page.locator('#tab-account [data-action="open-my-events"]').click();
  await settle(page);
  check(g, 'My events lists going, waitlist and requested', (await top().locator('.fixture').count()) === 3);
  await page.goBack();
  await settle(page);

  // The small phone: the calendar still fits.
  await page.setViewportSize({ width: 320, height: 640 });
  await page.click('.tab[data-tab="discover"]');
  await page.locator('#tab-discover [data-action="open-events"]').first().click();
  await settle(page);
  const small = await top().evaluate((el) => {
    const sc = el.querySelector('.scroller');
    const cell = el.querySelector('.cal-cell[data-day]').getBoundingClientRect();
    return { over: sc.scrollWidth - sc.clientWidth, cellH: cell.height };
  });
  check(g, 'Calendar fits 320px with 44px day targets', small.over <= 0 && small.cellH >= 44, `${small.over}px, ${small.cellH}px`);
  await shot(page, 'small-events-calendar');

  check(g, 'no console errors during the events journey', problems.console.length === 0, problems.console.slice(0, 2).join(' | '));
  check(g, 'no network requests during the events journey', problems.blocked.length === 0, problems.blocked.slice(0, 2).join(', '));
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
