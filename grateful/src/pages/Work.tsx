import { Expand } from 'lucide-react';
import { useCallback, useState } from 'react';
import { EditorialCard } from '../components/ui/EditorialCard';
import { FadeIn } from '../components/ui/ImageReveal';
import { SectionHeading } from '../components/ui/SectionHeading';
import { Lightbox } from '../components/work/Lightbox';
import { work, workCategories } from '../data/work';
import { useTitle } from '../lib/useTitle';

/** Rhythm for the editorial grid: spans and aspect ratios cycle so no two neighbours match. */
const layout = [
  { span: 'md:col-span-5 lg:col-span-6', aspect: 'aspect-[4/5]', offset: '' },
  { span: 'md:col-span-3 lg:col-span-4 lg:col-start-8', aspect: 'aspect-[3/4]', offset: 'lg:mt-40' },
  { span: 'md:col-span-4 md:col-start-3 lg:col-span-5 lg:col-start-3', aspect: 'aspect-[4/5]', offset: 'lg:-mt-10' },
  { span: 'md:col-span-4 lg:col-span-4 lg:col-start-9', aspect: 'aspect-[3/4]', offset: 'lg:mt-24' },
];

export default function Work() {
  useTitle('Work', 'Garments from the Grateful studio in Johannesburg — evening gowns, occasion wear and construction detail.');
  const [filter, setFilter] = useState('All');
  const [lightbox, setLightbox] = useState<number | null>(null);
  const items = filter === 'All' ? work : work.filter((w) => w.category === filter);
  const close = useCallback(() => setLightbox(null), []);

  return (
    <>
      <section className="page-gutter pt-32 pb-16 lg:pt-44">
        <div className="flex flex-col gap-10 lg:flex-row lg:items-end lg:justify-between">
          <SectionHeading as="h1" size="xl" lines={['The —', 'Work']} />
          <FadeIn className="max-w-sm lg:pb-4">
            <p className="text-lg opacity-80">Pieces from the Grateful studio, shown in their true colour so the fabric, the styling and the construction can speak for themselves.</p>
          </FadeIn>
        </div>

        <div role="group" aria-label="Filter by category" className="mt-16 flex flex-wrap gap-x-2 gap-y-2 border-t border-line pt-6">
          {workCategories.map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={filter === c}
              onClick={() => setFilter(c)}
              className={`ui-label inline-flex min-h-11 items-center border px-4 transition-colors ${filter === c ? 'border-white bg-white text-black' : 'border-transparent opacity-70 hover:opacity-100'}`}
            >
              {c}
            </button>
          ))}
        </div>
      </section>

      <section aria-label="Portfolio" className="page-gutter pb-32">
        <p className="sr-only" aria-live="polite">
          Showing {items.length} {items.length === 1 ? 'piece' : 'pieces'}
        </p>
        <ul className="editorial-grid gap-y-16">
          {items.map((item, i) => {
            const l = layout[i % layout.length]!;
            return (
              <li key={item.slug} className={`relative col-span-4 ${l.span} ${l.offset}`}>
                <EditorialCard item={item} headingLevel="h2" aspect={l.aspect} sizes="(min-width: 1024px) 45vw, (min-width: 768px) 60vw, 100vw" />
                <button
                  type="button"
                  onClick={() => setLightbox(i)}
                  className="ui-label absolute top-3 right-3 inline-flex min-h-11 items-center gap-2 bg-black/70 px-3 backdrop-blur-sm hover:bg-black"
                  aria-label={`View ${item.title} full screen`}
                >
                  <Expand aria-hidden className="size-4" /> View
                </button>
              </li>
            );
          })}
        </ul>
        <p className="mt-24 max-w-md font-sans text-sm opacity-50">More work will be added as pieces leave the studio.</p>
      </section>

      <Lightbox items={items} index={lightbox} onClose={close} onIndex={setLightbox} />
    </>
  );
}
