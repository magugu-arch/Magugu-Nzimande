'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { finishSignIn, isLive, refreshLive } from '@/lib/store';

/**
 * Where NMU SSO returns staff after they sign in (live mode). The one-time
 * code is exchanged with the verifier this tab kept, and the console opens.
 */
export default function AuthCallback() {
  const router = useRouter();
  const [problem, setProblem] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (!isLive) {
      router.replace('/');
      return;
    }
    void (async () => {
      try {
        await finishSignIn(window.location.href);
        await refreshLive();
        router.replace('/');
      } catch (e) {
        setProblem(e instanceof Error ? e.message : 'Sign-in didn’t complete.');
      }
    })();
  }, [router]);

  return problem ? (
    <section className="stack sign-in" role="alert">
      <h1>Sign-in didn’t complete</h1>
      <p className="muted">{problem}</p>
      <div>
        <button type="button" className="btn primary" onClick={() => router.replace('/')}>
          Back to sign-in
        </button>
      </div>
    </section>
  ) : (
    <div className="loading" aria-busy="true" aria-label="Signing you in">
      <div className="skeleton" style={{ width: '30%', height: 28 }} />
      <div className="skeleton" style={{ width: '60%' }} />
    </div>
  );
}
