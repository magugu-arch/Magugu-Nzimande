import { readFileSync, renameSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PRODUCTS } from '@bbq/seed';
import type { Order, PaymentIntent, ServiceMode } from '@bbq/types';
import type { StoredAccount } from './accounts/store';
import type { HandoffRecord } from './fulfilment/handoff';
import type { Suppressed } from './notifications/suppression';
import { withLock } from './state-lock';

/**
 * The stand-in for Postgres, until /services/api exists.
 *
 * It is a single JSON file rather than a module-level Map because the server
 * runs several worker processes: an order placed through a route handler in one
 * worker is invisible to a page rendered in another, which showed up as an
 * operations console whose queue was empty until its first poll.
 *
 * Every read re-reads the file and every write replaces it atomically, so the
 * workers agree about what is there.
 *
 * Atomic writes were never the hard part. The read-modify-write around them
 * was: two workers both read, both changed their own copy, and the second write
 * replaced the first. An operator switching a product off while another
 * cancelled an order lost one of the two silently, and the file looked
 * perfectly consistent afterwards because each individual write had been
 * atomic. `mutateState` now holds a cross-process lock for the whole sequence.
 *
 * It is still a stopgap and not a design. There is no rollback, no query, no
 * index, and a change that throws halfway leaves the object half-modified in
 * memory. What it no longer does is lose an edit.
 */

export type AuditEntry = { at: string; who: string; what: string };

export type DemoState = {
  soldOut: string[];
  hidden: string[];
  services: Record<string, Partial<Record<ServiceMode, boolean>>>;
  orders: Order[];
  sequence: number;
  audit: AuditEntry[];
  /**
   * Failed console sign-ins, here rather than in a module variable for the
   * same reason as everything else in this file: the workers have to agree, or
   * a lockout is five attempts *per worker*.
   */
  consoleLock: { failures: number; lockedUntil: string | null };
  /**
   * Payment intents, and the ids of the provider events already applied to
   * them. The second list is what stops a redelivered callback settling an
   * order twice, so it is state rather than a cache and belongs in the file
   * every worker reads.
   */
  payments: { intents: PaymentIntent[]; appliedEvents: string[] };
  /**
   * Customer accounts, password hashes included. The one part of this file
   * that would matter if it leaked, which is why the hashes are scrypt and not
   * something reversible.
   */
  accounts: StoredAccount[];
  /**
   * Ids of messages already delivered. What stops a retried request sending a
   * customer the same "on its way" twice.
   */
  notifications: {
    sent: string[];
    /**
     * Mailgun webhook tokens already acted on. Their signature covers the
     * timestamp and token rather than the body, so single use is what stops a
     * captured triple being replayed inside the freshness window — and a replay
     * guard one worker keeps to itself is not a guard.
     */
    webhookTokens: string[];
  };
  /**
   * Every attempt to hand an order to the kitchen system or a courier, with
   * its outcome. Kept so the end-of-service question — which orders did the
   * kitchen never see — has an answer that is not "ask the customers".
   */
  fulfilment: {
    handoffs: HandoffRecord[];
    /**
     * Handoffs being attempted right now, as `orderId:kind`.
     *
     * A claim taken before an adapter is called and released after, so two
     * callers cannot both find no successful record and both push the same
     * order at the till. Held here rather than in memory because the server
     * runs several workers, and a claim one of them holds is a claim the
     * others cannot see.
     */
    inFlight: string[];
  };
  /**
   * Live password resets. Only a hash of each token is here: a leaked copy of
   * this file is then a list of useless strings rather than a way into every
   * account on it.
   */
  passwordResets: { accountId: string; tokenHash: string; expiresAt: number }[];
  /**
   * Addresses we must stop emailing. A hard bounce is a deliverability
   * obligation; a complaint is a legal one. Both live here; a soft bounce does
   * not, because a mailbox that was full this morning works this afternoon.
   */
  suppressed: Suppressed[];
};

/**
 * Read per call rather than captured at import. The value was cached in a
 * module constant, so anything that set the variable after this module first
 * loaded was silently ignored — which made two test files sharing one temp
 * file impossible to separate, and would have done the same to a process that
 * reconfigured itself at runtime.
 */
function stateFile(): string {
  return process.env.BBQ_STATE_FILE ?? path.join(os.tmpdir(), 'bbq-chicken-demo-state.json');
}

function seed(): DemoState {
  return {
    soldOut: [],
    hidden: [],
    services: {},
    orders: [],
    sequence: 0,
    consoleLock: { failures: 0, lockedUntil: null },
    payments: { intents: [], appliedEvents: [] },
    accounts: [],
    notifications: { sent: [], webhookTokens: [] },
    fulfilment: { handoffs: [], inFlight: [] },
    passwordResets: [],
    suppressed: [],
    audit: [
      {
        at: new Date().toISOString(),
        who: 'system',
        // Counted rather than written down. It said sixteen for as long as the
        // menu had sixteen products on it and went quietly wrong the first time
        // one was added — the kind of stale number an operator reads and
        // believes, because the rest of the log is generated.
        what: `Demo catalogue loaded (${PRODUCTS.length} products)`,
      },
    ],
  };
}

/**
 * Every list the seed declares, still a list.
 *
 * The spreads below fill in a key the file has never heard of, which is what
 * makes an older deployment's file readable by a newer one. They do nothing
 * about a key the file *has* and got wrong — `"handoffs": null` from a
 * truncated write or somebody debugging by hand replaces an array with null,
 * and the next read of the shortfall report throws on `.filter`.
 *
 * The seed is the shape. Anything that should be a list and is not becomes the
 * empty one it started as: losing a corrupt list is recoverable, and refusing
 * to start is not.
 */
function listsIntact<T extends object>(merged: T, base: T): T {
  const fixed = { ...merged };
  for (const key of Object.keys(base) as (keyof T)[]) {
    if (Array.isArray(base[key]) && !Array.isArray(fixed[key])) fixed[key] = base[key];
  }
  return fixed;
}

export function readState(): DemoState {
  try {
    const raw = readFileSync(stateFile(), 'utf8');
    const parsed = JSON.parse(raw) as Partial<DemoState>;
    const base = seed();

    return listsIntact({
      ...base,
      ...parsed,
      // The nested groups are merged a level deeper rather than replaced.
      //
      // A spread fills in a key the file has never heard of, which is what
      // makes an older deployment's file readable by a newer one. It does
      // nothing for a key the file *does* have but only half of: a file written
      // when payments held only intents would replace the whole group and take
      // appliedEvents with it, and the list that stops a redelivered callback
      // settling an order twice would come back undefined.
      consoleLock: { ...base.consoleLock, ...parsed.consoleLock },
      payments: listsIntact({ ...base.payments, ...parsed.payments }, base.payments),
      notifications: listsIntact(
        { ...base.notifications, ...parsed.notifications },
        base.notifications,
      ),
      fulfilment: listsIntact({ ...base.fulfilment, ...parsed.fulfilment }, base.fulfilment),
    }, base);
  } catch {
    // Missing or unreadable on the first request of a fresh deployment.
    return seed();
  }
}

export function writeState(next: DemoState): void {
  try {
    // Written beside the target and renamed, so a reader never catches a
    // half-written file.
    const file = stateFile();
    const temporary = `${file}.${process.pid}.tmp`;
    writeFileSync(temporary, JSON.stringify(next), 'utf8');
    renameSync(temporary, file);
  } catch {
    // A read-only filesystem costs the console its writes, not the storefront
    // its ability to take orders.
  }
}

export function mutateState<T>(change: (state: DemoState) => T): T {
  return withLock(stateFile(), () => {
    const state = readState();
    const result = change(state);
    writeState(state);
    return result;
  });
}

/** Newest first, and bounded: an unbounded log in a long-lived process is a leak. */
export function pushAudit(state: DemoState, who: string, what: string): void {
  state.audit.unshift({ at: new Date().toISOString(), who, what });
  if (state.audit.length > 200) state.audit.length = 200;
}
