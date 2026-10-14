import { expect, test } from '@playwright/test';

test.describe('mobile menu', () => {
  test('opens as a dialog, traps focus, closes on Escape and returns focus', async ({ page }) => {
    await page.goto('/');
    const trigger = page.getByRole('button', { name: 'Open menu' });
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await trigger.click();

    const menu = page.getByRole('dialog', { name: 'Site menu' });
    await expect(menu).toBeVisible();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(menu.getByRole('button', { name: 'Close menu' })).toBeFocused();

    // The page behind is inert while the menu is open.
    await expect(page.locator('#site-shell')).toHaveAttribute('inert', '');

    // Shift+Tab from the first control wraps to the last one inside the menu.
    await page.keyboard.press('Shift+Tab');
    const focusedInside = await menu.evaluate((el) => el.contains(document.activeElement));
    expect(focusedInside).toBe(true);

    await page.keyboard.press('Escape');
    await expect(menu).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await expect(page.locator('#site-shell')).not.toHaveAttribute('inert', '');
  });

  test('navigates and closes when a link is chosen', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Open menu' }).click();
    const menu = page.getByRole('dialog', { name: 'Site menu' });
    await menu.getByRole('link', { name: 'Books' }).click();
    await expect(page).toHaveURL(/\/books$/);
    await expect(menu).toHaveCount(0);
  });

  test('can be swiped closed', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Open menu' }).click();
    const menu = page.getByRole('dialog', { name: 'Site menu' });
    await expect(menu).toBeVisible();
    await page.waitForTimeout(400); // let the entrance spring settle

    const box = (await menu.boundingBox())!;
    const y = box.y + 140;
    // A quick drag to the right, as a flick.
    await page.mouse.move(box.x + 40, y);
    await page.mouse.down();
    for (let i = 1; i <= 8; i++) {
      await page.mouse.move(box.x + 40 + i * 30, y);
      await page.waitForTimeout(8);
    }
    await page.mouse.up();
    await expect(menu).toHaveCount(0);

    // Regression: a drag that the browser ends without a click must not
    // leave the next real tap swallowed.
    await page.getByRole('button', { name: 'Open menu' }).click();
    await page
      .getByRole('dialog', { name: 'Site menu' })
      .getByRole('link', { name: 'Books' })
      .click();
    await expect(page).toHaveURL(/\/books$/);
  });

  test('pages never scroll sideways', async ({ page }) => {
    for (const path of [
      '/',
      '/about',
      '/events',
      '/speaking',
      '/learn',
      '/books/boss-moves',
      '/events/business-growth-workshop/book',
      '/cart',
    ]) {
      await page.goto(path);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, path).toBe(0);
    }
  });
});
