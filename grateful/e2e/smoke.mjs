/**
 * End-to-end smoke test: starts the real dev server (in-memory database,
 * mock gateway, console mailer, sample prices), then in a real browser
 *   1. renders every page at 320, 390 and 1440px — no console errors,
 *      no horizontal scroll, no serious/critical axe accessibility issues;
 *   2. books a quote-required consultation and lands on the confirmation;
 *   3. books a paid service, pays a deposit through the mock checkout and
 *      waits for the verified webhook to confirm it.
 *
 *   npm run smoke            (set PW_CHROMIUM=/path/to/chrome to use a local browser)
 */
import AxeBuilder from '@axe-core/playwright';
import { chromium } from 'playwright';
import { createServer } from 'vite';

process.env.DEMO_PRICING = 'true';
process.env.MIN_NOTICE_HOURS = '0';

const PAGES = ['/', '/work', '/work/garment-study-01', '/about', '/services', '/booking', '/contact', '/privacy', '/nope'];
const failures = [];
const fail = (msg) => {
  failures.push(msg);
  console.error(`  ✗ ${msg}`);
};

const server = await createServer({ server: { port: 5199, strictPort: true }, logLevel: 'warn' });
await server.listen();
const base = 'http://localhost:5199';
const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});

async function newPage(width) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource.*(maps|google)/.test(m.text()) && page.errors.push(m.text()));
  return page;
}

try {
  // 1. Every page, two widths.
  for (const width of [320, 390, 1440]) {
    const page = await newPage(width);
    for (const path of PAGES) {
      await page.goto(base + path, { waitUntil: 'networkidle' });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      if (overflow) fail(`${path} @${width}: horizontal scroll`);
      const axe = await new AxeBuilder({ page }).exclude('iframe').analyze();
      for (const v of axe.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')) {
        fail(`${path} @${width}: axe ${v.id} (${v.impact}) — ${v.nodes.length} node(s): ${v.nodes[0]?.target.join(' ')}`);
      }
    }
    for (const e of page.errors) fail(`console @${width}: ${e}`);
    console.log(`  ✓ ${PAGES.length} pages rendered at ${width}px`);
    await page.close();
  }

  // 2 & 3. Book, then book and pay.
  async function book(page, serviceName) {
    await page.goto(`${base}/booking`, { waitUntil: 'networkidle' });
    await page.getByRole('radio', { name: new RegExp(serviceName) }).click();
    await page.waitForSelector('button[data-date]:not([disabled])');
    await page.locator('button[data-date]:not([disabled])').first().click();
    await page.locator('label:has(input[name=time])').first().click();
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.getByLabel('Full name', { exact: true }).fill('Smoke Test');
    await page.getByLabel('Email', { exact: true }).fill('smoke@example.com');
    await page.getByLabel('Phone', { exact: true }).fill('082 000 0000');
    await page.locator('form button[type=submit]').first().click();
    await page.waitForTimeout(1600); // the anti-bot timer wants a human pace
    await page.getByRole('button', { name: /Confirm Booking|Continue to Payment/ }).click();
  }

  const page = await newPage(390);
  await book(page, 'Consultation');
  await page.waitForURL(/\/(confirmation|payment)/);
  // With sample prices on, the consultation has a price too; either path must work.
  if (page.url().includes('/payment')) {
    await page.getByText('I have read and accept').click();
    await page.getByRole('button', { name: /Pay Securely/ }).click();
    await page.waitForURL(/payment\/mock/);
    await page.getByRole('button', { name: /successful/ }).click();
  }
  await page.getByText('journey begins').waitFor({ timeout: 15_000 });
  console.log('  ✓ booked and confirmed a consultation');

  await book(page, 'Custom Fashion Design');
  await page.waitForURL(/\/payment/);
  await page.getByText('Pay a deposit').click();
  await page.getByText('I have read and accept').click();
  await page.getByRole('button', { name: /Pay Securely/ }).click();
  await page.waitForURL(/payment\/mock/);
  await page.getByRole('button', { name: /successful/ }).click();
  await page.getByText('journey begins').waitFor({ timeout: 15_000 });
  if (!(await page.getByText(/Deposit paid/).count())) fail('paid booking: confirmation does not show the deposit');
  console.log('  ✓ booked, paid a deposit, and saw the verified confirmation');
  for (const e of page.errors) fail(`console (booking): ${e}`);
} catch (e) {
  fail(`journey failed: ${e instanceof Error ? e.message.split('\n')[0] : e}`);
} finally {
  await browser.close();
  await server.close();
}

if (failures.length) {
  console.error(`\n${failures.length} problem(s).`);
  process.exit(1);
}
console.log('\nSmoke test passed.');
