import { Container, LoadingState } from '@hao/design-system';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { GuidanceScreen } from './GuidanceScreen';

export const metadata: Metadata = { title: 'Guidance' };

export default function GuidancePage() {
  return (
    // useSearchParams needs a Suspense boundary in a static export.
    <Suspense
      fallback={
        <Container width="narrow" style={{ paddingBlock: 'var(--space-7)' }}>
          <LoadingState label="Loading guidance" rows={3} />
        </Container>
      }
    >
      <GuidanceScreen />
    </Suspense>
  );
}
