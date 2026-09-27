import { Trash2 } from 'lucide-react';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { addDays, todayInSast } from '../../../shared/format';
import type { OpeningHours } from '../../../shared/types';
import { adminApi } from '../../lib/adminApi';
import { RequestError } from '../../lib/api';
import { inputCls, Loading, Notice, Panel, SmallButton } from './ui';

const WEEKDAYS = [
  [1, 'Mon'],
  [2, 'Tue'],
  [3, 'Wed'],
  [4, 'Thu'],
  [5, 'Fri'],
  [6, 'Sat'],
  [0, 'Sun'],
] as const;

const dayLabel = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'long', timeZone: 'UTC' });

/**
 * When the studio takes bookings. Clients can only book inside open blocks,
 * so closing a block (a holiday, a fabric-buying day) removes those times
 * from the booking page at once. Existing bookings are never touched.
 */
export function Hours() {
  const today = todayInSast();
  const [range, setRange] = useState(56);
  const [hours, setHours] = useState<OpeningHours[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let live = true;
    adminApi.hours(today, addDays(today, range)).then(
      (h) => live && (setHours(h), setError(null)),
      (e: unknown) => live && setError(e instanceof RequestError ? e.message : 'Opening hours could not be loaded.'),
    );
    return () => {
      live = false;
    };
  }, [today, range, reload]);

  const refresh = () => setReload((r) => r + 1);

  async function run(fn: () => Promise<unknown>, done?: string) {
    setError(null);
    try {
      await fn();
      if (done) setNotice(done);
      refresh();
    } catch (e) {
      setError(e instanceof RequestError ? e.message : 'That did not work. Please try again.');
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
      <AddHours
        onAdded={(n, skipped) => {
          setNotice(`Opened ${n} day${n === 1 ? '' : 's'}.${skipped ? ` ${skipped} already had overlapping hours and were left as they were.` : ''}`);
          refresh();
        }}
      />
      <Panel
        title="Upcoming opening hours"
        action={
          <select aria-label="How far ahead" value={range} onChange={(e) => setRange(Number(e.target.value))} className={`${inputCls} w-auto`}>
            <option value={14}>Next 2 weeks</option>
            <option value={56}>Next 8 weeks</option>
            <option value={120}>Next 4 months</option>
          </select>
        }
      >
        {notice && (
          <div className="mb-3">
            <Notice kind="ok">{notice}</Notice>
          </div>
        )}
        {error && (
          <div className="mb-3">
            <Notice kind="error">{error}</Notice>
          </div>
        )}
        {!hours && !error && <Loading />}
        {hours?.length === 0 && <p className="font-sans text-sm opacity-60">No opening hours in this period, so nothing can be booked. Add some on the left.</p>}
        {hours && hours.length > 0 && (
          <ul className="divide-y divide-white/15">
            {hours.map((h) => (
              <li key={h.id} className={`flex flex-wrap items-center justify-between gap-3 py-2 ${h.status === 'closed' ? 'opacity-50' : ''}`}>
                <span className="font-sans text-sm tabular-nums">
                  <span className="inline-block w-44">{dayLabel(h.date)}</span>
                  <span className={h.status === 'closed' ? 'line-through' : ''}>
                    {h.startTime}–{h.endTime}
                  </span>
                  {h.status === 'closed' && <span className="ml-2 text-xs">Closed</span>}
                </span>
                <span className="flex gap-1">
                  <SmallButton variant="text" onClick={() => void run(() => adminApi.setHoursStatus(h.id, h.status === 'open' ? 'closed' : 'open'))}>
                    {h.status === 'open' ? 'Close' : 'Reopen'}
                  </SmallButton>
                  <SmallButton variant="text" label={`Delete ${dayLabel(h.date)} ${h.startTime}–${h.endTime}`} onClick={() => void run(() => adminApi.deleteHours(h.id), 'Removed.')}>
                    <Trash2 aria-hidden className="size-4" />
                  </SmallButton>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function AddHours({ onAdded }: { onAdded: (count: number, skipped: number) => void }) {
  const today = todayInSast();
  const [mode, setMode] = useState<'pattern' | 'single'>('pattern');
  const [date, setDate] = useState(today);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(addDays(today, 27));
  const [weekdays, setWeekdays] = useState<number[]>([2, 3, 4, 5]);
  const [startTime, setStart] = useState('09:00');
  const [endTime, setEnd] = useState('17:00');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setMessage(null);
    try {
      const res = await adminApi.addHours(mode === 'single' ? { date, startTime, endTime } : { from, to, weekdays, startTime, endTime });
      onAdded(res.added.length, res.skipped.length);
    } catch (err) {
      if (err instanceof RequestError) {
        setErrors(err.fields);
        setMessage(err.message);
      } else setMessage('That did not work. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  const field = (label: string, input: ReactNode, key: string) => (
    <label className="block font-sans text-sm">
      <span className="ui-label opacity-70">{label}</span>
      <span className="mt-1 block">{input}</span>
      {errors[key] && <span className="mt-1 block text-sm">{errors[key]}</span>}
    </label>
  );

  return (
    <Panel title="Open for bookings">
      <form onSubmit={(e) => void submit(e)} className="space-y-4" noValidate>
        <div role="radiogroup" aria-label="How to add" className="grid grid-cols-2 gap-2">
          {(
            [
              ['pattern', 'Weekly pattern'],
              ['single', 'One day'],
            ] as const
          ).map(([m, l]) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              onClick={() => setMode(m)}
              className={`min-h-11 border font-sans text-sm ${mode === m ? 'border-white bg-white text-black' : 'border-white/30'}`}
            >
              {l}
            </button>
          ))}
        </div>

        {mode === 'single' ? (
          field('Date', <input type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />, 'date')
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              {field('From', <input type="date" min={today} value={from} onChange={(e) => setFrom(e.target.value)} className={inputCls} />, 'from')}
              {field('To', <input type="date" min={from} value={to} onChange={(e) => setTo(e.target.value)} className={inputCls} />, 'to')}
            </div>
            <fieldset>
              <legend className="ui-label opacity-70">On these days</legend>
              <div className="mt-1 grid grid-cols-7 gap-1">
                {WEEKDAYS.map(([n, l]) => {
                  const on = weekdays.includes(n);
                  return (
                    <button
                      key={n}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setWeekdays(on ? weekdays.filter((w) => w !== n) : [...weekdays, n])}
                      className={`min-h-11 border font-sans text-xs ${on ? 'border-white bg-white text-black' : 'border-white/30'}`}
                    >
                      {l}
                    </button>
                  );
                })}
              </div>
              {errors.weekdays && <p className="mt-1 font-sans text-sm">{errors.weekdays}</p>}
            </fieldset>
          </>
        )}

        <div className="grid grid-cols-2 gap-3">
          {field('Opens', <input type="time" step={1800} value={startTime} onChange={(e) => setStart(e.target.value)} className={inputCls} />, 'startTime')}
          {field('Closes', <input type="time" step={1800} value={endTime} onChange={(e) => setEnd(e.target.value)} className={inputCls} />, 'endTime')}
        </div>

        {message && <Notice kind="error">{message}</Notice>}
        <SmallButton type="submit" variant="solid" busy={busy}>
          Open these times
        </SmallButton>
      </form>
    </Panel>
  );
}
