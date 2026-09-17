import { beforeEach, describe, expect, it } from 'vitest';
import { readState } from '@/lib/demo-state';
import { claimOnce } from '@/lib/once';
import { notifyMoved } from '@/lib/notifications/send';
import { setOrderStatus } from '@/lib/order-store';
import {
  blankState,
  bodyOf,
  concurrently,
  customer,
  placeOrder,
  required,
  signedBounce,
  webFile,
  withMailgunKey,
  withoutComments,
} from './fixtures';

/**
 * "Have I seen this before?", asked three times in three places.
 *
 * A gateway redelivers a callback it got no acknowledgement for. Mailgun
 * redelivers a bounce. An operator presses a button twice. Each of the three
 * ledgers that exist to make those harmless was written the same way:
 *
 *     if (alreadySeen(key)) return;     // one read
 *     remember(key);                    // a separate write
 *     …act…
 *
 * Two of anything arriving together both read "no", both write, and both act.
 * The check and the claim have to be one operation or they are not a claim at
 * all — which is the same lesson the till handoff and the refund each learned
 * separately, and the reason `withLock` exists at the bottom of this codebase.
 *
 * Each of the three carried a comment promising the property the code did not
 * have. The payment ledger's was the most specific: "recorded in the same
 * mutation as the change, so a redelivery cannot slip between the two and apply
 * twice." The recording was. The *checking* was not.
 *
 * WHAT THESE TESTS PROVE, AND WHAT THEY DO NOT.
 *
 * The window is between workers, not inside one. In a single process nothing
 * yields between the read and the write — the first caller runs both before the
 * second starts — so the `concurrently` cases below pass on the broken code
 * too. They were run against it to check, and they did. They are kept because a
 * gateway's redelivery is usually sequential and they catch a claim that has
 * stopped claiming at all, but they are regression guards rather than proof.
 *
 * The proof is in two parts and neither half stands alone. `mutateState` is
 * mutually exclusive across processes — tests/state-lock.test.ts spawns four
 * real workers and shows the increments that go missing without it. And every
 * claim here decides and writes inside one `mutateState`, which is structural
 * and is checked below. The lock makes the mutation atomic; the structure puts
 * the whole decision inside it.
 */

beforeEach(blankState);

describe('claiming a key', () => {
  it('is true for the first caller', () => {
    expect(claimOnce('messages', 'a-key')).toBe(true);
  });

  it('is false for every caller after', () => {
    claimOnce('messages', 'a-key');
    expect(claimOnce('messages', 'a-key')).toBe(false);
    expect(claimOnce('messages', 'a-key')).toBe(false);
  });

  /**
   * Ten callers in one process, which is the easy half: nothing yields between
   * the check and the write, so this would hold even if they were separate
   * operations. It is here to catch a claim that has stopped claiming.
   */
  it('is true exactly once when everybody asks at once', async () => {
    const claims = await concurrently(10, async () => claimOnce('messages', 'one-key'));

    expect(claims.filter(Boolean)).toHaveLength(1);
  });

  it('keeps the three ledgers apart', () => {
    expect(claimOnce('messages', 'shared-key')).toBe(true);
    expect(claimOnce('paymentEvents', 'shared-key'), 'a different ledger').toBe(true);
    expect(claimOnce('webhookTokens', 'shared-key'), 'and a third').toBe(true);
  });

  /**
   * Bounded, like the lists it replaces. An unbounded ledger in a long-lived
   * process is a leak, and an old key only has to outlive the redeliveries that
   * would duplicate it.
   */
  it('drops the oldest keys rather than growing for ever', () => {
    for (let n = 0; n < 1_100; n += 1) claimOnce('paymentEvents', `event-${n}`);

    const held = readState().payments.appliedEvents;
    expect(held.length).toBeLessThanOrEqual(1_000);
    expect(held, 'the newest is kept').toContain('event-1099');
    expect(held, 'the oldest is not').not.toContain('event-0');
  });
});

/**
 * The messaging ledger, which is the one a customer feels — two "your order is
 * on its way" messages for one order, and they stop trusting all of them.
 *
 * `send` checked `alreadySent`, then marked, then delivered. `markSent` re-read
 * the list inside its own mutation and refused to add a duplicate — so the
 * *list* never showed the problem, and a second worker that had already passed
 * the check delivered anyway. The guard was in the write and the decision was
 * in the caller.
 */
describe('sending the same message again', () => {
  async function aReadyOrder() {
    const order = await placeOrder();
    return required(setOrderStatus(order.id, 'ready'), 'a ready order');
  }

  it('delivers it once, however many times it is asked', async () => {
    const order = await aReadyOrder();
    const sent = await concurrently(2, () => notifyMoved(order));

    expect(sent.reduce((total, count) => total + count, 0), 'messages actually sent').toBe(1);
  });

  it('records it once', async () => {
    const order = await aReadyOrder();
    await concurrently(4, () => notifyMoved(order));

    const ids = readState().notifications.sent;
    expect(new Set(ids).size).toBe(ids.length);
  });

  /** And a later, separate send of the same event is still refused. */
  it('and refuses it again afterwards', async () => {
    const order = await aReadyOrder();
    await notifyMoved(order);

    expect(await notifyMoved(order)).toBe(0);
  });
});

/**
 * The bounce webhook, where a replay costs an address rather than a message.
 *
 * Mailgun redelivers anything it did not get a 200 for, and the token is the
 * single-use half of its signature scheme — the freshness window is the other.
 */
describe('a bounce delivered twice at once', () => {
  it('acts on it once', async () => {
    await withMailgunKey(async () => {
      const { POST } = await import('@/app/api/notifications/webhook/route');
      const token = 'a-token-delivered-twice';

      const answers = await concurrently(2, () =>
        POST(
          signedBounce(
            { event: 'failed', severity: 'permanent', recipient: customer.email },
            { token },
          ),
        ),
      );

      const bodies = await Promise.all(answers.map((answer) => bodyOf<{ replayed?: boolean }>(answer)));
      expect(bodies.filter((body) => body.replayed !== true), 'acted on').toHaveLength(1);

      expect(readState().suppressed.filter((entry) => entry.address === customer.email)).toHaveLength(
        1,
      );
    });
  });
});

/**
 * The payment ledger. Its two guards — "already applied" and "already final" —
 * both read state the mutation then overwrote, so two callbacks arriving
 * together could each decide the payment was still open.
 *
 * The second half is the expensive one. PayFast sends PENDING and then
 * COMPLETE; two of those racing both read an unsettled intent, and whichever
 * mutation lands last decides what the customer paid.
 *
 * Structural, and deliberately so. The interleaving needs two workers holding
 * the file lock in turn, which is what tests/state-lock.test.ts spawns real
 * processes to prove; what can be checked here is that no decision is taken
 * outside the write that acts on it.
 */
describe('the payment ledger decides inside the write', () => {
  const source = withoutComments(webFile('src/lib/payments/ledger.ts'));
  const settle = source.slice(source.indexOf('export function settle'));
  const body = settle.slice(0, settle.indexOf('\n}'));

  /**
   * Stated as an absence of reads rather than as an ordering.
   *
   * The first version of this rule checked that nothing appeared *before* the
   * `mutateState` call, which a fresh `readState()` from inside the callback
   * satisfies while restoring the whole defect — a rule that was right about
   * where the text sat and wrong about where the value came from. Every fact
   * this function decides on has to come from the `state` it was handed.
   */
  it('reads nothing but the state it is writing', () => {
    expect(body, 'a second read is a second answer').not.toMatch(/\breadState\s*\(/);
    expect(body, 'and so is a helper that reads for it').not.toMatch(/\breadIntent\s*\(/);
  });

  it('makes all of it one mutation', () => {
    expect(body.match(/mutateState\(/g) ?? [], 'one lock, one decision').toHaveLength(1);
  });

  it('still checks both guards, and records the event with the change', () => {
    expect(body, 'the idempotency key').toContain('appliedEvents');
    expect(body, 'and the already-final guard').toContain('isSettled(');
  });
});

/**
 * The primitive itself, held to the same rule: everything inside one mutation,
 * nothing read outside it.
 */
describe('the claim primitive', () => {
  const source = withoutComments(webFile('src/lib/once.ts'));
  const claim = source.slice(source.indexOf('export function claimOnce'));
  const body = claim.slice(0, claim.indexOf('\n}'));

  it('is one mutation', () => {
    expect(body.match(/mutateState\(/g) ?? []).toHaveLength(1);
  });

  it('reads nothing outside it', () => {
    expect(body).not.toMatch(/\breadState\s*\(/);
  });
});

/**
 * Standing, over the three call sites. Each used to pair a read with a separate
 * write; a fourth written the same way would be the same defect again, and it
 * would pass every behavioural test in this file because nothing would be
 * asking about it.
 */
describe('nothing asks and then claims separately', () => {
  const SPLIT = /\b(alreadySent|tokenAlreadySeen|rememberToken|markSent)\s*\(/;

  /**
   * Read as code, not as prose. Each of these files explains in a comment what
   * it used to do and names the function it used to call, so a rule that reads
   * the whole file fails on the paragraph saying the defect is gone.
   */
  it('has retired the split guards', () => {
    for (const file of [
      'src/lib/notifications/send.ts',
      'src/lib/notifications/suppression.ts',
      'src/app/api/notifications/webhook/route.ts',
      'src/lib/payments/ledger.ts',
    ]) {
      expect(withoutComments(webFile(file)), `${file} still asks before claiming`).not.toMatch(
        SPLIT,
      );
    }
  });

  it('and both call sites claim through the one primitive', () => {
    expect(webFile('src/lib/notifications/send.ts')).toContain('claimOnce(');
    expect(webFile('src/app/api/notifications/webhook/route.ts')).toContain('claimOnce(');
  });

  /**
   * Calling it is not the same as believing it.
   *
   * A caller that claims and then decides on a separate read of the ledger has
   * the whole defect back while still passing every rule above — it holds the
   * primitive and ignores what it said. So the sending loop is held to what the
   * payment ledger is held to: it reads nothing about what it has already done.
   * `sentMessageIds` further down the file reads the list on purpose, for the
   * console, which is why this reads the one function rather than the file.
   */
  it('and neither reads the ledger for itself', () => {
    const source = withoutComments(webFile('src/lib/notifications/send.ts'));
    const sending = source.slice(source.indexOf('async function send('));
    const body = sending.slice(0, sending.indexOf('\n}'));

    expect(body, 'the claim is the answer').not.toMatch(/\breadState\s*\(/);
    expect(body, 'and the only one').not.toContain('notifications.sent');
  });
});
