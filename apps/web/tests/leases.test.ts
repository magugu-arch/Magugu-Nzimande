import { beforeEach, describe, expect, it } from 'vitest';
import { LEASE_MS, leaseHeld, releaseLease, takeLease } from '@/lib/leases';
import { mutateState, readState } from '@/lib/demo-state';
import { intentForOrder, refundPayment } from '@/lib/payments/ledger';
import { pushToPos, unacknowledged } from '@/lib/fulfilment/handoff';
import {
  aPaidOrder,
  abandonedClaim,
  acceptingPos,
  blankState,
  placeOrder,
  withPaymentProvider,
} from './fixtures';

/**
 * Claims that outlive the process that took them.
 *
 * Two operations call somebody else's server in the middle of a read-modify-
 * write: pushing an order to the till, and refunding a payment. Both took a
 * claim first so two callers could not both act — and both claims were bare
 * keys in the state file, removed by a line that only runs if the process
 * reaches it.
 *
 * The comment on the first one said an abandoned claim would be "recovered by
 * the next deployment". It was wrong in the way that is worst, because it
 * sounded like a plan: the claims are in a file, and a restart reads them
 * straight back. What actually happened was permanent.
 *
 * These tests write the claim by hand, which is exactly what a process that
 * died mid-call leaves behind, and then ask whether the system recovers.
 */

beforeEach(blankState);

describe('a handoff claim left behind by a crash', () => {
  it('no longer blocks the order for ever', async () => {
    const order = await placeOrder();
    const pos = acceptingPos();
    abandonedClaim(`handoff:${order.id}:pos`);

    const record = await pushToPos(order, pos);

    expect(pos.pushOrder, 'the till is asked').toHaveBeenCalledTimes(1);
    expect(record?.ok).toBe(true);
  });

  /**
   * The half that made it invisible. A stuck order was not in the shortfall
   * report either, because nothing had failed — so the one screen whose job is
   * to list orders the kitchen never saw showed nothing at all.
   */
  it('was invisible while it was stuck, and is not now', async () => {
    const order = await placeOrder();
    abandonedClaim(`handoff:${order.id}:pos`);

    const pos = acceptingPos();
    await pushToPos(order, pos);

    expect(unacknowledged('pos'), 'it went through, so nothing is outstanding').toEqual([]);
    expect(pos.pushOrder).toHaveBeenCalledTimes(1);
  });

  /** A claim taken a moment ago is still honoured — the point is expiry, not absence. */
  it('still refuses a second caller while the claim is fresh', async () => {
    const order = await placeOrder();
    const pos = acceptingPos();

    expect(takeLease(`handoff:${order.id}:pos`)).toBe(true);
    const record = await pushToPos(order, pos);

    expect(pos.pushOrder, 'somebody else has it').not.toHaveBeenCalled();
    expect(record?.error).toBe('That handoff is already being attempted');
  });
});

describe('a refund claim left behind by a crash', () => {
  /**
   * The money one. The refund answered `ok: true, replayed: true` — success —
   * while the payment sat there captured, for every attempt afterwards. An
   * operator tells a customer their money is coming back and nothing has
   * happened.
   */
  it('no longer reports a refund that never happened', async () => {
    await withPaymentProvider(async () => {
      const order = await aPaidOrder();
      const intent = intentForOrder(order.id);
      abandonedClaim(`refund:${intent?.id}`);

      const result = await refundPayment(order.id, 'customer asked');

      expect(result.ok).toBe(true);
      expect(intentForOrder(order.id)?.status, 'the money actually moved').toBe('refunded');
    });
  });

  /** And a fresh claim still stops two operators refunding the same payment. */
  it('still refuses a second operator while the claim is fresh', async () => {
    await withPaymentProvider(async () => {
      const order = await aPaidOrder();
      const intent = intentForOrder(order.id);
      expect(takeLease(`refund:${intent?.id}`)).toBe(true);

      const result = await refundPayment(order.id, 'customer asked');

      expect('replayed' in result && result.replayed).toBe(true);
      expect(intentForOrder(order.id)?.status, 'and did not ask the gateway').toBe('captured');
    });
  });
});

describe('the lease itself', () => {
  it('is taken once and refused the second time', () => {
    expect(takeLease('a')).toBe(true);
    expect(takeLease('a')).toBe(false);
  });

  it('is free again once released', () => {
    takeLease('a');
    releaseLease('a');
    expect(takeLease('a')).toBe(true);
  });

  it('is free again once it has expired', () => {
    takeLease('a');
    expect(leaseHeld('a', Date.now() + LEASE_MS - 1), 'still held a moment before').toBe(true);
    expect(leaseHeld('a', Date.now() + LEASE_MS + 1), 'gone a moment after').toBe(false);
    expect(takeLease('a', Date.now() + LEASE_MS + 1)).toBe(true);
  });

  it('keeps two different claims apart', () => {
    expect(takeLease('a')).toBe(true);
    expect(takeLease('b'), 'a different operation is not blocked').toBe(true);
  });

  it('releasing one that was never taken is harmless', () => {
    expect(() => releaseLease('never')).not.toThrow();
    expect(takeLease('never')).toBe(true);
  });

  /**
   * The list does not grow with the wreckage.
   *
   * Expired claims are dropped whenever one is taken, so a deployment that
   * crashed a thousand times does not leave a thousand rows in a file every
   * request parses.
   */
  it('drops expired claims rather than accumulating them', () => {
    for (let index = 0; index < 50; index += 1) takeLease(`stale-${index}`);
    expect(readState().leases).toHaveLength(50);

    takeLease('fresh', Date.now() + LEASE_MS + 1);

    expect(readState().leases.map((lease) => lease.key)).toEqual(['fresh']);
  });

  /**
   * And a claim from before leases existed — a bare string with no timestamp —
   * is not honoured. Those are precisely the stuck claims this replaces, so
   * treating them as expired is the migration and the recovery at once.
   */
  it('ignores a claim written before claims had a time on them', () => {
    mutateState((state) => {
      (state.leases as unknown[]).push('handoff:O-1:pos');
    });

    expect(takeLease('handoff:O-1:pos')).toBe(true);
  });
});

describe('two callers arriving together', () => {
  /** The race the claim exists for, which still has to hold. */
  it('reaches the till once', async () => {
    const order = await placeOrder();
    const pos = acceptingPos();

    await Promise.all([pushToPos(order, pos), pushToPos(order, pos), pushToPos(order, pos)]);

    expect(pos.pushOrder).toHaveBeenCalledTimes(1);
  });

  it('leaves no claim behind once they are done', async () => {
    const order = await placeOrder();
    await Promise.all([pushToPos(order, acceptingPos()), pushToPos(order, acceptingPos())]);

    expect(readState().leases, 'the winner released it').toEqual([]);
  });
});
