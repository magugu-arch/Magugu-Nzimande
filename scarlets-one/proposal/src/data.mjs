// Every figure in the proposal comes from this file, and every total is
// computed and checked here. To re-price the proposal, change DAY_RATE or the
// days on a line and rebuild: the slides, charts and tables all follow.
//
// What is fact and what is assumption:
// - The scope and days are our estimate for the brief's full supporter app.
// - The day rate is the proposer's (see RATE_NOTE).
// - Running costs are allowances, to be replaced by supplier quotes.
// - The value model is illustrative. It uses no club figures.

export const TODAY = '21 November 2026';
export const PROPOSER = 'LegacyLeverage Creative Agency';

/* ----------------------------------------------------------------- the rate */

export const DAY_RATE = 250; // pounds, one senior person for one 8-hour day
export const HOURS_PER_DAY = 8;
/** Mid-market rate published on 17 November 2026 (keycurrency.co.uk). */
export const ZAR_PER_GBP = 22.35;
export const RATE_NOTE =
  'in line with the R690 an hour in our current proposals, at about R22 to £1';

/* -------------------------------------------------- the build, line by line */

/** The six disciplines, in the order the audit shows them. */
export const roles = [
  { id: 'lead', name: 'Product and delivery lead', short: 'Lead' },
  { id: 'design', name: 'Design and brand', short: 'Design' },
  { id: 'app', name: 'App engineering', short: 'App' },
  { id: 'data', name: 'Back end and integrations', short: 'Data' },
  { id: 'quality', name: 'Quality, accessibility, security', short: 'Quality' },
  { id: 'language', name: 'Content, Welsh and launch', short: 'Language' },
];

/** days: [lead, design, app, data, quality, language] */
export const deliverables = [
  {
    name: 'Discovery and provider confirmation',
    detail: 'Ends in a go / re-scope decision at week 3',
    phase: 'discover',
    days: [8, 3, 2, 4, 1, 0],
  },
  {
    name: 'Brand system from the club’s guidelines',
    detail: 'Approved crest, palette, type, app icon, store art',
    phase: 'foundations',
    days: [1, 9, 2, 0, 0, 0],
  },
  {
    name: 'Identity, profiles and consent',
    detail: 'Sign-in, UK GDPR consent per channel, young supporters',
    phase: 'foundations',
    days: [2, 4, 9, 8, 3, 0],
  },
  {
    name: 'Content, club hubs, Watch and Listen',
    detail: 'News and video; first team, women, academy, community',
    phase: 'foundations',
    days: [3, 6, 12, 8, 2, 3],
  },
  {
    name: 'Fixtures and Match Centre',
    detail: 'Licensed fixtures, results, live events, line-ups, table',
    phase: 'core',
    days: [3, 5, 14, 11, 3, 0],
  },
  {
    name: 'Tickets and verified attendance',
    detail: 'Official-seller handoff, ticket link, entry events',
    phase: 'core',
    days: [3, 3, 9, 12, 3, 0],
  },
  {
    name: 'Matchday planner and Parc y Scarlets guide',
    detail: 'Checklist, travel, meeting point, step-free routes, map',
    phase: 'core',
    days: [2, 6, 14, 4, 3, 1],
  },
  {
    name: 'Membership link and Scarlets Passport',
    detail: 'Verified against the club’s membership system',
    phase: 'core',
    days: [2, 4, 8, 8, 2, 0],
  },
  {
    name: 'YMLAEN rewards',
    detail: 'The club’s rules, ledger, benefits, redemptions, disputes',
    phase: 'core',
    days: [4, 4, 10, 13, 3, 0],
  },
  {
    name: 'Fan Zone and Fan Cam',
    detail: 'Predictor, polls, quiz, votes; consent and moderation',
    phase: 'engage',
    days: [2, 5, 13, 8, 3, 1],
  },
  {
    name: 'Notifications and lifecycle journeys',
    detail: 'Push and email; caps, quiet hours, opt-out',
    phase: 'engage',
    days: [3, 2, 6, 10, 2, 3],
  },
  {
    name: 'Shop and hospitality handoff',
    detail: 'Catalogue, checkout handoff, order status, enquiries',
    phase: 'engage',
    days: [1, 2, 7, 4, 2, 0],
  },
  {
    name: 'Partner World and sponsor reporting',
    detail: 'Labelled placements, offers, redemptions, reports',
    phase: 'engage',
    days: [3, 4, 9, 11, 2, 1],
  },
  {
    name: 'Club operations console',
    detail: 'Content, campaigns, moderation, roles, audit log',
    phase: 'engage',
    days: [3, 5, 16, 11, 3, 0],
  },
  {
    name: 'Cymraeg throughout',
    detail: 'Professional translation, club approval, bilingual testing',
    phase: 'engage',
    days: [2, 1, 5, 1, 3, 10],
  },
  {
    name: 'Campaign pages and attribution',
    detail: 'Tracked links, QR codes, holdout groups',
    phase: 'engage',
    days: [2, 3, 6, 7, 1, 1],
  },
  {
    name: 'Quality, accessibility, security, load',
    detail: 'Devices, screen readers, penetration and peak tests',
    phase: 'launch',
    days: [3, 2, 8, 5, 18, 0],
  },
  {
    name: 'Release, launch kit and hypercare',
    detail: 'iOS, Android and web; stadium QR kit; 30 days of fixes',
    phase: 'launch',
    days: [9, 2, 12, 5, 4, 4],
  },
].map((line, index) => {
  const total = line.days.reduce((sum, d) => sum + d, 0);
  return { ...line, no: String(index + 1).padStart(2, '0'), total, price: total * DAY_RATE };
});

export const phases = [
  { id: 'discover', name: 'Discover', weeks: 'Weeks 1 to 3' },
  { id: 'foundations', name: 'Design and foundations', weeks: 'Weeks 2 to 14' },
  { id: 'core', name: 'Matchday core', weeks: 'Weeks 4 to 20' },
  { id: 'engage', name: 'Engagement and commercial', weeks: 'Weeks 10 to 23' },
  { id: 'launch', name: 'Verify and launch', weeks: 'Weeks 24 to 34' },
].map((phase) => {
  const days = deliverables
    .filter((line) => line.phase === phase.id)
    .reduce((sum, line) => sum + line.total, 0);
  return { ...phase, days, price: days * DAY_RATE };
});

export const roleTotals = roles.map((role, index) => {
  const days = deliverables.reduce((sum, line) => sum + line.days[index], 0);
  return { ...role, days, price: days * DAY_RATE };
});

export const build = {
  days: deliverables.reduce((sum, line) => sum + line.total, 0),
  get hours() {
    return this.days * HOURS_PER_DAY;
  },
  get price() {
    return this.days * DAY_RATE;
  },
  get zar() {
    return this.price * ZAR_PER_GBP;
  },
};

/* ------------------------------------------------- timeline and payments */

export const timeline = {
  weeksToLaunch: 30,
  pilotWeek: 24,
  endWeek: 34,
  rows: [
    { name: 'Discovery and providers', note: 'Gate: go / re-scope', from: 1, to: 3, kind: 'gate' },
    { name: 'Brand system and design', from: 2, to: 7 },
    { name: 'Identity, content, Match Centre', from: 4, to: 14 },
    { name: 'Tickets, attendance, Passport, YMLAEN', from: 8, to: 19 },
    { name: 'Planner, stadium guide, Fan Zone', from: 10, to: 20 },
    { name: 'Partner World, journeys, console', from: 12, to: 22 },
    { name: 'Cymraeg: translation and review', from: 14, to: 23 },
    { name: 'Closed pilot on a test build', note: 'Milestone 2', at: 24, kind: 'mark' },
    { name: 'Quality, load and store review', from: 24, to: 29 },
    { name: 'Public launch on a home match', note: 'Milestone 3', at: 30, kind: 'mark' },
    { name: 'Hypercare, 30 days', note: 'Milestone 4', from: 31, to: 34, kind: 'soft' },
  ],
};

/** Hypercare is the last 12 days of the release line; the rest is done by launch. */
const HYPERCARE_DAYS = 12;
const doneBy = (ids) =>
  phases.filter((phase) => ids.includes(phase.id)).reduce((sum, phase) => sum + phase.days, 0);

export const payments = [
  { name: 'On signature', when: 'Discovery starts', share: 0.3, doneDays: 0 },
  {
    name: 'Closed pilot on a test build',
    when: 'Week 24',
    share: 0.3,
    doneDays: doneBy(['discover', 'foundations', 'core', 'engage']),
  },
  {
    name: 'Public launch, both stores',
    when: 'Week 30',
    share: 0.3,
    doneDays: build.days - HYPERCARE_DAYS,
  },
  { name: 'After 30 days of hypercare', when: 'Week 34', share: 0.1, doneDays: build.days },
].map((payment, index, all) => {
  const paidShare = all.slice(0, index + 1).reduce((sum, p) => sum + p.share, 0);
  return {
    ...payment,
    amount: payment.share * build.price,
    paidShare,
    doneShare: payment.doneDays / build.days,
  };
});

/* ------------------------------------------------------------ running costs */

export const running = [
  {
    name: 'Hosting, database, storage and backups',
    detail: 'A managed European region, in the club’s account',
    monthly: 290,
    kind: 'supplier',
  },
  {
    name: 'Push, email and text sending',
    detail: 'Charged by volume; this allows for a full matchday season',
    monthly: 240,
    kind: 'supplier',
  },
  {
    name: 'Monitoring, analytics and error tracking',
    detail: 'Uptime, crashes and the monthly numbers',
    monthly: 110,
    kind: 'supplier',
  },
  {
    name: 'Apple and Google developer accounts',
    detail: 'In the club’s name',
    monthly: 10,
    kind: 'supplier',
  },
  {
    name: 'Maintenance: updates, security, small fixes',
    detail: 'Three days a month',
    monthly: 3 * DAY_RATE,
    kind: 'team',
  },
  {
    name: 'Monthly report and campaign support',
    detail: 'Two days a month',
    monthly: 2 * DAY_RATE,
    kind: 'team',
  },
];
export const runningMonthly = running.reduce((sum, line) => sum + line.monthly, 0);
export const runningSuppliers = running
  .filter((line) => line.kind === 'supplier')
  .reduce((sum, line) => sum + line.monthly, 0);
export const runningTeam = runningMonthly - runningSuppliers;

export const ownership = [1, 2, 3].map((year) => ({
  year,
  build: year === 1 ? build.price : 0,
  running: runningMonthly * 12,
  cumulative: build.price + runningMonthly * 12 * year,
}));
export const threeYearCost = build.price + runningMonthly * 36;
export const yearOneCost = build.price + runningMonthly * 12;

/* ------------------------------------------------------- partner properties */

export const partners = [
  {
    name: 'Presenting partner of Scarlets One',
    gets: 'Partner-funded experiences across the app',
    proves: '“Presented by” credit; reach and engagement report',
    fee: 40_000,
  },
  {
    name: 'Scarlets Passport partner',
    gets: 'Rewards for turning up',
    proves: 'Milestone moments; redemptions and repeat visits',
    fee: 20_000,
  },
  {
    name: 'Matchday experience partner',
    gets: 'An easier arrival',
    proves: 'Planner and travel guide; plans completed',
    fee: 18_000,
  },
  {
    name: 'Fan Zone partner',
    gets: 'Predictor, quiz and votes',
    proves: 'The Fan Zone; players and entries',
    fee: 12_000,
  },
  {
    name: 'Family matchday partner',
    gets: 'A confident first family match',
    proves: 'First-match guide; attendance, with no targeting of children',
    fee: 10_000,
  },
  {
    name: 'Scarlets everywhere partner',
    gets: 'Kick-off in their time zone, watch parties',
    proves: 'Evenings for supporters away from West Wales; participation',
    fee: 10_000,
  },
];
export const partnerCases = {
  conservative: partners[2].fee + partners[3].fee,
  base: partners[0].fee + partners[1].fee + partners[2].fee,
  stretch: partners.reduce((sum, p) => sum + p.fee, 0),
};

/* ------------------------------------------------------------ the value model */

export const HOME_MATCHES = 11; // nine URC and two European pool matches
const TICKET_YIELD = 18;
const MEMBERSHIP_VALUE = 60;
const BASKET = 48;
const CLUB_SHARE = 0.25;
const MESSAGES = 24;
const MESSAGE_VALUE = 0.02;

const cases = {
  conservative: { extra: 150, members: 200, known: 10_000, buy: 0.03 },
  base: { extra: 350, members: 500, known: 20_000, buy: 0.04 },
  stretch: { extra: 700, members: 1_000, known: 35_000, buy: 0.05 },
};

export const valueLines = [
  {
    name: 'Extra tickets',
    short: 'Extra tickets',
    assumption: (c) => `${c.extra.toLocaleString('en-GB')}`,
    unit: 'a home match',
    value: (c) => c.extra * HOME_MATCHES * TICKET_YIELD,
    measured: 'Extra verified attendances',
    counted: 'Gate scans from the official seller, against a holdout group',
  },
  {
    name: 'Memberships and season tickets',
    short: 'Memberships',
    assumption: (c) => `${c.members.toLocaleString('en-GB')}`,
    unit: 'a season',
    value: (c) => c.members * MEMBERSHIP_VALUE,
    measured: 'Memberships linked and renewed',
    counted: 'The club’s own membership system',
  },
  {
    name: 'Store, club share',
    short: 'Store, club share',
    assumption: (c) => `${Math.round(c.buy * 100)}%`,
    unit: 'of known supporters buy',
    value: (c) => c.known * c.buy * BASKET * CLUB_SHARE,
    measured: 'App-attributed store orders',
    counted: 'Tracked links to the official store',
  },
  {
    name: 'Partners',
    short: 'Partners',
    assumption: (c, key) => ({ conservative: '2', base: '3', stretch: '6' })[key],
    unit: 'properties sold',
    value: (c, key) => partnerCases[key],
    measured: 'Partner reach and redemptions',
    counted: 'Partner reports, from view to verified redemption',
  },
  {
    name: 'Paid reach replaced',
    short: 'Paid reach replaced',
    assumption: (c) => `${c.known.toLocaleString('en-GB')}`,
    unit: 'known supporters',
    value: (c) => c.known * MESSAGES * MESSAGE_VALUE,
    measured: 'Supporters reachable with a yes',
    counted: 'Profiles with consent recorded per channel',
  },
].map((line) => ({
  ...line,
  cases: Object.fromEntries(
    Object.entries(cases).map(([key, c]) => [
      key,
      { value: Math.round(line.value(c, key)), assumption: line.assumption(c, key) },
    ]),
  ),
}));

export const seasonValue = Object.fromEntries(
  Object.keys(cases).map((key) => [
    key,
    valueLines.reduce((sum, line) => sum + line.cases[key].value, 0),
  ]),
);

export const valueFootnote =
  `Per full season live. Tickets: extra visits × ${HOME_MATCHES} home matches × £${TICKET_YIELD}. ` +
  `Memberships × £${MEMBERSHIP_VALUE}. Store: buyers × £${BASKET} basket × ${CLUB_SHARE * 100}% club share. ` +
  `Partners: rate card. Reach: known supporters × ${MESSAGES} messages × ${MESSAGE_VALUE * 100}p. ` +
  'Illustrative, not club figures or forecasts.';

/** Months after launch at which cumulative value, less running costs, repays the build. */
export const returns = Object.fromEntries(
  Object.keys(cases).map((key) => {
    const monthly = seasonValue[key] / 12 - runningMonthly;
    const threeSeasonValue = seasonValue[key] * 3;
    return [
      key,
      {
        monthly,
        paybackMonths: build.price / monthly,
        threeSeasonValue,
        net: threeSeasonValue - threeYearCost,
        perPound: threeSeasonValue / threeYearCost,
      },
    ];
  }),
);

/* ------------------------------------------------- what already exists */

export const audit = [
  {
    area: 'Supporter app',
    exists: '19 screens, light and dark, with 536 automated tests passing',
    adds: 'The club’s brand guidelines, licensed photography, real-device testing',
  },
  {
    area: 'Data and integrations',
    exists: '12 provider contracts, all running on labelled demo data',
    adds: 'Live connections to ticketing, match data, membership, rewards and content',
  },
  {
    area: 'Club operations console',
    exists: 'Content, fixtures, campaigns, moderation, roles and an audit log',
    adds: 'Club sign-in, production hosting, staff training',
  },
  {
    area: 'Database and security',
    exists: 'Schema, row-level security and retention rules, tested',
    adds: 'A production project, backups, a penetration test',
  },
  {
    area: 'Cymraeg',
    exists: 'Welsh on 56% of the interface, as an unreviewed draft',
    adds: 'Professional translation, club approval, bilingual testing',
  },
  {
    area: 'Accessibility',
    exists: 'Roles, labels and contrast set in code and tested',
    adds: 'VoiceOver and TalkBack passes; an independent WCAG 2.2 AA audit',
  },
  {
    area: 'iOS and Android',
    exists: 'Both bundles compile; the app runs in a browser from one 7.5 MB file',
    adds: 'Store builds, review and release; push notifications',
  },
  {
    area: 'Rewards',
    exists: 'A Passport with no invented points, tiers or values',
    adds: 'YMLAEN rules, ledger and redemptions, supplied by the club',
  },
];

/* ------------------------------------------------------------------- checks */

const assert = (condition, message) => {
  if (!condition) throw new Error(`proposal data: ${message}`);
};
const sum = (list, pick) => list.reduce((total, item) => total + pick(item), 0);

assert(build.days === 500, `expected 500 days, got ${build.days}`);
assert(build.price === 125_000, `expected £125,000, got ${build.price}`);
assert(sum(roleTotals, (r) => r.days) === build.days, 'disciplines do not add up to the build');
assert(sum(phases, (p) => p.days) === build.days, 'phases do not add up to the build');
assert(sum(deliverables, (d) => d.price) === build.price, 'lines do not add up to the price');
assert(Math.abs(sum(payments, (p) => p.share) - 1) < 1e-9, 'payments do not add up to 100%');
assert(sum(payments, (p) => p.amount) === build.price, 'payments do not add up to the price');
assert(
  ownership[2].cumulative === threeYearCost,
  'three-year cost does not match the yearly table',
);
assert(
  partnerCases.stretch === sum(partners, (p) => p.fee),
  'rate card does not match the stretch case',
);
