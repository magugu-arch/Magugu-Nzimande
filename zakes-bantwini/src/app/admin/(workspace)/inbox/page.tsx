import Link from 'next/link';
import { setProposalStatusAction } from '@/app/admin/actions';
import { buttonClass } from '@/components/ui/Button';
import { requireAdmin } from '@/lib/auth/admin';
import { formatMoment } from '@/lib/booking/dates';
import { COLLABORATION_TYPES, type CollaborationRequest } from '@/lib/booking/types';
import { getStore } from '@/lib/store';
import styles from '../../admin.module.css';

const TABS: { key: CollaborationRequest['status']; label: string }[] = [
  { key: 'new', label: 'New' },
  { key: 'reviewed', label: 'Reviewed' },
  { key: 'archived', label: 'Archived' },
];

/** Collaboration proposals and community signups (with the consent wording each person agreed to). */
export default async function InboxPage(props: PageProps<'/admin/inbox'>) {
  const admin = await requireAdmin();
  const canWrite = admin.role !== 'viewer';
  const { show } = await props.searchParams;
  const tab = TABS.find((t) => t.key === show)?.key ?? 'new';
  const store = getStore();
  const [proposals, counts, signups, totalSignups] = await Promise.all([
    store.list('collaboration_requests', { where: { status: tab }, orderBy: { field: 'createdAt', dir: 'desc' }, limit: 100 }),
    Promise.all(TABS.map((t) => store.count('collaboration_requests', { where: { status: t.key } }))),
    store.list('community_signups', { orderBy: { field: 'createdAt', dir: 'desc' }, limit: 50 }),
    store.count('community_signups'),
  ]);

  return (
    <>
      <header className={styles.pageHead}>
        <div>
          <p className="eyebrow eyebrow-accent">Inbox</p>
          <h1>Proposals and community</h1>
        </div>
        {canWrite && (
          <div className={styles.toolbar}>
            <a href="/admin/export/proposals" className={buttonClass('outline', true)} download>
              Export proposals
            </a>
            <a href="/admin/export/community" className={buttonClass('outline', true)} download>
              Export community (consented)
            </a>
          </div>
        )}
      </header>

      <section className={styles.panel} aria-labelledby="proposals-title">
        <h2 id="proposals-title">Collaboration proposals</h2>
        <nav className={styles.filters} aria-label="Proposal status">
          {TABS.map((t, i) => (
            <Link key={t.key} href={`/admin/inbox?show=${t.key}`} aria-current={tab === t.key ? 'page' : undefined}>
              {t.label} ({counts[i]})
            </Link>
          ))}
        </nav>
        {proposals.length === 0 ? (
          <p className={styles.small}>{tab === 'new' ? 'Nothing new. Proposals arrive from /collaborate.' : `Nothing ${tab}.`}</p>
        ) : (
          <ul role="list" className={styles.feed}>
            {proposals.map((p) => (
              <li key={p.id}>
                <span>
                  <strong>{COLLABORATION_TYPES.find((t) => t.key === p.type)?.label}</strong> — {p.name}
                  {p.organisation ? `, ${p.organisation}` : ''} · <a href={`mailto:${p.email}`}>{p.email}</a>
                </span>
                <span style={{ whiteSpace: 'pre-wrap' }}>{p.message}</span>
                <span className={styles.meta}>
                  {p.timeline ? `Timeline: ${p.timeline} · ` : ''}
                  {p.budget ? `Budget: ${p.budget} · ` : ''}
                  {formatMoment(p.createdAt)}
                </span>
                {canWrite && (
                  <div className={styles.toolbar}>
                    {TABS.filter((t) => t.key !== p.status).map((t) => (
                      <form key={t.key} action={setProposalStatusAction.bind(null, p.id, t.key)}>
                        <button type="submit" className={buttonClass('outline', true)}>
                          {t.key === 'new' ? 'Move back to new' : t.key === 'reviewed' ? 'Mark reviewed' : 'Archive'}
                        </button>
                      </form>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.panel} aria-labelledby="community-title">
        <h2 id="community-title">Community signups ({totalSignups})</h2>
        {signups.length === 0 ? (
          <p className={styles.small}>None yet. They arrive from /community.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Email</th>
                  <th>WhatsApp</th>
                  <th>Consent recorded</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody>
                {signups.map((s) => (
                  <tr key={s.id}>
                    <td>{s.emailConsent ? s.email : <span className={styles.small}>{s.email} (no email consent)</span>}</td>
                    <td>{s.whatsappConsent ? s.phone : '—'}</td>
                    <td className={styles.small}>{s.consentText}</td>
                    <td className={styles.small}>{formatMoment(s.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
