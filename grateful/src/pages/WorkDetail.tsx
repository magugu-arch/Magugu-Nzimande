import { ArrowLeft, ArrowUpRight } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { ButtonLink } from '../components/ui/Button';
import { FadeIn, ImageReveal } from '../components/ui/ImageReveal';
import { Picture } from '../components/ui/Picture';
import { pageSeo, workSeo } from '../data/seo';
import { work } from '../data/work';
import { useSeo } from '../lib/useTitle';
import NotFound from './NotFound';
import { photoCredit } from '../data/images';

export default function WorkDetail() {
  const { slug } = useParams();
  const index = work.findIndex((w) => w.slug === slug);
  const item = work[index];
  useSeo(item ? workSeo(item) : pageSeo['/work'], { index: !!item });
  if (!item) return <NotFound />;
  const next = work[(index + 1) % work.length]!;

  return (
    <article>
      <div className="pt-16 lg:grid lg:min-h-svh lg:grid-cols-12 lg:pt-20">
        <ImageReveal className="relative h-[80svh] lg:col-span-7 lg:h-auto">
          <Picture image={item.image} priority sizes="(min-width: 1024px) 58vw, 100vw" className="h-full" />
        </ImageReveal>
        <div className="page-gutter flex flex-col justify-between gap-16 pt-12 pb-20 lg:col-span-5 lg:pt-12 lg:pl-12">
          <Link to="/work" className="ui-label inline-flex min-h-11 items-center gap-2 self-start opacity-70 hover:opacity-100">
            <ArrowLeft aria-hidden className="size-4" /> All work
          </Link>
          <div>
            <p className="ui-label opacity-60">
              {item.category}
              {item.year ? ` — ${item.year}` : ''}
            </p>
            <h1 className="editorial-title mt-6 text-6xl lg:text-7xl">{item.title}</h1>
            <FadeIn className="mt-10">
              <p className="font-serif text-2xl leading-snug italic">{item.summary}</p>
              <ul className="mt-10 border-t border-line">
                {item.details.map((d) => (
                  <li key={d} className="border-b border-line py-4 font-sans text-sm">
                    {d}
                  </li>
                ))}
              </ul>
              {photoCredit(item.image) && <p className="mt-4 font-sans text-xs opacity-60">Photograph: {photoCredit(item.image)}</p>}
            </FadeIn>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <ButtonLink to="/booking" arrow>
              Commission a piece
            </ButtonLink>
          </div>
        </div>
      </div>

      <Link to={`/work/${next.slug}`} className="group page-gutter flex items-end justify-between gap-6 border-t border-line py-16">
        <span>
          <span className="ui-label block opacity-60">Next</span>
          <span className="editorial-title mt-4 block text-5xl transition-transform duration-700 group-hover:translate-x-2 lg:text-8xl">{next.title}</span>
        </span>
        <ArrowUpRight aria-hidden className="mb-2 size-8 shrink-0" />
      </Link>
    </article>
  );
}
