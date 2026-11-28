'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useSearchParams } from 'next/navigation';
import { useActionState } from 'react';
import { Ticket, Video, WhatsAppGlyph } from '@/components/ui/icons';
import { whatsappLink } from '@/content/site';
import { formatDayLong } from '@/lib/time';
import { findJump, type FindState } from './actions';
import styles from './page.module.css';

export function FindForm() {
  const ref = useSearchParams().get('ref') ?? '';
  const [state, action, pending] = useActionState<FindState, FormData>(findJump, null);

  return (
    <div className={styles.stack}>
      <form action={action} className={`card ${styles.form}`}>
        <label className="field">
          <span className="field-label">Booking reference</span>
          <input
            name="ref"
            className="input num"
            defaultValue={state?.ok === false ? state.values.ref : state?.ok ? state.ref : ref}
            placeholder="ST-7K4P2Q"
            autoCapitalize="characters"
            required
          />
        </label>
        <label className="field">
          <span className="field-label">Email you booked with</span>
          <input
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            className="input"
            defaultValue={state?.ok === false ? state.values.email : ''}
            required
          />
        </label>
        <button className="btn btn--primary" disabled={pending}>
          {pending ? 'Looking…' : 'Find my jump'}
        </button>
        {state && !state.ok && (
          <p className="field-error" role="alert">
            {state.message}
          </p>
        )}
      </form>

      {state?.ok && (
        <section className={`card ${styles.result}`} aria-live="polite">
          <p className="eyebrow">{state.ref}</p>
          <h2 className="h3">{state.summary}</h2>
          {state.visitDate && <p className="muted">{formatDayLong(state.visitDate)}</p>}
          {state.clips.length > 0 ? (
            <ul role="list" className={styles.clips}>
              {state.clips.map((c) => (
                <li key={c.url}>
                  <a href={c.url} target="_blank" rel="noopener" className="btn btn--dark">
                    <Video width={18} height={18} /> {c.kind === 'scream' ? 'Scream Clip' : 'Full HD edit'}
                    {c.participant ? ` · ${c.participant}` : ''}
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p>{state.checkedIn ? 'Your clips are being edited. They usually arrive within the hour.' : 'Clips appear here after your jump.'}</p>
          )}
          <div className="cluster">
            <Link href={state.ticketUrl as Route} className="btn btn--light">
              <Ticket width={18} height={18} /> Ticket
            </Link>
            <a href={whatsappLink(`Hi! I’d like the full HD edit of my jump, booking ${state.ref}.`)} className="btn btn--light" target="_blank" rel="noopener">
              <WhatsAppGlyph size={18} /> Get the full edit
            </a>
          </div>
        </section>
      )}
    </div>
  );
}
