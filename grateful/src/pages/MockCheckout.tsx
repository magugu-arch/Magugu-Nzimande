import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { formatRand } from '../../shared/format';
import { Alert } from '../components/forms/Field';
import { Button } from '../components/ui/Button';
import { useTitle } from '../lib/useTitle';

/**
 * DEVELOPMENT ONLY — stands in for a gateway's hosted checkout when
 * PAYMENT_PROVIDER=mock. It posts a signed notification to the same webhook
 * route a real gateway uses, then returns to the site, so the whole
 * verify → confirm → email path runs locally. The server refuses the mock
 * provider in production.
 */
export default function MockCheckout() {
  useTitle('Test checkout');
  const [p] = useSearchParams();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reference = p.get('reference') ?? '';
  const amount = Number(p.get('amount') ?? 0);

  async function finish(outcome: 'paid' | 'failed') {
    setBusy(outcome);
    setError(null);
    const body = new URLSearchParams({ reference, outcome, amount: String(amount), signature: p.get(outcome === 'paid' ? 'sig_paid' : 'sig_failed') ?? '' });
    const res = await fetch('/api/webhooks/mock', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body }).catch(() => null);
    if (!res?.ok) {
      setError('The test notification was rejected.');
      setBusy(null);
      return;
    }
    const back = outcome === 'paid' ? p.get('return_url') : p.get('cancel_url');
    window.location.assign(back ? new URL(back).pathname + new URL(back).search : '/');
  }

  return (
    <div className="page-gutter flex min-h-svh items-center justify-center pt-24 pb-24">
      <div className="w-full max-w-md border border-dashed border-white/40 p-8">
        <p className="ui-label opacity-60">Test checkout — no money moves</p>
        <h1 className="mt-4 font-serif text-3xl">{p.get('item')}</h1>
        <p className="mt-6 font-serif text-5xl">{formatRand(amount)}</p>
        <p className="mt-2 font-sans text-xs break-all opacity-50">Ref {reference}</p>
        {error && (
          <div className="mt-6">
            <Alert kind="error">{error}</Alert>
          </div>
        )}
        <div className="mt-8 flex flex-col gap-3">
          <Button onClick={() => void finish('paid')} loading={busy === 'paid'} disabled={!!busy}>
            Simulate successful payment
          </Button>
          <Button variant="secondary" onClick={() => void finish('failed')} loading={busy === 'failed'} disabled={!!busy}>
            Simulate failed payment
          </Button>
        </div>
      </div>
    </div>
  );
}
