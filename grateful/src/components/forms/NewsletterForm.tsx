import { ArrowRight, LoaderCircle } from 'lucide-react';
import { useId } from 'react';
import { Link } from 'react-router';
import { newsletterSchema } from '../../../shared/validation';
import { api } from '../../lib/api';
import { useForm } from '../../lib/useForm';
import { Checkbox, Honeypot } from './Field';

/**
 * Email + consent, nothing else (brief §20.6). Used compact in the hero and
 * full in the footer.
 */
export function NewsletterForm({ tone = 'dark', compact = false, heading = 'Letters from the studio' }: { tone?: 'dark' | 'light'; compact?: boolean; heading?: string }) {
  const f = useForm(newsletterSchema, { email: '', consent: false });
  const id = useId();

  if (f.status === 'success') {
    return (
      <div role="status" className="font-serif">
        <p className={compact ? 'text-lg' : 'text-2xl'}>
          <em>Thank you.</em> You’re on the list.
        </p>
        <p className="mt-1 font-sans text-sm opacity-60">Check your inbox for a welcome note.</p>
      </div>
    );
  }

  const line = tone === 'dark' ? 'border-white/40 focus-within:border-white' : 'border-black/40 focus-within:border-black';

  return (
    <form
      noValidate
      aria-label="Newsletter signup"
      className="relative"
      onSubmit={(e) => {
        e.preventDefault();
        void f.submit((data) => api.newsletter(data));
      }}
    >
      {!compact && <p className="mb-4 font-serif text-2xl">{heading}</p>}
      <div className={`flex items-center border-b ${line}`}>
        <label htmlFor={`${id}-email`} className="sr-only">
          Email address
        </label>
        <input
          id={`${id}-email`}
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="Your email address"
          value={String(f.values.email)}
          onChange={(e) => f.set('email', e.target.value)}
          aria-invalid={!!f.errors.email || undefined}
          aria-describedby={f.errors.email ? `${id}-email-error` : undefined}
          className={`min-h-12 w-full bg-transparent py-3 text-base outline-none placeholder:opacity-50 ${tone === 'dark' ? 'text-white' : 'text-black'}`}
        />
        <button type="submit" aria-label="Subscribe" disabled={f.status === 'submitting'} className="inline-flex min-h-12 min-w-12 items-center justify-center">
          {f.status === 'submitting' ? <LoaderCircle aria-hidden className="size-5 animate-spin" /> : <ArrowRight aria-hidden className="size-5" />}
        </button>
      </div>
      {f.errors.email && (
        <p id={`${id}-email-error`} role="alert" className="mt-2 font-sans text-sm">
          {f.errors.email}
        </p>
      )}
      <div className="mt-2">
        <Checkbox
          tone={tone}
          checked={Boolean(f.values.consent)}
          onChange={(e) => f.set('consent', e.target.checked)}
          error={f.errors.consent}
          label={
            <>
              I’d like to receive occasional emails from Grateful. Unsubscribe at any time.{' '}
              <Link to="/privacy" className="underline">
                Privacy
              </Link>
            </>
          }
        />
      </div>
      {f.status === 'error' && !f.errors.email && !f.errors.consent && f.message && (
        <p role="alert" className="mt-2 font-sans text-sm">
          {f.message}
        </p>
      )}
      <Honeypot value={String(f.values.company ?? '')} onChange={(v) => f.set('company', v)} />
    </form>
  );
}
