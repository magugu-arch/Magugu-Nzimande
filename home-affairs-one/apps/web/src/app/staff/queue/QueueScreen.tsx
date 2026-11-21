'use client';

import type { ApplicationCase, QueueFilter } from '@hao/api-contracts';
import {
  AppLink,
  Button,
  Container,
  EmptyState,
  LinkButton,
  PageHeader,
  Select,
  Stack,
  Tag,
} from '@hao/design-system';
import { STATUS_FAMILIES, STATUS_INFO, type StatusFamily } from '@hao/shared-types';
import { useState } from 'react';
import { QueryBoundary } from '@/components/QueryBoundary';
import { StatusTag } from '@/components/StatusTag';
import { formatDateTime, formatRelative } from '@/lib/format';
import { useConsoleQuery } from '../console-data';
import styles from '../console.module.css';
import { DataTable, type Column } from '../DataTable';
import { useStaffMember } from '../StaffShell';
import { caseHref, Ref } from '../words';

/** Closed applications leave the queue, and a draft has not been submitted, so neither is offered. */
const QUEUE_STATUSES = STATUS_FAMILIES.filter(
  (status) => status !== 'DRAFT' && status !== 'CLOSED',
);

const isQueueStatus = (value: string): value is StatusFamily =>
  (QUEUE_STATUSES as readonly string[]).includes(value);

/** Workflow descriptions come with or without a full stop; show them as a sentence. */
function sentence(text: string): string {
  const trimmed = text.trim();
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

export function QueueScreen() {
  const [queue, setQueue] = useState('');
  const [status, setStatus] = useState('');
  const { member } = useStaffMember();

  const queues = useConsoleQuery(['queues'], (g) => g.workflow.listQueues());
  const cases = useConsoleQuery(['queue', queue, status], (g) => {
    const filter: QueueFilter = {};
    if (queue) filter.queue = queue;
    if (isQueueStatus(status)) filter.status = status;
    return g.workflow.listQueue(filter);
  });

  const filtered = queue !== '' || status !== '';
  const clear = () => {
    setQueue('');
    setStatus('');
  };

  const columns: Array<Column<ApplicationCase>> = [
    {
      header: 'Reference',
      rowHeader: true,
      cell: (item) => (
        <AppLink href={caseHref(item.caseId)}>
          <Ref>{item.caseId}</Ref>
        </AppLink>
      ),
    },
    { header: 'Service', cell: (item) => item.serviceTitle },
    {
      header: 'Status',
      cell: (item) => <StatusTag status={item.status} detail={item.statusDetail} />,
    },
    {
      header: 'Waiting since',
      cell: (item) => (
        <time dateTime={item.statusUpdatedAt} title={formatDateTime(item.statusUpdatedAt)}>
          {formatRelative(item.statusUpdatedAt)}
        </time>
      ),
    },
    {
      header: 'Queue',
      cell: (item) => (
        <>
          {item.assignedQueue}
          {member && !member.queues.includes(item.assignedQueue) ? (
            <Tag tone="neutral">Other team</Tag>
          ) : null}
        </>
      ),
    },
    {
      header: 'Next step',
      cell: (item) => (item.nextAction ? sentence(item.nextAction.description) : 'With us'),
    },
  ];

  return (
    <Container>
      <PageHeader
        eyebrow="Staff console"
        title="Work queue"
        lede="Open applications, longest-waiting first. Closed applications are not listed."
      />
      <Stack gap={5}>
        <div className={styles.filters}>
          <Select
            label="Queue"
            value={queue}
            onChange={(event) => setQueue(event.target.value)}
            options={[
              { value: '', label: 'All queues' },
              ...(queues.data ?? []).map((name) => ({ value: name, label: name })),
            ]}
          />
          <Select
            label="Status"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            options={[
              { value: '', label: 'All statuses' },
              ...QUEUE_STATUSES.map((family) => ({
                value: family,
                label: STATUS_INFO[family].userLabel,
              })),
            ]}
          />
        </div>

        <QueryBoundary
          query={cases}
          loadingLabel="Loading the work queue"
          loadingRows={4}
          isEmpty={(items) => items.length === 0}
          empty={
            <EmptyState
              title="Nothing waiting in this queue"
              actions={
                filtered ? (
                  <Button variant="secondary" onClick={clear}>
                    Show all queues and statuses
                  </Button>
                ) : (
                  <LinkButton href="/staff/dashboard/" variant="secondary">
                    Open the dashboard
                  </LinkButton>
                )
              }
            >
              <p>
                {filtered
                  ? 'No open application matches the queue and status you chose.'
                  : 'There are no open applications in the sample data on this device.'}
              </p>
            </EmptyState>
          }
        >
          {(items) => (
            <Stack gap={3}>
              <p className={styles.count} aria-live="polite">
                {items.length === 1 ? '1 open application' : `${items.length} open applications`}
                {filtered ? ' match your filters' : ''}
              </p>
              <DataTable
                caption={
                  <>
                    Open applications, longest-waiting first. Status and next step are shown in the
                    words the applicant sees. “With us” means no step by the applicant is
                    outstanding.
                  </>
                }
                columns={columns}
                rows={items}
                rowKey={(item) => item.caseId}
              />
              {member ? (
                <p className={styles.note}>
                  “Other team” marks a queue you are not assigned to. In this prototype you can
                  still open those applications; a real console would enforce access by role and
                  purpose.
                </p>
              ) : null}
            </Stack>
          )}
        </QueryBoundary>
      </Stack>
    </Container>
  );
}
