import {
  can,
  FAN_REPORT_REASON_COPY,
  nextModerationStatus,
  type ModerationAction,
} from '@kc-one/contracts';
import { DemoBanner, first, Notice, PageHead } from '@/components/ui';
import { requirePermission } from '@/lib/dal';
import { listQueue } from '@/lib/store';
import { moderateAction } from '../../actions';

const STATUS_CLASS = {
  pending_review: 'tag warn',
  escalated: 'tag danger',
  approved: 'tag ok',
  rejected: 'tag',
  hidden: 'tag',
  removed_by_user: 'tag',
} as const;

const ACTION_LABEL: Record<ModerationAction, string> = {
  approve: 'Approve',
  reject: 'Reject',
  hide: 'Hide',
  escalate: 'Escalate',
  restore: 'Restore',
};

export default async function Moderation({ searchParams }: PageProps<'/moderation'>) {
  const actor = await requirePermission('moderation.read');
  const sp = await searchParams;
  const queue = listQueue(actor);
  const canAct = can(actor.role, 'moderation.act');
  const canEscalate = can(actor.role, 'moderation.escalate');
  return (
    <>
      <PageHead eyebrow="Fan Moments" lead="Review," accent="then publish." />
      <Notice notice={first(sp.notice)} tone={first(sp.tone)} />
      <DemoBanner>
        Sample submissions with concept images. Every decision needs a reason and is written to the
        audit log.
      </DemoBanner>
      <section className="queue" aria-label="Moderation queue">
        {queue.map((q) => {
          const actions = (Object.keys(ACTION_LABEL) as ModerationAction[]).filter(
            (a) =>
              nextModerationStatus(q.status, a) && (canAct || (a === 'escalate' && canEscalate)),
          );
          return (
            <article key={q.id} className="card" style={{ display: 'grid', gap: 12 }}>
              <img src={`/demo/${q.imageKey}.jpg`} alt={`Submitted moment: ${q.caption}`} />
              <div className="row">
                <span className={STATUS_CLASS[q.status]}>{q.status.replace(/_/g, ' ')}</span>
                <span className="tag demo">Demo</span>
                {q.showsMinors ? <span className="tag danger">Shows children</span> : null}
              </div>
              <div>
                <strong>{q.caption}</strong>
                <div className="micro">
                  {q.author} · {new Date(q.submittedAt).toLocaleString('en-ZA')}
                </div>
              </div>
              {q.statusReason ? <div className="muted">Last decision: {q.statusReason}</div> : null}
              {q.reports.length ? (
                <div>
                  <div className="micro">Reports</div>
                  {q.reports.map((r, i) => (
                    <div key={i} className="muted">
                      {FAN_REPORT_REASON_COPY[r.reason]}
                    </div>
                  ))}
                </div>
              ) : null}
              {actions.length ? (
                <form action={moderateAction} className="stack">
                  <input type="hidden" name="id" value={q.id} />
                  <label>
                    Reason (recorded)
                    <input name="reason" required placeholder="e.g. Meets the community rules" />
                  </label>
                  <div className="row">
                    {actions.map((a) => (
                      <button
                        key={a}
                        type="submit"
                        name="action"
                        value={a}
                        className={
                          a === 'approve' || a === 'restore'
                            ? 'primary'
                            : a === 'reject'
                              ? 'danger'
                              : ''
                        }
                      >
                        {ACTION_LABEL[a]}
                      </button>
                    ))}
                  </div>
                </form>
              ) : (
                <div className="micro">No actions available for your role</div>
              )}
            </article>
          );
        })}
      </section>
    </>
  );
}
