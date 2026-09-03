import type { Address, Store } from '@/types';
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
   * The third way a silently-chosen branch blocks a customer, and the one this
   * function did not ask about.
   *
   * A branch shut by its own kitchen — the power cut, the burst pipe — is the
   * same shape as the two cases above: chosen for them, blocked on it, for a
   * reason that is not their fault. It went unnoticed because every seeded
   * store was open, so there was nothing for `isTradingNow` to exclude.
   * `audit:coldstart` found it the day one branch was seeded shut.
   */
  it('skips a branch that has declared itself shut', () => {
    const shut = { ...branch('nearest-but-shut'), isOpenNow: false };
    const open = branch('further-but-cooking');

    expect(preferredStore([shut, open], between)?.id).toBe('further-but-cooking');
  });

  /**
   * Still returns one, for the same reason as the opening-date fallback: a
   * customer needs "closed — schedule for later" against a named branch, not
   * an empty "Choose a store" that explains nothing.
   */
  it('falls back to the nearest when every branch is shut', () => {
    const first = { ...branch('one'), isOpenNow: false };
    const second = { ...branch('two'), isOpenNow: false };

    expect(preferredStore([first, second], between)?.id).toBe('one');
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

/**
 * Which branch a customer who has chosen nothing is handed.
 *
 * The store list is only sorted by distance when the app knows where the
 * customer is, and it usually does not — a declined location prompt is the
 * ordinary case, and the list then arrives alphabetically with no distances on
 * it. That is honest, and it made the pre-select arbitrary: bb.q Chicken Canal
 * Walk sorts first, so a Johannesburg customer arrived at checkout with a Cape
 * Town branch chosen for them and "does not deliver to Melrose Arch"
 * underneath it, for a branch they never picked.
 *
 * The address is the information the app does have, so it uses it.
 */
describe('preferredStore weighs whether the branch can deliver', () => {
  const at = (id: string, latitude: number, longitude: number): Store => ({
    ...branch(id),
    latitude,
    longitude,
  });

  // Alphabetical order, as an unlocated list arrives: Cape Town first.
  const capeTown = at('Canal Walk', -33.8919, 18.5106);
  const johannesburg = at('Rosebank', -26.1465, 28.0436);
  const list = [capeTown, johannesburg];

  const melroseArch: Address = {
    id: 'address-home',
    label: 'Home',
    line1: '12 Alice Lane',
    suburb: 'Melrose Arch',
    city: 'Johannesburg',
    province: 'Gauteng',
    postalCode: '2196',
    latitude: -26.1327,
    longitude: 28.0673,
    isDefault: true,
  };

  const now = new Date('2026-08-24T13:00:00+02:00');

  it('skips a branch that cannot reach the address', () => {
    expect(preferredStore(list, now, melroseArch)?.id).toBe('Rosebank');
  });

  it('takes the first branch when there is no address to weigh', () => {
    expect(preferredStore(list, now, null)?.id).toBe('Canal Walk');
  });

  it('rules nothing out on an address nobody has located', () => {
    const { latitude: _lat, longitude: _lon, ...unlocated } = melroseArch;
    expect(preferredStore(list, now, unlocated)?.id).toBe('Canal Walk');
  });

  it('still returns a branch when none of them can deliver', () => {
    // "Choose a store" from an empty list tells a customer nothing; a named
    // branch with a reason underneath it tells them what to change.
    const durban: Address = { ...melroseArch, latitude: -29.85, longitude: 31.02 };
    expect(preferredStore(list, now, durban)).toBeDefined();
  });

  it('does not let a deliverable branch override one that has not opened', () => {
    const notOpenYet = { ...johannesburg, opensOn: '2026-11-01T09:00:00+02:00' };
    // Rosebank can reach the address but is not trading; Canal Walk cannot
    // reach it but is. Neither qualifies, so the fallback runs and picks the
    // trading one — the customer sees a branch they can actually change.
    expect(preferredStore([capeTown, notOpenYet], now, melroseArch)?.id).toBe('Canal Walk');
  });
});
