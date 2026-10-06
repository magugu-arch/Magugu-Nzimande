'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { PublicAvailability } from '@/lib/booking/availability';
import { PUBLIC_LABEL } from '@/lib/booking/availability';
import { addDays, formatDayLong, formatMonth, monthGrid, todayIso } from '@/lib/booking/dates';
import styles from './AvailabilityCalendar.module.css';

type Props = {
  value: string | null;
  onChange: (date: string, state: PublicAvailability) => void;
  /** Label for the grid, read by screen readers. */
  label?: string;
  describedBy?: string;
};

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/**
 * Accessible month calendar showing only public availability. Arrow keys move
 * by day and week, PageUp/PageDown by month, Home/End to week edges; Enter or
 * Space selects. Past and unavailable days cannot be chosen.
 */
export function AvailabilityCalendar({ value, onChange, label = 'Choose an event date', describedBy }: Props) {
  const today = todayIso();
  const initial = value ?? today;
  const [cursor, setCursor] = useState(initial);
  const [view, setView] = useState({ y: Number(initial.slice(0, 4)), m: Number(initial.slice(5, 7)) });
  const [days, setDays] = useState<Record<string, PublicAvailability>>({});
  // Which grid range has loaded (or failed); loading is derived from it, not stored.
  const [loaded, setLoaded] = useState<{ key: string; error: boolean } | null>(null);
  const grid = useRef<HTMLTableElement>(null);
  const focusOnRender = useRef(false);

  const weeks = useMemo(() => monthGrid(view.y, view.m), [view]);
  const first = weeks[0]![0]!;
  const last = weeks[weeks.length - 1]![6]!;
  const rangeKey = `${first}:${last}`;
  const status: 'loading' | 'ready' | 'error' = loaded?.key !== rangeKey ? 'loading' : loaded.error ? 'error' : 'ready';

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/availability?from=${first}&to=${last}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((json: { days: Record<string, PublicAvailability> }) => {
        if (cancelled) return;
        setDays((d) => ({ ...d, ...json.days }));
        setLoaded({ key: `${first}:${last}`, error: false });
      })
      .catch(() => {
        if (!cancelled) setLoaded({ key: `${first}:${last}`, error: true });
      });
    return () => {
      cancelled = true;
    };
  }, [first, last]);

  useEffect(() => {
    if (!focusOnRender.current) return;
    focusOnRender.current = false;
    grid.current?.querySelector<HTMLButtonElement>(`[data-date="${cursor}"]`)?.focus();
  }, [cursor, weeks]);

  // Unknown days read as available: management reviews every request anyway.
  const stateOf = useCallback((d: string): PublicAvailability => (d < today ? 'past' : (days[d] ?? 'available')), [days, today]);

  const moveTo = (d: string) => {
    focusOnRender.current = true;
    setCursor(d);
    const y = Number(d.slice(0, 4));
    const m = Number(d.slice(5, 7));
    if (y !== view.y || m !== view.m) setView({ y, m });
  };

  const shiftMonth = (delta: number) => {
    const m0 = view.m - 1 + delta;
    const y = view.y + Math.floor(m0 / 12);
    const m = ((m0 % 12) + 12) % 12 + 1;
    setView({ y, m });
  };

  const onKey = (e: KeyboardEvent<HTMLButtonElement>, d: string) => {
    const keys: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (e.key in keys) {
      e.preventDefault();
      moveTo(addDays(d, keys[e.key]!));
    } else if (e.key === 'PageUp' || e.key === 'PageDown') {
      e.preventDefault();
      moveTo(addDays(d, e.key === 'PageUp' ? -30 : 30));
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      const dow = (new Date(`${d}T00:00:00Z`).getUTCDay() + 6) % 7;
      moveTo(addDays(d, e.key === 'Home' ? -dow : 6 - dow));
    }
  };

  const monthLabel = formatMonth(`${view.y}-${String(view.m).padStart(2, '0')}-01`);
  const canGoBack = `${view.y}-${String(view.m).padStart(2, '0')}` > today.slice(0, 7);

  return (
    <div className={styles.root}>
      <div className={styles.head}>
        <button type="button" className={styles.nav} onClick={() => shiftMonth(-1)} disabled={!canGoBack} aria-label="Previous month">
          ←
        </button>
        <p className={styles.month} aria-live="polite">
          {monthLabel}
        </p>
        <button type="button" className={styles.nav} onClick={() => shiftMonth(1)} aria-label="Next month">
          →
        </button>
      </div>

      <table ref={grid} className={styles.grid} role="grid" aria-label={`${label}, ${monthLabel}`} aria-describedby={describedBy} aria-busy={status === 'loading'}>
        <thead>
          <tr>
            {WEEKDAYS.map((w) => (
              <th key={w} scope="col" abbr={w}>
                {w.slice(0, 2)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week) => (
            <tr key={week[0]}>
              {week.map((d) => {
                const state = stateOf(d);
                const inMonth = Number(d.slice(5, 7)) === view.m;
                const selectable = state === 'available' || state === 'limited';
                const selected = value === d;
                return (
                  <td key={d} role="gridcell" aria-selected={selected}>
                    <button
                      type="button"
                      data-date={d}
                      data-state={state}
                      className={[styles.day, inMonth ? '' : styles.outside, selected ? styles.selected : '', d === today ? styles.today : ''].join(' ')}
                      tabIndex={d === cursor ? 0 : -1}
                      aria-disabled={!selectable}
                      aria-label={`${formatDayLong(d)} — ${PUBLIC_LABEL[state]}${selected ? ', selected' : ''}`}
                      onKeyDown={(e) => onKey(e, d)}
                      onFocus={() => setCursor(d)}
                      onClick={() => {
                        setCursor(d);
                        if (selectable) onChange(d, state);
                      }}
                    >
                      {Number(d.slice(8, 10))}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <ul role="list" className={styles.legend}>
        <li data-state="available">Available</li>
        <li data-state="limited">Provisional hold</li>
        <li data-state="unavailable">Unavailable</li>
      </ul>
      {status === 'error' && (
        <p className={styles.error} role="alert">
          Availability could not be loaded. You can still choose a date — management checks every request.
        </p>
      )}
    </div>
  );
}
