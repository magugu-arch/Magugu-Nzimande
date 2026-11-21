import { Container, LoadingState } from '@hao/design-system';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { RequireRole } from '@/components/RequireTier';
import { CaseScreen } from './CaseScreen';

export const metadata: Metadata = { title: 'Case review' };

export default function StaffCasePage() {
  return (
    <RequireRole role="staff" signInHref="/staff/">
      {/* useSearchParams needs a Suspense boundary in a static export. */}
      <Suspense
        fallback={
          <Container style={{ paddingBlock: 'var(--space-7)' }}>
            <LoadingState label="Loading the case" rows={4} />
          </Container>
        }
      >
        <CaseScreen />
      </Suspense>
    </RequireRole>
  );
}
