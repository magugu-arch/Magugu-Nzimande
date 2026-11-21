import { LoadingState } from '@hao/design-system';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ServicePointsScreen } from './ServicePointsScreen';

export const metadata: Metadata = { title: 'Find a service point' };

export default function ServicePointsPage() {
  return (
    // The screen reads `?service=`; useSearchParams needs a Suspense boundary in a static export.
    <Suspense fallback={<LoadingState label="Loading service points" rows={3} />}>
      <ServicePointsScreen />
    </Suspense>
  );
}
