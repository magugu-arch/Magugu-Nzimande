'use client';

import { useActionState, useEffect, useRef, useState, useTransition } from 'react';
import { Checkbox, FormAlert, TextArea, TextField } from '@/components/forms/fields';
import { Button } from '@/components/ui/Button';
import { track } from '@/lib/analytics/client';
import type { Checkout } from '@/lib/payments/types';
import type { PortalActionState } from '@/app/(site)/book/actions';
import styles from './Portal.module.css';

const initial: PortalActionState = { ok: false, message: null };

type Bound = (prev: PortalActionState, form: FormData) => Promise<PortalActionState>;

function Result({ state }: { state: PortalActionState }) {
  if (!state.message) return null;
  return <FormAlert tone={state.ok ? 'success' : 'error'}>{state.message}</FormAlert>;
}

export function QuoteResponse({ accept, requestChanges }: { accept: Bound; requestChanges: Bound }) {
  const [acceptState, acceptAction, accepting] = useActionState(accept, initial);
  const [changeState, changeAction, sending] = useActionState(requestChanges, initial);
  const [showChanges, setShowChanges] = useState(false);


  return (
    <div className={styles.respond} aria-live="polite">
      <Result state={acceptState} />
      <Result state={changeState} />
      {!acceptState.ok && !changeState.ok && (
        <>
          <form action={acceptAction}>
            <Button type="submit" disabled={accepting} aria-busy={accepting}>
              {accepting ? 'Accepting…' : 'Accept quote'}
            </Button>
          </form>
          {!showChanges ? (
            <Button variant="outline" onClick={() => setShowChanges(true)}>
              Request changes
            </Button>
          ) : (
            <form action={changeAction} className={styles.changes}>
              <TextArea name="note" label="What would you like changed?" rows={4} required />
              <Button type="submit" variant="outline" disabled={sending}>
                {sending ? 'Sending…' : 'Send to the booking team'}
              </Button>
            </form>
          )}
        </>
      )}
    </div>
  );
}

export function SignAgreement({ sign, defaultName }: { sign: Bound; defaultName: string }) {
  // quote_accepted and contract_signed are recorded server-side, on success only.
  const [state, action, pending] = useActionState(sign, initial);
  if (state.ok) return <Result state={state} />;
  return (
    <form action={action} className={styles.sign}>
      <Result state={state} />
      <TextField name="signerName" label="Type your full name to sign" defaultValue={defaultName} autoComplete="name" />
      <Checkbox name="agree" label="I have read the agreement above, I am authorised to sign it, and I agree to its terms." />
      <Button type="submit" disabled={pending} aria-busy={pending}>
        {pending ? 'Signing…' : 'Sign agreement'}
      </Button>
    </form>
  );
}

/**
 * Starts a payment on the server, then hands the browser to the provider:
 * a form POST for PayFast, a plain navigation for redirect-style gateways.
 */
export function PayButton({ start, label }: { start: () => Promise<{ checkout: Checkout | null; message: string | null }>; label: string }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [checkout, setCheckout] = useState<Checkout | null>(null);
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (checkout?.method === 'POST') form.current?.submit();
    if (checkout?.method === 'GET') {
      const url = new URL(checkout.action, window.location.href);
      for (const [k, v] of Object.entries(checkout.fields)) url.searchParams.set(k, v);
      window.location.assign(url.toString());
    }
  }, [checkout]);

  return (
    <div className={styles.pay}>
      {message && <FormAlert>{message}</FormAlert>}
      <Button
        disabled={pending || Boolean(checkout)}
        aria-busy={pending}
        onClick={() =>
          startTransition(async () => {
            setMessage(null);
            const result = await start();
            if (result.checkout) setCheckout(result.checkout);
            else setMessage(result.message);
          })
        }
      >
        {pending || checkout ? 'Opening secure payment…' : label}
      </Button>
      <p className="muted">Payment is handled by the provider on their secure page. Card details never reach this website.</p>
      {checkout?.method === 'POST' && (
        <form ref={form} method="post" action={checkout.action} hidden>
          {Object.entries(checkout.fields).map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
        </form>
      )}
    </div>
  );
}

export function TrackOnView({ event }: { event: 'quote_viewed' }) {
  useEffect(() => {
    track(event);
  }, [event]);
  return null;
}
