import { formatMoment } from '@/lib/booking/dates';
import { COLLABORATION_TYPES } from '@/lib/booking/types';
import { getStore } from '@/lib/store';
import styles from '../../admin.module.css';

/** Collaboration proposals and community signups (with the consent wording each person agreed to). */
export default async function InboxPage() {
  const store = getStore();
  const [proposals, signups, totalSignups] = await Promise.all([
    store.list('collaboration_requests', { orderBy: { field: 'createdAt', dir: 'desc' }, limit: 100 }),
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
      </header>

      <section className={styles.panel} aria-labelledby="proposals-title">
        <h2 id="proposals-title">Collaboration proposals ({proposals.length})</h2>
        {proposals.length === 0 ? (
          <p className={styles.small}>None yet. They arrive from /collaborate.</p>
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
