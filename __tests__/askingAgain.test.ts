import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
  ApiRequestError,
  isConflict,
  isRateLimited,
  isRefused,
  worthRetrying,
} from '@/services/apiClient';
import { submitOrder } from '@/features/checkout/submitOrder';
import type { AuthorisePaymentInput } from '@/services/paymentService';
import type { PlaceOrderInput } from '@/types';

const root = path.join(__dirname, '..');
const read = (file: string) => readFileSync(path.join(root, file), 'utf8');

const code = (file: string) =>
  read(file)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

/*
  ───────────────────────────────────────────────────────────────────────────
  How many times the app asks after it has been told.

  `_layout.tsx` reasoned about this correctly, for one status, and wrote it
  down: "a not-found is an answer, not a hiccup: asking three times cannot make
  a delisted item or a closed campaign exist, and it costs the customer the
  backoff — seconds of spinner before a screen that was ready to tell them
  straight away."

  Every word of that is true of a 403 — which the screens learned to read last
  round while the retry policy did not — and a 429 is worse than pointless: a
  rate limit is the server asking the app to stop, and answering with two more
  requests is the one response guaranteed to make it worse, at the moment the
  backend is least able to absorb it.

  Counted rather than argued. `npm run audit:answers` refuses one path with one
  status and counts what the stub is asked for:

      404   1   the case the policy was written for
      403   3   ← should be 1
      429   3   ← should be 1
      500   3   correct, and the control

  The 500 is what keeps the rest honest. This is not "stop retrying"; it is
  "stop retrying an answer".
  ───────────────────────────────────────────────────────────────────────────
*/

const answer = (status: number) => new ApiRequestError({ code: 'x', message: 'no', status });

/**
 * FIXTURE 1 — what is an answer, and what is the app not knowing yet.
 */
describe('1 — asking again, and when it could help', () => {
  it('does not re-ask an answer', () => {
    expect(worthRetrying(answer(404))).toBe(false);
    expect(worthRetrying(answer(403))).toBe(false);
  });

  it('does not argue with a rate limit', () => {
    expect(worthRetrying(answer(429))).toBe(false);
    expect(isRateLimited(answer(429))).toBe(true);
  });

  it('still retries everything that is the app not knowing yet', () => {
    for (const status of [500, 502, 503, 504]) {
      expect(worthRetrying(answer(status))).toBe(true);
    }
    // And the failures that never reached a server at all.
    expect(worthRetrying(new Error('Network request failed'))).toBe(true);
    expect(worthRetrying(undefined)).toBe(true);
  });

  it('keeps a rate limit and a refusal as two questions', () => {
    // They lead to the same decision here and would not lead to the same
    // sentence on a screen: one is about this thing and this customer, the
    // other is about how hard the app is pushing.
    expect(isRefused(answer(429))).toBe(false);
    expect(isRateLimited(answer(403))).toBe(false);
  });

  it('is the one predicate the query client reads', () => {
    const layout = code('src/app/_layout.tsx');

    expect(layout).toMatch(
      /retry: \(failureCount, error\) => worthRetrying\(error\) && failureCount < 2/,
    );
    // The old narrower question is gone from the policy entirely.
    expect(layout).not.toMatch(/isNotFound/);
  });

  it('leaves mutations alone, which never retried', () => {
    // A write that may have landed must not be sent again by a policy. That
    // was already right and this round must not have changed it.
    expect(code('src/app/_layout.tsx')).toMatch(/mutations: \{ retry: 0/);
  });
});

/**
 * FIXTURE 2 — the conflict, which is the most expensive status in the app.
 *
 * Checkout authorises the card and then creates the order, sending an attempt
 * key so a retry cannot become two orders. A backend that has seen that key
 * before has an obvious way to say so — 409 — and every branch below the
 * create used to treat a failure as "the order does not exist" and release the
 * authorisation.
 *
 * On a 409 that is the worst available guess. If the order does exist, the app
 * has taken the payment off an order the kitchen is cooking and told the
 * customer their card was not charged.
 */
describe('2 — a conflict is not a failure the app may undo', () => {
  const payment = { amount: 186 } as unknown as AuthorisePaymentInput;
  const order = { storeId: 'store-1' } as unknown as PlaceOrderInput;

  it('recognises the status', () => {
    expect(isConflict(answer(409))).toBe(true);
    expect(isConflict(answer(400))).toBe(false);
  });

  it('never releases the authorisation on a conflict', async () => {
    let released = 0;

    const outcome = await submitOrder(payment, order, {
      authorise: async () => ({ success: true, intentId: 'pi_1' }),
      place: async () => {
        throw answer(409);
      },
      release: async () => {
        released += 1;
        return true;
      },
    });

    expect(released).toBe(0);
    expect(outcome.status).toBe('uncertain');
  });

  it('makes no claim about whether the order exists', async () => {
    const outcome = await submitOrder(payment, order, {
      authorise: async () => ({ success: true, intentId: 'pi_1' }),
      place: async () => {
        throw answer(409);
      },
      release: async () => true,
    });

    const message = 'message' in outcome ? outcome.message : '';
    expect(message).toMatch(/could not confirm/i);
    // The two sentences it must never say here.
    expect(message).not.toMatch(/was not charged/i);
    expect(message).not.toMatch(/did not go through/i);
    // And it points them at the one place that can settle it.
    expect(message).toMatch(/check your orders/i);
  });

  it('still releases, and still says so, when the order really did fail', async () => {
    // The control. A 500 on the create is the old path and must be unchanged:
    // release the hold, and tell the customer their card was not charged.
    let released = 0;

    const outcome = await submitOrder(payment, order, {
      authorise: async () => ({ success: true, intentId: 'pi_1' }),
      place: async () => {
        throw answer(500);
      },
      release: async () => {
        released += 1;
        return true;
      },
    });

    expect(released).toBe(1);
    expect(outcome.status).toBe('reversed');
    expect('message' in outcome ? outcome.message : '').toMatch(/was not charged/i);
  });

  it('still strands the customer honestly when the release fails', async () => {
    const outcome = await submitOrder(payment, order, {
      authorise: async () => ({ success: true, intentId: 'pi_1' }),
      place: async () => {
        throw answer(500);
      },
      release: async () => false,
    });

    expect(outcome.status).toBe('stranded');
  });
});

/**
 * FIXTURE 3 — what 409 means is not mine to decide.
 *
 * The app takes the safe reading. Which reading is *right* is a backend
 * contract, and inventing a response shape for an endpoint nobody has
 * specified would be designing somebody else's API.
 */
describe('3 — the blocker that comes with it', () => {
  it('is carried by the launch audit rather than guessed at in code', () => {
    const audit = read('scripts/audit-launch-readiness.mjs');

    expect(audit).toContain('What a conflict means when an order is created');
    expect(audit).toMatch(/two plausible readings and they are opposites/);
  });

  it('says in the code that the reading is provisional and why it is safe', () => {
    const submit = read('src/features/checkout/submitOrder.ts');

    expect(submit).toMatch(/is a backend decision and is not\s+\* mine to invent/);
    expect(submit).toMatch(/never voids a payment for an order that might be real/);
  });
});

/**
 * FIXTURE 4 — the sweep, and the control that makes its green a measurement.
 */
describe('4 — audit:answers', () => {
  const audit = read('scripts/audit-answers.mjs');

  it('is registered so it runs', () => {
    const scripts = JSON.parse(read('package.json')).scripts as Record<string, string>;
    expect(scripts['audit:answers']).toBe('node scripts/audit-answers.mjs');
  });

  it('counts attempts at the server rather than reading the screen', () => {
    // Three attempts and one attempt look identical to a customer. The only
    // place the difference exists is in what the backend was asked.
    expect(audit).toMatch(/asked \+= 1;/);
  });

  it('carries a status that must still be retried', () => {
    expect(audit).toMatch(/a 500 — transient, and worth asking again/);
    expect(audit).toMatch(/attempts: 3/);
  });

  it('drives one route for every status, so only the status varies', () => {
    expect(audit).toMatch(/const ROUTE = '\/order\/order-answers';/);
    expect(audit).toMatch(/otherwise a difference in attempts could be a difference in how many/);
  });

  it('waits out the backoff before counting', () => {
    // A case that stopped watching too early would report one attempt and
    // call it a pass, which is the shape of every measurement bug this
    // repository has found in its own sweeps.
    expect(audit).toMatch(/await page\.waitForTimeout\(10000\);/);
  });
});
