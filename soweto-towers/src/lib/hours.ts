import { site } from '@/content/site';
import { sunsetHm } from './sun';
import { addDays, hmToMinutes, minutesToHm, weekday, weekdayName, type Hm, type Ymd } from './time';

export type DayHours = {
  date: Ymd;
  open: boolean;
  opensAt: Hm | null;
  /** Sunset, SAST. The towers close at sunset. */
  sunset: Hm;
  /** Last timed slot may start this many minutes before sunset. */
  lastStart: Hm | null;
};

/** Per-day overrides staff set in the console (closures, special hours). */
export type HoursOverride = { date: Ymd; closed?: boolean; opensAt?: Hm; note?: string };

const LAST_START_BEFORE_SUNSET_MIN = 30;

export function dayHours(date: Ymd, overrides: HoursOverride[] = []): DayHours {
  const sunset = sunsetHm(date);
  const override = overrides.find((o) => o.date === date);
  const regular = site.weeklyOpening[weekday(date)] ?? null;
  const opensAt = override?.closed ? null : (override?.opensAt ?? regular);
  if (!opensAt) return { date, open: false, opensAt: null, sunset, lastStart: null };
  const last = hmToMinutes(sunset) - LAST_START_BEFORE_SUNSET_MIN;
  // Round the last start down to the half hour the slots run on.
  const lastStart = minutesToHm(Math.floor(last / 30) * 30);
  return { date, open: true, opensAt, sunset, lastStart };
}

export function nextOpenDay(from: Ymd, overrides: HoursOverride[] = [], horizon = 21): DayHours | null {
  for (let i = 0; i <= horizon; i++) {
    const d = dayHours(addDays(from, i), overrides);
    if (d.open) return d;
  }
  return null;
}

/** "Thursday 12:00 – sunset · Friday to Sunday 10:00 – sunset" */
export function weeklyHoursSummary(): { label: string; value: string }[] {
  return [
    { label: 'Thursday', value: `${site.weeklyOpening[4]} till sunset` },
    { label: 'Friday to Sunday', value: `${site.weeklyOpening[5]} till sunset` },
    { label: 'Monday to Wednesday', value: 'Closed' },
  ];
}

export function openWeekdays(): number[] {
  return Object.entries(site.weeklyOpening)
    .filter(([, v]) => v)
    .map(([k]) => Number(k));
}

export function describeDay(d: DayHours): string {
  return d.open ? `${weekdayName(weekday(d.date))} ${d.opensAt} – sunset (${d.sunset})` : `${weekdayName(weekday(d.date))}: closed`;
}
