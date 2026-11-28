'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Minus, Plus } from '@/components/ui/icons';
import { rand } from '@/lib/format';
import styles from '../page.module.css';

export function EventTicketForm({ slug, price }: { slug: string; price: number | null }) {
  const [qty, setQty] = useState(1);
  const [contact, setContact] = useState({ name: '', email: '', phone: '' });
  const [consents, setConsents] = useState({ terms: false, whatsapp: true, marketing: false });
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [payfast, setPayfast] = useState<{ action: string; fields: Record<string, string> } | null>(null);
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (payfast) form.current?.submit();
  }, [payfast]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrors([]);
    try {
      const res = await fetch('/api/events/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, qty, contact, consents }),
      });
      const d = await res.json();
      if (!d.ok) return setErrors(d.errors ?? ['Something went wrong.']);
      const v = d.value;
      if (v.ticketUrl) window.location.assign(v.ticketUrl);
      else if (v.payment?.kind === 'redirect') window.location.assign(v.payment.url);
      else if (v.payment?.kind === 'form') setPayfast(v.payment);
    } catch {
      setErrors(['We couldn’t reach the booking system. Check your connection.']);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <form onSubmit={submit} noValidate style={{ display: 'grid', gap: 12 }}>
        <div className={styles.row}>
          <span className="field-label">{price ? 'Tickets' : 'People'}</span>
          <div className={styles.stepper}>
            <button type="button" aria-label="One fewer" onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1}>
              <Minus />
            </button>
            <output className="num">{qty}</output>
            <button type="button" aria-label="One more" onClick={() => setQty((q) => Math.min(20, q + 1))} disabled={qty >= 20}>
              <Plus />
            </button>
          </div>
        </div>
        <label className="field">
          <span className="field-label">Full name</span>
          <input className="input" autoComplete="name" value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} />
        </label>
        <label className="field">
          <span className="field-label">Mobile (WhatsApp)</span>
          <input
            className="input"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            value={contact.phone}
            onChange={(e) => setContact({ ...contact, phone: e.target.value })}
          />
        </label>
        <label className="field">
          <span className="field-label">Email</span>
          <input
            className="input"
            type="email"
            autoComplete="email"
            inputMode="email"
            value={contact.email}
            onChange={(e) => setContact({ ...contact, email: e.target.value })}
          />
        </label>
        <label className="check">
          <input type="checkbox" checked={consents.whatsapp} onChange={(e) => setConsents({ ...consents, whatsapp: e.target.checked })} />
          <span>Send my ticket and updates on WhatsApp.</span>
        </label>
        <label className="check">
          <input type="checkbox" checked={consents.terms} onChange={(e) => setConsents({ ...consents, terms: e.target.checked })} />
          <span>
            I accept the <Link href="/legal/terms">terms</Link>.
          </span>
        </label>
        {errors.length > 0 && (
          <div className={styles.errors} role="alert">
            {errors.map((x) => (
              <p key={x}>{x}</p>
            ))}
          </div>
        )}
        <button className="btn btn--primary btn--lg btn--block" disabled={busy}>
          {busy ? 'One moment…' : price ? `Pay ${rand(price * qty)}` : 'RSVP'}
        </button>
      </form>
      {payfast && (
        <form ref={form} method="post" action={payfast.action} className="visually-hidden" aria-hidden>
          {Object.entries(payfast.fields).map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
        </form>
      )}
    </>
  );
}
