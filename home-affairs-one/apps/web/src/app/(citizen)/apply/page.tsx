import { LoadingState } from '@hao/design-system';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { RequireTier } from '@/components/RequireTier';
import { ApplyScreen } from './ApplyScreen';

export const metadata: Metadata = { title: 'Apply' };

export default function ApplyPage() {
  return (
    // Drafting is open to any signed-in person; submitting needs the service's own tier,
    // which the flow asks for with an explicit step-up.
    <RequireTier tier="A1" reason="start or continue an application">
      {/* useSearchParams needs a Suspense boundary in a static export. */}
      <Suspense fallback={<LoadingState label="Loading the application" rows={3} />}>
        <ApplyScreen />
      </Suspense>
    </RequireTier>
  );
}
