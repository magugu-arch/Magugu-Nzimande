'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Check, Gift, Ticket } from '@/components/ui/icons';
import { whatsappLink } from '@/content/site';
import { rand } from '@/lib/format';

type Status = {
  ref: string;
  kind: 'adventure' | 'voucher' | 'event';
  status: string;
  payable: number;
  summary: string;
  ticketUrl: string | null;
  vouchers: { code: string; url: string; label: string; recipient: string }[];
};

/** PayFast's ITN can land a few seconds after the visitor returns, so poll briefly. */
export function PaymentReturn({ id }: { id: string }) {
  const cancelled = useSearchParams().get('cancelled') === '1';
  const [s, setS] = useState<Status | null>(null);
  const [tries, setTries] = useState(0);

  useEffect(() => {
    let alive = true;
    let n = 0;
    const tick = async () => {
      try {
        const r = await fetch(`/api/bookings/${id}`, { cache: 'no-store' });
        if (r.ok) {
          const d = (await r.json()) as Status;
          if (!alive) return;
          setS(d);
          if (d.status === 'paid' || cancelled || ['cancelled', 'expired', 'refunded'].includes(d.status)) return;
        }
      } catch {
        /* retry */
      }
      n++;
      setTries(n);
      if (n < 30 && alive) window.setTimeout(tick, 2000);
    };
    tick();
    return () => {
      alive = false;
    };
  }, [id, cancelled]);

  const paid = s?.status === 'paid';

  return (
    <div className="card" style={{ width: 'min(100%, 560px)', gap: 16 }} aria-live="polite">
      {paid ? (
        <>
          <span style={{ display: 'grid', placeItems: 'center', width: 56, height: 56, borderRadius: '50%', background: 'var(--go)', color: '#fff' }}>
            <Check width={30} height={30} />
          </span>
          <p className="eyebrow">{s.kind === 'voucher' ? 'Gift a Jump' : 'Booked'}</p>
          <h1 className="h2">{s.kind === 'voucher' ? 'Your gift is on its way.' : 'You’re in the #100mClub queue.'}</h1>
          <p className="lede">
            {s.summary} · reference <strong>{s.ref}</strong>. We’ve sent the details to your email
            {s.kind !== 'voucher' ? ' and WhatsApp' : ''}.
          </p>
          {s.ticketUrl && (
            <Link href={s.ticketUrl as Route} className="btn btn--primary btn--lg">
              <Ticket width={20} height={20} /> Open your ticket
            </Link>
          )}
          {s.vouchers.length > 0 && (
            <div style={{ display: 'grid', gap: 10 }}>
              {s.vouchers.map((v) => (
                <Link key={v.code} href={v.url as Route} className="btn btn--light">
                  <Gift width={18} height={18} /> {v.label} for {v.recipient} · {v.code}
                </Link>
              ))}
            </div>
          )}
        </>
      ) : cancelled || (s && ['cancelled', 'expired'].includes(s.status)) ? (
        <>
          <p className="eyebrow">Payment not completed</p>
          <h1 className="h2">No payment was taken.</h1>
          <p className="lede">Your slot has been released. You can book again any time, or ask us on WhatsApp if something went wrong.</p>
          <div className="cluster">
            <Link href="/book" className="btn btn--primary">
              Book again
            </Link>
            <a href={whatsappLink(`Hi! My payment didn’t go through${s ? ` for ${s.ref}` : ''}.`)} className="btn btn--light" target="_blank" rel="noopener">
              WhatsApp us
            </a>
          </div>
        </>
      ) : (
        <>
          <p className="eyebrow">Confirming payment</p>
          <h1 className="h2">One moment…</h1>
          <p className="lede">We’re waiting for the bank’s confirmation{s ? ` for ${rand(s.payable)}` : ''}. This usually takes a few seconds.</p>
          {tries >= 30 && <p className="muted">Still waiting. If you were charged, your ticket will arrive by email shortly. Reference: {s?.ref ?? '…'}.</p>}
        </>
      )}
    </div>
  );
}
