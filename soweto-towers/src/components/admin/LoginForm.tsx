'use client';

import { startTransition, useActionState, useEffect, useRef } from 'react';
import { login, type LoginState } from '@/app/admin/actions';
import styles from './admin.module.css';

/**
 * Crew sign-in. The fields are left to the browser (uncontrolled) and the form
 * is sent from onSubmit rather than as a form action, so nothing is ever reset:
 * what was typed survives a wrong password, the second step (the authenticator
 * code), and a page that was still loading when someone started typing.
 * Where to go afterwards (?next=) is read from the address at the moment of
 * sending, so the form renders once and never needs swapping.
 */
export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, null);
  const codeRef = useRef<HTMLInputElement>(null);
  const showCode = !!state?.needCode;

  useEffect(() => {
    if (showCode) codeRef.current?.focus();
  }, [showCode, state]);

  return (
    <form
      className={styles.form}
      onSubmit={(e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        form.set('next', new URLSearchParams(window.location.search).get('next') ?? '/admin');
        startTransition(() => action(form));
      }}
    >
      <div className="field">
        <label className="field-label" htmlFor="email">
          Email
        </label>
        <input id="email" name="email" type="email" className="input" autoComplete="username" inputMode="email" required />
      </div>
      <div className="field">
        <label className="field-label" htmlFor="password">
          Password
        </label>
        <input id="password" name="password" type="password" className="input" autoComplete="current-password" required />
      </div>
      {showCode && (
        <div className="field">
          <label className="field-label" htmlFor="code">
            Authenticator code
          </label>
          <input
            ref={codeRef}
            id="code"
            name="code"
            className="input"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            placeholder="6 digits"
          />
        </div>
      )}
      {state?.error && (
        <p role="alert" className={`${styles.message} ${styles.messageErr}`}>
          {state.error}
        </p>
      )}
      <button className="btn btn--primary btn--lg btn--block" disabled={pending}>
        {pending ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
