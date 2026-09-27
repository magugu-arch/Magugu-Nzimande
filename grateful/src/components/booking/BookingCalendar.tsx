import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useRef, type KeyboardEvent } from 'react';
import { addDays, formatLongDate } from '../../../shared/format';

/**
 * Month grid for choosing a date. Weeks start on Monday, as they do in South
 * Africa. Only dates with an open slot are selectable — the rest are shown
 * but disabled, so the shape of the month still reads. Arrow keys move
 * between available days; cells are 44px or larger for thumbs.
 */

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

function monthLabel(month: string) {
  return new Date(`${month}-01T12:00:00Z`).toLocaleDateString('en-ZA', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

export function BookingCalendar({
  month,
  onMonth,
  minMonth,
  maxMonth,
  available,
  selected,
  onSelect,
  loading,
}: {
  month: string;
  onMonth: (m: string) => void;
  minMonth: string;
  maxMonth: string;
  available: string[] | null;
  selected: string | null;
  onSelect: (date: string) => void;
  loading: boolean;
}) {
  const grid = useRef<HTMLDivElement>(null);
  const first = `${month}-01`;
  const lead = (new Date(`${first}T12:00:00Z`).getUTCDay() + 6) % 7; // Monday = 0
  const nextFirst = `${shiftMonth(month, 1)}-01`;
  const days: string[] = [];
  for (let d = first; d < nextFirst; d = addDays(d, 1)) days.push(d);
  const open = new Set(available ?? []);

  const onKey = (e: KeyboardEvent<HTMLButtonElement>, date: string) => {
    const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 7, ArrowUp: -7 }[e.key];
    if (!step) return;
    e.preventDefault();
    // Walk in that direction to the next available date in this month.
    for (let d = addDays(date, step); d >= first && d < nextFirst; d = addDays(d, step)) {
      if (open.has(d)) {
        grid.current?.querySelector<HTMLButtonElement>(`[data-date="${d}"]`)?.focus();
        return;
      }
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-2xl" aria-live="polite">
          {monthLabel(month)}
        </h3>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => onMonth(shiftMonth(month, -1))}
            disabled={month <= minMonth}
            aria-label="Previous month"
            className="inline-flex min-h-11 min-w-11 items-center justify-center border border-line hover:border-white disabled:opacity-25 disabled:hover:border-line"
          >
            <ChevronLeft aria-hidden className="size-5" />
          </button>
          <button
            type="button"
            onClick={() => onMonth(shiftMonth(month, 1))}
            disabled={month >= maxMonth}
            aria-label="Next month"
            className="inline-flex min-h-11 min-w-11 items-center justify-center border border-line hover:border-white disabled:opacity-25 disabled:hover:border-line"
          >
            <ChevronRight aria-hidden className="size-5" />
          </button>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-7 gap-1" aria-hidden="true">
        {WEEKDAYS.map((d) => (
          <span key={d} className="ui-label py-2 text-center opacity-50">
            {d}
          </span>
        ))}
      </div>

      <div ref={grid} role="group" aria-label={`Available dates in ${monthLabel(month)}`} aria-busy={loading || undefined} className="grid grid-cols-7 gap-1">
        {Array.from({ length: lead }, (_, i) => (
          <span key={`lead-${i}`} aria-hidden="true" />
        ))}
        {days.map((date) => {
          const isOpen = open.has(date);
          const isSelected = date === selected;
          const label = `${formatLongDate(date)}${isOpen ? '' : ', unavailable'}`;
          return (
            <button
              key={date}
              type="button"
              data-date={date}
              disabled={!isOpen}
              aria-pressed={isSelected}
              aria-label={label}
              onClick={() => onSelect(date)}
              onKeyDown={(e) => onKey(e, date)}
              className={`relative flex aspect-square min-h-11 items-center justify-center font-sans text-sm transition-colors ${
                loading ? 'skeleton text-transparent' : isSelected ? 'bg-white text-black' : isOpen ? 'border border-white/35 hover:border-white hover:bg-white/10' : 'cursor-not-allowed opacity-25'
              }`}
            >
              {Number(date.slice(8))}
            </button>
          );
        })}
      </div>

      {!loading && available && available.length === 0 && <p className="mt-6 font-sans text-sm opacity-70">No openings this month. Try the next month, or contact the studio.</p>}
    </div>
  );
}
