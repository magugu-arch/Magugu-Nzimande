'use client';

import type { ApplicationCase, CaseEvent } from '@hao/api-contracts';
import {
  Card,
  Container,
  DescriptionList,
  EmptyState,
  LinkButton,
  PageHeader,
  Section,
  Split,
  Stack,
  Tag,
  Timeline,
  UnavailableState,
} from '@hao/design-system';
import { Sparkles } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import type { ReactNode } from 'react';
import { Photo } from '@/components/Photo';
import { QueryBoundary } from '@/components/QueryBoundary';
import { StatusTag } from '@/components/StatusTag';
import { formatDateTime, formatRelative } from '@/lib/format';
import { useFlags } from '@/lib/prefs';
import { useGatewayQuery } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { useConsoleQuery } from '../console-data';
import consoleStyles from '../console.module.css';
import { DataTable } from '../DataTable';
import { AUDIT_COLUMNS, EVENT_ACTOR_WORDS, Ref } from '../words';
import { CaseActions } from './CaseActions';
import styles from './case.module.css';
import { summariseCase } from './summarise-case';

const CASE_ID = /^CASE-DEMO-\d{6}$/;
const QUEUE = { href: '/staff/queue/', label: 'Work queue' };

const DECISION_WORDS: Record<NonNullable<ApplicationCase['decision']>['outcome'], string> = {
  APPROVED: 'Approved',
  DECLINED: 'Declined',
  REFERRED: 'Referred for review',
};

export function CaseScreen() {
  const id = useSearchParams().get('id') ?? '';

  if (!CASE_ID.test(id)) {
    return (
      <Container width="narrow">
        <PageHeader back={QUEUE} eyebrow="Staff console" title="Case review" />
        <UnavailableState
          title="This link does not point to an application"
          reason="A case review opens from a case reference, and this address does not carry a valid one."
          whatNext="Open the work queue and choose an application from the list."
          actions={<LinkButton href={QUEUE.href}>Open the work queue</LinkButton>}
        />
      </Container>
    );
  }
  // Keyed on the reference, so moving to another case starts every form afresh.
  return <CaseReview key={id} caseId={id} />;
}

function CaseReview({ caseId }: { caseId: string }) {
  const { session } = useSession();
  const { flags } = useFlags();
  const item = useConsoleQuery(['case', caseId], (g) => g.workflow.getCase(caseId));
  const events = useConsoleQuery(['case-events', caseId], (g) => g.workflow.listCaseEvents(caseId));
  // The audit trail is not itself audited, so it can follow every change.
  const audit = useGatewayQuery(['audit', 'case', caseId], (g) =>
    g.audit.list({ resourceRef: caseId }),
  );

  return (
    <Container>
      <div className={consoleStyles.headerRow}>
        <PageHeader
          back={QUEUE}
          eyebrow={item.data?.serviceTitle ?? 'Case review'}
          title={caseId}
        />
        <div className={consoleStyles.headerPhoto}>
          <Photo asset="A47" ratio="16 / 9" sizes="20rem" decorative />
        </div>
      </div>

      <QueryBoundary query={item} loadingLabel="Loading the case" loadingRows={5}>
        {(current) => (
          <Stack gap={7}>
            <Split aside="27rem" gap={6}>
              <Stack gap={6}>
                <Section title="Summary" id="summary">
                  <Card>
                    <DescriptionList items={summaryItems(current)} />
                  </Card>
                </Section>

                <Section title="Progress" id="progress">
                  <Card>
                    <Timeline
                      label="Progress of this application"
                      items={current.milestones.map((milestone) => ({
                        key: milestone.key,
                        label: milestone.label,
                        state: milestone.state,
                        meta: milestone.at ? formatDateTime(milestone.at) : undefined,
                      }))}
                    />
                  </Card>
                </Section>

                <Section
                  title="Events"
                  id="events"
                  intro="Newest first, in the words the applicant sees. Requests and replies are not copied into events."
                >
                  <QueryBoundary
                    query={events}
                    loadingLabel="Loading the case events"
                    headingLevel={3}
                    isEmpty={(list) => list.length === 0}
                    empty={
                      <EmptyState title="No events recorded yet" headingLevel={3}>
                        <p>Events appear here as the application moves through the workflow.</p>
                      </EmptyState>
                    }
                  >
                    {(list) => (
                      <Card>
                        <EventList events={list} />
                      </Card>
                    )}
                  </QueryBoundary>
                </Section>
              </Stack>

              <Stack gap={6}>
                {flags.aiGuide && events.data ? (
                  <Section title="Assistive summary" id="assistive-summary">
                    <Card tone="sunken">
                      <Stack gap={3}>
                        <p className={styles.assistLabel}>
                          <Sparkles aria-hidden="true" />
                          <span>
                            Assistive summary — generated from the case events. It is not a
                            decision. Check the facts yourself.
                          </span>
                        </p>
                        <ul className={styles.assistList}>
                          {summariseCase(current, events.data).map((sentence) => (
                            <li key={sentence}>{sentence}</li>
                          ))}
                        </ul>
                        <p className={consoleStyles.note}>
                          Built by fixed rules from the record on this page. No model is used and
                          no outcome is suggested.
                        </p>
                      </Stack>
                    </Card>
                  </Section>
                ) : null}

                <Section
                  title="Actions"
                  id="actions"
                  intro="Each action is recorded against your staff reference and shown in the audit trail."
                >
                  {session ? (
                    <CaseActions item={current} staffRef={session.subjectRef} />
                  ) : null}
                </Section>
              </Stack>
            </Split>

            <Section
              title="Audit trail for this case"
              id="case-audit"
              intro="Newest first. Viewing this case was itself recorded."
            >
              <QueryBoundary
                query={audit}
                loadingLabel="Loading the audit trail"
                headingLevel={3}
                isEmpty={(list) => list.length === 0}
                empty={
                  <EmptyState title="No audit events for this case yet" headingLevel={3}>
                    <p>
                      Opening and changing this case is recorded here. If you have only just opened
                      it, the first entry appears in a moment.
                    </p>
                  </EmptyState>
                }
              >
                {(list) => (
                  <DataTable
                    caption={
                      <>
                        Who opened or changed <Ref>{caseId}</Ref>, when and with what result.
                        Opaque references only.
                      </>
                    }
                    columns={[
                      AUDIT_COLUMNS.time,
                      AUDIT_COLUMNS.who,
                      AUDIT_COLUMNS.action,
                      AUDIT_COLUMNS.outcome,
                      AUDIT_COLUMNS.correlation,
                    ]}
                    rows={list}
                    rowKey={(event) => event.auditId}
                  />
                )}
              </QueryBoundary>
            </Section>
          </Stack>
        )}
      </QueryBoundary>
    </Container>
  );
}

function summaryItems(item: ApplicationCase): Array<{ term: ReactNode; description: ReactNode }> {
  const rows: Array<{ term: ReactNode; description: ReactNode }> = [
    {
      term: 'Status',
      description: <StatusTag status={item.status} detail={item.statusDetail} />,
    },
    { term: 'Queue', description: item.assignedQueue },
    { term: 'Submitted', description: formatDateTime(item.submittedAt) },
    {
      term: 'Last update',
      description: `${formatDateTime(item.statusUpdatedAt)} (${formatRelative(item.statusUpdatedAt)})`,
    },
    {
      term: 'Applicant',
      description: (
        <>
          <Ref>{item.applicantToken}</Ref>
          <span className={consoleStyles.note} style={{ display: 'block', fontWeight: 400 }}>
            The console shows the minimum needed for this task.
          </span>
        </>
      ),
    },
    {
      term: 'Acting for someone else',
      description: item.onBehalfOfLinkId ? 'Yes — through a linked profile' : 'No',
    },
  ];
  if (item.servicePointId) {
    rows.push({ term: 'Service point', description: <Ref>{item.servicePointId}</Ref> });
  }
  if (item.appointmentId) {
    rows.push({ term: 'Appointment', description: <Ref>{item.appointmentId}</Ref> });
  }
  if (item.paymentRef) {
    rows.push({ term: 'Payment reference', description: <Ref>{item.paymentRef}</Ref> });
  }
  if (item.decision) {
    rows.push(
      {
        term: 'Decision',
        description: (
          <>
            {DECISION_WORDS[item.decision.outcome]} — {item.decision.reasonCategory}
            <span className={consoleStyles.note} style={{ display: 'block', fontWeight: 400 }}>
              Recorded by <Ref>{item.decision.decidedByRef}</Ref> on{' '}
              {formatDateTime(item.decision.decidedAt)}.
            </span>
          </>
        ),
      },
      {
        term: 'Review route',
        description: <span style={{ fontWeight: 400 }}>{item.decision.reviewRoute}</span>,
      },
    );
  }
  rows.push({
    term: 'Handling',
    description: (
      <Tag tone="neutral">
        {item.dataClassification.charAt(0)}
        {item.dataClassification.slice(1).toLowerCase()}
      </Tag>
    ),
  });
  return rows;
}

function EventList({ events }: { events: CaseEvent[] }) {
  // The service returns events oldest first; the console reads newest first.
  const newestFirst = [...events].reverse();
  return (
    <ol className={styles.events} reversed>
      {newestFirst.map((event) => (
        <li key={event.eventId} className={styles.event}>
          <p className={styles.eventTitle}>{event.title}</p>
          {event.detail ? <p className={styles.eventDetail}>{event.detail}</p> : null}
          <p className={styles.eventMeta}>
            <time dateTime={event.at}>{formatDateTime(event.at)}</time> ·{' '}
            {EVENT_ACTOR_WORDS[event.actor]}
          </p>
        </li>
      ))}
    </ol>
  );
}
