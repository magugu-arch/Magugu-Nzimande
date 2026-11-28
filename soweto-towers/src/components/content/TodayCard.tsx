'use client';

import Link from 'next/link';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { Sunset } from '@/components/ui/icons';
import { dayHours, nextOpenDay } from '@/lib/hours';
import type { TowerStatus } from '@/lib/status-types';
import { addDays, formatDayLong, hmInSast, hmToMinutes, weekday, weekdayName, ymdInSast } from '@/lib/time';
import styles from './TodayCard.module.css';

type View = { tone: 'go' | 'hold' | 'stop' | 'idle'; heading: string; lines: string[] };

function compute(status: TowerStatus | null): View {
  const now = new Date();
  const today = ymdInSast(now);
  const nowMin = hmToMinutes(hmInSast(now));
  const day = dayHours(today);
  const next = nextOpenDay(addDays(today, 1));
  const nextLine = next ? `Next open: ${weekdayName(weekday(next.date))} ${next.opensAt} till sunset (${next.sunset}).` : '';

  if (status?.state === 'closed') return { tone: 'stop', heading: 'Closed today', lines: [status.note ?? '', nextLine].filter(Boolean) };
  if (!day.open && status?.state !== 'open') return { tone: 'idle', heading: 'Closed today', lines: [nextLine] };
  if (nowMin < hmToMinutes(day.opensAt ?? '10:00')) {
    return { tone: 'idle', heading: `Opens today at ${day.opensAt}`, lines: [`Jumping till sunset at ${day.sunset}.`] };
  }
  if (nowMin >= hmToMinutes(day.sunset)) return { tone: 'idle', heading: 'Closed for today', lines: [nextLine] };
  if (status?.state === 'hold') {
    return {
      tone: 'hold',
      heading: 'Weather hold',
      lines: [status.note ?? 'Jumps are paused while the weather passes. We’ll update this as soon as we’re back on the bridge.'],
    };
  }
  const queue = status?.queueMinutes ? `Queue for walk-ins: about ${status.queueMinutes} minutes.` : 'Booked slots skip the walk-in queue.';
  return { tone: 'go', heading: 'Open now', lines: [`Jumping till sunset at ${day.sunset}.`, queue] };
}

const noSubscribe = () => () => {};
const todayLabel = () => formatDayLong(ymdInSast(new Date()));

/** Today at the towers: schedule + sunset, with the crew's live status on top. */
export function TodayCard() {
  const [view, setView] = useState<View | null>(null);
  // Read on the client only, so the page itself stays prerendered.
  const dateLabel = useSyncExternalStore(noSubscribe, todayLabel, () => '');

  useEffect(() => {
    let alive = true;
    fetch('/api/status', { cache: 'no-store' })
      .then((r) => (r.ok ? (r.json() as Promise<TowerStatus>) : null))
      .catch(() => null)
      .then((s) => {
        // Without the crew's status (offline, or the check failed) the card falls back to the schedule.
        if (alive) setView(compute(s));
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div id="status" className={`card card--dark ${styles.card}`} role="status" aria-live="polite">
      <p className="eyebrow">Today{dateLabel ? ` · ${dateLabel}` : ''}</p>
      <p className={styles.heading}>
        <span className={`dot ${view?.tone === 'go' ? 'dot--live' : ''} ${styles[view?.tone ?? 'idle']}`} aria-hidden />
        {view?.heading ?? 'Checking the towers…'}
      </p>
      {view?.lines.map((l) => (
        <p key={l} className="muted">
          {l}
        </p>
      ))}
      <p className={styles.sun}>
        <Sunset width={20} height={20} /> The towers close at sunset, so closing time moves with the seasons.
      </p>
      <Link href="/book" className="btn btn--primary">
        Book a timed slot
      </Link>
    </div>
  );
}
