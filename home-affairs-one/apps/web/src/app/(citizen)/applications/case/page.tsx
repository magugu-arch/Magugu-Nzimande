import { LoadingState } from '@hao/design-system';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { RequireTier } from '@/components/RequireTier';
import { CaseScreen } from './CaseScreen';

export const metadata: Metadata = { title: 'Track your application' };

export default function CasePage() {
  return (
    <RequireTier tier="A2" reason="track your application">
      {/* useSearchParams needs a Suspense boundary in a static export. */}
      <Suspense fallback={<LoadingState label="Loading your application" rows={3} />}>
        <CaseScreen />
      </Suspense>
    </RequireTier>
  );
}
