import type { Metadata } from 'next';
import { PolicyPage } from '@/components/layout/PolicyPage';
import { official } from '@/content/site';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'Refund Policy',
  description: 'How refunds and returns work for programs, events and products.',
  path: '/refunds',
});

export default function Page() {
  return (
    <PolicyPage
      title="Refund Policy"
      path="/refunds"
      summary="How refunds and returns work for programs, events and products."
      officialUrl={official.returnPolicy}
    />
  );
}
