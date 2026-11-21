import {
  type ApplicationCase,
  ApplicationCaseSchema,
  ApplicationDraftSchema,
  type CaseEvent,
  CaseEventSchema,
  DEMO,
  type Milestone,
  type ServiceDefinition,
  ServiceDefinitionSchema,
  type StaffAction,
  type SubmitApplicationInput,
} from '@hao/api-contracts';
import { createLocalPlatform, TOPICS } from '@hao/local-platform';
import { type AssuranceTier, GatewayError } from '@hao/shared-types';
import { describe, expect, it } from 'vitest';
import { ALL_DONE, blankMilestones, createWorkflowService, milestonesAfter } from './index';

const NOW = new Date('2026-11-21T08:00:00Z');
const NOW_ISO = '2026-11-21T10:00:00+02:00';
const DAY = 24 * 60 * 60 * 1000;
const KEY = { idempotencyKey: 'test-key' };
const OFFICER = DEMO.staff.caseOfficer;
const { thandi, sipho, lerato, aisha } = DEMO.persons;
const POINT = DEMO.servicePoints.officeCentral;
const APPOINTMENT = 'APPT-DEMO-2001';

/* ------------------------------------------------------------------ */
/* A stub catalogue with sample services                               */
/* ------------------------------------------------------------------ */

const IN_PERSON: ServiceDefinition = ServiceDefinitionSchema.parse({
  code: 'TEST_IN_PERSON',
  slug: 'test-in-person',
  domain: 'IDENTITY',
  title: 'Replace a sample card',
  summary: 'A sample service with an in-person step.',
  availability: 'APPLY_ONLINE',
  release: 'MVP',
  requiredTier: 'A3',
  audience: ['citizen'],
  journey: [{ title: 'Apply', detail: 'Sample step.' }],
  requirements: [{ id: 'req-1', label: 'Sample requirement', detail: 'Placeholder only.' }],
  fee: { kind: 'SAMPLE', amountCents: 1000, currency: 'ZAR', note: 'Sample amount only.' },
  channels: ['ONLINE', 'SERVICE_OFFICE'],
  form: {
    steps: [
      {
        id: 'request',
        title: 'Your request',
        intro: 'Sample step.',
        fields: [
          { id: 'reason', label: 'Reason for your request', type: 'text', required: true },
          { id: 'proof', label: 'Supporting document', type: 'evidence', required: true },
          { id: 'notes', label: 'Anything else', type: 'textarea', required: false },
        ],
      },
    ],
  },
  needsServicePoint: true,
  cautions: [],
  assetId: 'A14',
  contentVersion: DEMO.contentVersion,
  effectiveDate: DEMO.contentEffectiveDate,
  sample: true,
});

const DIRECT: ServiceDefinition = ServiceDefinitionSchema.parse({
  ...IN_PERSON,
  code: 'TEST_DIRECT',
  slug: 'test-direct',
  domain: 'BIRTH_FAMILY',
  title: 'Request a sample certificate',
  summary: 'A sample service with no in-person step.',
  requiredTier: 'A2',
  fee: { kind: 'TO_BE_CONFIRMED', note: 'No sample amount set.' },
  form: {
    steps: [
      {
        id: 'request',
        title: 'Your request',
        intro: 'Sample step.',
        fields: [
          { id: 'confirm', label: 'I have checked my details', type: 'checkbox', required: true },
        ],
      },
    ],
  },
  needsServicePoint: false,
});

const GUIDANCE_ONLY: ServiceDefinition = ServiceDefinitionSchema.parse({
  ...IN_PERSON,
  code: 'TEST_GUIDANCE',
  slug: 'test-guidance',
  title: 'Read sample guidance',
  availability: 'GUIDANCE_AND_HANDOFF',
  form: undefined,
});

const catalogue = {
  getService: async (codeOrSlug: string): Promise<ServiceDefinition> => {
    const found = [IN_PERSON, DIRECT, GUIDANCE_ONLY].find(
      (service) => service.code === codeOrSlug || service.slug === codeOrSlug,
    );
    if (!found) throw new GatewayError('NOT_FOUND');
    return found;
  },
};

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function setup(now: () => Date = () => NOW) {
  const platform = createLocalPlatform({ now });
  const published: CaseEvent[] = [];
  platform.bus.subscribe(TOPICS.caseEvent, (event) => published.push(event.payload as CaseEvent));
  return { platform, published, workflow: createWorkflowService(platform, { catalogue }) };
}

type Workflow = ReturnType<typeof createWorkflowService>;

function expectCategory(promise: Promise<unknown>, category: string, message?: string | RegExp) {
  return expect(promise).rejects.toMatchObject(
    message === undefined
      ? { category }
      : { category, safeMessage: expect.stringMatching(message) },
  );
}

/** The tracker must always read: done…, then at most one current, then upcoming… */
function expectCoherentMilestones(milestones: Milestone[]) {
  const order = { done: 0, current: 1, upcoming: 2 };
  const ranks = milestones.map((milestone) => order[milestone.state]);
  expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
  expect(
    milestones.filter((milestone) => milestone.state === 'current').length,
  ).toBeLessThanOrEqual(1);
  for (const milestone of milestones) {
    if (milestone.state === 'done') expect(milestone.at).not.toBeNull();
    else expect(milestone.at).toBeNull();
  }
  expect(new Set(milestones.map((milestone) => milestone.key)).size).toBe(milestones.length);
}

function currentKey(subject: ApplicationCase): string | undefined {
  return subject.milestones.find((milestone) => milestone.state === 'current')?.key;
}

function expectValidCase(subject: ApplicationCase) {
  ApplicationCaseSchema.parse(subject);
  expectCoherentMilestones(subject.milestones);
}

const accept = (draftId: string, sessionTier: AssuranceTier = 'A3'): SubmitApplicationInput => ({
  draftId,
  declarationAccepted: true,
  sessionTier,
});

async function readyInPersonDraft(
  workflow: Workflow,
  extra: { servicePointId?: string; appointmentId?: string } = {},
) {
  const draft = await workflow.saveDraft(
    {
      serviceCode: IN_PERSON.code,
      applicantToken: thandi,
      answers: { reason: 'Sample reason' },
      currentStepId: 'request',
      paymentRef: 'PAY-DEMO-2001',
      ...extra,
    },
    KEY,
  );
  return workflow.attachSampleEvidence(draft.draftId, 'proof', 'Sample document', KEY);
}

async function submitInPerson(
  workflow: Workflow,
  extra: { servicePointId?: string; appointmentId?: string } = {},
) {
  const draft = await readyInPersonDraft(workflow, extra);
  return workflow.submitApplication(accept(draft.draftId), KEY);
}

async function submitDirect(workflow: Workflow) {
  const draft = await workflow.saveDraft(
    {
      serviceCode: DIRECT.code,
      applicantToken: thandi,
      answers: { confirm: true },
      currentStepId: 'request',
    },
    KEY,
  );
  return workflow.submitApplication(accept(draft.draftId, 'A2'), KEY);
}

const decide = (outcome: 'APPROVED' | 'DECLINED' | 'REFERRED'): StaffAction => ({
  type: 'RECORD_DECISION',
  outcome,
  reasonCategory: 'Sample reason category',
  reviewedByHuman: true,
});

/** Takes an in-person case from submission to being processed. */
async function toProcessing(workflow: Workflow): Promise<ApplicationCase> {
  const { caseId } = await submitInPerson(workflow);
  await workflow.simulateNextEvent(caseId, KEY);
  await workflow.simulateNextEvent(caseId, KEY);
  await workflow.selectServicePoint(caseId, POINT, KEY);
  await workflow.linkAppointment(caseId, APPOINTMENT, KEY);
  return workflow.simulateNextEvent(caseId, KEY);
}

/* ------------------------------------------------------------------ */
/* Milestones                                                          */
/* ------------------------------------------------------------------ */

describe('milestonesAfter', () => {
  const at = (n: number) => `2026-11-2${n}T10:00:00+02:00`;

  it('lays out six milestones with an in-person step and four without', () => {
    expect(blankMilestones(true).map((milestone) => [milestone.key, milestone.label])).toEqual([
      ['received', 'Application received'],
      ['checks', 'Identity and evidence checks'],
      ['capture', 'In-person capture'],
      ['processing', 'Processing and decision'],
      ['production', 'Document production'],
      ['collection', 'Collection or delivery'],
    ]);
    expect(blankMilestones(false).map((milestone) => [milestone.key, milestone.label])).toEqual([
      ['received', 'Application received'],
      ['checks', 'Identity and evidence checks'],
      ['processing', 'Processing and decision'],
      ['outcome', 'Outcome and next steps'],
    ]);
    expect(blankMilestones(true).every((milestone) => milestone.state === 'upcoming')).toBe(true);
  });

  it('marks everything before the reached milestone done, with the time it was finished', () => {
    const first = milestonesAfter(blankMilestones(true), { reach: 'checks' }, at(1));
    expect(first.map((milestone) => milestone.state)).toEqual([
      'done',
      'current',
      'upcoming',
      'upcoming',
      'upcoming',
      'upcoming',
    ]);
    expect(first[0]?.at).toBe(at(1));

    const second = milestonesAfter(first, { reach: 'processing' }, at(2));
    expect(second.map((milestone) => milestone.state)).toEqual([
      'done',
      'done',
      'done',
      'current',
      'upcoming',
      'upcoming',
    ]);
    // Earlier milestones keep their own time; newly finished ones get this step's time.
    expect(second.map((milestone) => milestone.at)).toEqual([
      at(1),
      at(2),
      at(2),
      null,
      null,
      null,
    ]);
    expectCoherentMilestones(second);
  });

  it('never moves backwards and ignores a milestone the plan does not have', () => {
    const reached = milestonesAfter(blankMilestones(true), { reach: 'processing' }, at(1));
    expect(milestonesAfter(reached, { reach: 'checks' }, at(2))).toEqual(reached);
    expect(milestonesAfter(reached, { reach: 'processing' }, at(2))).toEqual(reached);
    expect(milestonesAfter(reached, {}, at(2))).toEqual(reached);
    const direct = milestonesAfter(blankMilestones(false), { reach: 'checks' }, at(1));
    expect(milestonesAfter(direct, { reach: 'capture' }, at(2))).toEqual(direct);
  });

  it('finishes the whole plan', () => {
    const done = milestonesAfter(blankMilestones(false), { reach: ALL_DONE }, at(1));
    expect(done.every((milestone) => milestone.state === 'done' && milestone.at === at(1))).toBe(
      true,
    );
  });

  it('drops milestones that were never reached when the journey stops', () => {
    const reached = milestonesAfter(blankMilestones(true), { reach: 'capture' }, at(1));
    const stopped = milestonesAfter(reached, { stop: true }, at(2));
    expect(stopped.map((milestone) => milestone.key)).toEqual(['received', 'checks']);
    expectCoherentMilestones(stopped);
  });

  it('does not change the list it was given', () => {
    const blank = blankMilestones(true);
    const copy = structuredClone(blank);
    milestonesAfter(blank, { reach: ALL_DONE, stop: true }, at(1));
    expect(blank).toEqual(copy);
  });
});

/* ------------------------------------------------------------------ */
/* Seed data                                                           */
/* ------------------------------------------------------------------ */

describe('seed data', () => {
  async function seededCases(workflow: Workflow) {
    return Promise.all(Object.values(DEMO.cases).map((caseId) => workflow.getCase(caseId)));
  }

  it('gives every seeded case a valid shape and a history that ends where the case is', async () => {
    const { workflow } = setup();
    for (const subject of await seededCases(workflow)) {
      expectValidCase(subject);
      const events = await workflow.listCaseEvents(subject.caseId);
      for (const event of events) CaseEventSchema.parse(event);

      expect(events[0]?.type).toBe('SUBMITTED');
      expect(events[0]?.at).toBe(subject.submittedAt);
      expect(events.at(-1)?.status).toBe(subject.status);
      expect(events.at(-1)?.at).toBe(subject.statusUpdatedAt);
      const times = events.map((event) => Date.parse(event.at));
      expect(times).toEqual([...times].sort((a, b) => a - b));
      expect(times.every((time) => time < NOW.getTime())).toBe(true);
      expect(subject.decision !== null).toBe(
        events.some((event) => event.type === 'DECISION_RECORDED'),
      );
    }
    const eventIds = (
      await Promise.all(Object.values(DEMO.cases).map((caseId) => workflow.listCaseEvents(caseId)))
    ).flatMap((events) => events.map((event) => event.eventId));
    expect(new Set(eventIds).size).toBe(eventIds.length);
  });

  it('seeds the Smart ID case exactly as the brief sets it out', async () => {
    const { workflow } = setup();
    const subject = await workflow.getCase(DEMO.cases.smartIdActionRequired);
    expect(subject).toMatchObject({
      serviceCode: 'SMART_ID_REPLACEMENT',
      serviceTitle: 'Replace a Smart ID',
      applicantToken: thandi,
      status: 'ACTION_REQUIRED',
      nextAction: {
        type: 'SELECT_SERVICE_POINT',
        description: 'Choose an approved service point for the next step',
        dueAt: null,
      },
      assignedQueue: 'Identity documents',
      servicePointId: null,
      paymentRef: null,
      decision: null,
      dataClassification: 'RESTRICTED',
      sourceOfTruth: 'DHA_WORKFLOW_ADAPTER_MOCK',
    });
    expect(Date.parse(subject.submittedAt)).toBe(NOW.getTime() - 3 * DAY);
    expect(Date.parse(subject.statusUpdatedAt)).toBe(NOW.getTime() - 40 * 60 * 1000);
    expect((await workflow.listCaseEvents(subject.caseId)).map((event) => event.type)).toEqual([
      'SUBMITTED',
      'VALIDATION_STARTED',
      'INFORMATION_REQUESTED',
    ]);
    expect(currentKey(subject)).toBe('capture');
  });

  it('seeds the passport in production with its full history', async () => {
    const { workflow } = setup();
    const subject = await workflow.getCase(DEMO.cases.passportInProduction);
    expect(subject).toMatchObject({
      serviceCode: 'ADULT_PASSPORT',
      serviceTitle: 'Apply for an adult passport',
      applicantToken: thandi,
      status: 'FULFILMENT',
      statusDetail: 'In production',
      nextAction: null,
      assignedQueue: 'Passports',
      servicePointId: DEMO.servicePoints.bankCentral,
      // The approved sandbox payment the payments mock seeds for this application.
      paymentRef: 'PAY-DEMO-1001',
      decision: { outcome: 'APPROVED', decidedByRef: OFFICER },
    });
    expect(Date.parse(subject.submittedAt)).toBe(NOW.getTime() - 16 * DAY);
    expect(Date.parse(subject.statusUpdatedAt)).toBe(NOW.getTime() - DAY);
    expect((await workflow.listCaseEvents(subject.caseId)).map((event) => event.type)).toEqual([
      'SUBMITTED',
      'VALIDATION_STARTED',
      'INFORMATION_REQUESTED',
      'SERVICE_POINT_SELECTED',
      'APPOINTMENT_BOOKED',
      'CAPTURE_COMPLETED',
      'PROCESSING_STARTED',
      'DECISION_RECORDED',
      'PRODUCTION_STARTED',
    ]);
    expect(subject.milestones).toHaveLength(6);
    expect(currentKey(subject)).toBe('production');
  });

  it('seeds a completed certificate request with no in-person step', async () => {
    const { workflow } = setup();
    const subject = await workflow.getCase(DEMO.cases.certificateCompleted);
    expect(subject).toMatchObject({
      serviceCode: 'BIRTH_CERTIFICATE',
      serviceTitle: 'Request a birth certificate',
      applicantToken: thandi,
      status: 'CLOSED',
      statusDetail: 'Completed',
      servicePointId: null,
    });
    expect(subject.milestones.map((milestone) => milestone.key)).toEqual([
      'received',
      'checks',
      'processing',
      'outcome',
    ]);
    expect(subject.milestones.every((milestone) => milestone.state === 'done')).toBe(true);
    const monthsAgo = (NOW.getTime() - Date.parse(subject.statusUpdatedAt)) / (30 * DAY);
    expect(monthsAgo).toBeGreaterThan(4.5);
    expect(monthsAgo).toBeLessThan(5.5);
  });

  it('seeds the birth registration Sipho made for his linked child', async () => {
    const { workflow } = setup();
    const subject = await workflow.getCase(DEMO.cases.birthInValidation);
    expect(subject).toMatchObject({
      serviceCode: 'BIRTH_REGISTRATION',
      serviceTitle: 'Register a birth',
      applicantToken: sipho,
      onBehalfOfLinkId: 'LINK-DEMO-1001',
      status: 'IN_VALIDATION',
      assignedQueue: 'Civic registration',
    });
    expect(Date.parse(subject.submittedAt)).toBe(NOW.getTime() - DAY);
  });

  it('seeds the passport appointment at a mission abroad', async () => {
    const { workflow } = setup();
    const subject = await workflow.getCase(DEMO.cases.passportAbroadScheduled);
    expect(subject).toMatchObject({
      serviceCode: 'ADULT_PASSPORT',
      applicantToken: lerato,
      status: 'SCHEDULED',
      servicePointId: DEMO.servicePoints.missionEurope,
      appointmentId: DEMO.appointments.leratoMission,
      nextAction: { type: 'ATTEND_APPOINTMENT' },
    });
  });

  it('seeds one part-finished draft for Sipho', async () => {
    const { workflow } = setup();
    const draft = ApplicationDraftSchema.parse(await workflow.getDraft(DEMO.drafts.siphoPassport));
    expect(draft).toMatchObject({
      serviceCode: 'ADULT_PASSPORT',
      applicantToken: sipho,
      currentStepId: 'request',
      evidence: [],
    });
    expect(Date.parse(draft.updatedAt)).toBe(NOW.getTime() - 2 * DAY);
    expect(Date.parse(draft.expiresAt) - Date.parse(draft.createdAt)).toBe(30 * DAY);
    expect(await workflow.listDrafts(sipho)).toEqual([draft]);
    expect(await workflow.listDrafts(thandi)).toEqual([]);
  });

  it('resumes the seeded draft on the second step of its form, as the catalogue names it', async () => {
    const passport: ServiceDefinition = ServiceDefinitionSchema.parse({
      ...IN_PERSON,
      code: 'ADULT_PASSPORT',
      slug: 'adult-passport',
      form: {
        steps: [
          { id: 'your-details', title: 'Your details', intro: 'Sample step.', fields: [] },
          {
            id: 'passport-details',
            title: 'About your passport',
            intro: 'Sample step.',
            fields: [],
          },
        ],
      },
    });
    const platform = createLocalPlatform({ now: () => NOW });
    const workflow = createWorkflowService(platform, {
      catalogue: { getService: async () => passport },
    });
    const draft = ApplicationDraftSchema.parse(await workflow.getDraft(DEMO.drafts.siphoPassport));
    expect(draft.currentStepId).toBe('passport-details');
  });

  it('seeds once, even when the first calls arrive together', async () => {
    const { workflow } = setup();
    const [cases, drafts, queue] = await Promise.all([
      workflow.listCases(thandi),
      workflow.listDrafts(sipho),
      workflow.listQueue(),
    ]);
    expect(cases).toHaveLength(3);
    expect(drafts).toHaveLength(1);
    expect(queue).toHaveLength(4);
    const events = await workflow.listCaseEvents(DEMO.cases.smartIdActionRequired);
    expect(events.map((event) => event.eventId)).toEqual([
      'EVT-DEMO-1001',
      'EVT-DEMO-1002',
      'EVT-DEMO-1003',
    ]);
  });

  it('lists cases by person, most recently updated first, and nothing for Aisha', async () => {
    const { workflow } = setup();
    expect((await workflow.listCases(thandi)).map((subject) => subject.caseId)).toEqual([
      DEMO.cases.smartIdActionRequired,
      DEMO.cases.passportInProduction,
      DEMO.cases.certificateCompleted,
    ]);
    expect(await workflow.listCases(aisha)).toEqual([]);
  });

  it('seeds quietly: old events are not published again', async () => {
    const { workflow, published } = setup();
    await workflow.listCases(thandi);
    expect(published).toEqual([]);
  });

  it('never reuses a seeded identifier for something new', async () => {
    const { workflow } = setup();
    const draft = await workflow.saveDraft(
      {
        serviceCode: IN_PERSON.code,
        applicantToken: thandi,
        answers: {},
        currentStepId: 'request',
      },
      KEY,
    );
    expect(draft.draftId).not.toBe(DEMO.drafts.siphoPassport);
    const opened = await submitInPerson(workflow);
    expect(Object.values(DEMO.cases)).not.toContain(opened.caseId);
  });
});

/* ------------------------------------------------------------------ */
/* Drafts                                                              */
/* ------------------------------------------------------------------ */

describe('drafts', () => {
  it('creates a draft that expires in thirty days', async () => {
    const { workflow } = setup();
    const draft = ApplicationDraftSchema.parse(
      await workflow.saveDraft(
        {
          serviceCode: IN_PERSON.slug,
          applicantToken: thandi,
          answers: { reason: 'Sample reason' },
          currentStepId: 'request',
        },
        KEY,
      ),
    );
    expect(draft).toMatchObject({
      serviceCode: IN_PERSON.code,
      applicantToken: thandi,
      onBehalfOfLinkId: null,
      answers: { reason: 'Sample reason' },
      evidence: [],
      servicePointId: null,
      appointmentId: null,
      paymentRef: null,
      createdAt: NOW_ISO,
      updatedAt: NOW_ISO,
    });
    expect(Date.parse(draft.expiresAt)).toBe(NOW.getTime() + 30 * DAY);
    expect(await workflow.getDraft(draft.draftId)).toEqual(draft);
  });

  it('merges answers on update and keeps what was not sent', async () => {
    let now = NOW;
    const { workflow } = setup(() => now);
    const created = await workflow.saveDraft(
      {
        serviceCode: IN_PERSON.code,
        applicantToken: thandi,
        onBehalfOfLinkId: 'LINK-DEMO-1001',
        answers: { reason: 'First answer', notes: 'Keep me' },
        currentStepId: 'request',
        servicePointId: POINT,
      },
      KEY,
    );
    now = new Date(NOW.getTime() + 60_000);
    const updated = await workflow.saveDraft(
      {
        draftId: created.draftId,
        serviceCode: IN_PERSON.code,
        applicantToken: thandi,
        answers: { reason: 'Second answer' },
        currentStepId: 'review',
        paymentRef: 'PAY-DEMO-2001',
      },
      KEY,
    );
    expect(updated).toMatchObject({
      draftId: created.draftId,
      answers: { reason: 'Second answer', notes: 'Keep me' },
      currentStepId: 'review',
      onBehalfOfLinkId: 'LINK-DEMO-1001',
      servicePointId: POINT,
      paymentRef: 'PAY-DEMO-2001',
      createdAt: created.createdAt,
      expiresAt: created.expiresAt,
    });
    expect(Date.parse(updated.updatedAt)).toBe(now.getTime());
  });

  it('lists a person’s drafts newest first', async () => {
    let now = NOW;
    const { workflow } = setup(() => now);
    const save = () =>
      workflow.saveDraft(
        { serviceCode: DIRECT.code, applicantToken: thandi, answers: {}, currentStepId: 'request' },
        KEY,
      );
    const older = await save();
    now = new Date(NOW.getTime() + 60_000);
    const newer = await save();
    expect((await workflow.listDrafts(thandi)).map((draft) => draft.draftId)).toEqual([
      newer.draftId,
      older.draftId,
    ]);
  });

  it('refuses a service that cannot be applied for online, and one that does not exist', async () => {
    const { workflow } = setup();
    const input = { applicantToken: thandi, answers: {}, currentStepId: 'request' };
    await expectCategory(
      workflow.saveDraft({ ...input, serviceCode: GUIDANCE_ONLY.code }, KEY),
      'VALIDATION',
      /cannot be applied for online/,
    );
    await expectCategory(
      workflow.saveDraft({ ...input, serviceCode: 'NO_SUCH' }, KEY),
      'NOT_FOUND',
    );
  });

  it('refuses to update someone else’s draft, a missing draft, or to switch service', async () => {
    const { workflow } = setup();
    const input = { serviceCode: IN_PERSON.code, answers: {}, currentStepId: 'request' };
    const draft = await workflow.saveDraft({ ...input, applicantToken: thandi }, KEY);
    await expectCategory(
      workflow.saveDraft({ ...input, draftId: draft.draftId, applicantToken: sipho }, KEY),
      'FORBIDDEN',
    );
    await expectCategory(
      workflow.saveDraft({ ...input, draftId: 'DRAFT-DEMO-9999', applicantToken: thandi }, KEY),
      'NOT_FOUND',
    );
    await expectCategory(
      workflow.saveDraft(
        { ...input, draftId: draft.draftId, applicantToken: thandi, serviceCode: DIRECT.code },
        KEY,
      ),
      'VALIDATION',
    );
  });

  it('attaches only a synthetic placeholder, and replaces it for the same field', async () => {
    const { workflow } = setup();
    const draft = await workflow.saveDraft(
      {
        serviceCode: IN_PERSON.code,
        applicantToken: thandi,
        answers: {},
        currentStepId: 'request',
      },
      KEY,
    );
    const first = await workflow.attachSampleEvidence(
      draft.draftId,
      'proof',
      'Sample document',
      KEY,
    );
    expect(first.evidence).toEqual([
      {
        evidenceId: expect.any(String),
        fieldId: 'proof',
        documentType: 'Sample document',
        fileLabel: 'Synthetic placeholder — no real file',
        synthetic: true,
        addedAt: NOW_ISO,
        scanStatus: 'NOT_SCANNED',
        retention: 'Deleted when the draft is deleted or the sample data is reset.',
      },
    ]);

    const replaced = await workflow.attachSampleEvidence(
      draft.draftId,
      'proof',
      'Another sample',
      KEY,
    );
    expect(replaced.evidence).toHaveLength(1);
    expect(replaced.evidence[0]?.documentType).toBe('Another sample');
    expect(replaced.evidence[0]?.evidenceId).not.toBe(first.evidence[0]?.evidenceId);

    const two = await workflow.attachSampleEvidence(draft.draftId, 'other', 'Second sample', KEY);
    expect(two.evidence.map((item) => item.fieldId)).toEqual(['proof', 'other']);
    ApplicationDraftSchema.parse(two);
  });

  it('removes evidence, and removing it twice is harmless', async () => {
    const { workflow } = setup();
    const draft = await readyInPersonDraft(workflow);
    const evidenceId = draft.evidence[0]?.evidenceId ?? '';
    expect((await workflow.removeEvidence(draft.draftId, evidenceId, KEY)).evidence).toEqual([]);
    expect((await workflow.removeEvidence(draft.draftId, evidenceId, KEY)).evidence).toEqual([]);
    await expectCategory(workflow.removeEvidence('DRAFT-DEMO-9999', evidenceId, KEY), 'NOT_FOUND');
  });

  it('deletes a draft, and deleting it twice is harmless', async () => {
    const { workflow } = setup();
    await workflow.deleteDraft(DEMO.drafts.siphoPassport, KEY);
    await workflow.deleteDraft(DEMO.drafts.siphoPassport, KEY);
    await expectCategory(workflow.getDraft(DEMO.drafts.siphoPassport), 'NOT_FOUND');
    expect(await workflow.listDrafts(sipho)).toEqual([]);
  });

  it('stops showing a draft once it has expired', async () => {
    let now = NOW;
    const { workflow } = setup(() => now);
    await workflow.getDraft(DEMO.drafts.siphoPassport);
    now = new Date(NOW.getTime() + 26 * DAY);
    expect(await workflow.listDrafts(sipho)).toEqual([]);
    await expectCategory(workflow.getDraft(DEMO.drafts.siphoPassport), 'NOT_FOUND');
  });
});

/* ------------------------------------------------------------------ */
/* Submitting                                                          */
/* ------------------------------------------------------------------ */

describe('submitApplication', () => {
  it('creates a received case, removes the draft and publishes the event', async () => {
    const { workflow, published } = setup();
    const draft = await readyInPersonDraft(workflow, { servicePointId: POINT });
    const subject = await workflow.submitApplication(accept(draft.draftId), KEY);

    expectValidCase(subject);
    expect(subject).toMatchObject({
      serviceCode: IN_PERSON.code,
      serviceTitle: IN_PERSON.title,
      applicantToken: thandi,
      onBehalfOfLinkId: null,
      status: 'SUBMITTED',
      statusDetail: 'Received',
      statusUpdatedAt: NOW_ISO,
      submittedAt: NOW_ISO,
      nextAction: null,
      assignedQueue: 'Identity documents',
      servicePointId: POINT,
      appointmentId: null,
      paymentRef: 'PAY-DEMO-2001',
      decision: null,
      dataClassification: 'RESTRICTED',
      sourceOfTruth: 'DHA_WORKFLOW_ADAPTER_MOCK',
    });
    expect(subject.milestones.map((milestone) => milestone.state)).toEqual([
      'done',
      'current',
      'upcoming',
      'upcoming',
      'upcoming',
      'upcoming',
    ]);

    const events = await workflow.listCaseEvents(subject.caseId);
    expect(events).toHaveLength(1);
    expect(CaseEventSchema.parse(events[0])).toMatchObject({
      caseId: subject.caseId,
      type: 'SUBMITTED',
      status: 'SUBMITTED',
      actor: 'APPLICANT',
      title: 'Application received',
    });
    expect(published).toEqual(events);
    await expectCategory(workflow.getDraft(draft.draftId), 'NOT_FOUND');
    expect(await workflow.getCase(subject.caseId)).toEqual(subject);
    expect((await workflow.listCases(thandi))[0]?.caseId).toBe(subject.caseId);
  });

  it('routes each service domain to its queue', async () => {
    const { workflow } = setup();
    expect((await submitInPerson(workflow)).assignedQueue).toBe('Identity documents');
    expect((await submitDirect(workflow)).assignedQueue).toBe('Civic registration');
  });

  it.each([false, undefined, 'true', 1])(
    'refuses a declaration of %s: the person must accept it themselves',
    async (declarationAccepted) => {
      const { workflow, published } = setup();
      const draft = await readyInPersonDraft(workflow);
      await expectCategory(
        workflow.submitApplication(
          {
            draftId: draft.draftId,
            declarationAccepted,
            sessionTier: 'A3',
          } as unknown as SubmitApplicationInput,
          KEY,
        ),
        'VALIDATION',
        /^Please read and accept the declaration yourself before submitting\.$/,
      );
      expect(await workflow.getDraft(draft.draftId)).toEqual(draft);
      expect(published).toEqual([]);
    },
  );

  it.each(['A0', 'A1', 'A2', 'A4'] as const)(
    'refuses a session at tier %s when the service needs A3',
    async (tier) => {
      const { workflow } = setup();
      const draft = await readyInPersonDraft(workflow);
      await expectCategory(
        workflow.submitApplication(accept(draft.draftId, tier), KEY),
        'FORBIDDEN',
        /stronger identity check/,
      );
      expect(await workflow.getDraft(draft.draftId)).toEqual(draft);
    },
  );

  it('lists the required answers and evidence that are missing, by label', async () => {
    const { workflow } = setup();
    const draft = await workflow.saveDraft(
      {
        serviceCode: IN_PERSON.code,
        applicantToken: thandi,
        answers: { reason: '   ' },
        currentStepId: 'request',
        paymentRef: 'PAY-DEMO-2001',
      },
      KEY,
    );
    await expectCategory(
      workflow.submitApplication(accept(draft.draftId), KEY),
      'VALIDATION',
      /Reason for your request; Supporting document\.$/,
    );

    await workflow.saveDraft(
      {
        draftId: draft.draftId,
        serviceCode: IN_PERSON.code,
        applicantToken: thandi,
        answers: { reason: 'Sample reason' },
        currentStepId: 'request',
      },
      KEY,
    );
    const stillMissing = workflow.submitApplication(accept(draft.draftId), KEY);
    await expectCategory(stillMissing, 'VALIDATION', /before you submit: Supporting document\.$/);
  });

  it('needs a required tick box to be ticked', async () => {
    const { workflow } = setup();
    const draft = await workflow.saveDraft(
      {
        serviceCode: DIRECT.code,
        applicantToken: thandi,
        answers: { confirm: false },
        currentStepId: 'request',
      },
      KEY,
    );
    await expectCategory(
      workflow.submitApplication(accept(draft.draftId, 'A2'), KEY),
      'VALIDATION',
      /I have checked my details/,
    );
  });

  it('refuses to submit before a sample fee has been paid', async () => {
    const { workflow } = setup();
    const draft = await workflow.saveDraft(
      {
        serviceCode: IN_PERSON.code,
        applicantToken: thandi,
        answers: { reason: 'Sample reason' },
        currentStepId: 'request',
      },
      KEY,
    );
    await workflow.attachSampleEvidence(draft.draftId, 'proof', 'Sample document', KEY);
    await expectCategory(
      workflow.submitApplication(accept(draft.draftId), KEY),
      'VALIDATION',
      /^Payment has not been completed\.$/,
    );
  });

  it('does not ask for payment when the service has no sample fee', async () => {
    const { workflow } = setup();
    const subject = await submitDirect(workflow);
    expect(subject.paymentRef).toBeNull();
    expect(subject.milestones).toHaveLength(4);
  });

  it('cannot submit the same draft twice, or a draft that does not exist', async () => {
    const { workflow } = setup();
    const draft = await readyInPersonDraft(workflow);
    await workflow.submitApplication(accept(draft.draftId), KEY);
    await expectCategory(workflow.submitApplication(accept(draft.draftId), KEY), 'NOT_FOUND');
    await expectCategory(workflow.submitApplication(accept('DRAFT-DEMO-9999'), KEY), 'NOT_FOUND');
  });
});

/* ------------------------------------------------------------------ */
/* Lifecycle                                                           */
/* ------------------------------------------------------------------ */

describe('lifecycle with an in-person step', () => {
  it('runs from submission to collection, one published event at a time', async () => {
    const { workflow, published } = setup();
    const submitted = await submitInPerson(workflow);
    const { caseId } = submitted;
    const seen: ApplicationCase[] = [submitted];
    const step = async (next: Promise<ApplicationCase>) => {
      const subject = await next;
      expectValidCase(subject);
      expect(await workflow.getCase(caseId)).toEqual(subject);
      seen.push(subject);
      return subject;
    };

    let subject = await step(workflow.simulateNextEvent(caseId, KEY));
    expect(subject).toMatchObject({
      status: 'IN_VALIDATION',
      statusDetail: 'Identity and evidence checks',
      nextAction: null,
    });
    expect(currentKey(subject)).toBe('checks');

    subject = await step(workflow.simulateNextEvent(caseId, KEY));
    expect(subject).toMatchObject({
      status: 'ACTION_REQUIRED',
      statusDetail: 'We need something from you',
      nextAction: {
        type: 'SELECT_SERVICE_POINT',
        description: 'Choose an approved service point for the next step',
        dueAt: null,
      },
    });
    expect(currentKey(subject)).toBe('capture');
    await expectCategory(
      workflow.simulateNextEvent(caseId, KEY),
      'CONFLICT',
      /^Waiting for you to choose a service point\.$/,
    );

    subject = await step(workflow.selectServicePoint(caseId, POINT, KEY));
    expect(subject).toMatchObject({
      status: 'ACTION_REQUIRED',
      servicePointId: POINT,
      nextAction: {
        type: 'BOOK_APPOINTMENT',
        description: 'Book a time at your chosen service point',
      },
    });
    await expectCategory(
      workflow.simulateNextEvent(caseId, KEY),
      'CONFLICT',
      /^Waiting for you to book an appointment\.$/,
    );

    subject = await step(workflow.linkAppointment(caseId, APPOINTMENT, KEY));
    expect(subject).toMatchObject({
      status: 'SCHEDULED',
      statusDetail: 'Appointment confirmed',
      appointmentId: APPOINTMENT,
      nextAction: { type: 'ATTEND_APPOINTMENT', description: 'Attend your appointment' },
    });
    expect(currentKey(subject)).toBe('capture');

    subject = await step(workflow.simulateNextEvent(caseId, KEY));
    expect(subject).toMatchObject({
      status: 'PROCESSING',
      statusDetail: 'In progress',
      nextAction: null,
    });
    expect(currentKey(subject)).toBe('processing');

    subject = await step(workflow.recordStaffAction(caseId, decide('APPROVED'), OFFICER, KEY));
    expect(subject).toMatchObject({
      status: 'DECISION',
      statusDetail: 'Approved',
      decision: {
        outcome: 'APPROVED',
        reasonCategory: 'Sample reason category',
        decidedByRef: OFFICER,
        decidedAt: NOW_ISO,
      },
    });
    expect(subject.decision?.reviewRoute).toMatch(/review or appeal route/);
    expect(currentKey(subject)).toBe('production');

    subject = await step(workflow.simulateNextEvent(caseId, KEY));
    expect(subject).toMatchObject({
      status: 'FULFILMENT',
      statusDetail: 'In production',
      nextAction: null,
    });

    subject = await step(workflow.simulateNextEvent(caseId, KEY));
    expect(subject).toMatchObject({
      status: 'FULFILMENT',
      statusDetail: 'Ready for collection',
      nextAction: {
        type: 'COLLECT',
        description:
          'Collect at your chosen service point. Bring what the official notice asks for.',
      },
    });
    expect(currentKey(subject)).toBe('collection');

    subject = await step(workflow.simulateNextEvent(caseId, KEY));
    expect(subject).toMatchObject({
      status: 'CLOSED',
      statusDetail: 'Completed',
      nextAction: null,
    });
    expect(subject.milestones).toHaveLength(6);
    expect(subject.milestones.every((milestone) => milestone.state === 'done')).toBe(true);
    await expectCategory(workflow.simulateNextEvent(caseId, KEY), 'CONFLICT');

    // Every change is one event: recorded, valid, published, and in step with the case.
    const events = await workflow.listCaseEvents(caseId);
    for (const event of events) CaseEventSchema.parse(event);
    expect(events.map((event) => event.type)).toEqual([
      'SUBMITTED',
      'VALIDATION_STARTED',
      'INFORMATION_REQUESTED',
      'SERVICE_POINT_SELECTED',
      'APPOINTMENT_BOOKED',
      'CAPTURE_COMPLETED',
      'DECISION_RECORDED',
      'PRODUCTION_STARTED',
      'READY_FOR_COLLECTION',
      'COLLECTED',
    ]);
    expect(events.map((event) => event.status)).toEqual(seen.map((state) => state.status));
    expect(events.map((event) => event.actor)).toEqual([
      'APPLICANT',
      'SYSTEM',
      'SYSTEM',
      'APPLICANT',
      'APPLICANT',
      'SYSTEM',
      'STAFF',
      'SYSTEM',
      'SYSTEM',
      'SYSTEM',
    ]);
    expect(published).toEqual(events);
    expect(new Set(events.map((event) => event.eventId)).size).toBe(events.length);
    expect(new Set(events.map((event) => event.correlationId)).size).toBe(events.length);
  });

  it('goes straight to a confirmed appointment when both were chosen before submitting', async () => {
    const { workflow } = setup();
    const { caseId } = await submitInPerson(workflow, {
      servicePointId: POINT,
      appointmentId: APPOINTMENT,
    });
    await workflow.simulateNextEvent(caseId, KEY);
    const subject = await workflow.simulateNextEvent(caseId, KEY);
    expectValidCase(subject);
    expect(subject).toMatchObject({
      status: 'SCHEDULED',
      servicePointId: POINT,
      appointmentId: APPOINTMENT,
      nextAction: { type: 'ATTEND_APPOINTMENT' },
    });
    expect((await workflow.listCaseEvents(caseId)).at(-1)?.type).toBe('APPOINTMENT_BOOKED');
  });

  it('asks only for a booking when the service point was chosen before submitting', async () => {
    const { workflow } = setup();
    const { caseId } = await submitInPerson(workflow, { servicePointId: POINT });
    await workflow.simulateNextEvent(caseId, KEY);
    const subject = await workflow.simulateNextEvent(caseId, KEY);
    expect(subject).toMatchObject({
      status: 'ACTION_REQUIRED',
      nextAction: { type: 'BOOK_APPOINTMENT' },
    });
    expect(currentKey(subject)).toBe('capture');
  });

  it('records a changed appointment without leaving the scheduled state', async () => {
    const { workflow } = setup();
    const { caseId } = await submitInPerson(workflow, {
      servicePointId: POINT,
      appointmentId: APPOINTMENT,
    });
    await workflow.simulateNextEvent(caseId, KEY);
    await workflow.simulateNextEvent(caseId, KEY);
    const subject = await workflow.linkAppointment(caseId, 'APPT-DEMO-2002', KEY);
    expect(subject).toMatchObject({ status: 'SCHEDULED', appointmentId: 'APPT-DEMO-2002' });
    expect((await workflow.listCaseEvents(caseId)).at(-1)).toMatchObject({
      type: 'APPOINTMENT_CHANGED',
      status: 'SCHEDULED',
    });
  });

  it('asks for a new booking when a different service point is chosen after booking', async () => {
    const { workflow } = setup();
    const { caseId } = await submitInPerson(workflow, {
      servicePointId: POINT,
      appointmentId: APPOINTMENT,
    });
    await workflow.simulateNextEvent(caseId, KEY);
    await workflow.simulateNextEvent(caseId, KEY);
    const same = await workflow.selectServicePoint(caseId, POINT, KEY);
    expect(same.status).toBe('SCHEDULED');

    const moved = await workflow.selectServicePoint(caseId, DEMO.servicePoints.officeNorth, KEY);
    expectValidCase(moved);
    expect(moved).toMatchObject({
      status: 'ACTION_REQUIRED',
      servicePointId: DEMO.servicePoints.officeNorth,
      appointmentId: null,
      nextAction: { type: 'BOOK_APPOINTMENT' },
    });
  });

  it('only notes a service point or appointment chosen before the checks are finished', async () => {
    const { workflow } = setup();
    const { caseId } = await submitInPerson(workflow);
    const chosen = await workflow.selectServicePoint(caseId, POINT, KEY);
    expect(chosen).toMatchObject({ status: 'SUBMITTED', servicePointId: POINT, nextAction: null });
    const booked = await workflow.linkAppointment(caseId, APPOINTMENT, KEY);
    expect(booked).toMatchObject({
      status: 'SUBMITTED',
      appointmentId: APPOINTMENT,
      nextAction: null,
    });
    expect(currentKey(booked)).toBe('checks');
    expectValidCase(booked);
  });

  it('refuses identifiers that are not a service point or an appointment', async () => {
    const { workflow } = setup();
    const caseId = DEMO.cases.smartIdActionRequired;
    await expectCategory(workflow.selectServicePoint(caseId, 'somewhere', KEY), 'VALIDATION');
    await expectCategory(workflow.linkAppointment(caseId, 'sometime', KEY), 'VALIDATION');
    await expectCategory(workflow.selectServicePoint('CASE-DEMO-999999', POINT, KEY), 'NOT_FOUND');
  });

  it('will not change the service point once the in-person step is complete', async () => {
    const { workflow } = setup();
    const { caseId } = await toProcessing(workflow);
    await expectCategory(
      workflow.selectServicePoint(caseId, DEMO.servicePoints.officeNorth, KEY),
      'CONFLICT',
    );
  });
});

describe('lifecycle without an in-person step', () => {
  it('goes from checks straight to processing, and closes when the outcome is delivered', async () => {
    const { workflow, published } = setup();
    const { caseId } = await submitDirect(workflow);

    await workflow.simulateNextEvent(caseId, KEY);
    let subject = await workflow.simulateNextEvent(caseId, KEY);
    expect(subject).toMatchObject({ status: 'PROCESSING', statusDetail: 'In progress' });
    expect(currentKey(subject)).toBe('processing');

    subject = await workflow.recordStaffAction(caseId, decide('APPROVED'), OFFICER, KEY);
    expect(currentKey(subject)).toBe('outcome');

    subject = await workflow.simulateNextEvent(caseId, KEY);
    expectValidCase(subject);
    expect(subject).toMatchObject({ status: 'CLOSED', statusDetail: 'Completed' });
    expect(subject.milestones.every((milestone) => milestone.state === 'done')).toBe(true);

    const events = await workflow.listCaseEvents(caseId);
    expect(events.map((event) => event.type)).toEqual([
      'SUBMITTED',
      'VALIDATION_STARTED',
      'PROCESSING_STARTED',
      'DECISION_RECORDED',
      'COLLECTED',
    ]);
    expect(events.at(-1)?.title).toBe('Outcome delivered to your secure inbox');
    expect(published).toEqual(events);
  });

  it('has no service point to choose', async () => {
    const { workflow } = setup();
    const { caseId } = await submitDirect(workflow);
    await expectCategory(workflow.selectServicePoint(caseId, POINT, KEY), 'VALIDATION');
  });
});

/* ------------------------------------------------------------------ */
/* Decisions belong to officials                                       */
/* ------------------------------------------------------------------ */

describe('decisions', () => {
  it('are never recorded by automation', async () => {
    const { workflow, published } = setup();
    const { caseId } = await toProcessing(workflow);
    const before = published.length;

    await expectCategory(
      workflow.simulateNextEvent(caseId, KEY),
      'CONFLICT',
      /^A decision must be recorded by an authorised official\. Automation never decides\.$/,
    );
    await expectCategory(
      workflow.recordStaffAction(caseId, { type: 'ADVANCE' }, OFFICER, KEY),
      'CONFLICT',
      /authorised official/,
    );
    const subject = await workflow.getCase(caseId);
    expect(subject).toMatchObject({ status: 'PROCESSING', decision: null });
    expect(published).toHaveLength(before);
  });

  it('can only be recorded while an application is being processed', async () => {
    const { workflow } = setup();
    const seeded = [
      DEMO.cases.smartIdActionRequired,
      DEMO.cases.birthInValidation,
      DEMO.cases.passportAbroadScheduled,
      DEMO.cases.passportInProduction,
      DEMO.cases.certificateCompleted,
    ];
    for (const caseId of seeded) {
      const before = await workflow.getCase(caseId);
      await expectCategory(
        workflow.recordStaffAction(caseId, decide('APPROVED'), OFFICER, KEY),
        'CONFLICT',
      );
      expect(await workflow.getCase(caseId)).toEqual(before);
    }
    const { caseId } = await submitInPerson(workflow);
    await expectCategory(
      workflow.recordStaffAction(caseId, decide('DECLINED'), OFFICER, KEY),
      'CONFLICT',
    );
  });

  it('cannot be recorded twice', async () => {
    const { workflow } = setup();
    const { caseId } = await toProcessing(workflow);
    await workflow.recordStaffAction(caseId, decide('APPROVED'), OFFICER, KEY);
    await expectCategory(
      workflow.recordStaffAction(caseId, decide('DECLINED'), OFFICER, KEY),
      'CONFLICT',
    );
    expect((await workflow.getCase(caseId)).decision?.outcome).toBe('APPROVED');
  });

  it('need the official’s own confirmation, an outcome and a reason category', async () => {
    const { workflow } = setup();
    const { caseId } = await toProcessing(workflow);
    const incomplete = [
      { ...decide('APPROVED'), reviewedByHuman: false },
      { type: 'RECORD_DECISION', outcome: 'APPROVED', reasonCategory: 'Sample reason category' },
      { ...decide('APPROVED'), outcome: 'MAYBE' },
      { ...decide('APPROVED'), reasonCategory: '' },
      { type: 'DECIDE_AUTOMATICALLY' },
      null,
    ];
    for (const action of incomplete) {
      await expectCategory(
        workflow.recordStaffAction(caseId, action as unknown as StaffAction, OFFICER, KEY),
        'VALIDATION',
      );
    }
    expect((await workflow.getCase(caseId)).decision).toBeNull();
  });

  it('need a signed-in official', async () => {
    const { workflow } = setup();
    const { caseId } = await toProcessing(workflow);
    for (const staffRef of ['', thandi, 'SYSTEM']) {
      await expectCategory(
        workflow.recordStaffAction(caseId, decide('APPROVED'), staffRef, KEY),
        'FORBIDDEN',
      );
    }
  });

  it.each([
    ['DECLINED', 'Declined'],
    ['REFERRED', 'Referred for review'],
  ] as const)('stop the journey when the outcome is %s', async (outcome, statusDetail) => {
    const { workflow } = setup();
    const { caseId } = await toProcessing(workflow);
    const subject = await workflow.recordStaffAction(caseId, decide(outcome), OFFICER, KEY);

    expectValidCase(subject);
    expect(subject).toMatchObject({ status: 'DECISION', statusDetail, decision: { outcome } });
    // Nothing will be produced or collected, so the tracker does not show those steps as to come.
    expect(subject.milestones.map((milestone) => [milestone.key, milestone.state])).toEqual([
      ['received', 'done'],
      ['checks', 'done'],
      ['capture', 'done'],
      ['processing', 'done'],
    ]);
    await expectCategory(
      workflow.simulateNextEvent(caseId, KEY),
      'CONFLICT',
      /^This application has a recorded decision\.$/,
    );
  });

  it('word the event without stating an outcome in the title', async () => {
    const { workflow } = setup();
    const { caseId } = await toProcessing(workflow);
    await workflow.recordStaffAction(caseId, decide('DECLINED'), OFFICER, KEY);
    expect((await workflow.listCaseEvents(caseId)).at(-1)).toMatchObject({
      type: 'DECISION_RECORDED',
      actor: 'STAFF',
      title: 'A decision has been recorded',
    });
  });
});

/* ------------------------------------------------------------------ */
/* Staff actions                                                       */
/* ------------------------------------------------------------------ */

describe('staff actions', () => {
  it('start checks only on a newly received application', async () => {
    const { workflow } = setup();
    const { caseId } = await submitInPerson(workflow);
    const subject = await workflow.recordStaffAction(
      caseId,
      { type: 'START_VALIDATION' },
      OFFICER,
      KEY,
    );
    expect(subject.status).toBe('IN_VALIDATION');
    expect((await workflow.listCaseEvents(caseId)).at(-1)).toMatchObject({
      type: 'VALIDATION_STARTED',
      actor: 'STAFF',
    });
    await expectCategory(
      workflow.recordStaffAction(caseId, { type: 'START_VALIDATION' }, OFFICER, KEY),
      'CONFLICT',
    );
  });

  it('advance a case exactly as the simulator would, attributed to staff', async () => {
    const { workflow } = setup();
    const { caseId } = await submitInPerson(workflow);
    await workflow.recordStaffAction(caseId, { type: 'ADVANCE' }, OFFICER, KEY);
    const subject = await workflow.recordStaffAction(
      caseId,
      { type: 'ADVANCE', note: 'A private note that is not kept' },
      OFFICER,
      KEY,
    );
    expect(subject).toMatchObject({
      status: 'ACTION_REQUIRED',
      nextAction: { type: 'SELECT_SERVICE_POINT' },
    });
    const events = await workflow.listCaseEvents(caseId);
    expect(events.slice(1).map((event) => [event.type, event.actor])).toEqual([
      ['VALIDATION_STARTED', 'STAFF'],
      ['INFORMATION_REQUESTED', 'STAFF'],
    ]);
    expect(JSON.stringify([subject, events])).not.toContain('A private note');
    await expectCategory(
      workflow.recordStaffAction(caseId, { type: 'ADVANCE' }, OFFICER, KEY),
      'CONFLICT',
      /^Waiting for the applicant to choose a service point\.$/,
    );
  });

  it('ask for information and take the reply without keeping its text', async () => {
    const { workflow, published } = setup();
    const caseId = DEMO.cases.birthInValidation;
    const request = 'Please confirm the spelling of the first name on the sample form.';
    const reply = 'SECRET-REPLY the spelling is correct as written';

    const asked = await workflow.recordStaffAction(
      caseId,
      { type: 'REQUEST_INFORMATION', request },
      OFFICER,
      KEY,
    );
    expectValidCase(asked);
    expect(asked).toMatchObject({
      status: 'ACTION_REQUIRED',
      statusDetail: 'We need something from you',
      nextAction: { type: 'PROVIDE_INFORMATION', description: request, dueAt: null },
    });
    await expectCategory(
      workflow.simulateNextEvent(caseId, KEY),
      'CONFLICT',
      /^Waiting for you to send the information we asked for\.$/,
    );
    await expectCategory(workflow.provideInformation(caseId, '   ', KEY), 'VALIDATION');

    const answered = await workflow.provideInformation(caseId, reply, KEY);
    expectValidCase(answered);
    expect(answered).toMatchObject({
      status: 'IN_VALIDATION',
      statusDetail: 'Identity and evidence checks',
      nextAction: null,
    });

    const events = await workflow.listCaseEvents(caseId);
    expect(events.slice(-2).map((event) => [event.type, event.actor, event.status])).toEqual([
      ['INFORMATION_REQUESTED', 'STAFF', 'ACTION_REQUIRED'],
      ['INFORMATION_RECEIVED', 'APPLICANT', 'IN_VALIDATION'],
    ]);
    expect(events.at(-1)?.detail).toBe('You sent the information we asked for.');
    // The reply is not stored anywhere, and the official's wording stays out of events.
    expect(JSON.stringify([answered, events, published])).not.toContain('SECRET-REPLY');
    expect(JSON.stringify([events, published])).not.toContain(request);

    await expectCategory(workflow.provideInformation(caseId, reply, KEY), 'CONFLICT');
    // Checks carry on from where they were: this service still needs a service point.
    const next = await workflow.simulateNextEvent(caseId, KEY);
    expect(next.nextAction?.type).toBe('SELECT_SERVICE_POINT');
  });

  it('pick the in-person step back up after a request made while an appointment was booked', async () => {
    const { workflow } = setup();
    const caseId = DEMO.cases.passportAbroadScheduled;
    await workflow.recordStaffAction(
      caseId,
      { type: 'REQUEST_INFORMATION', request: 'Please send the sample detail we discussed.' },
      OFFICER,
      KEY,
    );
    await workflow.provideInformation(caseId, 'Here it is.', KEY);
    const subject = await workflow.simulateNextEvent(caseId, KEY);
    expectValidCase(subject);
    expect(subject).toMatchObject({
      status: 'SCHEDULED',
      appointmentId: DEMO.appointments.leratoMission,
      nextAction: { type: 'ATTEND_APPOINTMENT' },
    });
  });

  it('cannot ask for information once a decision is recorded or the case is closed', async () => {
    const { workflow } = setup();
    const action: StaffAction = {
      type: 'REQUEST_INFORMATION',
      request: 'Please send a sample detail.',
    };
    for (const caseId of [DEMO.cases.passportInProduction, DEMO.cases.certificateCompleted]) {
      await expectCategory(workflow.recordStaffAction(caseId, action, OFFICER, KEY), 'CONFLICT');
    }
    await expectCategory(
      workflow.recordStaffAction(
        DEMO.cases.birthInValidation,
        { type: 'REQUEST_INFORMATION', request: 'Hi' },
        OFFICER,
        KEY,
      ),
      'VALIDATION',
    );
  });

  it('pass a case to the specialist queue without changing its status or keeping the reason', async () => {
    const { workflow } = setup();
    const caseId = DEMO.cases.smartIdActionRequired;
    const before = await workflow.getCase(caseId);
    const subject = await workflow.recordStaffAction(
      caseId,
      { type: 'ESCALATE', reason: 'PRIVATE-REASON needs a closer look' },
      DEMO.staff.supervisor,
      KEY,
    );
    expectValidCase(subject);
    expect(subject).toMatchObject({
      status: before.status,
      nextAction: before.nextAction,
      milestones: before.milestones,
      assignedQueue: 'Specialist review',
      statusDetail: 'With a specialist team',
    });
    const events = await workflow.listCaseEvents(caseId);
    expect(events.at(-1)).toMatchObject({
      type: 'REFERRED_TO_SPECIALIST',
      actor: 'STAFF',
      status: before.status,
    });
    expect(JSON.stringify([subject, events])).not.toContain('PRIVATE-REASON');
    await expectCategory(
      workflow.recordStaffAction(
        DEMO.cases.certificateCompleted,
        { type: 'ESCALATE', reason: 'Sample reason' },
        OFFICER,
        KEY,
      ),
      'CONFLICT',
    );
  });

  it('cannot act on a case that does not exist', async () => {
    const { workflow } = setup();
    await expectCategory(
      workflow.recordStaffAction('CASE-DEMO-999999', { type: 'ADVANCE' }, OFFICER, KEY),
      'NOT_FOUND',
    );
    await expectCategory(workflow.simulateNextEvent('CASE-DEMO-999999', KEY), 'NOT_FOUND');
    await expectCategory(workflow.listCaseEvents('CASE-DEMO-999999'), 'NOT_FOUND');
  });
});

/* ------------------------------------------------------------------ */
/* Withdrawing, queues, storage                                        */
/* ------------------------------------------------------------------ */

describe('withdrawing', () => {
  it('closes the case and keeps only the milestones that were reached', async () => {
    const { workflow, published } = setup();
    const subject = await workflow.withdrawCase(DEMO.cases.smartIdActionRequired, KEY);
    expectValidCase(subject);
    expect(subject).toMatchObject({
      status: 'CLOSED',
      statusDetail: 'Withdrawn',
      nextAction: null,
    });
    expect(subject.milestones.map((milestone) => milestone.key)).toEqual(['received', 'checks']);
    expect(published.at(-1)).toMatchObject({
      type: 'WITHDRAWN',
      actor: 'APPLICANT',
      status: 'CLOSED',
    });
  });

  it('is not possible once a case is closed', async () => {
    const { workflow } = setup();
    await expectCategory(workflow.withdrawCase(DEMO.cases.certificateCompleted, KEY), 'CONFLICT');
    await workflow.withdrawCase(DEMO.cases.birthInValidation, KEY);
    await expectCategory(workflow.withdrawCase(DEMO.cases.birthInValidation, KEY), 'CONFLICT');
    await expectCategory(
      workflow.selectServicePoint(DEMO.cases.birthInValidation, POINT, KEY),
      'CONFLICT',
    );
  });
});

describe('staff queues', () => {
  it('lists the queue names', async () => {
    const { workflow } = setup();
    expect(await workflow.listQueues()).toEqual([
      'Identity documents',
      'Passports',
      'Civic registration',
      'Specialist review',
    ]);
  });

  it('lists open cases, longest-waiting first, and can filter them', async () => {
    const { workflow } = setup();
    const all = await workflow.listQueue();
    expect(all.map((subject) => subject.caseId)).toEqual([
      DEMO.cases.passportAbroadScheduled,
      DEMO.cases.passportInProduction,
      DEMO.cases.birthInValidation,
      DEMO.cases.smartIdActionRequired,
    ]);
    expect(all.some((subject) => subject.status === 'CLOSED')).toBe(false);

    expect(
      (await workflow.listQueue({ queue: 'Passports' })).map((subject) => subject.caseId),
    ).toEqual([DEMO.cases.passportAbroadScheduled, DEMO.cases.passportInProduction]);
    expect(
      (await workflow.listQueue({ status: 'IN_VALIDATION' })).map((subject) => subject.caseId),
    ).toEqual([DEMO.cases.birthInValidation]);
    expect(await workflow.listQueue({ queue: 'Passports', status: 'IN_VALIDATION' })).toEqual([]);
    expect(await workflow.listQueue({ status: 'CLOSED' })).toEqual([]);
  });
});

describe('storage', () => {
  it('keeps cases and history for a new service instance on the same platform', async () => {
    const { platform, workflow } = setup();
    const { caseId } = await toProcessing(workflow);
    const again = createWorkflowService(platform, { catalogue });
    expect(await again.getCase(caseId)).toEqual(await workflow.getCase(caseId));
    expect(await again.listCaseEvents(caseId)).toEqual(await workflow.listCaseEvents(caseId));
    expect(await again.listCases(thandi)).toHaveLength(4);
  });
});
