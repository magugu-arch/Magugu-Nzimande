import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router';
import type { WorkItem } from '../../data/work';
import { ImageReveal } from './ImageReveal';
import { Picture } from './Picture';

/**
 * A portfolio tile. Image first; on hover the photo eases to 1.03 and the
 * metadata slides up. On touch screens the metadata is simply always visible.
 */
export function EditorialCard({
  item,
  aspect = 'aspect-[4/5]',
  sizes,
  index,
  headingLevel = 'h3',
}: {
  /** h2 where the cards sit directly under the page's h1 (the Work page). */
  headingLevel?: 'h2' | 'h3';
  item: WorkItem;
  aspect?: string;
  sizes: string;
  index?: number;
}) {
  const Heading = headingLevel;
  return (
    <Link to={`/work/${item.slug}`} className="group block" aria-label={`${item.title} — ${item.category}`}>
      <ImageReveal className={`relative ${aspect}`}>
        <Picture
          image={item.image}
          sizes={sizes}
          className="h-full"
          imgClassName="transition-transform duration-[1200ms] ease-[var(--ease-editorial)] group-hover:scale-[1.03]"
        />
        {index !== undefined && <span className="ui-label absolute top-4 left-4 mix-blend-difference">({String(index + 1).padStart(2, '0')})</span>}
      </ImageReveal>
      <div className="mt-4 flex items-start justify-between gap-4 overflow-hidden">
        <div className="transition-transform duration-700 ease-[var(--ease-editorial)] lg:translate-y-1 lg:group-hover:translate-y-0">
          <Heading className="font-serif text-2xl leading-tight uppercase">{item.title}</Heading>
          <p className="ui-label mt-2 opacity-60">
            {item.category}
            {item.year ? ` — ${item.year}` : ''}
          </p>
        </div>
        <ArrowUpRight aria-hidden className="mt-1 size-5 shrink-0 opacity-60 transition-all duration-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100" />
      </div>
    </Link>
  );
}
