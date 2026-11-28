'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Rain, Sun, Sunset, Wind } from '@/components/ui/icons';
import { getActivity, type ActivityId } from '@/content/catalog';
import { site } from '@/content/site';
import type { Slot } from '@/lib/booking/engine';
import { useTodaySast } from '@/lib/client-values';
import { addDays, formatDayLong, formatMonthYear, weekday } from '@/lib/time';
import styles from './book.module.css';

type RangeDay = { date: string; open: boolean; bookable: boolean; sunset: string; opensAt: string | null; spaces: number };
type Forecast = Record<string, { code: number; rain: number; gust: number; max: number }>;

function useRange(activityId: ActivityId, from: string | null) {
  const key = from ? `${activityId}:${from}` : null;
  // Each answer is stored with the request it answers, so "loading" is derived, not set.
  const [result, setResult] = useState<{ key: string; days: Record<string, RangeDay> } | null>(null);
  useEffect(() => {
    if (!key) return;
    let alive = true;
    fetch(`/api/availability?activity=${activityId}&from=${from}&days=63`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d: { days: RangeDay[] }) => {
        if (alive) setResult({ key, days: Object.fromEntries(d.days.map((x) => [x.date, x])) });
      })
      .catch(() => {
        if (alive) setResult((prev) => ({ key, days: prev?.days ?? {} }));
      });
    return () => {
      alive = false;
    };
  }, [key, activityId, from]);
  // While a new range loads, keep showing the last one rather than an empty calendar.
  return { days: result?.days ?? {}, loading: !!key && result?.key !== key };
}

/** Free, keyless forecast for the towers' coordinates (16 days). Silent if unreachable. */
function useForecast(): Forecast {
  const [f, setF] = useState<Forecast>({});
  useEffect(() => {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${site.geo.lat}&longitude=${site.geo.lng}&daily=weather_code,precipitation_probability_max,wind_gusts_10m_max,temperature_2m_max&timezone=Africa%2FJohannesburg&forecast_days=16`;
    fetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d?.daily) return;
        const out: Forecast = {};
        d.daily.time.forEach((t: string, i: number) => {
          out[t] = {
            code: d.daily.weather_code[i],
            rain: d.daily.precipitation_probability_max[i] ?? 0,
            gust: d.daily.wind_gusts_10m_max[i] ?? 0,
            max: Math.round(d.daily.temperature_2m_max[i] ?? 0),
          };
        });
        setF(out);
      })
      .catch(() => {});
  }, []);
  return f;
}

function WeatherIcon({ w }: { w?: Forecast[string] }) {
  if (!w) return null;
  if (w.rain >= 60) return <Rain width={14} height={14} aria-label={`Rain likely (${w.rain}%)`} />;
  if (w.gust >= 45) return <Wind width={14} height={14} aria-label={`Windy (gusts ${Math.round(w.gust)} km/h)`} />;
  return <Sun width={14} height={14} aria-label={`Fair, about ${w.max}°C`} />;
}

export function StepWhen({
  activityId,
  date,
  time,
  scadTime,
  needsScad,
  qtyUnits,
  onDate,
  onTime,
  onScadTime,
}: {
  activityId: ActivityId;
  date: string | null;
  time: string | null;
  scadTime: string | null;
  needsScad: boolean;
  qtyUnits: { main: number; scad: number };
  onDate: (d: string) => void;
  onTime: (t: string | null) => void;
  onScadTime: (t: string | null) => void;
}) {
  const today = useTodaySast();
  const { days, loading } = useRange(activityId, today);
  const forecast = useForecast();
  const [monthOffset, setMonthOffset] = useState(0);

  const month = useMemo(() => {
    if (!today) return null;
    const base = new Date(`${today.slice(0, 7)}-01T12:00:00Z`);
    base.setUTCMonth(base.getUTCMonth() + monthOffset);
    const first = base.toISOString().slice(0, 10);
    const startPad = (weekday(first) + 6) % 7; // Monday-first grid
    const cells: (string | null)[] = Array.from({ length: startPad }, () => null);
    for (let d = first; d.slice(0, 7) === first.slice(0, 7); d = addDays(d, 1)) cells.push(d);
    return { first, cells };
  }, [today, monthOffset]);

  const activity = getActivity(activityId);

  return (
    <div className={styles.when}>
      <div className={styles.calendar}>
        <div className={styles.calHead}>
          <button
            type="button"
            className={styles.calNav}
            onClick={() => setMonthOffset((m) => Math.max(0, m - 1))}
            disabled={monthOffset === 0}
            aria-label="Previous month"
          >
            <ChevronLeft />
          </button>
          <p className={styles.calMonth} aria-live="polite">
            {month ? formatMonthYear(month.first) : ' '}
          </p>
          <button
            type="button"
            className={styles.calNav}
            onClick={() => setMonthOffset((m) => Math.min(3, m + 1))}
            disabled={monthOffset >= 3}
            aria-label="Next month"
          >
            <ChevronRight />
          </button>
        </div>
        <div className={styles.calGrid} role="grid" aria-label="Choose a date">
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
            <span key={i} className={styles.calDow} aria-hidden>
              {d}
            </span>
          ))}
          {month?.cells.map((d, i) => {
            if (!d) return <span key={`pad-${i}`} />;
            const info = days[d];
            const past = today ? d < today : true;
            const selectable = !!info?.bookable && !past;
            const selected = d === date;
            const label = `${formatDayLong(d)}${info ? (info.open ? (info.bookable ? `, ${info.spaces} places online` : ', full online') : ', closed') : ''}`;
            return (
              <button
                key={d}
                type="button"
                role="gridcell"
                aria-selected={selected}
                aria-label={label}
                disabled={!selectable}
                className={`${styles.calDay} ${selected ? styles.calSelected : ''} ${info && !info.open ? styles.calClosed : ''}`}
                onClick={() => {
                  onDate(d);
                  onTime(null);
                  onScadTime(null);
                }}
              >
                <span className="num">{Number(d.slice(8))}</span>
                <span className={styles.calMeta}>
                  {info?.open && !past ? info.bookable ? <WeatherIcon w={forecast[d]} /> : <span className={styles.full}>Full</span> : null}
                </span>
              </button>
            );
          })}
        </div>
        <p className={styles.calNote}>
          {loading ? 'Checking availability…' : 'Open Thursday to Sunday. Closed days are greyed out.'} Weather icons show the forecast for the next two weeks.
        </p>
      </div>

      <div className={styles.slotsCol}>
        {date ? (
          <>
            <Slots
              title={activity?.booking.mode === 'session' ? 'Choose a session' : `Choose a time for ${activity?.name}`}
              activityId={activityId}
              date={date}
              value={time}
              units={qtyUnits.main}
              onChange={onTime}
            />
            {needsScad && time && (
              <Slots
                title="And a time for your SCAD freefall"
                activityId="scad-freefall"
                date={date}
                value={scadTime}
                units={qtyUnits.scad}
                onChange={onScadTime}
                after={time}
              />
            )}
            {forecast[date] && (
              <p className={styles.forecast}>
                <WeatherIcon w={forecast[date]} /> Forecast {forecast[date]!.max}°C, {forecast[date]!.rain}% chance of rain, gusts to{' '}
                {Math.round(forecast[date]!.gust)} km/h. If weather stops jumps, you can move your slot for free.
              </p>
            )}
          </>
        ) : (
          <div className={styles.slotsEmpty}>
            <Sunset width={32} height={32} />
            <p>Pick a date to see times. The last slot of the day is the sunset slot.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function Slots({
  title,
  activityId,
  date,
  value,
  units,
  onChange,
  after,
}: {
  title: string;
  activityId: ActivityId;
  date: string;
  value: string | null;
  units: number;
  onChange: (t: string | null) => void;
  after?: string;
}) {
  const key = `${activityId}:${date}`;
  const [result, setResult] = useState<{ key: string; slots: Slot[] | null; reason: string | null } | null>(null);
  useEffect(() => {
    let alive = true;
    fetch(`/api/availability?activity=${activityId}&date=${date}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d: { slots: Slot[]; reason?: string }) => {
        if (alive) setResult({ key, slots: d.slots, reason: d.reason ?? null });
      })
      .catch(() => {
        if (alive) setResult({ key, slots: null, reason: 'Couldn’t load times. Check your connection.' });
      });
    return () => {
      alive = false;
    };
  }, [key, activityId, date]);
  const current = result?.key === key ? result : null;
  const slots = current?.slots ?? null;
  const reason = current?.reason ?? null;

  return (
    <fieldset className={styles.slots}>
      <legend className="h4">{title}</legend>
      {!current && <p className="muted small">Loading times…</p>}
      {current && (!slots || slots.length === 0) && <p className="muted small">{reason ?? 'No times this day.'}</p>}
      <div className={styles.slotGrid}>
        {slots?.map((s) => {
          const tooFew = s.remaining < units;
          const beforeMain = after ? s.time <= after : false;
          const disabled = s.closed || tooFew || beforeMain;
          const selected = value === s.time;
          const left = s.closed
            ? 'Closed'
            : s.remaining === 0
              ? 'Full'
              : tooFew
                ? `${s.remaining} left`
                : s.remaining <= 2
                  ? `Last ${s.remaining}`
                  : `${s.remaining} left`;
          return (
            <button
              key={s.time}
              type="button"
              className={`${styles.slot} ${selected ? styles.slotSelected : ''} ${s.goldenHour ? styles.slotGolden : ''}`}
              disabled={disabled}
              aria-pressed={selected}
              onClick={() => onChange(selected ? null : s.time)}
            >
              <span className={`num ${styles.slotTime}`}>{s.time}</span>
              <span className={styles.slotLeft}>{s.goldenHour && !disabled ? 'Sunset' : left}</span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
