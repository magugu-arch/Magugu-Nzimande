import type { ApplicationCase, CaseEvent } from '@hao/api-contracts';
import { describe, expect, it } from 'vitest';
import { summariseCase } from './summarise-case';

const base: ApplicationCase = {
  caseId: 'CASE-DEMO-000901',
  serviceCode: 'BIRTH_REGISTRATION',
  serviceTitle: 'Sample service',
  applicantToken: 'PERSON-DEMO-4K9P',
  onBehalfOfLinkId: null,
  status: 'IN_VALIDATION',
  statusDetail: 'Identity and evidence checks',
  statusUpdatedAt: '2026-11-20T09:00:00.000Z',
  submittedAt: '2026-11-19T09:00:00.000Z',
  nextAction: null,
  milestones: [],
  assignedQueue: 'Civic registration',
  servicePointId: null,
  appointmentId: null,
  paymentRef: null,
  decision: null,
  dataClassification: 'RESTRICTED',
  sourceOfTruth: 'DHA_WORKFLOW_ADAPTER_MOCK',
};

const event = (
  n: number,
  type: CaseEvent['type'],
  actor: CaseEvent['actor'],
  title: string,
): CaseEvent => ({
  eventId: `EVT-DEMO-${n}`,
  caseId: base.caseId,
  type,
  at: `2026-11-${19 + n}T09:00:00.000Z`,
  status: 'IN_VALIDATION',
  title,
  detail: null,
  actor,
  correlationId: `CORR-DEMO-${n}`,
});

const events = [
  event(0, 'SUBMITTED', 'APPLICANT', 'Application received'),
  event(1, 'VALIDATION_STARTED', 'STAFF', 'Checks started'),
];

/** Words that would turn a summary into a recommendation. */
const JUDGEMENT = /\b(should|recommend|likely|eligible|approve it|decline it|must be)\b/i;

describe('summariseCase', () => {
  it('gives two to four sentences built only from the record', () => {
    const summary = summariseCase(base, events);
    expect(summary.length).toBeGreaterThanOrEqual(2);
    expect(summary.length).toBeLessThanOrEqual(4);
    expect(summary[0]).toContain('2 recorded events');
    expect(summary[1]).toContain('“Checks started”');
    expect(summary[1]).toContain('an official');
    expect(summary.at(-1)).toBe(
      'No step by the applicant is outstanding, and no decision has been recorded.',
    );
  });

  it('is deterministic and does not depend on the order events arrive in', () => {
    expect(summariseCase(base, [...events].reverse())).toEqual(summariseCase(base, events));
  });

  it('says what the application is waiting for without repeating free text', () => {
    const waiting: ApplicationCase = {
      ...base,
      status: 'ACTION_REQUIRED',
      statusDetail: 'We need something from you',
      nextAction: {
        type: 'PROVIDE_INFORMATION',
        description: 'FREE TEXT FROM AN OFFICIAL',
        dueAt: null,
      },
    };
    const summary = summariseCase(waiting, [
      ...events,
      event(2, 'INFORMATION_REQUESTED', 'STAFF', 'We need more information from you'),
    ]);
    expect(summary.join(' ')).not.toContain('FREE TEXT');
    expect(summary).toContain(
      'The applicant has been asked for something once and has not replied yet.',
    );
    expect(summary.at(-1)).toBe(
      'It is waiting for the applicant to send the information that was requested.',
    );
  });

  it('reports a recorded decision as a fact and never recommends one', () => {
    const decided: ApplicationCase = {
      ...base,
      status: 'DECISION',
      statusDetail: 'Approved',
      decision: {
        outcome: 'APPROVED',
        reasonCategory: 'Requirements met (sample)',
        decidedByRef: 'STAFF-DEMO-1001',
        decidedAt: '2026-11-21T09:00:00.000Z',
        reviewRoute: 'Sample wording.',
      },
    };
    expect(summariseCase(decided, events).at(-1)).toMatch(
      /^An official \(STAFF-DEMO-1001\) recorded a decision on .*: approved\.$/,
    );
    for (const item of [base, decided]) {
      for (const sentence of summariseCase(item, events)) expect(sentence).not.toMatch(JUDGEMENT);
    }
  });
});
