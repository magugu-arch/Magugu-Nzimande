import { expect, test } from '@playwright/test';
import { screensByPersona, signInAs, trackErrors } from './helpers';

/**
 * Every screen, for the person it is meant for, on a phone and a desktop:
 * it loads, has one main heading, carries the concept ribbon, fits the width,
 * finishes loading and throws no runtime errors.
 */
for (const [persona, screens] of screensByPersona()) {
  test(`screens render for ${persona ?? 'a signed-out visitor'}`, async ({ page }) => {
    test.setTimeout(120_000);
    const errors = trackErrors(page);
    if (persona) await signInAs(page, persona);

    for (const screen of screens) {
      await test.step(screen.name, async () => {
        const response = await page.goto(screen.path, { waitUntil: 'networkidle' });
        expect.soft(response?.status(), `${screen.name}: HTTP status`).toBe(200);
        await expect
          .soft(
            page.getByRole('status').filter({ hasText: /Loading|Checking/ }),
            `${screen.name}: still loading`,
          )
          .toHaveCount(0);
        await expect.soft(page.locator('h1'), `${screen.name}: exactly one h1`).toHaveCount(1);
        await expect
          .soft(
            page.getByRole('note', { name: 'About this prototype' }),
            `${screen.name}: concept ribbon`,
          )
          .toBeVisible();
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect.soft(overflow, `${screen.name}: horizontal overflow in px`).toBeLessThanOrEqual(1);
        await expect
          .soft(
            page.getByRole('heading', { name: 'Something went wrong', exact: true }),
            `${screen.name}: error state`,
          )
          .toHaveCount(0);
      });
    }
    expect.soft(errors, 'runtime errors').toEqual([]);
  });
}
