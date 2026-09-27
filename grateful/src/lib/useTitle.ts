import { useEffect } from 'react';

const BASE = 'Grateful';
const DEFAULT_DESCRIPTION =
  'Grateful is a fashion design studio in Mulbarton, Johannesburg. Custom garments, consultations, fittings and bespoke pieces designed around you.';

/**
 * Set the document title and meta description for a page. null → the home
 * page's full title. Crawlers that run JavaScript (Google does) read these.
 */
export function useTitle(title: string | null, description: string = DEFAULT_DESCRIPTION) {
  useEffect(() => {
    document.title = title ? `${title} — ${BASE}` : `${BASE} — Fashion designed around your identity`;
    document.querySelector('meta[name="description"]')?.setAttribute('content', description);
  }, [title, description]);
}
