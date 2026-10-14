import type { Metadata } from 'next';
import { PolicyPage } from '@/components/layout/PolicyPage';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'Cookie Policy',
  description: 'Which cookies this site uses, and how to choose which ones you allow.',
  path: '/cookies',
});

export default function Page() {
  return (
    <PolicyPage
      title="Cookie Policy"
      path="/cookies"
      summary="Which cookies this site uses, and how to choose which ones you allow."
      officialUrl={null}
    >
      <p>
        This site sets no optional cookies unless analytics is configured and you allow it. Your
        choice is stored in your browser and can be changed at any time from the cookie settings
        link in the footer.
      </p>
    </PolicyPage>
  );
}
