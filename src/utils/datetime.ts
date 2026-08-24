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

const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const SHORT_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/**
 * `Fri, 21 Aug`
 *
 * Built by hand for the same reason `formatTime` above is, and `groupDigits`
 * in utils/money: Hermes ships without full ICU on some builds, and
 * `toLocaleDateString('en-ZA', …)` then quietly falls back to US formatting —
 * `8/21/2026` where the design says `Fri, 21 Aug`. The day and month before
 * the number is not decoration; `21/8` and `8/21` are the same string with
 * opposite meanings, and an order dated wrongly is worse than one dated ugly.
 */
export function formatShortDate(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '';
  return `${SHORT_DAYS[date.getDay()]}, ${date.getDate()} ${SHORT_MONTHS[date.getMonth()]}`;
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

/**
 * Whether an ISO date has already gone by.
 *
 * One implementation, because expiry keeps turning out to be the term nobody
 * carried: a voucher kept discounting six days after it died, and a reward's
 * expiry was printed on screen and enforced nowhere. An unreadable date has
 * *not* passed — that is somebody's data fault, and taking a benefit away from
 * a customer over a malformed string is the wrong way to fail.
 */
export function hasPassed(value: string | undefined, now: Date = new Date()): boolean {
  if (!value) return false;
  const at = new Date(value);
  if (Number.isNaN(at.getTime())) return false;
  return at.getTime() <= now.getTime();
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

/**
 * Build the selectable scheduling slots: today (from the lead time) through
 * `maxScheduleDays`, in 15-minute steps inside the branch's trading hours.
 *
 * These used to be a hardcoded 10:00–21:45, every day, for every branch — the
 * seeded standard hours baked into a date utility that never saw a store. It
 * was invisible while all seven seeded branches kept the same shift. It stops
 * being invisible the moment the two real branches have real hours: a day the
 * branch does not trade still offered a full grid of slots, and the branches
 * that close at 23:00 never offered the last two hours they would gladly have
 * cooked.
 *
 * It also mattered more than it looked, because "schedule for later" is what
 * the app tells a customer who has found a closed kitchen. Handing them a slot
 * list that ignores the branch's hours would route them from one wrong answer
 * straight into another.
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

/** Fallback window for a branch that publishes no hours: 10:00 – 22:00. */
const DEFAULT_WINDOW = { openMinutes: 10 * 60, closeMinutes: 22 * 60 };

const SLOT_STEP_MINUTES = 15;

function windowForDay(store: SchedulableStore | null | undefined, weekday: number) {
  // No store, or a branch with no published hours, keeps the old behaviour.
  // A data gap should not empty the scheduler.
  if (!store || store.openingHours.length === 0) return DEFAULT_WINDOW;

  const hours = store.openingHours.find((entry) => entry.day === weekday);
  // No entry for this weekday means the branch is shut that day — no slots,
  // rather than a grid of times nobody will be there for.
  if (!hours) return null;

  const [openHour = 0, openMinute = 0] = hours.opensAt.split(':').map(Number);
  const [closeHour = 0, closeMinute = 0] = hours.closesAt.split(':').map(Number);
  return {
    openMinutes: openHour * 60 + openMinute,
    closeMinutes: closeHour * 60 + closeMinute,
  };
}

/** Just the part of a Store scheduling needs, so this stays free of the model. */
export interface SchedulableStore {
  openingHours: { day: number; opensAt: string; closesAt: string }[];
}

export function buildScheduleDays(
  now: Date = new Date(),
  store?: SchedulableStore | null,
): ScheduleDay[] {
  const days: ScheduleDay[] = [];
  const earliest = addMinutes(now, businessRules.minScheduleLeadMinutes);

  for (let offset = 0; offset < businessRules.maxScheduleDays; offset += 1) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    const window = windowForDay(store, day.getDay());
    if (!window) continue;

    const slots: ScheduleSlot[] = [];

    // Last orders are before closing, not at it — a kitchen that shuts at
    // 22:00 cannot start cooking at 22:00.
    for (
      let minutes = window.openMinutes;
      minutes <= window.closeMinutes - SLOT_STEP_MINUTES;
      minutes += SLOT_STEP_MINUTES
    ) {
      const slot = new Date(
        day.getFullYear(),
        day.getMonth(),
        day.getDate(),
        Math.floor(minutes / 60),
        minutes % 60,
      );
      if (slot.getTime() < earliest.getTime()) continue;
      slots.push({ iso: slot.toISOString(), label: formatTime(slot) });
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
