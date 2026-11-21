/**
 * The staff console's "assistive summary".
 *
 * A pure function over the case and its events: fixed rules, no model, no
 * scoring and no recommendation. It restates what is already on the record so
 * an official can orient quickly — and it never says what the outcome should
 * be. The official checks the facts and records any decision themselves.
 */
import type { ApplicationCase, CaseEvent, NextAction } from '@hao/api-contracts';
import { STATUS_INFO } from '@hao/shared-types';
import { formatDateTime } from '@/lib/format';

const ACTOR: Record<CaseEvent['actor'], string> = {
  SYSTEM: 'the system',
  APPLICANT: 'the applicant',
  STAFF: 'an official',
};

const WAITING_FOR: Record<NextAction['type'], string> = {
  SELECT_SERVICE_POINT: 'choose a service point',
  BOOK_APPOINTMENT: 'book an appointment',
  PROVIDE_INFORMATION: 'send the information that was requested',
  ATTEND_APPOINTMENT: 'attend the appointment',
  COLLECT: 'collect the document',
};

const OUTCOME: Record<NonNullable<ApplicationCase['decision']>['outcome'], string> = {
  APPROVED: 'approved',
  DECLINED: 'declined',
  REFERRED: 'referred for review',
};

const times = (count: number) => (count === 1 ? 'once' : `${count} times`);

/** Two to four plain sentences, always in the same order for the same record. */
export function summariseCase(item: ApplicationCase, events: readonly CaseEvent[]): string[] {
  const sentences: string[] = [];
  const ordered = [...events].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  const latest = ordered[ordered.length - 1];

  sentences.push(
    `This ${item.serviceTitle} application was received on ${formatDateTime(item.submittedAt)} and has ${
      ordered.length === 1 ? '1 recorded event' : `${ordered.length} recorded events`
    }.`,
  );

  const status =
    item.statusDetail === STATUS_INFO[item.status].userLabel
      ? `“${item.statusDetail}”`
      : `“${item.statusDetail}” (${STATUS_INFO[item.status].userLabel})`;
  sentences.push(
    latest
      ? `Its status is ${status}. The latest event, “${latest.title}”, was recorded by ${ACTOR[latest.actor]} on ${formatDateTime(latest.at)}.`
      : `Its status is ${status}, last updated on ${formatDateTime(item.statusUpdatedAt)}.`,
  );

  const requested = ordered.filter((event) => event.type === 'INFORMATION_REQUESTED').length;
  const received = ordered.filter((event) => event.type === 'INFORMATION_RECEIVED').length;
  const referred = ordered.some((event) => event.type === 'REFERRED_TO_SPECIALIST');
  if (requested > 0 || referred) {
    const parts: string[] = [];
    if (requested > 0) {
      parts.push(
        `the applicant has been asked for something ${times(requested)} and ${
          received === 0 ? 'has not replied yet' : `has replied ${times(received)}`
        }`,
      );
    }
    if (referred) parts.push('the application has been passed to a specialist team');
    const joined = parts.join(', and ');
    sentences.push(`${joined.charAt(0).toUpperCase()}${joined.slice(1)}.`);
  }

  if (item.decision) {
    sentences.push(
      `An official (${item.decision.decidedByRef}) recorded a decision on ${formatDateTime(
        item.decision.decidedAt,
      )}: ${OUTCOME[item.decision.outcome]}.`,
    );
  } else if (item.nextAction) {
    sentences.push(`It is waiting for the applicant to ${WAITING_FOR[item.nextAction.type]}.`);
  } else {
    sentences.push('No step by the applicant is outstanding, and no decision has been recorded.');
  }

  return sentences.slice(0, 4);
}
