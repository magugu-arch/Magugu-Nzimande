import { businessRules } from '@/constants/config';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** `14:35` — 24-hour, matching South African convention. */
export function formatTime(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '';
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/** `Fri, 21 Aug` */
export function formatShortDate(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(businessRules.locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

/** `Fri, 21 Aug · 14:35` */
export function formatDateTime(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '';
  return `${formatShortDate(date)} · ${formatTime(date)}`;
}

/** `Today` / `Yesterday` / `Fri, 21 Aug` */
export function formatRelativeDay(value: string | Date, now: Date = new Date()): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '';
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOf(now) - startOf(date)) / 86_400_000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays === -1) return 'Tomorrow';
  return formatShortDate(date);
}

/** `25 – 35 min` window shown on ETAs. */
export function formatEtaWindow(minutes: number): string {
  const safe = Math.max(5, Math.round(minutes));
  const lower = Math.max(5, safe - 5);
  return `${lower} – ${safe + 5} min`;
}

export function dayName(day: number): string {
  return DAY_NAMES[((day % 7) + 7) % 7] ?? '';
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

/**
 * Build the selectable scheduling slots: today (from the lead time) through
 * `maxScheduleDays`, in 15-minute steps inside trading hours.
 */
export interface ScheduleSlot {
  iso: string;
  label: string;
}

export interface ScheduleDay {
  dateIso: string;
  label: string;
  slots: ScheduleSlot[];
}

export function buildScheduleDays(now: Date = new Date()): ScheduleDay[] {
  const days: ScheduleDay[] = [];
  const earliest = addMinutes(now, businessRules.minScheduleLeadMinutes);

  for (let offset = 0; offset < businessRules.maxScheduleDays; offset += 1) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    const slots: ScheduleSlot[] = [];

    for (let hour = 10; hour <= 21; hour += 1) {
      for (const minute of [0, 15, 30, 45]) {
        const slot = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, minute);
        if (slot.getTime() < earliest.getTime()) continue;
        slots.push({ iso: slot.toISOString(), label: formatTime(slot) });
      }
    }

    if (slots.length > 0) {
      days.push({
        dateIso: day.toISOString(),
        label: formatRelativeDay(day, now),
        slots,
      });
    }
  }

  return days;
}
