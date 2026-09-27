import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { formatPriceState } from '../../../shared/format';
import type { Service } from '../../../shared/types';
import { adminApi } from '../../lib/adminApi';
import { RequestError } from '../../lib/api';
import { inputCls, Loading, Notice, Panel, SmallButton } from './ui';

/** Rands as typed ("1 500", "1500.50") → cents, or null for blank. NaN if unreadable. */
function toCents(v: string): number | null {
  const clean = v.replace(/[\sR,]/gi, '');
  if (clean === '') return null;
  const n = Number(clean);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : NaN;
}
const toRands = (c: number | null) => (c == null ? '' : String(c / 100));

/**
 * Prices, deposits, durations and wording for each service. A blank price
 * means "Quote required" and books without payment; filling it in makes the
 * booking page take payment for that service straight away.
 */
export function ServicesAdmin() {
  const [services, setServices] = useState<Service[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    adminApi.services().then(
      (s) => live && setServices(s),
      (e: unknown) => live && setError(e instanceof RequestError ? e.message : 'Services could not be loaded.'),
    );
    return () => {
      live = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      <p className="max-w-2xl font-sans text-sm opacity-70">
        Leave the price blank for “Quote required”: clients book without paying and you quote after meeting. Add a price to take payment when they book, and a deposit to let them pay part now.
      </p>
      {error && <Notice kind="error">{error}</Notice>}
      {!services && !error && <Loading />}
      {services?.map((s) => (
        <ServiceRow key={s.id} service={s} onSaved={(n) => setServices((list) => list?.map((x) => (x.id === n.id ? n : x)) ?? null)} />
      ))}
    </div>
  );
}

function ServiceRow({ service, onSaved }: { service: Service; onSaved: (s: Service) => void }) {
  const [price, setPrice] = useState(toRands(service.priceCents));
  const [deposit, setDeposit] = useState(toRands(service.depositCents));
  const [duration, setDuration] = useState(String(service.durationMinutes));
  const [description, setDescription] = useState(service.description);
  const [active, setActive] = useState(service.active);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const id = service.id;

  async function save(e: FormEvent) {
    e.preventDefault();
    const priceCents = toCents(price);
    const depositCents = toCents(deposit);
    const local: Record<string, string> = {};
    if (Number.isNaN(priceCents)) local.priceCents = 'Enter an amount in rands, e.g. 1500.';
    if (Number.isNaN(depositCents)) local.depositCents = 'Enter an amount in rands, e.g. 500.';
    if (!Number.isInteger(Number(duration))) local.durationMinutes = 'Enter whole minutes.';
    if (Object.keys(local).length) {
      setErrors(local);
      return;
    }
    setBusy(true);
    setErrors({});
    setMessage(null);
    try {
      const updated = await adminApi.updateService(id, { priceCents, depositCents, durationMinutes: Number(duration), description, active });
      onSaved(updated);
      setMessage({ kind: 'ok', text: `Saved. Clients now see “${formatPriceState(updated.priceCents)}”.` });
    } catch (err) {
      const r = err instanceof RequestError ? err : null;
      setErrors(r?.fields ?? {});
      setMessage({ kind: 'error', text: r?.message ?? 'Could not save. Please try again.' });
    } finally {
      setBusy(false);
    }
  }

  const lbl = (text: string, key: string, input: ReactNode, hint?: string) => (
    <label className="block font-sans text-sm">
      <span className="ui-label opacity-70">{text}</span>
      <span className="mt-1 block">{input}</span>
      {errors[key] ? <span className="mt-1 block">{errors[key]}</span> : hint && <span className="mt-1 block text-xs opacity-50">{hint}</span>}
    </label>
  );

  return (
    <Panel
      title={service.name}
      action={
        <label className="flex min-h-11 items-center gap-2 font-sans text-sm">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="size-4 accent-white" />
          Shown on the site
        </label>
      }
    >
      <form onSubmit={(e) => void save(e)} noValidate className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          {lbl('Price (R)', 'priceCents', <input id={`${id}-price`} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Quote required" className={inputCls} />, 'Blank = quote required')}
          {lbl('Deposit (R)', 'depositCents', <input id={`${id}-deposit`} inputMode="decimal" value={deposit} onChange={(e) => setDeposit(e.target.value)} placeholder="No deposit option" className={inputCls} />, 'Optional, less than the price')}
          {lbl('Duration (minutes)', 'durationMinutes', <input id={`${id}-duration`} inputMode="numeric" value={duration} onChange={(e) => setDuration(e.target.value)} className={inputCls} />, 'Blocks this much of the diary')}
        </div>
        {lbl('Description', 'description', <textarea id={`${id}-desc`} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} className={`${inputCls} py-2`} />)}
        {message && <Notice kind={message.kind}>{message.text}</Notice>}
        <SmallButton type="submit" variant="solid" busy={busy}>
          Save {service.name.split(' ')[0]}
        </SmallButton>
      </form>
    </Panel>
  );
}
