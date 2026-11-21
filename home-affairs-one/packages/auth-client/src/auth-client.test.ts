import type { PersonAccount, StaffMember } from '@hao/api-contracts';
import { describe, expect, it, vi } from 'vitest';
import { STEP_UP_MINUTES, createAuthClient, tierForSignIn } from './index';

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
  };
}

const account = (tier: PersonAccount['assuranceTier']): PersonAccount => ({
  personToken: 'PERSON-DEMO-7X3Q',
  displayName: 'Thandi M.',
  givenName: 'Thandi',
  initials: 'TM',
  personaKind: 'citizen',
  personaSummary: 'Demo citizen.',
  locale: 'en-ZA',
  residency: 'IN_SOUTH_AFRICA',
  assuranceTier: tier,
  verifiedAt: null,
  contacts: [],
  passkeyRegistered: true,
  recoveryState: 'READY',
  synthetic: true,
});

const staff: StaffMember = {
  staffRef: 'STAFF-DEMO-1001',
  displayName: 'Nomsa P.',
  initials: 'NP',
  role: 'CASE_OFFICER',
  queues: ['Passports'],
  synthetic: true,
};

describe('tierForSignIn', () => {
  it('never lets a one-time code exceed basic access', () => {
    expect(tierForSignIn('A2', 'verified-contact')).toBe('A1');
    expect(tierForSignIn('A3', 'verified-contact')).toBe('A1');
  });

  it('caps a passkey session at the proofed level, and at A2', () => {
    expect(tierForSignIn('A1', 'passkey')).toBe('A1');
    expect(tierForSignIn('A2', 'passkey')).toBe('A2');
    expect(tierForSignIn('A3', 'passkey')).toBe('A2');
  });
});

describe('auth client', () => {
  it('signs a citizen in and out, notifying subscribers', () => {
    const auth = createAuthClient({ storage: memoryStorage() });
    const listener = vi.fn();
    auth.subscribe(listener);
    const session = auth.signInCitizen(account('A2'), 'passkey');
    expect(session.tier).toBe('A2');
    expect(auth.getSession()?.subjectRef).toBe('PERSON-DEMO-7X3Q');
    auth.signOut();
    expect(auth.getSession()).toBeNull();
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('steps a verified passkey session up to A3, then lets it expire', () => {
    let now = new Date('2026-11-21T08:00:00Z');
    const auth = createAuthClient({ storage: memoryStorage(), now: () => now });
    auth.signInCitizen(account('A2'), 'passkey');
    expect(auth.stepUp().tier).toBe('A3');
    now = new Date(now.getTime() + (STEP_UP_MINUTES + 1) * 60_000);
    expect(auth.getSession()?.tier).toBe('A2');
    expect(auth.getSession()?.stepUpExpiresAt).toBeNull();
  });

  it('refuses a step-up for an unverified account or a code sign-in', () => {
    const basic = createAuthClient({ storage: memoryStorage() });
    basic.signInCitizen(account('A1'), 'passkey');
    expect(() => basic.stepUp()).toThrow();

    const code = createAuthClient({ storage: memoryStorage() });
    code.signInCitizen(account('A2'), 'verified-contact');
    expect(() => code.stepUp()).toThrow();
  });

  it('gives staff the separate workforce tier and no step-up', () => {
    const auth = createAuthClient({ storage: memoryStorage() });
    const session = auth.signInStaff(staff);
    expect(session.role).toBe('staff');
    expect(session.tier).toBe('A4');
    expect(() => auth.stepUp()).toThrow();
  });

  it('treats corrupt stored sessions as signed out', () => {
    const storage = memoryStorage();
    storage.setItem('hao.session.v1', '{broken');
    expect(createAuthClient({ storage }).getSession()).toBeNull();
  });
});
