'use client';

import {
  Button,
  Container,
  EmptyState,
  Notice,
  PageHeader,
  Stack,
  TextInput,
} from '@hao/design-system';
import { useState } from 'react';
import { QueryBoundary } from '@/components/QueryBoundary';
import { useGatewayQuery } from '@/lib/queries';
import styles from '../console.module.css';
import { DataTable } from '../DataTable';
import { AUDIT_COLUMNS } from '../words';

const LIMIT = 100;

export function AuditScreen() {
  const [filter, setFilter] = useState('');
  // Reading the audit trail is not itself audited, so this can follow every change.
  const events = useGatewayQuery(['audit', 'log', LIMIT], (g) => g.audit.list({ limit: LIMIT }));
  const needle = filter.trim().toLowerCase();

  return (
    <Container>
      <PageHeader
        eyebrow="Staff console"
        title="Audit log"
        lede={`The ${LIMIT} most recent events across the service, newest first.`}
      />
      <Stack gap={5}>
        <Notice tone="neutral" title="What the audit trail holds">
          <p>
            The audit trail records who did what, to which record, when and with what result. It
            never contains names, contact details or free text.
          </p>
        </Notice>
        <div className={styles.filters}>
          <TextInput
            label="Filter by reference"
            hint="A case, person, staff or partner reference, or part of one."
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        <QueryBoundary
          query={events}
          loadingLabel="Loading the audit log"
          loadingRows={6}
          isEmpty={(list) => list.length === 0}
          empty={
            <EmptyState title="No audit events yet">
              <p>Events appear here as people use the service on this device.</p>
            </EmptyState>
          }
        >
          {(list) => {
            const shown = needle
              ? list.filter(
                  (event) =>
                    event.resource.ref.toLowerCase().includes(needle) ||
                    event.actor.ref.toLowerCase().includes(needle),
                )
              : list;
            return (
              <Stack gap={3}>
                <p className={styles.count} aria-live="polite">
                  {needle
                    ? `${shown.length} of ${list.length} events match “${filter.trim()}”`
                    : `${list.length === 1 ? '1 event' : `${list.length} events`} shown`}
                </p>
                {shown.length === 0 ? (
                  <EmptyState
                    title="No events match that reference"
                    actions={
                      <Button variant="secondary" onClick={() => setFilter('')}>
                        Clear the filter
                      </Button>
                    }
                  >
                    <p>
                      The filter looks at the record reference and the actor reference of the{' '}
                      {LIMIT} most recent events.
                    </p>
                  </EmptyState>
                ) : (
                  <DataTable
                    caption="Audit events, newest first. Actors and records are opaque references."
                    columns={[
                      AUDIT_COLUMNS.time,
                      AUDIT_COLUMNS.who,
                      AUDIT_COLUMNS.action,
                      AUDIT_COLUMNS.resource,
                      AUDIT_COLUMNS.outcome,
                      AUDIT_COLUMNS.channel,
                      AUDIT_COLUMNS.correlation,
                    ]}
                    rows={shown}
                    rowKey={(event) => event.auditId}
                  />
                )}
              </Stack>
            );
          }}
        </QueryBoundary>
      </Stack>
    </Container>
  );
}
