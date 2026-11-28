import type { Metadata } from 'next';
import { SavedTickets } from '@/components/content/SavedTickets';
import styles from '@/components/content/content.module.css';
import { Phone } from '@/components/ui/icons';
import { site } from '@/content/site';
import { weeklyHoursSummary } from '@/lib/hours';
import { pageMeta } from '@/lib/seo';

export const metadata: Metadata = pageMeta({
  title: 'You’re Offline',
  description: 'Soweto Towers works offline for tickets you have already opened.',
  path: '/offline',
  noindex: true,
});

/** Served by the service worker when there is no connection. No data fetching. */
export default function OfflinePage() {
  return (
    <section className="section" aria-labelledby="offline-title">
      <div className="container--narrow">
        <div className="card card--dark" style={{ gap: 16 }}>
          <p className="eyebrow">No connection</p>
          <h1 id="offline-title" className="h1">
            You’re offline.
          </h1>
          <p className="lede">
            The towers are still standing. As soon as your signal is back, this page will work again. Meanwhile, tickets you have opened on this phone still
            open.
          </p>
          <h2 className="h4">Your saved tickets</h2>
          <SavedTickets />
        </div>
        <div className={`grid grid--2 ${styles.mt}`}>
          <div className="card">
            <h2 className="h4">Opening hours</h2>
            <ul role="list" className={styles.checks}>
              {weeklyHoursSummary().map((h) => (
                <li key={h.label}>
                  <strong>{h.label}:</strong>&nbsp;{h.value}
                </li>
              ))}
            </ul>
          </div>
          <div className="card">
            <h2 className="h4">Need us now?</h2>
            <p className="muted">Calls work without data.</p>
            <a href={`tel:${site.phone.e164}`} className="btn btn--dark">
              <Phone width={18} height={18} /> {site.phone.display}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
