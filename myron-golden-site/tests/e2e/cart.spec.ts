import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

/**
 * The book cart in the e2e state: a preview build, demo prices, no Stripe
 * key. Adding, changing, removing, clearing and undoing all work; checkout
 * stops before Stripe and says nothing was charged.
 */

const BOSS = '/books/boss-moves';
const TRASH = '/books/from-the-trash-man-to-the-cash-man';
const badge = (page: Page) => page.locator('[data-cart-count]').first();

async function add(page: Page, path: string, times = 1) {
  await page.goto(path);
  const button = page.getByRole('button', { name: 'Add to cart' });
  for (let i = 0; i < times; i++) await button.click();
}

test('adding a book confirms beside the button and counts in the header', async ({ page }) => {
  await page.goto(BOSS);
  await expect(page.getByText('Demo price').first()).toBeVisible();
  await expect(badge(page)).toBeHidden();
  await page.getByRole('button', { name: 'Add to cart' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Added. 1 in your cart.' }),
  ).toBeVisible();
  await expect(badge(page)).toHaveText('1');
  await page.getByRole('button', { name: 'Add to cart' }).click();
  await expect(badge(page)).toHaveText('2');
  await expect(page.getByRole('link', { name: 'Cart, 2 books' })).toBeVisible();

  // The cart survives a reload.
  await page.reload();
  await expect(badge(page)).toHaveText('2');
});

test('the cart changes quantities, removes, clears and undoes', async ({ page }) => {
  await add(page, BOSS, 2);
  await add(page, TRASH);
  await page.getByRole('link', { name: /^Cart,/ }).click();
  await expect(page).toHaveURL(/\/cart$/);

  const summary = page.getByRole('complementary', { name: 'Order summary' });
  await expect(summary).toContainText('Subtotal (3 books)');
  await expect(summary.locator('[aria-live]')).toHaveText('3 books, subtotal $60.00');
  await expect(page.getByText('Placeholder cover').first()).toBeVisible();

  await page.getByLabel('Quantity of B.O.S.S. Moves').selectOption('4');
  await expect(summary.locator('[aria-live]')).toHaveText('5 books, subtotal $100.00');
  await expect(badge(page)).toHaveText('5');

  await page.getByRole('button', { name: 'Remove From the Trash Man to the Cash Man' }).click();
  await expect(summary.locator('[aria-live]')).toHaveText('4 books, subtotal $80.00');

  await page.getByRole('button', { name: 'Clear cart' }).click();
  await expect(page.getByRole('heading', { name: 'Your cart is empty' })).toBeVisible();
  await expect(badge(page)).toBeHidden();
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(summary.locator('[aria-live]')).toHaveText('4 books, subtotal $80.00');
});

test('checkout continues to payment: details, card, declined, then paid', async ({ page }) => {
  await add(page, TRASH);
  await page.goto('/cart');
  await page.getByRole('button', { name: 'Check out' }).click();
  await expect(page).toHaveURL(/\/checkout\/demo$/);

  const form = page.locator('form[data-demo-checkout]');
  const pay = form.getByRole('button', { name: 'Pay $20.00' });
  await pay.click();
  const problems = page.getByRole('alert').filter({ hasText: 'need attention' });
  await expect(problems).toContainText('Email');
  await expect(problems).toContainText('ZIP code');

  await form.getByLabel('Email').fill('grace@example.com');
  await form.getByLabel('Full name').fill('Grace Hopper');
  await form.getByLabel('Address', { exact: true }).fill('1 Main Street');
  await form.getByLabel('City').fill('Dallas');
  await form.getByLabel('State').fill('TX');
  await form.getByLabel('ZIP code').fill('75201');
  await form.getByLabel('Expiry date').fill('1230');
  await form.getByLabel('Security code').fill('123');
  await form.getByLabel('Name on card').fill('Grace Hopper');

  // A real-looking card is refused before anything happens.
  await form.getByLabel('Card number').fill('4111111111111111');
  await expect(form.getByLabel('Card number')).toHaveValue('4111 1111 1111 1111');
  await pay.click();
  await expect(page.locator('#demo-card-error')).toContainText('only accepts test card numbers');

  // The declining test card fails the way a bank would.
  await form.getByRole('button', { name: '0002 … declines' }).click();
  await pay.click();
  await expect(page.locator('#demo-card-error')).toContainText('declined');
  await expect(badge(page)).toHaveText('1');

  await form.getByRole('button', { name: '4242 … succeeds' }).click();
  await pay.click();
  const done = page.getByRole('status').filter({ hasText: 'Payment complete' });
  await expect(done).toBeVisible();
  await expect(done).toContainText('Grace Hopper, 1 Main Street, Dallas, TX 75201');
  await expect(done).toContainText('From the Trash Man to the Cash Man × 1');
  await expect(badge(page)).toBeHidden();
});

test('the payment page has no accessibility violations', async ({ page }) => {
  await add(page, BOSS);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/cart');
  await page.getByRole('button', { name: 'Check out' }).click();
  await expect(page.getByRole('button', { name: 'Pay $20.00' })).toBeVisible();
  await page.getByRole('button', { name: 'Pay $20.00' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'need attention' })).toBeVisible();
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
    .analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes[0]?.target.join(' ')}`)).toEqual([]);
});

test('a cancelled checkout and an unknown order say nothing was charged', async ({ page }) => {
  await add(page, BOSS);
  await page.goto('/cart?checkout=cancelled');
  await expect(
    page.getByRole('status').filter({ hasText: 'Checkout was cancelled' }),
  ).toBeVisible();
  await page.goto('/orders/confirmed');
  await expect(
    page.getByRole('heading', { level: 1, name: 'We could not find that order' }),
  ).toBeVisible();
  await expect(page.getByText('Thank you for your order')).toHaveCount(0);
});

test('a cart with books has no accessibility violations', async ({ page }) => {
  await add(page, BOSS);
  await add(page, TRASH);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/cart');
  await expect(page.getByRole('button', { name: 'Check out' })).toBeVisible();
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
    .analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes[0]?.target.join(' ')}`)).toEqual([]);
});
