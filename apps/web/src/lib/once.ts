import { mutateState, readState, type DemoState } from './demo-state';

/**
 * "Have I seen this before?", asked and answered in one operation.
 *
 * Three places in this application keep a list of things already dealt with, so
 * that a gateway redelivering a callback, Mailgun redelivering a bounce, or an
 * operator pressing a button twice is harmless. All three were written the same
 * way, and all three were wrong in the same way:
 *
 *     if (alreadySeen(key)) return;   // one read
 *     remember(key);                  // a separate write
 *     …act…
 *
 * Two arriving together both read "no", both write, and both act. The write was
 * careful — each `remember` re-checked inside its own mutation and refused to
 * add a duplicate — so the *lists* never showed the problem. The duplication
 * happened in the callers, which had already decided.
 *
 * A claim has to be one operation or it is not a claim. That is the same lesson
 * the till handoff and the refund each learned separately, and it is why
 * `mutateState` takes the cross-process lock for the whole read-modify-write:
 * the question and the answer have to be on the same side of it.
 *
 * `claimOnce` returns true to exactly one caller. Everybody else gets false and
 * is expected to do nothing — not to throw, because a redelivery is the ordinary
 * case rather than a fault.
 */

type Ledger = {
  /** The list inside the state, which is where it has to live: several workers. */
  of: (state: DemoState) => string[];
  /** How many keys to keep. An unbounded ledger in a long-lived process leaks. */
  keep: number;
};

/**
 * The three, with their bounds in one table rather than one per call site.
 *
 * Each bound only has to outlive the redeliveries that would duplicate a key:
 * a gateway retries for hours, Mailgun's token only has to outlive the
 * freshness window its signature already enforces, and a message id only has to
 * outlive the retry that would send it twice.
 */
const LEDGERS: Record<string, Ledger> = {
  paymentEvents: { of: (state) => state.payments.appliedEvents, keep: 1_000 },
  messages: { of: (state) => state.notifications.sent, keep: 2_000 },
  webhookTokens: { of: (state) => state.notifications.webhookTokens, keep: 1_000 },
};

export type LedgerName = keyof typeof LEDGERS;

/**
 * Claims `key` in `ledger`. True only for the caller that claimed it.
 *
 * Everything — the check, the write and the trim — happens inside one
 * `mutateState`, which holds the lock across all three.
 */
export function claimOnce(ledger: LedgerName, key: string): boolean {
  const { of, keep } = LEDGERS[ledger] as Ledger;

  return mutateState((state) => {
    const held = of(state);
    if (held.includes(key)) return false;

    held.push(key);
    // `while` rather than a single shift: a bound lowered in this table would
    // otherwise take one delivery per excess key to come back into line.
    while (held.length > keep) held.shift();
    return true;
  });
}

/**
 * Whether a key has been claimed, without claiming it.
 *
 * For reporting only — a console counting what it has already handled. Never
 * for deciding whether to act: that is the split this module exists to remove,
 * and a caller that reads this and then acts has rebuilt it.
 */
export function alreadyClaimed(ledger: LedgerName, key: string): boolean {
  const { of } = LEDGERS[ledger] as Ledger;
  return of(readState()).includes(key);
}
