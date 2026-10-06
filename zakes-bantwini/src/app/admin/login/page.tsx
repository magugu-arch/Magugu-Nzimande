'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useActionState } from 'react';
import { FormAlert, TextField } from '@/components/forms/fields';
import { Button } from '@/components/ui/Button';
import { loginAction, type AdminState } from '../actions';
import styles from '../admin.module.css';

function LoginForm() {
  const next = useSearchParams().get('next') ?? '/admin';
  const [state, action, pending] = useActionState<AdminState, FormData>(loginAction, { ok: false, message: null });
  return (
    <form action={action} className={styles.loginCard}>
      <div>
        <p className="eyebrow eyebrow-accent">Zakes Bantwini</p>
        <h1 style={{ fontSize: 'var(--step-2)', fontWeight: 500 }}>Management sign in</h1>
      </div>
      {state.message && <FormAlert>{state.message}</FormAlert>}
      <input type="hidden" name="next" value={next} />
      <TextField name="email" label="Email" type="email" autoComplete="username" />
      <TextField name="password" label="Password" type="password" autoComplete="current-password" />
      <Button type="submit" disabled={pending}>
        {pending ? 'Signing in…' : 'Sign in'}
      </Button>
      <p className="muted" style={{ fontSize: 13 }}>
        Access is limited to management. Attempts are rate-limited and sessions expire after eight hours.
      </p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className={styles.login}>
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
