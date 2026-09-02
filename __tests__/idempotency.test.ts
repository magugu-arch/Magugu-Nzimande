import { newIdempotencyKey } from '@/utils/idempotency';

/**
 * The key that lets a server recognise one order attempt twice (brief §7, §9).
 *
 * Checkout already refuses to re-offer Place order after a payment whose
 * outcome is unknown, which handles the retry a *person* makes. This is for the
 * retry nobody chooses: a POST that times out on the wire and is sent again, an
 * app resumed mid-submit, a proxy replaying a request. Those reach a backend
 * twice with an identical basket, and without a key to match them by, a
 * duplicate and a customer who genuinely wants two of the same order are
 * indistinguishable requests.
 *
 * The generator is the interesting part, because `crypto.randomUUID` is the
 * path that does *not* run on a phone. Hermes has no `crypto` global, and on
 * web it is only exposed in a secure context — so the fallback is the ordinary
 * case, not a curiosity, and it is what these exercise.
 */
describe('minting a key', () => {
  it('produces a different key every time', () => {
    const keys = new Set(Array.from({ length: 2000 }, () => newIdempotencyKey()));
    expect(keys.size).toBe(2000);
  });

  it('produces something a header or a JSON body can carry', () => {
    for (let i = 0; i < 50; i += 1) {
      const key = newIdempotencyKey();
      expect(key).toMatch(/^[A-Za-z0-9-]+$/);
      expect(key.length).toBeGreaterThanOrEqual(16);
      expect(key.length).toBeLessThanOrEqual(128);
    }
  });

  /**
   * The path that actually runs on a handset. Hermes ships no `crypto` global
   * at all, so a generator that assumed one would throw at checkout — on the
   * device, on the one screen where throwing costs a customer money.
   */
  it('works with no crypto global at all', () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
    // @ts-expect-error — deliberately removing a global to model Hermes.
    delete globalThis.crypto;
    try {
      const keys = new Set(Array.from({ length: 1000 }, () => newIdempotencyKey()));
      expect(keys.size).toBe(1000);
    } finally {
      if (original) Object.defineProperty(globalThis, 'crypto', original);
    }
  });

  /**
   * The clock is one of three inputs precisely so that it cannot be the only
   * one. Two keys minted inside a single millisecond must still differ, which
   * a naive `Date.now()`-based generator gets wrong exactly when a retry is
   * fastest.
   */
  it('does not collide when two keys are minted in the same millisecond', () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
    // @ts-expect-error — the fallback is the path under test.
    delete globalThis.crypto;
    const frozen = jest.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
    try {
      const keys = new Set(Array.from({ length: 500 }, () => newIdempotencyKey()));
      expect(keys.size).toBe(500);
    } finally {
      frozen.mockRestore();
      if (original) Object.defineProperty(globalThis, 'crypto', original);
    }
  });
});
