import type { Metadata } from 'next';
import { PolicyPage } from '@/components/layout/PolicyPage';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'Privacy Policy',
  description:
    'How personal information collected through this site is used, stored and protected.',
  path: '/privacy',
});

export default function Page() {
  return (
    <PolicyPage
      title="Privacy Policy"
      path="/privacy"
      summary="How personal information collected through this site is used, stored and protected."
      officialUrl={null}
    />
  );
}
