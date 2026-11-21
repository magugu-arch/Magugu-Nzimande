/**
 * The sample objects in the brief (Appendix B) must stay valid against the
 * prototype contracts, so the documents and the code cannot drift apart.
 */
import {
  ApplicationCaseSchema,
  NextActionSchema,
  SafeNotificationPayloadSchema,
} from '@hao/api-contracts';
import { describe, expect, it } from 'vitest';

describe('Appendix B — safe notification payload', () => {
  const example = {
    eventId: 'EVT-DEMO-1392',
    channel: 'WHATSAPP_TEMPLATE',
    recipientToken: 'CONTACT-DEMO-8821',
    templateKey: 'application_status_changed_v1',
    maskedReference: '••••2481',
    message: 'There is an update to your Home Affairs application. Sign in to view details.',
    secureDeepLink: 'https://example.gov.za/app/case/short-lived-token',
    consentRef: 'CONSENT-DEMO-88',
    expiresAt: '2026-11-21T11:00:00+02:00',
  };

  it('parses as written in the brief', () => {
    expect(SafeNotificationPayloadSchema.parse(example)).toEqual(example);
  });

  it('rejects an unmasked reference, a long message or a non-URL link', () => {
    expect(
      SafeNotificationPayloadSchema.safeParse({ ...example, maskedReference: 'CASE-DEMO-002481' })
        .success,
    ).toBe(false);
    expect(
      SafeNotificationPayloadSchema.safeParse({ ...example, message: 'x'.repeat(161) }).success,
    ).toBe(false);
    expect(
      SafeNotificationPayloadSchema.safeParse({ ...example, secureDeepLink: 'not a link' }).success,
    ).toBe(false);
  });
});

describe('Appendix B — application object', () => {
  it('uses identifiers, status and next action the contracts accept', () => {
    const shape = ApplicationCaseSchema.pick({
      caseId: true,
      serviceCode: true,
      applicantToken: true,
      status: true,
      statusUpdatedAt: true,
      dataClassification: true,
      sourceOfTruth: true,
    });
    expect(
      shape.safeParse({
        caseId: 'CASE-DEMO-000041',
        serviceCode: 'SMART_ID_REPLACEMENT',
        applicantToken: 'PERSON-DEMO-7X3Q',
        status: 'ACTION_REQUIRED',
        statusUpdatedAt: '2026-11-21T10:40:00+02:00',
        dataClassification: 'RESTRICTED',
        sourceOfTruth: 'DHA_WORKFLOW_ADAPTER_MOCK',
      }).success,
    ).toBe(true);
    expect(
      NextActionSchema.safeParse({
        type: 'SELECT_SERVICE_POINT',
        description: 'Choose an approved service point for the next step',
        dueAt: null,
      }).success,
    ).toBe(true);
  });

  it('refuses a case reference that looks like anything other than a demo token', () => {
    expect(ApplicationCaseSchema.shape.caseId.safeParse('8001015009087').success).toBe(false);
    expect(ApplicationCaseSchema.shape.caseId.safeParse('DHA-2481').success).toBe(false);
  });
});
