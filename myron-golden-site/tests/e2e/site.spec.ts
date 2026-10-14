import { expect, test } from '@playwright/test';

test.describe('pages', () => {
  test('home renders its hero, pathways and preview ribbon without errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Build the offers.');
    await expect(page.getByRole('link', { name: /Start with free training/ })).toHaveAttribute(
      'href',
      '/learn',
    );
    await expect(page.getByRole('link', { name: /Learn for free/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Preview/ })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('every primary route answers 200 and has a single h1', async ({ page }) => {
    for (const path of [
      '/about',
      '/work-with-myron',
      '/programs',
      '/programs/king-solomons-court',
      '/books',
      '/books/boss-moves',
      '/learn',
      '/learn/selling-as-service',
      '/insights',
      '/insights/purpose-at-work',
      '/events',
      '/events/offer-strategy-live-session',
      '/speaking',
      '/press',
      '/contact',
      '/login',
      '/privacy',
      '/terms',
      '/cookies',
      '/refunds',
      '/disclosures',
      '/thank-you',
      '/review',
    ]) {
      const res = await page.goto(path);
      expect(res?.status(), path).toBe(200);
      await expect(page.locator('h1'), path).toHaveCount(1);
    }
  });

  test('unknown pages get a helpful 404', async ({ page }) => {
    const res = await page.goto('/this-does-not-exist');
    expect(res?.status()).toBe(404);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'This page has left the stage',
    );
    await expect(page.getByRole('link', { name: 'Search the site' })).toBeVisible();
  });

  test('preview deployments are closed to crawlers', async ({ page, request }) => {
    const robots = await (await request.get('/robots.txt')).text();
    expect(robots).toMatch(/Disallow: \//);
    await page.goto('/');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  });

  test('book mock-ups are labelled as placeholders wherever they appear', async ({ page }) => {
    await page.goto('/books/boss-moves');
    await expect(page.getByText('Placeholder mock-up — not the official cover')).toBeVisible();
  });

  test('official links carry UTM parameters and open in a new tab', async ({ page }) => {
    await page.goto('/programs/make-more-offers-challenge');
    const cta = page.getByRole('link', { name: /See current dates/ }).first();
    await expect(cta).toHaveAttribute('target', '_blank');
    const href = await cta.getAttribute('href');
    const url = new URL(href!);
    expect(url.hostname).toBe('www.makemoreofferschallenge.com');
    expect(url.searchParams.get('utm_campaign')).toBe('program-make-more-offers-challenge');
  });
});

test.describe('events', () => {
  test('switches between upcoming and past and filters by format', async ({ page }) => {
    await page.goto('/events');
    const panel = page.locator('#events-panel');
    await expect(panel.getByRole('heading', { name: 'Offer Strategy Live Session' })).toBeVisible();
    await expect(panel.getByRole('heading', { name: 'Business Growth Workshop' })).toBeVisible();

    await page.getByLabel('Format').selectOption('online');
    await expect(panel.getByRole('heading', { name: 'Business Growth Workshop' })).toHaveCount(0);

    await page.getByRole('tab', { name: /Past/ }).click();
    await expect(page.getByRole('tab', { name: /Past/ })).toHaveAttribute('aria-selected', 'true');
    await expect(
      panel.getByRole('heading', { name: 'Sales Conversations Masterclass' }),
    ).toBeVisible();
    await expect(panel.getByRole('heading', { name: 'Offer Strategy Live Session' })).toHaveCount(
      0,
    );
  });

  test('month view lists the month’s events', async ({ page }) => {
    await page.goto('/events');
    await page.getByRole('button', { name: 'Month view' }).click();
    await expect(page.locator('#events-panel h3').first()).toHaveText('November 2026');
    await page.getByRole('button', { name: 'Next month' }).click();
    await expect(page.locator('#events-panel h3').first()).toHaveText('December 2026');
  });

  test('a past event offers no registration', async ({ page }) => {
    await page.goto('/events/stage-presentation-intensive');
    await expect(page.getByText('This event has finished.')).toBeVisible();
    await expect(page.getByRole('link', { name: /^Register/ })).toHaveCount(0);
  });
});

test.describe('learning library', () => {
  test('filters by type and searches by word', async ({ page }) => {
    await page.goto('/learn');
    const grid = page.locator('main ul').last();
    await page.getByRole('button', { name: 'Articles' }).click();
    await expect(grid.getByRole('heading', { name: 'Purpose at work' })).toBeVisible();
    await expect(grid.getByRole('heading', { name: 'Selling as service' })).toHaveCount(0);

    await page.getByRole('button', { name: 'All types' }).click();
    await page.getByLabel('Search the library').fill('stewardship');
    await expect(
      grid.getByRole('heading', { name: 'Stewardship and money decisions' }),
    ).toBeVisible();
    await expect(grid.locator('h3')).toHaveCount(1);
  });

  test('a video without an official id says so instead of pretending to play', async ({ page }) => {
    await page.goto('/learn/selling-as-service');
    await page.getByRole('button', { name: /Play video/ }).click();
    await expect(page.getByRole('status')).toContainText('once the official upload is linked');
    await expect(page.locator('iframe')).toHaveCount(0);
  });
});

test.describe('search', () => {
  test('finds programs by keyword', async ({ page }) => {
    await page.goto('/search?q=offers');
    await expect(page.getByRole('status')).toContainText('for “offers”');
    await expect(page.getByRole('link', { name: /Make More Offers Challenge/ })).toBeVisible();
  });

  test('explains when nothing matches', async ({ page }) => {
    await page.goto('/search?q=zzzzqqq');
    await expect(page.getByText('Nothing found')).toBeVisible();
  });
});

test.describe('forms', () => {
  test('speaking enquiry shows every problem, then confirms without promising a booking', async ({
    page,
  }) => {
    await page.goto('/speaking');
    await page.getByRole('button', { name: 'Send enquiry' }).click();

    // Filter: Next.js renders its own (empty) route-announcer alert on every page.
    const summary = page.getByRole('alert').filter({ hasText: 'Some details need attention' });
    await expect(summary).toBeVisible();
    await expect(summary).toBeFocused();
    await expect(page.getByLabel('Your name')).toHaveAttribute('aria-invalid', 'true');

    await page.getByLabel('Your name').fill('Test Organiser');
    await page.getByLabel('Organisation').fill('Test Association');
    await page.getByLabel('Email').fill('organiser@example.com');
    await page.getByLabel('Country').fill('United States');
    await page.getByLabel('Event type').selectOption('Conference or keynote');
    await page.getByLabel('Format').selectOption('In person');
    await page.getByLabel('Requested date').fill('2027-04-15');
    await page.getByLabel('Time zone').fill('America/Chicago');
    await page.getByLabel('Venue, city or platform').fill('Dallas, TX');
    await page.getByLabel('Audience size').selectOption('200–500');
    await page.getByLabel('Session length').selectOption('30–60 minutes');
    await page.getByLabel('Audience', { exact: true }).fill('Small business owners');
    await page.getByLabel('Topic').fill('Making offers people want');
    await page.getByLabel(/I’m happy for the team/).check();
    await page.getByRole('button', { name: 'Send enquiry' }).click();

    const done = page.getByRole('status').filter({ hasText: 'Enquiry submitted' });
    await expect(done).toBeVisible();
    await expect(done).toContainText('This is not a booking');
    await expect(done).toContainText('Preview mode');
  });

  test('keeps what was typed when validation fails', async ({ page }) => {
    await page.goto('/contact');
    await page.getByLabel('Your name').fill('Keep Me');
    await page.getByRole('button', { name: 'Send message' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'need attention' })).toBeVisible();
    await expect(page.getByLabel('Your name')).toHaveValue('Keep Me');
  });

  test('contact topic is preselected from the link that sent you', async ({ page }) => {
    await page.goto('/contact?topic=press');
    await expect(page.getByLabel('What is this about?')).toHaveValue('press');
  });
});

test.describe('photo viewer', () => {
  test('opens, moves with the keyboard, closes on Escape and returns focus', async ({ page }) => {
    await page.goto('/about');
    const thumbs = page.getByRole('button', { name: 'Open larger view' });
    await thumbs.first().click();
    const dialog = page.getByRole('dialog', { name: 'Photo viewer' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/^1 \/ \d+$/)).toBeVisible();
    await page.keyboard.press('ArrowRight');
    await expect(dialog.getByText(/^2 \/ \d+$/)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(thumbs.nth(1)).toBeFocused();
  });
});
