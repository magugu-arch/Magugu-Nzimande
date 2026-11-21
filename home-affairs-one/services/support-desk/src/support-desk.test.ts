import {
  DEMO,
  SupportRequestSchema,
  type CreateSupportRequestInput,
  type SupportRequest,
} from '@hao/api-contracts';
import { createCollection, createLocalPlatform } from '@hao/local-platform';
import { describe, expect, it } from 'vitest';
import { buildSharedContext, createSupportService, DEMO_SEED_SUPPORT_REQUEST_ID } from './index';

const START = new Date('2026-11-21T08:00:00Z');
const key = (name: string) => ({ idempotencyKey: `test-${name}` });

function setup() {
  const platform = createLocalPlatform({ now: () => START });
  return { platform, support: createSupportService(platform) };
}

const SECRET = 'my neighbour said the office lost my papers';

const callback: CreateSupportRequestInput = {
  kind: 'CALLBACK',
  personToken: DEMO.persons.sipho,
  caseId: DEMO.cases.birthInValidation,
  topic: 'A question about my application',
  detail: `Please call me — ${SECRET}.`,
  preferredTime: 'After 14:00',
  contactChannel: 'PHONE',
  shareContext: true,
};

describe('support desk', () => {
  it('seeds one call-back request in progress for Thandi', async () => {
    const { support } = setup();
    const requests = await support.listRequests(DEMO.persons.thandi);
    for (const request of requests) SupportRequestSchema.parse(request);
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      requestId: DEMO_SEED_SUPPORT_REQUEST_ID,
      kind: 'CALLBACK',
      personToken: DEMO.persons.thandi,
      caseId: DEMO.cases.smartIdActionRequired,
      status: 'IN_PROGRESS',
      createdAt: '2026-11-20T10:00:00+02:00',
      sharedContext: {
        consented: true,
        caseToken: '••••0041',
        summary: 'Person asked for help with application ••••0041.',
      },
    });
  });

  it('creates a received request and shares only a masked reference when the person agrees', async () => {
    const { support } = setup();
    const created = await support.createRequest(callback, key('create'));
    SupportRequestSchema.parse(created);
    expect(created).toMatchObject({
      // The seeded request already uses 1001.
      requestId: 'HELP-DEMO-1002',
      kind: 'CALLBACK',
      personToken: DEMO.persons.sipho,
      caseId: DEMO.cases.birthInValidation,
      topic: 'A question about my application',
      preferredTime: 'After 14:00',
      contactChannel: 'PHONE',
      status: 'RECEIVED',
      createdAt: '2026-11-21T10:00:00+02:00',
      sharedContext: {
        consented: true,
        caseToken: '••••0063',
        summary: 'Person asked for help with application ••••0063.',
      },
    });
  });

  it('never copies the person’s own words, or the full reference, into the shared summary', async () => {
    const { support } = setup();
    const created = await support.createRequest(callback, key('create'));
    const shared = JSON.stringify(created.sharedContext);
    expect(shared).not.toContain(SECRET);
    expect(shared).not.toContain('neighbour');
    expect(shared).not.toContain(DEMO.cases.birthInValidation);
    expect(shared).not.toContain(callback.topic);
    // The detail itself is still kept on the request for the person's own record.
    expect(created.detail).toContain(SECRET);
  });

  it('shares nothing without consent, or when there is no application to refer to', async () => {
    const { support } = setup();
    const empty = { consented: false, caseToken: null, summary: null };

    const declined = await support.createRequest({ ...callback, shareContext: false }, key('a'));
    expect(declined.sharedContext).toEqual(empty);
    expect(declined.caseId).toBe(DEMO.cases.birthInValidation);

    const noCase = await support.createRequest({ ...callback, caseId: null }, key('b'));
    expect(noCase.sharedContext).toEqual(empty);

    expect(buildSharedContext(false, DEMO.cases.birthInValidation)).toEqual(empty);
    expect(buildSharedContext(true, null)).toEqual(empty);
  });

  it('accepts anonymous feedback', async () => {
    const { support } = setup();
    const feedback = await support.createRequest(
      {
        kind: 'FEEDBACK',
        personToken: null,
        caseId: null,
        topic: 'The service point finder',
        detail: '',
        preferredTime: '  ',
        contactChannel: 'SECURE_INBOX',
        shareContext: true,
      },
      key('feedback'),
    );
    SupportRequestSchema.parse(feedback);
    expect(feedback).toMatchObject({
      personToken: null,
      preferredTime: null,
      detail: '',
      sharedContext: { consented: false, caseToken: null, summary: null },
    });
  });

  it('validates the topic and the length of the detail', async () => {
    const { support } = setup();
    for (const topic of ['', 'ab', '  a  ']) {
      await expect(support.createRequest({ ...callback, topic }, key('t'))).rejects.toMatchObject({
        category: 'VALIDATION',
      });
    }
    await expect(
      support.createRequest({ ...callback, detail: 'x'.repeat(1001) }, key('long')),
    ).rejects.toMatchObject({ category: 'VALIDATION' });

    const atLimit = await support.createRequest(
      { ...callback, topic: 'abc', detail: 'x'.repeat(1000) },
      key('limit'),
    );
    SupportRequestSchema.parse(atLimit);
    expect(await support.listRequests(DEMO.persons.sipho)).toEqual([atLimit]);
  });

  it('lists a person’s requests newest first', async () => {
    const { support } = setup();
    const first = await support.createRequest(
      { ...callback, personToken: DEMO.persons.thandi, kind: 'COMPLAINT' },
      key('1'),
    );
    const second = await support.createRequest(
      { ...callback, personToken: DEMO.persons.thandi, kind: 'FEEDBACK' },
      key('2'),
    );
    const listed = await support.listRequests(DEMO.persons.thandi);
    expect(listed.map((request) => request.requestId)).toEqual([
      second.requestId,
      first.requestId,
      DEMO_SEED_SUPPORT_REQUEST_ID,
    ]);
    expect(await support.listRequests(DEMO.persons.aisha)).toEqual([]);
  });

  it('shows staff every request that is not resolved', async () => {
    const { support, platform } = setup();
    const created = await support.createRequest(callback, key('create'));
    const open = await support.listOpenRequests();
    for (const request of open) SupportRequestSchema.parse(request);
    expect(open.map((request) => request.requestId)).toEqual([
      created.requestId,
      DEMO_SEED_SUPPORT_REQUEST_ID,
    ]);

    // Resolve the seeded request the way a back-office system would.
    const stored = createCollection<SupportRequest>(
      platform,
      'support.requests',
      (request) => request.requestId,
    );
    const seeded = stored.get(DEMO_SEED_SUPPORT_REQUEST_ID);
    if (!seeded) throw new Error('expected the seeded request');
    stored.put({ ...seeded, status: 'RESOLVED' });

    expect((await support.listOpenRequests()).map((request) => request.requestId)).toEqual([
      created.requestId,
    ]);
    // The person still sees their resolved request.
    expect(await support.listRequests(DEMO.persons.thandi)).toHaveLength(1);
  });
});
