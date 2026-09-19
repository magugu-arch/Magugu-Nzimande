import {
  eligibleSpecials,
  hasMarketingConsent,
  headlineSpecial,
  isLive,
  matchesAudience,
  mergeSpecialsIntoInbox,
  notificationFor,
  withinFrequencyCap,
  type MarketingAudience,
} from '@/features/marketing/specials';
import type { PappasPromotion } from '@/services/data/rewardsData';
import { promotions } from '@/services/data/rewardsData';
import { demoSpecials } from '@/services/data/demoFixture';

/**
 * Who gets told about a special, and when.
 *
 * `PappasPromotion` has carried `audience` and `frequencyCapHours` since the
 * campaign model was written, and nothing read either. Every campaign
 * declared who it was for and how often it could be sent; the app showed all
 * of them to everybody, always. Nothing failed, because a field nobody reads
 * cannot disagree with anything.
 *
 * These are the four gates, and the order they run in. Consent first, so a
 * customer who has opted out is never evaluated against a campaign at all.
 */

const NOW = new Date('2026-09-19T18:00:00.000Z');
const day = (n: number) => new Date(NOW.getTime() + n * 86_400_000).toISOString();

function campaign(overrides: Partial<PappasPromotion> = {}): PappasPromotion {
  return {
    id: 'test-campaign',
    headline: 'A headline',
    description: 'A description',
    assetKey: 'squareView',
    ctaLabel: 'Book a table',
    ctaHref: '/reserve',
    validFrom: day(-1),
    validUntil: day(7),
    terms: [],
    usePromotionalComposition: false,
    channels: ['pappas-direct'],
    audience: 'all',
    frequencyCapHours: 24,
    ...overrides,
  };
}

const NEVER_ORDERED: MarketingAudience = {
  hasOrdered: false,
  recentOrderCount: 0,
  daysSinceLastOrder: null,
  isBirthday: false,
};
const REGULAR: MarketingAudience = {
  hasOrdered: true,
  recentOrderCount: 5,
  daysSinceLastOrder: 3,
  isBirthday: false,
};
const LAPSED: MarketingAudience = {
  hasOrdered: true,
  recentOrderCount: 0,
  daysSinceLastOrder: 120,
  isBirthday: false,
};

const CONSENTING = { marketingConsent: true };
const PROMOS_ON = { promotions: true };

const base = {
  preferences: CONSENTING,
  notifications: PROMOS_ON,
  lastSentAt: null,
  now: NOW,
};

describe('consent, which is checked before anything else', () => {
  it('needs both the POPIA consent and the category switch', () => {
    expect(hasMarketingConsent({ marketingConsent: true }, { promotions: true })).toBe(true);
    expect(hasMarketingConsent({ marketingConsent: false }, { promotions: true })).toBe(false);
    expect(hasMarketingConsent({ marketingConsent: true }, { promotions: false })).toBe(false);
  });

  /**
   * They are separate because the acts are separate. Muting a category is not
   * withdrawing consent, and a customer who does the first has not done the
   * second — but either one means no marketing reaches them.
   */
  it('shows nothing at all once either is off', () => {
    const specials = [campaign()];
    expect(
      eligibleSpecials({
        ...base,
        specials,
        audience: REGULAR,
        preferences: { marketingConsent: false },
      }),
    ).toEqual([]);
    expect(
      eligibleSpecials({
        ...base,
        specials,
        audience: REGULAR,
        notifications: { promotions: false },
      }),
    ).toEqual([]);
  });
});

describe('the window', () => {
  it('is closed before it opens and after it ends', () => {
    expect(isLive(campaign({ validFrom: day(1), validUntil: day(5) }), NOW)).toBe(false);
    expect(isLive(campaign({ validFrom: day(-5), validUntil: day(-1) }), NOW)).toBe(false);
    expect(isLive(campaign({ validFrom: day(-1), validUntil: day(1) }), NOW)).toBe(true);
  });

  /**
   * An unparseable date is not live. The alternative — treating it as open —
   * shows an offer whose end nobody can state, which is the failure mode
   * worth defaulting away from.
   */
  it('refuses a campaign whose dates cannot be read', () => {
    expect(isLive(campaign({ validFrom: 'soon', validUntil: 'later' }), NOW)).toBe(false);
  });
});

describe('the audience', () => {
  it.each([
    ['all', NEVER_ORDERED, true],
    ['members', NEVER_ORDERED, false],
    ['members', REGULAR, true],
    ['frequent', REGULAR, true],
    ['lapsed', LAPSED, true],
    ['lapsed', REGULAR, false],
  ] as const)('%s against that customer', (audience, customer, expected) => {
    expect(matchesAudience(campaign({ audience }), customer)).toBe(expected);
  });

  /**
   * Somebody who has never ordered has not lapsed — they have not started.
   * "We miss you" to a person who has never been is the kind of message that
   * makes an app feel like it is talking to somebody else.
   */
  it('does not call a customer lapsed when they never ordered', () => {
    expect(matchesAudience(campaign({ audience: 'lapsed' }), NEVER_ORDERED)).toBe(false);
  });

  it('keeps a birthday offer for the birthday', () => {
    expect(matchesAudience(campaign({ audience: 'birthday' }), REGULAR)).toBe(false);
    expect(
      matchesAudience(campaign({ audience: 'birthday' }), { ...REGULAR, isBirthday: true }),
    ).toBe(true);
  });
});

describe('the frequency cap', () => {
  it('passes when nothing has been sent yet', () => {
    expect(withinFrequencyCap(campaign({ frequencyCapHours: 24 }), null, NOW)).toBe(true);
  });

  it('holds a second message until the cap has elapsed', () => {
    const twoHoursAgo = NOW.getTime() - 2 * 3_600_000;
    const thirtyHoursAgo = NOW.getTime() - 30 * 3_600_000;
    expect(withinFrequencyCap(campaign({ frequencyCapHours: 24 }), twoHoursAgo, NOW)).toBe(false);
    expect(withinFrequencyCap(campaign({ frequencyCapHours: 24 }), thirtyHoursAgo, NOW)).toBe(true);
  });

  /**
   * Measured against the last send of anything, not of this campaign. A
   * per-campaign cap lets three campaigns each stay politely under their own
   * limit and arrive in the same evening, which is the evening that gets
   * push notifications switched off for good.
   */
  it('is not per campaign', () => {
    const anHourAgo = NOW.getTime() - 3_600_000;
    const three = [
      campaign({ id: 'a', frequencyCapHours: 24 }),
      campaign({ id: 'b', frequencyCapHours: 24 }),
      campaign({ id: 'c', frequencyCapHours: 24 }),
    ];
    expect(
      eligibleSpecials({ ...base, specials: three, audience: REGULAR, lastSentAt: anHourAgo }),
    ).toEqual([]);
  });
});

describe('which one goes on a single surface', () => {
  /**
   * The narrowest audience wins. Showing the general message on somebody's
   * birthday is worse than showing nothing: it spends the one moment that
   * was actually personal on something that was not.
   */
  it('prefers the birthday message over the general one', () => {
    const specials = [
      campaign({ id: 'general', audience: 'all' }),
      campaign({ id: 'birthday', audience: 'birthday' }),
    ];
    const chosen = headlineSpecial({
      ...base,
      specials,
      audience: { ...REGULAR, isBirthday: true },
    });
    expect(chosen?.id).toBe('birthday');
  });

  it('returns null rather than a placeholder when nothing qualifies', () => {
    expect(
      headlineSpecial({
        ...base,
        specials: [campaign({ audience: 'birthday' })],
        audience: REGULAR,
      }),
    ).toBeNull();
  });
});

describe('specials in the notification inbox', () => {
  it('derives the id from the campaign, so it cannot arrive twice', () => {
    const special = campaign({ id: 'midweek' });
    expect(notificationFor(special, NOW).id).toBe('special-midweek');
  });

  it('does not stack the same special up on a second read', () => {
    const special = campaign({ id: 'midweek' });
    const first = mergeSpecialsIntoInbox([], [special], NOW);
    const second = mergeSpecialsIntoInbox(first, [special], NOW);
    expect(second).toHaveLength(1);
  });

  it('keeps the messages already there', () => {
    const existing = [
      {
        id: 'notif-1',
        title: 'Order',
        body: '',
        receivedAt: day(-1),
        read: false,
        category: 'order' as const,
      },
    ];
    const merged = mergeSpecialsIntoInbox(existing, [campaign({ id: 'midweek' })], NOW);
    expect(merged.map((entry) => entry.id)).toEqual(['special-midweek', 'notif-1']);
  });
});

/**
 * The shipped campaigns, against the rule that governs all of them.
 *
 * §15 forbids inventing a customer promise, and a discount is the purest
 * form of one. The three campaigns Pappas ships are editorial invitations,
 * not offers, and none of them may quote money off.
 */
describe('the shipped campaigns promise nothing nobody authorised', () => {
  it.each(promotions.map((p) => [p.id, p] as const))('%s', (_id, promotion) => {
    const text = `${promotion.headline} ${promotion.description}`;
    expect({
      id: promotion.id,
      discountLanguage: /%|\bfree\b|\d+ for \d+|off\b/i.test(text),
    }).toEqual({
      id: promotion.id,
      discountLanguage: false,
    });
  });

  /**
   * They were already segmented, which is what makes the missing engine
   * worse than it looked. Date Night ships `audience: 'members'` — written
   * that way deliberately, an invitation for people who have eaten here —
   * and until the gates existed it was shown to everybody who opened the
   * app, including somebody who had never ordered.
   *
   * This asserts the segmentation is real rather than decorative: at least
   * one campaign aims at somebody narrower than everyone, and every campaign
   * names an audience the engine actually understands.
   */
  it('names an audience the engine understands, on every campaign', () => {
    const known = ['all', 'members', 'lapsed', 'birthday', 'frequent'];
    for (const promotion of promotions) {
      expect({ id: promotion.id, known: known.includes(promotion.audience) }).toEqual({
        id: promotion.id,
        known: true,
      });
    }
  });

  it('aims at least one campaign at somebody narrower than everyone', () => {
    expect(promotions.some((promotion) => promotion.audience !== 'all')).toBe(true);
  });

  /**
   * A cap of zero is no cap. Every campaign has to state a real gap between
   * sends, or the whole gate is decorative.
   */
  it('gives every campaign a real frequency cap', () => {
    for (const promotion of promotions) {
      expect({ id: promotion.id, capped: promotion.frequencyCapHours > 0 }).toEqual({
        id: promotion.id,
        capped: true,
      });
    }
  });
});

/**
 * The demo specials exist to give the engine edges to bite on, which only
 * works if they actually differ from each other.
 */
describe('the demo specials give the engine something to decide', () => {
  const specials = demoSpecials();

  it('covers four different audiences', () => {
    expect(new Set(specials.map((s) => s.audience)).size).toBe(4);
  });

  it('marks every one as an example rather than an offer', () => {
    for (const special of specials) {
      expect({
        id: special.id,
        marked: special.terms.some((t) => /not a Pappas offer/i.test(t)),
      }).toEqual({ id: special.id, marked: true });
    }
  });

  it('quotes no discount, the same as the shipped ones', () => {
    for (const special of specials) {
      const text = `${special.headline} ${special.description}`;
      expect({ id: special.id, discount: /%|\d+ for \d+/.test(text) }).toEqual({
        id: special.id,
        discount: false,
      });
    }
  });
});
