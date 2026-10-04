#!/usr/bin/env node
/**
 * The brief §26 pitch journey, end to end, in a real browser against the web
 * export and the mock adapters:
 *
 *   1  sign in once                  8  order lunch from campus commerce
 *   2  see today                     9  receive the pickup notification
 *   3  open the class               10  discover an event
 *   4  map to the classroom         11  book a ticket
 *   5  check fees                   12  graduate → alumni
 *   6  check (and book) the library 13  receive a mentoring opportunity
 *   7  check the shuttle            14  discover bursary giving (and give)
 *
 * Every step is a tap a presenter would make; nothing navigates by URL after
 * sign-in. A screenshot is kept per step in .e2e/journey/. Fails on any page
 * error or console error.
 *
 *   npm run export:web   (EXPO_PUBLIC_MOCK_ORDER_READY_SECONDS=5 keeps it quick)
 *   npm run e2e
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { launch, root, see, serve, shot, tap, visible } from './lib/web.mjs';

const out = join(root, '.e2e', 'journey');
mkdirSync(out, { recursive: true });

const server = await serve();
const { browser, page, errors } = await launch();
let step = 0;

async function check(name, fn) {
  step += 1;
  const label = `${String(step).padStart(2, '0')}-${name}`;
  try {
    await fn();
    await page.waitForTimeout(400);
    await shot(page, out, label);
    console.log(`✓ ${label}`);
  } catch (e) {
    await shot(page, out, `${label}-FAILED`);
    throw new Error(`${label}: ${e.message.split('\n')[0]}`);
  }
}

const back = () => tap(page, 'header-back');
const tab = (name) => tap(page, `tab-${name}`);

try {
  await page.goto(`${server.url}/`);

  await check('sign-in', async () => {
    await see(page, 'One sign-in');
    await tap(page, 'sso-sign-in');
    await visible(page, 'home').waitFor();
  });

  await check('see-today', async () => {
    await see(page, 'Good morning, Thandi');
    await see(page, 'Marketing Management');
    await see(page, 'NSFAS allowance payment delayed');
  });

  await check('open-class', async () => {
    await tap(page, 'next-class-card');
    await visible(page, 'class-detail').waitFor();
    await see(page, 'Room changed to EB212');
  });

  await check('map-to-classroom', async () => {
    await tap(page, 'class-directions');
    await visible(page, 'route-card').waitFor();
    await see(page, 'Business & Economics Building');
    await see(page, 'Take the stairs or lift to level 2');
    await back();
    await back();
    await visible(page, 'home').waitFor();
  });

  await check('check-fees', async () => {
    await tap(page, 'money-tile');
    await visible(page, 'balance-card').waitFor();
    await see(page, 'R4,250.00');
    await see(page, 'October living allowance delayed');
    await back();
  });

  await check('check-library', async () => {
    await tap(page, 'quick-study-space');
    await visible(page, 'library').waitFor();
    const slot = page.locator('[data-testid^="slot-"]').first();
    await slot.waitFor();
    await slot.click();
    await tap(page, 'booking-confirm');
    await visible(page, 'booking-confirmed').waitFor();
    await tap(page, 'booking-done');
    await back();
  });

  await check('check-shuttle', async () => {
    await tap(page, 'shuttle-tile');
    await visible(page, 'transport').waitFor();
    await see(page, 'South ↔ North Campus');
    await see(page, 'Route B running late');
    await back();
  });

  await check('order-lunch', async () => {
    await tap(page, 'quick-order-food');
    await visible(page, 'dining').waitFor();
    await tap(page, 'vendor-campus-kitchen');
    await tap(page, 'add-ck-bowl-chicken');
    await tap(page, 'view-cart');
    await see(page, 'R62.00');
    await tap(page, 'cart-pay');
    await tap(page, 'pay-confirm');
    await visible(page, 'order').waitFor({ timeout: 20_000 });
    await visible(page, 'pickup-code').waitFor();
  });

  await check('pickup-notification', async () => {
    const banner = visible(page, 'in-app-banner');
    await banner.waitFor({ timeout: 40_000 });
    await see(page, 'Your order is ready for pickup');
    await visible(page, 'order-status').getByText('Ready for pickup').waitFor({ timeout: 10_000 });
  });

  await check('discover-event', async () => {
    await tap(page, 'order-home');
    await visible(page, 'home').waitFor();
    const discover = visible(page, 'discover-event');
    await discover.scrollIntoViewIfNeeded();
    await discover.click();
    await visible(page, 'event-detail').waitFor();
    await see(page, 'Spring Sounds on the Lawn');
  });

  await check('book-ticket', async () => {
    await tap(page, 'get-ticket');
    await tap(page, 'confirm-ticket');
    await visible(page, 'ticket-card').waitFor();
    await visible(page, 'ticket-code').waitFor();
  });

  await check('graduate', async () => {
    await tap(page, 'ticket-done');
    await visible(page, 'event-detail').waitFor();
    await back();
    await visible(page, 'home').waitFor();
    await tab('profile');
    await tap(page, 'profile-graduation');
    await visible(page, 'graduation').waitFor();
    await tap(page, 'continue-as-alumni');
    await tap(page, 'confirm-alumni');
    await visible(page, 'home').waitFor();
    await see(page, 'Welcome to the alumni community, Thandi');
  });

  await check('mentoring-opportunity', async () => {
    // Delivered a few seconds after graduation, as a banner and on Home.
    await see(page, 'Mentoring opportunity in digital marketing', 30_000);
    await tap(page, 'mentoring-card');
    await visible(page, 'mentoring').waitFor();
    await tap(page, 'mentoring-accept');
    await see(page, 'You’re matched');
    await back();
  });

  await check('bursary-giving', async () => {
    const giving = visible(page, 'giving-card');
    await giving.scrollIntoViewIfNeeded();
    await giving.click();
    await visible(page, 'give').waitFor();
    await tap(page, 'amount-250');
    await tap(page, 'give-continue');
    await tap(page, 'pay-confirm');
    await visible(page, 'give-thanks').waitFor({ timeout: 20_000 });
  });

  if (errors.length) throw new Error(`Browser errors during the journey:\n${errors.join('\n')}`);
  console.log(`\nPitch journey passed: ${step} steps. Screenshots in ${out}`);
} catch (e) {
  console.error(`\n✗ ${e.message}`);
  if (errors.length) console.error(errors.slice(0, 10).join('\n'));
  process.exitCode = 1;
} finally {
  await browser.close();
  await server.close();
}
