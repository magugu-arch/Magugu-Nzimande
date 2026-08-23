import type { Store } from '@/types';
import { openingStatus, preferredStore } from '@/features/stores/opening';

const branch = (id: string, opensOn?: string): Store =>
  ({
    id,
    name: `bb.q Chicken ${id}`,
    addressLine: '1 Street',
    suburb: 'Suburb',
    city: 'City',
    province: 'Gauteng',
    phone: '011 000 0000',
    latitude: -26.1,
    longitude: 28.0,
    distanceKm: 1,
    openingHours: [],
    supportsDelivery: true,
    supportsCollection: true,
    supportsDineIn: true,
    deliveryRadiusKm: 10,
    preparationMinutes: 18,
    isOpenNow: true,
    ...(opensOn ? { opensOn } : {}),
  }) as Store;

const OCTOBER = '2026-10-01T09:00:00+02:00';
const NOVEMBER = '2026-11-01T09:00:00+02:00';
const beforeBoth = new Date('2026-09-20T12:00:00+02:00');
const between = new Date('2026-10-15T12:00:00+02:00');
const afterBoth = new Date('2026-11-15T12:00:00+02:00');

/**
 * Two branches open a month apart, so there is a real stretch during which the
 * app exists and nothing can be ordered from it. Home said nothing about that
 * — it offered "What are we eating?" and the full menu, and the customer met
 * the truth at checkout with a cart already built.
 */
describe('openingStatus', () => {
  it('reports nothing trading before the first branch opens', () => {
    const status = openingStatus([branch('a', OCTOBER), branch('b', NOVEMBER)], beforeBoth);

    expect(status.anyTrading).toBe(false);
    expect(status.nextOpening).toBe(OCTOBER);
  });

  it('names the soonest opening, whatever order the branches arrive in', () => {
    const status = openingStatus([branch('b', NOVEMBER), branch('a', OCTOBER)], beforeBoth);
    expect(status.nextOpening).toBe(OCTOBER);
  });

  it('reports trading once the first branch has opened, even with one to come', () => {
    const status = openingStatus([branch('a', OCTOBER), branch('b', NOVEMBER)], between);

    expect(status.anyTrading).toBe(true);
    // Still worth knowing, for a branch-level "opening soon" label.
    expect(status.nextOpening).toBe(NOVEMBER);
  });

  it('has nothing left to announce once both are open', () => {
    const status = openingStatus([branch('a', OCTOBER), branch('b', NOVEMBER)], afterBoth);

    expect(status.anyTrading).toBe(true);
    expect(status.nextOpening).toBeNull();
  });

  it('treats a branch with no opening date as already trading', () => {
    // An absent date means open, not unknown.
    const status = openingStatus([branch('a'), branch('b', NOVEMBER)], beforeBoth);
    expect(status.anyTrading).toBe(true);
  });

  /**
   * The failure this avoids: a loading state or a failed fetch is an empty
   * list, and announcing "we open soon" on a network blip is worse than saying
   * nothing. The screen's own error state should speak instead.
   */
  it('says nothing when there are no stores to judge', () => {
    const status = openingStatus([], beforeBoth);

    expect(status.anyTrading).toBe(true);
    expect(status.nextOpening).toBeNull();
  });
});

/**
 * Checkout pre-selects a store for anyone who has not chosen one. It picked
 * the nearest branch outright, which with a branch opening in November means
 * arriving at checkout to find a store silently chosen and immediately
 * blocked on it — for a store the customer never picked.
 */
describe('preferredStore', () => {
  it('skips a branch that has not opened, however near it is', () => {
    // The list arrives sorted by distance: the nearest is the one not yet open.
    const nearest = branch('nearest-but-closed', NOVEMBER);
    const trading = branch('further-but-open');

    expect(preferredStore([nearest, trading], between)?.id).toBe('further-but-open');
  });

  it('takes the nearest when everything is trading', () => {
    expect(preferredStore([branch('a'), branch('b')], between)?.id).toBe('a');
  });

  /**
   * Falling back rather than returning nothing matters: "opens on 1 November"
   * tells a customer something, and an empty "Choose a store" tells them
   * nothing about why.
   */
  it('falls back to the nearest when no branch is trading yet', () => {
    const first = branch('october', OCTOBER);
    const second = branch('november', NOVEMBER);

    expect(preferredStore([first, second], beforeBoth)?.id).toBe('october');
  });

  it('has nothing to suggest from an empty list', () => {
    expect(preferredStore([], between)).toBeUndefined();
  });

  it('starts suggesting a branch the day it opens', () => {
    const opening = branch('october', OCTOBER);
    const other = branch('other', NOVEMBER);

    expect(preferredStore([opening, other], beforeBoth)?.id).toBe('october');
    expect(preferredStore([opening, other], between)?.id).toBe('october');
  });
});
