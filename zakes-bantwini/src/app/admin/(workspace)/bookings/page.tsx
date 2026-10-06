import Link from 'next/link';
import { formatDay, formatMoment } from '@/lib/booking/dates';
import { STATUS_META } from '@/lib/booking/status';
import { BOOKING_STATUSES, EVENT_TYPES, type BookingStatus } from '@/lib/booking/types';
import { getStore } from '@/lib/store';
import styles from '../../admin.module.css';

export default async function BookingsPage(props: PageProps<'/admin/bookings'>) {
  const { status } = await props.searchParams;
  const active = BOOKING_STATUSES.find((s) => s === status) as BookingStatus | undefined;
  const store = getStore();
  const bookings = await store.list('bookings', { ...(active ? { where: { status: active } } : {}), orderBy: { field: 'createdAt', dir: 'desc' }, limit: 200 });
  const [customers, events] = await Promise.all([
    store.list('customers', { in: { field: 'id', values: bookings.map((b) => b.customerId) } }),
    store.list('events', { in: { field: 'id', values: bookings.map((b) => b.eventId) } }),
  ]);
  const customer = new Map(customers.map((c) => [c.id, c]));
  const event = new Map(events.map((e) => [e.id, e]));

  return (
    <>
      <header className={styles.pageHead}>
        <div>
          <p className="eyebrow eyebrow-accent">Bookings</p>
          <h1>{active ? STATUS_META[active].label : 'All bookings'}</h1>
        </div>
        <span className={styles.small}>{bookings.length} shown</span>
      </header>
      <nav className={styles.filters} aria-label="Filter by status">
        <Link href="/admin/bookings" aria-current={!active ? 'page' : undefined}>
          All
        </Link>
        {BOOKING_STATUSES.map((s) => (
          <Link key={s} href={`/admin/bookings?status=${s}`} aria-current={active === s ? 'page' : undefined}>
            {STATUS_META[s].label}
          </Link>
        ))}
      </nav>
      {bookings.length === 0 ? (
        <section className={styles.panel}>
          <p>No bookings {active ? `with status “${STATUS_META[active].label}”` : 'yet'}.</p>
        </section>
      ) : (
        <div className={`${styles.panel} ${styles.tableWrap}`}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Reference</th>
                <th scope="col">Client</th>
                <th scope="col">Event date</th>
                <th scope="col">Type</th>
                <th scope="col">Status</th>
                <th scope="col">Received</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => {
                const c = customer.get(b.customerId);
                const e = event.get(b.eventId);
                return (
                  <tr key={b.id}>
                    <td>
                      <Link href={`/admin/bookings/${b.id}`}>{b.reference}</Link>
                    </td>
                    <td>
                      {c?.fullName}
                      {c?.organisation && <div className={styles.small}>{c.organisation}</div>}
                    </td>
                    <td>
                      {e ? formatDay(e.date) : '—'}
                      {e && <div className={styles.small}>{e.city}</div>}
                    </td>
                    <td>{EVENT_TYPES.find((t) => t.key === b.eventType)?.label}</td>
                    <td>
                      <span className={styles.badge} data-status={b.status}>
                        {STATUS_META[b.status].label}
                      </span>
                    </td>
                    <td className={styles.small}>{formatMoment(b.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
