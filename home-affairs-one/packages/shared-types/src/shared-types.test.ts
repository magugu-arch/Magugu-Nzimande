import { describe, expect, it } from 'vitest';
import {
  ASSURANCE_TIERS,
  CHANNELS,
  CHANNEL_INFO,
  FLAG_PROFILES,
  GatewayError,
  STATUS_FAMILIES,
  STATUS_INFO,
  isGatewayError,
  maskReference,
  meetsTier,
} from './index';

describe('assurance tiers', () => {
  it('orders the citizen tiers A0 to A3', () => {
    expect(meetsTier('A2', 'A1')).toBe(true);
    expect(meetsTier('A2', 'A2')).toBe(true);
    expect(meetsTier('A1', 'A2')).toBe(false);
    expect(meetsTier('A3', 'A0')).toBe(true);
  });

  it('treats A4 as a separate workforce tier, not "more than A3"', () => {
    expect(meetsTier('A4', 'A4')).toBe(true);
    expect(meetsTier('A3', 'A4')).toBe(false);
    // A staff session must not pass a citizen check by being "higher".
    expect(meetsTier('A4', 'A2')).toBe(false);
  });

  it('lists five tiers', () => {
    expect(ASSURANCE_TIERS).toHaveLength(5);
  });
});

describe('status taxonomy', () => {
  it('has user-facing wording for every family', () => {
    for (const family of STATUS_FAMILIES) {
      expect(STATUS_INFO[family].userLabel.length).toBeGreaterThan(3);
      expect(STATUS_INFO[family].rule.length).toBeGreaterThan(10);
    }
  });

  it('never implies approval when an application is only received', () => {
    expect(STATUS_INFO.SUBMITTED.rule).toMatch(/does not mean it is approved/i);
  });
});

describe('channels', () => {
  it('keeps the secure inbox mandatory and everything else optional', () => {
    expect(CHANNEL_INFO.SECURE_INBOX.optional).toBe(false);
    for (const channel of CHANNELS.filter((c) => c !== 'SECURE_INBOX')) {
      expect(CHANNEL_INFO[channel].optional).toBe(true);
    }
  });
});

describe('feature flag profiles', () => {
  it('keeps every gated capability off in the pilot profile', () => {
    expect(Object.values(FLAG_PROFILES.pilot).every((value) => value === false)).toBe(true);
  });
});

describe('GatewayError', () => {
  it('carries a safe message and marks transient failures retryable', () => {
    const error = new GatewayError('TIMEOUT', { traceRef: 'CORR-1' });
    expect(isGatewayError(error)).toBe(true);
    expect(error.retryable).toBe(true);
    expect(error.safeMessage).not.toMatch(/stack|exception|undefined/i);
    expect(error.traceRef).toBe('CORR-1');
  });

  it('does not retry validation or permission failures', () => {
    expect(new GatewayError('VALIDATION').retryable).toBe(false);
    expect(new GatewayError('FORBIDDEN').retryable).toBe(false);
  });
});

describe('maskReference', () => {
  it('keeps only the last four characters', () => {
    expect(maskReference('CASE-DEMO-002481')).toBe('••••2481');
    expect(maskReference('CASE-DEMO-000041')).toBe('••••0041');
  });
});
