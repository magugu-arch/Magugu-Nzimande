import { beforeEach, describe, expect, it } from 'vitest';
import { readState } from '@/lib/demo-state';
import { requestReset } from '@/lib/accounts/reset';
import { suppress } from '@/lib/notifications/suppression';
import {
  blankState,
  bodyOf,
  customer,
  eraseAccountVia,
  personalDetailsOf,
  persistedState,
  placeDeliveryOrderAs,
  registerCustomer,
  request,
  withAccounts,
} from './fixtures';

/**
 * Erasure, asked of everything the server has written down.
 *
 * The suite already had a test for this and it passed while the defect was
 * there. It placed a *collection* order, erased the account, and checked that
 * `orders[0].customer.email` was no longer the customer's — one field, on the
 * one record, of the one kind of order that has no address on it.
 *
 * A delivery order kept the street and the postal code. `eraseAccount` replaced
 * the name, the email and the mobile and walked past the three fields beside
 * them, so a person who asked to be forgotten was still on file at the house
 * they live in. The comment above the function said "a sale with no person
 * attached to it" the whole time.
 *
 * So these ask a different question. Not "is the field I remembered empty" but
 * "is this person's information anywhere in the state at all" — which is the
 * question erasure actually has to answer, and the only one that would have
 * caught an address sitting two properties from the field being checked.
 */

beforeEach(blankState);

describe('erasing a customer who had food delivered', () => {
  it('leaves nothing about them anywhere in the state', async () => {
    await withAccounts(async () => {
      const { cookie } = await registerCustomer();
      const order = await placeDeliveryOrderAs(cookie);
      // Captured before the erasure, because the erasure is what removes them.
      const details = personalDetailsOf(order);

      expect(await eraseAccountVia(cookie).then((r) => r.status)).toBe(200);

      const state = persistedState();
      for (const detail of details) {
        expect(state, `the state still contains ${detail}`).not.toContain(detail);
      }
    });
  });

  /** Named individually, so a failure says which field came back. */
  it('clears the delivery address and the postal code from the order', async () => {
    await withAccounts(async () => {
      const { cookie } = await registerCustomer();
      await placeDeliveryOrderAs(cookie);
      await eraseAccountVia(cookie);

      const order = readState().orders[0];
      expect(order?.address, 'the street').toBeNull();
      expect(order?.postalCode, 'the postal code').toBeNull();
    });
  });

  /**
   * The kitchen note is free text somebody typed, and "ring the bell for flat
   * 4B, ask for Thandi" is a name and a door number written where nobody
   * thought to look for one.
   */
  it('clears the kitchen note, whatever the customer put in it', async () => {
    await withAccounts(async () => {
      const { cookie } = await registerCustomer();
      await placeDeliveryOrderAs(cookie, {
        kitchenNote: 'Ring the bell for flat 4B and ask for Thandi',
      });
      await eraseAccountVia(cookie);

      expect(readState().orders[0]?.kitchenNote).toBe('');
      expect(persistedState()).not.toContain('flat 4B');
    });
  });

  /**
   * The suburb stays, and that is a decision rather than another oversight.
   *
   * It is a delivery area this business publishes on its own stores page, so it
   * says nothing about a person that the website does not already say about
   * everyone. The retained sale is worth more with it than without. Written
   * down here so that if somebody later decides otherwise they are changing a
   * decision rather than discovering one.
   */
  it('keeps the suburb, which is a delivery area rather than a person', async () => {
    await withAccounts(async () => {
      const { cookie } = await registerCustomer();
      const order = await placeDeliveryOrderAs(cookie);
      await eraseAccountVia(cookie);

      expect(readState().orders[0]?.suburb).toBe(order.suburb);
    });
  });

  /** And the sale itself survives, which is the whole reason for the care. */
  it('keeps the sale, its lines and its totals', async () => {
    await withAccounts(async () => {
      const { cookie } = await registerCustomer();
      const order = await placeDeliveryOrderAs(cookie);
      await eraseAccountVia(cookie);

      const kept = readState().orders[0];
      expect(kept?.id).toBe(order.id);
      expect(kept?.totals).toEqual(order.totals);
      expect(kept?.lines).toEqual(order.lines);
      expect(kept?.accountId, 'with nobody attached').toBeNull();
    });
  });
});

describe('what else the erasure has to reach', () => {
  /**
   * A live reset naming an account that no longer exists.
   *
   * Harmless by itself — completing it looks the account up and finds nothing —
   * but it is a row that outlives the person it is about, and the point of this
   * function is that none do.
   */
  it('drops a password reset for the erased account', async () => {
    await withAccounts(async () => {
      const { cookie, id } = await registerCustomer();
      requestReset(customer.email);
      expect(readState().passwordResets, 'a reset to clean up').not.toHaveLength(0);

      await eraseAccountVia(cookie);

      expect(readState().passwordResets.filter((reset) => reset.accountId === id)).toEqual([]);
    });
  });

  /**
   * The suppression list is the one thing that stays, and it has to.
   *
   * It records that an address hard-bounced or that somebody complained, and
   * removing it on erasure means the next campaign mails them again — turning
   * a request to be left alone into the reason they get another email. Keeping
   * a suppression record is a recognised basis for holding an address after
   * erasure, and it is the narrowest thing that can be held: an address and a
   * reason, with no order, no name and no account behind it.
   *
   * This is asserted rather than assumed so that the day somebody "finishes"
   * erasure by clearing this too, a test tells them what it is for.
   */
  it('keeps a suppression record, which exists to stop us contacting them', async () => {
    await withAccounts(async () => {
      const { cookie } = await registerCustomer();
      suppress(customer.email, 'complaint');

      await eraseAccountVia(cookie);

      const held = readState().suppressed.map((entry) => entry.address);
      expect(held, 'still on the do-not-email list').toContain(customer.email);
    });
  });
});

/**
 * The access request, which is the same question asked the other way round.
 *
 * Erasure asks "is any of this person left"; access asks "is any of this
 * person unreported". Both are answered by walking the same list of places
 * their information can be, and the export was walking a shorter one.
 */
describe('the access request', () => {
  it('reports the suppression that erasure will keep', async () => {
    await withAccounts(async () => {
      const { cookie } = await registerCustomer();
      suppress(customer.email, 'complaint');

      const { GET } = await import('@/app/api/account/privacy/route');
      const data = await bodyOf<{ emailSuppressions: { address: string; reason: string }[] }>(
        GET(request('/api/account/privacy', { cookie })),
      );

      expect(data.emailSuppressions.map((entry) => entry.address)).toEqual([customer.email]);
      expect(data.emailSuppressions[0]?.reason).toBe('complaint');
    });
  });

  /** And says so with an empty list rather than an absent field. */
  it('names the list even when there is nothing on it', async () => {
    await withAccounts(async () => {
      const { cookie } = await registerCustomer();

      const { GET } = await import('@/app/api/account/privacy/route');
      const data = await bodyOf<Record<string, unknown>>(
        GET(request('/api/account/privacy', { cookie })),
      );

      expect(data).toHaveProperty('emailSuppressions');
      expect(data.emailSuppressions).toEqual([]);
    });
  });

  /**
   * The standing half: every group the state keeps personal data in is either
   * reported by the export or named here as one that holds none.
   *
   * The export's own comment says the place to notice a new table is this
   * module — but noticing is a thing a person does once. A new group added to
   * the state fails this until somebody says which it is.
   */
  it('accounts for every group the state file has', () => {
    const REPORTED: Record<string, string> = {
      accounts: 'the account itself, and its address book',
      orders: 'their orders',
      payments: 'the payments against those orders',
      suppressed: 'the do-not-email record',
    };
    const HOLDS_NOBODY: Record<string, string> = {
      soldOut: 'product slugs',
      hidden: 'product slugs',
      services: 'which store offers which service',
      sequence: 'a counter',
      consoleLock: 'operator sign-in attempts, not customers',
      notifications: 'message ids keyed by order, and webhook replay tokens',
      fulfilment: 'handoff records keyed by order id',
      passwordResets: 'an account id and a token hash, cleared on erasure',
      audit: 'operational history, redacted on erasure',
      leases:
        'a claim on an operation in progress, keyed by order or payment id and expiring in minutes',
    };

    const groups = Object.keys(readState()).sort();
    const unaccounted = groups.filter(
      (group) => !(group in REPORTED) && !(group in HOLDS_NOBODY),
    );

    expect(unaccounted, 'these groups are neither exported nor explained').toEqual([]);
  });
});
