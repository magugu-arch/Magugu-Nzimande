import Link from 'next/link';
import { ActionForm } from '@/components/admin/AdminForms';
import { Select, TextField } from '@/components/forms/fields';
import { requireAdmin } from '@/lib/auth/admin';
import { addDays, formatDayLong, formatMonth, isIsoDate, monthGrid, todayIso } from '@/lib/booking/dates';
import { STATUS_META } from '@/lib/booking/status';
import { AVAILABILITY_STATES, type AvailabilityEntry, type Booking, type EventRecord } from '@/lib/booking/types';
import { getStore } from '@/lib/store';
import { setAvailabilityAction } from '../../actions';
import styles from '../../admin.module.css';

type View = 'month' | 'week' | 'day';
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function weekStart(d: string) {
  const dow = (new Date(`${d}T00:00:00Z`).getUTCDay() + 6) % 7;
  return addDays(d, -dow);
}

function shiftMonth(d: string, delta: number) {
  const y = Number(d.slice(0, 4));
  const m = Number(d.slice(5, 7)) - 1 + delta;
  const date = new Date(Date.UTC(y, m, 1));
  return date.toISOString().slice(0, 10);
}

/** Month / week / day calendar with secure date blocking (brief §10 ADMIN DASHBOARD). */
export default async function CalendarPage(props: PageProps<'/admin/calendar'>) {
  const admin = await requireAdmin();
  const q = await props.searchParams;
  const view: View = q.view === 'week' || q.view === 'day' ? q.view : 'month';
  const date = typeof q.date === 'string' && isIsoDate(q.date) ? q.date : todayIso();

  let days: string[];
  let title: string;
  let prev: string;
  let next: string;
  if (view === 'month') {
    const grid = monthGrid(Number(date.slice(0, 4)), Number(date.slice(5, 7)));
    days = grid.flat();
    title = formatMonth(date);
    prev = shiftMonth(date, -1);
    next = shiftMonth(date, 1);
  } else if (view === 'week') {
    const start = weekStart(date);
    days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
    title = `Week of ${formatDayLong(start)}`;
    prev = addDays(start, -7);
    next = addDays(start, 7);
  } else {
    days = [date];
    title = formatDayLong(date);
    prev = addDays(date, -1);
    next = addDays(date, 1);
  }

  const store = getStore();
  const from = days[0]!;
  const to = days[days.length - 1]!;
  const [availability, events] = await Promise.all([
    store.list('availability', { range: { field: 'date', from, to } }),
    store.list('events', { range: { field: 'date', from, to }, orderBy: { field: 'date', dir: 'asc' } }),
  ]);
  const bookings = await store.list('bookings', { in: { field: 'eventId', values: events.map((e) => e.id) } });
  const byDate = new Map<string, AvailabilityEntry>(availability.map((a) => [a.date, a]));
  const eventsOn = (d: string) => events.filter((e) => e.date === d);
  const bookingFor = new Map<string, Booking>(bookings.map((b) => [b.eventId, b]));
  const month = date.slice(5, 7);

  const item = (e: EventRecord) => {
    const b = bookingFor.get(e.id);
    if (b) return { href: `/admin/bookings/${b.id}`, text: `${b.reference} · ${STATUS_META[b.status].label}` };
    return { href: '/admin/events', text: `${e.published ? 'Show' : 'Draft show'} · ${e.title}` };
  };

  const link = (v: View, d: string) => `/admin/calendar?view=${v}&date=${d}`;

  return (
    <>
      <header className={styles.pageHead}>
        <div>
          <p className="eyebrow eyebrow-accent">Calendar</p>
          <h1>{title}</h1>
        </div>
        <nav className={styles.filters} aria-label="Calendar view">
          {(['month', 'week', 'day'] as const).map((v) => (
            <Link key={v} href={link(v, date)} aria-current={view === v ? 'page' : undefined}>
              {v[0]!.toUpperCase() + v.slice(1)}
            </Link>
          ))}
        </nav>
      </header>

      <div className={styles.calHead}>
        <div className={styles.filters}>
          <Link href={link(view, prev)}>← Previous</Link>
          <Link href={link(view, todayIso())}>Today</Link>
          <Link href={link(view, next)}>Next →</Link>
        </div>
        <p className={styles.small}>
          Holds and confirmations follow booking status automatically. Block travel days and unavailable dates in the day view. The public calendar shows only
          “available”, “limited” or “unavailable”.
        </p>
      </div>

      {view === 'month' && (
        <table className={styles.month}>
          <thead>
            <tr>
              {WEEKDAYS.map((w) => (
                <th key={w} scope="col">
                  {w}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: days.length / 7 }, (_, w) => days.slice(w * 7, w * 7 + 7)).map((week) => (
              <tr key={week[0]}>
                {week.map((d) => {
                  const a = byDate.get(d);
                  return (
                    <td key={d}>
                      <Link href={link('day', d)} className={`${styles.dayCell} ${d.slice(5, 7) !== month ? styles.outside : ''}`} aria-label={`${formatDayLong(d)}${a ? `, ${a.state}` : ''}`}>
                        <span className={styles.dayNum} style={d === todayIso() ? { color: 'var(--bronze)', fontWeight: 700 } : undefined}>
                          {Number(d.slice(8))}
                        </span>
                        {a && (
                          <span className={styles.state} data-state={a.state}>
                            {a.state.replace('_', ' ')}
                          </span>
                        )}
                        {eventsOn(d).map((e) => (
                          <span key={e.id} className={styles.chip}>
                            {item(e).text}
                          </span>
                        ))}
                      </Link>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {view === 'week' && (
        <div className={styles.week}>
          {days.map((d, i) => {
            const a = byDate.get(d);
            return (
              <div key={d}>
                <Link href={link('day', d)} className={styles.dayNum}>
                  {WEEKDAYS[i]} {Number(d.slice(8))}
                </Link>
                {a && (
                  <span className={styles.state} data-state={a.state}>
                    {a.state.replace('_', ' ')}
                  </span>
                )}
                {a?.note && <span className={styles.small}>{a.note}</span>}
                {eventsOn(d).map((e) => (
                  <Link key={e.id} href={item(e).href} className={styles.small}>
                    {item(e).text}
                    <br />
                    {e.startTime ?? ''} {e.venue}, {e.city}
                  </Link>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {view === 'day' && (
        <div className={styles.grid2}>
          <section className={styles.panel} aria-labelledby="day-title">
            <h2 id="day-title">On this day</h2>
            {byDate.get(date) ? (
              <p>
                <span className={styles.state} data-state={byDate.get(date)!.state}>
                  {byDate.get(date)!.state.replace('_', ' ')}
                </span>{' '}
                {byDate.get(date)!.note} <span className={styles.small}>— set by {byDate.get(date)!.updatedBy}</span>
              </p>
            ) : (
              <p>Available.</p>
            )}
            <ul role="list" className={styles.feed}>
              {eventsOn(date).map((e) => (
                <li key={e.id}>
                  <Link href={item(e).href}>{item(e).text}</Link>
                  <span className={styles.meta}>
                    {e.startTime ?? 'Time TBC'} · {e.venue}, {e.city}
                  </span>
                </li>
              ))}
            </ul>
          </section>
          <section className={styles.panel} aria-labelledby="block-title">
            <h2 id="block-title">Set availability</h2>
            {admin.role === 'viewer' ? (
              <p className={styles.small}>Read-only role.</p>
            ) : (
              <ActionForm action={setAvailabilityAction} submit="Save" className={styles.panel}>
                <input type="hidden" name="date" value={date} />
                <Select
                  name="state"
                  label="State"
                  options={AVAILABILITY_STATES.filter((s) => s !== 'CONFIRMED').map((s) => ({ key: s, label: s === 'AVAILABLE' ? 'Available (clear)' : s.replace('_', ' ').toLowerCase() }))}
                  defaultValue={byDate.get(date)?.bookingId ? undefined : byDate.get(date)?.state}
                />
                <TextField name="note" label="Internal note" optional hint="Never shown publicly." />
              </ActionForm>
            )}
            <p className={styles.small}>Dates held or confirmed by a booking are changed from that booking, so the calendar and the booking can never disagree.</p>
          </section>
        </div>
      )}
    </>
  );
}
