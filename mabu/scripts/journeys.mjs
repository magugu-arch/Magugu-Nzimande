/**
 * End-to-end journeys through the real UI against the in-app mock back end
 * (brief §28 TESTING: E2E booking, voucher and event flows; §48 gates).
 *
 *   npm run export:web && npm run e2e
 *
 * Each journey starts as a brand-new guest in a fresh browser — nothing
 * seeded, no stored session — because a first visit is the journey the brief
 * cares most about ("a new guest can open the app and reach the reservation
 * flow from Home immediately").
 */
import { fillSignIn, signIn, startWeb } from './lib/web.mjs';

const { base, browser, stop } = await startWeb();
const results = [];

async function journey(name, fn) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const started = Date.now();
  try {
    await fn(page);
    if (errors.length) throw new Error(`page errors: ${errors.join(' | ')}`);
    results.push({ name, ok: true });
    console.log(`✓ ${name} (${Date.now() - started}ms)`);
  } catch (error) {
    results.push({ name, ok: false });
    console.log(`✗ ${name}\n    ${String(error).split('\n')[0]}`);
    await page
      .screenshot({ path: `.shots/journey-failed-${name.replace(/\W+/g, '-')}.png` })
      .catch(() => undefined);
  }
  await context.close();
}

const guestEmail = (tag) => `e2e.${tag}.${Date.now()}@example.com`;

/** A slot button: a time like 19:30 that the provider marked available. */
async function pickFirstTime(page) {
  const slot = page.getByRole('button', { name: /^\d\d:\d\d$/ }).first();
  await slot.waitFor({ timeout: 10_000 });
  await slot.click();
}

await journey('Home → table in two taps, then book as a new guest', async (page) => {
  await page.goto(`${base}/home`, { waitUntil: 'networkidle' });
  await page.getByTestId('home-book').click(); // tap 1
  await pickFirstTime(page); // tap 2: a provider-confirmed time is on screen
  await page.getByTestId('book-continue').click();
  await page.getByRole('button', { name: 'Anniversary' }).click();
  await page.getByLabel('Dietary needs').fill('No shellfish');
  await page.getByTestId('details-continue').click();
  await page.getByTestId('review-confirm').click(); // not signed in → sign-in
  await fillSignIn(page, guestEmail('book'), 'Amara Dube');
  await page.getByLabel('Mobile').fill('082 555 0199');
  await page.getByTestId('review-confirm').click();
  await page.getByText('Your table at Mábu is reserved.').waitFor({ timeout: 10_000 });
  await page.getByText('No shellfish').waitFor();

  // Manage: the booking is in the profile, and cancels cleanly.
  await page.goto(`${base}/profile/bookings`, { waitUntil: 'networkidle' });
  await page.getByText('Confirmed').first().click();
  await page.getByRole('button', { name: 'Cancel booking' }).click();
  await page.getByRole('button', { name: 'Yes, cancel my booking' }).click();
  await page.getByRole('button', { name: 'Book another table' }).waitFor({ timeout: 10_000 });
});

await journey('Double-tapping confirm books one table', async (page) => {
  await signIn(page, base, guestEmail('double'), 'Sipho Khumalo');
  await page.goto(`${base}/book`, { waitUntil: 'networkidle' });
  await pickFirstTime(page);
  await page.getByTestId('book-continue').click();
  await page.getByTestId('details-continue').click();
  await page.getByLabel('Mobile').fill('0825550177');
  // Wait for the button to be ready (it holds while the profile autofills), then tap twice.
  const confirm = page.locator('[data-testid="review-confirm"]:not([aria-disabled="true"])');
  await confirm.waitFor();
  // RN Web's Pressable adopts a new onPress one frame after the render that
  // enables it; no person taps inside that frame, but Playwright can.
  await page.waitForTimeout(250);
  await Promise.all([confirm.click(), confirm.click({ force: true }).catch(() => undefined)]);
  await page.getByText('Your table at Mábu is reserved.').waitFor({ timeout: 10_000 });
  await page.goto(`${base}/profile/bookings`, { waitUntil: 'networkidle' });
  const count = await page.getByText('Table for 2').count();
  if (count !== 1) throw new Error(`expected 1 booking, found ${count}`);
});

await journey('Buy a gift voucher and see its code and QR', async (page) => {
  await signIn(page, base, guestEmail('voucher'), 'Naledi Mokoena');
  await page.goto(`${base}/vouchers/new`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'R1\u00A0500' }).click();
  await page.getByLabel('Their name').fill('Thabo');
  await page.getByLabel('Their email').fill('thabo@example.com');
  await page.getByLabel('Personal message').fill('Happy birthday!');
  await page.getByTestId('voucher-buy').click();
  await page
    .getByText(/MABU-\w{4}-\w{4}/)
    .first()
    .waitFor({ timeout: 10_000 });
  await page.getByRole('img', { name: /Voucher QR code/ }).waitFor();
});

await journey('A declined voucher payment takes nothing and can be retried', async (page) => {
  await signIn(page, base, guestEmail('decline'), 'Lindiwe Zulu');
  await page.goto(`${base}/vouchers/new`, { waitUntil: 'networkidle' });
  await page.getByRole('tab', { name: 'Myself' }).click();
  await page.getByRole('radio', { name: /^Decline/ }).click();
  await page.getByTestId('voucher-buy').click();
  await page
    .getByText(/declined/i)
    .first()
    .waitFor({ timeout: 10_000 });
  await page.getByRole('radio', { name: /^Approve/ }).click();
  await page.getByTestId('voucher-buy').click();
  await page
    .getByText(/MABU-\w{4}-\w{4}/)
    .first()
    .waitFor({ timeout: 10_000 });
});

await journey('Reserve places at the Meerlust Wine Pairing', async (page) => {
  await signIn(page, base, guestEmail('event'), 'Kagiso Molefe');
  await page.goto(`${base}/events/evt-meerlust-2026-10-27`, { waitUntil: 'networkidle' });
  await page.getByTestId('event-reserve').click();
  await page.getByTestId('event-pay').click();
  await page.getByText('Your place is reserved.').waitFor({ timeout: 10_000 });
});

await journey('A sold-out event offers the waitlist without charging', async (page) => {
  await signIn(page, base, guestEmail('waitlist'), 'Zanele Mthembu');
  await page.goto(`${base}/events/evt-chefs-table-2026-11`, { waitUntil: 'networkidle' });
  await page.getByTestId('event-reserve').click();
  await page.getByTestId('event-pay').click();
  await page.getByText('You are on the waitlist.').waitFor({ timeout: 10_000 });
});

await journey('Join Rewards; the demo guest redeems a reward and sees a code', async (page) => {
  await signIn(page, base, guestEmail('rewards'), 'Bongani Ndlovu');
  await page.goto(`${base}/rewards`, { waitUntil: 'networkidle' });
  await page.getByTestId('rewards-join').click();
  await page.getByText(/points to spend/).waitFor({ timeout: 10_000 });

  await signIn(page, base, 'demo@mabu.app');
  await page.goto(`${base}/rewards/rw-amuse`, { waitUntil: 'networkidle' });
  await page.getByTestId('reward-redeem').click();
  await page.getByTestId('reward-confirm').click();
  await page
    .getByText(/RW-\w{6}/)
    .first()
    .waitFor({ timeout: 10_000 });
});

await journey('Notification preferences keep booking messages on', async (page) => {
  await signIn(page, base, guestEmail('prefs'), 'Ayanda Sithole');
  await page.goto(`${base}/notifications/preferences`, { waitUntil: 'networkidle' });
  const booking = page.getByRole('switch', { name: 'Booking & service updates' });
  if (!(await booking.isDisabled())) throw new Error('booking updates can be switched off');
  await page.getByRole('switch', { name: 'News & promotions' }).click();
  await page.getByText(/Consent given/).waitFor({ timeout: 10_000 });
});

await journey('Staff find a guest by name in reservations and the CRM', async (page) => {
  await signIn(page, base, 'admin@mabu.demo');
  await page.goto(`${base}/admin/reservations`, { waitUntil: 'networkidle' });
  await page.getByLabel('Search').fill('Lerato');
  const row = page.getByRole('button', { name: /Lerato Mokoena/ }).first();
  await row.waitFor({ timeout: 10_000 });
  await page.goto(`${base}/admin/guests`, { waitUntil: 'networkidle' });
  await page.getByText('demo@mabu.app').waitFor({ timeout: 10_000 });
});

await stop();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} journeys passed`);
process.exit(failed.length ? 1 : 0);
