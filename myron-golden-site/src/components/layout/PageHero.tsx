import type { ReactNode } from 'react';
import { getAsset } from '@/content/assets';
import { cn } from '@/lib/cn';
import { Photo } from '../media/Photo';
import { Eyebrow } from '../ui/Section';
import { Breadcrumbs, type Crumb } from './Breadcrumbs';

/**
 * Inner-page heroes. `cover` lays the headline over a full-bleed photograph
 * with a gradient that guarantees contrast; `split` sets it beside a framed
 * photograph. Headlines are always HTML, never part of the image.
 *
 * A cover hero needs its subject on the right, clear of the headline. When
 * the asset register says the subject sits left of centre, the hero becomes
 * a split instead, so the headline never lands on someone's face.
 */
export function PageHero({
  eyebrow,
  title,
  intro,
  image,
  variant = 'cover',
  crumbs,
  actions,
  meta,
  focus,
}: {
  eyebrow?: string;
  title: ReactNode;
  intro?: ReactNode;
  image?: string;
  variant?: 'cover' | 'split' | 'plain';
  crumbs?: Crumb[];
  actions?: ReactNode;
  meta?: ReactNode;
  focus?: string;
}) {
  const asset = image ? getAsset(image) : null;
  const subjectX = parseFloat((focus ?? asset?.focus ?? '50%').split(' ')[0] ?? '50');
  const layout = variant === 'cover' && subjectX < 50 ? 'split' : variant;
  const landscape = asset ? asset.width > asset.height : false;

  const text = (
    <div className="relative max-w-2xl">
      {crumbs ? <Breadcrumbs trail={crumbs} className="mb-8" /> : null}
      {eyebrow ? <Eyebrow className="mb-5">{eyebrow}</Eyebrow> : null}
      <h1 className="type-display-lg">{title}</h1>
      {intro ? <div className="type-lede mt-6 max-w-xl text-ivory/78">{intro}</div> : null}
      {meta ? <div className="mt-6">{meta}</div> : null}
      {actions ? <div className="mt-8 flex flex-wrap gap-3">{actions}</div> : null}
    </div>
  );

  if (layout === 'cover' && image) {
    return (
      <section className="relative isolate flex min-h-[34rem] items-end overflow-hidden bg-ink pt-[calc(var(--header-h)+4rem)] pb-16 md:min-h-[40rem] md:pb-24">
        <div className="absolute inset-0 -z-10">
          <Photo id={image} fill priority sizes="100vw" alt="" focus={focus} />
          {/* Left-weighted shade on wide screens, bottom-weighted on narrow ones. */}
          <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/70 to-ink/20 md:bg-gradient-to-r md:from-ink md:via-ink/75 md:to-transparent" />
          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-ink to-transparent" />
        </div>
        <div className="container-site">{text}</div>
      </section>
    );
  }

  if (layout === 'split' && image) {
    return (
      <section className="grain relative overflow-hidden bg-ink pt-[calc(var(--header-h)+3rem)] pb-16 md:pb-24">
        <div className="container-site grid items-center gap-12 md:grid-cols-[1.15fr_1fr] lg:gap-20">
          {text}
          <div
            className={cn(
              'relative overflow-hidden rounded-[1.75rem] ring-1 ring-ivory/10',
              landscape ? 'aspect-[4/3]' : 'aspect-[4/5]',
            )}
          >
            <Photo
              id={image}
              fill
              priority
              sizes="(min-width: 768px) 45vw, 100vw"
              quality={82}
              focus={focus}
            />
            <div className="pointer-events-none absolute inset-0 rounded-[1.75rem] ring-1 ring-gold/20 ring-inset" />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      className={cn(
        'grain relative bg-ink pt-[calc(var(--header-h)+3.5rem)] pb-14 md:pt-[calc(var(--header-h)+5rem)] md:pb-20',
      )}
    >
      <div className="container-site">{text}</div>
    </section>
  );
}
