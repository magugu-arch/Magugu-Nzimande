import type { AuditEvent, AuditPort } from '@hao/api-contracts';
import { TOPICS, createLocalPlatform, type Platform } from '@hao/local-platform';
import { GatewayError, type MutationOptions } from '@hao/shared-types';
import { describe, expect, it, vi } from 'vitest';
import { createAuditService } from '@hao/audit-service';
import {
  createCallPolicy,
  nextCorrelationId,
  type GatewayActor,
  type GatewayCallRecord,
} from './index';

/** A fake service with one method per behaviour the policy must handle. */
function fakePort() {
  let flakyCalls = 0;
  const created: string[] = [];
  return {
    created,
    async getThing(id: string) {
      return { id };
    },
    async listSlow() {
      return new Promise<never>(() => undefined);
    },
    async getFlaky() {
      flakyCalls += 1;
      if (flakyCalls < 3) throw new GatewayError('UNAVAILABLE');
      return { attempts: flakyCalls };
    },
    async getBroken(): Promise<never> {
      throw new Error('database password is hunter2 at 10.0.0.4');
    },
    async createThing(input: { ref: string }, _options: MutationOptions) {
      created.push(input.ref);
      return { ref: input.ref, serial: created.length };
    },
    async refuse(_ref: string, _options: MutationOptions): Promise<never> {
      throw new GatewayError('FORBIDDEN');
    },
  };
}

function setup(
  overrides: { actor?: GatewayActor | null; timeoutMs?: number; maxRetries?: number } = {},
) {
  const platform: Platform = createLocalPlatform({
    now: () => new Date('2026-11-21T08:00:00Z'),
    settings: { latencyMs: 0 },
  });
  const audited: Array<Omit<AuditEvent, 'auditId' | 'at'>> = [];
  const audit: AuditPort = {
    record: async (event) => {
      audited.push(event);
      return { ...event, auditId: 'AUD-DEMO-1', at: platform.clock.iso() };
    },
    list: async () => [],
  };
  const calls: GatewayCallRecord[] = [];
  platform.bus.subscribe(TOPICS.gatewayCall, (event) =>
    calls.push(event.payload as GatewayCallRecord),
  );
  const sleep = vi.fn(async () => undefined);
  const port = fakePort();
  const policy = createCallPolicy({
    platform,
    audit,
    getActor: () =>
      overrides.actor === undefined
        ? { role: 'citizen', ref: 'PERSON-DEMO-7X3Q' }
        : overrides.actor,
    timeoutMs: overrides.timeoutMs ?? 1000,
    maxRetries: overrides.maxRetries ?? 2,
    sleep,
  });
  return { platform, audited, calls, sleep, port, api: policy.wrap('demo', port) };
}

describe('gateway call policy', () => {
  it('passes reads through and publishes a call record without arguments or results', async () => {
    const { api, calls } = setup();
    await expect(api.getThing('CASE-DEMO-000041')).resolves.toEqual({ id: 'CASE-DEMO-000041' });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      service: 'demo',
      method: 'getThing',
      kind: 'read',
      outcome: 'ok',
      attempts: 1,
    });
    expect(JSON.stringify(calls[0])).not.toContain('CASE-DEMO-000041');
    expect(calls[0]?.correlationId).toMatch(/^CORR-/);
  });

  it('retries transient failures with back-off, then succeeds', async () => {
    const { api, calls, sleep } = setup();
    await expect(api.getFlaky()).resolves.toEqual({ attempts: 3 });
    expect(calls[0]?.attempts).toBe(3);
    expect(sleep).toHaveBeenCalledWith(200);
    expect(sleep).toHaveBeenCalledWith(400);
  });

  it('gives up after the retry budget and reports a safe UNAVAILABLE', async () => {
    const { api, platform, calls } = setup({ maxRetries: 1 });
    platform.settings.set({ network: 'error' });
    await expect(api.getThing('x')).rejects.toMatchObject({
      category: 'UNAVAILABLE',
      retryable: true,
    });
    expect(calls[0]).toMatchObject({ outcome: 'error', category: 'UNAVAILABLE', attempts: 2 });
  });

  it('fails fast when offline, without retrying', async () => {
    const { api, platform, calls, port } = setup();
    platform.settings.set({ network: 'offline' });
    await expect(
      api.createThing({ ref: 'CASE-DEMO-000041' }, { idempotencyKey: 'k1' }),
    ).rejects.toMatchObject({
      category: 'OFFLINE',
    });
    expect(calls[0]?.attempts).toBe(1);
    expect(port.created).toHaveLength(0);
  });

  it('times out a call that never answers', async () => {
    const { api } = setup({ timeoutMs: 15, maxRetries: 0 });
    await expect(api.listSlow()).rejects.toMatchObject({ category: 'TIMEOUT' });
  });

  it('never leaks internal error detail', async () => {
    const { api } = setup();
    const error = await api.getBroken().catch((caught: unknown) => caught as GatewayError);
    expect(error).toBeInstanceOf(GatewayError);
    expect(error.category).toBe('UNKNOWN');
    expect(error.safeMessage).not.toMatch(/hunter2|10\.0\.0\.4|database/);
    expect(error.message).not.toMatch(/hunter2/);
    expect(error.traceRef).toMatch(/^CORR-/);
  });

  it('refuses a mutation that carries no idempotency key', async () => {
    const { api, port } = setup();
    await expect(
      api.createThing({ ref: 'CASE-DEMO-000041' }, {} as MutationOptions),
    ).rejects.toMatchObject({ category: 'VALIDATION' });
    expect(port.created).toHaveLength(0);
  });

  it('applies a mutation once per idempotency key and replays the stored result', async () => {
    const { api, port, calls } = setup();
    const first = await api.createThing(
      { ref: 'CASE-DEMO-000041' },
      { idempotencyKey: 'submit-1' },
    );
    const again = await api.createThing(
      { ref: 'CASE-DEMO-000041' },
      { idempotencyKey: 'submit-1' },
    );
    const other = await api.createThing(
      { ref: 'CASE-DEMO-000041' },
      { idempotencyKey: 'submit-2' },
    );
    expect(again).toEqual(first);
    expect(other.serial).toBe(2);
    expect(port.created).toHaveLength(2);
    expect(calls.map((call) => call.replayed)).toEqual([false, true, false]);
  });

  it('audits mutations with opaque references only', async () => {
    const { api, audited } = setup();
    await api.createThing({ ref: 'CASE-DEMO-000041' }, { idempotencyKey: 'k' });
    expect(audited).toHaveLength(1);
    expect(audited[0]).toMatchObject({
      actor: { role: 'citizen', ref: 'PERSON-DEMO-7X3Q' },
      action: 'demo.createThing',
      resource: { type: 'demo', ref: 'CASE-DEMO-000041' },
      outcome: 'SUCCESS',
      channel: 'WEB',
    });
  });

  it('records a denied action as DENIED', async () => {
    const { api, audited } = setup();
    await expect(api.refuse('CASE-DEMO-000041', { idempotencyKey: 'k' })).rejects.toMatchObject({
      category: 'FORBIDDEN',
    });
    expect(audited[0]?.outcome).toBe('DENIED');
  });

  it('does not audit a citizen reading their own data, but does audit staff reads', async () => {
    const citizen = setup();
    await citizen.api.getThing('CASE-DEMO-000041');
    expect(citizen.audited).toHaveLength(0);

    const staff = setup({ actor: { role: 'staff', ref: 'STAFF-DEMO-1001' } });
    await staff.api.getThing('CASE-DEMO-000041');
    expect(staff.audited[0]).toMatchObject({
      actor: { role: 'staff', ref: 'STAFF-DEMO-1001' },
      action: 'demo.getThing',
      channel: 'STAFF_CONSOLE',
      resource: { ref: 'CASE-DEMO-000041' },
    });
  });
});

describe('correlation ids', () => {
  it('never contain a run of digits the audit trail would refuse', async () => {
    const platform = createLocalPlatform({ now: () => new Date('2026-11-21T08:00:00Z') });
    const audit = createAuditService(platform);
    // Sweep two years of timestamps, including ones whose base-36 form is all digits.
    const start = Date.UTC(2026, 10, 21);
    for (let step = 0; step < 4000; step += 1) {
      const id = nextCorrelationId(new Date(start + step * 15_800_000));
      expect(id).toMatch(/^CORR(-[0-9A-Z]{4}){3}$/);
      expect(id).not.toMatch(/\d{6}/);
    }
    const allDigits = nextCorrelationId(new Date(parseInt('MX001466', 36)));
    await expect(
      audit.record({
        actor: { role: 'citizen', ref: 'PERSON-DEMO-7X3Q' },
        action: 'demo.check',
        resource: { type: 'demo', ref: 'CASE-DEMO-000041' },
        purpose: 'service-request',
        outcome: 'SUCCESS',
        channel: 'WEB',
        correlationId: allDigits,
      }),
    ).resolves.toMatchObject({ correlationId: allDigits });
  });
});
