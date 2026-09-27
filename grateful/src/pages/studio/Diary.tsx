import { ChevronLeft, ChevronRight, Mail, MessageCircle, Phone } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { addDays, formatDuration, formatLongDate, todayInSast } from '../../../shared/format';
import type { AdminBooking } from '../../../shared/types';
import { adminApi } from '../../lib/adminApi';
import { RequestError } from '../../lib/api';
import { AddBooking } from './AddBooking';
import { BookingChip, inputCls, Loading, Notice, Panel, PaymentChip, SmallButton } from './ui';


const shortDay = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

const waNumber = (phone: string) => phone.replace(/[^\d]/g, '').replace(/^0/, '27');

/**
 * The week's bookings, day by day. Reschedule offers only times that are
 * actually free; cancel asks once, on the card, before it acts.
 */
export function Diary({ onChange }: { onChange: () => void }) {
  // A rolling seven days from today, so the first screen is always what is coming up.
  const [start, setStart] = useState(() => todayInSast());
  const [bookings, setBookings] = useState<AdminBooking[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [reload, setReload] = useState(0);
  const [adding, setAdding] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const end = addDays(start, 6);
  // Clear the old range while the new one loads, so a stale week is never mistaken for this one.
  const go = (d: string) => {
    setBookings(null);
    setStart(d);
  };

  useEffect(() => {
    let live = true;
    adminApi.bookings(start, end).then(
      (b) => live && (setBookings(b), setError(null)),
      (e: unknown) => live && setError(e instanceof RequestError ? e.message : 'Bookings could not be loaded.'),
    );
    return () => {
      live = false;
    };
  }, [start, end, reload]);

  const refresh = useCallback(() => {
    setReload((r) => r + 1);
    onChange();
  }, [onChange]);

  const shown = (bookings ?? []).filter((b) => showInactive || b.status === 'confirmed' || b.status === 'pending_payment' || b.status === 'needs_attention');
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));

  return (
    <Panel
      title="Diary"
      action={
        <div className="flex flex-wrap items-center gap-2">
          <SmallButton label="Previous 7 days" onClick={() => go(addDays(start, -7))}>
            <ChevronLeft aria-hidden className="size-4" />
          </SmallButton>
          <span className="min-w-40 text-center font-sans text-sm tabular-nums" aria-live="polite">
            {shortDay(start)} – {shortDay(end)}
          </span>
          <SmallButton label="Next 7 days" onClick={() => go(addDays(start, 7))}>
            <ChevronRight aria-hidden className="size-4" />
          </SmallButton>
          <SmallButton variant="text" onClick={() => go(todayInSast())} disabled={start === todayInSast()}>
            From today
          </SmallButton>
          <SmallButton variant="solid" onClick={() => (setAdding(true), setSaved(null))}>
            Add a booking
          </SmallButton>
          <label className="flex min-h-11 items-center gap-2 font-sans text-sm">
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} className="size-4 accent-white" />
            Show cancelled &amp; lapsed
          </label>
        </div>
      }
    >
      {adding && (
        <AddBooking
          onCancel={() => setAdding(false)}
          onDone={(d) => {
            setAdding(false);
            setSaved('Booking saved.');
            // Jump to the week that contains the new booking so it is visible.
            if (d < start || d > end) go(d);
            refresh();
          }}
        />
      )}
      {saved && (
        <div className="mb-4">
          <Notice kind="ok">{saved}</Notice>
        </div>
      )}
      {error && <Notice kind="error">{error}</Notice>}
      {!bookings && !error && <Loading label="Loading the diary…" />}
      {bookings && (
        <ol className="divide-y divide-white/15">
          {days.map((d) => {
            const list = shown.filter((b) => b.date === d);
            return (
              <li key={d} className="grid gap-3 py-4 md:grid-cols-[10rem_1fr]">
                <p className={`font-serif text-lg ${d === todayInSast() ? '' : 'opacity-80'}`}>
                  {shortDay(d)}
                  {d === todayInSast() && <span className="ui-label ml-2 align-middle">Today</span>}
                </p>
                {list.length === 0 ? (
                  <p className="font-sans text-sm opacity-60">No bookings</p>
                ) : (
                  <ul className="space-y-3">
                    {list.map((b) => (
                      <BookingCard key={b.id} booking={b} onChanged={refresh} />
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </Panel>
  );
}

function BookingCard({ booking: b, onChanged }: { booking: AdminBooking; onChanged: () => void }) {
  const [mode, setMode] = useState<'view' | 'reschedule' | 'cancel'>('view');
  const [date, setDate] = useState(b.date);
  const [options, setOptions] = useState<{ date: string; slots: string[] } | null>(null);
  const [time, setTime] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editable = b.status === 'confirmed';

  useEffect(() => {
    if (mode !== 'reschedule' || !date) return;
    let live = true;
    adminApi.rescheduleOptions(b.id, date).then(
      (slots) => live && setOptions({ date, slots }),
      (e: unknown) => live && setError(e instanceof RequestError ? e.message : 'Times could not be loaded.'),
    );
    return () => {
      live = false;
    };
  }, [mode, date, b.id]);

  async function act(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      setMode('view');
      onChanged();
    } catch (e) {
      setError(e instanceof RequestError ? e.message : 'That did not work. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  const loadingSlots = mode === 'reschedule' && options?.date !== date;

  return (
    <li className={`border px-4 py-3 ${b.status === 'needs_attention' ? 'border-white' : 'border-white/20'}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-sans text-sm tabular-nums">
            <strong className="text-base font-semibold">{b.time}</strong> · {formatDuration(b.durationMinutes)}
          </p>
          <p className="mt-1 font-serif text-xl leading-tight">{b.clientName}</p>
          <p className="font-sans text-sm opacity-70">{b.serviceName}</p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <BookingChip status={b.status} />
          <PaymentChip status={b.paymentStatus} />
        </div>
      </div>

      {b.reminderSentAt && <p className="mt-1 font-sans text-xs opacity-60">Reminder emailed</p>}
      {b.notes && <p className="mt-2 border-l border-white/30 pl-3 font-sans text-sm whitespace-pre-line opacity-80">{b.notes}</p>}

      <div className="mt-2 flex flex-wrap gap-x-4 font-sans text-sm">
        <a href={`tel:${b.phone.replace(/\s/g, '')}`} className="inline-flex min-h-11 items-center gap-1.5 hover:underline">
          <Phone aria-hidden className="size-4" /> {b.phone}
        </a>
        <a href={`https://wa.me/${waNumber(b.phone)}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1.5 hover:underline">
          <MessageCircle aria-hidden className="size-4" /> WhatsApp
        </a>
        <a href={`mailto:${b.email}`} className="inline-flex min-h-11 items-center gap-1.5 break-all hover:underline">
          <Mail aria-hidden className="size-4" /> {b.email}
        </a>
      </div>

      {b.status === 'needs_attention' && (
        <p className="mt-2 font-sans text-sm">Paid after the hold lapsed and the slot was taken. Contact the client to rebook, or refund them in PayFast.</p>
      )}

      {error && (
        <div className="mt-3">
          <Notice kind="error">{error}</Notice>
        </div>
      )}

      {editable && mode === 'view' && (
        <div className="mt-2 flex flex-wrap gap-2">
          <SmallButton onClick={() => setMode('reschedule')}>Reschedule</SmallButton>
          <SmallButton variant="text" onClick={() => setMode('cancel')}>
            Cancel booking
          </SmallButton>
        </div>
      )}

      {mode === 'reschedule' && (
        <div className="mt-3 space-y-3 border-t border-white/15 pt-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block font-sans text-sm">
              <span className="ui-label opacity-70">New date</span>
              <input
                type="date"
                value={date}
                min={todayInSast()}
                onChange={(e) => {
                  setDate(e.target.value);
                  setTime('');
                }}
                className={`${inputCls} mt-1`}
              />
            </label>
            <label className="block font-sans text-sm">
              <span className="ui-label opacity-70">New time</span>
              <select value={time} onChange={(e) => setTime(e.target.value)} className={`${inputCls} mt-1`} disabled={loadingSlots}>
                <option value="">{loadingSlots ? 'Loading…' : options?.slots.length ? 'Choose a time' : 'No free times that day'}</option>
                {!loadingSlots && options?.slots.map((t) => <option key={t}>{t}</option>)}
              </select>
            </label>
          </div>
          <p className="font-sans text-xs opacity-60">The client is emailed the new time. {date ? formatLongDate(date) : ''}</p>
          <div className="flex flex-wrap gap-2">
            <SmallButton variant="solid" busy={busy} disabled={!time} onClick={() => void act(() => adminApi.reschedule(b.id, date, time))}>
              Move booking
            </SmallButton>
            <SmallButton variant="text" onClick={() => setMode('view')}>
              Keep as is
            </SmallButton>
          </div>
        </div>
      )}

      {mode === 'cancel' && (
        <div className="mt-3 space-y-3 border-t border-white/15 pt-3">
          <p className="font-sans text-sm">
            Cancel {b.clientName}’s {b.serviceName.toLowerCase()} on {formatLongDate(b.date)} at {b.time}? The slot is freed and the client is emailed.
            {b.paymentStatus === 'paid' && ' Any refund is issued separately in PayFast.'}
          </p>
          <div className="flex flex-wrap gap-2">
            <SmallButton variant="solid" busy={busy} onClick={() => void act(() => adminApi.cancel(b.id))}>
              Yes, cancel it
            </SmallButton>
            <SmallButton variant="text" onClick={() => setMode('view')}>
              Keep booking
            </SmallButton>
          </div>
        </div>
      )}
    </li>
  );
}
