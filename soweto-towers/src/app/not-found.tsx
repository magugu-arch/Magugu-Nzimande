import type { Metadata } from 'next';
import SiteLayout from './(site)/layout';
import SiteNotFound from './(site)/not-found';

export const metadata: Metadata = {
  title: 'Page not found',
  robots: { index: false, follow: true },
};

/**
 * Any URL that matches no route (an old link, a typo) gets the branded page
 * with the site's header, footer and booking bar, and a real 404 status.
 */
export default function NotFound() {
  return (
    <SiteLayout params={Promise.resolve({})}>
      <SiteNotFound />
    </SiteLayout>
  );
}
