/**
 * Message content and delivery records.
 *
 * The secure inbox is the only place a detailed notice is written. Every other
 * channel gets an approved template with a masked reference, and the delivery
 * record for it never holds the case reference itself (brief §8).
 */
import {
  type CaseEventType,
  DEMO,
  type InboxMessage,
  type MessageEvent,
  type NextAction,
} from '@hao/api-contracts';
import { type Channel, maskReference, STATUS_INFO, type StatusFamily } from '@hao/shared-types';

export const TEMPLATE_KEYS = {
  statusChanged: 'application_status_changed_v1',
  actionRequired: 'action_required_v1',
  paymentReceived: 'payment_received_v1',
  newSignIn: 'new_sign_in_v1',
  serviceNotice: 'service_notice_v1',
} as const;

export const NOTES = {
  switchedOff: 'You have switched this channel off.',
  whatsAppNotOptedIn: 'You had not opted in to WhatsApp updates when this was sent.',
  whatsAppFailed: 'WhatsApp could not deliver this update. Sent on your other channels instead.',
} as const;

export function caseHref(caseId: string): string {
  return `/applications/case/?id=${caseId}`;
}

const ACTION_LABELS: Record<NextAction['type'], string> = {
  SELECT_SERVICE_POINT: 'Choose a service point',
  BOOK_APPOINTMENT: 'Book an appointment',
  PROVIDE_INFORMATION: 'Send the information',
  ATTEND_APPOINTMENT: 'View your appointment',
  COLLECT: 'View collection details',
};

function sentence(text: string): string {
  const trimmed = text.trim();
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

/** What the notification service needs to know about one case event. */
export interface CaseNotice {
  recipientToken: string;
  caseId: string;
  serviceTitle: string;
  eventType: CaseEventType;
  /** Status family after the event. */
  status: StatusFamily;
  title: string;
  detail: string | null;
  /** The step the person must take, when the event left the case waiting for them. */
  nextAction: NextAction | null;
}

export function isActionRequired(notice: CaseNotice): boolean {
  return notice.status === 'ACTION_REQUIRED';
}

/** The template every channel uses for this notice. */
export function templateKeyFor(notice: CaseNotice): string {
  return isActionRequired(notice) ? TEMPLATE_KEYS.actionRequired : TEMPLATE_KEYS.statusChanged;
}

function categoryFor(notice: CaseNotice): InboxMessage['category'] {
  if (isActionRequired(notice)) return 'ACTION_REQUIRED';
  if (notice.eventType === 'APPOINTMENT_BOOKED' || notice.eventType === 'APPOINTMENT_CHANGED') {
    return 'APPOINTMENT';
  }
  return 'CASE_UPDATE';
}

/**
 * The secure-inbox message for a case event: what it is about, what changed,
 * and what happens next. Wording comes from the event and the status rules, so
 * it never says more than the workflow has recorded.
 */
export function caseMessage(
  notice: CaseNotice,
  stamp: { messageId: string; sentAt: string; readAt?: string | null },
): InboxMessage {
  const action = isActionRequired(notice) ? notice.nextAction : null;
  const rule = STATUS_INFO[notice.status].rule;
  const paragraphs = [
    `This is about your application “${notice.serviceTitle}”, reference ${notice.caseId}.`,
    notice.detail === null ? null : sentence(notice.detail),
    action ? `${rule} What to do next: ${sentence(action.description)}` : rule,
  ];
  return {
    messageId: stamp.messageId,
    recipientToken: notice.recipientToken,
    caseId: notice.caseId,
    category: categoryFor(notice),
    subject: notice.title,
    // An event's detail is often the status rule itself; say it once.
    body: paragraphs.filter(
      (paragraph, index): paragraph is string =>
        paragraph !== null && paragraphs.indexOf(paragraph) === index,
    ),
    sentAt: stamp.sentAt,
    readAt: stamp.readAt ?? null,
    action: {
      label: action ? ACTION_LABELS[action.type] : 'View application',
      href: caseHref(notice.caseId),
    },
    templateKey: templateKeyFor(notice),
    contentVersion: DEMO.contentVersion,
  };
}

export type DeliveryOutcome = Pick<MessageEvent, 'consentState' | 'deliveryStatus' | 'note'>;

export const OUTCOMES = {
  inbox: { consentState: 'NOT_REQUIRED', deliveryStatus: 'DELIVERED', note: null },
  delivered: { consentState: 'CONSENTED', deliveryStatus: 'DELIVERED', note: null },
  read: { consentState: 'CONSENTED', deliveryStatus: 'READ', note: null },
  switchedOff: {
    consentState: 'NOT_CONSENTED',
    deliveryStatus: 'SUPPRESSED',
    note: NOTES.switchedOff,
  },
  whatsAppNotOptedIn: {
    consentState: 'NOT_CONSENTED',
    deliveryStatus: 'SUPPRESSED',
    note: NOTES.whatsAppNotOptedIn,
  },
  whatsAppFailed: {
    consentState: 'CONSENTED',
    deliveryStatus: 'FAILED',
    note: NOTES.whatsAppFailed,
  },
} as const satisfies Record<string, DeliveryOutcome>;

/**
 * One delivery record. Only the secure inbox, which sits behind sign-in, keeps
 * the case reference; every external channel keeps the masked reference alone.
 */
export function deliveryRecord(
  notice: Pick<CaseNotice, 'recipientToken' | 'caseId'> & { templateKey: string },
  channel: Channel,
  outcome: DeliveryOutcome,
  stamp: { eventId: string; at: string },
): MessageEvent {
  return {
    eventId: stamp.eventId,
    channel,
    templateKey: notice.templateKey,
    recipientToken: notice.recipientToken,
    caseId: channel === 'SECURE_INBOX' ? notice.caseId : null,
    maskedReference: maskReference(notice.caseId),
    ...outcome,
    at: stamp.at,
    contentVersion: DEMO.contentVersion,
  };
}
