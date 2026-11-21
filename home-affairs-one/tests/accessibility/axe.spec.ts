import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { screensByPersona, signInAs } from '../e2e/helpers';

/**
 * Automated WCAG 2.2 A/AA checks on every screen. Automated checks find only a
 * share of accessibility problems; the manual script in
 * docs/runbooks/manual-accessibility-testing.md covers the rest.
 */
for (const [persona, screens] of screensByPersona()) {
  test(`no serious accessibility violations for ${persona ?? 'a signed-out visitor'}`, async ({
    page,
  }) => {
    test.setTimeout(180_000);
    if (persona) await signInAs(page, persona);

    for (const screen of screens) {
      await test.step(screen.name, async () => {
        await page.goto(screen.path, { waitUntil: 'networkidle' });
        const results = await new AxeBuilder({ page } as unknown as ConstructorParameters<
          typeof AxeBuilder
        >[0])
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
          .analyze();
        const serious = results.violations
          .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
          .map(
            (violation) =>
              `${violation.id} (${violation.nodes.length}): ${violation.nodes[0]?.target.join(' ') ?? ''}`,
          );
        expect.soft(serious, `${screen.name}: serious or critical violations`).toEqual([]);
      });
    }
  });
}
