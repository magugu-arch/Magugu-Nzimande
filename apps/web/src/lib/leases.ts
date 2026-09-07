import { mutateState } from './demo-state';

/**
 * Claims on operations that call an outside system, and that expire.
 *
 * Two places need the same thing: pushing an order to the till, and refunding a
 * payment. Both read some state, await a call to somebody else's server, and
 * then write — and two callers arriving in that window both found nothing done
 * and both acted. A kitchen reads one order twice as two of everything; a
 * gateway asked twice refunds twice, with our money.
 *
 * Both had a claim taken before the call. Both leaked.
 *
 * A claim was a bare string, taken before the call and removed after, and
 * nothing removed it if the process did not reach the line that does. The
 * comment on the old one said an abandoned claim would be "recovered by the
 * next deployment", which was wrong in the way that is worst: it sounded like a
 * plan. The claims live in the state file, so a restart reads them straight
 * back. The consequences were a permanently stuck order — never sent to the
 * till, every retry refused, and absent from the shortfall report because
 * nothing had failed — and a refund that answered "already done" for ever while
 * the payment sat there captured.
 *
 * So a claim carries the moment it was taken and is ignored once it is older
 * than the lease. Nothing has to notice a crash or run a sweep: the next caller
 * finds an expired claim and takes it. That is the only recovery that works
 * when the thing that failed is the process itself.
 */

/**
 * How long a claim is honoured.
 *
 * Comfortably longer than any call it guards — the POS and courier adapters
 * are HTTP requests to a local network or a gateway, and one still running
 * after two minutes has failed in some other way — and short enough that a
 * stuck order recovers the next time a cook presses retry rather than at the
 * next deployment.
 */
export const LEASE_MS = 120_000;

/**
 * Takes the claim if it is free, and says whether it was taken.
 *
 * One synchronous mutation, because `mutateState` holds a cross-process lock:
 * checking in one call and claiming in another is the race this exists to
 * close. Expired claims are dropped while we are here, so the list does not
 * grow with the wreckage of every process that ever died holding one.
 */
export function takeLease(key: string, now = Date.now()): boolean {
  return mutateState((state) => {
    state.leases = state.leases.filter((lease) => now - lease.at < LEASE_MS);

    if (state.leases.some((lease) => lease.key === key)) return false;
    state.leases.push({ key, at: now });
    return true;
  });
}

/** Releases a claim. Safe to call for one that has already expired. */
export function releaseLease(key: string): void {
  mutateState((state) => {
    state.leases = state.leases.filter((lease) => lease.key !== key);
  });
}

/** Whether a claim is currently held. For the tests, and for the console. */
export function leaseHeld(key: string, now = Date.now()): boolean {
  return mutateState((state) =>
    state.leases.some((lease) => lease.key === key && now - lease.at < LEASE_MS),
  );
}
