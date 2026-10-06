import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { formatZar } from '@/lib/booking/quote';
import { handlePaymentNotification } from '@/lib/booking/service';
import { getPaymentProvider } from '@/lib/payments';
import { sandboxSignature } from '@/lib/payments/sandbox';
import { safeEqual } from '@/lib/security/crypto';
import styles from '@/components/booking/Portal.module.css';

export const metadata: Metadata = { title: 'Sandbox payment', robots: { index: false, follow: false } };

function sameOriginPath(url: string): string {
  try {
    const u = new URL(url);
    return `${u.pathname}${u.search}`;
  } catch {
    return '/';
  }
}

/**
 * The sandbox gateway's "checkout" — development and smoke tests only. It
 * renders nothing unless the sandbox provider is active, and every action
 * re-signs its notification server-side exactly as a real gateway would.
 */
export default async function SandboxPayPage(props: PageProps<'/book/pay/sandbox'>) {
  const q = await props.searchParams; // request-time: the provider is chosen by runtime env
  let provider;
  try {
    provider = getPaymentProvider();
  } catch {
    notFound();
  }
  if (provider.id !== 'sandbox') notFound();

  const get = (k: string) => (typeof q[k] === 'string' ? (q[k] as string) : '');
  const ref = get('ref');
  const amount = get('amount');
  if (!ref || !amount || !safeEqual(get('sig'), sandboxSignature(ref, amount))) notFound();
  const returnTo = sameOriginPath(get('return_url'));
  const cancelTo = sameOriginPath(get('cancel_url'));

  async function settle(outcome: 'complete' | 'failed') {
    'use server';
    const body = new URLSearchParams({ ref, amount, outcome, sig: sandboxSignature(ref, amount, outcome) });
    await handlePaymentNotification('sandbox', { body: body.toString(), contentType: 'application/x-www-form-urlencoded', ip: '127.0.0.1' });
    redirect(outcome === 'complete' ? returnTo : cancelTo);
  }

  return (
    <div className={`container ${styles.page}`}>
      <header className={styles.head}>
        <p className="eyebrow eyebrow-accent">Sandbox gateway · no money moves</p>
        <h1 className="display display-m">Test payment</h1>
        <p className="lede">
          {get('booking')} · {formatZar(Number(amount))}
        </p>
        <p className="muted">This page stands in for PayFast or Peach Payments in development. In production it does not exist.</p>
      </header>
      <div className={styles.respond}>
        <form action={settle.bind(null, 'complete')}>
          <Button type="submit">Simulate successful payment</Button>
        </form>
        <form action={settle.bind(null, 'failed')}>
          <Button type="submit" variant="outline">
            Simulate failed payment
          </Button>
        </form>
      </div>
    </div>
  );
}
