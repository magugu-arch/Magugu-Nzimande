import Link from 'next/link';
import { ContentCard } from '@/components/cards/Cards';
import { Breadcrumbs, type Crumb } from '@/components/layout/Breadcrumbs';
import { Photo } from '@/components/media/Photo';
import { VideoFacade } from '@/components/media/VideoFacade';
import { Eyebrow, Pill, Section } from '@/components/ui/Section';
import { contentTypeLabels, topics } from '@/content/taxonomy';
import type { ContentItem } from '@/content/types';
import { getRelated } from '@/lib/content';

const dateFormat = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

/** Shared layout for a library entry: video, article or resource. */
export function ContentDetail({ item, crumbs }: { item: ContentItem; crumbs: Crumb[] }) {
  const related = getRelated(item);
  return (
    <>
      <section className="grain bg-ink pt-[calc(var(--header-h)+3rem)] pb-12">
        <div className="container-site">
          <Breadcrumbs trail={crumbs} className="mb-10" />
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <Pill tone="muted">{contentTypeLabels[item.type]}</Pill>
              <Pill tone="muted">{topics[item.topic].label}</Pill>
              {item.isDemo ? <Pill tone="demo">Demo entry</Pill> : null}
            </div>
            <h1 className="type-display-lg mt-6">{item.title}</h1>
            <p className="type-lede mt-5 text-ivory/78">{item.excerpt}</p>
            <p className="mt-6 text-[0.9rem] text-ivory/60">
              {item.speaker} ·{' '}
              <time dateTime={item.publishedOn}>
                {dateFormat.format(new Date(item.publishedOn))}
              </time>
              {item.durationMinutes
                ? ` · ${item.durationMinutes} min ${item.type === 'video' ? 'watch' : 'read'}`
                : ''}
              {` · ${item.sourcePlatform}`}
            </p>
          </div>
          <div className="mt-12 max-w-5xl">
            {item.type === 'video' ? (
              <VideoFacade
                youtubeId={item.youtubeId}
                title={item.title}
                poster={
                  <Photo
                    id={item.image}
                    fill
                    alt=""
                    priority
                    sizes="(min-width: 1024px) 64rem, 100vw"
                  />
                }
              />
            ) : (
              <div className="relative aspect-[16/8] overflow-hidden rounded-[1.5rem]">
                <Photo id={item.image} fill priority sizes="(min-width: 1024px) 64rem, 100vw" />
              </div>
            )}
          </div>
        </div>
      </section>

      <Section tone="ivory" labelledBy="body-title" className="!pt-16">
        <div className="container-site grid gap-14 lg:grid-cols-[1fr_18rem] lg:gap-20">
          <article>
            <h2 id="body-title" className="sr-only">
              {item.type === 'video' ? 'Summary and transcript' : 'Article'}
            </h2>
            <div className="prose-site text-ink/85">
              {item.body.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>
            {item.type === 'video' ? (
              <div className="mt-12 max-w-[42rem] rounded-2xl bg-white p-6 ring-1 ring-ink/10">
                <h3 className="type-title">Transcript</h3>
                <p className="mt-2 text-slate">
                  {item.transcriptUrl ? (
                    <a href={item.transcriptUrl} className="underline">
                      Read the full transcript
                    </a>
                  ) : (
                    'The transcript will be published here alongside the video.'
                  )}
                </p>
              </div>
            ) : null}
          </article>
          <aside className="space-y-6">
            <div className="rounded-2xl bg-white p-6 ring-1 ring-ink/10">
              <Eyebrow tone="light" className="mb-3">
                Topic
              </Eyebrow>
              <p className="font-semibold">{topics[item.topic].label}</p>
              <p className="mt-1 text-[0.9rem] text-slate">{topics[item.topic].description}</p>
            </div>
            <div className="rounded-2xl bg-ink p-6 text-ivory">
              <p className="font-display text-[1.5rem] leading-tight font-semibold">
                Ready to put it to work?
              </p>
              <p className="mt-2 text-[0.9rem] text-ivory/72">
                See the programs built around this teaching.
              </p>
              <Link
                href="/programs"
                className="mt-4 inline-flex font-semibold text-gold-bright hover:text-ivory"
              >
                Explore programs →
              </Link>
            </div>
          </aside>
        </div>
      </Section>

      {related.length > 0 ? (
        <Section tone="charcoal" labelledBy="related-title">
          <div className="container-site">
            <h2 id="related-title" className="type-display-md">
              Related
            </h2>
            <ul className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((r) => (
                <li key={r.id}>
                  <ContentCard item={r} />
                </li>
              ))}
            </ul>
          </div>
        </Section>
      ) : null}
    </>
  );
}
