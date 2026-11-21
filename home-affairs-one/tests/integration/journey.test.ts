/**
 * End-to-end through the real gateway and every mock service, with no UI.
 * These are the brief's journeys and guardrails expressed as executable checks.
 */
import {
  DEMO,
  type ApplicationCase,
  type AnswerValue,
  type ServiceDefinition,
} from '@hao/api-contracts';
import { createGateway, type Gateway } from '@hao/api-gateway';
import { createLocalPlatform } from '@hao/local-platform';
import { GatewayError, maskReference } from '@hao/shared-types';
import { describe, expect, it } from 'vitest';

let counter = 0;
const key = (scope: string) => ({ idempotencyKey: `${scope}-${(counter += 1)}` });

function setup() {
  const platform = createLocalPlatform({
    now: () => new Date('2026-11-21T08:00:00Z'),
    settings: { latencyMs: 0 },
  });
  const gateway = createGateway(platform, { sleep: async () => undefined });
  gateway.setActor({ role: 'citizen', ref: DEMO.persons.thandi });
  return { platform, gateway };
}

/** Fills every required field of a service's form with harmless sample answers. */
async function completeDraft(gateway: Gateway, service: ServiceDefinition, person: string) {
  const profile = await gateway.identity.getProfileFields(person);
  const steps = service.form?.steps ?? [];
  const firstStep = steps[0]?.id ?? 'review';
  const draft = await gateway.workflow.saveDraft(
    { serviceCode: service.code, applicantToken: person, answers: {}, currentStepId: firstStep },
    key('draft'),
  );
  const answers: Record<string, AnswerValue> = {};
  for (const field of steps.flatMap((step) => step.fields)) {
    if (field.type === 'evidence') {
      await gateway.workflow.attachSampleEvidence(
        draft.draftId,
        field.id,
        field.label,
        key('evidence'),
      );
    } else if (field.profileKey) {
      answers[field.id] = profile.find((item) => item.key === field.profileKey)?.value ?? 'Sample';
    } else if (field.type === 'checkbox') {
      answers[field.id] = true;
    } else if (field.type === 'select' || field.type === 'radio') {
      answers[field.id] = field.options?.[0]?.value ?? 'sample';
    } else if (field.type === 'date') {
      answers[field.id] = '2020-01-01';
    } else {
      answers[field.id] = 'Sample answer';
    }
  }
  return gateway.workflow.saveDraft(
    {
      draftId: draft.draftId,
      serviceCode: service.code,
      applicantToken: person,
      answers,
      currentStepId: 'review',
    },
    key('draft'),
  );
}

async function payFor(
  gateway: Gateway,
  service: ServiceDefinition,
  draftId: string,
  person: string,
) {
  if (service.fee.kind !== 'SAMPLE') return null;
  const payment = await gateway.payments.createPayment(
    {
      personToken: person,
      draftId,
      caseId: null,
      description: `${service.title} — sample amount`,
      amountCents: service.fee.amountCents,
    },
    key('pay'),
  );
  const paid = await gateway.payments.completeSandboxPayment(
    payment.paymentRef,
    'APPROVE',
    key('pay'),
  );
  const draft = await gateway.workflow.getDraft(draftId);
  await gateway.workflow.saveDraft(
    {
      draftId,
      serviceCode: service.code,
      applicantToken: person,
      answers: draft.answers,
      currentStepId: 'submit',
      paymentRef: paid.paymentRef,
    },
    key('draft'),
  );
  return paid;
}

async function submitSmartId(gateway: Gateway) {
  const person = DEMO.persons.thandi;
  const service = await gateway.catalogue.getService(DEMO.services.smartIdReplacement);
  const draft = await completeDraft(gateway, service, person);
  await payFor(gateway, service, draft.draftId, person);
  return { person, service, draft };
}

describe('seed data', () => {
  it('agrees across every mock service, for every demo person', async () => {
    const { gateway } = setup();
    const people = await gateway.identity.listDemoPersonas();
    expect(people.map((person) => person.personToken).sort()).toEqual(
      Object.values(DEMO.persons).sort(),
    );

    for (const person of people) {
      const links = await gateway.identity.listFamilyLinks(person.personToken);
      for (const item of await gateway.workflow.listCases(person.personToken)) {
        await expect(gateway.catalogue.getService(item.serviceCode)).resolves.toBeTruthy();
        if (item.servicePointId) {
          await expect(
            gateway.appointments.getServicePoint(item.servicePointId),
          ).resolves.toBeTruthy();
        }
        if (item.appointmentId) {
          const appointment = await gateway.appointments.getAppointment(item.appointmentId);
          expect(appointment.personToken).toBe(person.personToken);
        }
        if (item.paymentRef) {
          await expect(gateway.payments.getPayment(item.paymentRef)).resolves.toBeTruthy();
        }
        if (item.onBehalfOfLinkId) {
          expect(links.map((link) => link.linkId)).toContain(item.onBehalfOfLinkId);
        }
      }
      for (const draft of await gateway.workflow.listDrafts(person.personToken)) {
        const service = await gateway.catalogue.getService(draft.serviceCode);
        const stepIds = service.form?.steps.map((step) => step.id) ?? [];
        expect([...stepIds, 'before', 'review', 'verify', 'payment', 'submit']).toContain(
          draft.currentStepId,
        );
      }
      for (const message of await gateway.notifications.listInbox(person.personToken)) {
        if (message.caseId) {
          const linked = await gateway.workflow.getCase(message.caseId);
          expect(linked.applicantToken).toBe(person.personToken);
        }
      }
    }
  });

  it('matches the worked example in the brief (Appendix B)', async () => {
    const { gateway } = setup();
    const example = await gateway.workflow.getCase(DEMO.cases.smartIdActionRequired);
    expect(example).toMatchObject({
      caseId: 'CASE-DEMO-000041',
      serviceCode: 'SMART_ID_REPLACEMENT',
      applicantToken: 'PERSON-DEMO-7X3Q',
      status: 'ACTION_REQUIRED',
      nextAction: {
        type: 'SELECT_SERVICE_POINT',
        description: 'Choose an approved service point for the next step',
        dueAt: null,
      },
      dataClassification: 'RESTRICTED',
      sourceOfTruth: 'DHA_WORKFLOW_ADAPTER_MOCK',
    });
  });
});

describe('an application, from draft to collection', () => {
  it('needs the person’s own declaration and the right assurance tier', async () => {
    const { gateway } = setup();
    const { draft } = await submitSmartId(gateway);

    await expect(
      gateway.workflow.submitApplication(
        {
          draftId: draft.draftId,
          declarationAccepted: false as unknown as true,
          sessionTier: 'A3',
        },
        key('submit'),
      ),
    ).rejects.toMatchObject({ category: 'VALIDATION' });

    await expect(
      gateway.workflow.submitApplication(
        { draftId: draft.draftId, declarationAccepted: true, sessionTier: 'A2' },
        key('submit'),
      ),
    ).rejects.toMatchObject({ category: 'FORBIDDEN' });
  });

  it('is never decided by automation, and reaches collection after an official decides', async () => {
    const { gateway } = setup();
    const { person, draft } = await submitSmartId(gateway);
    let current: ApplicationCase = await gateway.workflow.submitApplication(
      { draftId: draft.draftId, declarationAccepted: true, sessionTier: 'A3' },
      key('submit'),
    );
    expect(current.status).toBe('SUBMITTED');
    expect(current.decision).toBeNull();

    let automationRefused = false;
    for (let step = 0; step < 30 && current.status !== 'CLOSED'; step += 1) {
      if (current.nextAction?.type === 'SELECT_SERVICE_POINT') {
        current = await gateway.workflow.selectServicePoint(
          current.caseId,
          DEMO.servicePoints.officeCentral,
          key('point'),
        );
        continue;
      }
      if (current.nextAction?.type === 'BOOK_APPOINTMENT') {
        const slot = (await gateway.appointments.listSlots(DEMO.servicePoints.officeCentral)).find(
          (candidate) => candidate.available,
        );
        expect(slot).toBeDefined();
        const appointment = await gateway.appointments.book(
          {
            personToken: person,
            servicePointId: DEMO.servicePoints.officeCentral,
            slotId: slot?.slotId ?? '',
            purpose: 'In-person step (sample)',
            caseId: current.caseId,
          },
          key('book'),
        );
        current = await gateway.workflow.linkAppointment(
          current.caseId,
          appointment.appointmentId,
          key('link'),
        );
        expect(current.status).toBe('SCHEDULED');
        continue;
      }
      try {
        current = await gateway.workflow.simulateNextEvent(current.caseId, key('next'));
      } catch (error) {
        expect(error).toBeInstanceOf(GatewayError);
        expect((error as GatewayError).category).toBe('CONFLICT');
        expect(current.status).toBe('PROCESSING');
        automationRefused = true;
        gateway.setActor({ role: 'staff', ref: DEMO.staff.caseOfficer });
        current = await gateway.workflow.recordStaffAction(
          current.caseId,
          {
            type: 'RECORD_DECISION',
            outcome: 'APPROVED',
            reasonCategory: 'Requirements met (sample)',
            reviewedByHuman: true,
          },
          DEMO.staff.caseOfficer,
          key('decide'),
        );
        gateway.setActor({ role: 'citizen', ref: person });
      }
    }

    expect(automationRefused).toBe(true);
    expect(current.status).toBe('CLOSED');
    expect(current.statusDetail).toBe('Completed');
    expect(current.decision).toMatchObject({
      outcome: 'APPROVED',
      decidedByRef: DEMO.staff.caseOfficer,
    });

    // Every workflow event reached the secure inbox…
    await gateway.whenIdle();
    const events = await gateway.workflow.listCaseEvents(current.caseId);
    const inbox = (await gateway.notifications.listInbox(person)).filter(
      (message) => message.caseId === current.caseId,
    );
    expect(inbox).toHaveLength(events.length);

    // …and outside channels only ever carried the masked reference, never the case id.
    const deliveries = (await gateway.notifications.listMessageEvents(person)).filter(
      (event) =>
        event.channel !== 'SECURE_INBOX' && event.maskedReference === maskReference(current.caseId),
    );
    expect(deliveries.length).toBeGreaterThan(0);
    for (const delivery of deliveries) {
      expect(JSON.stringify(delivery)).not.toContain(current.caseId);
    }
    for (const event of await gateway.whatsapp.listWebhookEvents(person)) {
      expect(event.text).not.toContain(current.caseId);
      expect(event.text).not.toContain(person);
    }

    // The audit trail names who did what, with opaque references only.
    const audit = await gateway.audit.list({ resourceRef: current.caseId });
    expect(
      audit.some(
        (entry) => entry.action === 'workflow.recordStaffAction' && entry.actor.role === 'staff',
      ),
    ).toBe(true);
    for (const entry of audit) {
      expect(JSON.stringify(entry)).not.toMatch(/@|Thandi|Nomsa/);
    }
  });

  it('does not create a second application when a submit is retried', async () => {
    const { gateway } = setup();
    const { person, draft } = await submitSmartId(gateway);
    const before = (await gateway.workflow.listCases(person)).length;
    const retryKey = key('submit');
    const first = await gateway.workflow.submitApplication(
      { draftId: draft.draftId, declarationAccepted: true, sessionTier: 'A3' },
      retryKey,
    );
    const again = await gateway.workflow.submitApplication(
      { draftId: draft.draftId, declarationAccepted: true, sessionTier: 'A3' },
      retryKey,
    );
    expect(again.caseId).toBe(first.caseId);
    expect(await gateway.workflow.listCases(person)).toHaveLength(before + 1);
  });
});

describe('channels and consent', () => {
  it('holds back a channel that is switched off, and says why', async () => {
    const { gateway } = setup();
    const person = DEMO.persons.thandi;
    await gateway.notifications.setPreference(person, 'WHATSAPP', false, key('pref'));
    await gateway.notifications.setPreference(person, 'SMS', false, key('pref'));
    expect((await gateway.whatsapp.getOptIn(person)).optedIn).toBe(false);

    await gateway.workflow.selectServicePoint(
      DEMO.cases.smartIdActionRequired,
      DEMO.servicePoints.officeCentral,
      key('point'),
    );
    await gateway.whenIdle();

    // The log is newest first: keep the most recent delivery record for each channel.
    const byChannel = new Map<
      string,
      Awaited<ReturnType<typeof gateway.notifications.listMessageEvents>>[number]
    >();
    for (const event of await gateway.notifications.listMessageEvents(person)) {
      if (!byChannel.has(event.channel)) byChannel.set(event.channel, event);
    }
    expect(byChannel.get('WHATSAPP')).toMatchObject({
      deliveryStatus: 'SUPPRESSED',
      consentState: 'NOT_CONSENTED',
    });
    expect(byChannel.get('SMS')).toMatchObject({ deliveryStatus: 'SUPPRESSED' });
    expect(byChannel.get('SMS')?.note).toBeTruthy();
    expect(byChannel.get('SECURE_INBOX')?.deliveryStatus).toBe('DELIVERED');
  });

  it('never lets the secure inbox be switched off', async () => {
    const { gateway } = setup();
    await expect(
      gateway.notifications.setPreference(DEMO.persons.thandi, 'SECURE_INBOX', false, key('pref')),
    ).rejects.toMatchObject({ category: 'VALIDATION' });
  });

  it('answers an accredited partner with yes or no only, and only with live consent', async () => {
    const { gateway } = setup();
    gateway.setActor({ role: 'partner', ref: DEMO.partners.bank });
    const ask = (consentRef: string | null, partnerRef: string = DEMO.partners.bank) =>
      gateway.identity.requestVerification(
        {
          partnerRef,
          subjectToken: DEMO.persons.thandi,
          attribute: 'IDENTITY_CONFIRMED',
          purpose: 'Opening an account (sample)',
          consentRef,
        },
        key('verify'),
      );

    const confirmed = await ask(DEMO.consents.thandiBank);
    expect(confirmed.result).toBe('CONFIRMED');
    expect(Object.keys(confirmed).sort()).toEqual(
      [
        'at',
        'attribute',
        'consentRef',
        'partnerRef',
        'purpose',
        'requestId',
        'result',
        'subjectToken',
      ].sort(),
    );

    expect((await ask(null)).result).toBe('REFUSED_NO_CONSENT');
    expect((await ask(DEMO.consents.thandiBank, DEMO.partners.college)).result).toBe(
      'REFUSED_OUT_OF_SCOPE',
    );

    gateway.setActor({ role: 'citizen', ref: DEMO.persons.thandi });
    await gateway.identity.revokeConsent(DEMO.consents.thandiBank, key('revoke'));
    gateway.setActor({ role: 'partner', ref: DEMO.partners.bank });
    expect((await ask(DEMO.consents.thandiBank)).result).toBe('REFUSED_NO_CONSENT');
  });
});

describe('resilience', () => {
  it('fails fast and safely when offline, and changes nothing', async () => {
    const { gateway, platform } = setup();
    const person = DEMO.persons.thandi;
    const before = await gateway.workflow.listCaseEvents(DEMO.cases.smartIdActionRequired);
    platform.settings.set({ network: 'offline' });

    let caught: unknown;
    try {
      await gateway.workflow.selectServicePoint(
        DEMO.cases.smartIdActionRequired,
        DEMO.servicePoints.officeCentral,
        key('point'),
      );
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(GatewayError);
    const error = caught as GatewayError;
    expect(error.category).toBe('OFFLINE');
    expect(error.safeMessage).toMatch(/offline/i);

    platform.settings.set({ network: 'normal' });
    expect(await gateway.workflow.listCaseEvents(DEMO.cases.smartIdActionRequired)).toHaveLength(
      before.length,
    );
    expect((await gateway.workflow.listCases(person)).length).toBeGreaterThan(0);
  });
});
