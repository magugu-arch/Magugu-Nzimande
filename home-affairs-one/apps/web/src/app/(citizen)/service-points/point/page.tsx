import { LoadingState } from '@hao/design-system';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PointScreen } from './PointScreen';

export const metadata: Metadata = { title: 'Service point' };

export default function ServicePointPage() {
  return (
    // The screen reads `?id=`; useSearchParams needs a Suspense boundary in a static export.
    <Suspense fallback={<LoadingState label="Loading the service point" rows={3} />}>
      <PointScreen />
    </Suspense>
  );
}
