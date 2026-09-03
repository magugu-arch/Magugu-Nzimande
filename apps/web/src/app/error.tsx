'use client';

import { useEffect } from 'react';
import { Button, ButtonLink } from '@/components/ui/Button';
import { logger } from '@/lib/observability/log';

/**
 * When a page throws.
 *
 * There was no such file, so any render error anywhere in the site showed the
 * framework's default — in production a white page reading "Application error:
 * a client-side exception has occurred", with no branding, no way back and
 * nothing a customer could do except leave.
 *
 * `reset` re-renders the segment that failed. Offered first, because a good
 * share of these are one bad response rather than a broken build, and trying
 * again is both the cheapest fix and the one a customer expects to exist.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    /**
     * Recorded through the same logger as everything else, so this reaches
     * whatever the deployment points at rather than only the browser console.
     *
     * The digest is Next's own id for the error, and is what ties this to the
     * stack trace on the server — the message a client component sees in
     * production is deliberately redacted, so without it there is nothing to
     * search for.
     */
    logger.error('page.render_failed', { digest: error.digest ?? null });
  }, [error]);

  return (
    <div className="mx-auto w-full max-w-[1240px] px-5 py-20">
      <div className="mx-auto max-w-[52ch] text-center">
        <p className="display inline-flex items-center gap-2.5 text-sm tracking-[0.16em] text-red">
          <span aria-hidden="true" className="block h-0.5 w-5 bg-red" />
          Something went wrong
        </p>
        <h1 className="display mt-2 text-[clamp(2.1rem,5vw,3.4rem)]">
          That did not load
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Nothing you were doing has been lost — your basket is where you left it. Try again, and
          if it keeps happening the store will take your order over the telephone.
        </p>

        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Button onClick={reset}>Try again</Button>
          <ButtonLink href="/menu" variant="black">
            Back to the menu
          </ButtonLink>
          <ButtonLink href="/stores" variant="ghost">
            Store numbers
          </ButtonLink>
        </div>

        {error.digest && (
          // Shown so somebody ringing the store can read it out. It is an
          // opaque id, not a stack trace: nothing about the failure leaks here.
          <p className="mt-6 text-xs text-muted">
            Reference <span className="tabular font-bold">{error.digest}</span>
          </p>
        )}
      </div>
    </div>
  );
}
