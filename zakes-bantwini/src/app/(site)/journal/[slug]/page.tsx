import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHero } from '@/components/layout/PageHero';
import { ArtImage } from '@/components/media/ArtImage';
import { JsonLd } from '@/components/seo/JsonLd';
import { ApprovalFlag } from '@/components/ui/ApprovalFlag';
import { getStories, getStory, JOURNAL_CATEGORIES } from '@/content';
import { formatDay } from '@/lib/booking/dates';
import { articleJsonLd, pageMetadata } from '@/lib/seo';
import styles from '../../pages.module.css';

export async function generateStaticParams() {
  return (await getStories()).map((s) => ({ slug: s.slug }));
}

export async function generateMetadata(props: PageProps<'/journal/[slug]'>) {
  const { slug } = await props.params;
  const story = await getStory(slug);
  if (!story) return {};
  return pageMetadata({ title: story.title, description: story.standfirst, path: `/journal/${story.slug}`, image: story.hero });
}

export default async function StoryPage(props: PageProps<'/journal/[slug]'>) {
  const { slug } = await props.params;
  const story = await getStory(slug);
  if (!story) notFound();
  const all = await getStories();
  const next = all[(all.findIndex((s) => s.slug === story.slug) + 1) % all.length];
  const category = JOURNAL_CATEGORIES.find((c) => c.key === story.category)?.label ?? story.category;

  return (
    <article>
      <JsonLd data={articleJsonLd(story)} />
      <PageHero eyebrow={`${category}${story.publishedAt ? ` · ${formatDay(story.publishedAt)}` : ''}`} title={[story.title]} intro={story.standfirst} media={story.hero} overlay="bottom" />
      <div className="container section">
        <div className={styles.prose}>
          <ApprovalFlag approval={story.approval} />
          {story.body.map((b, i) => {
            switch (b.type) {
              case 'p':
                return <p key={i}>{b.text}</p>;
              case 'h2':
                return <h2 key={i}>{b.text}</h2>;
              case 'statement':
                return (
                  <p key={i} className="statement">
                    {b.text}
                  </p>
                );
              case 'image':
                return (
                  <figure key={i}>
                    <ArtImage id={b.media} sizes="(max-width: 860px) 100vw, 760px" ratio={{ desktop: '3/2', mobile: '4/5' }} />
                    {b.caption && <figcaption>{b.caption}</figcaption>}
                  </figure>
                );
            }
          })}
        </div>
      </div>
      {next && next.slug !== story.slug && (
        <section className={`section ${styles.band}`} aria-labelledby="next-title">
          <div className={`container ${styles.split}`}>
            <Link href={`/journal/${next.slug}`} className="zoom-parent" data-cursor="Open" aria-hidden="true" tabIndex={-1}>
              <ArtImage id={next.hero} hover="zoom" sizes="(max-width: 960px) 100vw, 45vw" ratio={{ desktop: '4/3', mobile: '4/3' }} decorative />
            </Link>
            <div className={styles.copy}>
              <p className="eyebrow eyebrow-accent">Next story</p>
              <h2 id="next-title" className="statement">
                <Link href={`/journal/${next.slug}`}>{next.title}</Link>
              </h2>
              <p className="muted">{next.standfirst}</p>
            </div>
          </div>
        </section>
      )}
    </article>
  );
}
