import type { Metadata } from 'next';
import { PolicyPage } from '@/components/layout/PolicyPage';
import { official } from '@/content/site';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'Terms of Use',
  description:
    'The terms that apply when you use this site and the official platforms it links to.',
  path: '/terms',
});

export default function Page() {
  return (
    <PolicyPage
      title="Terms of Use"
      path="/terms"
      summary="The terms that apply when you use this site and the official platforms it links to."
      officialUrl={official.terms}
    />
  );
}
