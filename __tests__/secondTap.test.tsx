import { readFileSync } from 'node:fs';
import path from 'node:path';
import { act, renderHook } from '@testing-library/react-native';

import { useOnce } from '@/features/system/useOnce';

const root = path.join(__dirname, '..');
const read = (file: string) => readFileSync(path.join(root, file), 'utf8');

const code = (file: string) =>
  read(file)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

/*
  ───────────────────────────────────────────────────────────────────────────
  The second tap.

  A phone that is thinking looks exactly like a phone that missed the tap, so
  people tap again. Until this round one control in the app was protected
  against it — checkout, with a ref and a comment explaining why the button's
  own disabled state was not enough.

  It is not enough because `loading={mutation.isPending}` is a *rendered*
  guard: it refuses the second tap only once React has committed and painted
  the first. Driven rather than argued — `npm run audit:double-tap` presses
  each control twice and counts what the stub is asked for:

    redeeming a reward         2 × POST /v1/loyalty/redeem
    saving a new address       2 × POST /v1/account/addresses
    sending a support message  2 × POST /v1/support/messages
    rating an order            2 × POST /v1/orders/:id/rating

  Two taps in one tick, two requests, every time. The same taps 70ms apart sent
  one — so the rendered guard does catch a human double-tap on this hardware,
  on this build, on a good day. That is not a property to rely on for a control
  that spends a thousand points.
  ───────────────────────────────────────────────────────────────────────────
*/

/** A promise somebody else decides when to settle. */
function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/**
 * FIXTURE 1 — the second call, while the first is still running.
 */
describe('1 — one at a time', () => {
  it('ignores a call that arrives before the first has finished', async () => {
    const gate = deferred();
    let ran = 0;
    const { result } = renderHook(() =>
      useOnce(async () => {
        ran += 1;
        await gate.promise;
      }),
    );

    await act(async () => {
      void result.current();
      void result.current();
      void result.current();
    });

    expect(ran).toBe(1);

    await act(async () => {
      gate.resolve();
    });
  });

  it('is not a lock — a later, deliberate tap runs', async () => {
    // Somebody who redeems, watches it land, and does it again on purpose is
    // entitled to. This guards re-entry, not repetition.
    let ran = 0;
    const { result } = renderHook(() =>
      useOnce(async () => {
        ran += 1;
      }),
    );

    await act(async () => {
      await result.current();
    });
    await act(async () => {
      await result.current();
    });

    expect(ran).toBe(2);
  });

  it('passes the arguments through untouched', async () => {
    const seen: unknown[][] = [];
    const { result } = renderHook(() =>
      useOnce((...args: unknown[]) => {
        seen.push(args);
      }),
    );

    await act(async () => {
      await result.current('reward-r20', 400);
    });

    expect(seen).toEqual([['reward-r20', 400]]);
  });
});

/**
 * FIXTURE 2 — the release, which is the whole reason this is a hook.
 *
 * Checkout's version raised a ref at the top and lowered it by hand: once in
 * the `finally`, and once on each early return that happened before the `try`.
 * One of those was missing. A tap blocked by a branch that had just closed
 * left the ref raised for the life of the screen — the button dead, silently,
 * for a customer who had been told to pick a later slot and was doing exactly
 * that. Found by a security review of this repository, as a functional note.
 *
 * A `finally` around the whole handler cannot make that mistake, because there
 * is no path out of the function that skips it. These two fixtures are that
 * claim, stated as the two ways out that are easy to forget.
 */
describe('2 — every way out releases it', () => {
  it('releases after a handler that returns early', async () => {
    let ran = 0;
    const { result } = renderHook(() =>
      useOnce(() => {
        ran += 1;
        // The blocked tap: nothing awaited, nothing sent, straight back out.
        return;
      }),
    );

    await act(async () => {
      await result.current();
    });
    await act(async () => {
      await result.current();
    });

    expect(ran).toBe(2);
  });

  it('releases after a handler that throws, and still throws', async () => {
    let ran = 0;
    const { result } = renderHook(() =>
      useOnce(async () => {
        ran += 1;
        await Promise.resolve();
        throw new Error('the card was declined');
      }),
    );

    await act(async () => {
      await expect(result.current()).rejects.toThrow('the card was declined');
    });
    await act(async () => {
      await expect(result.current()).rejects.toThrow('the card was declined');
    });

    // Twice: a failed attempt is exactly the one somebody tries again.
    expect(ran).toBe(2);
  });

  it('keeps the release in a finally rather than on each path', () => {
    // The structural version of the two fixtures above: if somebody ever
    // "simplifies" this into a release at the end of the happy path, the
    // checkout bug comes back and these behavioural tests are the only thing
    // standing between it and a customer.
    expect(code('src/features/system/useOnce.ts')).toMatch(
      /} finally \{\s*running\.current = false;/,
    );
  });
});

/**
 * FIXTURE 3 — one mechanism, not five copies of a ref.
 *
 * Derived from the source: every handler passed to a control that writes has
 * to come through the hook. Checkout included — its ref is gone, and the
 * reasoning it carried is in the hook where the other four can read it.
 */
describe('3 — every write goes through it', () => {
  const WRITES: [string, string][] = [
    ['src/app/checkout/index.tsx', 'attemptOrder'],
    ['src/app/rewards/[id].tsx', 'redeem'],
    ['src/app/checkout/address.tsx', 'save'],
    ['src/app/account/contact.tsx', 'submit'],
    ['src/app/order/[id]/rate.tsx', 'submit'],
  ];

  it.each(WRITES)('%s wraps %s', (file, handler) => {
    const source = code(file);

    expect(source).toMatch(/import \{ useOnce \} from '@\/features\/system\/useOnce';/);
    expect(source).toContain(`useOnce(${handler})`);
  });

  it('leaves no hand-rolled guard behind to disagree with it', () => {
    // `inFlight` was checkout's, and it is the name to watch for: a second
    // mechanism for one rule is how the two drift apart.
    for (const [file] of WRITES) {
      expect(code(file)).not.toMatch(/inFlight/);
    }
  });

  it("keeps the button's loading state as well, because they do different jobs", () => {
    // The hook stops the request; `loading` is what tells the customer
    // anything is happening at all. Dropping either would be worse.
    expect(code('src/app/rewards/[id].tsx')).toMatch(/loading=\{redeemReward\.isPending\}/);
    expect(code('src/app/account/contact.tsx')).toMatch(/loading=\{sendMessage\.isPending\}/);
  });
});

/**
 * FIXTURE 4 — the sweep that found it, and the control that makes it mean
 * something.
 */
describe('4 — audit:double-tap', () => {
  const audit = read('scripts/audit-double-tap.mjs');

  it('is registered so it runs', () => {
    const scripts = JSON.parse(read('package.json')).scripts as Record<string, string>;
    expect(scripts['audit:double-tap']).toBe('node scripts/audit-double-tap.mjs');
  });

  it('taps both ways, because they measure different things', () => {
    // Same tick is the version a rendered guard cannot see; 70ms is the one a
    // person actually performs. Only one of them was ever failing.
    expect(audit).toMatch(/'same tick':/);
    expect(audit).toMatch(/'70ms':/);
  });

  it('makes the reply slow enough for a second tap to land', () => {
    // Without the delay the first request would be finished before anybody
    // could tap again and every case would pass for the emptiest reason.
    expect(audit).toMatch(/const WRITE_DELAY_MS = \d+;/);
    expect(audit).toMatch(/a slow reply is what gives the second tap somewhere to/i);
  });

  it('counts requests rather than reading the screen', () => {
    // What two taps cost is measured at the server, because the screen shows
    // one discount either way — which is exactly what makes this invisible.
    expect(audit).toMatch(/asked\.filter\(\(request\) => request === testCase\.writes\)\.length/);
  });

  it('carries a control that was already protected', () => {
    expect(audit).toMatch(/control: true/);
  });
});

/**
 * FIXTURE 5 — the crash the stub found on the way past.
 *
 * The reward screen rendered "Something broke" against a backend that simply
 * did not send `termsAndConditions`. `wireChecks` is right not to check it —
 * that file covers "the numbers it does arithmetic on, the ids it looks things
 * up by", and a terms list is neither — so the fix belongs where the value is
 * read. Three more screens had the same shape, including order tracking, which
 * is the screen a hungry person is staring at.
 *
 * An absent list is a gap in the data. A crash screen is a claim about the app.
 */
describe('5 — a missing list is not a broken app', () => {
  const READS: [string, string][] = [
    ['src/app/rewards/[id].tsx', 'data.termsAndConditions ?? []'],
    ['src/app/offers/[id].tsx', 'data.terms ?? []'],
    ['src/app/order/[id]/index.tsx', 'data.timeline ?? []'],
    ['src/app/order/[id]/index.tsx', 'data.lines ?? []'],
  ];

  it.each(READS)('%s defaults %s', (file, guarded) => {
    expect(code(file)).toContain(guarded);
  });

  it('leaves the wire checks alone, because they are right', () => {
    // The temptation is to "fix" this by checking the field on the wire. That
    // would make `wireChecks` a schema, which its own opening paragraph says
    // it deliberately is not.
    const checks = read('src/services/wireChecks.ts');

    expect(checks).not.toMatch(/termsAndConditions/);
    expect(checks).toMatch(/the numbers it does arithmetic on, the ids it looks things up by/);
  });
});
