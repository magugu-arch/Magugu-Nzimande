import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { CtaBand } from '@/components/content/CtaBand';
import { PageSkeleton } from '@/components/content/PageSkeleton';
import { RichText } from '@/components/content/RichText';
import styles from '@/components/content/content.module.css';
import { Breadcrumbs } from '@/components/site/Breadcrumbs';
import { JsonLd } from '@/components/site/JsonLd';
import { ArrowUpRight } from '@/components/ui/icons';
import { Photo } from '@/components/ui/Photo';
import { image } from '@/content/images';
import { articles, getArticle } from '@/content/journal';
import { article as articleLd, graph } from '@/lib/jsonld';
import { formatDayLong } from '@/lib/time';
import { pageMeta } from '@/lib/seo';
import journal from '../journal.module.css';

export async function generateStaticParams() {
  return articles.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: PageProps<'/journal/[slug]'>): Promise<Metadata> {
  const { slug } = await params;
  const a = getArticle(slug);
  if (!a) return {};
  return pageMeta({
    title: a.title,
    description: a.description,
    path: `/journal/${a.slug}`,
    image: `/og/journal-${a.slug}.jpg`,
    imageAlt: image(a.image).alt,
    type: 'article',
    publishedTime: a.published,
  });
}

type Params = PageProps<'/journal/[slug]'>['params'];

/** The slug is read inside Suspense so navigations get the App Shell (and the closing band) at once. */
export default function ArticlePage({ params }: PageProps<'/journal/[slug]'>) {
  return (
    <>
      <Suspense fallback={<PageSkeleton variant="article" />}>
        <ArticleBody params={params} />
      </Suspense>

      <CtaBand
        headingId="article-cta"
        image="bungee-pov-edge"
        eyebrow="#100mClub"
        title="Ready when you are."
        text="Book a timed slot online. Your ticket and Scream Clip come to WhatsApp."
      />
    </>
  );
}

async function ArticleBody({ params }: { params: Params }) {
  const { slug } = await params;
  const a = getArticle(slug);
  if (!a) notFound();
  const more = articles.filter((x) => x.slug !== a.slug);

  return (
    <>
      <article className="section section--tight" aria-labelledby="article-title">
        <div className="container--narrow">
          <header className={styles.articleHead}>
            <Breadcrumbs
              items={[
                { name: 'Journal', path: '/journal' },
                { name: a.title, path: `/journal/${a.slug}` },
              ]}
            />
            <p className="eyebrow">Journal</p>
            <h1 id="article-title" className="h1">
              {a.title}
            </h1>
            <p className="lede">{a.description}</p>
            <p className={styles.articleMeta}>
              <span>
                By Soweto Towers · <time dateTime={a.published}>{formatDayLong(a.published)}</time>
              </span>
              <span>{a.readMinutes} min read</span>
            </p>
          </header>
        </div>
        <div className="container">
          <div className={`frame ${styles.articleFigure}`}>
            <Photo slug={a.image} sizes="(min-width: 1320px) 1280px, 100vw" eager />
          </div>
        </div>
        <div className="container--narrow">
          <RichText body={a.body} className={styles.articleBody} />
          <aside className={`${journal.related} ${styles.mt}`} aria-labelledby="more-title">
            <h2 id="more-title" className="h4">
              More from the journal
            </h2>
            {more.map((m) => (
              <Link key={m.slug} href={`/journal/${m.slug}` as Route} className="link-arrow">
                {m.title} <ArrowUpRight />
              </Link>
            ))}
          </aside>
        </div>
      </article>

      <JsonLd data={graph(articleLd({ slug: a.slug, title: a.title, description: a.description, published: a.published, image: image(a.image).src }))} />
    </>
  );
}
