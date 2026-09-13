import { beforeEach, describe, expect, it } from 'vitest';
import type { DeliveryQuote } from '@bbq/types';
import {
  aDeliveryStore,
  aStoreOtherThan,
  aSuburbNotServedBy,
  aSuburbOf,
  blankState,
  bodyOf,
  clientCode,
  deliveryRequest,
  demoFunction,
  quoteFor,
  request,
  storeServing,
} from './fixtures';

/**
 * "We deliver there", and then we did not.
 *
 * Checkout asks this endpoint whether an address can be delivered to, and the
 * endpoint answered a different question: whether *any* branch delivers there.
 * The three seeded branches have disjoint zone lists — Cresta covers Randburg
 * and Northcliff, Fourways covers Fourways and Lonehill, Waterfall covers
 * Midrand — so a customer with one branch selected who types a suburb belonging
 * to another was told "We deliver there. About 45 minutes", walked through the
 * rest of checkout, and was refused at placement: "Cresta Crossing does not
 * deliver to Fourways."
 *
 * The order route was right and the quote was wrong. The fixture that supplies
 * these suburbs had the case written on it the whole time — "an order for a
 * real suburb that a real store delivers to, sent to the store that does not" —
 * and nothing had ever asked the quote endpoint about it.
 *
 * So the quote now answers for the branch being ordered from, and when another
 * branch covers the address it says which, because "we do not deliver there" is
 * false and losing the sale.
 */

beforeEach(blankState);

describe('a quote for the branch the customer is ordering from', () => {
  it('says yes to a suburb that branch covers, and names it', async () => {
    const store = aDeliveryStore();
    const quote = await quoteFor(aSuburbOf(store), { storeId: store.id });

    expect(quote.serviceable).toBe(true);
    if (!quote.serviceable) return;
    expect(quote.storeId).toBe(store.id);
  });

  /**
   * The defect, stated as the two answers disagreeing. Before the fix this
   * said serviceable and the order route said 409 — the customer meeting the
   * refusal four screens later, having typed their whole address.
   */
  it('says no to a suburb another branch covers, rather than yes', async () => {
    const store = aDeliveryStore();
    const elsewhere = aSuburbNotServedBy(store);

    const quote = await quoteFor(elsewhere, { storeId: store.id });

    expect(quote.serviceable).toBe(false);
  });

  it('names the branch that does cover it, so the sale is not lost', async () => {
    const store = aDeliveryStore();
    const elsewhere = aSuburbNotServedBy(store);
    const covering = storeServing(elsewhere);

    const quote = await quoteFor(elsewhere, { storeId: store.id });

    expect(quote.serviceable).toBe(false);
    if (quote.serviceable) return;
    expect(quote.reason).toContain(covering.name);
    expect(quote.alternativeStoreId).toBe(covering.id);
  });

  /** And a suburb nobody covers still reads the way it always did. */
  it('offers no alternative for a suburb nobody covers', async () => {
    const store = aDeliveryStore();
    const quote = await quoteFor('Hermanus', { storeId: store.id });

    expect(quote.serviceable).toBe(false);
    if (quote.serviceable) return;
    expect(quote.reason).toContain('do not deliver');
    expect(quote.alternativeStoreId ?? null).toBeNull();
  });

  /**
   * Asking without naming a branch is still the old question, answered the old
   * way. The stores page uses it to list where the business delivers at all,
   * and that is a different question from "can this basket be delivered".
   */
  it('still answers for any branch when none is named', async () => {
    const store = aDeliveryStore();
    const quote = await quoteFor(aSuburbNotServedBy(store));

    expect(quote.serviceable).toBe(true);
  });
});

/**
 * The standing half, and the one worth having: across the whole seed, the two
 * endpoints agree. Anything the quote calls serviceable, the order route takes.
 *
 * Driven for every delivery suburb of every delivering branch rather than for
 * one example, because the failure was not in one pair — it was in the quote
 * asking a different question from the one checkout needed answered.
 */
describe('the quote and the order route agree', () => {
  it('accepts every order the quote said it would', async () => {
    const store = aDeliveryStore();
    const { POST } = await import('@/app/api/orders/route');

    for (const suburb of store.zones) {
      const quote = await quoteFor(suburb, { storeId: store.id });
      expect(quote.serviceable, `${store.name} quoted ${suburb}`).toBe(true);

      const response = await POST(
        request('/api/orders', {
          method: 'POST',
          body: deliveryRequest({ storeId: store.id, suburb }),
        }),
      );
      expect(response.status, `${store.name} took an order for ${suburb}`).toBe(201);
    }
  });

  it('refuses every order the quote refused', async () => {
    const store = aDeliveryStore();
    const other = aStoreOtherThan(store);
    const { POST } = await import('@/app/api/orders/route');

    for (const suburb of other.zones) {
      const quote = await quoteFor(suburb, { storeId: store.id });
      expect(quote.serviceable, `${store.name} quoted ${suburb}`).toBe(false);

      const response = await POST(
        request('/api/orders', {
          method: 'POST',
          body: deliveryRequest({ storeId: store.id, suburb }),
        }),
      );
      expect(response.status, `${store.name} refused ${suburb}`).toBe(409);
    }
  });
});

/**
 * The delivery fee, which the endpoint works out and nothing reads.
 *
 * `feeCents` was computed here with the free-delivery threshold written out a
 * second time, beside `deliveryFeeOf` in lib/pricing.ts which exists to answer
 * exactly this. The two agreed, because both read the same seed constant — and
 * every one of those constants is a [CONFIRM] placeholder, so the day real fees
 * arrive is the day a second copy of the rule starts costing money.
 */
describe('the fee the quote gives', () => {
  it('is free over the threshold and charged under it, like the basket', async () => {
    const store = aDeliveryStore();
    const suburb = aSuburbOf(store);

    const cheap = await quoteFor(suburb, { storeId: store.id, subtotalCents: 1_000 });
    const dear = await quoteFor(suburb, { storeId: store.id, subtotalCents: 100_000 });

    expect(cheap.serviceable && cheap.feeCents).toBeGreaterThan(0);
    expect(dear.serviceable && dear.feeCents).toBe(0);
  });

  it('is not worked out a second time in the route', async () => {
    const { readFileSync } = await import('node:fs');
    const path = await import('node:path');
    const source = readFileSync(
      path.join(__dirname, '../src/app/api/delivery/quote/route.ts'),
      'utf8',
    );

    expect(source, 'the route must call the shared rule').toContain('deliveryFeeOf(');
    expect(
      source.replace(/\/\*[\s\S]*?\*\//g, ''),
      'and must not compare against the threshold itself',
    ).not.toContain('freeDeliveryOverCents');
  });
});

describe('the checkout screen', () => {
  /**
   * Structural, because the endpoint can only answer for a branch if it is
   * told which one. A screen that goes back to asking without a store id gets
   * the old, wrong answer and every test above still passes.
   */
  it('asks about the branch the customer has selected', () => {
    const checkout = clientCode().find(({ file }) => file.endsWith('CheckoutFlow.tsx'));
    expect(checkout, 'the checkout screen').toBeDefined();

    /**
     * The arguments, not a substring of them.
     *
     * This first read the call for the text "store.id", which a call passing
     * `stores[0]?.id ?? store.id` satisfies while quoting the wrong branch —
     * a matcher that was right about the characters and wrong about the
     * meaning. The third argument has to *be* the selected branch.
     */
    const call = /quoteDelivery\(([\s\S]*?)\)/.exec(checkout?.code ?? '')?.[1] ?? '';
    const args = call
      .split(',')
      .map((argument) => argument.trim())
      .filter(Boolean);

    expect(args, 'suburb, subtotal, branch').toHaveLength(3);
    expect(args[2]).toBe('store.id');
  });

  it('offers the branch that does deliver, rather than a dead end', () => {
    const checkout = clientCode().find(({ file }) => file.endsWith('CheckoutFlow.tsx'));

    expect(checkout?.code, 'reads the alternative').toContain('alternativeStoreId');
    expect(checkout?.code, 'and can act on it').toContain('setStore(');
  });
});

/** The shape the client parses has to carry the new field, or it is stripped. */
describe('the quote schema', () => {
  it('allows an alternative branch on a refusal', async () => {
    const { DeliveryQuoteSchema } = await import('@bbq/types');
    const refusal: DeliveryQuote = {
      serviceable: false,
      reason: 'Fourways Crossing delivers there.',
      alternativeStoreId: 'ST-3',
    };

    expect(DeliveryQuoteSchema.parse(refusal)).toEqual(refusal);
  });

  it('still parses a refusal with no alternative', async () => {
    const { DeliveryQuoteSchema } = await import('@bbq/types');
    const parsed = DeliveryQuoteSchema.parse({
      serviceable: false,
      reason: 'We do not deliver to this suburb yet.',
    });

    expect(parsed.serviceable).toBe(false);
  });
});

/** The API body the route now accepts, so a caller can name its branch. */
describe('the quote request', () => {
  it('takes an optional store id', async () => {
    const { DeliveryQuoteRequestSchema } = await import('@bbq/types');

    expect(
      DeliveryQuoteRequestSchema.parse({ suburb: 'Randburg', subtotalCents: 0, storeId: 'ST-1' })
        .storeId,
    ).toBe('ST-1');
    expect(
      DeliveryQuoteRequestSchema.parse({ suburb: 'Randburg', subtotalCents: 0 }).storeId ?? null,
    ).toBeNull();
  });

  it('refuses a store id that is not a string', async () => {
    const response = await (
      await import('@/app/api/delivery/quote/route')
    ).POST(
      request('/api/delivery/quote', {
        method: 'POST',
        body: { suburb: 'Randburg', subtotalCents: 0, storeId: 7 },
      }),
    );

    expect(response.status).toBe(400);
    expect(await bodyOf<{ error: string }>(response)).toHaveProperty('error');
  });
});

/**
 * The review build, which had the same defect for the same reason.
 *
 * It is a second implementation of these rules, so it got this wrong
 * separately: its quote searched every branch too, and told a reviewer with
 * Cresta selected that a Fourways address was deliverable.
 */
describe('the review build quotes the same way', () => {
  const quote = demoFunction('quoteDelivery');

  it('asks about the branch in the basket', () => {
    expect(quote, 'the selected branch').toContain('store()');
  });

  it('does not answer yes because some other branch covers it', () => {
    /**
     * That `here` is the selected branch, not merely that something called
     * `here` is consulted first. Rebinding it to "whichever branch covers the
     * suburb" keeps every other check in this block true and restores the
     * whole defect.
     */
    expect(quote, 'the branch asked about is the one in the basket').toContain(
      'const here = store();',
    );

    const firstAnswer = quote.slice(0, quote.indexOf('elsewhere'));
    expect(firstAnswer, 'and it decides before any other is looked at').toContain('covers(here)');
  });

  it('names the branch that does, rather than losing the sale', () => {
    expect(quote).toContain('alternativeStoreId');
    expect(quote).toContain('does not deliver to');
  });

  /**
   * And the refusal has to be clearable, or the customer takes the switch and
   * goes on looking at the reason they were offered it.
   */
  it('drops a stale quote when the branch changes', () => {
    expect(demoFunction('setStore')).toContain('S.checkout.quote = null');
  });
});
