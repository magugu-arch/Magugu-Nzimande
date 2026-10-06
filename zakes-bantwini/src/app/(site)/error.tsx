'use client';

import { useEffect } from 'react';
import { Button, ButtonLink } from '@/components/ui/Button';

export default function SiteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="container section" style={{ paddingTop: 'calc(var(--header-h) + 96px)', display: 'grid', gap: 24, justifyItems: 'start' }}>
      <p className="eyebrow eyebrow-accent">Something went wrong</p>
      <h1 className="display display-m">This page did not load</h1>
      <p className="lede">The problem is on our side. Try again — and if you were sending a booking request, nothing was submitted twice.</p>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <Button onClick={reset}>Try again</Button>
        <ButtonLink href="/" variant="outline">
          Home
        </ButtonLink>
      </div>
      {error.digest && <p className="muted">Reference: {error.digest}</p>}
    </div>
  );
}
