import Link from 'next/link';
import { addDays, formatDay, formatMoment, todayIso } from '@/lib/booking/dates';
import { STATUS_META } from '@/lib/booking/status';
import { getStore } from '@/lib/store';
import styles from '../admin.module.css';

export default async function Dashboard() {
  const store = getStore();
  const today = todayIso();
  const [counts, awaitingDeposit, confirmed, upcoming, activity, recent] = await Promise.all([
    Promise.all((['NEW', 'IN_REVIEW', 'QUOTE_SENT', 'ON_HOLD'] as const).map((s) => store.count('bookings', { where: { status: s } }))),
    store.count('bookings', { where: { status: 'AWAITING_DEPOSIT' } }),
    store.list('bookings', { where: { status: 'CONFIRMED' } }),
    store.list('events', { range: { field: 'date', from: today, to: addDays(today, 60) }, orderBy: { field: 'date', dir: 'asc' }, limit: 12 }),
    store.list('audit_log', { orderBy: { field: 'createdAt', dir: 'desc' }, limit: 15 }),
    store.list('bookings', { orderBy: { field: 'createdAt', dir: 'desc' }, limit: 6 }),
  ]);
  const [fresh, review, quotes, holds] = counts;

  // Outstanding: confirmed bookings whose balance has not been paid.
  const balancesDue = (
    await Promise.all(
      confirmed.map(async (b) => {
        const paid = await store.count('payments', { where: { bookingId: b.id, kind: 'balance', status: 'complete' } });
        const quote = (await store.list('quotes', { where: { bookingId: b.id, status: 'accepted' } }))[0];
        return paid === 0 && (quote?.balanceCents ?? 0) > 0 ? 1 : 0;
      }),
    )
  ).reduce<number>((a, b) => a + b, 0);

  const bookingsByEvent = new Map((await store.list('bookings', { in: { field: 'eventId', values: upcoming.map((e) => e.id) } })).map((b) => [b.eventId, b]));

  const tiles = [
    { label: 'New enquiries', value: fresh, href: '/admin/bookings?status=NEW' },
    { label: 'In review', value: review, href: '/admin/bookings?status=IN_REVIEW' },
    { label: 'Pending quotes', value: quotes, href: '/admin/bookings?status=QUOTE_SENT' },
    { label: 'Holds', value: holds, href: '/admin/bookings?status=ON_HOLD' },
    { label: 'Awaiting deposit', value: awaitingDeposit, href: '/admin/bookings?status=AWAITING_DEPOSIT' },
    { label: 'Confirmed', value: confirmed.length, href: '/admin/bookings?status=CONFIRMED' },
    { label: 'Balances outstanding', value: balancesDue, href: '/admin/bookings?status=CONFIRMED' },
  ];

  return (
    <>
      <header className={styles.pageHead}>
        <div>
          <p className="eyebrow eyebrow-accent">Dashboard</p>
          <h1>Today, {formatDay(today)}</h1>
        </div>
        <Link href="/admin/calendar" className={styles.small}>
          Open calendar →
        </Link>
      </header>

      <div className={styles.tiles}>
        {tiles.map((t) => (
          <Link key={t.label} href={t.href} className={styles.tile}>
            <span className={styles.tileValue}>{t.value}</span>
            <span className={styles.tileLabel}>{t.label}</span>
          </Link>
        ))}
      </div>

      <div className={styles.grid2}>
        <section className={styles.panel} aria-labelledby="upcoming-title">
          <h2 id="upcoming-title">Upcoming events · 60 days</h2>
          {upcoming.length === 0 ? (
            <p className={styles.small}>Nothing in the next 60 days.</p>
          ) : (
            <ul role="list" className={styles.feed}>
              {upcoming.map((e) => {
                const b = bookingsByEvent.get(e.id);
                return (
                  <li key={e.id}>
                    <span>
                      <strong>{formatDay(e.date)}</strong> · {e.title}
                    </span>
                    <span className={styles.meta}>
                      {e.kind === 'public' ? (e.published ? 'Public show' : 'Public show (draft)') : b ? <Link href={`/admin/bookings/${b.id}`}>{b.reference} · {STATUS_META[b.status].label}</Link> : 'Private'} · {e.venue}, {e.city}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className={styles.panel} aria-labelledby="activity-title">
          <h2 id="activity-title">Recent activity</h2>
          {activity.length === 0 ? (
            <p className={styles.small}>No activity yet. New booking requests appear here.</p>
          ) : (
            <ul role="list" className={styles.feed}>
              {activity.map((a) => (
                <li key={a.id}>
                  <span>
                    {a.action.replace(/_/g, ' ')}
                    {a.bookingId && (
                      <>
                        {' '}
                        · <Link href={`/admin/bookings/${a.bookingId}`}>open</Link>
                      </>
                    )}
                  </span>
                  <span className={styles.meta}>
                    {a.actor} · {formatMoment(a.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className={styles.panel} aria-labelledby="recent-title">
        <h2 id="recent-title">Latest requests</h2>
        {recent.length === 0 ? (
          <p className={styles.small}>No booking requests yet. They arrive from /book/request.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Status</th>
                  <th>Received</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <Link href={`/admin/bookings/${b.id}`}>{b.reference}</Link>
                    </td>
                    <td>
                      <span className={styles.badge} data-status={b.status}>
                        {STATUS_META[b.status].label}
                      </span>
                    </td>
                    <td>{formatMoment(b.createdAt)}</td>
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
