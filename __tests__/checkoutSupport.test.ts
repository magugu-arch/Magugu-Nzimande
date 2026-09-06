import { readFileSync } from 'node:fs';
import path from 'node:path';

import { didNotArrive, isOfflinePending, type PhasedQuery } from '@/features/system/queryPhase';
import {
  addressRowValue,
  savedCardsNotice,
  savedCardsUnavailable,
  storeRowValue,
  unreachableBlocker,
} from '@/features/checkout/supportingData';
import { offeredPaymentMethods } from '@/features/checkout/paymentOptions';
import { products } from '@/services/data/menuData';

const read = (file: string) => readFileSync(path.join(__dirname, '..', file), 'utf8');

const code = (file: string) =>
  read(file)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

/**
 * The four phases a query is actually in, named the way the screens think
 * about them rather than the way TanStack Query reports them.
 */
const arrived: PhasedQuery = { isSuccess: true, isError: false, fetchStatus: 'idle' };
const stillComing: PhasedQuery = { isSuccess: false, isError: false, fetchStatus: 'fetching' };
/** No signal. Never errors, never retries, and `data` stays undefined. */
const paused: PhasedQuery = { isSuccess: false, isError: false, fetchStatus: 'paused' };
/** A 500 from the account endpoint. Online, and just as cardless. */
const failed: PhasedQuery = { isSuccess: false, isError: true, fetchStatus: 'idle' };

/**
 * 1 — the phase nothing was asking about.
 *
 * `isOfflinePending` catches a paused query, and it is written that way on
 * purpose: a screen that hands the whole viewport over to a message must not
 * have its existing loading and error branches changed by adding it.
 *
 * Checkout has no such branches and cannot grow them — it renders from the
 * cart, and blanking it would take away the screen somebody is trying to pay
 * from. So the question there is narrower and blunter: did this arrive?
 */
describe('a query that is not coming', () => {
  it('is quiet while the answer is still on its way', () => {
    expect(didNotArrive(stillComing)).toBe(false);
    // The first paint must not accuse a server that has had no chance to
    // answer.
    expect(didNotArrive(arrived)).toBe(false);
  });

  it('catches the paused query, like isOfflinePending does', () => {
    expect(didNotArrive(paused)).toBe(true);
    expect(isOfflinePending(paused)).toBe(true);
  });

  /**
   * 2 — and the one `isOfflinePending` cannot see. A 500 leaves the customer
   * exactly as cardless as a lift does, and `isError` true means
   * `isOfflinePending` says no.
   */
  it('catches the failed query, which isOfflinePending does not', () => {
    expect(didNotArrive(failed)).toBe(true);
    expect(isOfflinePending(failed)).toBe(false);
  });
});

/**
 * 3 — the worst of the three, because it is not a sentence but a screen.
 *
 * `offeredPaymentMethods` falls back to the standing rails when the saved list
 * is empty. That is right and it is deliberate: it is what lets a customer who
 * installed the app this morning pay at all. It cannot tell an empty list
 * apart from a list that never arrived.
 */
describe('the saved cards that never came', () => {
  it('still renders the rails, because a customer must be able to pay', () => {
    const offered = offeredPaymentMethods([], 'delivery');

    expect(offered.length).toBeGreaterThan(0);
    expect(offered.every((method) => method.type !== 'card')).toBe(true);
  });

  it('is indistinguishable from a brand-new customer, to the list itself', () => {
    // Same input, same output — which is the whole problem, and why the
    // difference has to be read from the query rather than from the list.
    expect(offeredPaymentMethods([], 'delivery')).toEqual(offeredPaymentMethods([], 'delivery'));
  });

  it('says nothing when the list really did arrive and really was empty', () => {
    expect(savedCardsUnavailable(arrived)).toBe(false);
  });

  it('speaks up when the list did not arrive, however it failed', () => {
    expect(savedCardsUnavailable(paused)).toBe(true);
    expect(savedCardsUnavailable(failed)).toBe(true);
    expect(savedCardsUnavailable(stillComing)).toBe(false);
  });

  /**
   * 4 — and names the cause when it knows it.
   *
   * `audit:offline` treats "Something went wrong" on a screen that knows the
   * device is offline as a finding of its own: it reads as a fault in the app,
   * so the customer restarts it, and it happens again.
   */
  it('names the connection when the query is paused', () => {
    expect(savedCardsNotice(paused)).toMatch(/You're offline/);
  });

  it('does not blame the connection for a server that answered badly', () => {
    expect(savedCardsNotice(failed)).not.toMatch(/offline/i);
    expect(savedCardsNotice(failed)).toMatch(/couldn't load your saved cards/);
  });

  it('tells them what they can still do, either way', () => {
    for (const notice of [savedCardsNotice(paused), savedCardsNotice(failed)]) {
      expect(notice).toMatch(/still pay another way/);
    }
  });
});

/**
 * 5 — the two rows, which were instructions the customer could not follow.
 */
describe('the rows that told the customer to do the impossible', () => {
  it('leaves a chosen branch or address exactly as it was', () => {
    expect(storeRowValue(paused, 'bb.q Chicken Rosebank')).toBe('bb.q Chicken Rosebank');
    expect(addressRowValue(failed, 'Home · 12 Oak Avenue')).toBe('Home · 12 Oak Avenue');
  });

  it('keeps the ordinary prompt when the data arrived', () => {
    expect(storeRowValue(arrived, undefined)).toBe('Choose a store');
    expect(addressRowValue(arrived, undefined)).toBe('Add a delivery address');
  });

  it('stops claiming an absence when nothing arrived', () => {
    expect(storeRowValue(paused, undefined)).toMatch(/Couldn't load/);
    expect(addressRowValue(paused, undefined)).toMatch(/Couldn't load/);
    expect(storeRowValue(failed, undefined)).toMatch(/Couldn't load/);
    expect(addressRowValue(failed, undefined)).toMatch(/Couldn't load/);
  });

  /** 6 — and says nothing at all while the first load is running. */
  it('does not accuse a server that has not had a chance to answer', () => {
    expect(storeRowValue(stillComing, undefined)).toBe('Choose a store');
    expect(addressRowValue(stillComing, undefined)).toBe('Add a delivery address');
  });
});

/**
 * 7 — the sentence under the button.
 */
describe('the reason the button is disabled', () => {
  it('says nothing when the app has no complaint of its own', () => {
    expect(
      unreachableBlocker({
        needsStore: true,
        needsAddress: true,
        stores: arrived,
        addresses: arrived,
      }),
    ).toBeNull();
  });

  it('says nothing about data the customer does not need yet', () => {
    // A collection order needs no address, so a failed address list is not
    // this order's problem and must not be raised as one.
    expect(
      unreachableBlocker({
        needsStore: false,
        needsAddress: false,
        stores: paused,
        addresses: paused,
      }),
    ).toBeNull();
  });

  /**
   * 8 — one problem at a time. A customer told about the branch and the
   * address in the same breath is told about neither, and the branch is the
   * one that has to be solved first: an order with no kitchen behind it cannot
   * be placed wherever it is going.
   */
  it('reports the branch first when both are missing', () => {
    const message = unreachableBlocker({
      needsStore: true,
      needsAddress: true,
      stores: paused,
      addresses: paused,
    })!;

    expect(message).toMatch(/branches near you/);
    expect(message).not.toMatch(/addresses/);
  });

  it('reports the address once the branch is settled', () => {
    const message = unreachableBlocker({
      needsStore: false,
      needsAddress: true,
      stores: arrived,
      addresses: failed,
    })!;

    expect(message).toMatch(/saved addresses/);
  });

  it('names the connection when it knows, and not when it does not', () => {
    const offline = unreachableBlocker({
      needsStore: true,
      needsAddress: false,
      stores: paused,
      addresses: arrived,
    })!;
    const broken = unreachableBlocker({
      needsStore: true,
      needsAddress: false,
      stores: failed,
      addresses: arrived,
    })!;

    expect(offline).toMatch(/You're offline/);
    expect(broken).not.toMatch(/offline/i);
  });
});

/**
 * 9 — the wiring, and the one rule it must not break.
 *
 * Nothing here blocks and nothing blanks. A customer on a bad connection can
 * still pay by a rail — that is what the rails are for, and it is the same
 * judgement the offline notice on this screen already makes: a wrong warning
 * costs a moment's doubt, a wrong lockout costs the order.
 */
describe('the checkout screen’s use of it', () => {
  const screen = code('src/app/checkout/index.tsx');

  it('reads each query where it is used, rather than gating the screen', () => {
    expect(screen).toMatch(/savedCardsUnavailable\(paymentMethods\)/);
    expect(screen).toMatch(/storeRowValue\(availableStores, store\?\.name\)/);
    expect(screen).toMatch(/addressRowValue\(\s*addresses,/);

    // No early return that would take the screen away from somebody paying.
    expect(screen).not.toMatch(/if \(paymentMethods\.isError\) return/);
    expect(screen).not.toMatch(/isOfflinePending\(paymentMethods\)/);
  });

  it('still offers the rails, and offers a way to try again', () => {
    expect(screen).toMatch(/testID="checkout-cards-retry"/);
    expect(screen).toMatch(/paymentMethods\.refetch\(\)/);
    // The list itself is untouched: the notice sits above it, not instead
    // of it.
    expect(screen).toMatch(/\{offered\.map\(\(method\) => \{/);
  });

  it('announces the notice rather than leaving it to be noticed', () => {
    const notice = screen.slice(screen.indexOf('testID="checkout-cards-unavailable"') - 300);
    expect(notice.slice(0, 400)).toMatch(/accessibilityRole="alert"/);
  });

  it('only overrides the blocker when the app is the one at fault', () => {
    const block = screen.slice(screen.indexOf('if (fulfilmentBlocker)'));

    // `?? fulfilmentBlocker` — the ordinary wording survives untouched.
    expect(block.slice(0, 400)).toMatch(/\}\) \?\? fulfilmentBlocker/);
  });
});

/**
 * 10 — and the sweep that could not see any of it.
 *
 * `/checkout` was not one of `audit:offline`'s routes, because it renders from
 * the basket and needs one seeded first. The route that takes setting up is the
 * route that goes unswept, and this one is where the money is.
 */
describe('the sweep that missed it', () => {
  const audit = code('scripts/audit-offline.mjs');

  it('now sweeps checkout, with a basket in it', () => {
    expect(audit).toMatch(/'\/checkout',/);
    expect(audit).toMatch(/NEEDS_BASKET/);
    expect(audit).toMatch(/window\.localStorage\.setItem\('bbq\.cart', basket\)/);
  });

  it('seeds the basket only where a basket is the point', () => {
    expect(audit).toMatch(/basket: NEEDS_BASKET\.has\(route\) \? BASKET : null/);
  });

  it('fails on the two rows that gave instructions it could not support', () => {
    expect(audit).toMatch(/tells the customer to pick a branch it cannot list/);
    expect(audit).toMatch(/claims the customer has no saved address/);
  });

  /**
   * And on the payment section, which no phrase could catch: the lie was not
   * something the screen said but something it drew. Rails may be offered —
   * they are what somebody on a bad connection can still pay with — but not
   * silently.
   */
  it('fails on rails offered without a word about why', () => {
    expect(audit).toMatch(/RAILS_WITHOUT_A_WORD/);
    expect(audit).toMatch(/offers the standing rails as if they were the customer/);
    expect(audit).toMatch(/admission: /);
  });

  /**
   * The seeded basket is a real line off the real menu, and its price is bound
   * to `menuData` from here.
   *
   * A plain `.mjs` script cannot import the TypeScript menu, so the figure has
   * to be written into the audit — which is the drift this repository keeps
   * finding. The first draft of it priced Golden Original at R165, the base of
   * a different product entirely. Binding it here means the menu can move and
   * the audit cannot quietly disagree.
   */
  it('keeps the seeded basket a real line, at the menu’s own price', () => {
    const product = products.find((item) => item.id === 'golden-original');
    expect(product).toBeDefined();

    expect(audit).toContain(`productId: 'golden-original'`);
    expect(audit).toContain(`unitBasePrice: ${product!.basePrice}`);
    expect(audit).toContain(`lineTotal: ${product!.basePrice}`);
    expect(audit).toContain(`name: '${product!.name}'`);
  });
});

/**
 * 11 — and the false positive the sweep itself found, on its first run.
 *
 * The two new claims were written unscoped, and `/checkout/store` failed
 * immediately: that screen is *titled* "Choose a store" and shows an honest
 * offline state underneath it. Failing a page for its own heading is nagging,
 * and an audit that cries wolf is one people learn to run with their eyes
 * shut — the opposite of the rule this repository keeps, that an audit which
 * under-reports is worse than one that nags.
 *
 * So the two checkout rows are scoped to the route they are about, and the
 * rules that are safe everywhere stay unscoped.
 */
describe('the rules that are about one screen', () => {
  const audit = code('scripts/audit-offline.mjs');

  it('scopes the checkout rows to checkout', () => {
    expect(audit).toMatch(/'tells the customer to pick a branch it cannot list', '\/checkout'/);
    expect(audit).toMatch(/'claims the customer has no saved address', '\/checkout'/);
  });

  it('leaves the rules that are true everywhere unscoped', () => {
    expect(audit).toMatch(/\[\/No vouchers yet\/i, 'claims the customer has no vouchers'\]/);
    expect(audit).toMatch(
      /\[\/No payment methods saved\/i, 'claims the customer has no saved cards'\]/,
    );
  });

  it('applies the scope where the claims are read', () => {
    expect(audit).toMatch(/only === undefined \|\| only === route/);
  });

  /**
   * And `/checkout/store` keeps its title. It is the right name for that
   * screen; the sweep was asking the wrong question of it.
   */
  it('does not ask the picker to rename itself', () => {
    expect(code('src/app/checkout/store.tsx')).toMatch(/<ScreenHeader title="Choose a store" \/>/);
  });
});
