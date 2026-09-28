/**
 * Venue-local formatting that does not depend on the device's Intl data
 * (Hermes ships a reduced ICU on some Android builds). South African
 * convention: "R1 500", "R95", "R1 250.50"; dates as "Friday 3 October".
 */
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function local(iso: string | Date): Date {
  return new Date(new Date(iso).getTime() + 2 * 3_600_000);
}

export function formatRand(cents: number): string {
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const rands = Math.floor(abs / 100);
  const rem = abs % 100;
  const grouped = String(rands).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${negative ? '−' : ''}R${grouped}${rem ? `.${String(rem).padStart(2, '0')}` : ''}`;
}

export function formatDateLong(iso: string | Date): string {
  const d = local(iso);
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

export function formatDateShort(iso: string | Date): string {
  const d = local(iso);
  return `${DAYS[d.getUTCDay()]!.slice(0, 3)} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]!.slice(0, 3)}`;
}

export function formatDateWithYear(iso: string | Date): string {
  const d = local(iso);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function formatTime(iso: string | Date): string {
  return local(iso).toISOString().slice(11, 16);
}

/** A calendar date string (YYYY-MM-DD) as "Friday 3 October". */
export function formatCalendarDate(date: string): string {
  return formatDateLong(`${date}T12:00:00+02:00`);
}

export function monthName(index: number): string {
  return MONTHS[index] ?? '';
}

export function dayName(index: number): string {
  return DAYS[index] ?? '';
}

export function formatPoints(points: number): string {
  return String(points).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}
