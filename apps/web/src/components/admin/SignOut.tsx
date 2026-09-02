'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * Ends the session server side rather than only clearing the cookie here, so
 * a console left open on a pass counter can be closed from the counter.
 */
export function SignOut() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    try {
      await fetch('/api/admin/session', { method: 'DELETE' });
    } catch {
      // The redirect still runs: the guard on /admin decides, not this button.
    }
    router.replace('/admin/login');
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={busy}
      className="inline-flex min-h-[44px] items-center rounded-pill border border-line-strong bg-white px-5 text-sm font-extrabold disabled:opacity-50"
    >
      {busy ? 'Signing out…' : 'Sign out'}
    </button>
  );
}
