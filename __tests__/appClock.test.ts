import { readFileSync } from 'node:fs';
import path from 'node:path';

import { savedPaymentMethods } from '@/services/data/accountData';
import { methodHasExpired } from '@/features/checkout/cardExpiry';
import type { OpeningHours, Store } from '@/types';
import {
  appNow,
  clockSkewMinutes,
  noteServerTime,
  resetAppClock,
  skewNotice,
} from '@/utils/appClock';
import { hasPassed } from '@/utils/datetime';
import { isTradingNow } from '@/utils/tradingHours';

const read = (file: string) => readFileSync(path.join(__dirname, '..', file), 'utf8');

const code = (file: string) =>
  read(file)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

const HOURS: OpeningHours[] = Array.from({ length: 7 }, (_, day) => ({
  day,
  opensAt: '10:00',
  closesAt: '22:00',
}));

const store = (): Store =>
  ({
    id: 'rosebank',
    name: 'bb.q Chicken Rosebank',
    addressLine: '177 Oxford Rd',
    suburb: 'Rosebank',
    city: 'Johannesburg',
    province: 'Gauteng',
    phone: '011 447 2200',
    latitude: -26.1465,
    longitude: 28.0436,
    distanceKm: 1,
    openingHours: HOURS,
    supportsDelivery: true,
    supportsCollection: true,
    supportsDineIn: true,
    deliveryRadiusKm: 10,
    preparationMinutes: 20,
    isOpenNow: true,
  }) as Store;

afterEach(() => resetAppClock());

/**
 * A device whose clock is wrong by `driftMs`, for the length of one call.
 *
 * The device clock is what `Date.now` returns, so that is what moves. The
 * `Date` header the stub server sends is the truth, and the gap between them is
 * the thing under test.
 */
function withDeviceDrift<T>(driftMs: number, run: (trueNow: number) => T): T {
  const trueNow = Date.now();
  const spy = jest.spyOn(Date, 'now').mockImplementation(() => trueNow + driftMs);
  try {
    return run(trueNow);
  } finally {
    spy.mockRestore();
  }
}

/** What a server's `Date` header looks like: RFC 1123, one-second resolution. */
const httpDate = (ms: number) => new Date(ms).toUTCString();

/*
  ───────────────────────────────────────────────────────────────────────────
  Ten states the app has always supported and nothing has ever put it in.

  Last round settled which *zone* the app reads. It did nothing about the
  *instant*: every rule still started from `new Date()`, which is the device's
  answer, and a phone's clock is a setting rather than a fact. It resets when
  the battery dies, it can be set by hand, and a device that has lost its
  network time source drifts.

  And every sweep in this repository pins the clock to a chosen instant —
  which, to the app, is indistinguishable from a correct one. So a wrong clock
  has never been driven, in any test or any browser, once.
  ───────────────────────────────────────────────────────────────────────────
*/

/**
 * FIXTURE 1 — the signal that was already on the wire.
 *
 * Every HTTP response carries a `Date` header. It is the server's own clock,
 * it costs nothing, it needs no credential and no contract, and this app threw
 * it away on every request for the life of the project.
 */
describe('1 — reading the server’s clock off a response it already had', () => {
  it('knows nothing until a response has been seen', () => {
    expect(clockSkewMinutes()).toBeNull();
    expect(skewNotice()).toBeNull();
  });

  it('learns the offset from one exchange', () => {
    withDeviceDrift(-2 * 3_600_000, (trueNow) => {
      noteServerTime(httpDate(trueNow), Date.now(), Date.now());
    });

    expect(clockSkewMinutes()).toBe(120);
  });

  /**
   * The direction, stated once. An offset applied the wrong way round is
   * self-consistent and twice as wrong, which is exactly the mistake
   * `storeClock` records having nearly made with the timezone.
   */
  it('adds the offset, so a slow phone is brought forward', () => {
    const drift = -90 * 60_000;
    withDeviceDrift(drift, (trueNow) => {
      noteServerTime(httpDate(trueNow), Date.now(), Date.now());
      /*
        Within a second, which is the honest bound rather than a loose one: an
        HTTP `Date` header has one-second resolution, so the correction can
        never be better than that and claiming otherwise would be a test
        asserting a precision the protocol does not carry.
      */
      expect(Math.abs(appNow().getTime() - trueNow)).toBeLessThan(1000);
      // And the device, left alone, is still ninety minutes behind.
      expect(Date.now()).toBe(trueNow + drift);
    });
  });
});

/**
 * FIXTURE 2 — the fallback, which is the half that has to be right.
 *
 * With nothing observed the app must be exactly where it was: the device's
 * clock, unmodified. An app that guessed at an offset it had not measured
 * would be worse than one that trusted the phone, and it would break every
 * offline path in the project.
 */
describe('2 — no server seen yet', () => {
  it('is the device clock, to the millisecond', () => {
    withDeviceDrift(5 * 86_400_000, () => {
      expect(appNow().getTime()).toBe(Date.now());
    });
  });

  it('ignores a header it cannot read rather than inventing one', () => {
    const at = Date.now();
    noteServerTime('not a date at all', at, at);
    noteServerTime(null, at, at);

    expect(clockSkewMinutes()).toBeNull();
  });
});

/**
 * FIXTURE 3 — a slow connection is not a broken clock.
 *
 * The naive measurement compares the header against the moment the response
 * landed, which folds the whole round trip into the offset. On a bad mobile
 * connection that reports every customer as seconds-to-minutes fast, and the
 * app would then "correct" a clock that was right.
 */
describe('3 — the round trip is not counted as skew', () => {
  it('measures against the midpoint of the exchange', () => {
    const sentAt = Date.now();
    const receivedAt = sentAt + 4_000;
    // The server stamped its header halfway through, on a correct clock.
    noteServerTime(httpDate(sentAt + 2_000), sentAt, receivedAt);

    expect(clockSkewMinutes()).toBe(0);
  });

  /**
   * And a later, slower sample cannot overwrite a good one. Half the round
   * trip is the error bar on a measurement, so the fastest exchange seen is
   * the most trustworthy — the one rule this file shares with NTP.
   */
  it('keeps the fastest sample and ignores worse ones', () => {
    withDeviceDrift(-3_600_000, (trueNow) => {
      noteServerTime(httpDate(trueNow), Date.now(), Date.now());
      expect(clockSkewMinutes()).toBe(60);

      // A ten-second exchange that would imply a wildly different offset.
      const slowStart = Date.now();
      noteServerTime(httpDate(trueNow + 4_000_000), slowStart, slowStart + 10_000);

      expect(clockSkewMinutes()).toBe(60);
    });
  });
});

/**
 * FIXTURE 4 — the noise floor.
 *
 * `Date` headers have one-second resolution and the round trip adds more, so a
 * few seconds of apparent offset is measurement, not skew. Nothing in this app
 * turns on a few seconds: slots are fifteen minutes apart, trading hours turn
 * on the minute, card expiry on the month. Correcting inside the noise would
 * trade a measurable error for an unmeasurable one.
 */
describe('4 — differences too small to be real', () => {
  it('treats a few seconds as zero', () => {
    withDeviceDrift(-4_000, (trueNow) => {
      noteServerTime(httpDate(trueNow), Date.now(), Date.now());
      expect(clockSkewMinutes()).toBe(0);
      expect(appNow().getTime()).toBe(Date.now());
    });
  });

  /*
    100 seconds rather than 90, and the difference is the point.

    A `Date` header has one-second resolution, so an exact 90-second drift
    measures as somewhere in 89.0–90.0 seconds depending on the millisecond the
    test started — 1.48 to 1.50 minutes, either side of `Math.round`'s
    boundary. The first draft asserted 2 and failed about half the time. A
    fixture that sits on a rounding boundary is a coin toss wearing a test's
    clothes.
  */
  it('but takes a minute and a half seriously', () => {
    withDeviceDrift(-100_000, (trueNow) => {
      noteServerTime(httpDate(trueNow), Date.now(), Date.now());
      expect(clockSkewMinutes()).toBe(2);
    });
  });
});

/**
 * FIXTURE 5 — the card that a broken clock kills, or resurrects.
 *
 * `payment-mastercard-lastmonth` is seeded to expire this month, and is the
 * one card in the wallet whose answer can change. On a phone two months fast
 * it is already dead and the customer is refused a card their bank would have
 * honoured; on a phone a year slow, a card that expired last year is offered.
 */
describe('5 — a saved card, judged by the wrong clock', () => {
  const card = savedPaymentMethods.find((m) => m.id === 'payment-mastercard-lastmonth')!;

  it('is good today, on a clock that is right', () => {
    expect(methodHasExpired(card)).toBe(false);
  });

  it('is wrongly refused on a phone two months fast, until the server is heard', () => {
    withDeviceDrift(62 * 86_400_000, (trueNow) => {
      expect(methodHasExpired(card)).toBe(true);

      noteServerTime(httpDate(trueNow), Date.now(), Date.now());
      expect(methodHasExpired(card)).toBe(false);
    });
  });
});

/**
 * FIXTURE 6 — order BBQ-4823, through a third door.
 *
 * The first time, `isOpenNow` was a stale flag. The second, the device's
 * timezone. This is the third: the device's clock. Same order, same shut
 * kitchen, same customer told the branch is trading.
 */
describe('6 — a kitchen judged by the wrong clock', () => {
  it('is open at lunchtime and shut at half past three in the morning', () => {
    const branch = store();
    // 12:00 SAST is 10:00Z; 03:30 SAST is 01:30Z.
    expect(isTradingNow(branch, new Date('2026-09-07T10:00:00.000Z'))).toBe(true);
    expect(isTradingNow(branch, new Date('2026-09-07T01:30:00.000Z'))).toBe(false);
  });

  it('says shut on a phone nine hours behind, and open once corrected', () => {
    const branch = store();
    const trueNow = Date.parse('2026-09-07T10:00:00.000Z'); // 12:00 SAST — trading.
    const spy = jest.spyOn(Date, 'now').mockImplementation(() => trueNow - 9 * 3_600_000);

    try {
      // 03:00 SAST as far as the phone knows.
      expect(isTradingNow(branch)).toBe(false);

      noteServerTime(httpDate(trueNow), Date.now(), Date.now());
      expect(isTradingNow(branch)).toBe(true);
    } finally {
      spy.mockRestore();
    }
  });
});

/**
 * FIXTURE 7 — "that time has passed", about a time that has not.
 *
 * `hasPassed` gates the scheduled slot at checkout. A phone running fast turns
 * a slot the customer picked minutes ago into one the app refuses, with a
 * message that is simply untrue.
 */
describe('7 — a slot refused by a fast phone', () => {
  it('has not passed on a correct clock, and has on a phone an hour ahead', () => {
    const slot = new Date(Date.now() + 30 * 60_000).toISOString();

    expect(hasPassed(slot)).toBe(false);

    withDeviceDrift(3_600_000, (trueNow) => {
      expect(hasPassed(slot)).toBe(true);

      noteServerTime(httpDate(trueNow), Date.now(), Date.now());
      expect(hasPassed(slot)).toBe(false);
    });
  });
});

/**
 * FIXTURE 8 — what the customer is told, and when they are not.
 *
 * The app has the right time and is using it, so this is an explanation rather
 * than a refusal. Refusing to take an order because a phone's clock is wrong
 * would punish a customer for something the app has already worked around.
 */
describe('8 — the sentence, and its silence', () => {
  it('says nothing for a difference nobody could act on', () => {
    withDeviceDrift(-100_000, (trueNow) => {
      noteServerTime(httpDate(trueNow), Date.now(), Date.now());
      expect(clockSkewMinutes()).toBe(2);
      expect(skewNotice()).toBeNull();
    });
  });

  it('names the direction and a rough size, in units a person uses', () => {
    withDeviceDrift(-2 * 3_600_000, (trueNow) => {
      noteServerTime(httpDate(trueNow), Date.now(), Date.now());
      expect(skewNotice()).toMatch(/about 2 hours slow/);
    });

    resetAppClock();

    withDeviceDrift(3 * 86_400_000, (trueNow) => {
      noteServerTime(httpDate(trueNow), Date.now(), Date.now());
      expect(skewNotice()).toMatch(/about 3 days fast/);
    });
  });

  it('is shown on both surfaces that print a time', () => {
    for (const file of ['src/app/checkout/schedule.tsx', 'src/app/checkout/store.tsx']) {
      expect(code(file)).toMatch(/skewNotice\(\)/);
      expect(code(file)).toMatch(/testID="(schedule|store)-skew-notice"/);
    }
  });
});

/**
 * FIXTURE 9 — the app asks one clock, everywhere.
 *
 * The value of a single seam is that there is no second one. A rule left on
 * `new Date()` is a rule that disagrees with every other rule on a phone whose
 * clock is out, and the disagreement would be invisible on a correct one — the
 * same shape as the timezone defect this replaces.
 */
describe('9 — one clock, and no second one', () => {
  const DECIDERS = [
    'src/utils/cart.ts',
    'src/utils/datetime.ts',
    'src/utils/tradingHours.ts',
    'src/features/cart/voucherStatus.ts',
    'src/features/checkout/cardExpiry.ts',
    'src/features/checkout/checkoutDefaults.ts',
    'src/features/checkout/checkoutDrift.ts',
    'src/features/checkout/paymentOptions.ts',
    'src/features/orders/liveStatus.ts',
    'src/features/rewards/birthday.ts',
    'src/features/stores/opening.ts',
    'src/features/system/useNow.ts',
    'src/store/authStore.ts',
    'src/store/fulfilmentStore.ts',
    'src/services/orderService.ts',
    'src/services/rewardsService.ts',
  ];

  it.each(DECIDERS)('%s starts from appNow, not the device', (file) => {
    expect(code(file)).not.toMatch(/new Date\(\)/);
  });

  /**
   * The two deliberate exceptions, named so that "no `new Date()` anywhere"
   * does not quietly become the rule and take these with it.
   * `deviceIsOnStoreTime` and `clockNotice` ask whether *this phone's zone* is
   * the kitchen's, and the device is the right and only source for that.
   */
  /**
   * And one place to *observe* it, plus the one the sweep found missing.
   *
   * `audit:skew` reported `/checkout/schedule` uncorrected long after the
   * re-render was fixed, because that screen fetches nothing: all three of its
   * requests per page load are the connectivity probe, which does not go
   * through `apiClient`. The most frequent server contact the app has was the
   * one request whose clock was thrown away.
   */
  it('reads the clock off the connectivity probe as well as the API client', () => {
    const probe = code('src/features/system/useNetworkStatus.ts');

    expect(probe).toMatch(/noteServerTime\(/);
    expect(probe).toMatch(/probeSentAt = Date\.now\(\)/);
    // And skips a reading whose round trip it cannot bound, rather than
    // guessing at one.
    expect(probe).toMatch(/roundTrip < PROBE_BOUND_MS/);
  });

  /**
   * The re-render, which is the half that makes the correction visible.
   */
  it('tells the screens holding a clock when it moves under them', () => {
    expect(code('src/features/system/useNow.ts')).toMatch(/onClockCorrected\(tick\)/);
    expect(code('src/utils/appClock.ts')).toMatch(
      /for \(const listener of listeners\) listener\(\)/,
    );
  });

  it('leaves the two questions that really are about the device', () => {
    const clock = code('src/utils/storeClock.ts');

    expect(clock).toMatch(/deviceIsOnStoreTime\(now: Date = new Date\(\)\)/);
    expect(clock).toMatch(/clockNotice\(now: Date = new Date\(\)\)/);
  });
});

/**
 * FIXTURE 10 — the observation must never break the request.
 *
 * This one is written from a defect this round introduced and the suite
 * caught. The first version read `response.headers.get('date')` directly;
 * nineteen tests went red with "We can't reach bb.q right now", because their
 * doubles return a response with no `headers`, the read threw, and the throw
 * landed in the API client's own catch — which reads anything that is not an
 * `ApiRequestError` as a network failure.
 *
 * A real `fetch` always has headers, so it could not have happened in the app.
 * That is precisely why it needed guarding: reading the clock is the least
 * important thing that function does, and it had been handed the power to fail
 * every request in the app.
 */
describe('10 — the least important thing cannot break the most important', () => {
  const client = code('src/services/apiClient.ts');

  it('guards the observation', () => {
    expect(client).toMatch(/try \{\s*noteServerTime\(/);
    expect(client).toMatch(/response\.headers\?\.get\('date'\)/);
  });

  it('measures either side of the fetch rather than after it', () => {
    /*
      `lastIndexOf`, because the first `noteServerTime` in this file is the
      import at the top — ahead of `const sentAt`, so the slice came back empty
      and the assertion failed against a string this test had built wrong.
    */
    const around = client.slice(
      client.indexOf('const sentAt'),
      client.lastIndexOf('noteServerTime(') + 200,
    );

    expect(around).toMatch(/const sentAt = Date\.now\(\)/);
    expect(around).toMatch(/noteServerTime\(.*sentAt, Date\.now\(\)\)/);
  });

  it('survives a response with no headers at all', () => {
    // The shape the doubles actually return, exercised directly.
    const headerless = { status: 200 } as unknown as { headers?: Headers };
    expect(() => noteServerTime(headerless.headers?.get('date') ?? null, 0, 0)).not.toThrow();
    expect(clockSkewMinutes()).toBeNull();
  });
});

/**
 * The request that was skipping it.
 *
 * `execute` reads the `Date` header off every reply, and `performRefresh` uses
 * a bare `fetch` — deliberately, so a rejected refresh cannot try to refresh
 * itself — which made it the single request in the app that never observed the
 * clock.
 *
 * It is the worst one to miss. A refresh happens when the app wakes on a token
 * that aged out, which is exactly the launch after a phone has been off for a
 * week; it is often the *first* request of the session, so skipping it delayed
 * the correction by a whole round trip on the occasion the clock is most likely
 * to be wrong.
 *
 * Asserted as an invariant rather than as that one call: every `fetch` in the
 * API client is followed by a reading, so a future path that adds another
 * cannot quietly skip it.
 */
describe('11 — every fetch in the client reads the clock', () => {
  const client = code('src/services/apiClient.ts');

  it('has a reading for each fetch it makes', () => {
    const fetches = (client.match(/await fetch\(/g) ?? []).length;
    const readings = (client.match(/noteServerTime\(/g) ?? []).length;

    expect(fetches).toBeGreaterThanOrEqual(2);
    // One reading per fetch. The import carries no parenthesis, so it does not
    // count itself — which the first version of this assertion assumed it did.
    expect(readings).toBe(fetches);
  });

  it('measures the refresh either side, like the rest', () => {
    const refresh = client.slice(client.indexOf('async function performRefresh'));

    expect(refresh.slice(0, 900)).toMatch(
      /const sentAt = Date\.now\(\);\s*const response = await fetch/,
    );
    expect(refresh.slice(0, 900)).toMatch(/noteServerTime\(.*sentAt, Date\.now\(\)\)/);
  });

  it('guards it there too, so a refresh cannot fail over a header', () => {
    const refresh = client.slice(client.indexOf('async function performRefresh'));
    expect(refresh.slice(0, 900)).toMatch(/try \{\s*noteServerTime\(/);
  });
});
