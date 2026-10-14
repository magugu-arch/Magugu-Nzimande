import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHero } from '@/components/layout/PageHero';
import { LibraryBrowser } from '@/components/learn/LibraryBrowser';
import { Photo } from '@/components/media/Photo';
import { VideoFacade } from '@/components/media/VideoFacade';
import { NewsletterForm } from '@/components/forms/NewsletterForm';
import { Eyebrow, Pill, Section } from '@/components/ui/Section';
import { topics } from '@/content/taxonomy';
import { getContent } from '@/lib/content';
import { contentHref } from '@/lib/links';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'Free Learning',
  description:
    'Free videos, articles and resources from Myron Golden on offers, sales, business growth, stewardship and purpose.',
  path: '/learn',
});

export default function LearnPage() {
  const items = getContent();
  const featured = items.find((i) => i.type === 'video');

  return (
    <>
      <PageHero
        image="MG-27"
        eyebrow="Free learning"
        title="Teaching you can use this week"
        intro={
          <p>
            Videos, articles and resources on offers, sales, growth and stewardship — free, with
            captions and transcripts wherever they exist.
          </p>
        }
        crumbs={[
          { name: 'Home', path: '/' },
          { name: 'Learn', path: '/learn' },
        ]}
      />

      {featured ? (
        <Section labelledBy="featured-title" className="!pb-8">
          <div className="container-site grid items-center gap-10 lg:grid-cols-[1.5fr_1fr]">
            <VideoFacade
              youtubeId={featured.youtubeId}
              title={featured.title}
              poster={
                <Photo
                  id={featured.image}
                  fill
                  alt=""
                  preload
                  sizes="(min-width: 1024px) 60vw, 100vw"
                />
              }
            />
            <div>
              <Eyebrow className="mb-4">Featured</Eyebrow>
              <div className="flex flex-wrap gap-2">
                <Pill tone="muted">{topics[featured.topic].label}</Pill>
                {featured.isDemo ? <Pill tone="demo">Demo</Pill> : null}
              </div>
              <h2 id="featured-title" className="type-display-md mt-4">
                <Link href={contentHref(featured)} className="hover:text-gold-bright">
                  {featured.title}
                </Link>
              </h2>
              <p className="mt-3 text-ivory/72">{featured.excerpt}</p>
            </div>
          </div>
        </Section>
      ) : null}

      <Section labelledBy="library-title" className="!pt-12">
        <div className="container-site">
          <h2 id="library-title" className="type-display-sm mb-8">
            The library
          </h2>
          <LibraryBrowser items={items} />
        </div>
      </Section>

      <Section tone="charcoal" labelledBy="learn-news">
        <div className="container-site grid gap-12 lg:grid-cols-[1fr_1.2fr] lg:gap-20">
          <div>
            <Eyebrow className="mb-5">Stay in the loop</Eyebrow>
            <h2 id="learn-news" className="type-display-md">
              Get new teaching as it is published
            </h2>
            <p className="mt-4 max-w-md text-ivory/72">
              Choose the topics you care about. Unsubscribe any time.
            </p>
          </div>
          <NewsletterForm sourcePage="/learn" />
        </div>
      </Section>
    </>
  );
}
