import Link from 'next/link';
import { IS_PREVIEW } from '@/lib/env';

/**
 * Always visible in preview so nobody mistakes concept imagery, draft copy or
 * demo records for the real thing. Links to the review screen that lists
 * everything still awaiting owner approval. Absent in production.
 */
export function PreviewRibbon() {
  if (!IS_PREVIEW) return null;
  return (
    <Link
      href="/review"
      className="material fixed bottom-3 left-3 z-40 inline-flex max-w-[calc(100vw-1.5rem)] items-center gap-2 rounded-full bg-charcoal/80 py-1.5 pr-3.5 pl-2 text-[0.72rem] font-medium text-ivory/90 shadow-lg ring-1 ring-gold/35 backdrop-blur-xl hover:text-ivory sm:bottom-4 sm:left-4"
    >
      <span className="rounded-full bg-gold px-2 py-0.5 text-[0.62rem] font-bold tracking-[0.1em] text-ink uppercase">
        Preview
      </span>
      <span className="truncate">Concept images · draft copy · demo data</span>
    </Link>
  );
}
