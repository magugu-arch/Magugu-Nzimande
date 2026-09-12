import { readFileSync } from 'node:fs';
import path from 'node:path';

import { ApiRequestError } from '@/services/apiClient';
import { MalformedResponse, checkedNotifications } from '@/services/wireChecks';
import { writeFailureMessage, writeOutcome } from '@/features/system/writeFailure';

const read = (file: string) => readFileSync(path.join(__dirname, '..', file), 'utf8');

const code = (file: string) =>
  read(file)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

/** A server that answered — any status at all means it decided. */
const refused = (status: number, message = 'That is not allowed right now.') =>
  new ApiRequestError({ code: `http_${status}`, message, status });

/** A request that never got an answer. */
const unreachable = () =>
  new ApiRequestError({
    code: 'network',
    message: "We can't reach bb.q right now. Check your connection and try again.",
  });

/*
  ───────────────────────────────────────────────────────────────────────────
  Ten states the app has always supported and nothing has ever put it in.

  `queryPhase` exists because screens were written to a pattern with a hole in
  it: swept against a dead API host, eleven of fourteen claimed something false
  rather than admitting they could not reach the server. Reads were fixed.

  Writes were never swept at all, and they are easy to miss for a reason worth
  naming: a failed read renders a wrong empty state, which is visible, while a
  failed write renders nothing, which looks exactly like a screen nobody has
  tapped yet. `audit:wire` reads what the customer is told when a response is
  bent — and every one of its eleven cases is a GET.
  ───────────────────────────────────────────────────────────────────────────
*/

/**
 * FIXTURE 1 — the distinction the whole file turns on.
 *
 * Not "it failed", but whether it might have happened anyway. A status means a
 * reply came back, so the server considered the request and said no. No status
 * means the answer was lost on the way home, and the write may well have been
 * carried out.
 */
describe('1 — refused, or never answered', () => {
  it('reads any status as a decision', () => {
    for (const status of [400, 401, 403, 404, 409, 422, 500, 503]) {
      expect(writeOutcome(refused(status))).toBe('refused');
    }
  });

  it('reads a transport failure as unreachable', () => {
    expect(writeOutcome(unreachable())).toBe('unreachable');
  });

  /**
   * And anything that is not this app's error at all. An aborted fetch, a
   * `TypeError` from a runtime without `fetch`, a rejection with a string in
   * it — none of them is evidence the server declined, so none may be
   * described as though it were.
   */
  it('treats an error it does not recognise as unreachable', () => {
    expect(writeOutcome(new TypeError('Failed to fetch'))).toBe('unreachable');
    expect(writeOutcome(new DOMException('Aborted', 'AbortError'))).toBe('unreachable');
    expect(writeOutcome('something went wrong')).toBe('unreachable');
    expect(writeOutcome(undefined)).toBe('unreachable');
  });
});

/**
 * FIXTURE 2 — the sentence that may only be said once.
 *
 * "Nothing has changed" is a claim about the server's state, and the app is
 * entitled to it exactly when the server answered. Saying it after a dropped
 * connection is the lie that gets a card deleted twice — the same mistake
 * `safeToRetry` exists to stop at the payment scale.
 */
describe('2 — what may be promised, and when', () => {
  it('says nothing changed when the server decided', () => {
    expect(writeFailureMessage(refused(403, ''), 'delete that card').message).toMatch(
      /nothing has changed/i,
    );
  });

  it('never says it when nobody knows', () => {
    const said = writeFailureMessage(unreachable(), 'delete that card');

    expect(said.message).not.toMatch(/nothing has changed/i);
    expect(said.message).toMatch(/may not have gone through/i);
    // And tells them what to do about not knowing.
    expect(said.message).toMatch(/have a look/i);
  });
});

/**
 * FIXTURE 3 — the server's own words, where there are any.
 *
 * A backend that says "This card is attached to an active subscription" knows
 * something no message written here could. Only on a refusal: a transport
 * failure's message is about sockets, and "Failed to fetch" is not an answer
 * to why a card could not be deleted.
 */
describe('3 — deferring to the backend when it explains itself', () => {
  it('quotes a refusal that came with a reason', () => {
    const said = writeFailureMessage(
      refused(409, 'This card is attached to an active subscription.'),
      'delete that card',
    );

    expect(said.message).toBe('This card is attached to an active subscription.');
  });

  it('falls back when the refusal came with nothing useful', () => {
    expect(writeFailureMessage(refused(500, '   '), 'delete that card').message).toMatch(
      /nothing has changed/i,
    );
  });

  it('does not quote a transport error at the customer', () => {
    const said = writeFailureMessage(unreachable(), 'delete that card');
    expect(said.message).not.toMatch(/check your connection and try again\.$/);
  });
});

/**
 * FIXTURE 4 — the title names what they were doing.
 *
 * "That didn't work" is the message this module exists to replace. The action
 * is passed in because only the screen knows what the customer thought they
 * were pressing, and it has to read as a sentence in both branches.
 */
describe('4 — naming the action', () => {
  it.each([
    ['delete that card', /We couldn’t delete that card/],
    ['change your default card', /We couldn’t change your default card/],
    ['remove that address', /We couldn’t remove that address/],
    ['mark that as read', /We couldn’t mark that as read/],
    ['send your message', /We couldn’t send your message/],
  ])('reads properly for %s', (action, expected) => {
    expect(writeFailureMessage(refused(403), action).title).toMatch(expected);
    expect(writeFailureMessage(unreachable(), action).title).toMatch(expected);
  });
});

/**
 * FIXTURE 5 — the contact form, which was the worst of the six.
 *
 * It `await`ed `mutateAsync` with no `catch` at all, so a rejection became an
 * unhandled promise: `track` never ran, `setTicketId` never ran, the button's
 * spinner stopped and the screen did not move. A customer reporting a wrong
 * order or a missing refund taps Send, watches nothing happen, and taps again
 * — and every attempt that later succeeds is another ticket for the same
 * complaint.
 */
describe('5 — a send that did not send', () => {
  const screen = code('src/app/account/contact.tsx');

  it('catches the rejection rather than leaving it unhandled', () => {
    expect(screen).toMatch(/try \{[\s\S]*sendMessage\.mutateAsync\(/);
    expect(screen).toMatch(/catch \(error\) \{[\s\S]*setSendFailure\(/);
  });

  it('does not report a ticket it never got', () => {
    const submit = screen.slice(
      // Renamed when `useOnce` took over the re-entry guard: the handler is
      // `submit` and `handleSubmit` is the wrapped one passed to the button.
      screen.indexOf('const submit = useCallback'),
      screen.indexOf('if (ticketId)'),
    );
    // The early return inside the catch is what keeps the confirmation screen
    // from rendering over a message that never left the phone.
    expect(submit).toMatch(/setSendFailure\([^)]*\);\s*return;/);
    expect(submit.indexOf('setTicketId')).toBeGreaterThan(submit.indexOf('catch'));
  });

  /**
   * Inline rather than a dialogue, and carrying both halves — because it is
   * read on its own beside the button, with no title bar above it. Caught by
   * `audit:writes`, which found only the server's words on screen: "That is
   * not allowed right now", with nothing saying what "that" was.
   */
  it('shows the action and the reason together', () => {
    expect(screen).toMatch(/\$\{said\.title\}\. \$\{said\.message\}/);
    expect(screen).toMatch(/testID="contact-send-failed"/);
  });
});

/**
 * FIXTURE 6 — the delete that took something away.
 *
 * `deleteAddress.mutate(id)` was followed, unconditionally, by clearing the
 * basket's delivery address. So a refused delete left the address on file
 * *and* the order with nowhere to go: a failure that cost the customer
 * something rather than leaving things as they were. The only one of the six
 * where silence was not the whole of the damage.
 */
describe('6 — a refused delete must not change anything locally', () => {
  const screen = code('src/app/checkout/address.tsx');
  const handler = screen.slice(
    screen.indexOf('const handleDelete'),
    screen.indexOf('const handleSave'),
  );

  it('clears the selected address on success only', () => {
    expect(handler).toMatch(/onSuccess: \(\) => \{[\s\S]*setAddress\(null\)/);
  });

  it('no longer clears it beside the call', () => {
    expect(handler).not.toMatch(
      /deleteAddress\.mutate\(address\.id\);\s*\n\s*if \(selectedAddress/,
    );
  });

  it('tells the customer as well', () => {
    expect(handler).toMatch(/onError:/);
    expect(handler).toMatch(/remove that address/);
  });
});

/**
 * FIXTURE 7 — every silent write, named.
 *
 * The list is the finding. Each of these was `mutate(…)` with no second
 * argument, which is the shape that cannot report anything: no `onError`, no
 * awaited promise, nothing to inspect. `cancelOrder` was the one already doing
 * it properly and is the shape the rest now follow.
 */
describe('7 — the five that said nothing', () => {
  it.each([
    ['src/app/account/payment-methods.tsx', 'delete that card'],
    ['src/app/account/payment-methods.tsx', 'change your default card'],
    ['src/app/checkout/address.tsx', 'remove that address'],
    ['src/app/account/notifications.tsx', 'mark that as read'],
    ['src/app/account/notifications.tsx', 'mark everything as read'],
  ])('%s reports a failure to %s', (file, action) => {
    const screen = code(file);

    expect(screen).toContain(action);
    expect(screen).toMatch(/writeFailureMessage\(error, /);
  });

  /**
   * And none of them is left fire-and-forget. A `mutate` whose only argument
   * is the payload has nowhere to put a failure, so this counts them: the
   * shape is what went wrong, not any particular screen.
   */
  it.each([
    'src/app/account/payment-methods.tsx',
    'src/app/checkout/address.tsx',
    'src/app/account/notifications.tsx',
  ])('%s leaves no mutate without a handler', (file) => {
    const screen = code(file);
    /*
      Read forward from each call rather than trying to match it.

      The first version of this used one regex for the whole call and could not
      span the braces of the options object, so it matched a fragment and
      reported every screen as unhandled. A balanced-brace match is the wrong
      tool; what the check actually wants to know is whether a handler appears
      before the statement ends.
    */
    const positions = [...screen.matchAll(/\.mutate\(/g)].map((match) => match.index ?? 0);

    expect(positions.length).toBeGreaterThan(0);
    for (const at of positions) {
      expect(screen.slice(at, at + 400)).toMatch(/onError|onSuccess/);
    }
  });

  it('leaves the one that was already right exactly as it was', () => {
    const order = code('src/app/order/[id]/index.tsx');
    expect(order).toMatch(/cancelOrder\.mutate\(orderId, \{\s*onError:/);
  });
});

/**
 * FIXTURE 8 — the crash that the sweep found on the way past.
 *
 * `audit:writes` stubbed `/v1/account/notifications` with `createdAt` where
 * the type says `receivedAt` — this script's own mistake, and an ordinary one
 * for a backend to make. The screen came down with "Something broke" rather
 * than failing at the fetch, because that endpoint was one of the twenty-nine
 * `request` calls with no `parse`.
 *
 * Two outcomes from one crash and only one of them was the harness's.
 */
describe('8 — a notification list the app cannot read', () => {
  const good = [
    {
      id: 'note-1',
      title: 'Your order is on its way',
      body: 'BBQ-4823 has left the kitchen.',
      receivedAt: '2026-09-07T09:00:00.000Z',
      read: false,
      category: 'order',
    },
  ];

  it('lets a well-formed list straight through', () => {
    expect(checkedNotifications(good)).toBe(good);
  });

  it('refuses the exact payload that took the screen down', () => {
    const [first] = good;
    const { receivedAt: _dropped, ...withoutReceivedAt } = first!;
    const wrong = [{ ...withoutReceivedAt, createdAt: '2026-09-07T09:00:00.000Z' }];

    expect(() => checkedNotifications(wrong)).toThrow(MalformedResponse);
    expect(() => checkedNotifications(wrong)).toThrow(/receivedAt/);
  });

  /**
   * `read` as a string is the quiet one. `"false"` is truthy, so every unread
   * notification would render as read and the badge would clear itself.
   */
  it('refuses a read flag sent as a string', () => {
    expect(() => checkedNotifications([{ ...good[0], read: 'false' }])).toThrow(MalformedResponse);
  });

  it('is wired into all three calls that return the list', () => {
    const service = code('src/services/accountService.ts');
    const uses = service.match(/parse: checkedNotifications/g) ?? [];
    expect(uses).toHaveLength(3);
  });
});

/**
 * FIXTURE 9 — the sweep refuses two ways, because they are different promises.
 *
 * A 403 and a dropped socket are not the same failure, and an app that treats
 * them alike gets one of them wrong. The sweep drives both for every case and
 * checks the second never produces the sentence only the first has earned.
 */
describe('9 — the sweep that found them', () => {
  const audit = code('scripts/audit-writes.mjs');

  it('drives both refusals for every case', () => {
    expect(audit).toMatch(/for \(const refusal of \['403', 'drop'\]\)/);
    expect(audit).toMatch(/req\.socket\.destroy\(\)/);
  });

  it('forbids the over-claim on a dropped connection', () => {
    expect(audit).toMatch(/CLAIMS_NOTHING_CHANGED/);
    expect(audit).toMatch(/it may well have happened, and the app does not know/);
  });

  /**
   * And a case that never reaches its own button fails rather than passing —
   * the mistake `audit:wire` recorded when reachability tracking was dropped
   * by a reformat and every money case reported green while asking for
   * nothing.
   */
  it('fails a case that proved nothing', () => {
    expect(audit).toMatch(/could not press its own control/);
    expect(audit).toMatch(/never sent \$\{testCase\.reaches\}/);
  });
});

/**
 * FIXTURE 10 — and the writes that were already handled stay handled.
 *
 * Five of eleven mutation call sites were silent; the other six were not, and
 * a round that fixes one half by disturbing the other has broken even. These
 * are the awaited ones, each inside a `try`, each with somewhere for the
 * failure to land.
 */
describe('10 — the six that were already right', () => {
  it.each([
    'src/app/order/[id]/rate.tsx',
    'src/app/cart/index.tsx',
    'src/app/rewards/[id].tsx',
    'src/app/account/contact.tsx',
    // Added to this list by being caught failing it. `checkout/address.tsx`
    // had no `catch` anywhere in the file while awaiting `createAddress`, so a
    // refused save left a fully typed street address on screen with nothing
    // said. It is a sixth silent write, and this is the assertion that found
    // it.
    'src/app/checkout/address.tsx',
  ])('%s still catches its awaited write', (file) => {
    expect(code(file)).toMatch(/catch/);
  });

  it('still reports a cancellation the store refuses', () => {
    const order = code('src/app/order/[id]/index.tsx');
    expect(order).toMatch(/Too late to cancel/);
  });

  /**
   * The preferences screen is the other shape worth keeping: a switch that
   * goes back when the write fails, rather than leaving somebody believing
   * they have opted out of marketing when they have not.
   */
  it('still puts the preference switch back when the write fails', () => {
    // In the hook, not the screen — which is where this test first looked, and
    // is the better home for it: the revert and the message belong with the
    // write rather than with the switch that triggered it.
    expect(code('src/features/account/useRemotePreferences.ts')).toMatch(/catch|onError/);
  });
});
