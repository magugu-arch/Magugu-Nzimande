import type { AuditEvent, CaseEvent, StaffMember, SupportRequest } from '@hao/api-contracts';
import { Tag } from '@hao/design-system';
import { Ban, CircleAlert, CircleCheck } from 'lucide-react';
import { formatDateTime } from '@/lib/format';
import type { Column } from './DataTable';
import styles from './console.module.css';

/** Words for the codes the staff console shows. No names: people are opaque tokens here. */

export const STAFF_ROLE_WORDS: Record<StaffMember['role'], string> = {
  CASE_OFFICER: 'Case officer',
  SUPERVISOR: 'Supervisor',
};

export const EVENT_ACTOR_WORDS: Record<CaseEvent['actor'], string> = {
  SYSTEM: 'Recorded by the system',
  APPLICANT: 'Done by the applicant',
  STAFF: 'Done by an official',
};

export const AUDIT_ROLE_WORDS: Record<AuditEvent['actor']['role'], string> = {
  citizen: 'Citizen',
  staff: 'Staff',
  partner: 'Partner',
  system: 'System',
};

export const AUDIT_CHANNEL_WORDS: Record<AuditEvent['channel'], string> = {
  WEB: 'Web',
  STAFF_CONSOLE: 'Staff console',
  PARTNER_API: 'Partner API',
  SYSTEM: 'System',
};

export const SUPPORT_KIND_WORDS: Record<SupportRequest['kind'], string> = {
  CALLBACK: 'Call-back',
  COMPLAINT: 'Complaint',
  FEEDBACK: 'Feedback',
};

export const SUPPORT_STATUS_WORDS: Record<SupportRequest['status'], string> = {
  RECEIVED: 'Received',
  IN_PROGRESS: 'In progress',
  RESOLVED: 'Resolved',
};

export const SUPPORT_CHANNEL_WORDS: Record<SupportRequest['contactChannel'], string> = {
  PHONE: 'Phone',
  EMAIL: 'Email',
  SECURE_INBOX: 'Secure inbox',
};

export const caseHref = (caseId: string) => `/staff/case/?id=${encodeURIComponent(caseId)}`;

/** An opaque reference, set in a fixed-width face so tokens are easy to compare. */
export function Ref({ children }: { children: string }) {
  return <span className={styles.mono}>{children}</span>;
}

const OUTCOME = {
  SUCCESS: { tone: 'success', label: 'Success', icon: <CircleCheck aria-hidden="true" /> },
  DENIED: { tone: 'attention', label: 'Denied', icon: <Ban aria-hidden="true" /> },
  FAILED: { tone: 'danger', label: 'Failed', icon: <CircleAlert aria-hidden="true" /> },
} as const;

/** The result of an audited action, in words with an icon — never colour alone. */
export function OutcomeTag({ outcome }: { outcome: AuditEvent['outcome'] }) {
  const info = OUTCOME[outcome];
  return (
    <Tag tone={info.tone} icon={info.icon}>
      {info.label}
    </Tag>
  );
}

/** Columns shared by the audit log and a case's own audit trail. */
export const AUDIT_COLUMNS = {
  time: { header: 'Time', cell: (event) => formatDateTime(event.at) },
  who: {
    header: 'Who',
    cell: (event) => (
      <>
        {AUDIT_ROLE_WORDS[event.actor.role]} <Ref>{event.actor.ref}</Ref>
      </>
    ),
  },
  action: { header: 'Action', cell: (event) => <Ref>{event.action}</Ref> },
  resource: {
    header: 'Resource',
    cell: (event) => (
      <>
        {event.resource.type} <Ref>{event.resource.ref}</Ref>
      </>
    ),
  },
  outcome: { header: 'Outcome', cell: (event) => <OutcomeTag outcome={event.outcome} /> },
  channel: { header: 'Channel', cell: (event) => AUDIT_CHANNEL_WORDS[event.channel] },
  correlation: {
    header: 'Correlation ID',
    cell: (event) => <Ref>{event.correlationId}</Ref>,
  },
} satisfies Record<string, Column<AuditEvent>>;
