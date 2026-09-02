'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

/**
 * The console's sign-in.
 *
 * The passphrase never reaches a query string or this component's state after
 * submission, and the session it buys is an httpOnly cookie the page cannot
 * read — so a script injected into the console cannot walk off with it.
 */
export function SignIn() {
  const router = useRouter();
  const [passphrase, setPassphrase] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ passphrase }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? 'Could not sign in.');
        setPassphrase('');
        return;
      }

      router.replace('/admin');
      router.refresh();
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-8 max-w-[34rem]">
      <label htmlFor="passphrase" className="block text-sm font-semibold">
        Console passphrase
      </label>

      <input
        id="passphrase"
        name="passphrase"
        type="password"
        autoComplete="current-password"
        required
        value={passphrase}
        onChange={(event) => setPassphrase(event.target.value)}
        aria-invalid={error !== null}
        aria-describedby={error ? 'passphrase-error' : undefined}
        className="mt-2 w-full rounded-md border border-line-strong bg-white px-4 py-3 text-base outline-none focus-visible:border-red focus-visible:ring-2 focus-visible:ring-red/40"
      />

      {error ? (
        // Announced rather than only shown, so it reaches a screen reader that
        // is not looking at the field.
        <p id="passphrase-error" role="alert" className="mt-3 text-sm font-semibold text-red">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={busy || passphrase.length === 0}
        className="mt-5 inline-flex min-h-[44px] items-center rounded-pill bg-red px-6 font-extrabold text-white disabled:opacity-50"
      >
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
