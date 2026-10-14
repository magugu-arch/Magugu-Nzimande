import type { Metadata } from 'next';
import { PolicyPage } from '@/components/layout/PolicyPage';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'Disclosures',
  description: 'Educational, earnings and affiliate disclosures.',
  path: '/disclosures',
});

export default function Page() {
  return (
    <PolicyPage
      title="Disclosures"
      path="/disclosures"
      summary="Educational, earnings and affiliate disclosures."
      officialUrl={null}
    >
      <p>
        Everything on this site is educational. It is not financial, legal or tax advice, and no
        particular income or business result is promised. Stories and examples are not typical
        outcomes unless the approved disclosure says otherwise.
      </p>
    </PolicyPage>
  );
}
