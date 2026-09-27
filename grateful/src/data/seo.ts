import type { WorkItem } from './work';

/**
 * Search titles and descriptions for every public page, in one place. The
 * same entries are used twice: by the page itself (useSeo, when someone
 * browses the site) and by the build (vite.config.ts), which writes each
 * page's HTML with these tags already in <head>, for search engines and for
 * link previews on WhatsApp, Facebook and LinkedIn that never run JavaScript.
 *
 * Target searches, chosen for a made-to-measure studio in the south of
 * Johannesburg (see README → Search). Each page leads with one:
 *   /          fashion designer Johannesburg · custom dresses Johannesburg
 *   /services  custom dresses · dress alterations · bespoke garments Johannesburg
 *   /work      evening gowns · occasion wear Johannesburg
 *   /about     fashion design studio Mulbarton · Johannesburg South
 *   /booking   book a fashion design consultation Johannesburg
 *   /contact   fashion designer Johannesburg contact
 *
 * Keep titles under about 60 characters and descriptions under about 155,
 * or Google cuts them off. Only state facts the studio has confirmed.
 */

export type PageSeo = { title: string; description: string };

export const pageSeo = {
  '/': {
    title: 'Grateful | Fashion Designer & Custom Dresses, Johannesburg',
    description:
      'Grateful is a fashion design studio in Mulbarton, Johannesburg, making custom dresses, evening gowns and bespoke garments to measure. Book a consultation.',
  },
  '/services': {
    title: 'Custom Dresses, Alterations & Bespoke Garments | Grateful',
    description:
      'Custom fashion design, consultations, fittings and dress alterations, and bespoke special-occasion garments, made to measure in Johannesburg.',
  },
  '/work': {
    title: 'Evening Gowns & Occasion Wear, Johannesburg | Grateful',
    description:
      'Evening gowns, occasion wear and construction detail from Grateful, a made-to-measure fashion design studio in Johannesburg, shown in true colour.',
  },
  '/about': {
    title: 'Fashion Design Studio in Mulbarton, Johannesburg | Grateful',
    description:
      'Grateful is a fashion design studio in Mulbarton, Johannesburg South. We design, cut and fit made-to-measure garments for one person at a time.',
  },
  '/booking': {
    title: 'Book a Fashion Design Consultation, Johannesburg | Grateful',
    description:
      'Book a fashion design consultation, fitting or bespoke commission online with Grateful in Mulbarton, Johannesburg. Choose a service, date and time.',
  },
  '/contact': {
    title: 'Contact a Fashion Designer in Johannesburg | Grateful',
    description:
      'Contact Grateful, a fashion design studio in Mulbarton, Johannesburg. Email gratefulpty@gmail.com or send an enquiry about a custom garment.',
  },
  '/privacy': {
    title: 'Privacy Notice | Grateful',
    description: 'How Grateful collects, uses and protects your personal information under POPIA.',
  },
} satisfies Record<string, PageSeo>;

export type SeoPath = keyof typeof pageSeo;

/** A garment study page: its title and category, with the studio's location for local search. */
export function workSeo(item: Pick<WorkItem, 'title' | 'category' | 'summary'>): PageSeo {
  return {
    title: `${item.title}: ${item.category} | Grateful Johannesburg`,
    description: item.summary.length > 155 ? `${item.summary.slice(0, 152).replace(/\s+\S*$/, '')}…` : item.summary,
  };
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * BUILD: rewrite the built index.html's <head> for one page — title,
 * description, social tags, and (when the live address is known) canonical
 * and og:url. Pure string work, so it is unit-tested.
 */
export function withPageHead(html: string, meta: PageSeo, url: string | null): string {
  const t = esc(meta.title);
  const d = esc(meta.description);
  let out = html
    // Function replacers, so a "$" in the copy is never read as a pattern.
    .replace(/<title>[^<]*<\/title>/, () => `<title>${t}</title>`)
    .replace(/(<meta name="description" content=")[^"]*(")/, (_, a: string, b: string) => a + d + b)
    .replace(/(<meta property="og:title" content=")[^"]*(")/, (_, a: string, b: string) => a + t + b)
    .replace(/(<meta property="og:description" content=")[^"]*(")/, (_, a: string, b: string) => a + d + b)
    .replace(/\s*<link rel="canonical"[^>]*>/, '')
    .replace(/\s*<meta property="og:url"[^>]*>/, '');
  if (url) out = out.replace('<!--seo:head-->', () => `<!--seo:head-->\n    <link rel="canonical" href="${esc(url)}" />\n    <meta property="og:url" content="${esc(url)}" />`);
  return out;
}

/** Every public page that belongs in search: the fixed pages, then each garment study. */
export function indexablePages(items: Pick<WorkItem, 'slug' | 'title' | 'category' | 'summary'>[]): { path: string; meta: PageSeo }[] {
  return [
    ...Object.entries(pageSeo).map(([path, meta]) => ({ path, meta })),
    ...items.map((w) => ({ path: `/work/${w.slug}`, meta: workSeo(w) })),
  ];
}
