/**
 * Sample cases and a sample draft.
 *
 * Each case is built by replaying real workflow steps at times relative to
 * "now", so its history, status, next action and milestones always agree with
 * what the live workflow would have produced. Everything is synthetic: the
 * people are demo tokens and the outcomes are invented for the prototype.
 */
import {
  type ApplicationCase,
  type ApplicationDraft,
  type CaseEvent,
  DEMO,
} from '@hao/api-contracts';
import { DAY, HOUR, MINUTE, type Platform } from '@hao/local-platform';
import {
  applyStep,
  type NewCase,
  openCase,
  type StepMeta,
  steps,
  type WorkflowStep,
} from './lifecycle';

export const DRAFT_LIFETIME = 30 * DAY;

/**
 * Which sample services have an in-person step. Seeds use this small table
 * rather than the catalogue so they do not depend on its content.
 */
const NEEDS_SERVICE_POINT: Record<string, boolean> = {
  [DEMO.services.smartIdReplacement]: true,
  [DEMO.services.smartIdFirst]: true,
  [DEMO.services.adultPassport]: true,
  [DEMO.services.birthRegistration]: true,
};

/** The guardian link the identity mock seeds for Sipho's child. */
const SIPHO_CHILD_LINK = 'LINK-DEMO-1001';

/** The approved sandbox payment the payments mock seeds for Thandi's passport application. */
const THANDI_PASSPORT_PAYMENT = 'PAY-DEMO-1001';

/** The service Sipho's part-finished draft is for. */
export const SEED_DRAFT_SERVICE = DEMO.services.adultPassport;

/** Where the seeded draft resumes when the catalogue cannot say what its second step is called. */
export const DEFAULT_RESUME_STEP = 'request';

const SAMPLE_REASON = 'Sample outcome for the prototype';

type Opening = Omit<
  NewCase,
  'needsServicePoint' | 'servicePointId' | 'appointmentId' | 'paymentRef'
> & {
  paymentRef?: string;
};

export interface WorkflowSeed {
  drafts: ApplicationDraft[];
  cases: ApplicationCase[];
  events: CaseEvent[];
}

/**
 * `resumeStepId` is the form step Sipho's draft was left on: the second step of
 * the adult passport form, as the catalogue names it.
 */
export function buildWorkflowSeed(
  platform: Platform,
  resumeStepId: string = DEFAULT_RESUME_STEP,
): WorkflowSeed {
  const now = platform.clock.now().getTime();
  const ago = (ms: number) => platform.clock.iso(new Date(now - ms));
  const meta = (ms: number): StepMeta => ({
    eventId: platform.ids.next('EVT-DEMO', 0),
    correlationId: platform.ids.next('CORR'),
    at: ago(ms),
  });

  const cases: ApplicationCase[] = [];
  const events: CaseEvent[] = [];

  /** Opens a case `submittedAgo` ago, then replays each step at its own time. */
  function play(
    opening: Opening,
    submittedAgo: number,
    script: ReadonlyArray<readonly [agoMs: number, step: WorkflowStep]>,
  ): void {
    let { next, event } = openCase(
      {
        ...opening,
        servicePointId: null,
        appointmentId: null,
        // Only a payment the payments mock really seeds is referenced.
        paymentRef: opening.paymentRef ?? null,
        needsServicePoint: NEEDS_SERVICE_POINT[opening.serviceCode] ?? false,
      },
      meta(submittedAgo),
    );
    events.push(event);
    for (const [agoMs, step] of script) {
      ({ next, event } = applyStep(next, step, meta(agoMs)));
      events.push(event);
    }
    cases.push(next);
  }

  // Thandi — Smart ID replacement, waiting for her to choose a service point (brief, Appendix B).
  play(
    {
      caseId: DEMO.cases.smartIdActionRequired,
      serviceCode: DEMO.services.smartIdReplacement,
      serviceTitle: 'Replace a Smart ID',
      applicantToken: DEMO.persons.thandi,
      onBehalfOfLinkId: null,
      assignedQueue: 'Identity documents',
    },
    3 * DAY,
    [
      [2 * DAY, steps.validationStarted('SYSTEM')],
      [40 * MINUTE, steps.servicePointRequested('SYSTEM')],
    ],
  );

  // Thandi — adult passport, in production (brief, concept screen 2).
  play(
    {
      caseId: DEMO.cases.passportInProduction,
      serviceCode: DEMO.services.adultPassport,
      serviceTitle: 'Apply for an adult passport',
      applicantToken: DEMO.persons.thandi,
      onBehalfOfLinkId: null,
      assignedQueue: 'Passports',
      paymentRef: THANDI_PASSPORT_PAYMENT,
    },
    16 * DAY,
    [
      [15 * DAY, steps.validationStarted('SYSTEM')],
      [14 * DAY, steps.servicePointRequested('SYSTEM')],
      [14 * DAY - 2 * HOUR, steps.servicePointSelected(DEMO.servicePoints.bankCentral, true)],
      // The attended appointment is not in the appointments mock, so no id is kept on the case.
      [
        14 * DAY - 2 * HOUR - 10 * MINUTE,
        { ...steps.appointmentLinked('', false, true), appointmentId: null },
      ],
      [10 * DAY, steps.captureCompleted('SYSTEM')],
      [10 * DAY - 3 * HOUR, steps.processingStarted('SYSTEM')],
      [3 * DAY, steps.decisionRecorded('APPROVED', SAMPLE_REASON, DEMO.staff.caseOfficer, true)],
      [1 * DAY, steps.productionStarted('SYSTEM')],
    ],
  );

  // Thandi — birth certificate request, completed about five months ago. No in-person step.
  play(
    {
      caseId: DEMO.cases.certificateCompleted,
      serviceCode: DEMO.services.birthCertificate,
      serviceTitle: 'Request a birth certificate',
      applicantToken: DEMO.persons.thandi,
      onBehalfOfLinkId: null,
      assignedQueue: 'Civic registration',
    },
    158 * DAY,
    [
      [157 * DAY, steps.validationStarted('SYSTEM')],
      [155 * DAY, steps.processingStarted('SYSTEM')],
      [152 * DAY, steps.decisionRecorded('APPROVED', SAMPLE_REASON, DEMO.staff.caseOfficer, false)],
      [150 * DAY, steps.outcomeDelivered('SYSTEM')],
    ],
  );

  // Sipho — birth registration for his linked child, being checked.
  play(
    {
      caseId: DEMO.cases.birthInValidation,
      serviceCode: DEMO.services.birthRegistration,
      serviceTitle: 'Register a birth',
      applicantToken: DEMO.persons.sipho,
      onBehalfOfLinkId: SIPHO_CHILD_LINK,
      assignedQueue: 'Civic registration',
    },
    1 * DAY,
    [[20 * HOUR, steps.validationStarted('SYSTEM')]],
  );

  // Lerato — adult passport through a mission abroad, appointment booked.
  play(
    {
      caseId: DEMO.cases.passportAbroadScheduled,
      serviceCode: DEMO.services.adultPassport,
      serviceTitle: 'Apply for an adult passport',
      applicantToken: DEMO.persons.lerato,
      onBehalfOfLinkId: null,
      assignedQueue: 'Passports',
    },
    6 * DAY,
    [
      [5 * DAY, steps.validationStarted('SYSTEM')],
      [4 * DAY, steps.servicePointRequested('SYSTEM')],
      [3 * DAY, steps.servicePointSelected(DEMO.servicePoints.missionEurope, true)],
      [
        3 * DAY - 15 * MINUTE,
        steps.appointmentLinked(DEMO.appointments.leratoMission, false, true),
      ],
    ],
  );

  // Sipho — a part-finished adult passport application to resume. Answers are left empty so
  // the draft does not depend on the catalogue's field ids.
  const draftCreated = now - 5 * DAY;
  const drafts: ApplicationDraft[] = [
    {
      draftId: DEMO.drafts.siphoPassport,
      serviceCode: SEED_DRAFT_SERVICE,
      applicantToken: DEMO.persons.sipho,
      onBehalfOfLinkId: null,
      answers: {},
      evidence: [],
      currentStepId: resumeStepId,
      servicePointId: null,
      appointmentId: null,
      paymentRef: null,
      createdAt: platform.clock.iso(new Date(draftCreated)),
      updatedAt: ago(2 * DAY),
      expiresAt: platform.clock.iso(new Date(draftCreated + DRAFT_LIFETIME)),
    },
  ];

  return { drafts, cases, events };
}
