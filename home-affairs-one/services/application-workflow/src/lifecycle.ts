/**
 * The case lifecycle as data.
 *
 * Every state change is one `WorkflowStep`. `applyStep` is the only place a
 * case is changed: it produces the next case and the event that records it, so
 * status, next action and tracker milestones always move together. Seed data is
 * built by replaying the same steps, which keeps it honest.
 *
 * This is sample workflow behaviour for a prototype. It is not a DHA process,
 * and nothing here states a real requirement, timeframe or outcome.
 */
import {
  type ApplicationCase,
  type CaseEvent,
  type CaseEventType,
  type NextAction,
} from '@hao/api-contracts';
import { GatewayError, STATUS_INFO, type StatusFamily } from '@hao/shared-types';
import {
  ALL_DONE,
  blankMilestones,
  hasInPersonStep,
  isMilestoneDone,
  type MilestoneMove,
  milestonesAfter,
} from './milestones';

export type Actor = CaseEvent['actor'];
export type Decision = NonNullable<ApplicationCase['decision']>;
export type DecisionOutcome = Decision['outcome'];

/** One state change. Fields left out keep the value the case already has. */
export interface WorkflowStep extends MilestoneMove {
  type: CaseEventType;
  actor: Actor;
  /** A short sentence the person sees in the timeline and as the inbox subject. */
  title: string;
  detail: string | null;
  status?: StatusFamily;
  statusDetail?: string;
  nextAction?: NextAction | null;
  servicePointId?: string | null;
  appointmentId?: string | null;
  assignedQueue?: string;
  /** Only the `RECORD_DECISION` staff action ever sets this. */
  decision?: Omit<Decision, 'decidedAt'>;
}

export interface StepMeta {
  eventId: string;
  correlationId: string;
  at: string;
}

export interface StepResult {
  next: ApplicationCase;
  event: CaseEvent;
}

export function applyStep(
  current: ApplicationCase,
  step: WorkflowStep,
  meta: StepMeta,
): StepResult {
  const status = step.status ?? current.status;
  const next: ApplicationCase = {
    ...current,
    status,
    statusDetail: step.statusDetail ?? current.statusDetail,
    statusUpdatedAt: meta.at,
    nextAction: step.nextAction === undefined ? current.nextAction : step.nextAction,
    milestones: milestonesAfter(current.milestones, step, meta.at),
    servicePointId:
      step.servicePointId === undefined ? current.servicePointId : step.servicePointId,
    appointmentId: step.appointmentId === undefined ? current.appointmentId : step.appointmentId,
    assignedQueue: step.assignedQueue ?? current.assignedQueue,
    decision: step.decision ? { ...step.decision, decidedAt: meta.at } : current.decision,
  };
  const event: CaseEvent = {
    eventId: meta.eventId,
    caseId: current.caseId,
    type: step.type,
    at: meta.at,
    status,
    title: step.title,
    detail: step.detail,
    actor: step.actor,
    correlationId: meta.correlationId,
  };
  return { next, event };
}

export interface NewCase {
  caseId: string;
  serviceCode: string;
  serviceTitle: string;
  applicantToken: string;
  onBehalfOfLinkId: string | null;
  assignedQueue: string;
  servicePointId: string | null;
  appointmentId: string | null;
  paymentRef: string | null;
  /** Fixes which milestone plan the case follows for the rest of its life. */
  needsServicePoint: boolean;
}

/** Creates a case and its `SUBMITTED` event. */
export function openCase(input: NewCase, meta: StepMeta): StepResult {
  const { needsServicePoint, ...fields } = input;
  const shell: ApplicationCase = {
    ...fields,
    status: 'SUBMITTED',
    statusDetail: STATUS_INFO.SUBMITTED.userLabel,
    statusUpdatedAt: meta.at,
    submittedAt: meta.at,
    nextAction: null,
    milestones: blankMilestones(needsServicePoint),
    decision: null,
    dataClassification: 'RESTRICTED',
    sourceOfTruth: 'DHA_WORKFLOW_ADAPTER_MOCK',
  };
  return applyStep(shell, steps.submitted(), meta);
}

/* ------------------------------------------------------------------ */
/* Next actions                                                        */
/* ------------------------------------------------------------------ */

export const NEXT_ACTIONS = {
  selectServicePoint: {
    type: 'SELECT_SERVICE_POINT',
    description: 'Choose an approved service point for the next step',
    dueAt: null,
  },
  bookAppointment: {
    type: 'BOOK_APPOINTMENT',
    description: 'Book a time at your chosen service point',
    dueAt: null,
  },
  attendAppointment: {
    type: 'ATTEND_APPOINTMENT',
    description: 'Attend your appointment',
    dueAt: null,
  },
  collect: {
    type: 'COLLECT',
    description: 'Collect at your chosen service point. Bring what the official notice asks for.',
    dueAt: null,
  },
} as const satisfies Record<string, NextAction>;

/* ------------------------------------------------------------------ */
/* Steps                                                               */
/* ------------------------------------------------------------------ */

/**
 * Sample wording only. The route that really applies, and how to use it, is a
 * legal matter the official notice would set out.
 */
const REVIEW_ROUTE =
  'A review or appeal route applies where the law provides one. The official notice explains it and how to use it. This is sample wording.';

const DECISION_COPY: Record<DecisionOutcome, { statusDetail: string; detail: string }> = {
  APPROVED: {
    statusDetail: 'Approved',
    detail: 'Outcome: approved. The official notice explains it and what happens next.',
  },
  DECLINED: {
    statusDetail: 'Declined',
    detail: 'Outcome: declined. The official notice explains the reason and any review route.',
  },
  REFERRED: {
    statusDetail: 'Referred for review',
    detail:
      'Outcome: referred for review. The official notice explains what this means and what happens next.',
  },
};

/** A step that pauses the case until the person does something. */
function actionRequired(
  nextAction: NextAction,
): Pick<WorkflowStep, 'status' | 'statusDetail' | 'nextAction'> {
  return {
    status: 'ACTION_REQUIRED',
    statusDetail: STATUS_INFO.ACTION_REQUIRED.userLabel,
    nextAction,
  };
}

const scheduled = {
  status: 'SCHEDULED',
  statusDetail: STATUS_INFO.SCHEDULED.userLabel,
  nextAction: NEXT_ACTIONS.attendAppointment,
  reach: 'capture',
} as const satisfies Partial<WorkflowStep>;

export const steps = {
  submitted: (): WorkflowStep => ({
    type: 'SUBMITTED',
    actor: 'APPLICANT',
    title: 'Application received',
    detail: STATUS_INFO.SUBMITTED.rule,
    status: 'SUBMITTED',
    statusDetail: STATUS_INFO.SUBMITTED.userLabel,
    nextAction: null,
    reach: 'checks',
  }),

  validationStarted: (actor: Actor): WorkflowStep => ({
    type: 'VALIDATION_STARTED',
    actor,
    title: 'Checks started',
    detail: STATUS_INFO.IN_VALIDATION.rule,
    status: 'IN_VALIDATION',
    statusDetail: STATUS_INFO.IN_VALIDATION.userLabel,
    nextAction: null,
    reach: 'checks',
  }),

  /** Checks are finished and the in-person step is next, but nowhere has been chosen. */
  servicePointRequested: (actor: Actor): WorkflowStep => ({
    type: 'INFORMATION_REQUESTED',
    actor,
    title: 'Choose where to complete your application',
    detail: 'The next step happens in person. Choose an approved service point to continue.',
    ...actionRequired(NEXT_ACTIONS.selectServicePoint),
    reach: 'capture',
  }),

  /** Checks are finished and a service point is chosen, but no time is booked. */
  appointmentRequested: (actor: Actor): WorkflowStep => ({
    type: 'INFORMATION_REQUESTED',
    actor,
    title: 'Book your appointment',
    detail:
      'The next step happens in person at your chosen service point. Book a time to continue.',
    ...actionRequired(NEXT_ACTIONS.bookAppointment),
    reach: 'capture',
  }),

  /** Checks are finished and the appointment already on the case stands. */
  appointmentConfirmed: (actor: Actor): WorkflowStep => ({
    type: 'APPOINTMENT_BOOKED',
    actor,
    title: 'Your appointment is confirmed',
    detail: 'The next step is your in-person appointment. You can reschedule from the application.',
    ...scheduled,
  }),

  /**
   * `awaitingVisit` is true when the case is waiting for the in-person step, so
   * choosing a place leads straight to booking a time there. Earlier than that,
   * the choice is only noted.
   */
  servicePointSelected: (servicePointId: string, awaitingVisit: boolean): WorkflowStep =>
    awaitingVisit
      ? {
          type: 'SERVICE_POINT_SELECTED',
          actor: 'APPLICANT',
          title: 'Service point chosen',
          detail: 'Book a time at your chosen service point to continue.',
          ...actionRequired(NEXT_ACTIONS.bookAppointment),
          reach: 'capture',
          servicePointId,
          // A booking made for a different place no longer applies.
          appointmentId: null,
        }
      : {
          type: 'SERVICE_POINT_SELECTED',
          actor: 'APPLICANT',
          title: 'Service point chosen',
          detail:
            'We will ask you to book a time when your application reaches the in-person step.',
          servicePointId,
        },

  /** `changed` is true when the case already had an appointment. */
  appointmentLinked: (
    appointmentId: string,
    changed: boolean,
    awaitingVisit: boolean,
  ): WorkflowStep => ({
    type: changed ? 'APPOINTMENT_CHANGED' : 'APPOINTMENT_BOOKED',
    actor: 'APPLICANT',
    title: changed ? 'Appointment changed' : 'Appointment booked',
    detail: changed
      ? 'Your appointment has been updated. Check the new time and place before you go.'
      : STATUS_INFO.SCHEDULED.rule,
    appointmentId,
    ...(awaitingVisit ? scheduled : {}),
  }),

  captureCompleted: (actor: Actor): WorkflowStep => ({
    type: 'CAPTURE_COMPLETED',
    actor,
    title: 'In-person step completed',
    detail: STATUS_INFO.PROCESSING.rule,
    status: 'PROCESSING',
    statusDetail: STATUS_INFO.PROCESSING.userLabel,
    nextAction: null,
    reach: 'processing',
  }),

  processingStarted: (actor: Actor): WorkflowStep => ({
    type: 'PROCESSING_STARTED',
    actor,
    title: 'Processing started',
    detail: STATUS_INFO.PROCESSING.rule,
    status: 'PROCESSING',
    statusDetail: STATUS_INFO.PROCESSING.userLabel,
    nextAction: null,
    reach: 'processing',
  }),

  /**
   * The official's wording is shown to the applicant as the next action only.
   * It is kept out of the event, which travels on the bus and into logs.
   */
  informationRequested: (request: string): WorkflowStep => ({
    type: 'INFORMATION_REQUESTED',
    actor: 'STAFF',
    title: 'We need more information from you',
    detail: 'Open your application to see what we need. It is paused until you reply.',
    ...actionRequired({ type: 'PROVIDE_INFORMATION', description: request, dueAt: null }),
  }),

  /** The reply itself is never written to the event. */
  informationReceived: (): WorkflowStep => ({
    type: 'INFORMATION_RECEIVED',
    actor: 'APPLICANT',
    title: 'Information received',
    detail: 'You sent the information we asked for.',
    status: 'IN_VALIDATION',
    statusDetail: STATUS_INFO.IN_VALIDATION.userLabel,
    nextAction: null,
  }),

  referredToSpecialist: (): WorkflowStep => ({
    type: 'REFERRED_TO_SPECIALIST',
    actor: 'STAFF',
    title: 'Passed to a specialist team',
    detail: 'A specialist team is now looking at your application.',
    statusDetail: 'With a specialist team',
    assignedQueue: 'Specialist review',
  }),

  decisionRecorded: (
    outcome: DecisionOutcome,
    reasonCategory: string,
    staffRef: string,
    inPerson: boolean,
  ): WorkflowStep => ({
    type: 'DECISION_RECORDED',
    actor: 'STAFF',
    title: 'A decision has been recorded',
    detail: DECISION_COPY[outcome].detail,
    status: 'DECISION',
    statusDetail: DECISION_COPY[outcome].statusDetail,
    nextAction: null,
    decision: { outcome, reasonCategory, decidedByRef: staffRef, reviewRoute: REVIEW_ROUTE },
    reach: inPerson ? 'production' : 'outcome',
    // Without an approval there is nothing to produce or collect.
    stop: inPerson && outcome !== 'APPROVED',
  }),

  productionStarted: (actor: Actor): WorkflowStep => ({
    type: 'PRODUCTION_STARTED',
    actor,
    title: 'Document production started',
    detail: 'Your document is being produced. We will tell you when there is an update.',
    status: 'FULFILMENT',
    statusDetail: 'In production',
    nextAction: null,
    reach: 'production',
  }),

  readyForCollection: (actor: Actor): WorkflowStep => ({
    type: 'READY_FOR_COLLECTION',
    actor,
    title: 'Ready for collection',
    detail: NEXT_ACTIONS.collect.description,
    status: 'FULFILMENT',
    statusDetail: 'Ready for collection',
    nextAction: NEXT_ACTIONS.collect,
    reach: 'collection',
  }),

  collected: (actor: Actor): WorkflowStep => ({
    type: 'COLLECTED',
    actor,
    title: 'Document collected',
    detail: 'Your document was handed over. This application is complete.',
    status: 'CLOSED',
    statusDetail: 'Completed',
    nextAction: null,
    reach: ALL_DONE,
  }),

  /** The closing step for a service with nothing to collect in person. */
  outcomeDelivered: (actor: Actor): WorkflowStep => ({
    type: 'COLLECTED',
    actor,
    title: 'Outcome delivered to your secure inbox',
    detail: 'The official notice is in your secure inbox. This application is complete.',
    status: 'CLOSED',
    statusDetail: 'Completed',
    nextAction: null,
    reach: ALL_DONE,
  }),

  withdrawn: (): WorkflowStep => ({
    type: 'WITHDRAWN',
    actor: 'APPLICANT',
    title: 'Application withdrawn',
    detail: 'You withdrew this application. The history is kept under policy.',
    status: 'CLOSED',
    statusDetail: 'Withdrawn',
    nextAction: null,
    stop: true,
  }),
};

/* ------------------------------------------------------------------ */
/* What happens next                                                   */
/* ------------------------------------------------------------------ */

function conflict(safeMessage: string): GatewayError {
  return new GatewayError('CONFLICT', { safeMessage });
}

/** True while the case is paused for the person to choose a place or book a time. */
export function isAwaitingVisit(current: ApplicationCase): boolean {
  if (!hasInPersonStep(current.milestones) || isMilestoneDone(current.milestones, 'capture')) {
    return false;
  }
  if (current.status === 'SCHEDULED') return true;
  return current.status === 'ACTION_REQUIRED' && current.nextAction?.type !== 'PROVIDE_INFORMATION';
}

function waitingMessage(action: NextAction | null, actor: Actor): string {
  const who = actor === 'STAFF' ? 'the applicant' : 'you';
  switch (action?.type) {
    case 'SELECT_SERVICE_POINT':
      return `Waiting for ${who} to choose a service point.`;
    case 'BOOK_APPOINTMENT':
      return `Waiting for ${who} to book an appointment.`;
    case 'PROVIDE_INFORMATION':
      return `Waiting for ${who} to send the information we asked for.`;
    default:
      return `Waiting for ${who} to complete the step shown on the application.`;
  }
}

/** Where a case goes once identity and evidence checks are finished. */
function afterChecks(current: ApplicationCase, actor: Actor): WorkflowStep {
  const inPersonStepAhead =
    hasInPersonStep(current.milestones) && !isMilestoneDone(current.milestones, 'capture');
  if (!inPersonStepAhead) return steps.processingStarted(actor);
  if (current.servicePointId === null) return steps.servicePointRequested(actor);
  if (current.appointmentId === null) return steps.appointmentRequested(actor);
  return steps.appointmentConfirmed(actor);
}

/**
 * The next routine step for a case, or a `CONFLICT` when the case is waiting on
 * a person. It can move a case along, but it never records a decision: that is
 * always an explicit action by an authorised official.
 */
export function nextRoutineStep(current: ApplicationCase, actor: Actor): WorkflowStep {
  switch (current.status) {
    case 'SUBMITTED':
      return steps.validationStarted(actor);
    case 'IN_VALIDATION':
      return afterChecks(current, actor);
    case 'ACTION_REQUIRED':
      throw conflict(waitingMessage(current.nextAction, actor));
    case 'SCHEDULED':
      return steps.captureCompleted(actor);
    case 'PROCESSING':
      throw conflict(
        'A decision must be recorded by an authorised official. Automation never decides.',
      );
    case 'DECISION':
      if (current.decision?.outcome !== 'APPROVED') {
        throw conflict('This application has a recorded decision.');
      }
      return hasInPersonStep(current.milestones)
        ? steps.productionStarted(actor)
        : steps.outcomeDelivered(actor);
    case 'FULFILMENT':
      return current.nextAction?.type === 'COLLECT'
        ? steps.collected(actor)
        : steps.readyForCollection(actor);
    case 'CLOSED':
      throw conflict('This application is closed.');
    case 'DRAFT':
      throw conflict('This application has not been submitted yet.');
  }
}
