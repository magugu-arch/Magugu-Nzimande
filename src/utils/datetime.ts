import { businessRules } from '@/constants/config';
import { instantAtStoreTime, storeClockAt } from '@/utils/storeClock';
import { tradingWindow } from '@/utils/tradingHours';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * `14:35` — 24-hour, matching South African convention, on the store's clock.
 *
 * Every instant this formats is a fact about a South African kitchen: when an
 * order was placed, when it is due, which slot was chosen. Rendering those on
 * the device's clock made the app tell a customer abroad that their collection
 * order was ready at an hour nobody at the counter would recognise. See
 * `utils/storeClock` for why this is the app's single clock and why the
 * conversion is arithmetic rather than `Intl`.
 */
export function formatTime(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '';
  const { hour, minute } = storeClockAt(date);
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
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
  // Store time, for the same reason `formatTime` is: an order placed at 01:00
  // SAST on a Sunday was placed on the Sunday, whatever Saturday evening the
  // customer's phone was still showing.
  const { day, date: dayOfMonth, month } = storeClockAt(date);
  return `${SHORT_DAYS[day]}, ${dayOfMonth} ${SHORT_MONTHS[month]}`;
}

/** `Fri, 21 Aug · 14:35` */
export function formatDateTime(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '';
  return `${formatShortDate(date)} · ${formatTime(date)}`;
}

/**
 * `Today` / `Yesterday` / `Fri, 21 Aug`
 *
 * "Today" means the kitchen's today. Comparing store day numbers rather than
 * subtracting two local midnights also drops a rounding hazard the old version
 * carried: `Math.round` over a difference of local midnights is only exact
 * because neither of these zones has daylight saving, which is a property of
 * the deployment rather than of the code.
 */
export function formatRelativeDay(value: string | Date, now: Date = new Date()): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '';
  const diffDays = storeClockAt(now).dayNumber - storeClockAt(date).dayNumber;
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

  /**
   * Shared with `isStoreOpenAt` rather than reimplemented, which is how this
   * went wrong: both files parsed the strings themselves, both read a closing
   * time of `00:30` as thirty minutes past midnight, and a branch trading late
   * on a Friday was reported shut *and* offered no slots — two symptoms of one
   * rule, in two places, agreeing by coincidence rather than construction.
   *
   * `closeMinutes` can now exceed a day. The slot loop below wants exactly
   * that: `new Date(y, m, d, 24, 15)` is a quarter past midnight on the next
   * morning, so a window that wraps produces the late slots on the card for
   * the night they belong to, which is how anybody ordering at eleven on a
   * Friday thinks about it.
   */
  const { open, close } = tradingWindow(hours);
  return { openMinutes: open, closeMinutes: close };
}

/** Just the part of a Store scheduling needs, so this stays free of the model. */
export interface SchedulableStore {
  openingHours: { day: number; opensAt: string; closesAt: string }[];
  /**
   * The date this branch starts trading, if it has not yet.
   *
   * The weekly timetable says nothing about it: a branch opening in November
   * has the same Tuesday hours as one open since March, so the scheduler
   * offered 41 slots today and 205 across the week for bb.q Chicken Gateway,
   * which opens on 1 November. Checkout refused every one of them with "bb.q
   * Chicken Gateway opens on Sun, 1 Nov".
   *
   * Not reachable through the store picker, which will not let a branch that
   * has not opened be chosen. Reachable through checkout, which falls back to
   * naming *some* branch when none of them can take the order — and that is
   * the app's state for the whole run-up to the first opening, when every
   * branch is a branch that has not opened.
   */
  opensOn?: string;
}

export function buildScheduleDays(
  now: Date = new Date(),
  store?: SchedulableStore | null,
): ScheduleDay[] {
  const days: ScheduleDay[] = [];

  /**
   * The floor under every slot: the kitchen's lead time, or the day the branch
   * opens, whichever is later.
   *
   * Both, not either. Lead time alone offers slots for a branch that does not
   * exist yet; the opening date alone offers 09:00 on opening morning to
   * somebody standing there at 08:55.
   */
  const opens = store?.opensOn ? new Date(store.opensOn) : null;
  const opensAt = opens && !Number.isNaN(opens.getTime()) ? opens.getTime() : 0;
  const earliest = new Date(
    Math.max(addMinutes(now, businessRules.minScheduleLeadMinutes).getTime(), opensAt),
  );

  /**
   * The grid is laid out on the kitchen's calendar, not the phone's.
   *
   * This loop used to build each day with `new Date(y, m, d + offset)` from the
   * device's local fields, and each slot the same way — so the label came from
   * one clock and the instant sent to the store came from the same wrong one.
   * Two consequences, and the second is the expensive one:
   *
   *   - The days were the customer's days. At 20:00 on a Saturday in Los
   *     Angeles it is already Sunday in Johannesburg, so the grid opened on
   *     Saturday's published hours for a branch that had been trading its
   *     Sunday shift for five hours.
   *   - The slot labelled `18:00` was 18:00 *there*. The instant that reached
   *     the kitchen was some other hour entirely — for a phone far enough
   *     behind, an hour after the branch had shut, having passed a lead-time
   *     check and a trading-hours check that both agreed with it because they
   *     read the same clock.
   */
  const today = storeClockAt(now);

  for (let offset = 0; offset < businessRules.maxScheduleDays; offset += 1) {
    const midnight = instantAtStoreTime({
      year: today.year,
      month: today.month,
      date: today.date + offset,
    });
    const window = windowForDay(store, storeClockAt(midnight).day);
    if (!window) continue;

    const slots: ScheduleSlot[] = [];

    // Last orders are before closing, not at it — a kitchen that shuts at
    // 22:00 cannot start cooking at 22:00.
    for (
      let minutes = window.openMinutes;
      minutes <= window.closeMinutes - SLOT_STEP_MINUTES;
      minutes += SLOT_STEP_MINUTES
    ) {
      // `hour` here may be 24 or more for a branch trading past midnight;
      // `instantAtStoreTime` normalises that onto the next morning, which is
      // the night those slots belong to.
      const slot = instantAtStoreTime({
        year: today.year,
        month: today.month,
        date: today.date + offset,
        hour: Math.floor(minutes / 60),
        minute: minutes % 60,
      });
      if (slot.getTime() < earliest.getTime()) continue;
      slots.push({ iso: slot.toISOString(), label: formatTime(slot) });
    }

    if (slots.length > 0) {
      days.push({
        dateIso: midnight.toISOString(),
        label: formatRelativeDay(midnight, now),
        slots,
      });
    }
  }

  return days;
}
