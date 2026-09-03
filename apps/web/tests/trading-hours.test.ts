import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST as createOrderRoute } from '@/app/api/orders/route';
import { formatMinute, isOpenNow, minutesNowInSast } from '@/lib/trading';
import {
  aCollectionStore,
  aProduct,
  at,
  blankState,
  bodyOf,
  orderLine,
  orderRequest,
  request,
  sast,
  storeWithHours,
} from './fixtures';
import { FIXED_NOW } from './setup';

beforeEach(blankState);

/**
 * Trading hours, at the edges the seeded stores cannot reach.
 *
 * Both real stores keep daytime hours, so `isOpenNow`'s wrap-past-midnight
 * branch — the one a late kitchen actually needs — had never run in a test.
 * The seed data is the demo catalogue and answers to the franchisor, so the
 * store that closes at 02:00 is a fixture rather than a menu change.
 */

describe('reading the clock in South African time', () => {
  it('is UTC plus two, whatever the machine thinks', () => {
    expect(minutesNowInSast(new Date('2026-08-29T10:00:00Z'))).toBe(at(12));
    expect(minutesNowInSast(new Date('2026-08-29T00:00:00Z'))).toBe(at(2));
  });

  /** 23:00 UTC is 01:00 the next morning in Johannesburg, not 25:00. */
  it('wraps rather than running past midnight', () => {
    expect(minutesNowInSast(new Date('2026-08-29T23:00:00Z'))).toBe(at(1));
    expect(minutesNowInSast(new Date('2026-08-29T22:00:00Z'))).toBe(0);
  });

  it('never returns a minute outside the day', () => {
    for (let hour = 0; hour < 24; hour += 1) {
      const minute = minutesNowInSast(new Date(`2026-08-29T${String(hour).padStart(2, '0')}:30:00Z`));
      expect(minute).toBeGreaterThanOrEqual(0);
      expect(minute).toBeLessThan(24 * 60);
    }
  });
});

describe('an ordinary trading day', () => {
  const store = storeWithHours(at(11), at(22));

  it('is open inside the window', () => {
    expect(isOpenNow(store, sast('2026-08-29', 15))).toBe(true);
  });

  it('is shut before opening and after closing', () => {
    expect(isOpenNow(store, sast('2026-08-29', 9))).toBe(false);
    expect(isOpenNow(store, sast('2026-08-29', 23))).toBe(false);
  });

  /** Open at the opening minute, shut at the closing minute. */
  it('treats the boundaries as inclusive then exclusive', () => {
    expect(isOpenNow(store, sast('2026-08-29', 11))).toBe(true);
    expect(isOpenNow(store, sast('2026-08-29', 22))).toBe(false);
    expect(isOpenNow(store, sast('2026-08-29', 21, 59))).toBe(true);
  });
});

describe('a kitchen that closes after midnight', () => {
  // 18:00 to 02:00 — the branch no seeded store exercises.
  const late = storeWithHours(at(18), at(2));

  it('is open in the evening', () => {
    expect(isOpenNow(late, sast('2026-08-29', 20))).toBe(true);
  });

  it('is still open after midnight', () => {
    expect(isOpenNow(late, sast('2026-08-30', 1))).toBe(true);
    expect(isOpenNow(late, sast('2026-08-30', 0, 30))).toBe(true);
  });

  it('is shut once it closes', () => {
    expect(isOpenNow(late, sast('2026-08-30', 2))).toBe(false);
    expect(isOpenNow(late, sast('2026-08-30', 3))).toBe(false);
  });

  it('is shut through the afternoon before it opens', () => {
    expect(isOpenNow(late, sast('2026-08-29', 12))).toBe(false);
    expect(isOpenNow(late, sast('2026-08-29', 17, 59))).toBe(false);
  });

  it('opens exactly on its opening minute', () => {
    expect(isOpenNow(late, sast('2026-08-29', 18))).toBe(true);
  });
});

describe('a store open around the clock', () => {
  const always = storeWithHours(0, 0);

  it('is open at every hour', () => {
    for (let hour = 0; hour < 24; hour += 1) {
      expect([hour, isOpenNow(always, sast('2026-08-29', hour))]).toEqual([hour, true]);
    }
  });
});

describe('showing a time to a customer', () => {
  it('pads to a readable 24-hour clock', () => {
    expect(formatMinute(at(9, 5))).toBe('09:05');
    expect(formatMinute(at(22))).toBe('22:00');
  });

  it('shows midnight as 00:00 rather than 24:00', () => {
    expect(formatMinute(0)).toBe('00:00');
  });

  it('round-trips every minute of the day into HH:MM', () => {
    for (let minute = 0; minute < 24 * 60; minute += 37) {
      expect(formatMinute(minute)).toMatch(/^[0-2][0-9]:[0-5][0-9]$/);
    }
  });
});

describe('placing an order outside trading hours', () => {
  const anOrder = (over: Record<string, unknown> = {}) =>
    createOrderRoute(
      request('/api/orders', {
        body: orderRequest([orderLine(aProduct())], { storeId: aCollectionStore().id, ...over }),
      }),
    );

  /**
   * The site displayed "Open" and "Closed" from the day it was built and
   * checked neither: an order at three in the morning was accepted, priced,
   * confirmed and sent to a kitchen nobody was standing in.
   */
  it('is refused, with the store’s own hours', async () => {
    vi.setSystemTime(new Date('2026-09-02T01:00:00Z')); // 03:00 SAST
    try {
      const response = await anOrder();
      expect(response.status).toBe(409);
      // Read once: a Response body is a stream and cannot be consumed twice.
      const { error } = await bodyOf<{ error: string }>(response);
      expect(error).toMatch(/closed/i);
      expect(error).toContain(aCollectionStore().hours.label);
    } finally {
      vi.setSystemTime(FIXED_NOW);
    }
  });

  it('is accepted inside them', async () => {
    vi.setSystemTime(new Date('2026-09-02T10:00:00Z')); // 12:00 SAST
    try {
      expect((await anOrder()).status).toBe(201);
    } finally {
      vi.setSystemTime(FIXED_NOW);
    }
  });

  /** Half-open at the top, like the offers: closed at the closing minute. */
  it('is refused at the closing minute rather than one minute later', async () => {
    const store = aCollectionStore();
    // 22:00 SAST is 20:00 UTC.
    vi.setSystemTime(new Date('2026-09-02T20:00:00Z'));
    try {
      expect(store.hours.closesMinute).toBe(22 * 60);
      expect((await anOrder()).status).toBe(409);
    } finally {
      vi.setSystemTime(FIXED_NOW);
    }
  });

  it('is accepted in the minute before closing', async () => {
    vi.setSystemTime(new Date('2026-09-02T19:59:00Z')); // 21:59 SAST
    try {
      expect((await anOrder()).status).toBe(201);
    } finally {
      vi.setSystemTime(FIXED_NOW);
    }
  });

  /**
   * The guard is checked against South African time, not the caller's. A
   * request from a browser in London at noon its time is 14:00 in Johannesburg,
   * and it is the Johannesburg clock the kitchen works to.
   */
  it('reads the store’s clock rather than the caller’s', async () => {
    // 23:30 UTC is 01:30 the next day in SAST — closed, though the UTC hour
    // would still be inside 11:00 to 22:00 read naively as a local time.
    vi.setSystemTime(new Date('2026-09-02T23:30:00Z'));
    try {
      expect((await anOrder()).status).toBe(409);
    } finally {
      vi.setSystemTime(FIXED_NOW);
    }
  });
});
