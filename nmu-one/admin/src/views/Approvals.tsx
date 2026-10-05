'use client';

import Link from 'next/link';
import { Badge, Card, Empty, PageHeader, ReadOnlyNote } from '@/components/ui';
import { estimateReach, fmt } from '@/lib/audience';
import { when } from '@/lib/format';
import { CATEGORY_LABELS, PRIORITY } from '@/lib/labels';
import { allows, canApprove } from '@/lib/operators';
import { approveArticle, currentOperator, setEventStatus, useConsole } from '@/lib/store';

export function Approvals() {
  const data = useConsole();
  const op = currentOperator(data);
  const approver = allows(op, 'approve');
  const campaigns = data.campaigns.filter((c) => c.status === 'pending-approval');
  const events = data.events.filter((e) => e.status === 'pending-approval');
  const articles = data.articles.filter((a) => a.status === 'in-review');
  const name = (id: string) => data.operators.find((o) => o.id === id)?.name ?? id;

  return (
    <>
      <PageHeader
        eyebrow="Communicate"
        title="Approvals"
        description="One queue for everything that needs a second pair of eyes before people see it. Nobody approves their own work."
      />
      {!approver ? (
        <div style={{ marginBottom: 16 }}>
          <ReadOnlyNote>
            You can see the queue, but approving needs the Approver or Platform administrator role.
          </ReadOnlyNote>
        </div>
      ) : null}
      <div className="stack">
        <Card title={`Notifications (${campaigns.length})`}>
          {campaigns.length === 0 ? (
            <Empty title="No notifications waiting">New submissions appear here.</Empty>
          ) : (
            <ul className="list">
              {campaigns.map((c) => {
                const segment = data.segments.find((s) => s.id === c.segmentId);
                const check = canApprove(op, c);
                return (
                  <li key={c.id} className="spread">
                    <div className="stack-sm" style={{ minWidth: 0 }}>
                      <Link className="cell-title" href={`/notifications/view/?id=${c.id}`}>
                        {c.title}
                      </Link>
                      <span className="small muted">
                        {CATEGORY_LABELS[c.category]} · {segment?.name} (~
                        {segment ? fmt(estimateReach(segment)) : 0}) ·{' '}
                        {c.sendAt ? `send ${when(c.sendAt)}` : 'send on approval'} · by{' '}
                        {name(c.authorId)}
                      </span>
                    </div>
                    <div className="row">
                      <Badge tone={PRIORITY[c.priority].tone} plain>
                        {PRIORITY[c.priority].label}
                      </Badge>
                      {approver ? (
                        check.ok ? (
                          <Link
                            className="btn small primary"
                            href={`/notifications/view/?id=${c.id}`}
                          >
                            Review
                          </Link>
                        ) : (
                          <span className="small muted">{check.reason}</span>
                        )
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card title={`Events (${events.length})`}>
          {events.length === 0 ? (
            <Empty title="No events waiting" />
          ) : (
            <ul className="list">
              {events.map((e) => (
                <li key={e.id} className="spread">
                  <div className="stack-sm">
                    <span className="cell-title">{e.title}</span>
                    <span className="small muted">
                      {when(e.start)} · {e.venue} · {fmt(e.capacity)} places · {e.organiser}
                    </span>
                  </div>
                  {approver ? (
                    <div className="row">
                      <button
                        type="button"
                        className="btn small"
                        onClick={() => setEventStatus(e.id, 'cancelled')}
                      >
                        Decline
                      </button>
                      <button
                        type="button"
                        className="btn small primary"
                        onClick={() => setEventStatus(e.id, 'published')}
                      >
                        Publish
                      </button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card
          title={`Help articles (${articles.length})`}
          description="The assistant only answers from approved articles. Each needs its owner’s sign-off."
        >
          {articles.length === 0 ? (
            <Empty title="No articles waiting" />
          ) : (
            <ul className="list">
              {articles.map((a) => (
                <li key={a.id} className="spread">
                  <div className="stack-sm">
                    <span className="cell-title">{a.title}</span>
                    <span className="small muted">Owner: {a.owner}</span>
                  </div>
                  {approver ? (
                    <div className="row">
                      <Link className="btn small" href="/content/">
                        Read
                      </Link>
                      <button
                        type="button"
                        className="btn small primary"
                        onClick={() => approveArticle(a.id)}
                      >
                        Approve
                      </button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
