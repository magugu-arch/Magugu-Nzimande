import type { Metadata } from 'next';
import SiteLayout from './(site)/layout';
import SiteNotFound from './(site)/not-found';

export const metadata: Metadata = { title: 'Not found', robots: { index: false } };

/**
 * Unmatched URLs anywhere. Without this, Next answered them with its plain
 * default 404 (black on white, no navigation): `(site)/not-found` only covers
 * notFound() thrown inside the site's own routes.
 */
export default function NotFound() {
  return (
    <SiteLayout>
      <SiteNotFound />
    </SiteLayout>
  );
}
