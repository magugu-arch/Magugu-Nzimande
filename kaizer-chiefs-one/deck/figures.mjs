/**
 * Every commercial figure in the deck, in one place. Change a number here and
 * rebuild: prices, totals, VAT, milestones and the payback table all follow.
 *
 * These are estimates for a proposal, not club figures. Effort is in
 * person-days for a senior team at the hourly rate below (the rate used in
 * the agency's current proposals).
 */
export const RATE_PER_HOUR = 690;
export const HOURS_PER_DAY = 8;
export const DAY_RATE = RATE_PER_HOUR * HOURS_PER_DAY;
export const VAT = 0.15;
export const DATED = '11 November 2026';
export const VALID_UNTIL = '11 December 2026';

/** Estimated monthly running cost at launch volumes, and the figure used in the sums. */
export const RUN_LOW = 25_000;
export const RUN_HIGH = 60_000;
export const RUN_PLANNING = 40_000;

/** The recommended edition, itemised. [deliverable, what it covers, days] */
export const FAMILY_ITEMS = [
  ['Discovery and provider confirmation', 'Ends in a go / re-scope decision at week 3', 12],
  ['Brand system from the club’s CI', 'Approved crest, palette, type, app icon, store art', 10],
  ['Identity, profiles and consent', 'Sign-in, POPIA consent per channel, account deletion', 18],
  ['Content and CMS integration', 'News, stories, video, editorial approval', 16],
  ['Match Centre and licensed data feed', 'Fixtures, results, squad, live match events', 24],
  ['Tickets and wallet', 'Ticketing partner integration, entry codes, transfers', 26],
  ['Digital membership', 'Verified against the club’s system, digital card', 18],
  ['Khosi Rewards and partner offers', 'Earn, redeem, expire, reverse; partner permissions', 22],
  ['Fan Moments and moderation', 'Consent-first uploads, review queue, safeguarding', 16],
  [
    'Notifications and lifecycle journeys',
    'Push, in-app, email; caps, quiet hours, suppression',
    18,
  ],
  ['Shop integration', 'Catalogue and checkout handoff to the official store', 12],
  ['Staff console', 'Content, campaigns, moderation, roles, audit log', 20],
  ['Campaign pages and attribution', 'Tracked links, QR codes, holdout groups, reporting', 14],
  ['iOS and Android release', 'Native builds, store listings, review', 12],
  [
    'Quality, accessibility, security, load',
    'Devices, screen readers, penetration and peak tests',
    20,
  ],
  [
    'Launch kit, hypercare and handover',
    'Stadium QR kit, briefing, 30 days of fixes, training',
    18,
  ],
];

const sum = (xs) => xs.reduce((a, b) => a + b, 0);
const roundTo = (n, step) => Math.round(n / step) * step;
const price = (days) => roundTo(days * DAY_RATE, 5000);

export const EDITIONS = {
  matchday: { name: 'Matchday', days: 154, weeks: 16 },
  family: { name: 'Family', days: sum(FAMILY_ITEMS.map((i) => i[2])), weeks: 24 },
  nation: { name: 'Nation', days: 366, weeks: 32 },
};
for (const e of Object.values(EDITIONS)) e.price = price(e.days);

export const FAMILY = {
  ...EDITIONS.family,
  hours: EDITIONS.family.days * HOURS_PER_DAY,
  subtotal: EDITIONS.family.days * DAY_RATE,
  rounding: EDITIONS.family.price - EDITIONS.family.days * DAY_RATE,
  vat: Math.round(EDITIONS.family.price * VAT),
  gateWeek: 3,
  pilotWeek: 18,
  hypercareEndWeek: 28,
};

/** Milestone payments: [milestone, when, share]. */
export const MILESTONES = [
  ['On signature', 'Discovery starts', 0.3],
  ['Closed pilot on a test build', `Week ${FAMILY.pilotWeek}`, 0.3],
  ['Public launch, both stores', `Week ${FAMILY.weeks}`, 0.3],
  ['After 30 days of hypercare', `Week ${FAMILY.hypercareEndWeek}`, 0.1],
].map(([name, when, share]) => ({ name, when, share, amount: Math.round(FAMILY.price * share) }));

/** Cost of ownership at the planning figure. */
export const RUN_YEAR = RUN_PLANNING * 12;
export const YEAR_ONE = FAMILY.price + RUN_YEAR;
export const THREE_YEARS = FAMILY.price + RUN_YEAR * 3;

/**
 * Payback: the contribution each known supporter needs to add per year to
 * recover the build plus running costs over the period.
 */
export const PAYBACK_SUPPORTERS = [50_000, 100_000, 250_000];
export const PAYBACK_MONTHS = [12, 24, 36];
export const payback = (supporters, months) =>
  (FAMILY.price + RUN_PLANNING * months) / (months / 12) / supporters;
export const MIDDLE = payback(100_000, 12);

/** Formatting. Thousands are separated by a non-breaking space: R1 525 000. */
export const rand = (n) => `R${Math.round(n).toLocaleString('en-US').replace(/,/g, ' ')}`;
export const num = (n) => Math.round(n).toLocaleString('en-US').replace(/,/g, ' ');

/** The sums the deck states in words. A wrong edit fails the build here. */
export function checkFigures() {
  const problems = [];
  const expect = (ok, msg) => ok || problems.push(msg);
  expect(FAMILY.days === 276, `Family edition is ${FAMILY.days} days; the deck says 276`);
  expect(FAMILY.price === 1_525_000, `Family price is ${FAMILY.price}; the deck says R1 525 000`);
  expect(EDITIONS.matchday.price === 850_000, `Matchday price is ${EDITIONS.matchday.price}`);
  expect(EDITIONS.nation.price === 2_020_000, `Nation price is ${EDITIONS.nation.price}`);
  expect(sum(MILESTONES.map((m) => m.amount)) === FAMILY.price, 'Milestones do not add up');
  expect(Math.abs(sum(MILESTONES.map((m) => m.share)) - 1) < 1e-9, 'Milestone shares are not 100%');
  expect(
    Math.round(MIDDLE) === 20,
    `Middle case is R${MIDDLE.toFixed(2)}; the deck says about R20`,
  );
  expect(MIDDLE / 12 < 2, 'Middle case is not under R2 a month');
  expect(RUN_PLANNING >= RUN_LOW && RUN_PLANNING <= RUN_HIGH, 'Planning figure outside the range');
  expect(FAMILY_ITEMS.length === 16, 'The costing slide is laid out for 16 items');
  if (problems.length) throw new Error(`Figures check failed:\n  ${problems.join('\n  ')}`);
}
