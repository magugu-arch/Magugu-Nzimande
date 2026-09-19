import {
  earnsLoyalty,
  formatCents,
  fromCents,
  isCampaignLive,
  isPromotionEligible,
  loyaltyNoteFor,
  mapCatalogueForProvider,
  mapItemForProvider,
  orphanedOverrides,
  parseDeepLinkTarget,
  pathForTarget,
  pendingDeepLink,
  requiresAccount,
  toCents,
  type CanonicalItem,
  type CatalogueOverrides,
} from '@/integrations/delivery';

/**
 * The commercial safeguards — extension §7 and §8 — plus the deep-link
 * contract from the main brief §17.10.
 *
 * These are the rules that cost money rather than uptime: a direct-only
 * promotion funded on a commissioned channel, points promised on an order
 * that will never be attributed, a marketplace price that silently fell back
 * to the dine-in one.
 */

describe('channel eligibility for promotions', () => {
  const dateNight = { channels: ['pappas-direct'] as const };

  it('allows a direct-only promotion on the direct channel', () => {
    expect(isPromotionEligible(dateNight, 'pappas-direct')).toBe(true);
  });

  it('refuses it on a marketplace channel', () => {
    // §7: "a direct-only promotion cannot accidentally be applied to Uber
    // Eats or Mr D."
    expect(isPromotionEligible(dateNight, 'uber-eats')).toBe(false);
    expect(isPromotionEligible(dateNight, 'mr-d')).toBe(false);
  });

  it('treats an empty channel list as eligible nowhere', () => {
    // The safe direction. A promotion nobody scoped should reach nobody,
    // rather than everybody.
    expect(isPromotionEligible({ channels: [] }, 'pappas-direct')).toBe(false);
  });

  it('holds a campaign closed outside its window', () => {
    const window = { startsAt: '2026-10-01T00:00:00Z', endsAt: '2026-10-31T23:59:59Z' };
    expect(isCampaignLive(window, Date.parse('2026-09-19T12:00:00Z'))).toBe(false);
    expect(isCampaignLive(window, Date.parse('2026-10-15T12:00:00Z'))).toBe(true);
    expect(isCampaignLive(window, Date.parse('2026-11-02T12:00:00Z'))).toBe(false);
  });

  it('treats an unreadable date as closed, not as permanent', () => {
    expect(isCampaignLive({ endsAt: 'next Tuesday' })).toBe(false);
  });
});

describe('loyalty attribution', () => {
  it('earns on a direct order', () => {
    expect(earnsLoyalty('pappas-direct')).toBe(true);
  });

  it('does not earn on a marketplace order, because no agreement says it can', () => {
    // §7: points apply to direct orders "unless a third-party agreement and
    // technical integration explicitly permit attribution". Neither exists.
    expect(earnsLoyalty('uber-eats')).toBe(false);
    expect(earnsLoyalty('mr-d')).toBe(false);
  });

  it('gives the customer a plain sentence instead of silence', () => {
    expect(loyaltyNoteFor('uber-eats')).toMatch(/directly with Pappas/);
    expect(loyaltyNoteFor('pappas-direct')).toBeNull();
  });
});

describe('provider catalogue mapping', () => {
  const souvlaki: CanonicalItem = {
    sku: 'souvlaki-pork',
    name: 'Pork Souvlaki',
    priceCents: 18_500,
    available: true,
  };
  const steak: CanonicalItem = {
    sku: 'steak-on-the-rock',
    name: 'Steak on the Rock',
    priceCents: 42_000,
    available: true,
  };

  it('falls back to the canonical dish when a channel says nothing', () => {
    // The behaviour that makes adding a dish automatically correct on every
    // channel, instead of correct on the one somebody remembered.
    const mapped = mapItemForProvider(souvlaki, 'uber-eats');
    expect(mapped).toMatchObject({
      providerSku: 'souvlaki-pork',
      name: 'Pork Souvlaki',
      priceCents: 18_500,
      overridden: false,
    });
  });

  it('applies a channel price and name where one is set', () => {
    const overrides: CatalogueOverrides = {
      'uber-eats': {
        'souvlaki-pork': {
          pappasSku: 'souvlaki-pork',
          providerSku: 'UE-SOUV-01',
          providerName: 'Pork Souvlaki Plate',
          priceCents: 21_500,
        },
      },
    };
    expect(mapItemForProvider(souvlaki, 'uber-eats', overrides)).toMatchObject({
      providerSku: 'UE-SOUV-01',
      name: 'Pork Souvlaki Plate',
      priceCents: 21_500,
      overridden: true,
    });
  });

  it('lets a channel withdraw a dish that cannot travel', () => {
    // A steak served on a hot stone does not survive a courier bag.
    const overrides: CatalogueOverrides = {
      'mr-d': {
        'steak-on-the-rock': { pappasSku: 'steak-on-the-rock', providerAvailability: false },
      },
    };
    expect(
      mapCatalogueForProvider([souvlaki, steak], 'mr-d', overrides).map((i) => i.pappasSku),
    ).toEqual(['souvlaki-pork']);
  });

  it('will not let an override resurrect a dish the kitchen has taken off', () => {
    const overrides: CatalogueOverrides = {
      'uber-eats': { 'souvlaki-pork': { pappasSku: 'souvlaki-pork', providerAvailability: true } },
    };
    const mapped = mapItemForProvider({ ...souvlaki, available: false }, 'uber-eats', overrides);
    expect(mapped.available).toBe(false);
  });

  it('finds overrides left behind by a renamed dish', () => {
    // §8 asks for catalogue sync failures to be logged. The commonest is not
    // a network error — it is an override that quietly stopped applying.
    const overrides: CatalogueOverrides = {
      'uber-eats': { 'souvlaki-lamb': { pappasSku: 'souvlaki-lamb', priceCents: 1 } },
    };
    expect(orphanedOverrides([souvlaki], overrides)).toEqual([
      { provider: 'uber-eats', pappasSku: 'souvlaki-lamb' },
    ]);
  });

  it('ships with no invented marketplace prices', () => {
    // §15 and §10.12. An empty table is the accurate statement that no
    // marketplace listing exists yet.
    const mapped = mapItemForProvider(souvlaki, 'uber-eats');
    expect(mapped.overridden).toBe(false);
  });
});

describe('money at the provider boundary', () => {
  it('rounds rather than truncates, so R0.29 is 29 cents', () => {
    // 0.29 * 100 is 28.999999999999996 in IEEE 754; Math.floor gives 28.
    expect(toCents(0.29)).toBe(29);
    expect(toCents(189.5)).toBe(18_950);
  });

  it('round-trips', () => {
    expect(fromCents(toCents(432.15))).toBeCloseTo(432.15, 5);
  });

  it('refuses a non-integer cent amount rather than quietly halving it', () => {
    expect(() => fromCents(1050.5)).toThrow();
  });

  it('formats for a South African customer', () => {
    expect(formatCents(18_500)).toBe('R185.00');
  });
});

describe('deep links from a push notification', () => {
  afterEach(() => pendingDeepLink.clear());

  it('parses each target the brief names', () => {
    expect(parseDeepLinkTarget({ type: 'menuItem', itemId: 'souvlaki-pork' })).toEqual({
      type: 'menuItem',
      itemId: 'souvlaki-pork',
    });
    expect(parseDeepLinkTarget({ type: 'reservation' })).toEqual({ type: 'reservation' });
  });

  it('refuses an id that could climb out of its route segment', () => {
    // A push payload is untrusted input and this id goes straight into a path.
    expect(parseDeepLinkTarget({ type: 'menuItem', itemId: '../../account/profile' })).toBeNull();
    expect(parseDeepLinkTarget({ type: 'reward', rewardId: 'a/b' })).toBeNull();
  });

  it('returns null for junk rather than routing somewhere arbitrary', () => {
    expect(parseDeepLinkTarget(null)).toBeNull();
    expect(parseDeepLinkTarget({ type: 'wire-transfer' })).toBeNull();
  });

  it('routes each target to its screen', () => {
    expect(pathForTarget({ type: 'event', eventId: 'date-night' })).toBe('/events/date-night');
    expect(pathForTarget({ type: 'reservation' })).toBe('/reserve');
  });

  it('knows which targets need an account first', () => {
    expect(requiresAccount({ type: 'reward', rewardId: 'r1' })).toBe(true);
    expect(requiresAccount({ type: 'menuItem', itemId: 'm1' })).toBe(false);
  });

  it('holds a target until the app can honour it, then hands it over once', () => {
    // Both deferred cases from §17.10: a cold start with no navigation tree,
    // and a signed-out member who must authenticate first.
    pendingDeepLink.set({ type: 'campaign', campaignId: 'date-night' });
    expect(pendingDeepLink.take()).toEqual({ type: 'campaign', campaignId: 'date-night' });
    // Taken means honoured. A second read must not navigate again.
    expect(pendingDeepLink.take()).toBeNull();
  });

  it('keeps only the newest target, because that is the one just tapped', () => {
    pendingDeepLink.set({ type: 'campaign', campaignId: 'old' });
    pendingDeepLink.set({ type: 'campaign', campaignId: 'new' });
    expect(pendingDeepLink.take()).toMatchObject({ campaignId: 'new' });
  });
});
