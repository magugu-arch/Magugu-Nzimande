'use client';

import type { SupportRequest } from '@hao/api-contracts';
import {
  Card,
  Container,
  DescriptionList,
  EmptyState,
  Grid,
  LinkButton,
  Notice,
  PageHeader,
  Stack,
  Tag,
} from '@hao/design-system';
import { QueryBoundary } from '@/components/QueryBoundary';
import { formatDateTime } from '@/lib/format';
import { useConsoleQuery } from '../console-data';
import styles from '../console.module.css';
import { Ref, SUPPORT_CHANNEL_WORDS, SUPPORT_KIND_WORDS, SUPPORT_STATUS_WORDS } from '../words';

function SupportCard({ request }: { request: SupportRequest }) {
  const shared = request.sharedContext;
  const headingId = `support-${request.requestId}`;
  return (
    <Card as="article" aria-labelledby={headingId}>
      <Stack gap={3}>
        <div className={styles.cell}>
          <Tag tone="brand">{SUPPORT_KIND_WORDS[request.kind]}</Tag>
          <Tag tone={request.status === 'RECEIVED' ? 'attention' : 'info'}>
            {SUPPORT_STATUS_WORDS[request.status]}
          </Tag>
        </div>
        <h2 id={headingId} style={{ fontSize: 'var(--text-lg)' }}>
          <Ref>{request.requestId}</Ref>
        </h2>
        <DescriptionList
          items={[
            { term: 'Topic', description: request.topic },
            { term: 'Created', description: formatDateTime(request.createdAt) },
            { term: 'Preferred time', description: request.preferredTime ?? 'No preference given' },
            { term: 'Reply by', description: SUPPORT_CHANNEL_WORDS[request.contactChannel] },
            {
              term: 'Context the person agreed to share',
              description:
                shared.consented && (shared.caseToken || shared.summary) ? (
                  <>
                    {shared.caseToken ? <Ref>{shared.caseToken}</Ref> : null}
                    {shared.summary ? (
                      <span style={{ display: 'block', fontWeight: 400 }}>{shared.summary}</span>
                    ) : null}
                  </>
                ) : (
                  'None shared'
                ),
            },
          ]}
        />
      </Stack>
    </Card>
  );
}

export function SupportScreen() {
  const requests = useConsoleQuery(['support-open'], (g) => g.support.listOpenRequests());

  return (
    <Container>
      <PageHeader
        eyebrow="Staff console"
        title="Support requests"
        lede="Open call-back requests, complaints and feedback, newest first."
      />
      <Stack gap={5}>
        <Notice tone="neutral" title="You see only what the person agreed to share">
          <p>
            An adviser gets a masked application reference and a one-line summary, and only with the
            person’s agreement. Names, contact details and the person’s own message are not shown
            here.
          </p>
        </Notice>
        <QueryBoundary
          query={requests}
          loadingLabel="Loading support requests"
          isEmpty={(list) => list.length === 0}
          empty={
            <EmptyState
              title="No open support requests"
              actions={
                <LinkButton href="/staff/queue/" variant="secondary">
                  Open the work queue
                </LinkButton>
              }
            >
              <p>New call-back requests, complaints and feedback appear here as they arrive.</p>
            </EmptyState>
          }
        >
          {(list) => (
            <Stack gap={3}>
              <p className={styles.count}>
                {list.length === 1 ? '1 open request' : `${list.length} open requests`}
              </p>
              <Grid min="22rem" gap={4}>
                {list.map((request) => (
                  <SupportCard key={request.requestId} request={request} />
                ))}
              </Grid>
            </Stack>
          )}
        </QueryBoundary>
      </Stack>
    </Container>
  );
}
