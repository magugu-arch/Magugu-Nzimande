import { errorCode, isNotFound } from '@/services/apiClient';
import { fetchProduct } from '@/services/menuService';
import { fetchPromotion, fetchPromotions } from '@/services/rewardsService';
import { promotions } from '@/services/data/rewardsData';

/**
 * A promotions calendar has three states and this app had only ever seen one.
 *
 * Every seeded promotion was live, so `fetchPromotions`' validity filter ran on
 * every offers screen and never once removed anything, and the throw behind
 * `fetchPromotion` — the one the detail screen's whole error branch was written
 * for — had never fired. Two fixtures outside their window fix that: one
 * campaign that closed, one loaded ahead of its launch.
 *
 * Both are reachable by a customer even though neither is listed: a push
 * notification sent last week, a link forwarded, a screenshot of a code.
 */
describe('a promotions calendar with something outside its window', () => {
  it('seeds a promotion that has ended and one that has not started', () => {
    const now = Date.now();
    const ended = promotions.filter((p) => new Date(p.validUntil).getTime() < now);
    const upcoming = promotions.filter((p) => new Date(p.validFrom).getTime() > now);

    // Without both, everything below passes vacuously.
    expect(ended.length).toBeGreaterThan(0);
    expect(upcoming.length).toBeGreaterThan(0);
  });

  it('lists only what is running right now', async () => {
    const list = await fetchPromotions();

    expect(list.length).toBeGreaterThan(0);
    expect(list.length).toBeLessThan(promotions.length);
    for (const promotion of list) {
      expect(new Date(promotion.validFrom).getTime()).toBeLessThanOrEqual(Date.now());
      expect(new Date(promotion.validUntil).getTime()).toBeGreaterThanOrEqual(Date.now());
    }
  });

  it.each([
    ['one that closed', 'promo-heritage-braai'],
    ['one that has not opened', 'promo-sweet-potato-launch'],
    ['one that never existed', 'promo-does-not-exist'],
  ])('refuses to serve %s', async (_label, id) => {
    await expect(fetchPromotion(id)).rejects.toThrow();
  });

  it('still serves a live one', async () => {
    await expect(fetchPromotion('promo-free-delivery')).resolves.toMatchObject({
      id: 'promo-free-delivery',
    });
  });

  /**
   * The defect the upcoming fixture found, and it was visible in a browser
   * before it was visible here: `/offers/promo-sweet-potato-launch` rendered
   * "That offer has ended · It is no longer running" for a campaign opening in
   * twelve days. That is the worse direction of the two — somebody who
   * followed a teaser is told the thing they are waiting for is finished — and
   * it happened because `fetchPromotion` read the filtered list, where
   * "before" and "after" look identical: absent.
   */
  it('says "not started" for one that has not started, not "ended"', async () => {
    const error = await fetchPromotion('promo-sweet-potato-launch').catch(
      (thrown: unknown) => thrown,
    );

    expect(errorCode(error)).toBe('promotion_not_started');
    expect((error as Error).message).toBe('That offer has not started yet.');
  });

  it.each([
    ['a campaign that closed', 'promo-heritage-braai'],
    ['an id the calendar never had', 'promo-does-not-exist'],
  ])('says "ended" for %s', async (_label, id) => {
    const error = await fetchPromotion(id).catch((thrown: unknown) => thrown);

    expect(errorCode(error)).toBe('promotion_ended');
  });

  /**
   * Both are still not-founds. The screen decides what to say from the code;
   * everything else in the app — the retry policy in `_layout`, any future
   * caller — only needs to know the thing is not there.
   */
  it.each(['promo-heritage-braai', 'promo-sweet-potato-launch'])(
    'reports %s as not-found either way',
    async (id) => {
      const error = await fetchPromotion(id).catch((thrown: unknown) => thrown);

      expect(isNotFound(error)).toBe(true);
    },
  );

  it('does not read the branch off the copy', () => {
    // A screen that switched on `error.message` would change behaviour the
    // next time somebody reworded a sentence. `errorCode` is what to branch on.
    expect(errorCode(new Error('That offer has not started yet.'))).toBeUndefined();
  });
});

/**
 * The bug this closes, and it is not in a screen.
 *
 * `isNotFound` exists so a screen can tell "that thing is not there" from "we
 * could not ask" — the product screen leans on it to decide whether it is
 * entitled to say an item came off the menu. Against the real API it works: a
 * 404 arrives as an `ApiRequestError` carrying its status.
 *
 * Against the mock it did not. `fetchProduct` threw
 * `Object.assign(new Error(…), { code: 'not_found' })`, which `isNotFound`
 * cannot recognise, and `fetchPromotion` threw a bare `Error`. So in the mock
 * build — which is every preview, every demo and every screenshot — a delisted
 * item fell through to "Something went wrong", and the copy written for the
 * case was unreachable.
 *
 * That is the failure mode this repository keeps meeting from the other side:
 * a mock that fails *differently* from the world leaves the branch written for
 * the world untested and, here, unreachable. The mock now throws what the
 * server would send.
 */
describe('the mock fails the way the server fails', () => {
  it('reports a missing product as not-found, not as a broken app', async () => {
    const error = await fetchProduct('no-such-product').catch((thrown: unknown) => thrown);

    expect(isNotFound(error)).toBe(true);
  });

  it('reports a promotion outside its window as not-found', async () => {
    const error = await fetchPromotion('promo-heritage-braai').catch((thrown: unknown) => thrown);

    expect(isNotFound(error)).toBe(true);
  });

  it('keeps the customer-readable message on the way through', async () => {
    const error = await fetchPromotion('promo-heritage-braai').catch((thrown: unknown) => thrown);

    expect((error as Error).message).toBe('That offer has ended.');
  });

  it('does not call an ordinary failure not-found', () => {
    expect(isNotFound(new Error('socket hang up'))).toBe(false);
    expect(isNotFound(undefined)).toBe(false);
    expect(isNotFound(null)).toBe(false);
  });
});
