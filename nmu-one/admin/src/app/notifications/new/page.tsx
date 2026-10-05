import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Composer } from '@/views/Composer';

export const metadata: Metadata = { title: 'New notification' };

export default function Page() {
  return (
    <Suspense>
      <Composer />
    </Suspense>
  );
}
