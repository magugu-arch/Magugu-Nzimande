import { useEffect } from 'react';

const BASE = 'Grateful';

/** Set the document title for a page; null for the home page's full title. */
export function useTitle(title: string | null) {
  useEffect(() => {
    document.title = title ? `${title} — ${BASE}` : `${BASE} — Fashion designed around your identity`;
  }, [title]);
}
