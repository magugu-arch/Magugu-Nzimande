import { readFileSync } from 'node:fs';
import path from 'node:path';

import { formatDateTime, formatRelativeDay, formatShortDate, formatTime } from '@/utils/datetime';
import { orderProgress } from '@/features/orders/timelineProgress';
import { priceFloor } from '@/features/menu/availability';
import { statusCopy } from '@/services/orderService';
import { timelineFor } from '@/features/orders/liveStatus';
import { voucherStandingCopy } from '@/features/rewards/voucherStanding';
import type { Order, OrderStatus, Product, Voucher } from '@/types';

const root = path.join(__dirname, '..');
const read = (file: string) => readFileSync(path.join(root, file), 'utf8');

const code = (file: string) =>
  read(file)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

/*
  ───────────────────────────────────────────────────────────────────────────
  The backend that sends exactly what it promised.

  `wireChecks.ts` says what it deliberately is not: a schema. It checks "the
  numbers it does arithmetic on, the ids it looks things up by" and nothing
  else, because a value the app only prints cannot do arithmetic wrong.

  That argument is sound and it has a gap. A value the app only prints can
  still be *absent*, and a screen that maps over an absent list does not print
  nothing — it throws, into the error boundary, and the customer reads
  "Something broke".

  Found by accident last round: a stub written to the checks left out
  `termsAndConditions` and the reward screen crashed. Accident is not a method.
  `npm run audit:sparse` is the method — serve every endpoint the minimum body
  the contract accepts, render every screen, and see what falls over. Ten
  distinct crashes, across five rounds of the sweep:

    /menu       priceFloor read optionGroups, which checkProduct itself
                writes as `?? []` — the contract said optional, the code did not
    /orders     timeline.filter, lines.map, lines[0], timeline.length
    /order/:id  timeline.filter, timelineFor, formatDateTime(placedAt)
    /rewards    perksFor spread tier.perks; account.history.map
    /vouchers   formatShortDate(expiresAt)

  The sharpest was in `utils/datetime`. All four formatters already answered
  `''` for a date they could not read — the right answer, and the guard had
  been there since they were written. It could not fire for an *absent* date:
  `typeof undefined` is not `'string'`, so the ternary handed `undefined`
  through as though it were a `Date` and `.getTime()` threw one line above the
  guard written for exactly that situation.

  Two of these were misses from the round before. A grep for `data.x.map(`
  found four instances and I fixed those four; the same fields were read as
  `.filter`, `.length` and `[0]` in five more places the grep never saw. The
  fix follows the sweep, and wherever the sweep never went the hole stayed
  open.
  ───────────────────────────────────────────────────────────────────────────
*/

/** What a backend is entitled to send: only what `wireChecks` demands. */
const SPARSE_ORDER = {
  id: 'order-sparse',
  etaMinutes: 40,
  totals: { subtotal: 149, deliveryFee: 32, serviceFee: 5, discount: 0, total: 186 },
} as unknown as Order;

/**
 * FIXTURE 1 — the formatters, which is where the class was widest.
 */
describe('1 — a date nobody sent', () => {
  const FORMATTERS: [string, (value: string | Date | null | undefined) => string][] = [
    ['formatTime', formatTime],
    ['formatShortDate', formatShortDate],
    ['formatDateTime', formatDateTime],
    ['formatRelativeDay', (value) => formatRelativeDay(value)],
  ];

  it.each(FORMATTERS)('%s answers nothing rather than throwing', (_name, format) => {
    expect(format(undefined)).toBe('');
    expect(format(null)).toBe('');
  });

  it.each(FORMATTERS)('%s still answers nothing for a date it cannot read', (_name, format) => {
    // The guard that was already there, kept: these two are different bugs and
    // the answer to both is the same silence.
    expect(format('not a date')).toBe('');
    expect(format(new Date('nonsense'))).toBe('');
  });

  it.each(FORMATTERS)('%s still formats a date it was given', (_name, format) => {
    expect(format('2026-08-21T12:35:00.000Z')).not.toBe('');
  });

  it('normalises in one place rather than at each call site', () => {
    // There are dozens of call sites and one of these. A guard per caller is
    // how four of them got missed.
    const datetime = code('src/utils/datetime.ts');

    expect(datetime).toMatch(/function instant\(value: string \| Date \| null \| undefined\)/);
    expect((datetime.match(/const date = instant\(value\);/g) ?? []).length).toBe(4);
    /*
      And the ternary that caused it survives in exactly one place — inside
      `instant`, where it is correct because the null check runs first. Written
      as a count rather than as "nowhere", which is what it said at first and
      which was wrong about the one legitimate use.
    */
    expect(
      (datetime.match(/typeof value === 'string' \? new Date\(value\) : value/g) ?? []).length,
    ).toBe(1);
  });
});

/**
 * FIXTURE 2 — the lists the contract does not promise.
 */
describe('2 — a list nobody sent', () => {
  it('reads an order with no timeline as one nobody has moved yet', () => {
    expect(orderProgress(SPARSE_ORDER)).toEqual({ completed: 0, total: 0, fraction: 0 });
    expect(timelineFor(SPARSE_ORDER)).toEqual([]);
  });

  it('still reads a real timeline correctly', () => {
    const order = {
      timeline: [
        { status: 'received', occurredAt: '2026-09-09T10:00:00.000Z' },
        { status: 'preparing', occurredAt: '2026-09-09T10:05:00.000Z' },
        { status: 'ready', occurredAt: null },
        { status: 'completed', occurredAt: null },
      ],
    } as unknown as Order;

    expect(orderProgress(order)).toEqual({ completed: 2, total: 4, fraction: 0.5 });
  });

  it('prices a product with no option groups at its base price', () => {
    const product = { basePrice: 149 } as unknown as Product;

    expect(priceFloor(product)).toBe(149);
  });

  it('skips a group with no minSelect rather than crashing on its options', () => {
    /*
      The subtler half. `undefined < 1` is false, so a group with no
      `minSelect` walked past the guard above it and crashed on `group.options`
      instead — a guard that looked like it covered this and did not.
    */
    const product = {
      basePrice: 149,
      optionGroups: [{ id: 'size', label: 'Size' }],
    } as unknown as Product;

    expect(priceFloor(product)).toBe(149);
  });

  it("still adds a required group's cheapest option", () => {
    const product = {
      basePrice: 149,
      optionGroups: [
        {
          id: 'size',
          minSelect: 1,
          options: [
            { id: 'small', priceDelta: 0, available: false },
            { id: 'large', priceDelta: 30, available: true },
          ],
        },
      ],
    } as unknown as Product;

    expect(priceFloor(product)).toBe(179);
  });
});

/**
 * FIXTURE 3 — a status the table has never heard of.
 *
 * The fallback is a claim about the app, not about the kitchen. "Received"
 * would have been the app inventing a state for an order nobody has heard
 * from, which is the exact thing `audit:offline` exists to prevent one screen
 * over.
 */
describe('3 — a status nobody sent', () => {
  it('answers for a status that is not in the table', () => {
    const copy = statusCopy(undefined as unknown as OrderStatus);

    expect(copy.label).toBe('No update yet');
    expect(copy.description).toMatch(/We have not had an update/);
  });

  it('says nothing about where the food is', () => {
    const copy = statusCopy('invented' as OrderStatus);

    expect(copy.label).not.toMatch(/received|preparing|ready|delivery/i);
  });

  it('still answers the statuses it knows', () => {
    expect(statusCopy('preparing').label).toBe('Preparing');
    expect(statusCopy('cancelled').label).toBe('Cancelled');
  });
});

/**
 * FIXTURE 4 — a voucher with no date on it.
 */
describe('4 — an expiry nobody sent', () => {
  const voucher = (over: Partial<Voucher>) =>
    ({ used: false, expired: false, ...over }) as unknown as Voucher;

  it('says the standing without inventing a day for it', () => {
    expect(voucherStandingCopy(voucher({}))).toBe('Ready to use');
    expect(voucherStandingCopy(voucher({ expired: true }))).toBe('Expired');
  });

  it('still quotes the date when there is one', () => {
    const dated = voucher({ expiresAt: '2026-08-21T12:00:00.000Z' });

    expect(voucherStandingCopy(dated)).toMatch(/^Expires \w/);
  });

  it('still puts used before expired', () => {
    expect(voucherStandingCopy(voucher({ used: true, expired: true }))).toBe('Already used');
  });
});

/**
 * FIXTURE 5 — one helper for the progress bar, not three inline copies.
 */
describe('5 — the three screens that drew the same bar', () => {
  const SCREENS = [
    'src/app/order/[id]/index.tsx',
    'src/app/(tabs)/orders.tsx',
    'src/app/(tabs)/home.tsx',
  ];

  it.each(SCREENS)('%s asks the helper', (file) => {
    expect(code(file)).toMatch(/orderProgress\(/);
  });

  it.each(SCREENS)('%s no longer computes it inline', (file) => {
    // The shape that was wrong in all three, and was fixed in one of them by a
    // grep that could only see one spelling of it.
    expect(code(file)).not.toMatch(/timeline\.filter\(/);
    expect(code(file)).not.toMatch(/timeline\.length/);
  });
});

/**
 * FIXTURE 6 — the sweep, and what makes its green a measurement.
 */
describe('6 — audit:sparse', () => {
  const audit = read('scripts/audit-sparse.mjs');

  it('is registered so it runs', () => {
    const scripts = JSON.parse(read('package.json')).scripts as Record<string, string>;
    expect(scripts['audit:sparse']).toBe('node scripts/audit-sparse.mjs');
  });

  it('states the rule it measures, which is not "the app must work with no data"', () => {
    expect(audit).toMatch(/a missing field is a gap in the data; a crash screen is a claim about/);
  });

  it('reads the console as well as uncaught errors', () => {
    // The boundary catches the render throw, so nothing reaches `pageerror`.
    // The first run reported five crashes and could not say why any of them
    // crashed, which is a bug report nobody can act on.
    expect(audit).toMatch(/page\.on\('console'/);
    expect(audit).toMatch(/pageerror/);
  });

  it('writes each body next to the check it satisfies', () => {
    // So a field added to a check has an obvious place to appear here, and a
    // reader can hold the two side by side.
    for (const check of [
      '`checkProduct`',
      '`checkOrder`',
      '`checkStore`',
      '`checkReward`',
      '`checkVoucher`',
      '`checkedTiers`',
      '`checkedLoyaltyAccount`',
    ]) {
      expect(audit).toContain(check);
    }
  });

  it('proves it is in the state it claims before measuring', () => {
    expect(audit).toMatch(/await preconditionFailures\(page, \{/);
    expect(audit).toMatch(/assertSeeds\(/);
  });
});
