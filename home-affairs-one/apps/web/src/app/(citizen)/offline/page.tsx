import { Container, LinkButton, OfflineState } from '@hao/design-system';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'You are offline' };

/** Shown by the service worker when a page cannot be reached and is not cached. */
export default function OfflinePage() {
  return (
    <Container width="narrow" style={{ paddingBlock: 'var(--space-7)' }}>
      <h1 className="visually-hidden">Offline</h1>
      <OfflineState>
        <p>
          This page has not been saved on your device yet. Pages you have already opened still work,
          and any draft you saved is safe.
        </p>
        <p>When you are back online, carry on where you left off.</p>
      </OfflineState>
      <p style={{ marginTop: 'var(--space-5)' }}>
        <LinkButton href="/" variant="secondary">
          Go to the start page
        </LinkButton>
      </p>
    </Container>
  );
}
