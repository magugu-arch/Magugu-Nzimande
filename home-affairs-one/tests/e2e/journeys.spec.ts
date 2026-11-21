import { expect, test } from '@playwright/test';
import { signInAs } from './helpers';

test.describe('getting in', () => {
  test('a visitor reads the welcome page, signs in and sees what needs attention', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('One trusted front door');
    await page.getByRole('link', { name: 'Sign in to the demo' }).click();

    await page.getByRole('button', { name: /Thandi M\./ }).click();
    await page.getByRole('button', { name: 'Continue with passkey' }).click();
    await expect(
      page.getByRole('status').filter({ hasText: 'Waiting for your device' }),
    ).toBeVisible();

    await page.waitForURL('**/home/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Thandi');
    await expect(page.getByRole('heading', { name: 'Replace a Smart ID' }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Choose a service point' })).toBeVisible();
    await expect(page.getByText('Identity status: Verified')).toBeVisible();
  });

  test('signing in with a one-time code gives basic access only', async ({ page }) => {
    await page.goto('/sign-in/');
    await page.getByRole('button', { name: /Thandi M\./ }).click();
    await page.getByRole('button', { name: 'Sign in with code' }).click();
    await expect(page.getByText('Enter the 6-digit code')).toBeVisible();

    await page.getByLabel('6-digit code').fill('123456');
    await page.getByRole('button', { name: 'Sign in with code' }).click();
    await page.waitForURL('**/home/');
    await expect(
      page.getByRole('heading', { name: 'Verify your account to see your applications' }),
    ).toBeVisible();
    await expect(page.getByText('Identity status: Basic account')).toBeVisible();
  });

  test('a private screen explains what is needed instead of showing nothing', async ({ page }) => {
    await page.goto('/home/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Sign in to see your home');
    await page.getByRole('link', { name: 'Sign in' }).last().click();
    await expect(page).toHaveURL(/\/sign-in\/\?next=/);
  });

  test('sign-in returns to the page that asked for it, and only to pages inside the app', async ({
    page,
  }) => {
    await page.goto('/sign-in/?next=https://example.org/elsewhere');
    await page.getByRole('button', { name: /Thandi M\./ }).click();
    await page.getByRole('button', { name: 'Continue with passkey' }).click();
    await page.waitForURL('**/home/');
  });
});

test.describe('preferences', () => {
  test('a larger text size is applied before the page paints, on every page', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() =>
      window.localStorage.setItem(
        'hao.prefs.v1',
        JSON.stringify({ textSize: 'larger', contrast: 'more' }),
      ),
    );
    for (const path of ['/', '/sign-in/']) {
      await page.goto(path);
      await expect(page.locator('html')).toHaveAttribute('data-text-size', 'larger');
      await expect(page.locator('html')).toHaveAttribute('data-contrast', 'more');
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(1);
    }
  });
});

test.describe('the prototype is never mistaken for the real thing', () => {
  test('every page is marked as a concept and asks not to be indexed', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('note', { name: 'About this prototype' })).toContainText(
      'Concept prototype',
    );
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    await signInAs(page, 'Thandi M.');
    await expect(page.getByRole('note', { name: 'About this prototype' })).toBeVisible();
  });
});
