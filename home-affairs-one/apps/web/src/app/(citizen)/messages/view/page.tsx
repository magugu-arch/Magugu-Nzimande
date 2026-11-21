import { Container, LoadingState } from '@hao/design-system';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { RequireTier } from '@/components/RequireTier';
import { MessageScreen } from './MessageScreen';

export const metadata: Metadata = { title: 'Message' };

export default function MessagePage() {
  return (
    <RequireTier tier="A2" reason="read this message">
      {/* useSearchParams needs a Suspense boundary in a static export. */}
      <Suspense
        fallback={
          <Container width="narrow" style={{ paddingBlock: 'var(--space-6)' }}>
            <LoadingState label="Loading message" rows={2} />
          </Container>
        }
      >
        <MessageScreen />
      </Suspense>
    </RequireTier>
  );
}
