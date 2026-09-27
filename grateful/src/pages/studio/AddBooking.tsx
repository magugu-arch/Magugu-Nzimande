import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { formatDuration, todayInSast } from '../../../shared/format';
import type { Service } from '../../../shared/types';
import { adminApi } from '../../lib/adminApi';
import { RequestError } from '../../lib/api';
import { inputCls, Notice, SmallButton } from './ui';

/**
 * Record a booking taken by phone, WhatsApp or in person. Only free times
 * are offered; the server checks again before saving. Payment for these is
 * settled with the studio directly, so none is requested online.
 */
export function AddBooking({ onDone, onCancel }: { onDone: (date: string) => void; onCancel: () => void }) {
  const [services, setServices] = useState<Service[] | null>(null);
  const [serviceId, setServiceId] = useState('');
  const [date, setDate] = useState(todayInSast());
  const [slots, setSlots] = useState<{ key: string; list: string[] } | null>(null);
  const [time, setTime] = useState('');
  const [clientName, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [notifyClient, setNotify] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    adminApi.services().then(
      (s) => {
        if (!live) return;
        const active = s.filter((x) => x.active);
        setServices(active);
        setServiceId((cur) => cur || active[0]?.id || '');
      },
      (e: unknown) => live && setMessage(e instanceof RequestError ? e.message : 'Services could not be loaded.'),
    );
    return () => {
      live = false;
    };
  }, []);

  const key = `${serviceId}|${date}`;
  useEffect(() => {
    if (!serviceId || !date) return;
    let live = true;
    adminApi.studioSlots(serviceId, date).then(
      (list) => live && setSlots({ key, list }),
      () => live && setSlots({ key, list: [] }),
    );
    return () => {
      live = false;
    };
  }, [serviceId, date, key]);
  const loadingSlots = slots?.key !== key;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setMessage(null);
    try {
      await adminApi.createBooking({ serviceId, date, time, clientName, phone, email, notes, notifyClient });
      onDone(date);
    } catch (err) {
      const r = err instanceof RequestError ? err : null;
      setErrors(r?.fields ?? {});
      setMessage(r?.message ?? 'Could not save the booking. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  const field = (label: string, k: string, input: ReactNode, hint?: string) => (
    <label className="block font-sans text-sm">
      <span className="ui-label opacity-70">{label}</span>
      <span className="mt-1 block">{input}</span>
      {errors[k] ? <span className="mt-1 block">{errors[k]}</span> : hint && <span className="mt-1 block text-xs opacity-50">{hint}</span>}
    </label>
  );

  return (
    <form onSubmit={(e) => void submit(e)} noValidate className="mb-6 space-y-4 border border-white/30 p-4" aria-label="Add a booking">
      <p className="font-serif text-xl">Add a booking</p>
      <p className="font-sans text-xs opacity-60">For bookings taken by phone, WhatsApp or in person. It is confirmed straight away; any payment is settled with the studio.</p>
      <div className="grid gap-4 sm:grid-cols-3">
        {field(
          'Service',
          'serviceId',
          <select id="add-service" value={serviceId} onChange={(e) => (setServiceId(e.target.value), setTime(''))} className={inputCls}>
            {!services && <option>Loading…</option>}
            {services?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({formatDuration(s.durationMinutes)})
              </option>
            ))}
          </select>,
        )}
        {field('Date', 'date', <input id="add-date" type="date" min={todayInSast()} value={date} onChange={(e) => (setDate(e.target.value), setTime(''))} className={inputCls} />)}
        {field(
          'Time',
          'time',
          <select id="add-time" value={time} onChange={(e) => setTime(e.target.value)} className={inputCls} disabled={loadingSlots}>
            <option value="">{loadingSlots ? 'Loading…' : slots?.list.length ? 'Choose a time' : 'No free times that day'}</option>
            {!loadingSlots && slots?.list.map((t) => <option key={t}>{t}</option>)}
          </select>,
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {field('Client name', 'clientName', <input id="add-name" autoComplete="off" value={clientName} onChange={(e) => setName(e.target.value)} className={inputCls} />)}
        {field('Phone', 'phone', <input id="add-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} />)}
        {field('Email', 'email', <input id="add-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />, 'Optional')}
      </div>
      {field('Notes', 'notes', <textarea id="add-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={`${inputCls} py-2`} />, 'Optional')}
      <label className="flex min-h-11 items-center gap-2 font-sans text-sm">
        <input type="checkbox" checked={notifyClient} disabled={!email} onChange={(e) => setNotify(e.target.checked)} className="size-4 accent-white" />
        Email the client a confirmation {!email && <span className="opacity-50">(add an email first)</span>}
      </label>
      {message && <Notice kind="error">{message}</Notice>}
      <div className="flex flex-wrap gap-2">
        <SmallButton type="submit" variant="solid" busy={busy} disabled={!time || !clientName.trim() || !phone.trim()}>
          Save booking
        </SmallButton>
        <SmallButton variant="text" onClick={onCancel}>
          Cancel
        </SmallButton>
      </div>
    </form>
  );
}
