import { Container, LoadingState } from '@hao/design-system';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { SearchScreen } from './SearchScreen';

export const metadata: Metadata = { title: 'Search' };

export default function SearchPage() {
  return (
    // useSearchParams needs a Suspense boundary in a static export.
    <Suspense
      fallback={
        <Container style={{ paddingBlock: 'var(--space-7)' }}>
          <LoadingState label="Loading search" rows={2} />
        </Container>
      }
    >
      <SearchScreen />
    </Suspense>
  );
}
