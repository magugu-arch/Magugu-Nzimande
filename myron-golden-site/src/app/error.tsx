'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { buttonClasses } from '@/components/ui/Button';

/**
 * Something failed while rendering. No stack trace or message is shown —
 * only the digest, which the team can match against server logs.
 */
export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error('[page error]', error.digest ?? 'no digest');
  }, [error]);

  return (
    <section className="grain flex min-h-[70svh] items-center bg-ink pt-[var(--header-h)]">
      <div className="container-site py-20">
        <p className="type-eyebrow text-gold">Something went wrong</p>
        <h1 className="type-display-lg mt-5 max-w-2xl">This page could not load just now</h1>
        <p className="type-lede mt-5 max-w-lg text-ivory/75">
          It is a problem on our side, not yours. Try again, or come back in a few minutes.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <button type="button" onClick={() => retry()} className={buttonClasses('primary')}>
            Try again
          </button>
          <Link href="/" className={buttonClasses('secondary')}>
            Go home
          </Link>
        </div>
        {error.digest ? (
          <p className="mt-8 text-[0.8rem] text-ivory/45">Reference: {error.digest}</p>
        ) : null}
      </div>
    </section>
  );
}
