import { AuditEventSchema, DEMO } from '@hao/api-contracts';
import { createLocalPlatform, MINUTE } from '@hao/local-platform';
import { describe, expect, it } from 'vitest';
import { createAuditService, findPiiRisk, type AuditEventInput } from './index';

const START = new Date('2026-11-21T08:00:00Z');

function setup() {
  let current = START;
  const platform = createLocalPlatform({ now: () => current });
  return {
    platform,
    audit: createAuditService(platform),
    advance: (ms: number) => {
      current = new Date(current.getTime() + ms);
    },
  };
}

/** Built at run time so that nothing shaped like a real number is written in this file. */
const ID_LIKE = '7'.repeat(13);
const PHONE_LIKE = '5'.repeat(10);

const safeEvent: AuditEventInput = {
  actor: { role: 'citizen', ref: DEMO.persons.thandi },
  action: 'CASE_VIEWED',
  resource: { type: 'case', ref: DEMO.cases.passportInProduction },
  purpose: 'Viewed own application',
  outcome: 'SUCCESS',
  channel: 'WEB',
  correlationId: 'CORR-DEMO-2001',
};

describe('findPiiRisk', () => {
  it('accepts an event that carries opaque references only', () => {
    expect(findPiiRisk(safeEvent)).toBeNull();
  });

  it('accepts every opaque reference shape the prototype uses', () => {
    const refs = [
      ...Object.values(DEMO.persons),
      ...Object.values(DEMO.staff),
      ...Object.values(DEMO.partners),
      ...Object.values(DEMO.cases),
      ...Object.values(DEMO.drafts),
      ...Object.values(DEMO.servicePoints),
      ...Object.values(DEMO.appointments),
      ...Object.values(DEMO.consents),
      'PAY-DEMO-1001',
      'HELP-DEMO-1001',
      'VERIFY-DEMO-1001',
      'LINK-DEMO-1001',
      '••••2481',
    ];
    for (const ref of refs) {
      expect(findPiiRisk({ ...safeEvent, resource: { type: 'thing', ref } })).toBeNull();
      expect(findPiiRisk({ ...safeEvent, actor: { role: 'system', ref } })).toBeNull();
    }
  });

  it('flags an @ sign in any text field', () => {
    const cases: AuditEventInput[] = [
      { ...safeEvent, actor: { role: 'citizen', ref: 'thandi@example.org' } },
      { ...safeEvent, action: 'EMAILED thandi@example.org' },
      { ...safeEvent, resource: { type: 'inbox@example.org', ref: 'MSG-DEMO-1001' } },
      { ...safeEvent, resource: { type: 'message', ref: 'user@example.org' } },
      { ...safeEvent, purpose: 'Contacted t@example.org about a case' },
      { ...safeEvent, correlationId: 'corr@1' },
    ];
    for (const event of cases) expect(findPiiRisk(event)).toMatch(/@ sign/);
  });

  it('flags a run of six or more digits', () => {
    const cases: AuditEventInput[] = [
      { ...safeEvent, purpose: `Called ${PHONE_LIKE} about the case` },
      { ...safeEvent, purpose: 'Reference 123456' },
      { ...safeEvent, resource: { type: 'person', ref: ID_LIKE } },
      { ...safeEvent, actor: { role: 'citizen', ref: `ID-${ID_LIKE}` } },
      { ...safeEvent, correlationId: `corr-${ID_LIKE}` },
      // A long number does not become safe by wearing a demo-style prefix.
      { ...safeEvent, resource: { type: 'person', ref: `PERSON-DEMO-${ID_LIKE}` } },
    ];
    for (const event of cases) expect(findPiiRisk(event)).toMatch(/long run of digits/);
    expect(findPiiRisk({ ...safeEvent, purpose: 'Step 12345 of the checklist' })).toBeNull();
  });

  it('accepts the gateway’s correlation ids, even when the time part has many digits', () => {
    // Real examples of `CORR-<time in base 36>-<counter>`; the second has six digits in a row.
    for (const correlationId of [
      'CORR-MWQ4B280-0001',
      'CORR-MW123456-0042',
      'CORR-M1234567-9999',
    ]) {
      expect(findPiiRisk({ ...safeEvent, correlationId })).toBeNull();
    }
    // The excuse is for that exact shape, in that field only.
    const refused: AuditEventInput[] = [
      { ...safeEvent, correlationId: `CORR-${ID_LIKE}-0001` },
      { ...safeEvent, correlationId: `CORR-${PHONE_LIKE}-0001` },
      { ...safeEvent, correlationId: 'CORR-MW123456' },
      { ...safeEvent, correlationId: 'CORR-MW123456-0042 extra' },
      { ...safeEvent, resource: { type: 'case', ref: 'CORR-MW123456-0042' } },
      { ...safeEvent, purpose: 'CORR-MW123456-0042' },
    ];
    for (const event of refused) expect(findPiiRisk(event)).toMatch(/long run of digits/);
  });

  it('flags whitespace in actor and resource references, but allows it in free text', () => {
    expect(findPiiRisk({ ...safeEvent, actor: { role: 'citizen', ref: 'Thandi M.' } })).toMatch(
      /actor\.ref contains a space/,
    );
    expect(
      findPiiRisk({ ...safeEvent, resource: { type: 'case', ref: 'the passport case' } }),
    ).toMatch(/resource\.ref contains a space/);
    expect(
      findPiiRisk({ ...safeEvent, actor: { role: 'staff', ref: 'STAFF\tONE' } }),
    ).not.toBeNull();
    expect(findPiiRisk({ ...safeEvent, purpose: 'Evidence check on an assigned case' })).toBeNull();
  });

  it('never repeats the offending value in its explanation', () => {
    const risk = findPiiRisk({ ...safeEvent, purpose: `Called ${PHONE_LIKE}` });
    expect(risk).not.toBeNull();
    expect(risk).not.toContain(PHONE_LIKE);
  });
});

describe('audit service', () => {
  it('seeds a short, plausible history using opaque references only', async () => {
    const { audit } = setup();
    const events = await audit.list();
    expect(events.length).toBeGreaterThanOrEqual(6);
    expect(events.length).toBeLessThanOrEqual(8);
    for (const event of events) {
      AuditEventSchema.parse(event);
      const { auditId: _auditId, at: _at, ...input } = event;
      expect(findPiiRisk(input)).toBeNull();
    }
    expect(new Set(events.map((event) => event.auditId)).size).toBe(events.length);
    const actions = events.map((event) => event.action);
    for (const action of ['SIGN_IN', 'CASE_VIEWED', 'CONSENT_RECORDED', 'CASE_OPENED']) {
      expect(actions).toContain(action);
    }
    expect(events.some((event) => event.outcome === 'DENIED')).toBe(true);
    expect(events.some((event) => event.actor.role === 'staff')).toBe(true);
  });

  it('lists newest first', async () => {
    const { audit, advance } = setup();
    const seeded = await audit.list();
    const times = seeded.map((event) => Date.parse(event.at));
    expect(times).toEqual([...times].sort((a, b) => b - a));

    advance(MINUTE);
    const first = await audit.record(safeEvent);
    advance(MINUTE);
    const second = await audit.record({ ...safeEvent, action: 'CASE_TIMELINE_VIEWED' });
    const listed = await audit.list();
    expect(listed.slice(0, 2)).toEqual([second, first]);
    expect(listed).toHaveLength(seeded.length + 2);
  });

  it('assigns the id and time itself when recording', async () => {
    const { audit } = setup();
    const seeded = await audit.list();
    const recorded = await audit.record(safeEvent);
    AuditEventSchema.parse(recorded);
    expect(recorded).toEqual({
      ...safeEvent,
      auditId: `AUD-DEMO-${1001 + seeded.length}`,
      at: '2026-11-21T10:00:00+02:00',
    });
  });

  it('stores only the contract fields, even if a caller passes more', async () => {
    const { audit } = setup();
    const sneaky = { ...safeEvent, displayName: 'Thandi M.', auditId: 'AUD-DEMO-1', at: 'never' };
    const recorded = await audit.record(sneaky);
    AuditEventSchema.strict().parse(recorded);
    expect(recorded).not.toHaveProperty('displayName');
    expect(recorded.auditId).not.toBe('AUD-DEMO-1');
  });

  it('refuses anything that looks like personal information, and stores nothing', async () => {
    const { audit } = setup();
    const before = await audit.list();
    const risky: AuditEventInput[] = [
      { ...safeEvent, actor: { role: 'citizen', ref: 'thandi@example.org' } },
      { ...safeEvent, purpose: `Phoned ${PHONE_LIKE}` },
      { ...safeEvent, resource: { type: 'person', ref: 'Thandi M.' } },
    ];
    for (const event of risky) {
      await expect(audit.record(event)).rejects.toMatchObject({ category: 'VALIDATION' });
    }
    expect(await audit.list()).toEqual(before);
  });

  it('filters by resource, by actor and by both', async () => {
    const { audit } = setup();
    await audit.record(safeEvent);
    await audit.record({ ...safeEvent, actor: { role: 'staff', ref: DEMO.staff.supervisor } });

    const byResource = await audit.list({ resourceRef: DEMO.cases.passportInProduction });
    expect(byResource.length).toBeGreaterThanOrEqual(2);
    expect(
      byResource.every((event) => event.resource.ref === DEMO.cases.passportInProduction),
    ).toBe(true);

    const byActor = await audit.list({ actorRef: DEMO.staff.supervisor });
    expect(byActor).toHaveLength(1);

    const both = await audit.list({
      resourceRef: DEMO.cases.passportInProduction,
      actorRef: DEMO.persons.thandi,
    });
    expect(both).toHaveLength(1);
    expect(both[0]?.action).toBe('CASE_VIEWED');

    expect(await audit.list({ resourceRef: 'CASE-DEMO-999999' })).toEqual([]);
  });

  it('limits the list, defaulting to the newest 200', async () => {
    const { audit } = setup();
    const seeded = await audit.list();
    expect(await audit.list({ limit: 3 })).toEqual(seeded.slice(0, 3));
    expect(await audit.list({ limit: 0 })).toEqual([]);

    for (let index = 0; index < 205; index += 1) {
      await audit.record({ ...safeEvent, correlationId: `CORR-DEMO-${3000 + index}` });
    }
    const listed = await audit.list();
    expect(listed).toHaveLength(200);
    expect(listed[0]?.correlationId).toBe('CORR-DEMO-3204');
  });

  it('is append-only: the port offers no way to change or remove an event', async () => {
    const { audit, platform } = setup();
    expect(Object.keys(audit).sort()).toEqual(['list', 'record']);
    const recorded = await audit.record(safeEvent);
    const reopened = createAuditService(platform);
    expect((await reopened.list())[0]).toEqual(recorded);
  });
});
