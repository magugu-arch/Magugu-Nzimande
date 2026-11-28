'use client';

import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import styles from './page.module.css';

export function DemoPay({ id, amount }: { id: string; amount: string }) {
  const [busy, setBusy] = useState<'pay' | 'cancel' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function act(action: 'pay' | 'cancel') {
    setBusy(action);
    setError(null);
    try {
      const res = await fetch('/api/payments/demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).reason ?? 'Payment failed');
      // replace: Back from the confirmation shouldn't land on a checkout that's already finished.
      router.replace(`/booking/${id}/return${action === 'cancel' ? '?cancelled=1' : ''}` as Route);
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  }

  return (
    <div className={styles.actions}>
      <div className={styles.fakeCard} aria-hidden>
        <span>Card ending 4242</span>
        <span>12/30</span>
      </div>
      <button className="btn btn--primary btn--lg btn--block" onClick={() => act('pay')} disabled={!!busy}>
        {busy === 'pay' ? 'Paying…' : `Pay ${amount}`}
      </button>
      <button className="btn btn--light btn--block" onClick={() => act('cancel')} disabled={!!busy}>
        Cancel payment
      </button>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
