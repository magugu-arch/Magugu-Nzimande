/**
 * Which staff action the workflow accepts in which status.
 *
 * This mirrors `services/application-workflow` (`recordStaffAction` and
 * `nextRoutineStep`) so the console only offers what the workflow will take.
 * The workflow stays the authority: if it still refuses, its own message is
 * shown. Sample workflow behaviour for a prototype — not a DHA process.
 */
import type { ApplicationCase } from '@hao/api-contracts';

export type Availability = { allowed: true } | { allowed: false; reason: string };

const yes: Availability = { allowed: true };
const no = (reason: string): Availability => ({ allowed: false, reason });

const CLOSED = 'This application is closed.';

function hasInPersonStep(item: ApplicationCase): boolean {
  return item.milestones.some((milestone) => milestone.key === 'capture');
}

function isMilestoneDone(item: ApplicationCase, key: string): boolean {
  return item.milestones.some((milestone) => milestone.key === key && milestone.state === 'done');
}

/** `START_VALIDATION`: only straight after submission. */
export function canStartChecks(item: ApplicationCase): Availability {
  if (item.status === 'SUBMITTED') return yes;
  return no(item.status === 'CLOSED' ? CLOSED : 'Checks have already started on this application.');
}

/** `REQUEST_INFORMATION`: until a decision has been recorded. */
export function canRequestInformation(item: ApplicationCase): Availability {
  if (item.status === 'DECISION' || item.status === 'FULFILMENT' || item.status === 'CLOSED') {
    return no('This application is past the point where more information can be requested.');
  }
  return yes;
}

/** `ESCALATE`: any open application. */
export function canEscalate(item: ApplicationCase): Availability {
  return item.status === 'CLOSED' ? no(CLOSED) : yes;
}

/** `RECORD_DECISION`: only while the application is being processed. */
export function canRecordDecision(item: ApplicationCase): Availability {
  if (item.status === 'PROCESSING') return yes;
  return no(
    'A decision can only be recorded while an application is being processed (status “In progress”).',
  );
}

function waitingOnApplicant(item: ApplicationCase): string {
  switch (item.nextAction?.type) {
    case 'SELECT_SERVICE_POINT':
      return 'Waiting for the applicant to choose a service point.';
    case 'BOOK_APPOINTMENT':
      return 'Waiting for the applicant to book an appointment.';
    case 'PROVIDE_INFORMATION':
      return 'Waiting for the applicant to send the information we asked for.';
    default:
      return 'Waiting for the applicant to complete the step shown on the application.';
  }
}

export type RoutineStep = { allowed: true; preview: string } | { allowed: false; reason: string };

const step = (preview: string): RoutineStep => ({ allowed: true, preview });
const blocked = (reason: string): RoutineStep => ({ allowed: false, reason });

/**
 * `ADVANCE`: the next routine step, in words, or why there is none. It can move
 * an application along but never records a decision.
 */
export function nextRoutineStep(item: ApplicationCase): RoutineStep {
  switch (item.status) {
    case 'SUBMITTED':
      return step('Start identity and evidence checks.');
    case 'IN_VALIDATION': {
      const inPersonStepAhead = hasInPersonStep(item) && !isMilestoneDone(item, 'capture');
      if (!inPersonStepAhead) return step('Finish the checks and start processing.');
      if (item.servicePointId === null) {
        return step('Finish the checks and ask the applicant to choose a service point.');
      }
      if (item.appointmentId === null) {
        return step('Finish the checks and ask the applicant to book an appointment.');
      }
      return step('Finish the checks and confirm the appointment already on the application.');
    }
    case 'ACTION_REQUIRED':
      return blocked(waitingOnApplicant(item));
    case 'SCHEDULED':
      return step('Record that the in-person step is complete and start processing.');
    case 'PROCESSING':
      return blocked(
        'The next step is a decision, which an official records below. Moving an application on never decides.',
      );
    case 'DECISION':
      if (item.decision?.outcome !== 'APPROVED') {
        return blocked('This application has a recorded decision.');
      }
      return step(
        hasInPersonStep(item)
          ? 'Start document production.'
          : 'Deliver the outcome to the secure inbox and close the application.',
      );
    case 'FULFILMENT':
      return step(
        item.nextAction?.type === 'COLLECT'
          ? 'Record that the document was collected and close the application.'
          : 'Mark the document as ready for collection.',
      );
    case 'CLOSED':
      return blocked(CLOSED);
    case 'DRAFT':
      return blocked('This application has not been submitted yet.');
  }
}
