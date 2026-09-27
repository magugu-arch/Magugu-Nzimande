import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { ButtonLink } from '../components/ui/Button';
import { api, RequestError } from '../lib/api';
import { useTitle } from '../lib/useTitle';

/** Target of the link in every newsletter email. One click, no login, no questions. */
export default function Unsubscribe() {
  useTitle('Unsubscribe');
  const [params] = useSearchParams();
  const email = params.get('email') ?? '';
  const token = params.get('token') ?? '';
  const [state, setState] = useState<'working' | 'done' | 'error'>(email && token ? 'working' : 'error');
  const [message, setMessage] = useState(email && token ? '' : 'This unsubscribe link is incomplete.');

  useEffect(() => {
    if (!email || !token) return;
    let live = true;
    api.unsubscribe({ email, token }).then(
      () => live && setState('done'),
      (e: unknown) => {
        if (!live) return;
        setState('error');
        setMessage(e instanceof RequestError ? e.message : 'Something went wrong.');
      },
    );
    return () => {
      live = false;
    };
  }, [email, token]);

  return (
    <section className="page-gutter flex min-h-[80svh] flex-col justify-end pt-32 pb-24" aria-live="polite">
      <p className="ui-label mb-8 opacity-60">(Newsletter)</p>
      {state === 'working' && <h1 className="editorial-title text-5xl lg:text-7xl">One moment…</h1>}
      {state === 'done' && (
        <>
          <h1 className="editorial-title text-5xl lg:text-7xl">
            You’re <span className="editorial-italic">unsubscribed.</span>
          </h1>
          <p className="mt-6 max-w-md opacity-70">{email} will not receive any more newsletter emails from Grateful. Booking confirmations are not affected.</p>
        </>
      )}
      {state === 'error' && (
        <>
          <h1 className="editorial-title text-5xl lg:text-7xl">We couldn’t unsubscribe you</h1>
          <p className="mt-6 max-w-md opacity-70">{message} Reply to any of our emails with “unsubscribe” and we will remove you by hand.</p>
        </>
      )}
      <div className="mt-10">
        <ButtonLink to="/" variant="secondary">
          Back to home
        </ButtonLink>
      </div>
    </section>
  );
}
