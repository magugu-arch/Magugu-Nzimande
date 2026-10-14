import { assetList } from '@/content/assets';
import { bio } from '@/content/bio';
import { books } from '@/content/books';
import { events } from '@/content/events';
import { content } from '@/content/learn';
import { programs } from '@/content/programs';
import { site, verifiedSocials } from '@/content/site';
import { testimonials } from '@/content/testimonials';
import type { Governance, PublishStatus } from '@/content/types';
import { contentHref } from './links';
import { buildSearchIndex } from './search-index';
import { SITE_MODE } from './env';

type Provenance = Pick<Governance, 'source' | 'lastReviewed' | 'needsConfirmation'> & {
  id: string;
  title: string;
  href: string | null;
  status: PublishStatus | null;
  isDemo: boolean;
};

const provenance = (
  r: Governance & { id: string; status?: PublishStatus },
  title: string,
  href: string | null,
): Provenance => ({
  id: r.id,
  title,
  href,
  status: r.status ?? null,
  isDemo: !!r.isDemo,
  source: r.source,
  lastReviewed: r.lastReviewed,
  needsConfirmation: r.needsConfirmation,
});

/**
 * Machine-readable metadata about the site itself: where every fact came
 * from, what is still unconfirmed, and the rights status of every image.
 * Served at /site-metadata.json in preview and embedded in the downloadable
 * single-file export, so the review trail travels with the file.
 */
export function buildSiteMetadata() {
  return {
    name: site.name,
    legalEntity: site.legalEntity,
    description: site.description,
    mode: SITE_MODE,
    brief: 'Myron Golden Website Brief v3 — 32 image assets (14 October 2026)',
    researchedOn: site.researchedOn,
    socialAccounts: verifiedSocials.map((s) => ({
      platform: s.platform,
      handle: s.handle,
      url: s.url,
      verifiedBy: s.verifiedBy,
      verifiedOn: s.verifiedOn,
    })),
    biography: {
      approved: bio.approved,
      source: bio.source,
      lastReviewed: bio.lastReviewed,
      needsConfirmation: bio.needsConfirmation,
    },
    records: {
      programs: programs.map((p) => provenance(p, p.title, `/programs/${p.slug}`)),
      books: books.map((b) => provenance(b, b.title, `/books/${b.slug}`)),
      events: events.map((e) => provenance(e, e.title, `/events/${e.slug}`)),
      library: content.map((c) => provenance(c, c.title, contentHref(c))),
      testimonials: testimonials.map((t) => provenance(t, 'Client story placeholder', null)),
    },
    assets: assetList.map((a) => ({
      id: a.id,
      file: a.file,
      width: a.width,
      height: a.height,
      alt: a.alt,
      placement: a.placement,
      status: a.status,
      note: a.note,
      creator: a.creator,
      license: a.license,
      subjectApproval: a.subjectApproval,
      productArtwork: !!a.productArtwork,
    })),
    search: buildSearchIndex(),
  };
}

export type SiteMetadata = ReturnType<typeof buildSiteMetadata>;
