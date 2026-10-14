'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { EventFormat, EventType, SiteEvent } from '@/content/types';
import { cn } from '@/lib/cn';
import {
  calendarGrid,
  eventDayKey,
  eventFormatLabels,
  eventTypeLabels,
  formatEventTime,
  formatMonthKey,
  monthKey,
  shiftMonth,
} from '@/lib/events';
import { EventCard } from '../cards/Cards';
import { ButtonLink } from '../ui/Button';
import { ChevronLeft, ChevronRight, GridIcon, ListIcon } from '../ui/icons';

type Tab = 'upcoming' | 'past';
type View = 'list' | 'month';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/**
 * Upcoming/Past tabs, list or month view, and filters for format, type and
 * month (brief §6, Events). Which events are upcoming was decided on the
 * server; this only narrows and arranges them.
 */
export function EventsBrowser({ upcoming, past }: { upcoming: SiteEvent[]; past: SiteEvent[] }) {
  const [tab, setTab] = useState<Tab>('upcoming');
  const [view, setView] = useState<View>('list');
  const [format, setFormat] = useState<EventFormat | 'all'>('all');
  const [type, setType] = useState<EventType | 'all'>('all');
  const [month, setMonth] = useState<string>('all');

  const source = tab === 'upcoming' ? upcoming : past;
  const months = useMemo(() => {
    const keys = Array.from(new Set(source.map(monthKey)));
    return tab === 'upcoming' ? keys.sort() : keys.sort().reverse();
  }, [source, tab]);
  const types = useMemo(() => Array.from(new Set(source.map((e) => e.type))), [source]);

  const filtered = source.filter(
    (e) =>
      (format === 'all' || e.format === format) &&
      (type === 'all' || e.type === type) &&
      (month === 'all' || monthKey(e) === month),
  );

  const [calendarMonth, setCalendarMonth] = useState<string | null>(null);
  const shownMonth = calendarMonth ?? (month !== 'all' ? month : months[0]) ?? null;

  const switchTab = (next: Tab) => {
    setTab(next);
    setMonth('all');
    setType('all');
    setCalendarMonth(null);
  };

  const filtersActive = format !== 'all' || type !== 'all' || month !== 'all';

  return (
    <div>
      <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div
          role="tablist"
          aria-label="Event timing"
          className="inline-flex rounded-full bg-charcoal p-1 ring-1 ring-ivory/10"
        >
          {(['upcoming', 'past'] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              id={`tab-${t}`}
              aria-selected={tab === t}
              aria-controls="events-panel"
              onClick={() => switchTab(t)}
              className={cn(
                'pressable h-10 rounded-full px-5 text-[0.9rem] font-semibold',
                tab === t ? 'bg-ivory text-ink' : 'text-ivory/75 hover:text-ivory',
              )}
            >
              {t === 'upcoming' ? `Upcoming (${upcoming.length})` : `Past (${past.length})`}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <FilterSelect
            label="Format"
            value={format}
            onChange={(v) => setFormat(v as EventFormat | 'all')}
            options={[
              { value: 'all', label: 'Any format' },
              { value: 'online', label: eventFormatLabels.online },
              { value: 'in-person', label: eventFormatLabels['in-person'] },
            ]}
          />
          <FilterSelect
            label="Type"
            value={type}
            onChange={(v) => setType(v as EventType | 'all')}
            options={[
              { value: 'all', label: 'Any type' },
              ...types.map((t) => ({ value: t, label: eventTypeLabels[t] })),
            ]}
          />
          <FilterSelect
            label="Month"
            value={month}
            onChange={(v) => {
              setMonth(v);
              setCalendarMonth(null);
            }}
            options={[
              { value: 'all', label: 'Any month' },
              ...months.map((m) => ({ value: m, label: formatMonthKey(m) })),
            ]}
          />
          <div
            className="inline-flex rounded-full bg-charcoal p-1 ring-1 ring-ivory/10"
            role="group"
            aria-label="View"
          >
            {(
              [
                ['list', 'List view', ListIcon],
                ['month', 'Month view', GridIcon],
              ] as const
            ).map(([v, label, Icon]) => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                onClick={() => setView(v)}
                className={cn(
                  'pressable grid size-10 place-items-center rounded-full',
                  view === v ? 'bg-ivory text-ink' : 'text-ivory/75 hover:text-ivory',
                )}
              >
                <Icon size={18} />
                <span className="sr-only">{label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div id="events-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} className="mt-10">
        <p className="sr-only" aria-live="polite">
          {filtered.length} {filtered.length === 1 ? 'event' : 'events'} shown
        </p>

        {filtered.length === 0 ? (
          <EmptyState
            tab={tab}
            filtersActive={filtersActive}
            onReset={() => {
              setFormat('all');
              setType('all');
              setMonth('all');
            }}
          />
        ) : view === 'list' ? (
          <ul className="space-y-4">
            {filtered.map((e) => (
              <li key={e.id}>
                <EventCard event={e} past={tab === 'past'} />
              </li>
            ))}
          </ul>
        ) : shownMonth ? (
          <MonthView
            monthKey={shownMonth}
            events={filtered}
            onShift={(delta) => setCalendarMonth(shiftMonth(shownMonth, delta))}
          />
        ) : null}
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  const id = `filter-${label.toLowerCase()}`;
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block text-[0.75rem] font-semibold tracking-[0.08em] text-ivory/60 uppercase"
      >
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-11 appearance-none rounded-full border border-ivory/15 bg-charcoal pr-10 pl-4 text-[0.9rem] text-ivory [color-scheme:dark] hover:border-ivory/30 focus:border-gold"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 opacity-60"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </div>
    </div>
  );
}

function EmptyState({
  tab,
  filtersActive,
  onReset,
}: {
  tab: Tab;
  filtersActive: boolean;
  onReset: () => void;
}) {
  return (
    <div className="rounded-[1.5rem] bg-charcoal/70 p-8 text-center ring-1 ring-ivory/10 md:p-12">
      <h3 className="font-display text-[1.875rem] leading-tight font-semibold">
        {filtersActive
          ? 'No events match those filters'
          : tab === 'upcoming'
            ? 'No public events are scheduled right now'
            : 'No past events to show yet'}
      </h3>
      <p className="mx-auto mt-3 max-w-lg text-ivory/72">
        {filtersActive
          ? 'Try widening the format, type or month.'
          : tab === 'upcoming'
            ? 'New dates are announced to the mailing list first. In the meantime, the free learning library is always open.'
            : 'Highlights from past events will appear here.'}
      </p>
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        {filtersActive ? (
          <button
            type="button"
            onClick={onReset}
            className="pressable h-11 rounded-full border border-ivory/35 px-5 font-semibold hover:bg-ivory/[0.06]"
          >
            Clear filters
          </button>
        ) : (
          <>
            <ButtonLink href="/#newsletter">Join the mailing list</ButtonLink>
            <ButtonLink href="/learn" variant="secondary">
              Browse free learning
            </ButtonLink>
          </>
        )}
      </div>
    </div>
  );
}

function MonthView({
  monthKey: key,
  events,
  onShift,
}: {
  monthKey: string;
  events: SiteEvent[];
  onShift: (delta: number) => void;
}) {
  const weeks = calendarGrid(key);
  const byDay = new Map<string, SiteEvent[]>();
  for (const e of events) {
    const k = eventDayKey(e);
    byDay.set(k, [...(byDay.get(k) ?? []), e]);
  }
  const inMonth = events.filter((e) => monthKey(e) === key);

  return (
    <div className="rounded-[1.5rem] bg-charcoal/70 p-4 ring-1 ring-ivory/10 md:p-6">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-[1.75rem] font-semibold" aria-live="polite">
          {formatMonthKey(key)}
        </h3>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onShift(-1)}
            className="pressable grid size-10 place-items-center rounded-full ring-1 ring-ivory/15 hover:bg-ivory/10"
          >
            <ChevronLeft size={20} />
            <span className="sr-only">Previous month</span>
          </button>
          <button
            type="button"
            onClick={() => onShift(1)}
            className="pressable grid size-10 place-items-center rounded-full ring-1 ring-ivory/15 hover:bg-ivory/10"
          >
            <ChevronRight size={20} />
            <span className="sr-only">Next month</span>
          </button>
        </div>
      </div>

      {/* The grid is a visual summary; the list beneath carries the same events for every reader. */}
      <table className="mt-5 hidden w-full table-fixed border-collapse sm:table" aria-hidden="true">
        <thead>
          <tr>
            {WEEKDAYS.map((d) => (
              <th
                key={d}
                className="pb-2 text-left text-[0.75rem] font-semibold tracking-[0.08em] text-ivory/50 uppercase"
              >
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week) => (
            <tr key={week[0]!.date}>
              {week.map((day) => {
                const dayEvents = day.inMonth ? (byDay.get(day.date) ?? []) : [];
                return (
                  <td key={day.date} className="h-24 border border-ivory/[0.07] p-1.5 align-top">
                    <span
                      className={cn(
                        'text-[0.8rem]',
                        day.inMonth ? 'text-ivory/70' : 'text-ivory/20',
                      )}
                    >
                      {day.day}
                    </span>
                    {dayEvents.map((e) => (
                      <span
                        key={e.id}
                        className="mt-1 block truncate rounded-md bg-gold/20 px-1.5 py-1 text-[0.72rem] font-medium text-gold-bright"
                      >
                        {e.title}
                      </span>
                    ))}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <ul className="mt-5 space-y-2">
        {inMonth.length === 0 ? (
          <li className="text-ivory/65">Nothing in {formatMonthKey(key)} matches.</li>
        ) : (
          inMonth.map((e) => (
            <li key={e.id}>
              <Link
                href={`/events/${e.slug}`}
                className="flex flex-wrap items-baseline gap-x-3 rounded-lg px-2 py-2 hover:bg-ivory/[0.05]"
              >
                <span className="font-semibold">{e.title}</span>
                <span className="type-small text-ivory/65">
                  {new Intl.DateTimeFormat('en-US', {
                    timeZone: e.timezone,
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  }).format(new Date(e.start))}{' '}
                  · {formatEventTime(e)}
                </span>
              </Link>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
