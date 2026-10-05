'use client';

import { useState } from 'react';
import { Badge, Card, Empty, FilterTabs, PageHeader, ReadOnlyNote } from '@/components/ui';
import { when } from '@/lib/format';
import { allows } from '@/lib/operators';
import { currentOperator, moderate, useConsole } from '@/lib/store';
import type { ModerationItem } from '@/lib/types';

const KIND: Record<ModerationItem['kind'], string> = {
  'event-listing': 'Event listing',
  'marketplace-listing': 'Marketplace listing',
  'society-notice': 'Society notice',
};

export function Moderation() {
  const data = useConsole();
  const op = currentOperator(data);
  const can = allows(op, 'moderate');
  const [filter, setFilter] = useState<ModerationItem['status']>('open');
  const items = data.moderation.filter((m) => m.status === filter);

  return (
    <>
      <PageHeader
        eyebrow="Trust"
        title="Moderation"
        description="Community content that people have reported. Decide on each report; the decision and who made it go to the audit log."
      />
      {!can ? <ReadOnlyNote>Your role can see reports but not act on them.</ReadOnlyNote> : null}
      <FilterTabs<ModerationItem['status']>
        label="Filter reports"
        value={filter}
        onChange={setFilter}
        options={(['open', 'kept', 'removed'] as const).map((s) => ({
          id: s,
          label: s === 'open' ? 'Open' : s === 'kept' ? 'Kept' : 'Removed',
          count: data.moderation.filter((m) => m.status === s).length,
        }))}
      />
      {items.length === 0 ? (
        <Empty title={filter === 'open' ? 'No open reports' : 'Nothing here'}>
          {filter === 'open'
            ? 'Every report has a decision. New reports appear here.'
            : 'Decided reports appear here.'}
        </Empty>
      ) : (
        <div className="grid-2">
          {items.map((m) => (
            <Card key={m.id} title={m.title} description={`${KIND[m.kind]} · ${m.submittedBy}`}>
              <div className="stack">
                <blockquote
                  style={{ margin: 0, paddingLeft: 12, borderLeft: '3px solid var(--border)' }}
                >
                  {m.excerpt}
                </blockquote>
                <div className="row">
                  <Badge tone="warning">{m.reason}</Badge>
                  <span className="small muted">{when(m.reportedAt)}</span>
                </div>
                {can && m.status === 'open' ? (
                  <div className="row">
                    <button
                      type="button"
                      className="btn small"
                      onClick={() => moderate(m.id, 'kept')}
                    >
                      Keep<span className="visually-hidden"> “{m.title}”</span>
                    </button>
                    <button
                      type="button"
                      className="btn small danger"
                      onClick={() => moderate(m.id, 'removed')}
                    >
                      Remove<span className="visually-hidden"> “{m.title}”</span>
                    </button>
                  </div>
                ) : null}
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
