import { readFileSync } from 'node:fs';
import path from 'node:path';

import { cartItemCount, describeItemCount } from '@/utils/cart';
import type { CartLine } from '@/types';

const root = path.join(__dirname, '..');
const read = (file: string) => readFileSync(path.join(root, file), 'utf8');

const code = (file: string) =>
  read(file)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

/*
  ───────────────────────────────────────────────────────────────────────────
  A basket big enough to catch the app out.

  Every sweep in this repository had bought one or two things. `audit:screens`
  adds a single item, `audit:coldstart` adds a single item, `audit:double-tap`
  adds a single item — which is not what a fried-chicken order looks like. The
  app allows twenty per line and puts no cap at all on the number of lines, so
  the biggest basket it will accept is not small.

  That matters because there were two sums in this app for the same question:

      cartItemCount(lines)   sums the quantities — what a customer means
      lines.length           counts the rows — what the basket is made of

  With one of everything they agree, which is precisely why nothing had ever
  separated them. `npm run audit:basket` builds a basket where they cannot —
  seven lines, seven of each — and reads every "N items" between the menu and
  the pay button:

      the sticky cart bar     49 items    ✓
      the cart header          7 items    ✗
      the checkout header      7 items    ✗

  A customer taps a bar that says 49 items and lands on a screen that says 7,
  about the same basket, with nothing having happened in between. Neither
  number is nonsense alone; next to each other one of them is a lie, and it is
  the one on the screen where they are about to pay.

  Three analytics events were counting rows too, so every basket in the
  dashboards was reported at a fraction of its real size.
  ───────────────────────────────────────────────────────────────────────────
*/

const lineOf = (name: string, quantity: number): CartLine => ({
  id: `line-${name}-${quantity}`,
  productId: name,
  name,
  assetKey: 'goldenOriginal',
  quantity,
  selectedOptions: [],
  unitBasePrice: 100,
  unitPrice: 100,
  lineTotal: 100 * quantity,
});

/**
 * FIXTURE 1 — the sum, and the sentence built on it.
 */
describe('1 — how many things are in the basket', () => {
  it('adds the quantities rather than counting the rows', () => {
    const basket = [lineOf('chicken', 7), lineOf('wings', 7), lineOf('fries', 7)];

    expect(cartItemCount(basket)).toBe(21);
    // The number the screens used to show, stated here so the difference is
    // the fixture rather than an implication of it.
    expect(basket.length).toBe(3);
  });

  it('agrees with the row count exactly when every line is a single', () => {
    // Why this went unnoticed for thirty rounds: every sweep and every fixture
    // in this repository bought one of everything.
    const singles = [lineOf('chicken', 1), lineOf('wings', 1)];

    expect(cartItemCount(singles)).toBe(singles.length);
  });

  it('says it in words, with the noun agreeing', () => {
    expect(describeItemCount([lineOf('chicken', 1)])).toBe('1 item');
    expect(describeItemCount([lineOf('chicken', 2)])).toBe('2 items');
    expect(describeItemCount([])).toBe('0 items');
  });

  it('pluralises on the items, not on the lines', () => {
    // One line of two is "2 items". A sentence that pluralised on the row
    // count would say "1 item" here, which is the same bug wearing grammar.
    expect(describeItemCount([lineOf('chicken', 2)])).toBe('2 items');
  });

  it('is one function, so the count and its wording cannot drift apart', () => {
    const basket = [lineOf('chicken', 7), lineOf('wings', 4)];

    expect(describeItemCount(basket)).toBe(`${cartItemCount(basket)} items`);
  });
});

/**
 * FIXTURE 2 — every surface that states it.
 *
 * The point is not that three files were edited. It is that none of them
 * writes the sentence out any more, so a fourth screen cannot quietly invent a
 * fourth answer.
 */
describe('2 — the screens that say it', () => {
  const SURFACES = [
    'src/app/cart/index.tsx',
    'src/app/checkout/index.tsx',
    'src/features/cart/components/StickyCartBar.tsx',
  ];

  it.each(SURFACES)('%s asks for the sentence rather than building one', (file) => {
    expect(code(file)).toMatch(/describeItemCount\(/);
  });

  it('nobody writes the pluralisation out any more', () => {
    for (const file of SURFACES) {
      expect(code(file)).not.toMatch(/item\$\{[^}]*===\s*1\s*\?/);
    }
  });

  it('leaves the row count where a row count is what is meant', () => {
    /*
      `lines.length === 0` is not a count, it is "is the basket empty", and
      changing it to the item count would be a different bug with the same
      shape — a basket of one line at zero would read as empty. The `merge`
      guard clamps quantity to at least 1 so that cannot happen today, which is
      exactly the sort of thing that makes a wrong check survive.
    */
    for (const file of SURFACES) {
      expect(code(file)).toMatch(/lines\.length === 0/);
    }
  });
});

/**
 * FIXTURE 3 — the dashboards, which were wrong in the same way and silently.
 */
describe('3 — what the analytics were reporting', () => {
  const EVENTS = [
    ['src/app/cart/index.tsx', 'view_cart'],
    ['src/app/checkout/index.tsx', 'begin_checkout'],
    ['src/app/checkout/index.tsx', 'purchase'],
    ['src/app/order/[id]/index.tsx', 'reorder'],
  ] as const;

  it('no event counts rows any more', () => {
    for (const [file] of EVENTS) {
      expect(code(file)).not.toMatch(/itemCount: lines\.length/);
      expect(code(file)).not.toMatch(/itemCount: order\.data\.lines\.length/);
    }
  });

  it('every itemCount is the same sum the screens show', () => {
    /*
      Either called inline, or derived one line above and handed in by name.

      The two `useEffect` events now do the second, because doing the first
      left their dependency arrays naming `lines.length` while the body read
      `lines` — a `react-hooks/exhaustive-deps` warning that this project's
      zero-warning baseline was not actually enforcing. Both are fixed and the
      lint script now fails on a warning; see `abroad.test.ts` fixture 6.

      What this fixture is about is unchanged: no event counts rows.
    */
    for (const [file] of EVENTS) {
      // The sum is reached, one way or the other …
      expect(code(file)).toMatch(/cartItemCount\(/);
      // … and the row count is not, by any spelling.
      expect(code(file)).not.toMatch(/itemCount: [\w.]*lines\.length/);
    }
    // The two effects derive it a line above, so their dependency arrays can
    // name a number rather than the array it came from.
    for (const file of ['src/app/cart/index.tsx', 'src/app/checkout/index.tsx']) {
      expect(code(file)).toMatch(/= cartItemCount\(lines\);/);
    }
  });

  it('is the one that had no screen to disagree with', () => {
    /*
      Worth separating from the others. A wrong number on a screen is visible
      to every customer who looks at it; a wrong number in an event is visible
      to nobody, goes into a dashboard, and becomes the basket size somebody
      plans a kitchen around. It had been under-reporting every multi-quantity
      basket since the events were written.
    */
    expect(code('src/ux/analytics.ts')).toMatch(/itemCount: number/);
  });
});

/**
 * FIXTURE 4 — the word "items", now that it means something.
 */
describe('4 — one word, one meaning', () => {
  it('does not count lines and call them items anywhere else', () => {
    /*
      The reconciliation notice said "3 items have changed price", where the 3
      was a count of lines. Correct for what it meant, and in direct conflict
      with the header above it once "items" became the summed quantity.

      It names the products now instead, which is unambiguous without inventing
      a second noun — and more useful, since somebody told a price moved wants
      to know on what.
    */
    const notice = code('src/features/cart/useCartReconciliation.ts');

    expect(notice).not.toMatch(/\$\{[^}]*\.length\} items/);
    expect(notice).toMatch(/new Set\(result\.repriced\.map/);
  });

  it('names one product once even when two lines of it moved', () => {
    // The case that broke the first attempt, caught by a test that already
    // existed. Two lines of the same chicken with different options are two
    // lines, and naming it twice is worse than the count it replaced.
    expect(code('src/features/cart/useCartReconciliation.ts')).toMatch(
      /names\.length === 1 \? 'has' : 'have'/,
    );
  });
});

/**
 * FIXTURE 5 — the sweep, and what makes its green worth anything.
 */
describe('5 — audit:basket', () => {
  const audit = read('scripts/audit-basket.mjs');

  it('is registered so it runs', () => {
    const scripts = JSON.parse(read('package.json')).scripts as Record<string, string>;
    expect(scripts['audit:basket']).toBe('node scripts/audit-basket.mjs');
  });

  it('builds the basket out of the app rather than out of a literal', () => {
    /*
      A seeded basket is a shape the sweep invented, and a sweep measuring its
      own invention is the failure `lib/preconditions.mjs` exists for. This one
      adds real products through the real screens and then raises the quantity
      on the app's own saved lines, so every field except the one under test
      came from `buildCartLine`.
    */
    expect(audit).toMatch(/window\.localStorage\.getItem\('bbq\.cart'\)/);
    expect(audit).toMatch(/line\.lineTotal = Math\.round\(line\.unitPrice \* perLine \* 100\)/);
    expect(audit).toMatch(/app's, not a shape this file invented/);
  });

  it('refuses to run on a basket where the two sums would agree', () => {
    // The whole measurement rests on the basket being one where a row count
    // and an item count are different numbers. If it is not, the sweep has
    // nothing to see and must say so rather than report a pass.
    expect(audit).toMatch(/itemCount === lineCount/);
    expect(audit).toMatch(/process\.exit\(2\)/);
  });

  it('carries a surface that was already right, as the control', () => {
    /*
      Without it, a probe that found no numbers at all and a probe that found
      every number wrong look identical — both report "two screens disagree".
      The sticky cart bar was already built on the summed count, so a correct
      reading has to appear or the sweep says its own findings are unproven.
    */
    expect(audit).toMatch(/await visit\('the menu', '\/menu'\);/);
    expect(audit).toMatch(/treat every finding above as unproven/);
  });

  it('has been shown to fire that guard rather than only to carry it', () => {
    /*
      Run once with the probe's own regex broken so it could match nothing. It
      printed an empty table and the unproven line, which is the outcome it
      exists for. A check that has never been observed failing is a check
      nobody knows the state of, and this repository has found two of its own
      sweeps measuring the wrong thing while printing ticks.

      Asserted here as the shape that makes it possible — a guard reading the
      collected readings rather than a flag some branch remembers to set.
    */
    expect(audit).toMatch(
      /if \(!readings\.some\(\(reading\) => reading\.said === itemCount\)\) \{/,
    );
  });

  it('reads what a customer can see, including what is only announced', () => {
    // A screen-reader label is a separate claim from the visible text and can
    // be wrong on its own — and on the menu it is the *only* place the number
    // appears in words.
    expect(audit).toMatch(/document\.querySelectorAll\('\[aria-label\]'\)/);
  });

  it('skips a product an earlier round deliberately sold out', () => {
    // `cheesling-fries` is seeded with every size unavailable on purpose.
    // Waiting for its disabled button and dying would be this sweep failing on
    // another sweep's fixture.
    expect(audit).toMatch(/await button\.isDisabled\(\)/);
    expect(audit).toMatch(/another sweep's fixture/);
  });
});
