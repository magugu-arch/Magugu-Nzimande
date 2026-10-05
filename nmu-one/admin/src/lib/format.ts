import { formatMoney } from '@core/domain/money';
import { formatDayShort, formatTime, sastDate, sastParts } from '@core/time/sast';

/** "Mon 5 Oct, 09:40" — always South African time, like the app. */
export const when = (iso: string | null | undefined) =>
  iso ? `${formatDayShort(iso)}, ${formatTime(iso)}` : '—';

const pad = (n: number) => String(n).padStart(2, '0');

/** ISO → value for <input type="datetime-local">, in SAST. */
export function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const p = sastParts(iso);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hours)}:${pad(p.minutes)}`;
}

/** <input type="datetime-local"> value, read as SAST → ISO. */
export function fromLocalInput(value: string): string | null {
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number) as [number, number, number, number, number, number];
  return sastDate(y, mo, d, h, mi).toISOString();
}

/** "R62.00" — the app's money format. */
export const rands = (cents: number) => formatMoney({ cents, currency: 'ZAR' });
