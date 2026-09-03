import fs from 'node:fs';
import path from 'node:path';
import { act } from '@testing-library/react-native';
import type { Address, Store } from '@/types';
import { supportsFulfilment } from '@/utils/fulfilment';
import {
  deliveryRange,
  isOpeningLater,
  missingFulfilmentRequirement,
  useFulfilmentStore,
  type FulfilmentRequirements,
} from '@/store/fulfilmentStore';

const store: Store = {
  id: 'rosebank',
  name: 'bb.q Chicken Rosebank',
  suburb: 'Rosebank',
  city: 'Johannesburg',
  province: 'Gauteng',
  distanceKm: 2.4,
  addressLine: '50 Bath Avenue',
  latitude: -26.1456,
  longitude: 28.0421,
  phone: '+27110000000',
  supportsDelivery: true,
  supportsCollection: true,
  supportsDineIn: true,
  deliveryRadiusKm: 10,
  preparationMinutes: 18,
  openingHours: [],
  isOpenNow: true,
};

const address: Address = {
  id: 'home',
  label: 'Home',
  line1: '12 Oxford Road',
  suburb: 'Rosebank',
  city: 'Johannesburg',
  province: 'Gauteng',
  postalCode: '2196',
  latitude: -26.146,
  longitude: 28.041,
  isDefault: true,
};

const base: FulfilmentRequirements = {
  fulfilmentType: 'delivery',
  store: null,
  address: null,
  tableNumber: '',
};

describe('missingFulfilmentRequirement', () => {
  it('asks for a store first', () => {
    expect(missingFulfilmentRequirement(base)).toBe('Choose a store');
  });

  it('asks for an address once a store is chosen, for delivery', () => {
    expect(missingFulfilmentRequirement({ ...base, store })).toBe('Add a delivery address');
  });

  it('is satisfied by a store and an address', () => {
    expect(missingFulfilmentRequirement({ ...base, store, address })).toBeNull();
  });

  it('wants no address for collection', () => {
    expect(
      missingFulfilmentRequirement({ ...base, fulfilmentType: 'collection', store }),
    ).toBeNull();
  });

  /**
   * The hole this closes: every screen showed "Closed" on the store card and
   * then let the order through anyway. A shut kitchen cannot cook.
   */
  describe('a closed store', () => {
    // Injected rather than hardcoded. These fixtures used to pin a literal
    // '2026-08-23T18:30:00.000Z', which was comfortably in the future the day
    // it was written and is now yesterday — the same stale-value shape the
    // guard below exists to catch, in the test that checks it.
    const now = new Date(2026, 7, 24, 9, 0);
    const laterToday = new Date(2026, 7, 24, 18, 30).toISOString();

    /**
     * Shut because it is nine in the morning and the branch opens at ten.
     *
     * This whole block used to build its closed store as `isOpenNow: false`,
     * because that is the quickest lever, while every assertion in it was
     * about being *out of hours*. Those are two different closures and the app
     * now answers them differently, so each is modelled by the thing that
     * actually causes it.
     */
    const outOfHours = {
      ...store,
      openingHours: Array.from({ length: 7 }, (_, day) => ({
        day,
        opensAt: '10:00',
        closesAt: '22:00',
      })),
    };

    it('blocks an order meant for now', () => {
      expect(missingFulfilmentRequirement({ ...base, store: outOfHours, address, now })).toBe(
        'bb.q Chicken Rosebank is closed — schedule for later',
      );
    });

    it('allows one scheduled for later, which is the point of scheduling', () => {
      expect(
        missingFulfilmentRequirement({
          ...base,
          store: outOfHours,
          address,
          scheduledFor: laterToday,
          now,
        }),
      ).toBeNull();
    });

    it('still refuses dine-in, scheduled or not — there is nowhere to sit', () => {
      expect(
        missingFulfilmentRequirement({
          ...base,
          fulfilmentType: 'dinein',
          store: outOfHours,
          tableNumber: '14',
          scheduledFor: laterToday,
          now,
        }),
      ).toBe('bb.q Chicken Rosebank is closed');
    });

    it('says nothing about opening hours when the store is open', () => {
      expect(missingFulfilmentRequirement({ ...base, store, address })).toBeNull();
    });
  });

  /**
   * The other way a kitchen closes, which had no fixture anywhere in the app.
   *
   * `isOpenNow` is the branch's own veto — a power cut, a burst pipe, a shift
   * nobody turned up for — and every seeded store was `true`, so it had never
   * once fired. The rule above offers "schedule for later" and the scheduling
   * checks validate the chosen time against the *timetable*, which for this
   * store says open. So scheduling was a way straight through: pick a time an
   * hour out, every check passes, and the order goes to a kitchen that has
   * told the app it is not cooking.
   */
  describe('a store that has declared itself shut', () => {
    const now = new Date(2026, 7, 24, 14, 0);
    const laterToday = new Date(2026, 7, 24, 18, 30).toISOString();

    const unavailable = {
      ...store,
      isOpenNow: false,
      openingHours: Array.from({ length: 7 }, (_, day) => ({
        day,
        opensAt: '10:00',
        closesAt: '22:00',
      })),
    };

    it('does not offer to schedule around it, because there is no known later', () => {
      expect(missingFulfilmentRequirement({ ...base, store: unavailable, address, now })).toBe(
        'bb.q Chicken Rosebank is not taking orders right now',
      );
    });

    it('refuses a scheduled order its timetable would otherwise accept', () => {
      // The defect, stated as the test that would have caught it.
      expect(
        missingFulfilmentRequirement({
          ...base,
          store: unavailable,
          address,
          scheduledFor: laterToday,
          now,
        }),
      ).toBe('bb.q Chicken Rosebank is not taking orders right now');
    });

    it('refuses collection and dine-in too', () => {
      for (const fulfilmentType of ['collection', 'dinein'] as const) {
        expect(
          missingFulfilmentRequirement({
            ...base,
            fulfilmentType,
            store: unavailable,
            tableNumber: '14',
            now,
          }),
        ).toBe('bb.q Chicken Rosebank is not taking orders right now');
      }
    });

    /**
     * The narrowness matters. A branch flagged shut at three in the morning is
     * reported against its timetable, because it is closed either way and
     * "opens at ten" is the more useful answer than "not right now".
     */
    it('still says "closed" when the hours agree it is closed', () => {
      expect(
        missingFulfilmentRequirement({
          ...base,
          store: unavailable,
          address,
          now: new Date(2026, 7, 24, 3, 30),
        }),
      ).toBe('bb.q Chicken Rosebank is closed — schedule for later');
    });
  });

  /**
   * Two branches open later this year, a month apart. Between the first
   * opening and the second, the app has to hold a store that exists, is
   * findable, and cannot take an order.
   */
  describe('a branch that has not opened yet', () => {
    const openingLater = { ...store, opensOn: '2026-11-01T09:00:00+02:00' };
    const before = new Date('2026-10-15T12:00:00+02:00');
    const after = new Date('2026-11-02T12:00:00+02:00');

    it('refuses the order and says when it opens', () => {
      expect(
        missingFulfilmentRequirement({ ...base, store: openingLater, address, now: before }),
      ).toBe('bb.q Chicken Rosebank opens on Sun, 1 Nov');
    });

    /**
     * Not "closed — schedule for later". A branch opening in six weeks is not
     * a kitchen that shut at ten last night, and inviting someone to schedule
     * around it is wrong: the scheduling horizon is five days.
     */
    it('does not offer to schedule around an opening date', () => {
      const message = missingFulfilmentRequirement({
        ...base,
        store: { ...openingLater, isOpenNow: false },
        address,
        now: before,
      });
      expect(message).not.toMatch(/schedule/i);
      expect(message).toMatch(/opens on/);
    });

    it('takes orders normally once the date has passed', () => {
      expect(
        missingFulfilmentRequirement({ ...base, store: openingLater, address, now: after }),
      ).toBeNull();
    });

    it('ignores an opening date on a branch already trading', () => {
      expect(missingFulfilmentRequirement({ ...base, store, address, now: after })).toBeNull();
      expect(isOpeningLater(store, after)).toBe(false);
    });

    it('treats an unparseable opening date as already trading, rather than blocking', () => {
      // A bad date from the API must not make a working branch unorderable.
      expect(isOpeningLater({ ...store, opensOn: 'not-a-date' }, before)).toBe(false);
    });
  });

  /**
   * There was no delivery radius at all. Invisible while the seeded list
   * spanned four cities; against two real branches, most of the country is out
   * of range and was being quoted a delivery regardless.
   */
  describe('an address outside the delivery radius', () => {
    // Rosebank is in Johannesburg; this is Cape Town, ~1 260 km away.
    const capeTown: Address = {
      ...address,
      suburb: 'Sea Point',
      city: 'Cape Town',
      latitude: -33.9249,
      longitude: 18.4241,
    };

    it('refuses delivery and points at collection', () => {
      expect(missingFulfilmentRequirement({ ...base, store, address: capeTown })).toBe(
        'bb.q Chicken Rosebank does not deliver to Sea Point — collect instead',
      );
    });

    it('still allows collection, which the customer travels for', () => {
      expect(
        missingFulfilmentRequirement({
          ...base,
          fulfilmentType: 'collection',
          store,
          address: capeTown,
        }),
      ).toBeNull();
    });

    it('delivers to an address inside the radius', () => {
      // The seeded home address is a few hundred metres from the store.
      expect(missingFulfilmentRequirement({ ...base, store, address })).toBeNull();
    });

    it('is generous rather than exact, because straight-line understates roads', () => {
      expect(deliveryRange({ ...store, deliveryRadiusKm: 10 }, address)).toBe('in');
      expect(deliveryRange({ ...store, deliveryRadiusKm: 0 }, capeTown)).toBe('out');
    });

    /**
     * The commonest address in the app, and the one the rule could not see.
     *
     * There is no geocoder behind the add-address form, so an address a
     * customer typed carries no coordinates. It used to be stamped with the
     * Johannesburg CBD to keep the distance maths "sane", and this rule then
     * did distance maths on it: from the CBD, six of the seven seeded branches
     * sit outside their own 10 km radius. Every typed-in address in the
     * country was refused by six of them and accepted by Rosebank.
     *
     * Not knowing has to stay a third answer. Refusing on it would refuse
     * almost every real customer; measuring from a constant answers a question
     * nobody asked.
     */
    const unlocated: Address = (() => {
      const { latitude: _lat, longitude: _lon, ...rest } = capeTown;
      return rest;
    })();

    it('says so rather than guessing when the address was never located', () => {
      expect(deliveryRange(store, unlocated)).toBe('unknown');
    });

    /**
     * Asked of Sandton, not of Rosebank, and that is the whole point.
     *
     * Rosebank happens to sit 6.4 km from the Johannesburg CBD — inside its own
     * 10 km radius — so under the old stamped-coordinate behaviour it accepted
     * every typed-in address in the country and this check passed while the bug
     * was fully present. It is the single branch of the seven that did. Sandton
     * City is 10.8 km out and refused them all, which is what a customer
     * standing across the road from it actually saw.
     */
    const sandton: Store = {
      ...store,
      id: 'sandton',
      name: 'bb.q Chicken Sandton City',
      suburb: 'Sandton',
      latitude: -26.1076,
      longitude: 28.0567,
    };

    it('does not refuse a delivery on a distance it cannot measure', () => {
      expect(
        missingFulfilmentRequirement({ ...base, store: sandton, address: unlocated }),
      ).toBeNull();
    });

    it('is not fooled by a coordinate that arrived as something other than a number', () => {
      // `request<T>` casts rather than validates, so the wire decides this.
      const wrong = { ...capeTown, latitude: '-33.9249' } as unknown as Address;
      expect(deliveryRange(store, wrong)).toBe('unknown');
    });
  });

  it('wants a table number for dine-in, and not whitespace', () => {
    const dinein = { ...base, fulfilmentType: 'dinein' as const, store };
    expect(missingFulfilmentRequirement(dinein)).toBe('Enter your table number');
    expect(missingFulfilmentRequirement({ ...dinein, tableNumber: '   ' })).toBe(
      'Enter your table number',
    );
    expect(missingFulfilmentRequirement({ ...dinein, tableNumber: '14' })).toBeNull();
  });
});

/**
 * The regression this exists for: checkout memoised its blocker on the store's
 * `missingRequirement` method, whose identity never changes, so the memo kept
 * returning the first answer it ever computed. Picking a store left the Place
 * Order button disabled, still reading "Choose a store".
 *
 * A pure function cannot go stale, so this asserts the property that matters —
 * the same inputs that the screen re-renders on produce a fresh answer.
 */
describe('the blocker keeps up with the store', () => {
  beforeEach(() => {
    act(() => {
      // `forgetPerson`, not `reset` — `reset` deliberately keeps the address
      // now, which would leak one test's address into the next.
      useFulfilmentStore.getState().forgetPerson();
    });
  });

  it('clears as each requirement is met', () => {
    const read = () => {
      const { fulfilmentType, store: s, address: a, tableNumber } = useFulfilmentStore.getState();
      return missingFulfilmentRequirement({ fulfilmentType, store: s, address: a, tableNumber });
    };

    expect(read()).toBe('Choose a store');

    act(() => {
      useFulfilmentStore.getState().setStore(store);
    });
    expect(read()).toBe('Add a delivery address');

    act(() => {
      useFulfilmentStore.getState().setAddress(address);
    });
    expect(read()).toBeNull();
  });

  it('agrees with the store method it replaced', () => {
    act(() => {
      useFulfilmentStore.getState().setStore(store);
    });

    const state = useFulfilmentStore.getState();
    expect(state.missingRequirement()).toBe(
      missingFulfilmentRequirement({
        fulfilmentType: state.fulfilmentType,
        store: state.store,
        address: state.address,
        tableNumber: state.tableNumber,
      }),
    );
  });
});

/**
 * The selected store is persisted whole — `isOpenNow` and all — and rehydrated
 * on the next launch without ever being checked against the live list. So the
 * closed-store guard was reading a flag that could be days old, and in the
 * seeded data was hardcoded `true` and never recomputed on fetch besides.
 *
 * It was not a theoretical hole. Driven in a browser with the clock pinned to
 * 03:30 in Johannesburg, every branch showed "Open now", checkout did not
 * block, and order BBQ-4823 was placed with a kitchen that shut at 22:00.
 */
describe('a store that has shut since it was chosen', () => {
  const TRADING_HOURS = Array.from({ length: 7 }, (_, day) => ({
    day,
    opensAt: '10:00',
    closesAt: '22:00',
  }));

  /** Saved while the branch was open, and still claiming so. */
  const stale: Store = { ...store, openingHours: TRADING_HOURS, isOpenNow: true };

  // Built in the running process's own zone: published hours are compared
  // against the device's wall clock, so a pinned offset here would be testing
  // the harness's timezone rather than the rule.
  const middleOfTheNight = new Date(2026, 7, 24, 3, 30);
  const lunchtime = new Date(2026, 7, 24, 14, 0);

  it('refuses the order rather than trusting the saved flag', () => {
    expect(
      missingFulfilmentRequirement({
        ...base,
        store: stale,
        address,
        now: middleOfTheNight,
      }),
    ).toBe('bb.q Chicken Rosebank is closed — schedule for later');
  });

  it('takes the order during trading hours', () => {
    expect(
      missingFulfilmentRequirement({ ...base, store: stale, address, now: lunchtime }),
    ).toBeNull();
  });

  /**
   * Scheduling is the whole point of ordering out of hours, so it still
   * rescues a closed branch — this guard must not take that away.
   */
  it('still lets a closed branch be scheduled for later', () => {
    expect(
      missingFulfilmentRequirement({
        ...base,
        store: stale,
        address,
        scheduledFor: '2026-08-24T12:00:00+02:00',
        now: middleOfTheNight,
      }),
    ).toBeNull();
  });

  /** There is nowhere to sit at three in the morning, scheduled or not. */
  it('refuses dine-in at a shut branch even when scheduled', () => {
    expect(
      missingFulfilmentRequirement({
        ...base,
        fulfilmentType: 'dinein',
        store: stale,
        tableNumber: '12',
        scheduledFor: '2026-08-24T12:00:00+02:00',
        now: middleOfTheNight,
      }),
    ).toBe('bb.q Chicken Rosebank is closed');
  });
});

/**
 * "Schedule for later" is what the app tells a customer who has found a closed
 * kitchen, so it had better not be a way around the closed-kitchen rule.
 *
 * It was. A scheduled time was chosen once and then sat on, and nothing ever
 * looked at it again. Driven in a browser: pick 18:00 at five o'clock, put the
 * phone down, place the order at half past seven — accepted, and the
 * confirmation read "Scheduled for Mon, 24 Aug · 18:00".
 */
describe('a scheduled time that is no longer any good', () => {
  const TRADING_HOURS = Array.from({ length: 7 }, (_, day) => ({
    day,
    opensAt: '10:00',
    closesAt: '22:00',
  }));
  const branch: Store = { ...store, openingHours: TRADING_HOURS, isOpenNow: true };

  const fivePm = new Date(2026, 7, 24, 17, 0);
  const halfPastSeven = new Date(2026, 7, 24, 19, 30);
  const sixPm = new Date(2026, 7, 24, 18, 0).toISOString();

  const check = (scheduledFor: string, now: Date) =>
    missingFulfilmentRequirement({ ...base, store: branch, address, scheduledFor, now });

  it('accepts the slot while it is still ahead', () => {
    expect(check(sixPm, fivePm)).toBeNull();
  });

  it('refuses it once it has passed', () => {
    expect(check(sixPm, halfPastSeven)).toBe('That time has passed — pick another');
  });

  /** The boundary is worth pinning: the slot itself is too late to start. */
  it('refuses the slot at the very moment it arrives', () => {
    expect(check(sixPm, new Date(2026, 7, 24, 18, 0))).toBe('That time has passed — pick another');
  });

  /**
   * The other half. A time can be in the future and still be a time nobody is
   * there — which is exactly what a slot list built from the wrong hours hands
   * out.
   */
  it('refuses a time outside the branch hours, however far ahead it is', () => {
    const threeAmTomorrow = new Date(2026, 7, 25, 3, 0).toISOString();
    expect(check(threeAmTomorrow, fivePm)).toBe(
      'bb.q Chicken Rosebank is closed at 03:00 — pick another time',
    );
  });

  it('refuses a slot at closing time, when the kitchen cannot start it', () => {
    const atClosing = new Date(2026, 7, 24, 22, 0).toISOString();
    expect(check(atClosing, fivePm)).toBe(
      'bb.q Chicken Rosebank is closed at 22:00 — pick another time',
    );
  });

  it('has no opinion on hours for a branch that publishes none', () => {
    const noHours: Store = { ...branch, openingHours: [] };
    const threeAmTomorrow = new Date(2026, 7, 25, 3, 0).toISOString();
    expect(
      missingFulfilmentRequirement({
        ...base,
        store: noHours,
        address,
        scheduledFor: threeAmTomorrow,
        now: fivePm,
      }),
    ).toBeNull();
  });

  it('asks for a time rather than crashing on a corrupt one', () => {
    expect(check('not a date', fivePm)).toBe('Pick a time for your order');
  });
});

/**
 * One rule, one implementation.
 *
 * "Which kinds of order can this branch take" was written out three times —
 * `StoreCard` deciding whether the card is tappable, the fulfilment store
 * deciding whether a chosen branch survives a change of type, and
 * `storeService` filtering the list. All three agreed, which is the most that
 * can be said for three copies of a rule.
 *
 * This codebase has twice shipped a bug whose whole cause was one rule written
 * more than once: the route guard that existed in two states of wrongness with
 * a third place carrying none, and the phone number that a regex and a
 * normaliser disagreed about. So this is the same grep the route test uses,
 * pointed at the fields that carry this one — a fourth copy cannot arrive
 * quietly.
 */
describe('which orders a branch can take', () => {
  const sourceFiles = () => {
    const root = path.resolve(__dirname, '..');
    const found: string[] = [];

    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.tsx?$/.test(entry.name)) found.push(full);
      }
    };
    for (const dir of ['src/app', 'src/features', 'src/services', 'src/store']) {
      walk(path.join(root, dir));
    }
    return found;
  };

  it('is decided in exactly one place', () => {
    const offenders: string[] = [];

    /**
     * The rule is the *mapping* — a fulfilment type on one side, a flag on the
     * other — so that is what this looks for, not the flags alone.
     *
     * Reading a flag by itself is a different thing and a legitimate one:
     * `StoreCard` renders a badge per kind of order a branch does, which is
     * three independent facts being shown rather than one question being
     * answered a fourth time. Grepping the flags alone flagged all three.
     *
     * All three original copies mentioned both halves on the same line, which
     * is what makes this the right grep rather than a lucky one.
     */
    for (const file of sourceFiles()) {
      for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
        if (!/supportsDelivery|supportsCollection|supportsDineIn/.test(line)) continue;
        if (!/fulfilmentType/.test(line)) continue;
        offenders.push(`${file}: ${line.trim()}`);
      }
    }

    // `supportsFulfilment` lives in src/utils, which this sweep does not walk —
    // so anything found here is a second opinion about the same question.
    expect(offenders).toEqual([]);
  });

  it('answers each type from the matching flag', () => {
    const branch = {
      supportsDelivery: true,
      supportsCollection: false,
      supportsDineIn: true,
    };
    expect(supportsFulfilment(branch, 'delivery')).toBe(true);
    expect(supportsFulfilment(branch, 'collection')).toBe(false);
    expect(supportsFulfilment(branch, 'dinein')).toBe(true);
  });
});
