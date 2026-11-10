import { describe, expect, it } from 'vitest';
import {
  assertCan,
  can,
  campaignSchema,
  canSchedule,
  ConfigurationError,
  assertCapabilities,
  defaultNotificationPreferences,
  effectiveState,
  fixtureSchema,
  FAN_TERMS_VERSION,
  COMMUNITY_RULES_VERSION,
  fanPostDraftSchema,
  initialStatusFor,
  isAllowedDeepLink,
  isLiveContent,
  isTicketTokenUsable,
  matchSchema,
  memberAccountSchema,
  nextModerationStatus,
  ownerCanDelete,
  PERMISSIONS,
  PermissionError,
  redemptionSchema,
  registerSchema,
  resolveCapabilities,
  rewardWalletSchema,
  rolesWith,
  scoreIsShowable,
  secureTicketSchema,
  validateFanMedia,
  type Provenance,
} from '../src';

const now = new Date('2026-11-10T12:00:00+02:00');
const demo: Provenance = {
  source: 'demo',
  providerRef: null,
  fetchedAt: now.toISOString(),
  updatedAt: null,
  state: 'demo',
};
const live: Provenance = { ...demo, source: 'match-feed', state: 'live' };

const club = { teamId: 'kc', name: 'Kaizer Chiefs', isClub: true, badgePath: null };
const opp = { teamId: 'opp', name: 'Demo Opponent', isClub: false, badgePath: null };
const baseFixture = {
  id: 'f1',
  competition: { id: 'c', name: 'Demo Competition' },
  home: club,
  away: opp,
  venue: null,
  kickoff: null,
  kickoffConfirmed: false,
  status: 'completed' as const,
  ticketingAvailable: false,
};

describe('no fabricated football data', () => {
  it('rejects a demo fixture that carries a score', () => {
    const r = fixtureSchema.safeParse({
      ...baseFixture,
      score: { home: 2, away: 1 },
      provenance: demo,
    });
    expect(r.success).toBe(false);
  });

  it('accepts a scored fixture from an authorised feed', () => {
    const r = fixtureSchema.safeParse({
      ...baseFixture,
      score: { home: 2, away: 1 },
      provenance: live,
    });
    expect(r.success).toBe(true);
    if (r.success) expect(scoreIsShowable(r.data)).toBe(true);
  });

  it('rejects a fixture with no club team', () => {
    const r = fixtureSchema.safeParse({ ...baseFixture, home: opp, score: null, provenance: demo });
    expect(r.success).toBe(false);
  });

  it('rejects demo line-ups, events and stats', () => {
    const fixture = { ...baseFixture, score: null, provenance: demo };
    const r = matchSchema.safeParse({
      fixture,
      lineups: null,
      events: [],
      stats: [{ key: 'shots', home: 3, away: 2 }],
      minute: null,
      provenance: demo,
    });
    expect(r.success).toBe(false);
  });
});

describe('provenance', () => {
  it('downgrades old live data to stale and leaves demo alone', () => {
    const old = { ...live, fetchedAt: new Date(now.getTime() - 120_000).toISOString() };
    expect(effectiveState(old, now, 60_000)).toBe('stale');
    expect(effectiveState(live, now, 60_000)).toBe('live');
    expect(effectiveState(demo, now, 1)).toBe('demo');
  });
});

describe('membership', () => {
  it('never lets demo data claim verified membership', () => {
    const r = memberAccountSchema.safeParse({
      verificationState: 'verified',
      memberNumberLast4: 'A1B2',
      tier: null,
      validUntil: null,
      renewalUrl: null,
      provenance: demo,
    });
    expect(r.success).toBe(false);
  });

  it('only accepts the last four characters of a member number', () => {
    const r = memberAccountSchema.safeParse({
      verificationState: 'not_linked',
      memberNumberLast4: '12345678',
      tier: null,
      validUntil: null,
      renewalUrl: null,
      provenance: live,
    });
    expect(r.success).toBe(false);
  });
});

describe('tickets', () => {
  const issuedAt = now.toISOString();
  it('rejects long-lived entry tokens', () => {
    const r = secureTicketSchema.safeParse({
      ticketId: 't1',
      token: 'x'.repeat(32),
      format: 'qr',
      issuedAt,
      expiresAt: new Date(now.getTime() + 3600_000).toISOString(),
    });
    expect(r.success).toBe(false);
  });

  it('treats a token as unusable just before expiry', () => {
    const t = secureTicketSchema.parse({
      ticketId: 't1',
      token: 'x'.repeat(32),
      format: 'qr',
      issuedAt,
      expiresAt: new Date(now.getTime() + 60_000).toISOString(),
    });
    expect(isTicketTokenUsable(t, now)).toBe(true);
    expect(isTicketTokenUsable(t, new Date(now.getTime() + 57_000))).toBe(false);
  });
});

describe('rewards', () => {
  it('has no such thing as a demo wallet', () => {
    expect(
      rewardWalletSchema.safeParse({ balance: 1200, tier: null, provenance: demo }).success,
    ).toBe(false);
  });

  it('requires a UUID idempotency key and a provider ref when confirmed', () => {
    const base = { rewardId: 'r1', createdAt: now.toISOString() };
    expect(
      redemptionSchema.safeParse({
        ...base,
        idempotencyKey: 'abc',
        status: 'pending',
        providerRef: null,
      }).success,
    ).toBe(false);
    expect(
      redemptionSchema.safeParse({
        ...base,
        idempotencyKey: '3b241101-e2bb-4255-8caf-4136c566a962',
        status: 'confirmed',
        providerRef: null,
      }).success,
    ).toBe(false);
  });
});

describe('fan moments', () => {
  const consent = {
    termsVersion: FAN_TERMS_VERSION,
    communityRulesVersion: COMMUNITY_RULES_VERSION,
    rightsConfirmed: true,
    showDisplayName: false,
    acceptedAt: now.toISOString(),
  };
  const media = {
    mimeType: 'image/jpeg',
    bytes: 2_000_000,
    durationSeconds: null,
    width: 1200,
    height: 1500,
  };

  it('enforces upload rules', () => {
    expect(validateFanMedia({ mimeType: 'image/gif', bytes: 10 })).toContain('unsupported_type');
    expect(validateFanMedia({ mimeType: 'image/png', bytes: 11 * 1024 * 1024 })).toContain(
      'too_large',
    );
    expect(validateFanMedia({ mimeType: 'video/mp4', bytes: 1000, durationSeconds: 31 })).toContain(
      'too_long',
    );
    expect(validateFanMedia({ mimeType: 'video/mp4', bytes: 1000, durationSeconds: 12 })).toEqual(
      [],
    );
  });

  it('requires current consent and rights confirmation', () => {
    const ok = {
      caption: 'Matchday',
      media,
      showsMinors: false,
      guardianConsentConfirmed: false,
      consent,
    };
    expect(fanPostDraftSchema.safeParse(ok).success).toBe(true);
    expect(
      fanPostDraftSchema.safeParse({ ...ok, consent: { ...consent, termsVersion: 'old' } }).success,
    ).toBe(false);
    expect(
      fanPostDraftSchema.safeParse({ ...ok, consent: { ...consent, rightsConfirmed: false } })
        .success,
    ).toBe(false);
  });

  it('requires guardian consent for moments showing children, and escalates them', () => {
    const draft = {
      caption: '',
      media,
      showsMinors: true,
      guardianConsentConfirmed: false,
      consent,
    };
    expect(fanPostDraftSchema.safeParse(draft).success).toBe(false);
    expect(initialStatusFor({ showsMinors: true })).toBe('escalated');
    expect(initialStatusFor({ showsMinors: false })).toBe('pending_review');
  });

  it('allows only defined moderation transitions', () => {
    expect(nextModerationStatus('pending_review', 'approve')).toBe('approved');
    expect(nextModerationStatus('rejected', 'approve')).toBeNull();
    expect(nextModerationStatus('removed_by_user', 'restore')).toBeNull();
    expect(nextModerationStatus('hidden', 'restore')).toBe('approved');
  });

  it('lets owners delete except while escalated', () => {
    expect(ownerCanDelete('approved')).toBe(true);
    expect(ownerCanDelete('pending_review')).toBe(true);
    expect(ownerCanDelete('escalated')).toBe(false);
  });
});

describe('content windows', () => {
  it('respects publish and unpublish times', () => {
    const later = new Date(now.getTime() + 3600_000).toISOString();
    const earlier = new Date(now.getTime() - 3600_000).toISOString();
    expect(isLiveContent({ status: 'published', publishAt: earlier, unpublishAt: null }, now)).toBe(
      true,
    );
    expect(isLiveContent({ status: 'scheduled', publishAt: later, unpublishAt: null }, now)).toBe(
      false,
    );
    expect(isLiveContent({ status: 'published', publishAt: null, unpublishAt: earlier }, now)).toBe(
      false,
    );
    expect(isLiveContent({ status: 'draft', publishAt: null, unpublishAt: null }, now)).toBe(false);
  });
});

describe('notifications', () => {
  it('starts every optional category off', () => {
    const p = defaultNotificationPreferences();
    expect(p.pushEnabled).toBe(false);
    expect(p.categories.club_news).toBe(false);
    expect(p.categories.account).toBe(true);
  });

  it('allow-lists deep links', () => {
    expect(isAllowedDeepLink('/match/abc-123')).toBe(true);
    expect(isAllowedDeepLink('https://example.com')).toBe(false);
    expect(isAllowedDeepLink('/profile/delete')).toBe(false);
  });

  it('validates campaigns and their schedule', () => {
    const c = {
      id: 'c1',
      category: 'matchday',
      title: 'Line-ups are in',
      body: 'See who starts today.',
      deepLink: '/match',
      audience: 'opted_in_all',
      fixtureId: null,
      scheduledFor: new Date(now.getTime() + 3600_000).toISOString(),
    };
    expect(campaignSchema.safeParse(c).success).toBe(true);
    expect(campaignSchema.safeParse({ ...c, deepLink: 'https://x.y' }).success).toBe(false);
    expect(campaignSchema.safeParse({ ...c, audience: 'opted_in_ticket_holders' }).success).toBe(
      false,
    );
    expect(canSchedule(c, now)).toBe(true);
    expect(canSchedule({ scheduledFor: now.toISOString() }, now)).toBe(false);
  });
});

describe('rbac', () => {
  it('gives super admins every permission and analysts read-only access', () => {
    for (const p of PERMISSIONS) expect(can('super_admin', p)).toBe(true);
    expect(can('analyst', 'audit.read')).toBe(true);
    expect(can('analyst', 'content.write')).toBe(false);
    expect(can('analyst', 'moderation.act')).toBe(false);
  });

  it('keeps role management with super admins only', () => {
    expect(rolesWith('roles.manage')).toEqual(['super_admin']);
  });

  it('separates publishing from moderation', () => {
    expect(can('moderator', 'content.publish')).toBe(false);
    expect(can('content_admin', 'moderation.act')).toBe(false);
  });

  it('denies a missing role and throws a typed error', () => {
    expect(can(null, 'ops.read')).toBe(false);
    expect(() => assertCan('moderator', 'roles.manage')).toThrow(PermissionError);
  });
});

describe('capabilities', () => {
  it('defaults local builds to demo and keeps payments off', () => {
    const { capabilities, problems } = resolveCapabilities({
      appEnv: 'local',
      flags: {},
      vars: {},
    });
    expect(problems).toEqual([]);
    expect(capabilities.matchData).toBe('demo');
    expect(capabilities.payments).toBe('off');
  });

  it('blocks demo adapters in production', () => {
    const r = resolveCapabilities({ appEnv: 'production', flags: { matchData: 'demo' }, vars: {} });
    expect(r.capabilities.matchData).toBe('off');
    expect(r.problems[0]).toMatch(/blocked in production/);
  });

  it('defaults production to off rather than demo', () => {
    const r = resolveCapabilities({ appEnv: 'production', flags: {}, vars: {} });
    expect(r.problems).toEqual([]);
    expect(Object.values(r.capabilities).every((m) => m === 'off')).toBe(true);
  });

  it('fails clearly when a live feature lacks its variables', () => {
    expect(() =>
      assertCapabilities({ appEnv: 'staging', flags: { tickets: 'live' }, vars: {} }),
    ).toThrow(ConfigurationError);
    const ok = assertCapabilities({
      appEnv: 'staging',
      flags: { tickets: 'live' },
      vars: {
        EXPO_PUBLIC_SUPABASE_URL: 'https://x.supabase.co',
        EXPO_PUBLIC_SUPABASE_ANON_KEY: 'k',
      },
    });
    expect(ok.tickets).toBe('live');
  });

  it('refuses to switch payments on', () => {
    const r = resolveCapabilities({ appEnv: 'local', flags: { payments: 'live' }, vars: {} });
    expect(r.capabilities.payments).toBe('off');
    expect(r.problems).toHaveLength(1);
  });
});

describe('registration', () => {
  it('requires terms and a reasonable password, with marketing as a separate choice', () => {
    const base = {
      displayName: 'Khosi',
      email: 'fan@example.com',
      password: 'amakhosi2026',
      acceptedTerms: true,
      marketingOptIn: false,
    };
    expect(registerSchema.safeParse(base).success).toBe(true);
    expect(registerSchema.safeParse({ ...base, acceptedTerms: false }).success).toBe(false);
    expect(registerSchema.safeParse({ ...base, password: 'short1' }).success).toBe(false);
  });
});
