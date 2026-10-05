'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Badge, Empty, FilterTabs, PageHeader, ReadOnlyNote, TableWrap } from '@/components/ui';
import { estimateReach, fmt } from '@/lib/audience';
import { when } from '@/lib/format';
import { CATEGORY_LABELS, PRIORITY, STATUS } from '@/lib/labels';
import { allows } from '@/lib/operators';
import { currentOperator, useConsole } from '@/lib/store';
import type { CampaignStatus } from '@/lib/types';

type Filter = 'all' | 'mine' | CampaignStatus;

export function NotificationsList() {
  const data = useConsole();
  const op = currentOperator(data);
  const [filter, setFilter] = useState<Filter>('all');
  const count = (f: Filter) =>
    f === 'all'
      ? data.campaigns.length
      : f === 'mine'
        ? data.campaigns.filter((c) => c.authorId === op.id).length
        : data.campaigns.filter((c) => c.status === f).length;
  const shown = data.campaigns.filter((c) =>
    filter === 'all' ? true : filter === 'mine' ? c.authorId === op.id : c.status === filter,
  );
  const name = (id: string) => data.operators.find((o) => o.id === id)?.name ?? 'System';

  return (
    <>
      <PageHeader
        eyebrow="Communicate"
        title="Notifications"
        description="Create → Approve → Schedule → Deliver → Measure. Every notice goes to an audience, leads to a screen in NMU ONE and is approved by someone other than its author."
        actions={
          <>
            {allows(op, 'send-emergency') ? (
              <Link className="btn danger" href="/notifications/emergency/">
                Send an emergency notice
              </Link>
            ) : null}
            {allows(op, 'compose') ? (
              <Link className="btn primary" href="/notifications/new/">
                New notification
              </Link>
            ) : null}
          </>
        }
      />
      {!allows(op, 'compose') ? (
        <ReadOnlyNote>Your role can read notifications but not write them.</ReadOnlyNote>
      ) : null}
      <FilterTabs<Filter>
        label="Filter notifications"
        value={filter}
        onChange={setFilter}
        options={(
          [
            ['all', 'All'],
            ['mine', 'Mine'],
            ['draft', 'Drafts'],
            ['pending-approval', 'Awaiting approval'],
            ['changes-requested', 'Changes requested'],
            ['scheduled', 'Scheduled'],
            ['sent', 'Sent'],
          ] as [Filter, string][]
        ).map(([id, label]) => ({ id, label, count: count(id) }))}
      />
      {shown.length === 0 ? (
        <Empty title="Nothing here yet">
          {filter === 'mine'
            ? 'Notifications you write will appear here.'
            : 'No notifications match this filter.'}
        </Empty>
      ) : (
        <TableWrap label="Notifications">
          <table>
            <caption className="visually-hidden">Notifications</caption>
            <thead>
              <tr>
                <th scope="col">Notification</th>
                <th scope="col">Status</th>
                <th scope="col">Audience</th>
                <th scope="col">Priority</th>
                <th scope="col">Send</th>
                <th scope="col">Author</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((c) => {
                const segment = data.segments.find((s) => s.id === c.segmentId);
                return (
                  <tr key={c.id}>
                    <td>
                      <Link className="cell-title" href={`/notifications/view/?id=${c.id}`}>
                        {c.title}
                      </Link>
                      <div className="cell-sub">{CATEGORY_LABELS[c.category]}</div>
                    </td>
                    <td>
                      <Badge tone={STATUS[c.status].tone}>{STATUS[c.status].label}</Badge>
                    </td>
                    <td>
                      {segment?.name ?? '—'}
                      {segment ? (
                        <div className="cell-sub">~{fmt(estimateReach(segment))} people</div>
                      ) : null}
                    </td>
                    <td>
                      <Badge tone={PRIORITY[c.priority].tone} plain>
                        {PRIORITY[c.priority].label}
                      </Badge>
                    </td>
                    <td className="small">
                      {c.sentAt
                        ? `Sent ${when(c.sentAt)}`
                        : c.sendAt
                          ? when(c.sendAt)
                          : 'On approval'}
                    </td>
                    <td className="small">{name(c.authorId)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableWrap>
      )}
    </>
  );
}
