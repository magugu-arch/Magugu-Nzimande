import Link from 'next/link';
import type { Route } from 'next';
import { Suspense } from 'react';
import { quickCheckInAction, removeWalkInAction, undoCheckInAction } from '@/app/admin/actions';
import { PlainActionButton } from '@/components/admin/forms';
import { StatusControl } from '@/components/admin/StatusControl';
import { WalkInForm } from '@/components/admin/WalkInForm';
import styles from '@/components/admin/admin.module.css';
import { getActivity } from '@/content/catalog';
import { requireStaff } from '@/lib/auth/session';
import { inboxCounts, todayStats, walkInActivities, walkInsFor } from '@/lib/data/admin';
import { todaysSchedule } from '@/lib/data/bookings';
import { getSetting } from '@/lib/data/settings';
import { liveActivities } from '@/lib/booking/engine';
import { dayHours } from '@/lib/hours';
import { formatDayLong, hmInSast, ymdInSast } from '@/lib/time';

export const metadata = { title: 'Today' };

const stateLabel = { auto: 'Following the schedule', open: 'Open', hold: 'Weather hold', closed: 'Closed' } as const;

async function TodayContent({ denied }: { denied: boolean }) {
  await requireStaff();
  const now = new Date();
  const today = ymdInSast(now);
  const [status, overrides, prices, stats, counts, schedule, walkIns] = await Promise.all([
    getSetting('tower_status'),
    getSetting('hours_overrides'),
    getSetting('price_overrides'),
    todayStats(today),
    inboxCounts(),
    todaysSchedule(today),
    walkInsFor(today),
  ]);
  const hours = dayHours(today, overrides);
  const live = liveActivities(prices);
  const walkInOptions = walkInActivities
    .map((a) => live.find((l) => l.id === a.id)!)
    .filter((a) => a && !a.disabled)
    .map((a) => ({ id: a.id, name: a.name, price: a.price }));

  const bySlot = new Map<string, typeof schedule>();
  for (const row of schedule) {
    const key = row.item.slotTime ?? '—';
    bySlot.set(key, [...(bySlot.get(key) ?? []), row]);
  }

  const dot =
    status.state === 'hold'
      ? styles.dotWarn
      : status.state === 'closed'
        ? styles.dotStop
        : status.state === 'open' || hours.open
          ? styles.dotGo
          : styles.dotIdle;

  return (
    <>
      <header className={styles.pageHead}>
        <div>
          <p className="eyebrow">Today</p>
          <h1 className={styles.pageTitle}>{formatDayLong(today)}</h1>
          <p className={styles.pageSub}>
            {hours.open ? `Open ${hours.opensAt} till sunset at ${hours.sunset}` : `Closed by schedule · sunset ${hours.sunset}`}
          </p>
        </div>
      </header>

      {denied && (
        <p role="alert" className={`${styles.message} ${styles.messageErr}`}>
          That page is for admins. Ask an admin if you need access.
        </p>
      )}

      <section className={styles.panel} aria-labelledby="status-title">
        <div className={styles.panelHead}>
          <h2 id="status-title" className={styles.panelTitle}>
            Tower status
          </h2>
          <p className={styles.statusNow}>
            <span className={dot} aria-hidden />
            <strong>{stateLabel[status.state]}</strong>
            {status.queueMinutes ? <span className={styles.muted}>Queue about {status.queueMinutes} min</span> : null}
            {status.updatedAt && status.updatedAt !== new Date(0).toISOString() ? (
              <span className={styles.muted}>Updated {hmInSast(new Date(status.updatedAt))}</span>
            ) : null}
          </p>
        </div>
        {status.note && <p className={styles.muted}>“{status.note}”</p>}
        <StatusControl current={status} />
      </section>

      <section className={styles.tiles} aria-label="Numbers">
        <div className={`${styles.tile} ${styles.tileDark}`}>
          <span className={styles.tileValue}>{stats.onlineToday + stats.gateToday}</span>
          <span className={styles.tileLabel}>
            Taking part today · {stats.onlineToday} booked, {stats.gateToday} at the gate
          </span>
        </div>
        <div className={styles.tile}>
          <span className={styles.tileValue}>
            {stats.checkedInToday}/{stats.bookingsToday}
          </span>
          <span className={styles.tileLabel}>Bookings checked in</span>
        </div>
        <Link href="/admin/reports" className={styles.tile}>
          <span className={styles.tileValue}>{stats.monthOnline + stats.monthGate}</span>
          <span className={styles.tileLabel}>
            This month · {stats.monthOnline + stats.monthGate > 0 ? Math.round((stats.monthOnline / (stats.monthOnline + stats.monthGate)) * 100) : 0}% booked
            online
          </span>
        </Link>
        <Link href="/admin/inbox" className={styles.tile}>
          <span className={styles.tileValue}>{counts.total}</span>
          <span className={styles.tileLabel}>
            Waiting · {counts.chats} chats, {counts.enquiries} enquiries, {counts.tables} tables
          </span>
        </Link>
      </section>

      <div className={styles.grid3}>
        <section className={styles.panel} aria-labelledby="schedule-title">
          <div className={styles.panelHead}>
            <h2 id="schedule-title" className={styles.panelTitle}>
              Booked slots
            </h2>
            <Link href={`/admin/bookings?date=${today}` as Route} className="link-arrow">
              All of today’s bookings
            </Link>
          </div>
          {bySlot.size === 0 ? (
            <p className={styles.empty}>No paid bookings for today yet.</p>
          ) : (
            <div>
              {[...bySlot.entries()].map(([time, rows]) => (
                <div key={time} className={styles.slot}>
                  <span className={styles.slotTime}>{time}</span>
                  <div className={styles.slotItems}>
                    {rows.map(({ item, booking }) => (
                      <div key={item.id} className={styles.slotItem}>
                        <Link href={`/admin/bookings/${booking.ref}` as Route} className={`${styles.slotWho} ${styles.rowLink}`}>
                          <span className={styles.rowTitle}>
                            {booking.name} · {item.qty} × {getActivity(item.sku)?.name ?? item.label}
                          </span>
                          <span className={`${styles.small} ${styles.muted} ${styles.mono}`}>{booking.ref}</span>
                        </Link>
                        {booking.checkedInAt ? (
                          <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <span className={`${styles.st} ${styles.stGo}`}>In {hmInSast(booking.checkedInAt)}</span>
                            <PlainActionButton action={undoCheckInAction} fields={{ ref: booking.ref }} className={styles.linkBtn}>
                              Undo
                            </PlainActionButton>
                          </span>
                        ) : (
                          <PlainActionButton action={quickCheckInAction} fields={{ ref: booking.ref }} className="btn btn--dark btn--sm">
                            Check in
                          </PlainActionButton>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className={styles.panel} aria-labelledby="gate-title">
          <h2 id="gate-title" className={styles.panelTitle}>
            Gate sales
          </h2>
          <p className={`${styles.small} ${styles.muted}`}>
            Log walk-ins as you sell them, so the monthly participant count includes everyone, not just online bookings.
          </p>
          <WalkInForm options={walkInOptions} />
          {walkIns.length > 0 && (
            <ul className={styles.rows} role="list">
              {walkIns.map((w) => (
                <li key={w.id} className={`${styles.row} ${styles.rowSplit}`}>
                  <span>
                    <span className={styles.rowTitle}>
                      {w.qty} × {getActivity(w.activityId)?.name ?? w.activityId}
                    </span>
                    <span className={`${styles.rowMeta}`}>
                      R{w.amount.toLocaleString('en-US')} · {hmInSast(w.createdAt)} · {w.staffName}
                    </span>
                  </span>
                  <PlainActionButton action={removeWalkInAction} fields={{ id: String(w.id) }} className={styles.linkBtn} confirmText="Remove this gate sale?">
                    Remove
                  </PlainActionButton>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}

async function Denied({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  return <TodayContent denied={sp.denied === '1'} />;
}

export default function TodayPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return (
    <Suspense fallback={<div className={styles.skeleton} aria-label="Loading today" />}>
      <Denied searchParams={searchParams} />
    </Suspense>
  );
}
