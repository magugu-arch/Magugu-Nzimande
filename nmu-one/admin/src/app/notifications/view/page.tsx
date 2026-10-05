import type { Metadata } from 'next';
import { Suspense } from 'react';
import { CampaignDetail } from '@/views/CampaignDetail';

export const metadata: Metadata = { title: 'Notification' };

export default function Page() {
  return (
    <Suspense>
      <CampaignDetail />
    </Suspense>
  );
}
