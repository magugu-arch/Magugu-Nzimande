'use client';

import type { ApplicationCase } from '@hao/api-contracts';
import type { NetworkMode } from '@hao/local-platform';
import {
  AppLink,
  Card,
  Container,
  EmptyState,
  Grid,
  LinkButton,
  PageHeader,
  SampleNotice,
  Section,
  Stack,
  Tag,
} from '@hao/design-system';
import { STATUS_FAMILIES, STATUS_INFO } from '@hao/shared-types';
import { Photo } from '@/components/Photo';
import { QueryBoundary } from '@/components/QueryBoundary';
import { StatusTag } from '@/components/StatusTag';
import { formatDateTime, formatRelative } from '@/lib/format';
import { useNetworkMode } from '@/lib/queries';
import { useConsoleQuery } from '../console-data';
import styles from '../console.module.css';
import { caseHref, Ref } from '../words';

const NETWORK_WORDS: Record<NetworkMode, { label: string; tone: 'success' | 'attention' }> = {
  normal: { label: 'normal', tone: 'success' },
  slow: { label: 'slow', tone: 'attention' },
  offline: { label: 'offline', tone: 'attention' },
  error: { label: 'service errors', tone: 'attention' },
};

interface BarRow {
  label: string;
  count: number;
}

/** Label, number as text, and a bar whose width is the share. Readable without the bars. */
function BarList({ rows, total, of }: { rows: BarRow[]; total: number; of: string }) {
  return (
    <ul className={styles.bars}>
      {rows.map((row) => (
        <li key={row.label} className={styles.barRow}>
          <span className={styles.barLabel}>{row.label}</span>
          <span className={styles.barValue}>
            {row.count}
            <span className="visually-hidden">
              {' '}
              of {total} {of}
            </span>
          </span>
          <span className={styles.barTrack} aria-hidden="true">
            <span
              className={styles.barFill}
              style={{ width: total > 0 ? `${(row.count / total) * 100}%` : '0%' }}
            />
          </span>
        </li>
      ))}
    </ul>
  );
}

function countBy(items: ApplicationCase[], pick: (item: ApplicationCase) => string) {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(pick(item), (counts.get(pick(item)) ?? 0) + 1);
  return counts;
}

export function DashboardScreen() {
  const cases = useConsoleQuery(['queue', '', ''], (g) => g.workflow.listQueue());
  const queues = useConsoleQuery(['queues'], (g) => g.workflow.listQueues());
  const support = useConsoleQuery(['support-open'], (g) => g.support.listOpenRequests());
  const [network] = useNetworkMode();

  return (
    <Container>
      <div className={styles.headerRow}>
        <PageHeader
          eyebrow="Staff console"
          title="Service dashboard"
          lede="A count of the open work, by status and by queue."
        >
          <SampleNotice>
            Figures are counted from the sample cases on this device. They are not performance data.
          </SampleNotice>
        </PageHeader>
        <div className={styles.headerPhoto}>
          <Photo asset="A45" ratio="3 / 2" sizes="20rem" decorative />
        </div>
      </div>

      <Stack gap={7}>
        <QueryBoundary query={cases} loadingLabel="Loading the dashboard" loadingRows={5}>
          {(items) => {
            const byStatus = countBy(items, (item) => item.status);
            const byQueue = countBy(items, (item) => item.assignedQueue);
            const queueNames = [...new Set([...(queues.data ?? []), ...byQueue.keys()])];
            // The queue comes longest-waiting first; sort again so this never depends on that.
            const longest = [...items]
              .sort((a, b) => Date.parse(a.statusUpdatedAt) - Date.parse(b.statusUpdatedAt))
              .slice(0, 5);

            return (
              <Stack gap={7}>
                <Section title="Open work" id="open-work">
                  <dl className={styles.tiles}>
                    <div className={styles.tile}>
                      <dt>Open cases</dt>
                      <dd>{items.length}</dd>
                    </div>
                    <div className={styles.tile}>
                      <dt>Waiting on the applicant</dt>
                      <dd>{byStatus.get('ACTION_REQUIRED') ?? 0}</dd>
                    </div>
                    <div className={styles.tile}>
                      <dt>Awaiting a decision</dt>
                      <dd>{byStatus.get('PROCESSING') ?? 0}</dd>
                    </div>
                    <div className={styles.tile}>
                      <dt>Open support requests</dt>
                      <dd>
                        {support.data ? (
                          support.data.length
                        ) : (
                          <span className={styles.note} style={{ fontFamily: 'var(--font-body)' }}>
                            {support.isError ? 'Not available' : '…'}
                          </span>
                        )}
                      </dd>
                    </div>
                  </dl>
                </Section>

                <Grid min="20rem" gap={6}>
                  <Section title="Cases by status" id="by-status">
                    <Card>
                      {items.length === 0 ? (
                        <p className={styles.note}>There are no open cases to count.</p>
                      ) : (
                        <BarList
                          total={items.length}
                          of="open cases"
                          rows={STATUS_FAMILIES.filter((status) => byStatus.has(status)).map(
                            (status) => ({
                              label: STATUS_INFO[status].userLabel,
                              count: byStatus.get(status) ?? 0,
                            }),
                          )}
                        />
                      )}
                    </Card>
                  </Section>
                  <Section title="Cases by queue" id="by-queue">
                    <Card>
                      <BarList
                        total={items.length}
                        of="open cases"
                        rows={queueNames.map((name) => ({
                          label: name,
                          count: byQueue.get(name) ?? 0,
                        }))}
                      />
                    </Card>
                  </Section>
                </Grid>

                <Section
                  title="Longest waiting"
                  id="longest-waiting"
                  intro="The five open cases whose status has gone longest without a change."
                  action={{ href: '/staff/queue/', label: 'Open the work queue' }}
                >
                  {longest.length === 0 ? (
                    <EmptyState
                      title="Nothing is waiting"
                      headingLevel={3}
                      actions={
                        <LinkButton href="/staff/queue/" variant="secondary">
                          Open the work queue
                        </LinkButton>
                      }
                    >
                      <p>There are no open cases in the sample data on this device.</p>
                    </EmptyState>
                  ) : (
                    <ol className={styles.plainList}>
                      {longest.map((item) => (
                        <li key={item.caseId}>
                          <Card padding="compact">
                            <Stack gap={2}>
                              <p>
                                <AppLink href={caseHref(item.caseId)}>
                                  <Ref>{item.caseId}</Ref>
                                </AppLink>{' '}
                                · {item.serviceTitle}
                              </p>
                              <div className={styles.cell}>
                                <StatusTag status={item.status} detail={item.statusDetail} />
                                <span className={styles.note}>
                                  {item.assignedQueue} · last change{' '}
                                  <time
                                    dateTime={item.statusUpdatedAt}
                                    title={formatDateTime(item.statusUpdatedAt)}
                                  >
                                    {formatRelative(item.statusUpdatedAt)}
                                  </time>
                                </span>
                              </div>
                            </Stack>
                          </Card>
                        </li>
                      ))}
                    </ol>
                  )}
                </Section>
              </Stack>
            );
          }}
        </QueryBoundary>

        <Grid min="20rem" gap={6}>
          <Section title="Service levels" id="service-levels">
            <Card tone="sunken">
              <p>
                Not shown. Service-level targets need baseline operational data and agreement with
                service owners.
              </p>
            </Card>
          </Section>
          <Section title="Service health" id="service-health">
            <Card>
              <Stack gap={3}>
                <p className={styles.cell}>
                  <span>Simulated connection: {NETWORK_WORDS[network].label}</span>
                  <Tag tone={NETWORK_WORDS[network].tone}>
                    {network === 'normal' ? 'As expected' : 'Being simulated'}
                  </Tag>
                </p>
                <p className={styles.note}>
                  This is the prototype’s simulated network, not a measurement of any real system.{' '}
                  <AppLink href="/profile/prototype/">Change it in the prototype controls</AppLink>.
                </p>
              </Stack>
            </Card>
          </Section>
        </Grid>
      </Stack>
    </Container>
  );
}
