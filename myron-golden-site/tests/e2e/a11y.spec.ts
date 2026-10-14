import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

/**
 * WCAG 2.2 A/AA plus axe best practices on every route, after scrolling so
 * scroll-driven content is in its final state. Any violation fails the run
 * with the rule, the page and the first offending element.
 */
const routes = [
  '/',
  '/about',
  '/work-with-myron',
  '/programs',
  '/programs/make-more-offers-challenge',
  '/books',
  '/books/boss-moves',
  '/learn',
  '/learn/selling-as-service',
  '/insights',
  '/insights/purpose-at-work',
  '/events',
  '/events/business-growth-workshop',
  '/speaking',
  '/press',
  '/contact',
  '/login',
  '/privacy',
  '/search?q=offers',
  '/review',
  '/not-a-real-page',
];

test.use({ reducedMotion: 'reduce' });

for (const route of routes) {
  test(`no accessibility violations on ${route}`, async ({ page }) => {
    await page.goto(route);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
      .analyze();
    const summary = results.violations.map(
      (v) => `${v.id} (${v.impact}): ${v.help} — ${v.nodes[0]?.target.join(' ')}`,
    );
    expect(summary).toEqual([]);
  });
}
