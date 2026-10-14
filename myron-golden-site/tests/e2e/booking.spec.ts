import { expect, test } from '@playwright/test';

/**
 * Booking in the state e2e runs in: a preview build with no Stripe key and no
 * webhooks. Paid bookings must stop before checkout and say nothing was
 * charged; requests and free registrations validate, log and say so.
 */

const PAID = '/events/business-growth-workshop';
const FREE = '/events/offer-strategy-live-session';

test('an event with booking shows its price and leads to the booking page', async ({ page }) => {
  await page.goto(PAID);
  const panel = page.locator('aside');
  await expect(panel.getByText('$100.00')).toBeVisible();
  await expect(panel.getByText('Demo price')).toBeVisible();
  await panel.getByRole('link', { name: 'Book seats' }).click();
  await expect(page).toHaveURL(new RegExp(`${PAID}/book$`));
  await expect(
    page.getByRole('heading', { level: 1, name: 'Business Growth Workshop' }),
  ).toBeVisible();
});

test('the seat stepper updates the total and stays within the order limit', async ({ page }) => {
  await page.goto(`${PAID}/book`);
  const fewer = page.getByRole('button', { name: 'One seat fewer' });
  const more = page.getByRole('button', { name: 'One seat more' });
  const total = page.locator('[data-booking-total]');

  await expect(fewer).toHaveAttribute('aria-disabled', 'true');
  await expect(total).toHaveText('$100.00');
  await more.click();
  await more.click();
  await expect(page.locator('#quantity')).toHaveValue('3');
  await expect(total).toHaveText('$300.00');

  // Typing past the limit settles back to the maximum when the field is left.
  await page.locator('#quantity').fill('40');
  await page.locator('#quantity').blur();
  await expect(page.locator('#quantity')).toHaveValue('6');
  await expect(more).toHaveAttribute('aria-disabled', 'true');
  await expect(total).toHaveText('$600.00');
});

test('a paid booking continues to the payment step and pays with a test card', async ({ page }) => {
  await page.goto(`${PAID}/book`);
  await page.getByRole('button', { name: /Continue to payment/ }).click();

  const summary = page.getByRole('alert').filter({ hasText: 'need attention' });
  await expect(summary).toBeVisible();
  await expect(summary).toContainText('Full name');
  await expect(summary).toContainText('Refund policy and terms');

  await page.getByLabel('Full name').fill('Ada Lovelace');
  await page.getByLabel('Email').fill('ada@example.com');
  await page.getByRole('button', { name: 'One seat more' }).click();
  await page.getByLabel(/I have read the/).check();
  await page.getByRole('button', { name: /Continue to payment/ }).click();

  await expect(page).toHaveURL(/\/checkout\/demo$/);
  const form = page.locator('form[data-demo-checkout]');
  await expect(form.getByRole('button', { name: 'Pay $200.00' })).toBeVisible();
  // Seats need no delivery address.
  await expect(form.getByText('Delivery', { exact: true })).toHaveCount(0);

  await form.getByLabel('Email').fill('ada@example.com');
  await form.getByRole('button', { name: '4242 … succeeds' }).click();
  await form.getByLabel('Expiry date').fill('1230');
  await form.getByLabel('Security code').fill('123');
  await form.getByLabel('Name on card').fill('Ada Lovelace');
  await form.getByRole('button', { name: 'Pay $200.00' }).click();

  const done = page.getByRole('status').filter({ hasText: 'Payment complete' });
  await expect(done).toBeVisible();
  await expect(done).toContainText('nothing was charged');
  await expect(done).toContainText('Business Growth Workshop — General admission × 2');
  await expect(done).toContainText(/MG-[A-Z2-9]{4}-[A-Z2-9]{4}/);

  // Going back to the event does not bounce to payment again.
  await done.getByRole('link', { name: 'Back to the event' }).click();
  await expect(page).toHaveURL(/\/events\/business-growth-workshop$/);
  await page.waitForTimeout(500);
  await expect(page).toHaveURL(/\/events\/business-growth-workshop$/);
});

test('free registration completes without any payment step', async ({ page }) => {
  await page.goto(`${FREE}/book`);
  await expect(page.locator('[data-booking-total]')).toHaveText('Free');
  await expect(page.getByRole('button', { name: /Continue to payment/ })).toHaveCount(0);
  await page.getByLabel('Full name').fill('Grace Hopper');
  await page.getByLabel('Email').fill('grace@example.com');
  await page.getByLabel(/I have read the/).check();
  await page.getByRole('button', { name: 'Complete registration' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Registration sent' })).toBeVisible();
});

test('past events and unknown checkouts never offer or confirm a booking', async ({ page }) => {
  const past = await page.goto('/events/stage-presentation-intensive/book');
  expect(past?.status()).toBe(404);

  await page.goto('/bookings/confirmed');
  await expect(
    page.getByRole('heading', { level: 1, name: 'We could not find that checkout' }),
  ).toBeVisible();
  await expect(page.getByText('Payment received')).toHaveCount(0);

  await page.goto('/bookings/cancelled');
  await expect(page.getByRole('heading', { level: 1, name: 'Nothing was charged' })).toBeVisible();
});
